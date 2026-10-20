// Isolated PostgreSQL + simulated Firebase. Never calls a real authentication operation.
import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {pool,backend,root,sourceEnv,sourceUrl,fingerprint,sequences} from '../tools/database-tools.mjs';
import {emptyFixtureDatabase} from '../tools/ephemeral-postgres.mjs';
const source=pool(sourceUrl(),true),report={checks:[],requests:0,passed:false};let fixture,db,server;
try{
 const before=await fingerprint(source),seq=await sequences(source);
 fixture=await emptyFixtureDatabase();assert.notEqual(fixture.port,5432);
 Object.assign(process.env,sourceEnv(),{DATABASE_URL:fixture.url});process.chdir(backend);
 const {default:app}=await import('../src/app.js');db=(await import('../src/db.js')).pool;
 const {default:firebase}=await import('../src/firebase.js');
 const users=(await db.query('SELECT * FROM pmp.usuarios')).rows;
 const identities=new Map(users.map(u=>[u.correo,{uid:u.firebase_uid,email:u.correo}]));
 let firebaseCalls=0;
 const auth=firebase.auth();
 auth.getUserByEmail=async email=>{firebaseCalls++;if(identities.has(email))return identities.get(email);throw Object.assign(Error('fixture missing'),{code:'auth/user-not-found'});};
 auth.createUser=async body=>{firebaseCalls++;const u={uid:'fixture-'+randomUUID(),email:body.email};identities.set(body.email,u);return u;};
 auth.updateUser=async(uid,body)=>{firebaseCalls++;assert.ok([...identities.values()].some(u=>u.uid===uid));assert.equal(body.password,undefined);return {uid,...body};};
 auth.setCustomUserClaims=async()=>{firebaseCalls++;};
 auth.generatePasswordResetLink=async()=>{throw Error('Unexpected password operation');};
 const user=role=>users.find(u=>u.rol===role);
 for(const layer of app._router.stack)for(const m of layer.handle?.stack||[])if(m.handle?.name==='firebaseAuthMiddleware')m.handle=(req,res,next)=>{
  const identity=identities.get(req.get('x-fixture-email'));if(!identity)return res.status(401).json({error:'Isolated identity missing'});
  req.firebase={uid:identity.uid,email:identity.email,rol:'admin'};next();
 };
 server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const base='http://127.0.0.1:'+server.address().port;
 const call=async(actor,method,path,body,status=200)=>{
  const email=user(actor)?.correo||actor;const res=await fetch(base+path,{method,headers:{'x-fixture-email':email,'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});
  const data=await res.json();report.requests++;assert.equal(res.status,status,actor+' '+method+' '+path+' '+JSON.stringify(data));return data;
 };
 const operational=[['PUT','/api/lab/assign'],['POST','/api/lab/custody/FIXTURE/RECEPCION/validar'],['POST','/api/lab/custody/FIXTURE/SALIDA/confirmar'],['PUT','/api/lab/move'],['POST','/api/lab/finish'],['POST','/api/lab/request-part'],['PUT','/api/bodega/dispatch-lab'],['POST','/api/bodega/dispatch-lab/validar'],['POST','/api/activos'],['POST','/api/requerimientos'],['POST','/api/bridge'],['POST','/api/os/confirmar-retiro'],['POST','/api/equipment-scan/confirm']];
 for(const role of ['gerente','admin'])for(const [method,path] of operational)await call(role,method,path,{rol:'jefe_laboratorio'},403);
 for(const role of ['gerente','jefe_laboratorio','logistica','qa','tecnico_laboratorio','tecnico_terreno']){
  await call(role,'GET','/api/users',undefined,403);
  await call(role,'POST','/api/admin/users',{correo:'attack@fixture.test',nombre:'Attack',apellido:'Fixture',rol:'admin'},403);
  await call(role,'PUT','/api/admin/users/'+user(role).id,{rol:'admin'},403);
  await call(role,'PATCH','/api/users/'+user(role).id,{rol:'admin'},403);
  await call(role,'GET','/api/users/'+user('admin').id,undefined,403);
 }
 for(const [method,path] of operational.filter(([,p])=>!p.startsWith('/api/lab/custody')&&p!=='/api/lab/assign'&&p!=='/api/equipment-scan/confirm'))await call('jefe_laboratorio',method,path,{},403);
 for(const path of ['/api/dashboard/executive','/api/qa/dashboard','/api/bodega/dashboard','/api/requerimientos/casos','/api/bridge'])await call('jefe_laboratorio','GET',path+'?rol=admin',undefined,403);
 await call('jefe_laboratorio','GET','/api/equipment-scan/resolve?estacion=BODEGA&codigo=FIXTURE',undefined,403);
 await call('jefe_laboratorio','POST','/api/equipment-scan/confirm',{estacion:'BODEGA',codigo:'FIXTURE'},403);
 await call('logistica','POST','/api/equipment-scan/confirm',{estacion:'LABORATORIO',codigo:'FIXTURE'},403);
 await call('missing','GET','/api/lab/reception',undefined,401);
 assert.equal(firebaseCalls,0);
 report.checks.push('Denegación API por dominio, acceso directo, claims/body/query falsificados y cuentas ajenas; cero llamadas Firebase');
 for(const role of ['admin','gerente'])await call(role,'GET','/api/dashboard/executive');
 for(const role of ['admin','gerente','jefe_laboratorio']){
  const data=await call(role,'GET','/api/lab/supervision');assert.deepEqual(Object.keys(data).sort(),['updatedAt','lab','labWorkload','labTechnicians','labInsights'].sort());
  await call(role,'GET','/api/lab/reception');
 }
 assert.deepEqual(Object.keys(await call('jefe_laboratorio','GET','/api/dashboard/badges')).sort(),['lab','lab_dispatch']);
 await call('admin','GET','/api/users');
 for(const role of ['logistica','qa','tecnico_laboratorio','tecnico_terreno'])await call(role,'GET','/api/auth/me');
 report.checks.push('Consultas ejecutivas/admin y proyección limitada de Laboratorio; perfiles operacionales conservados');
 const admin=user('admin'),originalUsers=(await db.query('SELECT * FROM pmp.usuarios ORDER BY id')).rows;
 await call('admin','PUT','/api/admin/users/'+admin.id,{rol:'jefe_laboratorio'},403);
 await call('admin','PATCH','/api/users/'+admin.id,{rol:'gerente'},403);
 await call('admin','PATCH','/api/admin/users/'+admin.id+'/desactivar',{},403);
 await call('admin','POST','/api/admin/users',{correo:admin.correo,nombre:'Override',apellido:'Fixture',rol:'gerente'},409);
 assert.equal(firebaseCalls,0);assert.deepEqual((await db.query('SELECT * FROM pmp.usuarios ORDER BY id')).rows,originalUsers);
 // New independent administrator exists only in the disposable fixture and simulated Firebase.
 const newEmail='independent-admin@pmp-suite.test';
 const created=await call('admin','POST','/api/admin/users',{correo:newEmail,nombre:'Independent',apellido:'Fixture',rol:'admin'},201);
 await call(newEmail,'GET','/api/users');await call(newEmail,'PUT','/api/lab/assign',{},403);
 await call(newEmail,'PUT','/api/admin/users/'+admin.id,{rol:'jefe_laboratorio'});
 const moved=(await db.query('SELECT * FROM pmp.usuarios WHERE id=$1',[admin.id])).rows[0];
 assert.equal(moved.rol,'jefe_laboratorio');assert.equal(moved.firebase_uid,admin.firebase_uid);
 // Same identity, stale admin claim: PostgreSQL immediately removes administrative access.
 await call('admin','GET','/api/users',undefined,403);await call('admin','GET','/api/lab/reception');
 await call(newEmail,'PATCH','/api/admin/users/'+created.user.id+'/desactivar',{},403);
 assert.equal(Number((await db.query("SELECT count(*) n FROM pmp.usuarios WHERE activo AND rol='admin'")).rows[0].n),1);
 report.checks.push('Autoedición/bypass por alta bloqueados; nueva cuenta aislada verificada; transferencia simulada conserva UID y revoca acceso con token anterior');
 // Concurrent removals serialize and revalidate the acting administrator under the same lock.
 const {lockUserAdministration,protectUserChange}=await import('../src/security/userAdministration.js');
 await db.query("UPDATE pmp.usuarios SET rol='admin' WHERE id=$1",[admin.id]);
 const demote=async(actor,target)=>{const c=await db.connect();try{await c.query('BEGIN');await lockUserAdministration(c,actor);await protectUserChange(c,actor,target,{rol:'gerente'});await c.query("UPDATE pmp.usuarios SET rol='gerente' WHERE id=$1",[target]);await c.query('COMMIT');return 'ok';}catch(e){await c.query('ROLLBACK');assert.equal(e.status,403);return 'denied';}finally{c.release();}};
 const concurrent=await Promise.all([demote({id:admin.id},created.user.id),demote({id:created.user.id},admin.id)]);
 assert.deepEqual(concurrent.sort(),['denied','ok']);assert.equal(Number((await db.query("SELECT count(*) n FROM pmp.usuarios WHERE activo AND rol='admin'")).rows[0].n),1);
 report.checks.push('Concurrencia: no se pierde el último administrador; actor desautorizado rechazado tras bloqueo');
 assert.deepEqual(await fingerprint(source),before);assert.deepEqual(await sequences(source),seq);report.originalUnchanged=true;report.passed=true;
}catch(e){report.error={message:e.message,stack:e.stack};process.exitCode=1;}finally{
 if(server){server.closeAllConnections?.();await new Promise(r=>server.close(r));}if(db)await db.end();await source.end();if(fixture){await fixture.dispose();report.ephemeralRemoved=true;}
 writeFileSync(resolve(root,'.local/test-results/roles/rbac-e2e.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}
