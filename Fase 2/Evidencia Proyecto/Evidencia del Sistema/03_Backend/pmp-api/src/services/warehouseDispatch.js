import {
  FlowError, addFlowEvent, equipmentColumns, requireActiveUserRole,
  requireEquipmentType, requireEquipment, requirePositiveInteger, requireTerminalPst, requireText, withTransaction
} from './bridgeFlow.js';
import {
  canConfirmAtStation, confirmEquipmentScanWithClient, findEquipment,
  normalizeScannedCode, requireLatestPhysicalScan, requireLatestAssetScan
} from './equipmentScan.js';
import { installationReadySql, operatingAssetsSql } from './logisticsPresentation.js';
import { insertCorrelation } from './assetHistory.js';
import { validateReceiptScanner } from './warehouseReceipt.js';
import { initialAssetStockSql } from './initialAssetStock.js';
import { recordWarehouseManualEvidence, requireWarehouseManualEvidence } from './warehouseEvidence.js';

async function context(client, body) {
  const modo=body.contexto_instalacion || 'REQUERIMIENTO';
  if(!['NUEVA','REQUERIMIENTO'].includes(modo))throw new FlowError(422,'INVALID_INSTALLATION_CONTEXT','Selecciona el contexto de instalación');
  const tipo = requireEquipmentType(body.tipo_equipo);
  if(modo==='NUEVA'){
    if(body.caso_id||body.os_origen||body.referencia_externa)throw new FlowError(422,'INCOMPATIBLE_INSTALLATION_CONTEXT','Nueva instalación no admite caso ni intervención de origen');
    return {caso:null,tipo,origen:null,modo};
  }
  const id = requirePositiveInteger(body.caso_id, 'caso_id');
  const result = await client.query('SELECT * FROM pmp.casos_operacionales WHERE id=$1 FOR UPDATE', [id]);
  if (!result.rowCount) throw new FlowError(404, 'CASE_NOT_FOUND', 'El caso no existe');
  const caso = result.rows[0];
  if (tipo !== caso.tipo_equipo) throw new FlowError(422, 'CASE_TYPE_MISMATCH', 'El tipo requerido no corresponde al caso');
  const origen = requireText(body.os_origen, 'os_origen', { max: 50 });
  const related = await client.query(`SELECT codigo_os FROM pmp.ordenes_servicio
    WHERE codigo_os=$1 AND caso_id=$2 AND tipo_equipo=$3`, [origen, caso.id, tipo]);
  if (!related.rowCount) throw new FlowError(422, 'ORDER_CASE_MISMATCH', 'La intervención origen no pertenece al caso y tipo indicados');
  return { caso, tipo, origen, modo };
}

// Read-only destination context: actual bus history, or the sole configured terminal/operator pair.
export async function dispatchDestinations(client,q='') {
  const search=String(q).trim().slice(0,10).replace(/[\\%_]/g,'\\$&');
  return (await client.query(`SELECT b.ppu AS bus_ppu,ctx.terminal_id,ctx.pst_codigo,t.nombre AS terminal,p.nombre AS operador
    FROM pmp.buses b LEFT JOIN LATERAL (
      SELECT o.terminal_id,o.pst_codigo FROM pmp.ordenes_servicio o
      JOIN pmp.terminal_pst tp ON tp.terminal_id=o.terminal_id AND tp.pst_codigo=o.pst_codigo
      WHERE o.bus_ppu=b.ppu ORDER BY o.fecha DESC,o.codigo_os DESC LIMIT 1
    ) history ON true
    LEFT JOIN LATERAL (SELECT tp.terminal_id,tp.pst_codigo FROM pmp.terminal_pst tp
      WHERE (SELECT count(*) FROM pmp.terminal_pst)=1) sole ON history.terminal_id IS NULL
    CROSS JOIN LATERAL (SELECT COALESCE(history.terminal_id,sole.terminal_id) terminal_id,
      COALESCE(history.pst_codigo,sole.pst_codigo) pst_codigo) ctx
    LEFT JOIN pmp.terminales t ON t.id=ctx.terminal_id LEFT JOIN pmp.pst p ON p.codigo=ctx.pst_codigo
    WHERE b.ppu<>'STOCK' AND b.ppu ILIKE $1 ORDER BY (upper(b.ppu)=upper($2)) DESC,b.ppu LIMIT 20`,['%'+search+'%',String(q).trim()])).rows;
}

