import {warehouseQaReadySql} from './warehouseQueue.js';
import { FlowError, withTransaction, requireText, requirePositiveInteger, addFlowEvent } from './bridgeFlow.js';
import { resolveEquipmentScan, ScanError, normalizeScannedCode } from './equipmentScan.js';
import { validateReceiptScanner } from './warehouseReceipt.js';
import { validateWarehouseManualInput } from './warehouseEvidence.js';

async function loadOrder(client,code,target){
 const order=(await client.query(`SELECT o.*,EXISTS(SELECT 1 FROM pmp.registro_reparaciones r WHERE r.codigo_os=o.codigo_os) AS reparado,${warehouseQaReadySql()} AS qa_dispatch_ready FROM pmp.ordenes_servicio o JOIN pmp.ubicaciones u ON u.id=o.ubicacion_id
  WHERE o.codigo_os=$1 AND o.estado_id=3 AND u.tipo='BODEGA' FOR UPDATE OF o`,[requireText(code,'OS')])).rows[0];
 if(!order)throw new FlowError(409,'LAB_DISPATCH_NOT_READY','La OS debe estar en Bodega para preparar esta salida');
 if(target==='QA' && !order.qa_dispatch_ready)
  throw new FlowError(409,'QA_DISPATCH_NOT_READY','El equipo debe estar reparado y recibido en Bodega, pendiente de QA');
 if(target==='LAB'&&order.reparado&&order.es_aprobado_qa!==false)throw new FlowError(409,'QA_REQUIRED','El equipo reparado debe continuar a QA; solo un rechazo confirmado inicia un nuevo ciclo de Laboratorio');
 return order;
}
const assetOf=o=>({tipo_equipo:o.tipo_equipo,serie:o.validador_serie||o.consola_serie});
const fail=(cfg)=>{throw new FlowError(409,`${cfg.code}_EXIT_EVIDENCE_REQUIRED`,`Realiza una nueva validación física de salida Bodega → ${cfg.name}`);};
const config=target=>target==='QA'?{code:'QA',name:'QA',event:'SALIDA_BODEGA_QA'}:{code:'LAB',name:'Laboratorio',event:'SALIDA_BODEGA_LABORATORIO'};
function rejectAssignment(body){if(['qa_usuario_id','responsable_qa','qa_asignado_por','qa_asignado_en'].some(k=>Object.hasOwn(body,k)))throw new FlowError(422,'QA_ASSIGNMENT_SEPARATE','El despacho no asigna certificador. QA toma su propio trabajo después de la recepción física');}
export async function validateLabDispatch(pool,body,user,target='LAB'){
 const cfg=config(target);if(!['logistica'].includes(user.rol))throw new FlowError(403,'FORBIDDEN','Tu rol no autoriza salidas de Bodega');if(target==='QA')rejectAssignment(body);
 return withTransaction(pool,async client=>{
  const order=await loadOrder(client,body.codigo_os,target),asset=assetOf(order);
  let found=asset,proof;
  if(body.origen_captura==='MANUAL_AUTORIZADO'){
   validateWarehouseManualInput(body,asset,user);requireText(body.motivo,'motivo',{max:1000});
  }else if(body.origen_captura==='SCANNER'){
   proof=validateReceiptScanner(body);
   try{found=(await resolveEquipmentScan(client,{code:body.codigo,station:'BODEGA',user})).equipo;}
   catch(e){if(!(e instanceof ScanError)||e.code!=='EQUIPMENT_NOT_FOUND')throw e;found={serie:normalizeScannedCode(body.codigo)};}
  }else throw new FlowError(422,'INVALID_CAPTURE_ORIGIN','Selecciona Escáner físico o Ingreso manual autorizado');
  const matches=body.tipo_equipo===asset.tipo_equipo&&found.tipo_equipo===asset.tipo_equipo&&found.serie===asset.serie;
  const event=await addFlowEvent(client,{os:order.codigo_os,asset,user,
   type:matches?`VALIDACION_SALIDA_${cfg.code}`:`DISCREPANCIA_SALIDA_${cfg.code}`,
   comment:matches?`Identidad validada para salida a ${cfg.name}; envío aún no confirmado.`:'Equipo distinto al esperado; envío bloqueado.',
   metadata:{contexto:cfg.event,metodo_validacion:body.origen_captura,codigo_leido:body.codigo,
    esperado:asset,encontrado:found,coincide:matches,presencia_fisica_confirmada:body.presencia_fisica_confirmada===true,
    motivo:body.motivo||null,lectura_scanner:proof,version_os:order.actualizado_en}});
  return {equipo:found,coincide:matches,elegible:matches,validacion:matches?{id:event.id}:undefined};
 });
}
export async function confirmLabDispatch(pool,body,user,target='LAB'){
 const cfg=config(target);if(!['logistica'].includes(user.rol))throw new FlowError(403,'FORBIDDEN','Tu rol no autoriza salidas de Bodega');if(target==='QA')rejectAssignment(body);
 return withTransaction(pool,async client=>{
  if(!body.validacion_id)fail(cfg);
  const id=requirePositiveInteger(body.validacion_id,'validacion_id');
  await client.query('SELECT codigo_os FROM pmp.ordenes_servicio WHERE codigo_os=$1 FOR UPDATE',[body.codigo_os]);
  const previous=(await client.query("SELECT * FROM pmp.flujo_eventos WHERE tipo IN ('SALIDA_BODEGA_LABORATORIO','SALIDA_BODEGA_QA') AND metadata->>'validacion_id'=$1 ORDER BY id LIMIT 1",[String(id)])).rows[0];
  if(previous){
   if(previous.codigo_os!==body.codigo_os||previous.tipo!==cfg.event||String(previous.usuario_id)!==String(user.id))throw new FlowError(409,'CUSTODY_RETRY_CONFLICT','La evidencia fue consumida en otra operación');
   return {success:true,duplicado:true,message:'Envío ya confirmado'};
  }
  const order=await loadOrder(client,body.codigo_os,target),asset=assetOf(order);
  const evidence=(await client.query(`SELECT * FROM pmp.flujo_eventos WHERE id=$1 AND codigo_os=$2
   AND tipo='VALIDACION_SALIDA_${cfg.code}' AND fecha>NOW()-INTERVAL '15 minutes'`,[requirePositiveInteger(body.validacion_id,'validacion_id'),order.codigo_os])).rows[0];
  const m=evidence?.metadata;
  if(!m||String(evidence.usuario_id)!==String(user.id)||evidence.tipo_equipo!==asset.tipo_equipo||evidence.serie!==asset.serie||
   m.contexto!==cfg.event||m.coincide!==true||
   new Date(m.version_os).getTime()!==new Date(order.actualizado_en).getTime())fail(cfg);
  const newer=(await client.query(`SELECT 1 FROM pmp.flujo_eventos WHERE codigo_os=$1 AND id>$2
    AND tipo IN ('VALIDACION_SALIDA_${cfg.code}','DISCREPANCIA_SALIDA_${cfg.code}','${cfg.event}') LIMIT 1`,[order.codigo_os,evidence.id])).rowCount;
  if(newer)fail(cfg);
  if(m.metodo_validacion==='SCANNER')validateReceiptScanner({codigo:m.codigo_leido,lectura_scanner:m.lectura_scanner});
  else if(m.metodo_validacion==='MANUAL_AUTORIZADO'){
   validateWarehouseManualInput({tipo_equipo:asset.tipo_equipo,codigo:m.codigo_leido,presencia_fisica_confirmada:m.presencia_fisica_confirmada},asset,user);
   requireText(m.motivo,'motivo',{max:1000});
  }else fail(cfg);
  if(target==='QA')await client.query('UPDATE pmp.ordenes_servicio SET estado_id=6,ubicacion_id=NULL,qa_usuario_id=NULL,qa_asignado_por=NULL,qa_asignado_en=NULL,actualizado_en=NOW() WHERE codigo_os=$1',[order.codigo_os]);
  else await client.query('UPDATE pmp.ordenes_servicio SET estado_id=2,ubicacion_id=NULL,es_aprobado_qa=NULL,tecnico_laboratorio_id=NULL,actualizado_en=NOW() WHERE codigo_os=$1',[order.codigo_os]);
  const actor=(await client.query('SELECT nombre,apellido FROM pmp.usuarios WHERE id=$1',[user.id])).rows[0];
  await addFlowEvent(client,{os:order.codigo_os,asset,user,type:cfg.event,
   comment:`Envío a ${cfg.name} confirmado. Bodega → ${cfg.name} · En tránsito.`,
   metadata:{...m,...asset,usuario_nombre:[actor?.nombre,actor?.apellido].filter(Boolean).join(' '),validacion_id:evidence.id,origen:'Bodega',destino:cfg.name,estado_anterior:'En Bodega',estado_nuevo:`En tránsito hacia ${cfg.name}`,falla:order.falla}});
  return {success:true,message:`Equipo despachado a ${cfg.name}`};
 });
}
