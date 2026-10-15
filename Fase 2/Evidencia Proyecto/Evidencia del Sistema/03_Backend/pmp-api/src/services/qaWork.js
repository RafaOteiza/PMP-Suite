import {createHash} from 'node:crypto';
import {FlowError,withTransaction,requireText,optionalText,addFlowEvent} from './bridgeFlow.js';
import {qaCycleSql,qaReceiptSql,qaReceivedSql,qaStageSql,qaStateSql,qaSnapshotSql} from './qaCustody.js';
import {findEquipment,ScanError,normalizeScannedCode} from './equipmentScan.js';
import {validateReceiptScanner} from './warehouseReceipt.js';

const fail=(message,code='QA_CONFLICT',status=409)=>{throw new FlowError(status,code,message);};
const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
const digest=v=>createHash('sha256').update(JSON.stringify(canonical(v))).digest('hex');
const identity=o=>({tipo_equipo:o.tipo_equipo,serie:o.validador_serie||o.consola_serie});
const initial=()=>({etapa:'AMBIENTE',responsable:null,ambiente:{estado:'PENDIENTE',observacion:'',inicio:null,fin:null},pruebas:[],dictamen:null});
const emit=(c,o,u,type,metadata,comment=null)=>addFlowEvent(c,{os:o.codigo_os,asset:identity(o),type,user:u,comment,metadata:{version:3,ciclo_qa:o.ciclo_qa,...metadata}});
async function order(c,code,lock=false){
 if(lock)await c.query('SELECT codigo_os FROM pmp.ordenes_servicio WHERE codigo_os=$1 FOR UPDATE',[requireText(code,'OS')]);
 const o=(await c.query(`SELECT o.*,COALESCE(${qaCycleSql()}::text,'legacy') ciclo_qa,${qaReceiptSql()} fecha_recepcion_qa,${qaReceivedSql()} recibido,${qaStageSql()} etapa FROM pmp.ordenes_servicio o WHERE codigo_os=$1`,[code])).rows[0];
 if(!o)fail('OS no encontrada','QA_NOT_FOUND',404);return o;
}
async function snapshot(c,o){
 const e=(await c.query(`SELECT * FROM pmp.flujo_eventos WHERE codigo_os=$1 AND metadata->>'version'='3' AND metadata ? 'trabajo' AND metadata->>'ciclo_qa'=$2 ORDER BY id DESC LIMIT 1`,[o.codigo_os,o.ciclo_qa])).rows[0];
 return {revision:e?String(e.id):null,trabajo:e?.metadata.trabajo||initial()};
}
const contextSql=`SELECT o.codigo_os,o.tipo_equipo,o.fecha,o.falla,o.bus_ppu,COALESCE(o.validador_serie,o.consola_serie) serie,
 COALESCE(v.modelo,c.modelo) modelo,COALESCE(v.marca,c.marca) marca,COALESCE(t.nombre,ct.nombre) terminal,COALESCE(p.nombre,cp.nombre) operador,
 COALESCE(caso.referencia_externa,o.ticket_aranda) referencia_ar,concat_ws(' ',lab.nombre,lab.apellido) tecnico_reparador,
 ${qaSnapshotSql()}->'responsable'->>'nombre' tecnico_qa,o.qa_usuario_id,${qaReceiptSql()} fecha_recepcion_qa,
 ${qaCycleSql()} ciclo_qa,${qaSnapshotSql()}->'dictamen'->>'resultado' dictamen,
 COALESCE(${qaSnapshotSql()}->'dictamen'->>'fecha',${qaSnapshotSql()}->'ambiente'->>'fin',${qaSnapshotSql()}->'ambiente'->>'inicio') fecha_etapa,${qaStageSql()} etapa,${qaStateSql()} estado_operacional,
 (SELECT fecha FROM pmp.flujo_eventos WHERE id=${qaCycleSql()}) fecha_envio_qa
 FROM pmp.ordenes_servicio o LEFT JOIN pmp.validadores v ON v.serie=o.validador_serie LEFT JOIN pmp.consolas c ON c.serie=o.consola_serie
 LEFT JOIN pmp.usuarios lab ON lab.id=o.tecnico_laboratorio_id LEFT JOIN pmp.usuarios qa ON qa.id=o.qa_usuario_id
 LEFT JOIN pmp.casos_operacionales caso ON caso.id=o.caso_id LEFT JOIN pmp.terminales t ON t.id=o.terminal_id LEFT JOIN pmp.terminales ct ON ct.id=caso.terminal_id
 LEFT JOIN pmp.pst p ON p.codigo=o.pst_codigo LEFT JOIN pmp.pst cp ON cp.codigo=caso.pst_codigo`;
