import {qaStateSql,qaStageSql} from './qaCustody.js';
import { labTransitSql } from './labArrival.js';
import { presentWithdrawalTimeline, historyStateLabel, withdrawalInTransitSql } from './withdrawalTimeline.js';
import { FlowError, requireText, requireEquipmentType, optionalText, requireEquipment, withTransaction } from './bridgeFlow.js';
import { pendingTerrainSql } from './logisticsPresentation.js';

export const ASSETS_SQL = `SELECT 'VALIDADOR'::text AS tipo_equipo,serie,modelo,marca FROM pmp.validadores
  UNION ALL SELECT 'CONSOLA',serie,modelo,marca FROM pmp.consolas`;
export function correlationInput(body = {}) {
  const allowed = new Set(['tipo_equipo','serie','codigo_os','sistema_externo','referencia_externa','comentario']);
  if (!body || Object.keys(body).some(key => !allowed.has(key)))
    throw new FlowError(422,'CORRELATION_ONLY','Bridge solo admite datos de correlación');
  return {
    tipo: requireEquipmentType(body.tipo_equipo), serie: requireText(body.serie,'serie',{max:50}),
    os: requireText(body.codigo_os,'codigo_os',{max:50}),
    sistema: requireText(body.sistema_externo,'sistema_externo',{max:50}).toUpperCase(),
    referencia: requireText(body.referencia_externa,'referencia_externa',{max:120}),
    comentario: optionalText(body.comentario,'comentario',{max:3000})
  };
}
export async function createCorrelation(pool, body, user) {
  return withTransaction(pool, client => insertCorrelation(client,body,user));
}
// The caller may share its transaction; this helper only writes the correlation.
export async function insertCorrelation(client, body, user) {
  const input = correlationInput(body);
    await requireEquipment(client,input.tipo,input.serie);
    const order = await client.query(`SELECT codigo_os FROM pmp.ordenes_servicio
      WHERE codigo_os=$1 AND tipo_equipo=$2 AND COALESCE(validador_serie,consola_serie)=$3 FOR SHARE`,
    [input.os,input.tipo,input.serie]);
    if (!order.rowCount) throw new FlowError(422,'OS_ASSET_MISMATCH','La OS PMP no pertenece a la serie y tipo indicados');
    const existing = await client.query(`SELECT 1 FROM pmp.v_referencias_activo
      WHERE tipo_equipo=$1 AND serie=$2 AND codigo_os=$3
      AND lower(sistema_externo)=lower($4) AND lower(referencia_externa)=lower($5)`,
    [input.tipo,input.serie,input.os,input.sistema,input.referencia]);
    if (existing.rowCount) throw new FlowError(409,'REFERENCE_EXISTS','Este vínculo ya existe');
    const result = await client.query(`INSERT INTO pmp.bridge_referencias
      (tipo_equipo,serie,codigo_os,sistema_externo,referencia_externa,comentario,creado_por)
      VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING RETURNING *`,
    [input.tipo,input.serie,input.os,input.sistema,input.referencia,input.comentario,user.id]);
    if (!result.rowCount) throw new FlowError(409,'REFERENCE_EXISTS','Este vínculo ya existe');
    return result.rows[0];
}
export async function searchAssets(pool, query) {
  const term = requireText(query,'q',{max:120});
  const pattern = `%${term.replace(/[\\%_]/g, '\\$&')}%`;
  return (await pool.query(`WITH activos AS (${ASSETS_SQL})
    SELECT a.tipo_equipo,a.serie,a.modelo,a.marca FROM activos a WHERE a.serie ILIKE $1
    OR EXISTS(SELECT 1 FROM pmp.ordenes_servicio o WHERE o.tipo_equipo=a.tipo_equipo
      AND COALESCE(o.validador_serie,o.consola_serie)=a.serie AND o.codigo_os ILIKE $1)
    OR EXISTS(SELECT 1 FROM pmp.v_referencias_activo r WHERE r.tipo_equipo=a.tipo_equipo
      AND r.serie=a.serie AND r.referencia_externa ILIKE $1)
    ORDER BY a.serie,a.tipo_equipo`,[pattern])).rows;
}
export async function getAssetHistory(pool, type, series) {
  const tipo = requireEquipmentType(type), serie = requireText(series,'serie',{max:50});
  await requireEquipment(pool,tipo,serie);
  const params = [tipo,serie];
  const identity=(await pool.query(`SELECT modelo,marca FROM (${ASSETS_SQL}) a WHERE tipo_equipo=$1 AND serie=$2`,params)).rows[0]||{};
  const orders = await pool.query(`SELECT o.*,CASE WHEN o.estado_id=6 THEN ${qaStateSql()} WHEN ${labTransitSql()} THEN 'En tránsito hacia Laboratorio' WHEN ${pendingTerrainSql()} THEN 'PENDIENTE_RETIRO' ELSE e.nombre END AS estado,CASE WHEN o.estado_id=6 AND ${qaStageSql()}='RECEPCION' THEN 'En tránsito hacia QA' WHEN o.estado_id=6 AND ${qaStageSql()}='POR_VERIFICAR' THEN 'Por verificar' WHEN ${labTransitSql()} THEN 'En tránsito hacia Laboratorio' WHEN o.estado_id=11 OR ${withdrawalInTransitSql()} THEN 'En tránsito hacia Bodega' ELSE ub.nombre END AS ubicacion,c.codigo_caso,c.origen,
    COALESCE(o.validador_serie,o.consola_serie) AS serie
    FROM pmp.ordenes_servicio o LEFT JOIN pmp.estados e ON e.id=o.estado_id
    LEFT JOIN pmp.ubicaciones ub ON ub.id=o.ubicacion_id
    LEFT JOIN pmp.casos_operacionales c ON c.id=o.caso_id
    WHERE o.tipo_equipo=$1 AND COALESCE(o.validador_serie,o.consola_serie)=$2 ORDER BY o.fecha,o.codigo_os`,params);
  const references = await pool.query(`SELECT * FROM pmp.v_referencias_activo
    WHERE tipo_equipo=$1 AND serie=$2 ORDER BY fecha,id`,params);
  const events = await pool.query(`WITH ordenes AS (
    SELECT codigo_os FROM pmp.ordenes_servicio WHERE tipo_equipo=$1 AND COALESCE(validador_serie,consola_serie)=$2
  ), historicos AS (
    SELECT 'flujo:'||f.id AS id,f.codigo_os,f.fecha,f.tipo,f.comentario,to_jsonb(f) AS detalle
      FROM pmp.flujo_eventos f WHERE (f.tipo_equipo=$1 AND f.serie=$2) OR f.codigo_os IN (SELECT codigo_os FROM ordenes)
      OR f.bridge_codigo IN (SELECT b.codigo_bridge FROM pmp.bridges b
        WHERE b.tipo_equipo=$1 AND $2 IN (b.equipo_preparado_serie,b.equipo_retirado_serie,b.equipo_instalado_serie))
    UNION ALL SELECT 'reparacion:'||r.id,r.codigo_os,r.fecha_registro,'REPARACION',r.comentario,to_jsonb(r)
      FROM pmp.registro_reparaciones r WHERE r.codigo_os IN (SELECT codigo_os FROM ordenes)
    UNION ALL SELECT 'qa:'||q.id,q.codigo_os,q.fecha,'QA_'||q.resultado,q.comentario,to_jsonb(q)
      FROM pmp.qa_inspecciones q WHERE q.codigo_os IN (SELECT codigo_os FROM ordenes)
    UNION ALL SELECT 'instalacion:'||i.id,
      CASE WHEN i.equipo_retirado_serie=$2 THEN bm.codigo_os ELSE NULL END,
      i.intervencion_en,'INSTALACION_HISTORICA',i.observacion,to_jsonb(i)
      FROM pmp.instalaciones_equipos i LEFT JOIN pmp.bridge_mantenimiento bm ON bm.bridge_codigo=i.bridge_codigo
      WHERE i.tipo_equipo=$1 AND $2 IN (i.equipo_retirado_serie,i.equipo_instalado_serie)
    UNION ALL SELECT 'escaneo:'||s.id,s.codigo_os,s.fecha,'ESCANEO_'||s.resultado,s.motivo,to_jsonb(s)
      FROM pmp.escaneos_equipos s WHERE s.tipo_equipo=$1 AND s.serie=$2
    UNION ALL SELECT 'os:'||h.id,h.codigo_os,h.fecha,h.evento,NULL,to_jsonb(h)
      FROM pmp.os_historial_activo h WHERE h.tipo_equipo=$1 AND h.serie=$2
    UNION ALL SELECT 'referencia:'||r.id,r.codigo_os,r.fecha,'REFERENCIA_VINCULADA',r.comentario,to_jsonb(r)
      FROM pmp.v_referencias_activo r WHERE r.tipo_equipo=$1 AND r.serie=$2
  ) SELECT * FROM historicos ORDER BY fecha,id`,params);
  const labels = (await pool.query(`SELECT 'estado:'||id AS clave,nombre FROM pmp.estados
    UNION ALL SELECT 'ubicacion:'||id,nombre FROM pmp.ubicaciones
    UNION ALL SELECT 'usuario:'||id,concat_ws(' ',nombre,apellido) FROM pmp.usuarios`)).rows;
  const names = Object.fromEntries(labels.map(row=>[row.clave,row.nombre]));
  const fields = {
    estado_id:['Estado','estado'],ubicacion_id:['Ubicación','ubicacion'],
    tecnico_terreno_id:['Técnico de terreno','usuario'],tecnico_laboratorio_id:['Técnico de laboratorio','usuario'],
    qa_usuario_id:['Responsable QA','usuario'],bus_ppu:['Bus',''],es_aprobado_qa:['Aprobación QA',''],falla:['Falla','']
  };
  const readable = (value,prefix) => value == null ? 'Sin registro' : typeof value==='boolean' ? (value?'Sí':'No') : names[`${prefix}:${value}`] || String(value);
  const timeline = events.rows.map(event=>{
    const detail={...event.detalle};
    if(detail.metadata?.estacion==='LABORATORIO')detail.metadata={...detail.metadata,ubicacion:names['ubicacion:'+detail.metadata.ubicacion_id]||'Laboratorio'};

    if(detail.usuario_id&&(/QA/.test(event.tipo)||event.tipo==='RECEPCION_LABORATORIO_BODEGA'||event.tipo==='SALIDA_LABORATORIO_BODEGA'))detail.metadata={...detail.metadata,usuario_nombre:names['usuario:'+detail.usuario_id]||detail.rol};
    if(detail.metadata?.qa_usuario_id)detail.metadata={...detail.metadata,tecnico:names['usuario:'+detail.metadata.qa_usuario_id]||'Certificador QA'};
    const cambios = event.tipo==='OS_ACTUALIZADA' ? Object.entries(fields).flatMap(([key,[campo,prefix]])=>
      detail.anterior?.[key]===detail.actual?.[key] ? [] : [{campo,anterior:key==='estado_id'&&detail.actual?.estado_id===2&&events.rows.some(e=>e.codigo_os===event.codigo_os&&e.tipo==='RETIRO_TERRENO_CONFIRMADO'&&Math.abs(new Date(e.fecha)-new Date(event.fecha))<1000)?'Pendiente de retiro':historyStateLabel(readable(detail.anterior?.[key],prefix)),actual:historyStateLabel(readable(detail.actual?.[key],prefix))}]) : [];
    const nearby=type=>events.rows.some(e=>e.codigo_os===event.codigo_os&&e.tipo===type&&Math.abs(new Date(e.fecha)-new Date(event.fecha))<1000);
    if(event.tipo==='OS_ACTUALIZADA'){
      for(const change of cambios){
        if(['Estado','Ubicación'].includes(change.campo)&&nearby('SALIDA_BODEGA_QA'))change.actual='En tránsito hacia QA';
        if(change.campo==='Ubicación'&&nearby('RECEPCION_QA_CONFIRMADA'))change.anterior='En tránsito hacia QA';
        if(['Estado','Ubicación'].includes(change.campo)&&nearby('SALIDA_BODEGA_LABORATORIO'))change.actual='En tránsito hacia Laboratorio';
        if(['Estado','Ubicación'].includes(change.campo)&&detail.anterior?.estado_id===2&&nearby('RECEPCION_LABORATORIO_CONFIRMADA'))change.anterior='En tránsito hacia Laboratorio';
      }
    }
    const descripcion = [detail.bridge_codigo&&`Bridge histórico: ${detail.bridge_codigo}`,
      detail.sistema_externo&&`${detail.sistema_externo}: ${detail.referencia_externa}`,
      detail.falla_detectada,detail.accion_realizada,detail.prueba_realizada,detail.resultado_prueba,
      detail.repuestos_usados,detail.certificacion,detail.estacion&&`Estación ${detail.estacion}`,
      detail.equipo_retirado_serie&&`Retirado: ${detail.equipo_retirado_serie}; instalado: ${detail.equipo_instalado_serie}`]
      .filter(Boolean).join(' · ');
    return {...event,detalle:detail,cambios,descripcion};
  });
  return { tipo_equipo:tipo,serie,...identity,ordenes:orders.rows,referencias:references.rows,eventos:presentWithdrawalTimeline(timeline) };
}
