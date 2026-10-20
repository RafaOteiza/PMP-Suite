// Dashboard read-model regression. All operational writes use a disposable PostgreSQL instance.
import assert from 'node:assert/strict';
import {pool,backend,sourceEnv,sourceUrl,fingerprint,sequences,save} from '../tools/database-tools.mjs';
import {emptyFixtureDatabase} from '../tools/ephemeral-postgres.mjs';

const source=pool(sourceUrl(),true);
let fixture,testPool,server,before,seq,report;
try {
  before=await fingerprint(source);seq=await sequences(source);
  fixture=await emptyFixtureDatabase();
  Object.assign(process.env,sourceEnv(),{DATABASE_URL:fixture.url});process.chdir(backend);
  const {default:app}=await import('../src/app.js');
  testPool=(await import('../src/db.js')).pool;
  assert.equal(Number((await testPool.query('select inet_server_port() port')).rows[0].port),fixture.port);
  assert.notEqual(fixture.port,5432);
  const users=(await testPool.query('SELECT * FROM pmp.usuarios')).rows;
  // Actors are simulated in this private test server only; no Firebase login or production bypass.
  for(const layer of app._router.stack)for(const middleware of layer.handle?.stack||[]) {
    if(middleware.handle?.name==='firebaseAuthMiddleware')middleware.handle=(req,res,next)=>{
      const user=users.find(u=>u.rol===req.get('x-fixture-role'));
      if(!user)return res.status(401).json({error:'Fixture role missing'});
      req.firebase={uid:user.firebase_uid,email:user.correo};next();
    };
  }
  server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
  const base='http://127.0.0.1:'+server.address().port;
  async function call(path,body,expected=200) {
    const response=await fetch(base+path,{method:body===undefined?'GET':'POST',headers:{'x-fixture-role':'logistica','Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});
    const data=await response.json();assert.equal(response.status,expected,path+' '+JSON.stringify(data));return data;
  }
  const cases=[];
  async function verify(label,{orders,stock,enRuta}) {
    const dashboard=await call('/api/bodega/dashboard'),inventory=await call('/api/bodega/stock');
    const actual=(await testPool.query('SELECT count(*)::int n FROM pmp.ordenes_servicio WHERE estado_id NOT IN (8,12,13)')).rows[0].n;
    assert.equal(actual,orders);
    assert.equal(dashboard.distribucionEstados.reduce((n,row)=>n+row.value,0),actual,'Every chart value must represent an actual active OS');
    assert.ok(dashboard.distribucionEstados.every(row=>row.estado_id!==null));
    assert.equal(inventory.listos.length,stock);assert.equal(dashboard.equiposEnRuta,enRuta);
    if(orders===0)assert.deepEqual(dashboard.distribucionEstados,[]);
    cases.push({label,orders,stock,enRuta,distribution:dashboard.distribucionEstados});
  }
  await verify('Cero activos y cero OS',{orders:0,stock:0,enRuta:0});
  const asset={tipo_equipo:'VALIDADOR',serie:'7409101'};
  await call('/api/activos',{...asset,origen:'Fixture aislada de KPI',fecha_ingreso:new Date().toISOString()},201);
  const receipt=await call('/api/activos/recepcion/validar',{...asset,codigo:asset.serie,origen_captura:'MANUAL_AUTORIZADO',presencia_fisica_confirmada:true});
  await call('/api/activos/recepcion',{...asset,validacion_id:receipt.validacion.id,validacion_inicial_conforme:true},201);
  await verify('Un activo disponible sin OS',{orders:0,stock:1,enRuta:0});
  const destination=(await call('/api/bodega/despacho/destinos?q=BJ'))[0];
  const context={contexto_instalacion:'NUEVA',tipo_equipo:asset.tipo_equipo,bus_ppu:destination.bus_ppu,terminal_id:destination.terminal_id,pst_codigo:destination.pst_codigo,tecnico_terreno_id:users.find(u=>u.rol==='tecnico_terreno').id};
  const validation=await call('/api/bodega/despacho/validar',{...context,codigo:asset.serie,origen_captura:'MANUAL_AUTORIZADO',presencia_fisica_confirmada:true,motivo:'Validación aislada del contador de OS'});
  await verify('Preparar y validar despacho todavía no crea OS',{orders:0,stock:1,enRuta:0});
  const dispatch=await call('/api/bodega/despacho/confirmar',{...context,validacion_id:validation.validacion.id},201);
  assert.match(dispatch.os.codigo_os,/^IN-\d{6,}$/);
  await verify('Una IN real tras confirmar despacho',{orders:1,stock:0,enRuta:1});
  assert.deepEqual(cases.at(-1).distribution,[{name:'EN_RUTA',estado_id:1,value:1}]);
  report={at:new Date().toISOString(),database:'ephemeral:'+fixture.port,cases,passed:true};
} finally {
  if(server){server.closeAllConnections();await new Promise(r=>server.close(r));}
  if(testPool)await testPool.end();
  try {
    if(fixture)await fixture.dispose();
    if(before)assert.deepEqual(await fingerprint(source),before,'Habitual data must remain unchanged, including 7490004');
    if(seq)assert.deepEqual(await sequences(source),seq,'Habitual sequences must remain unchanged');
  } finally {await source.end();}
}
report.habitualDataUnchanged=true;report.ephemeralRemoved=true;
save('navigation-kpi-2026-10-08/e2e.json',report);
console.log(JSON.stringify(report));
