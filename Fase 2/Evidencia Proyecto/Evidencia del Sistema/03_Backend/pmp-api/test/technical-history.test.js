import test from 'node:test';
import assert from 'node:assert/strict';
import {projectTechnicalHistory} from '../src/services/technicalAssetHistory.js';
import {installMockFirebaseCredential} from './helpers/mockFirebaseCredential.js';

const order=(code='MV-TEST-01',date='2026-10-01')=>({codigo_os:code,fecha:date,estado_id:13,falla:'No lee QR',tipo_equipo:'VALIDADOR',serie:'7490999',costos:'PRIVATE_COST',tecnico_laboratorio_id:'PRIVATE_USER'});
const event=(type,date='2026-10-02',extra={})=>({id:'fixture-event',codigo_os:'MV-TEST-01',fecha:date,tipo:type,detalle:{metadata:extra},comentario:null});
const finish=(result='REPARADO',extra={})=>event('LAB_REPARACION_FINALIZADA','2026-10-03',{trabajo:{resultado:result,diagnostico:{falla_real:'Lector desalineado'},acciones:['Ajuste del lector'],observaciones_qa:'Prueba funcional conforme',repuestos:['PRIVATE_PART'],pod:{fotografias:['PRIVATE_PHOTO']},...extra},firma:'PRIVATE_SIGNATURE',usuario_id:'PRIVATE_AUTHORIZER'});
const history=(orders=[order()],events=[finish()])=>({tipo_equipo:'VALIDADOR',serie:'7490999',modelo:'CVB45',marca:'Mikroelektronika',ordenes:orders,eventos:events,referencias:[{id:1,comentario:'PRIVATE_REFERENCE'}]});

test('sin intervenciones o solo instalación correcta: no inventa reparación',()=>{
 assert.deepEqual(projectTechnicalHistory(history([],[])).intervenciones,[]);
 assert.deepEqual(projectTechnicalHistory(history([{...order(),es_instalacion:true}],[event('INSTALACION_COMPLETADA')])).intervenciones,[]);
});
test('una reparación agrupa diagnóstico, registro, QA y auditoría en una sola OS',()=>{
 const raw=history([order()],[event('OS_ACTUALIZADA'),event('LAB_DIAGNOSTICO_CONFIRMADO'),finish(),{...event('REPARACION'),detalle:{accion_realizada:'Ajuste del lector'}},event('VALIDACION_BODEGA')]);
 const before=structuredClone(raw),result=projectTechnicalHistory(raw,{estado_actual:'En operación'});
 assert.equal(result.intervenciones.length,1);assert.equal(result.intervenciones[0].resultado,'Reparado');
 assert.equal(result.intervenciones[0].diagnostico,'Lector desalineado');assert.equal(result.intervenciones[0].trabajo_realizado,'Ajuste del lector');assert.deepEqual(raw,before);
 assert.doesNotMatch(JSON.stringify(result),/PRIVATE_|metadata|costos|repuestos|firma|usuario_id|referencias|eventos|MANUAL_AUTORIZADO/);
 assert.deepEqual(Object.keys(result).sort(),['estado_actual','intervenciones','marca','modelo','serie','tipo_equipo']);
});
test('ordena OS por última intervención real sin usar fecha de auditoría',()=>{
 const result=projectTechnicalHistory(history([order(),order('MV-TEST-02','2026-10-05')],[finish(),{...event('OS_ACTUALIZADA','2026-10-09')} ]));
 assert.deepEqual(result.intervenciones.map(o=>o.codigo_os),['MV-TEST-02','MV-TEST-01']);
 assert.equal(result.intervenciones[1].fecha,'2026-10-03');
});
test('múltiples reparaciones: una tarjeta por OS, ordenadas por fecha técnica descendente',()=>{
 const second={...finish('NFF',{acciones:[]}),codigo_os:'MC-TEST-02',fecha:'2026-10-06'};
 const output=projectTechnicalHistory(history([order(),order('MC-TEST-02')],[second,finish()]));
 assert.deepEqual(output.intervenciones.map(row=>[row.codigo_os,row.resultado]),[['MC-TEST-02','NFF confirmado'],['MV-TEST-01','Reparado']]);
});
test('NFF confirmado no inventa acciones de reparación',()=>{
 const row=projectTechnicalHistory(history([order()],[finish('NFF',{diagnostico:{resultado:'NFF',observacion:'No reproduce falla'},acciones:[]})])).intervenciones[0];
 assert.equal(row.resultado,'NFF confirmado');assert.equal(row.trabajo_realizado,null);assert.equal(row.diagnostico,'Sin falla encontrada');
});
test('rechazo posterior muestra motivo técnico sin autor ni evidencia interna',()=>{
 const qa=event('QA_DICTAMEN_CONFIRMADO','2026-10-04',{trabajo:{dictamen:{resultado:'RECHAZADO',motivo:'Persiste falla intermitente',autor:{nombre:'PRIVATE_PERSON'}}}});
 const row=projectTechnicalHistory(history([order()],[finish(),qa])).intervenciones[0];
 assert.equal(row.resultado,'Rechazado');assert.ok(row.observaciones.includes('Persiste falla intermitente'));assert.doesNotMatch(JSON.stringify(row),/PRIVATE/);
});
test('borradores y prueba aprobada legacy no equivalen a reparado confirmado',()=>{
 const draft=event('LAB_AVANCE_GUARDADO','2026-10-03',{trabajo:{resultado:'REPARADO',acciones:['PRIVATE_DRAFT']}});
 let row=projectTechnicalHistory(history([{...order(),estado_id:5}],[draft])).intervenciones[0];
 assert.equal(row.resultado,null);assert.equal(row.pendiente,true);assert.equal(row.trabajo_realizado,null);
 row=projectTechnicalHistory(history([order()],[{...event('REPARACION'),detalle:{resultado_prueba:'APROBADA',falla_detectada:'Falla histórica',accion_realizada:'Trabajo documentado'}}])).intervenciones[0];
 assert.equal(row.resultado,null);assert.equal(row.pendiente,false);
});

