import { FlowError, addFlowEvent, requireText, requirePositiveInteger, withTransaction } from './bridgeFlow.js';
import { findEquipment, normalizeScannedCode, ScanError } from './equipmentScan.js';
import { validateReceiptScanner } from './warehouseReceipt.js';
import { labAvailableSql, labTransitSql, labCycleSql } from './labArrival.js';

const operations = Object.freeze({
 RECEPCION: {event:'RECEPCION_LABORATORIO_CONFIRMADA', origin:'Bodega', destination:'Laboratorio Garantías', state:4},
 SALIDA: {event:'SALIDA_LABORATORIO_BODEGA', origin:'Laboratorio Garantías', destination:'Bodega', state:11}
});
const fail = (code,message,status=409) => { throw new FlowError(status,code,message); };
function operation(purpose,user) {
 if(user.rol!=='jefe_laboratorio') fail('LAB_CUSTODY_FORBIDDEN','La custodia de Laboratorio corresponde a su jefatura',403);
 if(!operations[purpose]) fail('INVALID_CUSTODY_PURPOSE','Operación de Laboratorio no válida',422);
 return operations[purpose];
}
async function order(c,code) {
 const row=(await c.query(`SELECT o.*,COALESCE(o.validador_serie,o.consola_serie) AS serie,
   ${labCycleSql()} AS ciclo,${labAvailableSql()} AS disponible,${labTransitSql()} AS en_transito
   FROM pmp.ordenes_servicio o WHERE o.codigo_os=$1 FOR UPDATE OF o`,[requireText(code,'OS',{max:50})])).rows[0];
 if(!row) fail('ORDER_NOT_FOUND','La OS no existe',404);
 return row;
}
function eligible(row,purpose) {
 if(purpose==='RECEPCION'?!row.en_transito:!(row.disponible&&row.estado_id===10))
  fail('LAB_CUSTODY_NOT_ELIGIBLE',purpose==='RECEPCION'?'El equipo no espera recepción en Laboratorio':'El equipo no está físicamente en Laboratorio con trabajo finalizado');
}
const asset=row=>({tipo_equipo:row.tipo_equipo,serie:row.serie});
const revision=row=>new Date(row.actualizado_en).toISOString();
function capture(body,expected,user) {
 if(body.origen_captura==='SCANNER') return {origen_captura:'SCANNER',lectura_scanner:validateReceiptScanner(body)};
 if(body.origen_captura!=='MANUAL_AUTORIZADO') fail('PHYSICAL_CAPTURE_REQUIRED','Usa el escáner o Ingreso manual autorizado',422);
 if(body.tipo_equipo!==expected.tipo_equipo||body.codigo!==expected.serie) fail('CAPTURE_IDENTITY_MISMATCH','Ingresa la serie exacta del equipo esperado',422);
 if(body.presencia_fisica_confirmada!==true) fail('PHYSICAL_PRESENCE_REQUIRED','Confirma la presencia física del equipo en Laboratorio',422);
 return {origen_captura:'MANUAL_AUTORIZADO',presencia_fisica_confirmada:true,motivo:requireText(body.motivo,'motivo de ingreso manual',{max:1000})};
}

export async function validateLabCustody(pool,code,purpose,body,user) {
 const op=operation(purpose,user);
 return withTransaction(pool,async c=>{
  const row=await order(c,code);eligible(row,purpose);
  const expected=asset(row),proof=capture(body,expected,user);
  let found=expected;
  if(proof.origen_captura==='SCANNER') {
   try {found=await findEquipment(c,normalizeScannedCode(body.codigo));}
   catch(e){if(!(e instanceof ScanError)||e.code!=='EQUIPMENT_NOT_FOUND')throw e;found={serie:normalizeScannedCode(body.codigo),tipo_equipo:null};}
  }
  const matches=body.tipo_equipo===expected.tipo_equipo&&found.tipo_equipo===expected.tipo_equipo&&found.serie===expected.serie;
  const evidence=await addFlowEvent(c,{os:code,asset:expected,user,
   type:matches?'VALIDACION_CUSTODIA_LABORATORIO':'DISCREPANCIA_CUSTODIA_LABORATORIO',
   comment:matches?'Identidad validada. Pendiente de confirmar el movimiento.':'Equipo distinto al esperado; no se confirma movimiento.',
   metadata:{version:1,proposito:purpose,ciclo:row.ciclo,version_os:revision(row),origen:op.origin,destino:op.destination,
    codigo_leido:body.codigo,esperado:expected,encontrado:found,coincide:matches,...proof}});
  return {equipo:found,esperado:expected,coincide:matches,elegible:matches,validacion:matches?{id:evidence.id}:null};
 });
}

