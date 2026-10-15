import { labTransitSql } from './labArrival.js';
import { presentWithdrawalTimeline, withdrawalInTransitSql } from './withdrawalTimeline.js';
import { FlowError, requireText, optionalText, requireEquipmentType, requirePositiveInteger,
  requireIsoDate, requireEquipment, requireTerminalPst, withTransaction, addFlowEvent } from './bridgeFlow.js';
import { insertCorrelation } from './assetHistory.js';
import { requireOperationalAsset } from './assetManagement.js';
import { logisticsStateSql } from './logisticsPresentation.js';
import { searchRequirementAssets } from './requirementSearch.js';

export function normalizeAranda(value) {
  const input = requireText(value,'referencia_externa',{max:33}).toUpperCase();
  const match = /^(?:AR-)?([0-9]{1,30})$/.exec(input);
  if (!match) throw new FlowError(422,'INVALID_ARANDA_REFERENCE','Usa solo dígitos o AR- seguido de dígitos');
  return { referencia: `AR-${match[1]}`, componente: match[1] };
}
export function requirementInput(body = {}) {
  if (body.registrar_activo !== undefined)
    throw new FlowError(422,'ASSET_CREATION_NOT_ALLOWED','Ingreso de requerimientos no crea activos. Usa Gestión de activos.');
  const origen = requireText(body.origen,'origen',{max:32}).toUpperCase();
  if (!['ARANDA','INTERNO'].includes(origen)) throw new FlowError(422,'INVALID_ORIGIN','El origen debe ser ARANDA o INTERNO');
  const reference = origen==='ARANDA' ? normalizeAranda(body.referencia_externa) : null;
  if (origen==='INTERNO' && body.referencia_externa) throw new FlowError(422,'INVALID_ORIGIN','Un caso interno no requiere referencia Aranda');
  const clasificacion = body.clasificacion || 'MANTENCION';
  if (!['MANTENCION','POD'].includes(clasificacion)) throw new FlowError(422,'INVALID_CLASSIFICATION','Clasificación inválida');
  const bus = requireText(body.bus_ppu,'bus_ppu',{max:10}).toUpperCase();
  if (bus==='STOCK') throw new FlowError(422,'BUS_REQUIRED','Indica el bus del requerimiento');
  return { origen, referencia:reference?.referencia ?? null, componente:reference?.componente ?? null,
    tipo:requireEquipmentType(body.tipo_equipo),serie:requireText(body.serie,'serie',{max:50}).toUpperCase(),
    bus, terminal:requirePositiveInteger(body.terminal_id,'terminal_id'),pst:requireText(body.pst_codigo,'pst_codigo',{max:20}),
    falla:requireText(body.falla,'falla',{max:4000}),observacion:optionalText(body.observacion,'observacion',{max:4000}),
    fecha:requireIsoDate(body.fecha_requerimiento,'fecha_requerimiento'),pod:clasificacion==='POD' };
}

