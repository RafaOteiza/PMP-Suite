// Disposable PostgreSQL instance: schema/configuration read only from the habitual DB; all writes isolated.
import assert from 'node:assert/strict';
import {pool,backend,sourceEnv,fingerprint,sequences,sourceUrl,initialCounts,operational,save} from '../tools/database-tools.mjs';
import {emptyFixtureDatabase} from '../tools/ephemeral-postgres.mjs';
const source=pool(sourceUrl(),true);let fixture,testPool,server,report;
try{
 const sourceBefore=await fingerprint(source),sourceSeq=await sequences(source);
 fixture=await emptyFixtureDatabase();const name='ephemeral:'+fixture.port;
 Object.assign(process.env,sourceEnv(),{DATABASE_URL:fixture.url});process.chdir(backend);
 const {default:app}=await import('../src/app.js');const db=await import('../src/db.js');testPool=db.pool;
 const users=(await testPool.query('SELECT * FROM pmp.usuarios')).rows;
 // This test process has no externally accessible auth bypass; habitual API is untouched.
 for(const layer of app._router.stack){for(const middleware of layer.handle?.stack||[]){if(middleware.handle?.name==='firebaseAuthMiddleware')middleware.handle=(req,res,next)=>{const user=users.find(u=>u.rol===req.get('x-fixture-role'));if(!user)return res.status(401).json({error:'Fixture role missing'});req.firebase={uid:user.firebase_uid,email:user.correo};next();};}}
 server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const base='http://127.0.0.1:'+server.address().port;
 const results={at:new Date().toISOString(),database:name,auth:'Firebase context mocked only in disposable test process; ensureUser/RBAC real',profiles:[],responses:{}};
 async function call(role,path,method='GET'){const r=await fetch(base+path,{method,headers:{'x-fixture-role':role,'Content-Type':'application/json'},...(method==='POST'?{body:'{}'}:{})});const data=await r.json();assert.equal(r.status,200,path+' '+JSON.stringify(data));assert.ok(!JSON.stringify(data).includes('NaN'),path+' finite');results.responses[path]=data;return data;}
 for(const u of users){const d=await call(u.rol,'/api/auth/me');assert.equal(d.user.rol,u.rol);assert.equal(d.user.id,u.id);results.profiles.push({nombre:u.nombre,rol:u.rol,ok:true});}delete results.responses['/api/auth/me'];
 for(const path of ['/api/os','/api/os/pendientes-retiro','/api/dashboard/equipos-operativos','/api/dashboard/global-search?q=749','/api/requerimientos','/api/activos?tipo_equipo=VALIDADOR&q=749','/api/bridge/buscar?q=749','/api/lab/queue/VALIDADOR','/api/lab/queue/CONSOLA','/api/lab/completed']){const d=await call('admin',path);assert.ok(Array.isArray(d)?d.length===0:JSON.stringify(d).includes('[]'),path+' empty');}
 for(const path of ['/api/requerimientos/operativos?tipo_equipo=VALIDADOR&q=749','/api/requerimientos/buses?tipo_equipo=VALIDADOR&q=BJ']){const d=await call('admin',path);assert.equal(d.total||0,0);assert.ok(Array.isArray(d)?d.length===0:d.items.length===0);}
 for(const etapa of ['RECEPCION','AMBIENTE','PRUEBAS','DESPACHO','POR_VERIFICAR','HISTORIAL']){const d=await call('qa','/api/qa/dashboard?etapa='+etapa);assert.equal(d.total,0);assert.equal(d.items.length,0);assert.ok(Object.values(d.counts).every(v=>v===0));}
 const badge=await call('admin','/api/dashboard/badges');assert.ok(Object.values(badge).every(v=>v===0));
 const dashboard=await call('admin','/api/dashboard/summary');assert.ok(Object.values(dashboard.kpis).every(v=>Number(v)===0||v===null),'empty operational KPIs');
 assert.equal((await call('logistica','/api/bodega/queue')).length,0);
 const stock=await call('logistica','/api/bodega/stock');assert.deepEqual(stock,{listos:[],inventario:{validadores:0,consolas:0,total:0}});
 const bodega=await call('logistica','/api/bodega/dashboard');assert.equal(bodega.equiposEnRuta,0);assert.equal(bodega.equiposAsignados,0);assert.equal(bodega.distribucionEstados.length,0);assert.equal(bodega.alertasStock,24);
 const parts=await call('logistica','/api/bodega/repuestos');assert.equal(parts.repuestos.length,24);assert.ok(parts.repuestos.every(p=>p.stock===0));
 const denied=await fetch(base+'/api/qa/NO-OS/actions/iniciar',{method:'POST',headers:{'x-fixture-role':'admin','Content-Type':'application/json'},body:'{}'});assert.equal(denied.status,403);
 const ai=await call('admin','/api/ai/predictive-report');assert.deepEqual(ai,[]);
 for(const t of operational)assert.equal((await initialCounts(testPool))[t],0,'Checks did not generate operational data');
assert.deepEqual(await fingerprint(source),sourceBefore,'Original unchanged');assert.deepEqual(await sequences(source),sourceSeq);
 results.passed=true;results.originalUnchanged=true;results.adminQaWriteStatus=403;results.disposableDatabaseRemoved=true;
 report=results;
}finally{
 if(server)await new Promise(r=>server.close(r));if(testPool)await testPool.end();await source.end();
 if(fixture)await fixture.dispose();
}

// Publish a successful report only after the temporary instance has been removed.
save('empty-e2e.json',report);console.log(JSON.stringify({passed:true,readEndpoints:Object.keys(report.responses).length,profiles:report.profiles.length,originalUnchanged:true,adminQaWriteStatus:403,disposableDatabaseRemoved:true}));
