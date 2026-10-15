// Disposable PostgreSQL instance: schema/configuration read only from the habitual DB; all writes isolated.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {pool,backend,sourceEnv,fingerprint,sequences,sourceUrl,initialCounts,operational,save} from '../tools/database-tools.mjs';
import {emptyFixtureDatabase} from '../tools/ephemeral-postgres.mjs';
const source=pool(sourceUrl(),true);let fixture,testPool,server,report;
try{
 const sourceBefore=await fingerprint(source),sourceSeq=await sequences(source);
 fixture=await emptyFixtureDatabase();const name='ephemeral:'+fixture.port;
 Object.assign(process.env,sourceEnv(),{DATABASE_URL:fixture.url});process.chdir(backend);
 const {default:app}=await import('../src/app.js');const db=await import('../src/db.js');testPool=db.pool;
 await testPool.query('DELETE FROM pmp.usuarios');
 for(const rol of ['admin','jefe_laboratorio','logistica','tecnico_terreno','tecnico_laboratorio','qa','gerente'])await testPool.query(
  'INSERT INTO pmp.usuarios(id,nombre,apellido,correo,rol,activo,firebase_uid) VALUES($1,$2,$3,$4,$5,true,$6)',
  [randomUUID(),'Fixture',rol,rol+'@pmp-suite.test',rol,'isolated-'+rol]);
 const users=(await testPool.query('SELECT * FROM pmp.usuarios')).rows;
 const qa2=(await testPool.query("INSERT INTO pmp.usuarios(id,nombre,apellido,correo,rol,activo,firebase_uid) VALUES($1,'QA','Segundo','qa2@pmp-suite.test','qa',true,'isolated-qa2') RETURNING *",[randomUUID()])).rows[0];users.push({...qa2,fixtureKey:'qa2'});
 // This test process has no externally accessible auth bypass; habitual API is untouched.
 for(const layer of app._router.stack){for(const middleware of layer.handle?.stack||[]){if(middleware.handle?.name==='firebaseAuthMiddleware')middleware.handle=(req,res,next)=>{const user=users.find(u=>(u.fixtureKey||u.rol)===req.get('x-fixture-role'));if(!user)return res.status(401).json({error:'Fixture role missing'});req.firebase={uid:user.firebase_uid,email:user.correo};next();};}}
 server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const base='http://127.0.0.1:'+server.address().port;

 const results={at:new Date().toISOString(),database:name,startsWithZeroOperations:true,checks:[]};
 const user=rol=>users.find(u=>u.rol===rol);
 async function call(path,body,expected=200,role='logistica'){
  const r=await fetch(base+path,{method:body===undefined?'GET':'POST',headers:{'x-fixture-role':role,'Content-Type':'application/json'},...(body!==undefined?{body:JSON.stringify(body)}:{})});
  const data=await r.json();assert.equal(r.status,expected,path+' '+JSON.stringify(data));return data;
 }
 const n=async table=>Number((await testPool.query(`SELECT count(*) n FROM pmp.${table}`)).rows[0].n);
 const dest=(await call('/api/bodega/despacho/destinos?q=BJ'))[0];assert.equal(dest.bus_ppu,'BJ2149');assert.equal(dest.operador,'VOYSANTIAGO');
 const asset={tipo_equipo:'VALIDADOR',serie:'7408001'};
 const ctx={contexto_instalacion:'NUEVA',tipo_equipo:asset.tipo_equipo,bus_ppu:dest.bus_ppu,terminal_id:dest.terminal_id,pst_codigo:dest.pst_codigo,tecnico_terreno_id:user('tecnico_terreno').id};
 const register=async serie=>call('/api/activos',{...asset,serie,modelo:'CVB45',marca:'Mikroelektronika',origen:'Ensayo aislado',fecha_ingreso:new Date().toISOString()},201);
 const reception=async serie=>{
  const v=await call('/api/activos/recepcion/validar',{...asset,serie,codigo:serie,origen_captura:'MANUAL_AUTORIZADO',presencia_fisica_confirmada:true});
  return call('/api/activos/recepcion',{...asset,serie,validacion_id:v.validacion.id,validacion_inicial_conforme:true},201);
 };
 const scanBody={...ctx,codigo:asset.serie,origen_captura:'SCANNER',lectura_scanner:{tipo:'KEYBOARD_WEDGE',intervalos_ms:Array(7).fill(10)}};
 await register(asset.serie);assert.equal(await n('ordenes_servicio'),0);assert.equal((await call('/api/bodega/stock')).listos.length,0);
 await call('/api/bodega/despacho/validar',scanBody,409);
 const receptionResult=await reception(asset.serie);assert.equal(await n('ordenes_servicio'),0);assert.equal(await n('casos_operacionales'),0);assert.equal(await n('qa_inspecciones'),0);
 assert.equal((await call('/api/bodega/stock')).listos.length,1);results.checks.push('Alta y recepción conformes: un activo, cero OS/casos/QA');
 await call('/api/bodega/despacho/validar',{...scanBody,lectura_scanner:undefined},422);
 await call('/api/bodega/despacho/validar',{...scanBody,codigo:'UNKNOWN'},404);
 await call('/api/bodega/despacho/validar',{...scanBody,tipo_equipo:'CONSOLA'},409);
 await call('/api/bodega/despacho/validar',{...scanBody,caso_id:'1'},422);
 await call('/api/bodega/despacho/validar',{...scanBody,contexto_instalacion:'REQUERIMIENTO'},422);
 await call('/api/bodega/despacho/validar',{...scanBody,tecnico_terreno_id:user('qa').id},422);
 await call('/api/bodega/despacho/validar',{...scanBody,bus_ppu:'NOEXISTE'},422);
 await call('/api/bodega/despacho/validar',scanBody,403,'tecnico_terreno');
 const manual=await call('/api/bodega/despacho/validar',{...ctx,codigo:asset.serie,origen_captura:'MANUAL_AUTORIZADO',presencia_fisica_confirmada:true,motivo:'Sin lector durante ensayo'});
 assert.ok(manual.validacion.id);assert.equal(manual.equipo.modelo,'CVB45');assert.equal(manual.escaneo,null);
 const validation=await call('/api/bodega/despacho/validar',scanBody);
 assert.equal(await n('ordenes_servicio'),0);assert.equal(await n('casos_operacionales'),0);
 assert.equal((await call('/api/bodega/stock')).listos.length,1);
 assert.equal((await testPool.query("SELECT count(*)::int n FROM pmp.flujo_eventos WHERE tipo='SALIDA_BODEGA_TERRENO'")).rows[0].n,0);
 const payload={...ctx,escaneo_id:validation.escaneo.id};
 const otherTech=randomUUID();await testPool.query("INSERT INTO pmp.usuarios(id,nombre,apellido,correo,rol,activo) VALUES($1,'Otro','Fixture','otro@pmp-suite.test','tecnico_terreno',true)",[otherTech]);
 await call('/api/bodega/despacho/confirmar',{...payload,tecnico_terreno_id:otherTech},409);
 await call('/api/bodega/despacho/confirmar',{...ctx,validacion_id:manual.validacion.id},409);
 await call('/api/bodega/despacho/confirmar',{...payload,terminal_id:999},422);
 await testPool.query(`CREATE FUNCTION pmp.initial_test_rollback() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.tipo='SALIDA_BODEGA_TERRENO' THEN RAISE EXCEPTION 'Isolated rollback'; END IF; RETURN NEW; END $$;
 CREATE TRIGGER initial_test_rollback BEFORE INSERT ON pmp.flujo_eventos FOR EACH ROW EXECUTE FUNCTION pmp.initial_test_rollback()`);
 await call('/api/bodega/despacho/confirmar',payload,500);
 assert.equal(await n('ordenes_servicio'),0);assert.equal((await call('/api/bodega/stock')).listos.length,1);
 await testPool.query('DROP TRIGGER initial_test_rollback ON pmp.flujo_eventos; DROP FUNCTION pmp.initial_test_rollback()');
 const responses=await Promise.all([call('/api/bodega/despacho/confirmar',payload,201),call('/api/bodega/despacho/confirmar',payload,201)]);
 const os=responses[0].os;assert.equal(os.codigo_os,responses[1].os.codigo_os);assert.match(os.codigo_os,/^IN-\d{6,}$/);
 assert.equal(os.caso_id,null);assert.equal(os.os_origen,null);assert.equal(os.stock_origen_os,null);assert.equal(os.stock_origen_evento,receptionResult.stock_origen_evento);
 assert.equal(await n('ordenes_servicio'),1);assert.equal(await n('casos_operacionales'),0);assert.equal((await call('/api/bodega/stock')).listos.length,0);
 assert.equal((await call('/api/dashboard/summary',undefined,200,'admin')).kpis.totalEnRuta,1);
 assert.equal((await call('/api/dashboard/equipos-operativos',undefined,200,'admin')).data.length,0);
 assert.equal((await call('/api/bodega/despacho/confirmar',payload,201)).os.codigo_os,os.codigo_os);
 await call('/api/bodega/despacho/confirmar',{...payload,contexto_instalacion:'REQUERIMIENTO'},422);
 await call('/api/bodega/despacho/confirmar',{...payload,tecnico_terreno_id:otherTech},409);
 results.checks.push('Confirmación atómica, rollback, concurrencia/reintento: una IN independiente sin caso previo');
 const mine=(await call('/api/os/mis-ordenes',undefined,200,'tecnico_terreno')).find(o=>o.codigo_os===os.codigo_os);
 assert.equal(mine.estado_nombre,'EN_RUTA');assert.equal(mine.referencia_externa,null);assert.equal(mine.modelo,'CVB45');assert.equal(mine.operador,'VOYSANTIAGO');
 await call('/api/os/completar-instalacion',{codigo_os:os.codigo_os,operativo:true,bus_ppu:'DISTINTO'},409,'tecnico_terreno');
 await call('/api/os/completar-instalacion',{codigo_os:os.codigo_os,operativo:true,bus_ppu:dest.bus_ppu},200,'tecnico_terreno');
 const operating=await call('/api/requerimientos/operativos?tipo_equipo=VALIDADOR&q=7408001');assert.equal(operating.items.length,1);assert.equal(operating.items[0].bus_ppu,dest.bus_ppu);
 assert.equal((await call('/api/dashboard/summary',undefined,200,'admin')).kpis.totalEnRuta,0);
 const failure=await call('/api/requerimientos',{...asset,origen:'INTERNO',bus_ppu:dest.bus_ppu,terminal_id:dest.terminal_id,pst_codigo:dest.pst_codigo,falla:'Falla QR de prueba',clasificacion:'MANTENCION',fecha_requerimiento:new Date().toISOString()},201);
 assert.match(failure.os.codigo_os,/^MV-/);assert.equal(await n('validadores'),1);assert.equal(await n('ordenes_servicio'),2);
 const history=await call('/api/bridge/activos/VALIDADOR/7408001/historial',undefined,200,'admin');
 for(const type of ['ALTA_ACTIVO','RECEPCION_INICIAL','HABILITADO_INSTALACION','SALIDA_BODEGA_TERRENO','INSTALACION_COMPLETADA'])assert.ok(history.eventos.some(e=>e.tipo===type),type);
 results.firstJourney={asset:asset.serie,firstInstallation:os.codigo_os,firstMaintenance:failure.os.codigo_os,assets:1,orders:2,cases:1,operatingInstallations:1};
 results.checks.push('Mis Órdenes sin MV/AR, instalación operativa y primera MV legítima con historial conservado');
 // Additional independent negative fixture AFTER the one-asset-from-zero journey.
 await register('7408002');await reception('7408002');
 await call('/api/bodega/despacho/validar',{...scanBody,codigo:'7408002'},409);
 results.checks.push('Nueva instalación bloquea posición del mismo tipo ocupada, sin retirar al activo anterior');

 const consoleAsset={tipo_equipo:'CONSOLA',serie:'9715A0099'};
 await call('/api/activos',{...consoleAsset,modelo:'N9715',origen:'Ensayo aislado posterior',fecha_ingreso:new Date().toISOString()},201);
 const consoleReception=await call('/api/activos/recepcion/validar',{...consoleAsset,codigo:consoleAsset.serie,origen_captura:'MANUAL_AUTORIZADO',presencia_fisica_confirmada:true});
 await call('/api/activos/recepcion',{...consoleAsset,validacion_id:consoleReception.validacion.id,validacion_inicial_conforme:true},201);
 const consoleContext={...ctx,tipo_equipo:'CONSOLA'};
 await call('/api/bodega/despacho/confirmar',{...consoleContext,validacion_id:consoleReception.validacion.id},409);
 const consoleValidation=await call('/api/bodega/despacho/validar',{...consoleContext,codigo:consoleAsset.serie,origen_captura:'MANUAL_AUTORIZADO',presencia_fisica_confirmada:true,motivo:'Contingencia aislada'});
 const manualSent=await call('/api/bodega/despacho/confirmar',{...consoleContext,validacion_id:consoleValidation.validacion.id},201);
 assert.equal((await call('/api/os/mis-ordenes',undefined,200,'tecnico_terreno')).find(o=>o.codigo_os===manualSent.os.codigo_os).estado_nombre,'EN_RUTA');
 const captured=(await testPool.query("SELECT metadata FROM pmp.flujo_eventos WHERE codigo_os=$1 AND tipo='SALIDA_BODEGA_TERRENO'",[manualSent.os.codigo_os])).rows[0];
 assert.equal(captured.metadata.origen_captura,'MANUAL_AUTORIZADO');assert.equal(captured.metadata.escaneo_id,undefined);
 results.checks.push('Contingencia manual nueva sin caso conserva En ruta y auditoría; recepción inicial no sirve como despacho');
 if(process.argv.includes('--consolidation')){
  const {consolidationScenarios}=await import('./consolidation_scenarios.mjs');
  await consolidationScenarios({pool:testPool,base,users,order:failure.os.codigo_os,asset,ctx,results});
 }
 assert.deepEqual(await fingerprint(source),sourceBefore);assert.deepEqual(await sequences(source),sourceSeq);
 results.passed=true;results.originalUnchanged=true;report=results;
}finally{
 if(server)await new Promise(r=>server.close(r));if(testPool)await testPool.end();await source.end();
 if(fixture)await fixture.dispose();
}

save('initial-install-e2e.json',report);console.log(JSON.stringify({...report,ephemeralRemoved:true}));