export async function createCaseWithClient(client,input,user) {
  await requireEquipment(client,input.tipo,input.serie);
  await requireTerminalPst(client,input.terminal,input.pst);
  let component=input.componente, codigo=input.referencia;
  if (input.origen==='INTERNO') {
    const n=(await client.query("SELECT nextval('pmp.seq_caso_interno')::text AS n")).rows[0].n;
    component=`INT${n.padStart(6,'0')}`; codigo=`INT-${n.padStart(6,'0')}`;
  }
  await client.query('INSERT INTO pmp.buses(ppu) VALUES($1) ON CONFLICT DO NOTHING',[input.bus]);
  return (await client.query(`INSERT INTO pmp.casos_operacionales
    (codigo_caso,origen,referencia_externa,componente,tipo_equipo,serie_origen,bus_ppu,terminal_id,pst_codigo,
     falla_reportada,observacion,fecha_requerimiento,creado_por)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
  [codigo,input.origen,input.referencia,component,input.tipo,input.serie,input.bus,input.terminal,input.pst,
    input.falla,input.observacion,input.fecha,user.id])).rows[0];
}
export async function correlateCaseOrder(client,caso,os,user) {
  if (!caso.referencia_externa) return;
  await insertCorrelation(client,{tipo_equipo:os.tipo_equipo,serie:os.validador_serie||os.consola_serie,
    codigo_os:os.codigo_os,sistema_externo:caso.origen,referencia_externa:caso.referencia_externa},user);
}
export async function createRequirement(pool,body,user) {
  const input=requirementInput(body);
  return withTransaction(pool,async client=>{
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',[`${input.tipo}|${input.serie}`]);
    if(input.referencia && (await client.query('SELECT 1 FROM pmp.casos_operacionales WHERE origen=$1 AND referencia_externa=$2',[input.origen,input.referencia])).rowCount)
      throw new FlowError(409,'REQUIREMENT_EXISTS','El requerimiento ya existe. Consulta el caso para agregar intervenciones relacionadas.');
    const active=await client.query(`SELECT codigo_os FROM pmp.ordenes_servicio WHERE tipo_equipo=$1
      AND COALESCE(validador_serie,consola_serie)=$2 AND estado_id NOT IN (8,12,13)`,[input.tipo,input.serie]);
    if(active.rowCount) throw new FlowError(409,'ASSET_ACTIVE_ORDER',`El activo ya tiene una intervención activa: ${active.rows[0].codigo_os}`);
    await requireOperationalAsset(client,input.tipo,input.serie,input.bus);
    const installation=(await searchRequirementAssets(client,{tipo_equipo:input.tipo,serie_exacta:input.serie,bus_ppu:input.bus,bus_exacto:true,limit:1})).items[0];
    if(!installation||Number(installation.terminal_id)!==input.terminal||installation.pst_codigo!==input.pst)
      throw new FlowError(409,'INSTALLATION_CONTEXT_CHANGED','El bus, terminal u operador no coincide con la instalación vigente. Vuelve a seleccionar el activo.');
    const caso=await createCaseWithClient(client,input,user);
    const os=(await client.query(`INSERT INTO pmp.ordenes_servicio
      (tipo_equipo,es_pod,validador_serie,consola_serie,falla,estado_id,bus_ppu,terminal_id,pst_codigo,caso_id)
      VALUES($1,$2,$3,$4,$5,1,$6,$7,$8,$9) RETURNING *`,
    [input.tipo,input.pod,input.tipo==='VALIDADOR'?input.serie:null,input.tipo==='CONSOLA'?input.serie:null,
      input.falla,input.bus,input.terminal,input.pst,caso.id])).rows[0];
    await correlateCaseOrder(client,caso,os,user);
    await addFlowEvent(client,{os:os.codigo_os,type:'REQUERIMIENTO_INGRESADO',user,comment:input.observacion,
      metadata:{caso_id:caso.id,origen:caso.origen,referencia_externa:caso.referencia_externa}});
    return {caso,os};
  });
}
export async function listCases(client,query='',page={}) {
  const offset=Math.max(0,Number.parseInt(page.offset,10)||0),limit=Math.min(100,Math.max(1,Number.parseInt(page.limit,10)||100));
  const q=typeof query==='string'?query.trim():'';
  if(q.length>120) throw new FlowError(422,'INVALID_QUERY','La búsqueda supera 120 caracteres');
  const pattern=`%${q.replace(/[\\%_]/g,'\\$&')}%`;
  return (await client.query(`SELECT c.*,t.nombre AS terminal,
    COALESCE((SELECT json_agg(json_build_object('codigo_os',o.codigo_os,'tipo_equipo',o.tipo_equipo,
      'serie',COALESCE(o.validador_serie,o.consola_serie),'es_instalacion',o.es_instalacion) ORDER BY o.fecha)
      FROM pmp.ordenes_servicio o WHERE o.caso_id=c.id),'[]'::json) AS ordenes
    FROM pmp.casos_operacionales c JOIN pmp.terminales t ON t.id=c.terminal_id
    WHERE c.codigo_caso ILIKE $1 OR c.serie_origen ILIKE $1 OR c.bus_ppu ILIKE $1
      OR EXISTS(SELECT 1 FROM pmp.ordenes_servicio o WHERE o.caso_id=c.id AND o.codigo_os ILIKE $1)
      OR EXISTS(SELECT 1 FROM pmp.ordenes_servicio o JOIN pmp.v_referencias_activo r ON r.codigo_os=o.codigo_os
        WHERE o.caso_id=c.id AND r.referencia_externa ILIKE $1)
    ORDER BY c.creado_en DESC,c.id DESC LIMIT $2 OFFSET $3`,[pattern,limit,offset])).rows;
}
export async function getCase(client,id) {
  const caseId=requirePositiveInteger(id,'caso_id');
  const caso=(await client.query(`SELECT c.*,t.nombre AS terminal FROM pmp.casos_operacionales c
    JOIN pmp.terminales t ON t.id=c.terminal_id WHERE c.id=$1`,[caseId])).rows[0];
  if(!caso) throw new FlowError(404,'CASE_NOT_FOUND','Caso no encontrado');
  const ordenes=(await client.query(`SELECT o.*,COALESCE(o.validador_serie,o.consola_serie) AS serie,
    ${logisticsStateSql()} AS estado_nombre,t.nombre AS terminal,
    CASE WHEN ${labTransitSql()} THEN 'En tránsito hacia Laboratorio' WHEN o.estado_id=11 OR ${withdrawalInTransitSql()} THEN 'En tránsito hacia Bodega' ELSE ub.nombre END AS ubicacion,
    concat_ws(' ',u.nombre,u.apellido) AS tecnico_nombre
    FROM pmp.ordenes_servicio o JOIN pmp.estados e ON e.id=o.estado_id
    JOIN pmp.terminales t ON t.id=o.terminal_id LEFT JOIN pmp.usuarios u ON u.id=o.tecnico_terreno_id
    LEFT JOIN pmp.ubicaciones ub ON ub.id=o.ubicacion_id
    WHERE o.caso_id=$1 ORDER BY o.fecha,o.codigo_os`,[caseId])).rows;
  const referencias=(await client.query(`SELECT r.* FROM pmp.v_referencias_activo r
    JOIN pmp.ordenes_servicio o ON o.codigo_os=r.codigo_os WHERE o.caso_id=$1 ORDER BY r.fecha`,[caseId])).rows;
  const eventos=(await client.query(`WITH ordenes AS (SELECT codigo_os FROM pmp.ordenes_servicio WHERE caso_id=$1)
    SELECT 'flujo:'||id AS id,codigo_os,tipo,fecha,comentario,metadata || jsonb_build_object('ubicacion',COALESCE(metadata->>'ubicacion',(SELECT nombre FROM pmp.ubicaciones WHERE id::text=metadata->>'ubicacion_id'))) AS detalle FROM pmp.flujo_eventos WHERE codigo_os IN (SELECT codigo_os FROM ordenes)
    UNION ALL SELECT 'os:'||id,codigo_os,evento,fecha,NULL,jsonb_build_object('anterior',anterior,'actual',actual)
      FROM pmp.os_historial_activo WHERE codigo_os IN (SELECT codigo_os FROM ordenes)
    UNION ALL SELECT 'reparacion:'||id,codigo_os,'REPARACION',fecha_registro,comentario,to_jsonb(r)
      FROM pmp.registro_reparaciones r WHERE codigo_os IN (SELECT codigo_os FROM ordenes)
    UNION ALL SELECT 'qa:'||id,codigo_os,'QA_'||resultado,fecha,comentario,to_jsonb(q)
      FROM pmp.qa_inspecciones q WHERE codigo_os IN (SELECT codigo_os FROM ordenes)
    ORDER BY fecha,id`,[caseId])).rows;
  return {caso,ordenes,referencias,eventos:presentWithdrawalTimeline(eventos)};
}

export async function derivePod(pool,id,body,user) {
  const caseId=requirePositiveInteger(id,'caso_id'),code=requireText(body.codigo_os,'codigo_os',{max:50});
  return withTransaction(pool,async client=>{
    const caso=(await client.query('SELECT * FROM pmp.casos_operacionales WHERE id=$1 FOR UPDATE',[caseId])).rows[0];
    if(!caso) throw new FlowError(404,'CASE_NOT_FOUND','Caso no encontrado');
    const old=(await client.query('SELECT * FROM pmp.ordenes_servicio WHERE codigo_os=$1 AND caso_id=$2 FOR UPDATE',[code,caseId])).rows[0];
    if(!old || old.es_instalacion || old.es_pod || ![1,2,3,4,5,9].includes(old.estado_id))
      throw new FlowError(409,'POD_DERIVATION_NOT_ALLOWED','Solo puede derivarse una mantención en curso antes de finalizar taller');
    const os=(await client.query(`INSERT INTO pmp.ordenes_servicio
      (tipo_equipo,es_pod,validador_serie,consola_serie,falla,estado_id,bus_ppu,terminal_id,pst_codigo,
       caso_id,os_origen,ubicacion_id,tecnico_terreno_id,tecnico_laboratorio_id)
      VALUES($1,TRUE,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
    [old.tipo_equipo,old.validador_serie,old.consola_serie,old.falla,old.estado_id,old.bus_ppu,old.terminal_id,
      old.pst_codigo,caseId,code,old.ubicacion_id,old.tecnico_terreno_id,old.tecnico_laboratorio_id])).rows[0];
    await client.query('UPDATE pmp.ordenes_servicio SET estado_id=13,actualizado_en=now() WHERE codigo_os=$1',[code]);
    await correlateCaseOrder(client,caso,os,user);
    for(const codigo of [code,os.codigo_os]) await addFlowEvent(client,{os:codigo,type:'DERIVACION_POD',user,
      metadata:{caso_id:caseId,os_origen:code,os_pod:os.codigo_os}});
    return {caso,os};
  });
}
