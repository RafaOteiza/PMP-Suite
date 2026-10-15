import {isDeepStrictEqual} from 'node:util';
import {createHash} from 'node:crypto';
import {FlowError,requireText,optionalText,withTransaction,addFlowEvent} from './bridgeFlow.js';
import {requireLatestPhysicalScan} from './equipmentScan.js';
import {labAvailableSql} from './labArrival.js';
import {withdrawalEvidence,POD_CATEGORIES} from './terrainWithdrawalEvidence.js';
export const LAB_TEST_METHODS=['Manual','Test MK'];
const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])])):value;
const fail=(message,code='LAB_WORK_INVALID',status=422)=>{throw new FlowError(status,code,message);};
const text=(value,name,max=4000)=>optionalText(value,name,{max})||'';
const choice=(value,values,name)=>{if(value!==undefined&&value!==null&&value!==''&&!values.includes(value))fail(`${name} no válido`);return value||'';};
const list=(value,name,max)=>{if(value===undefined)return [];if(!Array.isArray(value)||value.length>max)fail(`${name}: máximo ${max}`);return value;};
export async function workInput(body={},closing=false){
 if(!body||typeof body!=='object'||Array.isArray(body))fail('Trabajo técnico no válido');
 const d=body.diagnostico||{},p=body.pod||{};
 if(typeof d!=='object'||Array.isArray(d)||typeof p!=='object'||Array.isArray(p))fail('Diagnóstico o evidencia no válidos');
 const result={diagnostico:{resultado:choice(d.resultado,['CONFIRMADA','DIFERENTE','NFF','POD','OTRO'],'Diagnóstico'),falla_real:text(d.falla_real,'Falla real',200),observacion:text(d.observacion,'Observación de diagnóstico')},
  acciones:[...new Set(list(body.acciones,'Acciones',20).map(a=>requireText(a,'Acción',{max:120})))],
  pruebas:list(body.pruebas,'Pruebas',30).map(t=>({nombre:choice(t?.nombre,LAB_TEST_METHODS,'Método de prueba'),resultado:choice(t?.resultado,['APROBADA','RECHAZADA'],'Resultado de prueba'),observacion:text(t?.observacion,'Observación de prueba',1000)})),
  resultado:choice(body.resultado,['REPARADO','NFF','PENDIENTE_REPUESTO','NO_REPARABLE','POD','REVISION'],'Resultado técnico'),observaciones_qa:text(body.observaciones_qa,'Observaciones para QA'),
  pod:{categoria:choice(p.categoria,POD_CATEGORIES,'Categoría PoD'),observacion:text(p.observacion,'Observación PoD'),fotografias:[]}};
 if(body.repuestos?.length||body.repuesto_id!==undefined||body.stock!==undefined)fail('El inventario se gestiona exclusivamente en Bodega','LAB_INVENTORY_FORBIDDEN');
 if(result.acciones.some(a=>a.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().includes('pruebas de estres')))fail('Los métodos de prueba son Manual y Test MK; no son intervenciones');
 const isPod=result.diagnostico.resultado==='POD'||result.resultado==='POD';
 const evidence=await withdrawalEvidence({pod:closing&&isPod,categoria_pod:p.categoria,evidencia:p.observacion,fotografias:p.fotografias||[]},{allowedOrigins:['CAMARA','ARCHIVO']});
 result.pod.fotografias=evidence.fotografias;
 if(closing){
  if(!result.diagnostico.resultado||!['REPARADO','NFF','POD'].includes(result.resultado))fail('Completa diagnóstico y un resultado técnico apto para cierre');
  if(!result.pruebas.length||result.pruebas.some(t=>!t.nombre||t.resultado!=='APROBADA'))fail('Registra pruebas completas y aprobadas antes de preparar QA');
  if(['DIFERENTE','CONFIRMADA'].includes(result.diagnostico.resultado)&&!result.diagnostico.falla_real)fail('Indica la falla real diagnosticada');
  if(['NFF','OTRO'].includes(result.diagnostico.resultado)&&!result.diagnostico.observacion.trim())fail('Este diagnóstico requiere observación técnica');
  if((result.resultado==='NFF')!==(result.diagnostico.resultado==='NFF'))fail('El resultado Sin falla encontrada requiere diagnóstico NFF');
  if(isPod&&result.resultado!=='POD')fail('Conserva PoD detectado en el resultado técnico');
  if(result.resultado==='POD'&&result.diagnostico.resultado!=='POD')fail('Registra diagnóstico de PoD detectado');
  if(result.resultado==='REPARADO'&&!result.acciones.length)fail('Registra al menos una intervención realizada');
 }
 return result;
}
const cycleSql=`COALESCE((SELECT MAX(id)::text FROM pmp.flujo_eventos WHERE codigo_os=o.codigo_os AND tipo='SALIDA_BODEGA_LABORATORIO'),'legacy')`;
async function order(client,code,user,lock=false){
 const row=(await client.query(`SELECT o.*,${cycleSql} AS ciclo,${labAvailableSql()} AS disponible FROM pmp.ordenes_servicio o WHERE codigo_os=$1 ${lock?'FOR UPDATE OF o':''}`,[requireText(code,'OS',{max:50})])).rows[0];
 if(!row||user.rol!=='tecnico_laboratorio'||String(row.tecnico_laboratorio_id)!==String(user.id))fail('La OS no pertenece a tu carga','LAB_NOT_ASSIGNED',403);
 return row;
}
async function ready(client,row){if(!row.disponible||![4,5,9,10].includes(row.estado_id))fail('El trabajo no está físicamente disponible en Laboratorio','LAB_RECEIPT_REQUIRED',409);await requireLatestPhysicalScan(client,{codigoOs:row.codigo_os,station:'LABORATORIO'});}
async function latest(client,row,type){return (await client.query(`SELECT * FROM pmp.flujo_eventos WHERE codigo_os=$1 AND tipo=$2 AND metadata->>'ciclo'=$3 ORDER BY id DESC LIMIT 1`,[row.codigo_os,type,row.ciclo])).rows[0];}
function legacyFrom(e){
 const w=e?.metadata?.trabajo||{},old=e?.metadata?.legado||{};
 return {pruebas:[...(old.pruebas||[]),...(w.pruebas||[]).filter(t=>t.nombre&&!LAB_TEST_METHODS.includes(t.nombre))],
  repuestos:old.repuestos||w.repuestos||[],justificacion_repuestos:old.justificacion_repuestos||w.justificacion_repuestos||''};
}
function snapshot(e){
 const legacy=legacyFrom(e),raw=e?.metadata?.trabajo;
 let trabajo=null;
 if(raw){const {repuestos,justificacion_repuestos,...rest}=raw;trabajo={...rest,pruebas:(raw.pruebas||[]).filter(t=>!t.nombre||LAB_TEST_METHODS.includes(t.nombre))};}
 return {revision:e?.id?String(e.id):null,trabajo,legado:{pruebas:legacy.pruebas,tiene_repuestos:legacy.repuestos.length>0},guardado_en:e?.fecha||null,guardado_por:e?.usuario_id||null};
}
async function podContext(c,row){
 const found=(await c.query(`SELECT tipo,comentario,metadata FROM pmp.flujo_eventos
  WHERE codigo_os=$1 AND ((tipo='RETIRO_TERRENO_CONFIRMADO' AND metadata->>'pod'='true')
   OR (tipo='POD_DETECTADO_LABORATORIO' AND metadata->>'ciclo'=$2)
   OR (tipo='LAB_SOLICITUD_REPUESTO' AND metadata->>'ciclo'=$2 AND metadata->>'version'='2'))
  ORDER BY id DESC LIMIT 1`,[row.codigo_os,row.ciclo])).rows[0];
 if(!found)return null;
 const evidence=found.tipo==='LAB_SOLICITUD_REPUESTO'?found.metadata.pod:found.metadata;
 return {categoria:evidence.categoria_pod,observacion:evidence.observacion||found.comentario||'',fotografias:evidence.fotografias||[],origen:found.tipo==='RETIRO_TERRENO_CONFIRMADO'?'Retiro de terreno':'Laboratorio'};
}
async function pendingRequests(c,row){
 return (await c.query("SELECT id,repuesto_solicitado,comentario,estado,fecha_solicitud,fecha_despacho FROM pmp.solicitudes_repuestos WHERE codigo_os=$1 ORDER BY fecha_solicitud DESC,id DESC",[row.codigo_os])).rows;
}
const blocking=requests=>requests.some(r=>!['DESPACHADA','RECHAZADA'].includes(r.estado));
const identity=o=>({tipo_equipo:o.tipo_equipo,serie:o.validador_serie||o.consola_serie});
const event=(c,o,u,type,metadata={},comment=null)=>addFlowEvent(c,{os:o.codigo_os,type,user:u,asset:identity(o),comment,metadata:{ciclo:o.ciclo,...metadata}});
export async function readWork(pool,code,user){
 const row=await order(pool,code,user),draft=await latest(pool,row,'LAB_AVANCE_GUARDADO');
 const retorno=(await pool.query(`SELECT f.fecha,f.metadata->>'ciclo_qa' AS ciclo,f.metadata->'trabajo' AS trabajo,concat_ws(' ',u.nombre,u.apellido) AS autor,
 (SELECT COALESCE(jsonb_agg(jsonb_build_object('fecha',v.fecha,'metodo',v.metadata->>'origen_captura','codigo_leido',v.metadata->>'codigo_leido','proposito',v.metadata->>'proposito','motivo',v.metadata->>'motivo') ORDER BY v.id),'[]'::jsonb) FROM pmp.flujo_eventos v WHERE v.codigo_os=f.codigo_os AND v.tipo IN ('RECEPCION_QA_CONFIRMADA','SALIDA_QA_BODEGA') AND v.metadata->>'ciclo_qa'=f.metadata->>'ciclo_qa') evidencias FROM pmp.flujo_eventos f LEFT JOIN pmp.usuarios u ON u.id=f.usuario_id WHERE f.codigo_os=$1 AND f.tipo='QA_DICTAMEN_CONFIRMADO' AND f.metadata->'trabajo'->'dictamen'->>'resultado'='RECHAZADO' ORDER BY f.id DESC LIMIT 1`,[code])).rows[0]||null;
 return {...snapshot(draft),antecedentes_qa:retorno,ciclo:row.ciclo,pod_contexto:await podContext(pool,row),solicitudes:await pendingRequests(pool,row)};
}
export async function saveWork(pool,body,user){return withTransaction(pool,async c=>{
 const row=await order(c,body.codigo_os,user,true);await ready(c,row);if(![4,5,9].includes(row.estado_id))fail('El trabajo ya está cerrado','LAB_CLOSED',409);
 const current=await latest(c,row,'LAB_AVANCE_GUARDADO');if(String(body.revision??'')!==String(current?.id??''))fail('Otro avance fue guardado. Recarga para revisar antes de sobrescribir','LAB_DRAFT_CONFLICT',409);
 // An unchanged restored draft was already validated; avoid recompressing its images.
 if(current&&isDeepStrictEqual(current.metadata.trabajo,body.trabajo))return snapshot(current);
 const trabajo=await workInput(body.trabajo);
 if(isDeepStrictEqual(current?.metadata.trabajo,trabajo))return snapshot(current);
 return snapshot(await event(c,row,user,'LAB_AVANCE_GUARDADO',{trabajo,legado:legacyFrom(current),version:2},'Avance técnico guardado. No cambia estado ni stock.'));
});}
export async function startWork(pool,body,user){return withTransaction(pool,async c=>{
 const row=await order(c,body.codigo_os,user,true);await ready(c,row);if(row.estado_id===5)return {success:true};if(row.estado_id!==4)fail('Solo se inicia trabajo desde diagnóstico','LAB_INVALID_STATE',409);
 await c.query('UPDATE pmp.ordenes_servicio SET estado_id=5,actualizado_en=now() WHERE codigo_os=$1',[row.codigo_os]);
 await event(c,row,user,'LAB_TRABAJO_INICIADO',{},'Trabajo técnico iniciado. En diagnóstico → En reparación.');return {success:true};
});}
export async function finishWork(pool,body,user){return withTransaction(pool,async c=>{
 const row=await order(c,body.codigo_os,user,true);
 if(!body.trabajo||typeof body.trabajo!=='object'||Array.isArray(body.trabajo))fail('Trabajo técnico no válido');
 // Hash the submitted business payload; normalized image encoding need not be stable across retries.
 const signature=createHash('sha256').update(JSON.stringify(canonical(body.trabajo))).digest('hex');
 const completed=await latest(c,row,'LAB_REPARACION_FINALIZADA');
 if(completed){if(completed.metadata.firma!==signature&&!isDeepStrictEqual(completed.metadata.trabajo,body.trabajo))fail('Este ciclo ya tiene un cierre diferente','LAB_ALREADY_FINISHED',409);return {success:true,duplicado:true,estado_id:row.estado_id};}
 const trabajo=await workInput(body.trabajo,true);
 if(blocking(await pendingRequests(c,row)))fail('Existe una solicitud de Bodega pendiente','LAB_REQUEST_PENDING',409);
 await ready(c,row);if(row.estado_id!==5)fail('Inicia el trabajo y resuelve la espera de repuesto antes de cerrar','LAB_INVALID_STATE',409);
 const draft=await latest(c,row,'LAB_AVANCE_GUARDADO');if(String(body.revision??'')!==String(draft?.id??''))fail('Hay un avance más reciente; recarga antes de cerrar','LAB_DRAFT_CONFLICT',409);
 await c.query(`INSERT INTO pmp.registro_reparaciones(codigo_os,tecnico_id,falla_detectada,accion_realizada,repuestos_usados,comentario,prueba_realizada,resultado_prueba) VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,
  [row.codigo_os,user.id,trabajo.diagnostico.falla_real||trabajo.diagnostico.resultado,trabajo.acciones.join(', '),null,trabajo.observaciones_qa,JSON.stringify(trabajo.pruebas),'APROBADA']);
 await event(c,row,user,'LAB_DIAGNOSTICO_CONFIRMADO',{diagnostico:trabajo.diagnostico},'Diagnóstico confirmado');
 if(trabajo.resultado==='POD')await event(c,row,user,'POD_DETECTADO_LABORATORIO',{pod:true,categoria_pod:trabajo.pod.categoria,fotografias:trabajo.pod.fotografias},trabajo.pod.observacion);
 await c.query('UPDATE pmp.ordenes_servicio SET estado_id=10,actualizado_en=now() WHERE codigo_os=$1',[row.codigo_os]);
 await event(c,row,user,'LAB_REPARACION_FINALIZADA',{trabajo,legado:legacyFrom(draft),version:2,firma:signature},'Trabajo técnico finalizado. Pendiente de salida física para continuar a QA.');
 await event(c,row,user,'LAB_LISTO_QA',{},'Trabajo listo para QA. No confirma salida ni recepción física.');
 return {success:true,estado_id:10};
});}
export async function requestPart(pool,body,user){return withTransaction(pool,async c=>{
 const row=await order(c,body.codigo_os,user,true);await ready(c,row);
 if(body.repuesto_id!==undefined||body.cantidad!==undefined)fail('Describe la necesidad; Bodega identifica la pieza y cantidad','LAB_INVENTORY_FORBIDDEN');
 const need=requireText(body.necesidad,'Repuesto o componente necesario',{max:200}),reason=requireText(body.motivo,'Motivo técnico',{max:2000});
 const draft=await latest(c,row,'LAB_AVANCE_GUARDADO');
 const ownPod=draft?.metadata.trabajo?.diagnostico?.resultado==='POD'||draft?.metadata.trabajo?.resultado==='POD';
 const pod=ownPod?draft.metadata.trabajo.pod:await podContext(c,row);
 if(!pod)fail('La solicitud requiere una condición PoD documentada','LAB_POD_REQUIRED');
 const evidence=await withdrawalEvidence({pod:true,categoria_pod:pod.categoria,evidencia:pod.observacion,fotografias:pod.fotografias},{allowedOrigins:['CAMARA','ARCHIVO']});
 if(row.estado_id===9){
  const previous=await latest(c,row,'LAB_SOLICITUD_REPUESTO');
  if(previous?.metadata.necesidad===need&&previous.metadata.motivo===reason)return {success:true,duplicado:true,estado_id:9};
 }
 if(![4,5].includes(row.estado_id)||blocking(await pendingRequests(c,row)))fail('La OS no admite otra solicitud en esta etapa','LAB_INVALID_STATE',409);
 const request=(await c.query(`INSERT INTO pmp.solicitudes_repuestos(codigo_os,solicitado_por,repuesto_solicitado,comentario) VALUES($1,$2,$3,$4) RETURNING id`,[row.codigo_os,user.id,need,reason])).rows[0];
 await event(c,row,user,'LAB_SOLICITUD_REPUESTO',{solicitud_id:request.id,necesidad:need,motivo:reason,pod:evidence,revision_avance:draft?.id||null,version:2},`${need} · ${reason}`);
 await c.query('UPDATE pmp.ordenes_servicio SET estado_id=9,actualizado_en=now() WHERE codigo_os=$1',[row.codigo_os]);return {success:true,estado_id:9};
});}