export async function requireVacantInstallation(client,tipo,bus,serie=null) {
  await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',[`INSTALLATION|${tipo}|${bus}`]);
  const occupied=await client.query(`SELECT serie FROM (${operatingAssetsSql}) op
    WHERE op.tipo=$1 AND op.bus_ppu=$2 AND ($3::text IS NULL OR op.serie<>$3) LIMIT 1`,[tipo,bus,serie]);
  if(occupied.rowCount)throw new FlowError(409,'INSTALLATION_DESTINATION_OCCUPIED','El bus ya tiene un activo de este tipo en operación. Gestiona su retiro; no se sustituye automáticamente.');
}

async function destination(client,body,ctx) {
  const tecnicoId=requireText(body.tecnico_terreno_id,'tecnico_terreno_id',{max:36});
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tecnicoId))throw new FlowError(422,'INVALID_ASSIGNEE','Selecciona un técnico válido');
  await requireActiveUserRole(client,tecnicoId,'tecnico_terreno','El técnico');
  const bus=requireText(body.bus_ppu,'bus_ppu',{max:10}).toUpperCase();
  if(bus==='STOCK')throw new FlowError(422,'INVALID_DESTINATION','Indica el bus real de destino');
  const terminal=requirePositiveInteger(body.terminal_id,'terminal_id'),pst=requireText(body.pst_codigo,'pst_codigo',{max:20});
  await requireTerminalPst(client,terminal,pst);
  if(ctx.modo==='NUEVA'){
    const known=(await dispatchDestinations(client,bus)).find(b=>b.bus_ppu===bus);
    if(!known)throw new FlowError(422,'INVALID_DESTINATION','Selecciona un bus existente');
    if(known.terminal_id&&(Number(known.terminal_id)!==terminal||known.pst_codigo!==pst))throw new FlowError(409,'INSTALLATION_CONTEXT_CHANGED','El terminal u operador no coincide con el contexto conocido del bus');
  }
  return {bus_ppu:bus,terminal_id:terminal,pst_codigo:pst,tecnico_terreno_id:tecnicoId};
}
const evidenceContext=ctx=>({caso_id:ctx.caso?String(ctx.caso.id):null,os_origen:ctx.origen,contexto_instalacion:ctx.modo});

async function readyStock(client, equipment) {
  const { table } = equipmentColumns(equipment.tipo_equipo, equipment.serie);
  await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`${equipment.tipo_equipo}|${equipment.serie}`]);
  // Serialize dispatches of the same physical asset even for different cases.
  await client.query(`SELECT serie FROM pmp.${table} WHERE serie=$1 FOR UPDATE`, [equipment.serie]);
  const initial=(await client.query(`SELECT * FROM (${initialAssetStockSql}) s WHERE s.tipo_equipo=$1 AND s.serie=$2`,[equipment.tipo_equipo,equipment.serie])).rows[0];
  if(initial)return initial;
  const result = await client.query(`SELECT o.*,COALESCE(o.validador_serie,o.consola_serie) AS serie,
      u.nombre AS ubicacion, ${installationReadySql()} AS elegible
    FROM pmp.ordenes_servicio o LEFT JOIN pmp.ubicaciones u ON u.id=o.ubicacion_id
    WHERE o.tipo_equipo=$1 AND COALESCE(o.validador_serie,o.consola_serie)=$2
    ORDER BY o.fecha DESC,o.codigo_os DESC FOR UPDATE OF o`, [equipment.tipo_equipo, equipment.serie]);
  const stock = result.rows.find(row => row.elegible);
  if (stock) return stock;
  const latest = result.rows[0];
  let reason = 'El equipo no está disponible para instalación';
  if (!latest) reason = 'El equipo no tiene una recepción inicial conforme que lo habilite en Bodega';
  else if (latest.tecnico_terreno_id && [1,7].includes(latest.estado_id)) reason = 'El equipo ya está asignado o en ruta';
  else if (latest.estado_id === 6) reason = 'El equipo está en QA';
  else if (latest.es_aprobado_qa === false) reason = 'El equipo no está aprobado por QA';
  else if (latest.estado_id === 12 || (latest.estado_id === 13 && latest.es_instalacion)) reason = 'El equipo ya está instalado';
  else if (![7,13].includes(latest.estado_id)) reason = 'El equipo pertenece a otra intervención activa o incompatible';
  else if (!latest.ubicacion_id) reason = 'El equipo está fuera de Bodega';
  throw new FlowError(409, 'EQUIPMENT_NOT_ELIGIBLE', `${reason}. Escanea otro equipo elegible.`);
}

