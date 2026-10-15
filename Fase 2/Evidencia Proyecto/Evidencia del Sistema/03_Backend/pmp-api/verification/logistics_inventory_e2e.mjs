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
  async function inventory(filters='') {
    const data=await call('/api/bodega/inventario'+filters);
    assert.equal(data.distribucion.reduce((n,r)=>n+r.total,0),data.resumen.total);
    assert.equal(data.resumen.validadores+data.resumen.consolas,data.resumen.total);
    assert.equal(data.resumen.disponibles+data.resumen.noDisponibles,data.resumen.bodega);
    assert.equal(new Set(data.items.map(a=>a.tipo_equipo+':'+a.serie)).size,data.items.length);
    return data;
  }

  async function verify(label,{orders,stock,enRuta}) {
    const assets=await inventory();assert.equal(assets.resumen.disponibles,stock);
    const dashboard=await call('/api/bodega/dashboard'),stockData=await call('/api/bodega/stock');
    const actual=(await testPool.query('SELECT count(*)::int n FROM pmp.ordenes_servicio WHERE estado_id NOT IN (8,12,13)')).rows[0].n;
    assert.equal(actual,orders);
    assert.equal(dashboard.distribucionEstados.reduce((n,row)=>n+row.value,0),actual,'Every chart value must represent an actual active OS');
    assert.ok(dashboard.distribucionEstados.every(row=>row.estado_id!==null));
    assert.equal(stockData.listos.length,stock);assert.equal(dashboard.equiposEnRuta,enRuta);
    if(orders===0)assert.deepEqual(dashboard.distribucionEstados,[]);
    cases.push({label,orders,stock,enRuta,distribution:dashboard.distribucionEstados});
  }
  await verify('Cero activos y cero OS',{orders:0,stock:0,enRuta:0});
  const asset={tipo_equipo:'VALIDADOR',serie:'7409101'};
  await call('/api/activos',{...asset,origen:'Fixture aislada de KPI',fecha_ingreso:new Date().toISOString()},201);
  const receipt=await call('/api/activos/recepcion/validar',{...asset,codigo:asset.serie,origen_captura:'MANUAL_AUTORIZADO',presencia_fisica_confirmada:true});
  await call('/api/activos/recepcion',{...asset,validacion_id:receipt.validacion.id,validacion_inicial_conforme:true},201);
  await verify('Un activo disponible sin OS',{orders:0,stock:1,enRuta:0});
  const initial=await inventory();assert.equal(initial.recientes[0].titulo,'Recepción inicial confirmada');assert.equal(initial.resumen.total,1);assert.equal(initial.resumen.bodega,1);
  assert.equal(initial.items[0].codigo_os,null);assert.equal(initial.items[0].escaneado_bodega,false);
  await testPool.query("INSERT INTO pmp.consolas(serie,modelo,marca,origen_registro,fecha_ingreso) VALUES($1,'CPV7','Fixture','Compra',now())",[asset.serie]);
  const registered=await inventory();assert.equal(registered.resumen.total,2);assert.equal(registered.resumen.consolas,1);
  assert.equal(registered.distribucion.find(d=>d.etapa==='VALIDACION').total,1);
  assert.equal((await inventory('?tipo=CONSOLA')).totalFiltrado,1);
  assert.equal((await inventory('?alcance=BODEGA')).totalFiltrado,1);
  assert.equal((await inventory('?modelo=CPV7&origen=Compra&disponibilidad=NO')).items[0].tipo_equipo,'CONSOLA');
  assert.equal((await inventory('?q=7409')).totalFiltrado,2);
  assert.equal((await inventory('?q=%25')).totalFiltrado,0);
  assert.equal((await inventory('?limit=1&offset=1')).items.length,1);
  await call('/api/bodega/inventario?limit=0',undefined,422);
  await call('/api/bodega/inventario?etapa=FAKE',undefined,422);

  const destination=(await call('/api/bodega/despacho/destinos?q=BJ'))[0];
  const context={contexto_instalacion:'NUEVA',tipo_equipo:asset.tipo_equipo,bus_ppu:destination.bus_ppu,terminal_id:destination.terminal_id,pst_codigo:destination.pst_codigo,tecnico_terreno_id:users.find(u=>u.rol==='tecnico_terreno').id};
  const validation=await call('/api/bodega/despacho/validar',{...context,codigo:asset.serie,origen_captura:'MANUAL_AUTORIZADO',presencia_fisica_confirmada:true,motivo:'Validación aislada del contador de OS'});
  await verify('Preparar y validar despacho todavía no crea OS',{orders:0,stock:1,enRuta:0});
  const dispatch=await call('/api/bodega/despacho/confirmar',{...context,validacion_id:validation.validacion.id},201);
  assert.match(dispatch.os.codigo_os,/^IN-\d{6,}$/);
  await verify('Una IN real tras confirmar despacho',{orders:1,stock:0,enRuta:1});
  assert.deepEqual(cases.at(-1).distribution,[{name:'EN_RUTA',estado_id:1,value:1}]);
  const dispatched=await inventory();assert.equal(dispatched.resumen.bodega,0);
  assert.equal(dispatched.distribucion.find(d=>d.etapa==='TRANSITO').total,1);
  assert.equal(dispatched.secundarios.instalaciones,1);
  const tech=users.find(u=>u.rol==='tecnico_laboratorio');
  const locs=(await testPool.query('select id,tipo from pmp.ubicaciones')).rows;
  // Fixtures only: verify repeated OS never multiply the master; custody stays distinct.
  const series='7409102';await testPool.query("INSERT INTO pmp.validadores(serie,modelo,marca) VALUES($1,'CVB45','Fixture')",[series]);
  const order=(await testPool.query(`INSERT INTO pmp.ordenes_servicio(tipo_equipo,validador_serie,falla,estado_id,bus_ppu,terminal_id,pst_codigo,ubicacion_id)
    VALUES('VALIDADOR',$1,'Fixture',4,'BJ2149',1,'U15',$2) RETURNING codigo_os`,[series,locs.find(l=>l.tipo==='LABORATORIO').id])).rows[0];
  await testPool.query(`INSERT INTO pmp.flujo_eventos(tipo,codigo_os,tipo_equipo,serie,metadata,usuario_id,rol) VALUES('SALIDA_BODEGA_LABORATORIO',$1,'VALIDADOR',$2,'{}',$3,'logistica')`,[order.codigo_os,series,users.find(u=>u.rol==='logistica').id]);
  assert.equal((await inventory()).distribucion.find(d=>d.etapa==='LABORATORIO').total,0);
  assert.equal((await inventory()).distribucion.find(d=>d.etapa==='TRANSITO').total,2);
  await testPool.query(`INSERT INTO pmp.flujo_eventos(tipo,codigo_os,tipo_equipo,serie,metadata,usuario_id,rol) VALUES('RECEPCION_LABORATORIO_CONFIRMADA',$1,'VALIDADOR',$2,'{}',$3,'tecnico_laboratorio')`,[order.codigo_os,series,tech.id]);
  assert.equal((await inventory()).distribucion.find(d=>d.etapa==='LABORATORIO').total,1);
  await testPool.query('UPDATE pmp.ordenes_servicio SET tecnico_laboratorio_id=$2 WHERE codigo_os=$1',[order.codigo_os,tech.id]);
  assert.equal((await inventory()).distribucion.find(d=>d.etapa==='LABORATORIO').total,1);
  await testPool.query(`INSERT INTO pmp.ordenes_servicio(tipo_equipo,validador_serie,falla,estado_id,bus_ppu,terminal_id,pst_codigo,fecha)
    VALUES('VALIDADOR',$1,'Histórica',13,'BJ2149',1,'U15',now()-interval '1 year')`,[series]);
  assert.equal((await inventory()).resumen.total,3);
  assert.equal((await inventory()).totalFiltrado,3);
  // Physically warehoused, repaired, operating and QA assets use disjoint buckets.
  async function orderFixture(serie,state,location,approved=null) {
    await testPool.query("INSERT INTO pmp.validadores(serie,modelo) VALUES($1,'CVB45')",[serie]);
    return (await testPool.query(`INSERT INTO pmp.ordenes_servicio(tipo_equipo,validador_serie,falla,estado_id,ubicacion_id,bus_ppu,terminal_id,pst_codigo,es_aprobado_qa)
      VALUES('VALIDADOR',$1,'Fixture',$2,$3,'BJ2149',1,'U15',$4) RETURNING codigo_os`,[serie,state,location,approved])).rows[0].codigo_os;
  }
  const stockOs=await orderFixture('7409103',13,locs.find(l=>l.tipo==='BODEGA').id,true);
  await orderFixture('7409104',3,locs.find(l=>l.tipo==='BODEGA').id);
  await orderFixture('7409105',12,null);
  const qaOs=await orderFixture('7409106',6,locs.find(l=>l.tipo==='QA').id);
  const cycle=(await testPool.query(`INSERT INTO pmp.flujo_eventos(tipo,codigo_os,tipo_equipo,serie,usuario_id,rol)
    VALUES('SALIDA_BODEGA_QA',$1,'VALIDADOR','7409106',$2,'logistica') RETURNING id`,[qaOs,users.find(u=>u.rol==='logistica').id])).rows[0].id;
  const beforeQa=await inventory();assert.equal(beforeQa.distribucion.find(d=>d.etapa==='QA').total,0);
  await testPool.query(`INSERT INTO pmp.flujo_eventos(tipo,codigo_os,tipo_equipo,serie,usuario_id,rol,metadata)
    VALUES('RECEPCION_QA_CONFIRMADA',$1,'VALIDADOR','7409106',$2,'qa',$3)`,[qaOs,users.find(u=>u.rol==='qa').id,{version:'3',ciclo_qa:String(cycle)}]);
  const complete=await inventory();assert.equal(complete.resumen.total,7);
  for(const etapa of ['QA','OPERACION','BODEGA','DISPONIBLE','LABORATORIO','TRANSITO','VALIDACION'])assert.equal(complete.distribucion.find(d=>d.etapa===etapa).total,1,etapa);
  assert.equal(complete.items.find(a=>a.codigo_os===stockOs).procedencia,'Reparado');
  const queue=await call('/api/bodega/queue');
  assert.equal(complete.secundarios.recepciones,queue.filter(o=>[2,11].includes(o.estado_id)).length);
  assert.equal(complete.secundarios.despachos,queue.filter(o=>o.estado_id===3).length);
  assert.equal((await inventory('?pendiente=IN')).totalFiltrado,1);
  assert.equal((await inventory('?estado=Disponible%20para%20instalaci%C3%B3n')).totalFiltrado,1);
  assert.equal((await inventory('?origen=Reparado')).totalFiltrado,1);
  // Read authorization remains the existing bodega roles.
  for(const role of ['admin','gerente','logistica','qa','tecnico_laboratorio','tecnico_terreno']) {
    const response=await fetch(base+'/api/bodega/inventario',{headers:{'x-fixture-role':role}});
    assert.equal(response.status,['admin','gerente','logistica'].includes(role)?200:403);
  }
  cases.push({label:'Identidad tipo+serie, filtros, paginación, tránsito/recepción Lab, asignación, OS histórica y permisos',passed:true});
  report={at:new Date().toISOString(),database:'ephemeral:'+fixture.port,cases,passed:true};
} finally {
  if(server){server.closeAllConnections();await new Promise(r=>server.close(r));}
  if(testPool)await testPool.end();
  try {
    if(fixture)await fixture.dispose();
    if(before)assert.deepEqual(await fingerprint(source),before,'Habitual data must remain unchanged, including 7490004');
    if(seq)assert.deepEqual(await sequences(source),seq,'Habitual sequences must remain unchanged');
    if(report){
      const {readLogisticsInventory}=await import('../src/services/logisticsInventory.js');
      const habitual=await readLogisticsInventory(source);
      report.habitualReadOnly={resumen:habitual.resumen,distribucion:habitual.distribucion,activos7490004:habitual.items.filter(a=>a.serie==='7490004'),tablesVerified:Object.keys(before).length,sequencesVerified:Object.keys(seq).length};
      save('logistics-redesign-2026-10-08/integrity.json',{before,after:await fingerprint(source),sequencesBefore:seq,sequencesAfter:await sequences(source)});
    }
  } finally {await source.end();}
}
report.habitualDataUnchanged=true;report.ephemeralRemoved=true;
save('logistics-redesign-2026-10-08/e2e.json',report);
console.log(JSON.stringify(report));