// HTTP integration through the actual Firebase/identity/role middleware with isolated mocks.
// Neither PostgreSQL nor Firebase network clients are called.
const removeCredential=installMockFirebaseCredential();
const {default:admin}=await import('../src/firebase.js');
const {pool}=await import('../src/db.js');
const {default:app}=await import('../src/app.js');
const originalQuery=pool.query,auth=admin.auth(),originalVerify=auth.verifyIdToken;
let reads=[],fixture=history();
const roles=['admin','gerente','logistica','tecnico_laboratorio','qa','tecnico_terreno'];
auth.verifyIdToken=async token=>({uid:token,email:token+'@example.invalid',rol:'admin'});
pool.query=async(sql,params=[])=>{
 assert.match(sql.trim(),/^(SELECT|WITH)\b/);reads.push(sql);
 let rows;
 if(sql.includes('WHERE firebase_uid=$1'))rows=[{id:params[0],firebase_uid:params[0],correo:params[1],rol:roles.includes(params[0])?params[0]:'unknown',activo:params[0]!=='inactive'}];
 else if(sql.startsWith('WITH hardware'))rows=[{estado_actual:'En operación'}];
 else if(sql.includes('SELECT o.*,CASE')){if(fixture.fail)throw Error('PRIVATE_SQL transaction detail');rows=fixture.ordenes;}
 else if(sql.includes('WHERE o.codigo_os = $1'))rows=[{...order(),tecnico_terreno_id:'tecnico_terreno',qa_asignado_por:'PRIVATE_APPROVER',stock_origen_evento:'PRIVATE_STOCK'}];
 else if(sql.includes('WITH ordenes AS'))rows=fixture.eventos;
 else if(sql.includes("SELECT 'estado:'"))rows=[];
 else if(sql.includes('SELECT * FROM pmp.v_referencias_activo'))rows=fixture.referencias;
 else if(sql.includes('SELECT modelo,marca'))rows=[{modelo:fixture.modelo,marca:fixture.marca}];
 else if(sql.includes('SELECT a.tipo_equipo')){if(fixture.fail)throw Error('PRIVATE_SQL transaction detail');rows=[{tipo_equipo:fixture.tipo_equipo,serie:fixture.serie,modelo:fixture.modelo,marca:fixture.marca}];}
 else if(sql.includes('FROM pmp.validadores'))rows=[{serie:fixture.serie}];
 else throw Error('Unexpected SQL in isolated history fixture');
 return {rows,rowCount:rows.length};
};
const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
const request=async(path,role='tecnico_terreno',headers={})=>fetch(`http://127.0.0.1:${server.address().port}/api${path}`,{headers:{...(role?{authorization:'Bearer '+role}:{}),...headers}});
test.after(async()=>{await new Promise(resolve=>server.close(resolve));pool.query=originalQuery;auth.verifyIdToken=originalVerify;removeCredential();});

