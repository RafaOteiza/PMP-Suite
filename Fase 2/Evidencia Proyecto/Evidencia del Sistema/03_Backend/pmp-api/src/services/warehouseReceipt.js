import { labTransitSql } from './labArrival.js';
import { FlowError, withTransaction, requireText, addFlowEvent } from './bridgeFlow.js';
import { ScanError, normalizeScannedCode, resolveEquipmentScan, confirmEquipmentScanWithClient } from './equipmentScan.js';
import { recordWarehouseManualEvidence } from './warehouseEvidence.js';
import { pendingTerrainSql } from './logisticsPresentation.js';

// Input-pattern validation, not hardware attestation: a keyboard-wedge presents as a keyboard.
export function validateReceiptScanner(body){
 const code=requireText(body.codigo,'lectura del escáner',{max:64});
 const proof=body.lectura_scanner,intervals=proof?.intervalos_ms;
 if(proof?.tipo!=='KEYBOARD_WEDGE'||!Array.isArray(intervals)||code.length<4||
   intervals.length!==code.length||intervals.some(n=>!Number.isFinite(n)||n<0||n>80)||
   intervals.reduce((a,b)=>a+b,0)/intervals.length>35)
   throw new FlowError(422,'SCANNER_INPUT_REQUIRED','Usa una lectura continua del escáner terminada en Enter o Ingreso manual autorizado');
 return {tipo:'KEYBOARD_WEDGE',intervalos_ms:intervals};
}
export async function validateWarehouseReceipt(pool,body,user){
 return withTransaction(pool,async client=>{
  const order=(await client.query(`SELECT o.* FROM pmp.ordenes_servicio o WHERE o.codigo_os=$1
    AND o.estado_id IN (2,11) AND NOT ${labTransitSql()} AND NOT ${pendingTerrainSql()} FOR UPDATE OF o`,[body.codigo_os])).rows[0];
  if(!order)throw new FlowError(409,'WITHDRAWAL_REQUIRED','El técnico debe confirmar el retiro antes de recepcionar');
  const asset={tipo_equipo:order.tipo_equipo,serie:order.validador_serie||order.consola_serie};
  const withdrawal=(await client.query("SELECT id,fecha FROM pmp.flujo_eventos WHERE codigo_os=$1 AND tipo IN ('RETIRO_TERRENO_CONFIRMADO','SALIDA_LABORATORIO_BODEGA','QA_APPROVED','QA_REJECTED','SALIDA_QA_BODEGA','LAB_REPARACION_FINALIZADA') ORDER BY id DESC LIMIT 1",[order.codigo_os])).rows[0];
  const metadata={retiro_evento_id:withdrawal?.id||null};
  if(body.origen_captura==='MANUAL')return {equipo:asset,elegible:false,escaneo:null};
  if(body.origen_captura==='MANUAL_AUTORIZADO'){
   const motivo=requireText(body.motivo,'motivo de ingreso manual',{max:1000});
   const event=await recordWarehouseManualEvidence(client,{body,asset,user,context:order.estado_id===2?'RECEPCION_TERRENO':'RECEPCION_RETORNO',os:order.codigo_os,metadata:{...metadata,motivo}});
   return {equipo:asset,coincide:true,elegible:true,validacion:{id:event.id},escaneo:null};
  }
  if(body.origen_captura!=='SCANNER')throw new FlowError(422,'INVALID_CAPTURE_ORIGIN','Selecciona un origen de captura válido');
  const proof=validateReceiptScanner(body);
  let resolved=null;
  try{resolved=await resolveEquipmentScan(client,{code:body.codigo,station:'BODEGA',user});}
  catch(e){if(!(e instanceof ScanError)||e.code!=='EQUIPMENT_NOT_FOUND')throw e;}
  if(!resolved||resolved.equipo.tipo_equipo!==asset.tipo_equipo||resolved.equipo.serie!==asset.serie||resolved.orden?.codigo_os!==order.codigo_os){
   const found=resolved?.equipo||{serie:normalizeScannedCode(body.codigo),tipo_equipo:null};
   await addFlowEvent(client,{os:order.codigo_os,asset,type:'DISCREPANCIA_RECEPCION_BODEGA',user,
    comment:'Lectura no coincidente; no confirma recepción.',
    metadata:{...metadata,esperado:asset,encontrado:found,codigo_leido:body.codigo,origen_captura:'SCANNER',lectura_scanner:proof}});
   return {equipo:found,esperado:asset,coincide:false,elegible:false,escaneo:null};
  }
  const result=await confirmEquipmentScanWithClient(client,{code:body.codigo,station:'BODEGA',user,deferLocationUpdate:true,
    metadata:{...metadata,origen_captura:'SCANNER',contexto:order.estado_id===2?'RECEPCION_TERRENO':'RECEPCION_RETORNO',lectura_scanner:proof}});
  return {...result,coincide:true,elegible:true};
 });
}
export async function requireReceiptCustody(client,{order,user,scanId,manualId}){
 const withdrawal=(await client.query("SELECT id,fecha FROM pmp.flujo_eventos WHERE codigo_os=$1 AND tipo IN ('RETIRO_TERRENO_CONFIRMADO','SALIDA_LABORATORIO_BODEGA','QA_APPROVED','QA_REJECTED','SALIDA_QA_BODEGA','LAB_REPARACION_FINALIZADA') ORDER BY id DESC LIMIT 1",[order.codigo_os])).rows[0];

 const receipt=(await client.query(manualId?
   "SELECT fecha,usuario_id,metadata FROM pmp.flujo_eventos WHERE id=$1 AND codigo_os=$2 AND tipo='VALIDACION_BODEGA'":
   "SELECT fecha,usuario_id,metadata,codigo_leido FROM pmp.escaneos_equipos WHERE id=$1 AND codigo_os=$2 AND estacion='BODEGA' AND resultado='VALIDADO'",
   [manualId||scanId,order.codigo_os])).rows[0];
 if(!receipt||String(receipt.usuario_id)!==String(user.id)||receipt.metadata.contexto!==(order.estado_id===2?'RECEPCION_TERRENO':'RECEPCION_RETORNO')||
   String(receipt.metadata.retiro_evento_id??'')!==String(withdrawal?.id??'')||(withdrawal&&new Date(receipt.fecha)<new Date(withdrawal.fecha)))
   throw new FlowError(409,'RECEIPT_EVIDENCE_REQUIRED','Realiza una nueva validación física de recepción en Bodega; la validación de retiro no sirve para recibir');
 const newer=(await client.query(`SELECT 1 FROM pmp.flujo_eventos
   WHERE codigo_os=$1 AND (tipo='DISCREPANCIA_RECEPCION_BODEGA' OR (tipo='VALIDACION_BODEGA' AND metadata->>'contexto' IN ('RECEPCION_TERRENO','RECEPCION_RETORNO')))
   AND fecha>(SELECT fecha FROM pmp.${manualId?'flujo_eventos':'escaneos_equipos'} WHERE id=$2) LIMIT 1`,[order.codigo_os,manualId||scanId])).rowCount;
 if(newer)throw new FlowError(409,'STALE_PHYSICAL_CAPTURE','Existe una validación posterior. Valida nuevamente este equipo para recibirlo');
 if(manualId)requireText(receipt.metadata.motivo,'motivo de ingreso manual',{max:1000});
 else validateReceiptScanner({codigo:receipt.codigo_leido,lectura_scanner:receipt.metadata.lectura_scanner});
}
