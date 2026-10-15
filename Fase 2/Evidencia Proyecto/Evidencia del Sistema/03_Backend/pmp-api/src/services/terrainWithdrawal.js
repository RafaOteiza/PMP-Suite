import { FlowError, requireText, optionalText, requireActiveUserRole, withTransaction, addFlowEvent } from './bridgeFlow.js';
import { findEquipment, normalizeScannedCode, ScanError } from './equipmentScan.js';
import { listPendingWithdrawals } from './terrainWithdrawalRead.js';
import { withdrawalEvidence, MANUAL_REASONS } from './terrainWithdrawalEvidence.js';
import { pendingTerrainSql } from './logisticsPresentation.js';

async function pending(client,code) {
  const result=await client.query(`SELECT o.*,${pendingTerrainSql()} AS retiro_pendiente FROM pmp.ordenes_servicio o
    WHERE o.codigo_os=$1 FOR UPDATE OF o`,[requireText(code,'codigo_os',{max:50})]);
  const order=result.rows[0];
  if(order&&(await client.query("SELECT 1 FROM pmp.flujo_eventos WHERE codigo_os=$1 AND tipo='RETIRO_TERRENO_CONFIRMADO'",[order.codigo_os])).rowCount)
    throw new FlowError(409,'WITHDRAWAL_ALREADY_CONFIRMED','El retiro ya fue confirmado');
  if(!order?.retiro_pendiente)throw new FlowError(409,'WITHDRAWAL_NOT_PENDING','La OS no tiene un retiro pendiente');
  return order;
}
function requireAssigned(order,user){
  if(user.rol!=='tecnico_terreno'||String(order.tecnico_terreno_id)!==String(user.id))
    throw new FlowError(403,'WITHDRAWAL_NOT_ASSIGNED','Solo el técnico asignado puede confirmar este retiro');
}
const identity=order=>({tipo_equipo:order.tipo_equipo,serie:order.validador_serie||order.consola_serie});
async function context(client,order,user){
  const row=(await listPendingWithdrawals(client,{code:order.codigo_os,technicianId:user.id}))[0];
  if(!row)throw new FlowError(409,'WITHDRAWAL_CONTEXT_CHANGED','Actualiza la OS y verifica su instalación vigente');
  return {...row,origen:'BUS',destino:'BODEGA',estado_anterior:'PENDIENTE_RETIRO'};
}
export async function validateTerrainIdentity(pool,body,user){
  return withTransaction(pool,async client=>{
    const order=await pending(client,body.codigo_os);requireAssigned(order,user);
    const expected=identity(order),method=body.metodo_validacion;
    if(!['SCAN','MANUAL'].includes(method))throw new FlowError(422,'INVALID_WITHDRAWAL_METHOD','Usa escaneo con cámara o contingencia manual');
    requireText(body.codigo_leido,'código leído',{max:64});
    let found=null,reason=null,note=null;
    if(method==='MANUAL'){
      if(!MANUAL_REASONS.includes(body.motivo_manual))throw new FlowError(422,'MANUAL_REASON_REQUIRED','Selecciona por qué no puedes escanear');
      reason=body.motivo_manual;note=requireText(body.observacion_manual,'observación de contingencia',{max:1000});
      found={tipo_equipo:expected.tipo_equipo,serie:body.codigo_leido};
    }else{
      try{found=await findEquipment(client,normalizeScannedCode(body.codigo_leido));}
      catch(e){if(!(e instanceof ScanError))throw e;if(e.code!=='EQUIPMENT_NOT_FOUND')throw new FlowError(e.status,e.code,e.message);}
    }
    const matches=found?.tipo_equipo===expected.tipo_equipo&&found?.serie===expected.serie;
    const metadata={...await context(client,order,user),esperado:expected,encontrado:found,coincide:matches,
      metodo_validacion:method,codigo_leido:body.codigo_leido,motivo_manual:reason,observacion_manual:note};
    // The OS row is locked above: identical current reads share the same evidence token.
    const previous=(await client.query(`SELECT id,metadata FROM pmp.flujo_eventos
      WHERE codigo_os=$1 AND usuario_id=$2 AND tipo='VALIDACION_IDENTIDAD_RETIRO'
      AND fecha>now()-interval '30 minutes' ORDER BY id DESC LIMIT 1`,[order.codigo_os,user.id])).rows[0];
    const same=matches&&previous?.metadata.coincide===true&&
      ['metodo_validacion','codigo_leido','motivo_manual','observacion_manual','bus_ppu'].every(key=>previous.metadata[key]===metadata[key])&&
      previous.metadata.esperado?.tipo_equipo===expected.tipo_equipo&&previous.metadata.esperado?.serie===expected.serie;
    const event=same?previous:await addFlowEvent(client,{os:order.codigo_os,type:'VALIDACION_IDENTIDAD_RETIRO',user,asset:expected,metadata});
    return {validacion_id:event.id,coincide:matches,esperado:expected,encontrado:found,metodo_validacion:method,codigo_leido:body.codigo_leido};
  });
}
async function validation(client,body,order,user){
  const id=requireText(String(body.validacion_id??''),'validación de identidad',{max:30});
  const row=(await client.query(`SELECT * FROM pmp.flujo_eventos WHERE id::text=$1 AND codigo_os=$2
    AND usuario_id=$3 AND tipo='VALIDACION_IDENTIDAD_RETIRO' AND fecha>now()-interval '30 minutes'`,[id,order.codigo_os,user.id])).rows[0];
  const expected=identity(order);
  if(!row||row.tipo_equipo!==expected.tipo_equipo||row.serie!==expected.serie||row.metadata.bus_ppu!==order.bus_ppu)
    throw new FlowError(409,'STALE_WITHDRAWAL_VALIDATION','Vuelve a validar la identidad física de este activo');
  const newer=await client.query(`SELECT 1 FROM pmp.flujo_eventos WHERE codigo_os=$1 AND usuario_id=$2
    AND tipo='VALIDACION_IDENTIDAD_RETIRO' AND id>$3`,[order.codigo_os,user.id,row.id]);
  if(newer.rowCount)throw new FlowError(409,'STALE_WITHDRAWAL_VALIDATION','Existe una lectura posterior. Vuelve a validar el activo');
  return row;
}
export async function registerWithdrawalDiscrepancy(pool,body,user){
  return withTransaction(pool,async client=>{
    const order=await pending(client,body.codigo_os);requireAssigned(order,user);
    const checked=await validation(client,body,order,user);
    if(checked.metadata.coincide)throw new FlowError(422,'NO_IDENTITY_DISCREPANCY','La identidad validada coincide con el equipo esperado');
    const note=requireText(body.observacion,'observación de discrepancia',{max:4000});
    const previous=(await client.query(`SELECT id FROM pmp.flujo_eventos WHERE codigo_os=$1
      AND tipo='DISCREPANCIA_RETIRO_TERRENO' AND metadata->>'validacion_id'=$2`,[order.codigo_os,String(checked.id)])).rows[0];
    if(previous)return {id:previous.id,registrada:true};
    const event=await addFlowEvent(client,{os:order.codigo_os,type:'DISCREPANCIA_RETIRO_TERRENO',user,asset:identity(order),comment:note,
      metadata:{...checked.metadata,validacion_id:checked.id,tipo_discrepancia:checked.metadata.encontrado?'ACTIVO_DISTINTO':'IDENTIFICADOR_NO_RESUELTO'}});
    return {id:event.id,registrada:true};
  });
}
export async function assignTerrainWithdrawal(pool,body,user) {
  if(!['logistica'].includes(user.rol))throw new FlowError(403,'FORBIDDEN','Tu rol no asigna retiros');
  return withTransaction(pool,async client=>{
    const order=await pending(client,body.codigo_os);
    const id=requireText(body.tecnico_terreno_id,'tecnico_terreno_id',{max:36});
    if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))throw new FlowError(422,'INVALID_ASSIGNEE','Selecciona un técnico de terreno');
    await requireActiveUserRole(client,id,'tecnico_terreno','El técnico');
    const result=await client.query(`UPDATE pmp.ordenes_servicio SET tecnico_terreno_id=$2,estado_id=1,actualizado_en=now()
      WHERE codigo_os=$1 RETURNING *`,[order.codigo_os,id]);
    await addFlowEvent(client,{os:order.codigo_os,type:'RETIRO_ASIGNADO',user,metadata:{tecnico_terreno_id:id,bus_ppu:order.bus_ppu}});
    return result.rows[0];
  });
}
export function validateWithdrawal(body,order,user) {
  if(user.rol!=='tecnico_terreno'||String(order.tecnico_terreno_id)!==String(user.id))
    throw new FlowError(403,'WITHDRAWAL_NOT_ASSIGNED','Solo el técnico asignado puede confirmar este retiro');
  if(body.tipo_equipo!==order.tipo_equipo||body.serie!==(order.validador_serie||order.consola_serie)||body.bus_ppu!==order.bus_ppu)
    throw new FlowError(422,'WITHDRAWAL_IDENTITY_MISMATCH','El tipo, serie y bus deben coincidir exactamente con la OS asignada');
  if(body.retiro_confirmado!==true)throw new FlowError(422,'WITHDRAWAL_CONFIRMATION_REQUIRED','Confirma el retiro físico del equipo desde el bus');
  return (body.pod===true?requireText:optionalText)(body.evidencia,'evidencia',{max:4000});
}
export async function confirmTerrainWithdrawal(pool,body,user) {
  return withTransaction(pool,async client=>{
    const order=await pending(client,body.codigo_os);
    validateWithdrawal(body,order,user);
    const checked=await validation(client,body,order,user);
    if(checked.metadata.coincide!==true)throw new FlowError(422,'WITHDRAWAL_IDENTITY_MISMATCH','Equipo distinto al esperado. Registra la discrepancia; no se puede confirmar el retiro');
    const evidence=await withdrawalEvidence(body);
    const discrepancies=(await client.query(`SELECT id FROM pmp.flujo_eventos WHERE codigo_os=$1 AND tipo='DISCREPANCIA_RETIRO_TERRENO' ORDER BY id`,[order.codigo_os])).rows.map(e=>e.id);
    const metadata={...await context(client,order,user),...evidence,validacion_id:checked.id,
      metodo_validacion:checked.metadata.metodo_validacion,codigo_leido:checked.metadata.codigo_leido,
      esperado:checked.metadata.esperado,encontrado:checked.metadata.encontrado,coincide:checked.metadata.coincide,
      motivo_manual:checked.metadata.motivo_manual,observacion_manual:checked.metadata.observacion_manual,
      discrepancias:discrepancies,retiro_confirmado:true,estado_nuevo:'EN_TRANSITO',tecnico_id:user.id};
    const result=await client.query(`UPDATE pmp.ordenes_servicio SET estado_id=2,ubicacion_id=NULL,actualizado_en=now()
      WHERE codigo_os=$1 RETURNING *`,[order.codigo_os]);
    const event=await addFlowEvent(client,{os:order.codigo_os,type:'RETIRO_TERRENO_CONFIRMADO',user,asset:identity(order),comment:evidence.observacion,metadata});
    if(evidence.pod)await addFlowEvent(client,{os:order.codigo_os,type:'POD_DETECTADO_TERRENO',user,asset:identity(order),comment:evidence.observacion,
      metadata:{evento_retiro_id:event.id,categoria_pod:evidence.categoria_pod,caso_id:metadata.caso_id,serie:metadata.serie,bus_ppu:metadata.bus_ppu}});
    return {...result.rows[0],evento_retiro_id:event.id};
  });
}
