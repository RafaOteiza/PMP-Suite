import { FlowError, requirePositiveInteger, addFlowEvent } from './bridgeFlow.js';

export function validateWarehouseManualInput(body,asset,user) {
  if(!['logistica'].includes(user.rol))throw new FlowError(403,'MANUAL_CAPTURE_FORBIDDEN','Solo logística puede autorizar esta captura');
  if(body.tipo_equipo!==asset.tipo_equipo||body.codigo!==asset.serie)
    throw new FlowError(422,'CAPTURE_IDENTITY_MISMATCH','Ingresa la serie exacta del tipo de equipo de esta operación, sin espacios adicionales');
  if(body.presencia_fisica_confirmada!==true)
    throw new FlowError(422,'PHYSICAL_PRESENCE_REQUIRED','Confirma que tienes físicamente este equipo en Bodega y verificaste su identidad');
}
export async function recordWarehouseManualEvidence(client,{body,asset,user,context,os=null,metadata={}}) {
  validateWarehouseManualInput(body,asset,user);
  if(!['RECEPCION_TERRENO','RECEPCION_RETORNO','DESPACHO_TERRENO'].includes(context))throw new Error('Invalid warehouse context');
  const location=(await client.query("SELECT id FROM pmp.ubicaciones WHERE tipo='BODEGA' ORDER BY id LIMIT 1")).rows[0];
  if(!location)throw new FlowError(409,'LOCATION_REQUIRED','No existe una ubicación BODEGA');
  return addFlowEvent(client,{asset,os,type:'VALIDACION_BODEGA',user,
    comment:`${context}: ingreso manual autorizado (MANUAL_AUTORIZADO), presencia física e identidad confirmadas.`,
    metadata:{...metadata,contexto:context,origen_captura:'MANUAL_AUTORIZADO',codigo_leido:asset.serie,
      presencia_fisica_confirmada:true,ubicacion_id:location.id}});
}
export async function requireWarehouseManualEvidence(client,{id,user,context,asset=null,os,metadata={}}) {
  if(!['logistica'].includes(user.rol))throw new FlowError(403,'MANUAL_CAPTURE_FORBIDDEN','Tu rol no autoriza esta captura');
  const record=(await client.query(`SELECT f.*,u.id AS ubicacion_id FROM pmp.flujo_eventos f
    JOIN pmp.ubicaciones u ON u.id::text=f.metadata->>'ubicacion_id' AND u.tipo='BODEGA'
    WHERE f.id=$1 AND f.tipo='VALIDACION_BODEGA'`,[requirePositiveInteger(id,'validacion_id')])).rows[0];
  if(!record||String(record.usuario_id)!==String(user.id)||!['admin','logistica'].includes(record.rol)
    ||record.metadata.origen_captura!=='MANUAL_AUTORIZADO'||record.metadata.contexto!==context
    ||record.metadata.presencia_fisica_confirmada!==true||record.metadata.codigo_leido!==record.serie
    ||(asset&&(record.tipo_equipo!==asset.tipo_equipo||record.serie!==asset.serie))
    ||(os!==undefined&&record.codigo_os!==os)
    ||Object.entries(metadata).some(([key,value])=>String(record.metadata[key])!==String(value)))
    throw new FlowError(409,'MANUAL_CAPTURE_REQUIRED','Valida nuevamente la serie y presencia física para esta operación');
  const newer=await client.query(`SELECT 1 FROM pmp.flujo_eventos WHERE tipo_equipo=$1 AND serie=$2
    AND tipo='VALIDACION_BODEGA' AND (fecha,id)>(SELECT fecha,id FROM pmp.flujo_eventos WHERE id=$3)
    UNION ALL SELECT 1 FROM pmp.escaneos_equipos WHERE tipo_equipo=$1 AND serie=$2 AND resultado='VALIDADO'
      AND fecha>(SELECT fecha FROM pmp.flujo_eventos WHERE id=$3)`,
    [record.tipo_equipo,record.serie,record.id]);
  if(newer.rowCount)throw new FlowError(409,'STALE_PHYSICAL_CAPTURE','Existe evidencia posterior. Valida nuevamente el equipo');
  return record;
}
