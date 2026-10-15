import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {qaStageSql} from '../src/services/qaCustody.js';
import {qaDashboard} from '../src/services/qaWork.js';
export async function runQaCustodyScenarios({pool,call,expect,scan,baseUrl,users,report,repair,series}){
 const row=async()=>(await pool.query('SELECT * FROM pmp.ordenes_servicio WHERE codigo_os=$1',[repair])).rows[0];
 const count=async tipo=>Number((await pool.query('SELECT count(*) FROM pmp.flujo_eventos WHERE codigo_os=$1 AND tipo=$2',[repair,tipo])).rows[0].count);
 const root=`/api/qa/${repair}`;
 const detail=async()=>expect(await call('qa','GET',root+'/work'),200,'detalle QA');
 const dashboard=async etapa=>expect(await call('qa','GET',`/api/qa/dashboard?etapa=${etapa}`),200,'dashboard QA');
 const checkCounters=async()=>{
  const stages=await Promise.all(['RECEPCION','AMBIENTE','PRUEBAS','DESPACHO'].map(dashboard));
  for(const [i,stage] of ['RECEPCION','AMBIENTE','PRUEBAS','DESPACHO'].entries())assert.equal(stages[i].total,stages[i].counts[stage]||0);
  const badge=expect(await call('qa','GET','/api/dashboard/badges'),200,'badge QA');assert.equal(badge.qa,stages.reduce((sum,d)=>sum+d.total,0));
  assert.ok(stages.flatMap(d=>d.items).filter(o=>o.codigo_os===repair).length<=1);
 };
 const payload=async extra=>{const d=await detail();return {ciclo_qa:String(d.ciclo_qa||'legacy'),revision:d.revision,request_id:randomUUID(),...extra};};
 const command=async(action,extra={},actor='qa',status=200)=>expect(await call(actor,'POST',root+'/actions/'+action,await payload(extra)),status,action);
 const physicalBody={tipo_equipo:'VALIDADOR',codigo:series,origen_captura:'SCANNER',lectura_scanner:{tipo:'KEYBOARD_WEDGE',intervalos_ms:Array(series.length).fill(10)}};
 const manual={...physicalBody,origen_captura:'MANUAL_AUTORIZADO',presencia_fisica:true,motivo:'Contingencia de fixture QA aislada'};
 const physical=async(purpose,body=physicalBody,actor='qa',status=200)=>expect(await call(actor,'POST',root+'/'+purpose+'/validar',body),status,'validación QA '+purpose);
 const capture=async()=>expect(await call('logistica','POST','/api/bodega/recepcion-terreno/validar',{...physicalBody,codigo_os:repair}),200,'validación retorno Bodega');
 const receive=async()=>{const e=await capture();return expect(await call('logistica','PUT','/api/bodega/receive',{codigo_os:repair,escaneo_id:e.escaneo.id}),200,'recepción Bodega');};
 const dispatch=async()=>{const e=expect(await call('logistica','POST','/api/bodega/dispatch-qa/validar',{...physicalBody,codigo_os:repair}),200,'salida Bodega QA validar');expect(await call('logistica','PUT','/api/bodega/dispatch-qa',{codigo_os:repair,validacion_id:e.validacion.id}),200,'salida Bodega QA');};
 const initial=await row(),orders=Number((await pool.query('SELECT count(*) FROM pmp.ordenes_servicio')).rows[0].count);
 await receive();await dispatch();
 assert.equal((await row()).estado_id,6);assert.equal((await row()).ubicacion_id,null);
 await checkCounters();assert.equal((await detail()).etapa,'RECEPCION');assert.ok((await dashboard('RECEPCION')).items.some(o=>o.codigo_os===repair));
 for(const actor of ['admin','logistica','lab']){
  expect(await call(actor,'POST',root+'/actions/tomar',await payload({})),403,'otros roles no operan QA');
  await physical('recepcion',manual,actor,403);
 }
 expect(await call('admin','PUT','/api/qa/assign',{codigo_os:repair,qa_usuario_id:users.qa.id}),403,'Admin no asigna');
 expect(await call('qa','PUT','/api/qa/assign',{codigo_os:repair,qa_usuario_id:users.qa.id}),410,'sin vía de asignación antigua');
 expect(await call('qa','POST','/api/qa/process',{codigo_os:repair,accion:'APROBAR'}),410,'sin dictamen antiguo');
 expect(await call('qa','POST','/api/qa/start',{codigo_os:repair}),410,'sin inicio antiguo');
 for(const station of ['QA',' qa '])expect(await call('qa','POST','/api/equipment-scan/confirm',{codigo:series,estacion:station,lectura_scanner:physicalBody.lectura_scanner}),409,'scanner genérico no confirma QA');
 for(const action of ['iniciar','tomar','ambiente-iniciar','prueba','dictamen'])await command(action,{},'qa',409);
 await physical('recepcion',{...physicalBody,lectura_scanner:undefined},'qa',422);
 assert.equal((await physical('recepcion',{...manual,codigo:'INCORRECTO'})).coincide,false);
 await physical('recepcion',{...manual,presencia_fisica:false},'qa',422);
 const receipt=await physical('recepcion',manual);
 assert.equal((await row()).ubicacion_id,null,'validar no recibe');
 const replay=await payload({validacion_id:receipt.validacion_id,confirmacion:true});
 const receptions=await Promise.all([1,2].map(()=>call('qa','POST',root+'/actions/recepcion',replay)));
 assert.ok(receptions.every(r=>r.status===200));assert.equal(await count('RECEPCION_QA_CONFIRMADA'),1);
 await checkCounters();let d=await detail();assert.equal(d.etapa,'AMBIENTE');assert.equal(d.trabajo.responsable,null);assert.ok(d.fecha_recepcion_qa);
 const firstCycle=d.ciclo_qa;const receiptDate=d.fecha_recepcion_qa;
 for(const q of [repair,series,(await row()).bus_ppu])assert.ok(expect(await call('qa','GET',`/api/qa/dashboard?etapa=AMBIENTE&q=${encodeURIComponent(q)}`),200,'búsqueda QA en servidor').items.some(t=>t.codigo_os===repair));
 expect(await call('qa','POST',root+'/actions/recepcion',{...replay,confirmacion:false}),409,'mismo id diferente payload');
 const take=await payload({});const races=await Promise.all(['qa','qa2'].map(actor=>call(actor,'POST',root+'/actions/iniciar',{...take,request_id:randomUUID()})));
 assert.deepEqual(races.map(r=>r.status).sort(),[200,409]);
 d=await detail();const owner=d.trabajo.responsable.id===users.qa.id?'qa':'qa2',other=owner==='qa'?'qa2':'qa';
 assert.equal(d.trabajo.ambiente.estado,'EN_CURSO');
 assert.equal(await count('QA_TRABAJO_TOMADO'),1);assert.equal(await count('QA_AMBIENTE_INICIADO'),1);
 await command('ambiente-iniciar',{},other,403);
 const startEvent=(await pool.query("SELECT metadata FROM pmp.flujo_eventos WHERE codigo_os=$1 AND tipo='QA_AMBIENTE_INICIADO' ORDER BY id DESC LIMIT 1",[repair])).rows[0];
 const startReplay={...take,request_id:startEvent.metadata.request_id};
 expect(await call(owner,'POST',root+'/actions/iniciar',startReplay),200,'inicio combinado idempotente');
 assert.equal(await count('QA_TRABAJO_TOMADO'),1);assert.equal(await count('QA_AMBIENTE_INICIADO'),1);
 await command('prueba',{metodo:'Manual',resultado:'APROBADA'},owner,409);
 const stale=await payload({observacion:'Nota vieja'});await command('ambiente-guardar',{observacion:'Avance persistido'},owner);
 assert.equal((await detail()).trabajo.ambiente.observacion,'Avance persistido');
 expect(await call(owner,'POST',root+'/actions/ambiente-guardar',stale),409,'versión entre pestañas');
 await command('ambiente-completar',{observacion:'Hito realizado',confirmacion:true},owner);
 await checkCounters();assert.equal((await detail()).etapa,'PRUEBAS');
 await command('dictamen',{resultado:'OPERATIVO',confirmacion:true},owner,409);
 await command('prueba',{metodo:'Manual',resultado:'PENDIENTE',observacion:'Borrador QA'},owner);
 d=await detail();assert.equal(d.trabajo.pruebas[0].resultado,'PENDIENTE');assert.equal(d.trabajo.dictamen,null);
 await command('dictamen',{resultado:'OPERATIVO',confirmacion:true},owner,409);
 await command('prueba',{prueba_id:d.trabajo.pruebas[0].id,metodo:'Manual',resultado:'RECHAZADA',observacion:'El QR continúa fallando'},owner);
 await command('dictamen',{resultado:'OPERATIVO',confirmacion:true},owner,409);
 await command('dictamen',{resultado:'RECHAZADO',confirmacion:true},owner,422);
 const verdict=await payload({resultado:'RECHAZADO',motivo:'Lectura QR intermitente. Revisar conexión del lector.',confirmacion:true});
 expect(await call(owner,'POST',root+'/actions/dictamen',verdict),200,'dictamen rechazo');expect(await call(owner,'POST',root+'/actions/dictamen',verdict),200,'reintento mismo dictamen');
 assert.equal(await count('QA_DICTAMEN_CONFIRMADO'),1);assert.equal((await row()).estado_id,6);assert.notEqual((await row()).ubicacion_id,null);assert.equal((await row()).es_aprobado_qa,null);
 await checkCounters();assert.equal((await detail()).etapa,'DESPACHO');assert.equal((await detail()).fecha_recepcion_qa,receiptDate);
 await command('dictamen',{resultado:'OPERATIVO',confirmacion:true},owner,409);
 await command('despacho',{validacion_id:receipt.validacion_id,confirmacion:true},'qa',409);
 const exit=await physical('despacho',physicalBody,other);
 await command('despacho',{validacion_id:exit.validacion_id,confirmacion:true,destino:'LABORATORIO'},other,409);
 const exitPayload=await payload({validacion_id:exit.validacion_id,confirmacion:true});
 expect(await call(other,'POST',root+'/actions/despacho',exitPayload),200,'salida QA');expect(await call(other,'POST',root+'/actions/despacho',exitPayload),200,'reintento salida QA');
 assert.equal(await count('SALIDA_QA_BODEGA'),1);assert.equal((await row()).estado_id,11);assert.equal((await row()).ubicacion_id,null);assert.equal((await row()).es_aprobado_qa,false);
 assert.ok(!(await dashboard('DESPACHO')).items.some(o=>o.codigo_os===repair));assert.ok((await dashboard('HISTORIAL')).items.some(o=>o.codigo_os===repair));
 await checkCounters();const bodegaEvidence=await capture();const bodegaBody={codigo_os:repair,escaneo_id:bodegaEvidence.escaneo.id};
 const returns=await Promise.all([1,2].map(()=>call('logistica','PUT','/api/bodega/receive',bodegaBody)));assert.ok(returns.every(r=>r.status===200));assert.equal((await row()).estado_id,3);
 expect(await call('logistica','POST','/api/bodega/dispatch-qa/validar',{...physicalBody,codigo_os:repair}),409,'rechazado no vuelve directo QA');
 const labEvidence=expect(await call('logistica','POST','/api/bodega/dispatch-lab/validar',{...physicalBody,codigo_os:repair}),200,'reingreso lab');
 expect(await call('logistica','PUT','/api/bodega/dispatch-lab',{codigo_os:repair,validacion_id:labEvidence.validacion.id}),200,'salida lab');
 expect(await call('jefe_laboratorio','PUT','/api/lab/assign',{codigo_os:repair,tecnico_id:users.lab.id}),409,'laboratorio exige recepción nueva');
 await scan(baseUrl,'jefe_laboratorio',series,'LABORATORIO');
 expect(await call('jefe_laboratorio','PUT','/api/lab/assign',{codigo_os:repair,tecnico_id:users.lab.id}),200,'asignar nuevo ciclo laboratorio');
 const work=expect(await call('lab','GET',`/api/lab/work/${repair}`),200,'antecedentes rechazo');
 assert.equal(work.antecedentes_qa.trabajo.dictamen.resultado,'RECHAZADO');assert.equal(work.trabajo,null,'no reutilizar cierre anterior');
 expect(await call('lab','PUT','/api/lab/move',{codigo_os:repair,nuevo_estado_id:5}),200,'reparación nueva');
 expect(await call('lab','POST','/api/lab/finish',{codigo_os:repair,trabajo:{diagnostico:{resultado:'CONFIRMADA',falla_real:'QR tras rechazo'},acciones:['Limpieza Interna'],pruebas:[{nombre:'Test MK',resultado:'APROBADA'}],resultado:'REPARADO'}}),200,'cierre técnico nuevo');
 const labExit=expect(await call('jefe_laboratorio','POST',`/api/lab/custody/${repair}/SALIDA/validar`,physicalBody),200,'validación salida Lab');
 expect(await call('jefe_laboratorio','POST',`/api/lab/custody/${repair}/SALIDA/confirmar`,{validacion_id:labExit.validacion.id}),200,'retorno Bodega');await receive();await dispatch();
 d=await detail();assert.equal(d.etapa,'RECEPCION');assert.ok((await dashboard('HISTORIAL')).items.some(o=>o.codigo_os===repair&&String(o.ciclo_qa)===String(firstCycle)));
 const historic=expect(await call('qa','GET',root+'/work?ciclo='+firstCycle),200,'histórico inmutable durante nuevo ciclo');assert.equal(historic.etapa,'HISTORIAL');assert.equal(historic.trabajo.dictamen.resultado,'RECHAZADO');
 assert.equal(d.trabajo.dictamen,null);assert.equal(d.trabajo.pruebas.length,0);assert.equal(d.trabajo.ambiente.estado,'PENDIENTE');
 expect(await call('qa','POST',root+'/actions/recepcion',replay),409,'ciclo previo no habilita recepción');
 const second=await physical('recepcion',physicalBody,'qa2');await command('recepcion',{validacion_id:second.validacion_id,confirmacion:true},'qa2');
 await command('iniciar');await command('ambiente-completar',{observacion:'Preparación ciclo nuevo',confirmacion:true});
 await command('prueba',{metodo:'Test MK',resultado:'RECHAZADA',observacion:'Primer intento fallido'});
 const failed=(await detail()).trabajo.pruebas[0];await command('prueba',{prueba_id:failed.id,metodo:'Test MK',resultado:'APROBADA'},'qa',409);
 const beforeAtomic=await detail(),testEvents=await count('QA_PRUEBA_GUARDADA');
 await command('dictamen',{resultado:'OPERATIVO',confirmacion:true,prueba:{metodo:'Test MK',resultado:'RECHAZADA'}},'qa',409);
 assert.deepEqual((await detail()).trabajo,beforeAtomic.trabajo,'invalid verdict rolls back draft');
 assert.equal(await count('QA_PRUEBA_GUARDADA'),testEvents);
 await command('dictamen',{resultado:'RECHAZADO',confirmacion:true,prueba:{metodo:'Test MK',resultado:'APROBADA'}},'qa',422);
 assert.equal(await count('QA_PRUEBA_GUARDADA'),testEvents,'missing rejection reason persists neither test nor verdict');
 const combined=await payload({resultado:'OPERATIVO',confirmacion:true,prueba:{metodo:'Test MK',resultado:'APROBADA',observacion:'Nueva ejecución satisfactoria'}});
 const attempts=await Promise.all([1,2].map(()=>call('qa','POST',root+'/actions/dictamen',combined)));
 assert.ok(attempts.every(r=>r.status===200));
 expect(await call('qa','POST',root+'/actions/dictamen',combined),200,'lost response retry does not duplicate test');
 assert.equal(await count('QA_PRUEBA_GUARDADA'),testEvents+1);
 assert.equal(await count('QA_DICTAMEN_CONFIRMADO'),2);
 const atomicHistory=(await detail()).historial.filter(e=>e.metadata.comando_id===combined.request_id||e.metadata.request_id===combined.request_id);
 assert.deepEqual(atomicHistory.map(e=>e.tipo),['QA_DICTAMEN_CONFIRMADO','QA_PRUEBA_GUARDADA']);
 assert.equal((await row()).estado_id,6);assert.equal((await row()).es_aprobado_qa,null);
 d=await detail();assert.equal(d.trabajo.pruebas.length,2);assert.equal(d.trabajo.pruebas[0].resultado,'RECHAZADA');
 assert.ok(!expect(await call('logistica','GET','/api/bodega/stock'),200,'inventario antes de salida').listos.some(o=>o.codigo_os===repair));
 const out=await physical('despacho',manual,'qa2');await command('despacho',{validacion_id:out.validacion_id,confirmacion:true},'qa2');
 assert.equal((await row()).estado_id,11);assert.ok(!expect(await call('logistica','GET','/api/bodega/stock'),200,'inventario en tránsito').listos.some(o=>o.codigo_os===repair));
 assert.equal((await row()).tecnico_laboratorio_id,initial.tecnico_laboratorio_id);assert.equal(Number((await pool.query('SELECT count(*) FROM pmp.ordenes_servicio')).rows[0].count),orders);
 // Legacy fixtures are rolled back; no evidence is manufactured for source records.
 const legacy=await pool.connect();try{await legacy.query('BEGIN');await legacy.query("INSERT INTO pmp.validadores(serie,modelo) VALUES('QA-LEGACY-TEST','CVB45')");
 const old=(await legacy.query(`INSERT INTO pmp.ordenes_servicio(tipo_equipo,validador_serie,falla,estado_id,ubicacion_id,bus_ppu,terminal_id,pst_codigo)
 SELECT tipo_equipo,'QA-LEGACY-TEST','Legacy fixture',6,3,bus_ppu,terminal_id,pst_codigo FROM pmp.ordenes_servicio WHERE codigo_os=$1 RETURNING codigo_os`,[repair])).rows[0].codigo_os;
 assert.equal((await legacy.query(`SELECT ${qaStageSql()} etapa FROM pmp.ordenes_servicio o WHERE codigo_os=$1`,[old])).rows[0].etapa,'POR_VERIFICAR');
 for(let i=0;i<22;i++){
  const asset='QA-LEGACY-PAGE-'+String(i).padStart(2,'0');
  await legacy.query("INSERT INTO pmp.validadores(serie,modelo) VALUES($1,'CVB45')",[asset]);
  await legacy.query(`INSERT INTO pmp.ordenes_servicio(tipo_equipo,validador_serie,falla,estado_id,ubicacion_id,bus_ppu,terminal_id,pst_codigo)
   SELECT tipo_equipo,$2,'QA pagination fixture',6,3,bus_ppu,terminal_id,pst_codigo FROM pmp.ordenes_servicio WHERE codigo_os=$1`,[repair,asset]);
 }
 const first=await qaDashboard(legacy,{etapa:'POR_VERIFICAR',q:'QA-LEGACY-PAGE',page:1}),secondPage=await qaDashboard(legacy,{etapa:'POR_VERIFICAR',q:'QA-LEGACY-PAGE',page:2});
 assert.equal(first.total,22);assert.equal(first.items.length,20);assert.equal(secondPage.items.length,2);
 const outsideFirst=secondPage.items[0];assert.equal((await qaDashboard(legacy,{etapa:'POR_VERIFICAR',q:outsideFirst.serie,page:1})).items[0].codigo_os,outsideFirst.codigo_os,'search occurs before pagination');
 await legacy.query(`INSERT INTO pmp.escaneos_equipos(codigo_leido,tipo_codigo,estacion,tipo_equipo,serie,codigo_os,ubicacion_id,usuario_id,rol,resultado)
  VALUES('QA-LEGACY-TEST','SERIE','QA','VALIDADOR','QA-LEGACY-TEST',$1,3,$2,'qa','VALIDADO')`,[old,users.qa.id]);
 assert.equal((await legacy.query(`SELECT ${qaStageSql()} etapa FROM pmp.ordenes_servicio o WHERE codigo_os=$1`,[old])).rows[0].etapa,'AMBIENTE','real historical receipt is preserved, not fabricated');

 }finally{await legacy.query('ROLLBACK');legacy.release();}
 await capture(); // caller performs the final Bodega receipt and existing stock/IN assertions.
 report.steps.push({action:'QA autónomo: permisos, recepción propia, toma concurrente, ambiente, pruebas persistidas, versiones, dos dictámenes, salida separada, retorno/reingreso, legacy y reintentos',ok:true});
}