export async function validateWarehouseDispatch(pool, body, user) {
  return withTransaction(pool, async client => {
    const ctx=await context(client,body),{caso,tipo,origen,modo}=ctx;
    const capture = requireText(body.origen_captura, 'origen_captura', { max: 24 }).toUpperCase();
    if (!['SCANNER','MANUAL','MANUAL_AUTORIZADO'].includes(capture)) throw new FlowError(422, 'INVALID_CAPTURE_ORIGIN', 'Selecciona un origen de captura válido');
    if (capture === 'SCANNER' && !canConfirmAtStation(user.rol, 'BODEGA')) {
      throw new FlowError(403, 'SCAN_STATION_FORBIDDEN', 'Tu rol no confirma escaneos físicos en Bodega');
    }
    const target=await destination(client,body,ctx);
    if(capture==='SCANNER')validateReceiptScanner(body);
    let equipment;
    if(capture==='MANUAL_AUTORIZADO'){
      if(typeof body.codigo!=='string'||body.codigo!==body.codigo.trim())throw new FlowError(422,'CAPTURE_IDENTITY_MISMATCH','Ingresa la serie exacta, sin espacios adicionales');
      await requireEquipment(client,tipo,body.codigo);
      const {table}=equipmentColumns(tipo,body.codigo);
      equipment={tipo_equipo:tipo,...(await client.query(`SELECT serie,modelo,marca FROM pmp.${table} WHERE serie=$1`,[body.codigo])).rows[0]};
    }else equipment = await findEquipment(client, normalizeScannedCode(body.codigo));
    if (equipment.tipo_equipo !== tipo) {
      throw new FlowError(409, 'EQUIPMENT_TYPE_MISMATCH',
        `Equipo no elegible. Tipo detectado: ${equipment.tipo_equipo}. Tipo requerido: ${tipo}. Escanea otro equipo.`);
    }
    const stock = await readyStock(client, equipment);
    if(modo==='NUEVA')await requireVacantInstallation(client,tipo,target.bus_ppu,equipment.serie);
    if (capture === 'MANUAL') return { equipo: equipment, stock, elegible: false, escaneo: null,
      mensaje: 'Consulta manual. Escanea físicamente el equipo para habilitar el despacho.' };
    if(capture==='MANUAL_AUTORIZADO'){
      const motivo=requireText(body.motivo,'motivo de ingreso manual',{max:1000});
      const validation=await recordWarehouseManualEvidence(client,{body,asset:equipment,user,context:'DESPACHO_TERRENO',os:stock.codigo_os,
        metadata:{...evidenceContext(ctx),destino:target,motivo,stock_evento:stock.stock_origen_evento||null}});
      return {equipo:equipment,stock,escaneo:null,validacion:{id:validation.id},elegible:true};
    }
    const confirmed = await confirmEquipmentScanWithClient(client, {
      code: body.codigo, station: 'BODEGA', user, deferLocationUpdate:true,
      assetOnly:!!stock.stock_origen_evento,
      metadata: {contexto:'DESPACHO_TERRENO', ...evidenceContext(ctx),destino:target,destino_clave:JSON.stringify(target),lectura_scanner:body.lectura_scanner,origen_captura: capture,
        ...(stock.stock_origen_evento?{contexto:'DESPACHO_INICIAL',stock_evento:String(stock.stock_origen_evento)}:{}) }
    });
    return { equipo: equipment, stock, escaneo: confirmed.escaneo, elegible: true };
  });
}