export async function confirmLabCustody(pool,code,purpose,body,user) {
 const op=operation(purpose,user),id=requirePositiveInteger(body.validacion_id,'validacion_id');
 return withTransaction(pool,async c=>{
  const row=await order(c,code);
  // Serialize on the order before testing an equivalent committed retry.
  const prior=(await c.query(`SELECT * FROM pmp.flujo_eventos WHERE tipo IN ('RECEPCION_LABORATORIO_CONFIRMADA','SALIDA_LABORATORIO_BODEGA') AND metadata->>'validacion_id'=$1 ORDER BY id LIMIT 1`,[String(id)])).rows[0];
  if(prior){
   if(prior.codigo_os!==code||prior.tipo!==op.event||String(prior.usuario_id)!==String(user.id)) fail('CUSTODY_RETRY_CONFLICT','La evidencia ya fue utilizada en otra operación');
   if(String(prior.metadata.ciclo)!==String(row.ciclo)) fail('CUSTODY_EVIDENCE_REQUIRED','La confirmación pertenece a un ciclo anterior. Valida nuevamente el equipo.');
   return {success:true,duplicado:true,evento:prior.id,estado_id:prior.metadata.estado_nuevo_id};
  }
  eligible(row,purpose);
  const ev=(await c.query(`SELECT * FROM pmp.flujo_eventos WHERE id=$1 AND codigo_os=$2 AND tipo='VALIDACION_CUSTODIA_LABORATORIO'`,[id,code])).rows[0];
  const m=ev?.metadata;
  if(!ev||String(ev.usuario_id)!==String(user.id)||ev.rol!==user.rol||ev.tipo_equipo!==row.tipo_equipo||ev.serie!==row.serie||
   m.proposito!==purpose||String(m.ciclo)!==String(row.ciclo)||m.version_os!==revision(row)||m.coincide!==true||m.origen!==op.origin||m.destino!==op.destination)
   fail('CUSTODY_EVIDENCE_REQUIRED','Realiza una nueva validación física para esta operación y ciclo');
  if((await c.query(`SELECT 1 FROM pmp.flujo_eventos WHERE codigo_os=$1 AND id>$2 AND tipo IN ('VALIDACION_CUSTODIA_LABORATORIO','DISCREPANCIA_CUSTODIA_LABORATORIO') LIMIT 1`,[code,id])).rowCount)
   fail('STALE_PHYSICAL_CAPTURE','Existe una lectura posterior. Valida nuevamente el equipo');
  capture({...m,codigo:m.codigo_leido,tipo_equipo:row.tipo_equipo},asset(row),user);
  let scan=null,location=null;
  if(purpose==='RECEPCION') {
   location=(await c.query("SELECT id,nombre FROM pmp.ubicaciones WHERE tipo='LABORATORIO' ORDER BY id LIMIT 1")).rows[0];
   if(!location) fail('LOCATION_REQUIRED','No existe ubicación de Laboratorio');
   scan=(await c.query(`INSERT INTO pmp.escaneos_equipos (codigo_leido,tipo_codigo,estacion,tipo_equipo,serie,codigo_os,ubicacion_id,usuario_id,rol,resultado,metadata)
    VALUES($1,'SERIE','LABORATORIO',$2,$3,$4,$5,$6,$7,'VALIDADO',$8) RETURNING id,fecha`,
    [m.codigo_leido,row.tipo_equipo,row.serie,code,location.id,user.id,user.rol,JSON.stringify({...m,contexto:'RECEPCION_LABORATORIO',validacion_id:id})])).rows[0];
  }
  await c.query('UPDATE pmp.ordenes_servicio SET estado_id=$2,ubicacion_id=$3,actualizado_en=now() WHERE codigo_os=$1',[code,op.state,location?.id||null]);
  const event=await addFlowEvent(c,{os:code,asset:asset(row),user,type:op.event,
   comment:purpose==='RECEPCION'?'Recepción física en Laboratorio confirmada.':'Salida de Laboratorio confirmada. En tránsito hacia Bodega.',
   metadata:{...m,validacion_id:id,escaneo_id:scan?.id||null,fecha_recepcion:scan?.fecha||null,ubicacion:location?.nombre||'En tránsito hacia Bodega',
    estado_anterior_id:row.estado_id,estado_nuevo_id:op.state,metodo_validacion:m.origen_captura}});
  return {success:true,duplicado:false,evento:event.id,estado_id:op.state};
 });
}