export async function qaDashboard(c,query={}){
 const stage=['RECEPCION','AMBIENTE','PRUEBAS','DESPACHO','POR_VERIFICAR','HISTORIAL'].includes(query.etapa)?query.etapa:'RECEPCION';
 const page=Math.max(1,Number.parseInt(query.page)||1),limit=20,search=String(query.q||'').trim().slice(0,100);
 const counts=(await c.query(`SELECT ${qaStageSql()} etapa,count(*)::int total FROM pmp.ordenes_servicio o WHERE estado_id=6 GROUP BY 1`)).rows;
 const base=`WITH tickets AS (${contextSql} WHERE o.estado_id=6 OR EXISTS(SELECT 1 FROM pmp.flujo_eventos f WHERE f.codigo_os=o.codigo_os AND f.tipo='SALIDA_QA_BODEGA'))`;
 if(stage==='HISTORIAL'){
  const from=`FROM tickets t JOIN pmp.flujo_eventos f ON f.codigo_os=t.codigo_os AND f.tipo='SALIDA_QA_BODEGA' WHERE ($1='' OR concat_ws(' ',t.codigo_os,t.serie,t.referencia_ar,t.bus_ppu) ILIKE '%'||$1||'%')`;
  const total=(await c.query(`${base} SELECT count(*)::int n ${from}`,[search])).rows[0].n;
  const items=(await c.query(`${base} SELECT t.*,f.id historial_id,'HISTORIAL' etapa,'Ciclo QA despachado' estado_operacional,
    f.metadata->>'ciclo_qa' ciclo_qa,f.fecha fecha_etapa,f.metadata->'trabajo'->'responsable'->>'nombre' tecnico_qa,
    f.metadata->'trabajo'->'dictamen'->>'resultado' dictamen ${from} ORDER BY f.id DESC LIMIT $2 OFFSET $3`,[search,limit,(page-1)*limit])).rows;
  return {items,total,page,page_size:limit,counts:Object.fromEntries(counts.map(r=>[r.etapa,r.total]))};
 }
 const predicate=`etapa=$1 AND ($2='' OR concat_ws(' ',codigo_os,serie,referencia_ar,bus_ppu) ILIKE '%'||$2||'%')`;
 const params=[stage,search];
 const total=(await c.query(`${base} SELECT count(*)::int n FROM tickets WHERE ${predicate}`,params)).rows[0].n;
 const rows=(await c.query(`${base} SELECT * FROM tickets WHERE ${predicate} ORDER BY COALESCE(fecha_recepcion_qa,fecha_envio_qa,fecha),codigo_os LIMIT $3 OFFSET $4`,[...params,limit,(page-1)*limit])).rows;
 return {items:rows,total,page,page_size:limit,counts:Object.fromEntries(counts.map(r=>[r.etapa,r.total]))};
}
export async function qaDetail(c,code,cycle=null){
 const o=await order(c,code);
 if(o.estado_id!==6&&!(await c.query("SELECT 1 FROM pmp.flujo_eventos WHERE codigo_os=$1 AND tipo='SALIDA_QA_BODEGA'",[code])).rowCount)fail('La OS no pertenece a QA','QA_NOT_FOUND',404);
 const context=(await c.query(`${contextSql} WHERE o.codigo_os=$1`,[code])).rows[0];
 const history=(await c.query(`SELECT f.id,f.tipo,f.fecha,f.comentario,f.metadata,concat_ws(' ',u.nombre,u.apellido) autor FROM pmp.flujo_eventos f LEFT JOIN pmp.usuarios u ON u.id=f.usuario_id WHERE f.codigo_os=$1 AND (f.metadata->>'version'='3' OR f.tipo='LAB_REPARACION_FINALIZADA') ORDER BY f.id DESC`,[code])).rows;
 if(cycle){
  const exit=history.find(e=>e.tipo==='SALIDA_QA_BODEGA'&&String(e.metadata.ciclo_qa)===String(cycle));
  if(!exit)fail('Ciclo histórico QA no encontrado','QA_CYCLE_NOT_FOUND',404);
  o.ciclo_qa=String(cycle);context.ciclo_qa=String(cycle);context.etapa='HISTORIAL';context.estado_operacional='Ciclo QA despachado';
  context.fecha_recepcion_qa=history.find(e=>e.tipo==='RECEPCION_QA_CONFIRMADA'&&String(e.metadata.ciclo_qa)===String(cycle))?.fecha||null;
  context.fecha_envio_qa=(await c.query("SELECT fecha FROM pmp.flujo_eventos WHERE codigo_os=$1 AND tipo='SALIDA_BODEGA_QA' AND id::text=$2",[code,String(cycle)])).rows[0]?.fecha||null;
 }
 return {...context,...await snapshot(c,o),antecedentes_laboratorio:history.find(e=>e.tipo==='LAB_REPARACION_FINALIZADA'&&(o.ciclo_qa==='legacy'||Number(e.id)<Number(o.ciclo_qa)))||null,historial:cycle?history.filter(e=>String(e.metadata.ciclo_qa)===String(cycle)):history};
}
function qaOnly(user){if(user?.rol!=='qa')fail('Esta operación corresponde exclusivamente al rol QA','QA_ROLE_REQUIRED',403);}
function stageIs(o,stage){if(o.etapa!==stage)fail('La etapa cambió. Actualiza el trabajo antes de continuar');}
function received(o){if(!o.recibido)fail('Confirma primero la recepción física del ciclo vigente en QA','QA_RECEIPT_REQUIRED');}
function owner(w,user){if(String(w.responsable?.id)!==String(user.id))fail('Solo el responsable QA puede modificar este trabajo','QA_NOT_OWNER',403);}