export async function confirmWarehouseDispatch(pool, body, user) {
  return withTransaction(pool, async client => {
    const ctx=await context(client,body),{caso,tipo,origen,modo}=ctx;
    const manual=body.validacion_id!=null;
    if (!manual&&!canConfirmAtStation(user.rol, 'BODEGA')) throw new FlowError(403, 'SCAN_STATION_FORBIDDEN', 'Tu rol no confirma despachos físicos en Bodega');
    const evidenceId=requirePositiveInteger(manual?body.validacion_id:body.escaneo_id,manual?'validacion_id':'escaneo_id');
    if(body.validacion_id&&body.escaneo_id)throw new FlowError(422,'AMBIGUOUS_CAPTURE','Usa una única evidencia de despacho');
    // The physical evidence is the operation key. Lock before looking for a committed retry.
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',[`DISPATCH|${manual?'MANUAL':'SCAN'}|${evidenceId}`]);
    const target=await destination(client,body,ctx);
    const fingerprint={...evidenceContext(ctx),tipo_equipo:tipo,...target};
    const previous=(await client.query(`SELECT f.usuario_id,f.metadata,o.* FROM pmp.flujo_eventos f
      JOIN pmp.ordenes_servicio o ON o.codigo_os=f.codigo_os WHERE f.tipo='SALIDA_BODEGA_TERRENO'
      AND f.metadata->>$1=$2 ORDER BY f.id LIMIT 1`,[manual?'validacion_id':'escaneo_id',String(evidenceId)])).rows[0];
    if(previous){
      // Compare normalized fields; jsonb does not preserve insertion order.
      if(String(previous.usuario_id)!==String(user.id)||!previous.metadata.solicitud||Object.keys(fingerprint).some(k=>String(previous.metadata.solicitud[k])!==String(fingerprint[k])))
        throw new FlowError(409,'DISPATCH_RETRY_CONFLICT','La evidencia ya fue utilizada con otro contexto de despacho');
      const {metadata,usuario_id,...os}=previous;return {os,caso,reutilizado:true,message:'Despacho ya confirmado'};
    }
    let scan;
    if(manual){
      if(body.escaneo_id)throw new FlowError(422,'AMBIGUOUS_CAPTURE','Usa una única evidencia de despacho');
      scan=await requireWarehouseManualEvidence(client,{id:body.validacion_id,user,context:'DESPACHO_TERRENO',metadata:evidenceContext(ctx)});
      if(scan.tipo_equipo!==tipo)throw new FlowError(409,'EQUIPMENT_TYPE_MISMATCH','La captura no corresponde al tipo solicitado');
    }else{
    const scanId = requirePositiveInteger(body.escaneo_id, 'escaneo_id');
    const scanResult = await client.query(`SELECT * FROM pmp.escaneos_equipos
      WHERE id=$1 AND resultado='VALIDADO' AND estacion='BODEGA'`, [scanId]);
    scan = scanResult.rows[0];
    if (!scan || scan.tipo_equipo !== tipo || String(scan.usuario_id) !== String(user.id)
      || scan.metadata.origen_captura !== 'SCANNER'
      || Object.entries(evidenceContext(ctx)).some(([k,v])=>String(scan.metadata[k])!==String(v))) {
      throw new FlowError(409, 'PHYSICAL_SCAN_REQUIRED', 'Escanea físicamente el equipo en BODEGA para este caso antes de continuar');
    }
    }
    if(scan.metadata.destino&&Object.keys(target).some(k=>String(scan.metadata.destino[k])!==String(target[k])))throw new FlowError(409,'DISPATCH_CONTEXT_CHANGED','El destino o técnico cambió después de validar. Repite la lectura física.');
    if(!scan.metadata.destino)throw new FlowError(409,'DISPATCH_CONTEXT_CHANGED','Falta contexto validado del despacho');
    if(!manual)validateReceiptScanner({codigo:scan.codigo_leido,lectura_scanner:scan.metadata.lectura_scanner});
    const stock = await readyStock(client, { tipo_equipo: scan.tipo_equipo, serie: scan.serie });
    if(modo==='NUEVA')await requireVacantInstallation(client,tipo,target.bus_ppu,scan.serie);
    if (stock.codigo_os !== scan.codigo_os) throw new FlowError(409, 'STALE_PHYSICAL_SCAN', 'La evidencia física ya no corresponde al stock actual');
    if(manual){
      if(String(scan.metadata.stock_evento||'')!==String(stock.stock_origen_evento||''))throw new FlowError(409,'STALE_PHYSICAL_CAPTURE','La captura corresponde a otro origen de stock');
    }else if(stock.stock_origen_evento){
      await requireLatestAssetScan(client,{asset:{tipo_equipo:tipo,serie:scan.serie},scanId:scan.id,user,context:'DESPACHO_INICIAL'});
      if(String(scan.metadata.stock_evento)!==String(stock.stock_origen_evento))throw new FlowError(409,'STALE_PHYSICAL_SCAN','La lectura no corresponde a esta recepción inicial');
    }else{
      const evidence = await requireLatestPhysicalScan(client, { codigoOs: stock.codigo_os, station: 'BODEGA' });
      if (String(evidence.escaneo_id) !== String(scan.id)) throw new FlowError(409, 'STALE_PHYSICAL_SCAN', 'Existe una lectura posterior. Vuelve a escanear el equipo para este despacho');
    }
    const {tecnico_terreno_id:tecnicoId,bus_ppu:bus,terminal_id:terminal,pst_codigo:pst}=target;
    await client.query('INSERT INTO pmp.buses(ppu) VALUES($1) ON CONFLICT DO NOTHING',[bus]);
    // Retire only legacy placeholders; completed repairs stay unchanged.
    if (stock.estado_id === 7) await client.query(`UPDATE pmp.ordenes_servicio
      SET estado_id=13,actualizado_en=now() WHERE codigo_os=$1`, [stock.codigo_os]);
    const cols = equipmentColumns(tipo, scan.serie);
    const result = await client.query(`INSERT INTO pmp.ordenes_servicio
      (tipo_equipo,validador_serie,consola_serie,es_instalacion,es_pod,falla,estado_id,
       bus_ppu,terminal_id,pst_codigo,tecnico_terreno_id,ubicacion_id,caso_id,os_origen,stock_origen_os,stock_origen_evento)
      VALUES($1,$2,$3,TRUE,FALSE,$4,1,$5,$6,$7,$8,NULL,$9,$10,$11,$12) RETURNING *`,
    [tipo,cols.validador,cols.consola,caso?.falla_reportada||'Instalación nueva',bus,terminal,pst,tecnicoId,caso?.id||null,origen,stock.codigo_os,stock.stock_origen_evento||null]);
    const os = result.rows[0];
    await addFlowEvent(client, { os: os.codigo_os, type: 'SALIDA_BODEGA_TERRENO', user,
      comment:`Origen de captura: ${manual?'MANUAL_AUTORIZADO':'SCANNER'}.`,
      metadata: { ...(manual?{validacion_id:scan.id}:{escaneo_id:scan.id}),origen_captura:manual?'MANUAL_AUTORIZADO':'SCANNER', stock_os: stock.codigo_os, stock_evento:stock.stock_origen_evento||null, caso_id: caso?.id||null, os_origen: origen,contexto_instalacion:modo,solicitud:fingerprint,
        tipo_equipo: tipo, serie: scan.serie, bus_ppu: bus, terminal_id: terminal, tecnico_terreno_id: tecnicoId } });
    if (caso?.origen === 'ARANDA') await insertCorrelation(client, {
      tipo_equipo: tipo, serie: scan.serie, codigo_os: os.codigo_os,
      sistema_externo: 'ARANDA', referencia_externa: caso.referencia_externa
    }, user);
    return { os, caso, message: 'Asignación y despacho físico confirmados' };
  });
}