test('HTTP Terreno: proyección cerrada incluso con parámetros/headers que simulan admin',async()=>{
 const response=await request('/bridge/activos/VALIDADOR/7490999/historial?rol=admin&include=eventos&full=true',undefined,{'x-role':'admin'});
 assert.equal(response.status,200);const json=await response.json();assert.equal(json.intervenciones[0].resultado,'Reparado');assert.doesNotMatch(JSON.stringify(json),/PRIVATE|eventos|detalle|metadata|referencias|ordenes/);
});
test('HTTP Terreno: rutas administrativas alternativas y detalle de otros módulos denegados',async()=>{
 for(const path of ['/bridge','/bridge/?rol=admin','/requerimientos?q=7490999','/requerimientos/1?full=true','/lab/work/MV-TEST-01','/qa/MV-TEST-01/work','/bodega/repuestos']){
  const before=reads.length;const response=await request(path);assert.equal(response.status,403,path);assert.equal(reads.length,before+1,'Only identity lookup, no administrative data query');
 }
});
test('HTTP demás roles conservan respuestas completas sin ampliar acceso',async()=>{
 for(const role of roles.filter(r=>r!=='tecnico_terreno')){
  const response=await request('/bridge/activos/VALIDADOR/7490999/historial',role);assert.equal(response.status,200,role);
  const json=await response.json();assert.ok(json.ordenes&&json.eventos&&json.referencias);assert.equal(json.ordenes[0].costos,'PRIVATE_COST');assert.equal(json.intervenciones,undefined);
 }
});
test('HTTP detalle OS asignada no evade proyección; otra identidad sigue bloqueada',async()=>{
 let response=await request('/os/MV-TEST-01');assert.equal(response.status,200);
 const json=await response.json();assert.equal(json.codigo_os,'MV-TEST-01');assert.doesNotMatch(JSON.stringify(json),/PRIVATE|qa_asignado|stock_origen|tecnico_terreno_id/);
 response=await request('/os/MV-TEST-01','tecnico_laboratorio');assert.equal(response.status,403);
 response=await request('/os/MV-TEST-01','admin');assert.equal(response.status,200);assert.equal((await response.json()).qa_asignado_por,'PRIVATE_APPROVER');
});
test('HTTP sin token, cuenta inactiva o rol desconocido no obtiene historial',async()=>{
 assert.equal((await request('/bridge/activos/VALIDADOR/7490999/historial',null)).status,401);
 for(const role of ['inactive','unknown'])assert.equal((await request('/bridge/activos/VALIDADOR/7490999/historial',role)).status,403);
});
test('HTTP búsqueda por serie/OS/referencia solo devuelve identidad del activo',async()=>{
 for(const q of ['7490999','MV-TEST-01','AR-TEST-01']){
  const response=await request('/bridge/buscar?q='+q);assert.equal(response.status,200);assert.deepEqual(Object.keys((await response.json())[0]).sort(),['marca','modelo','serie','tipo_equipo']);
 }
});

test('HTTP fallo interno no expone SQL ni metadatos a Terreno',async()=>{fixture={...history(),fail:true};try{for(const path of ['/bridge/activos/VALIDADOR/7490999/historial','/bridge/buscar?q=test']){const response=await request(path);assert.equal(response.status,500);assert.doesNotMatch(JSON.stringify(await response.json()),/PRIVATE_SQL|transaction/);}}finally{fixture=history();}});

test('guards de casos conservan exactamente los cinco roles administrativos previos',async()=>{const {default:router}=await import('../src/routes/requirements.routes.js');for(const path of ['/','/:id']){const route=router.stack.find(layer=>layer.route?.path===path&&layer.route.methods.get).route;for(const rol of roles){let allowed=false,status=200;route.stack[0].handle({user:{rol}},{status(code){status=code;return this;},json(){}},()=>allowed=true);assert.equal(allowed,rol!=='tecnico_terreno');assert.equal(status,rol==='tecnico_terreno'?403:200);}}});