export function qaTestInput(body){
 const metodo=body.metodo||'',resultado=body.resultado||'PENDIENTE';
 if(!['','Manual','Test MK'].includes(metodo)||!['PENDIENTE','APROBADA','RECHAZADA'].includes(resultado)||(!metodo&&resultado!=='PENDIENTE'))fail('Selecciona Manual o Test MK y un resultado válido','QA_TEST_INVALID',422);
 return {metodo,resultado,observacion:optionalText(body.observacion,'observación',{max:4000})||''};
}
export function qaVerdictInput(w,body){
 if(!['OPERATIVO','RECHAZADO'].includes(body.resultado)||body.confirmacion!==true)fail('Confirma explícitamente el dictamen QA','QA_VERDICT_INVALID',422);
 if(w.ambiente.estado!=='COMPLETADO')fail('Completa Instalación Ambiente antes de emitir dictamen');
 if(!w.pruebas.some(t=>t.metodo&&t.resultado!=='PENDIENTE'))fail('Documenta una evaluación QA antes de emitir dictamen');
 if(body.resultado==='OPERATIVO'&&w.pruebas.some(t=>!t.metodo||t.resultado==='PENDIENTE'))fail('Completa las pruebas aplicables antes de emitir Operativo');
 // Retests remain visible. The most recent execution of each applicable method determines its current result.
 const latest=Object.values(Object.fromEntries(w.pruebas.map(t=>[t.metodo,t])));
 if(body.resultado==='OPERATIVO'&&latest.some(t=>t.resultado!=='APROBADA'))fail('Las pruebas aplicables deben estar aprobadas');
 return {resultado:body.resultado,motivo:body.resultado==='RECHAZADO'?requireText(body.motivo,'motivo técnico de rechazo',{max:4000}):optionalText(body.motivo,'observación',{max:4000})||''};
}
// A completed execution is immutable; retests append a new execution.
export function applyQaTest(w,body,actor,key,now){
 const test=qaTestInput(body);
 if(body.prueba_id){
  const prior=w.pruebas.find(t=>t.id===body.prueba_id);
  if(!prior||prior.resultado!=='PENDIENTE')fail('Una ejecución concluida no se sobrescribe; registra un nuevo intento');
  Object.assign(prior,test,{autor:actor,fecha:now});
 }else w.pruebas.push({...test,id:key,autor:actor,fecha:now});
}
export async function validateQaPhysical(pool,code,purpose,body,user){
 qaOnly(user);if(!['recepcion','despacho'].includes(purpose))fail('Operación física inválida');
 return withTransaction(pool,async c=>{
  const o=await order(c,code,true);stageIs(o,purpose==='recepcion'?'RECEPCION':'DESPACHO');
  const asset=identity(o),method=body.origen_captura,read=requireText(body.codigo,'lectura',{max:64});
  if(body.tipo_equipo!==asset.tipo_equipo)fail('El tipo no coincide con el activo esperado','QA_IDENTITY_MISMATCH',422);
  let proof=null,motivo=null,found=null;
  if(method==='MANUAL_AUTORIZADO'){
   if(body.presencia_fisica!==true)fail('Confirma la presencia física del equipo','QA_PRESENCE_REQUIRED',422);
   motivo=requireText(body.motivo,'motivo de contingencia',{max:1000});
   found=read===asset.serie?asset:{tipo_equipo:body.tipo_equipo,serie:read};
  }else if(method==='SCANNER'){
   proof=validateReceiptScanner(body);
   try{found=await findEquipment(c,normalizeScannedCode(read));}catch(e){if(!(e instanceof ScanError))throw e;found={serie:read,tipo_equipo:null};}
  }else fail('Usa escáner físico o Ingreso manual autorizado','QA_CAPTURE_INVALID',422);
  const coincide=found.serie===asset.serie&&found.tipo_equipo===asset.tipo_equipo;
  const event=await emit(c,o,user,coincide?'QA_IDENTIDAD_VALIDADA':'QA_IDENTIDAD_DISCREPANCIA',{proposito:purpose,origen_captura:method,codigo_leido:read,esperado:asset,encontrado:found,presencia_fisica:body.presencia_fisica===true,motivo,lectura_scanner:proof},coincide?'Identidad QA validada. No confirma movimiento.':'Equipo distinto al esperado. No confirma movimiento.');
  return {coincide,validacion_id:coincide?String(event.id):null,esperado:asset,encontrado:found};
 });
}
async function physical(c,o,purpose,id,user){
 const e=(await c.query(`SELECT * FROM pmp.flujo_eventos WHERE codigo_os=$1 AND metadata->>'version'='3' AND metadata->>'ciclo_qa'=$2 AND metadata->>'proposito'=$3 AND tipo IN ('QA_IDENTIDAD_VALIDADA','QA_IDENTIDAD_DISCREPANCIA') ORDER BY id DESC LIMIT 1`,[o.codigo_os,o.ciclo_qa,purpose])).rows[0];
 if(!e||e.tipo!=='QA_IDENTIDAD_VALIDADA'||String(e.id)!==String(id)||String(e.usuario_id)!==String(user.id)||Date.now()-new Date(e.fecha).getTime()>15*60*1000)fail('Valida nuevamente la identidad física para esta operación','QA_PHYSICAL_REQUIRED');
 return {validacion_id:String(e.id),...e.metadata};
}
// Every command locks the OS, verifies cycle/revision, then appends an immutable snapshot.
// Request keys make network retries equivalent without permitting a different payload to overwrite work.
export async function qaCommand(pool,code,action,body,user){
 qaOnly(user);
 return withTransaction(pool,async c=>{
  const o=await order(c,code,true),key=requireText(body.request_id,'identificador de solicitud',{max:100});
  if(String(body.ciclo_qa)!==o.ciclo_qa)fail('El ciclo QA cambió. Recarga la OS','QA_CYCLE_CONFLICT');
  const hash=digest({action,body});
  const replay=(await c.query(`SELECT * FROM pmp.flujo_eventos WHERE codigo_os=$1 AND metadata->>'version'='3' AND metadata->>'ciclo_qa'=$2 AND metadata->>'request_id'=$3 ORDER BY id DESC LIMIT 1`,[code,o.ciclo_qa,key])).rows[0];
  if(replay){if(replay.metadata.fingerprint!==hash||String(replay.usuario_id)!==String(user.id))fail('Solicitud reutilizada con datos diferentes');return {success:true,duplicado:true,revision:String(replay.id),trabajo:replay.metadata.trabajo};}
  const current=await snapshot(c,o),w=structuredClone(current.trabajo);
  if(String(body.revision??'')!==String(current.revision??''))fail('Otro avance fue guardado. Recarga antes de continuar','QA_VERSION_CONFLICT');
  const now=(await c.query('SELECT clock_timestamp() fecha')).rows[0].fecha.toISOString();
  const actor={id:String(user.id),nombre:[user.nombre,user.apellido].filter(Boolean).join(' '),fecha:now};
  let type,extra={};
  if(action==='recepcion'){
   stageIs(o,'RECEPCION');if(body.confirmacion!==true)fail('Confirma explícitamente la recepción');
   extra=await physical(c,o,'recepcion',body.validacion_id,user);
   const location=(await c.query("SELECT id FROM pmp.ubicaciones WHERE tipo='QA' ORDER BY id LIMIT 1")).rows[0];
   if(!location)fail('Ubicación QA no configurada');
   await c.query('UPDATE pmp.ordenes_servicio SET ubicacion_id=$2,qa_usuario_id=NULL,qa_asignado_por=NULL,qa_asignado_en=NULL,actualizado_en=NOW() WHERE codigo_os=$1',[code,location.id]);
   w.receptor=actor;w.etapa='AMBIENTE';type='RECEPCION_QA_CONFIRMADA';
  }else{
   received(o);
   if(action==='iniciar'){
    stageIs(o,'AMBIENTE');
    if(w.responsable&&String(w.responsable.id)!==String(user.id))fail('Otro usuario QA ya tomó este trabajo','QA_ALREADY_TAKEN');
    if(w.ambiente.estado!=='PENDIENTE')fail('Instalación Ambiente ya iniciada');
    if(!w.responsable){
     w.responsable=actor;
     await c.query('UPDATE pmp.ordenes_servicio SET qa_usuario_id=$2,qa_asignado_por=$2,qa_asignado_en=NOW(),actualizado_en=NOW() WHERE codigo_os=$1',[code,user.id]);
     await emit(c,o,user,'QA_TRABAJO_TOMADO',{trabajo:structuredClone(w),comando_id:key});
    }
    w.ambiente.estado='EN_CURSO';w.ambiente.inicio=now;type='QA_AMBIENTE_INICIADO';
   }else if(action==='tomar'){
    if(w.responsable&&String(w.responsable.id)!==String(user.id))fail('Otro usuario QA ya tomó este trabajo','QA_ALREADY_TAKEN');
    if(w.responsable)return {success:true,duplicado:true,...current};
    if(!['AMBIENTE','PRUEBAS'].includes(o.etapa))fail('El trabajo no está disponible para tomar');
    w.responsable=actor;type='QA_TRABAJO_TOMADO';
    await c.query('UPDATE pmp.ordenes_servicio SET qa_usuario_id=$2,qa_asignado_por=$2,qa_asignado_en=NOW(),actualizado_en=NOW() WHERE codigo_os=$1',[code,user.id]);
   }else if(action==='despacho'){
    stageIs(o,'DESPACHO');if(body.confirmacion!==true||!w.dictamen)fail('Confirma explícitamente la salida con dictamen vigente');
    if(body.destino&&body.destino!=='BODEGA')fail('El destino físico obligatorio es Bodega');
    extra={...await physical(c,o,'despacho',body.validacion_id,user),origen:'QA',destino:'Bodega',resultado:w.dictamen.resultado,disposicion:w.dictamen.resultado==='OPERATIVO'?'Instalación':'Retorno a Laboratorio'};
    await c.query('UPDATE pmp.ordenes_servicio SET estado_id=11,ubicacion_id=NULL,es_aprobado_qa=$2,actualizado_en=NOW() WHERE codigo_os=$1',[code,w.dictamen.resultado==='OPERATIVO']);
    w.despachador=actor;w.etapa='HISTORIAL';type='SALIDA_QA_BODEGA';
   }else{
    owner(w,user);if(w.dictamen)fail('El dictamen definitivo es inmutable');
    if(action.startsWith('ambiente-')){
     stageIs(o,'AMBIENTE');
     if(action==='ambiente-iniciar'){
      if(w.ambiente.estado!=='PENDIENTE')fail('Instalación Ambiente ya iniciada');
      w.ambiente.estado='EN_CURSO';w.ambiente.inicio=now;type='QA_AMBIENTE_INICIADO';
     }else if(['ambiente-guardar','ambiente-completar'].includes(action)){
      if(w.ambiente.estado!=='EN_CURSO')fail('Inicia Instalación Ambiente antes de guardar o completar');
      w.ambiente.observacion=optionalText(body.observacion,'observación',{max:4000})||'';
      type='QA_AMBIENTE_GUARDADO';
      if(action==='ambiente-completar'){
       if(body.confirmacion!==true)fail('Confirma explícitamente Instalación Ambiente completada');
       w.ambiente.estado='COMPLETADO';w.ambiente.fin=now;w.etapa='PRUEBAS';type='QA_AMBIENTE_COMPLETADO';
      }
     }else fail('Acción QA no válida','QA_ACTION_INVALID',422);
    }else if(action==='prueba'){
     stageIs(o,'PRUEBAS');applyQaTest(w,body,actor,key,now);
     type='QA_PRUEBA_GUARDADA';
    }else if(action==='dictamen'){
     stageIs(o,'PRUEBAS');
     if(body.prueba!==undefined){
      if(!body.prueba||typeof body.prueba!=='object'||Array.isArray(body.prueba))fail('Prueba QA inválida','QA_TEST_INVALID',422);
      applyQaTest(w,body.prueba,actor,key+':prueba',now);
     }
     const verdict=qaVerdictInput(w,body);
     if(verdict.resultado==='OPERATIVO'&&(await c.query("SELECT 1 FROM pmp.solicitudes_repuestos WHERE codigo_os=$1 AND estado NOT IN ('DESPACHADA','RECHAZADA') LIMIT 1",[code])).rowCount)fail('Existen solicitudes de repuestos pendientes');
     if(body.prueba!==undefined)await emit(c,o,user,'QA_PRUEBA_GUARDADA',{trabajo:structuredClone(w),comando_id:key});
     w.dictamen={...verdict,autor:actor,fecha:now};w.etapa='DESPACHO';type='QA_DICTAMEN_CONFIRMADO';
    }else fail('Acción QA no válida','QA_ACTION_INVALID',422);
   }
  }
  const e=await emit(c,o,user,type,{...extra,trabajo:w,request_id:key,fingerprint:hash},null);
  return {success:true,revision:String(e.id),trabajo:w};
 });
}
