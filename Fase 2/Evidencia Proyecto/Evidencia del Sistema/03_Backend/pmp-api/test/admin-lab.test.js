import test from 'node:test';
import assert from 'node:assert/strict';
import {receptionQuery,readLabReception} from '../src/services/labReceptionRead.js';
import {readExecutiveDashboard} from '../src/services/executiveDashboard.js';
import {installMockFirebaseCredential} from './helpers/mockFirebaseCredential.js';

test('recepción valida límites y filtros sin interpretar SQL ni roles del cliente',()=>{
 assert.deepEqual(receptionQuery({}),{tab:'camino',tipo:'',q:'',limit:20,offset:0,hoy:''});
 for(const q of [{tab:'todo'},{tipo:'OTRO'},{limit:0},{limit:51},{hoy:'2'},{offset:-1},{q:[]},{q:'x'.repeat(121)}])assert.throws(()=>receptionQuery(q));
 assert.equal(receptionQuery({q:"' OR true --",role:'admin'}).q,"' OR true --");
});
test('recepción usa parámetros y un snapshot para filas y contadores',async()=>{
 const client={query:async(sql,params)=>{assert.match(sql,/^WITH lab/);assert.match(sql,/RECEPCION_LABORATORIO_CONFIRMADA/);assert.doesNotMatch(sql,/UPDATE |INSERT |DELETE /);assert.equal(params[2],'_%');assert.equal(params[3],'%\\_\\%%');return {rows:[{data:{counts:{camino:0},items:[],total:0}}]};}};
 assert.deepEqual((await readLabReception(client,{q:'_%'})).items,[]);
});
test('dashboard conserva cero real, matriz exhaustiva y separa OS del maestro',async()=>{
 const data={assets:{total:0},orders:{activas:0},distribution:[]};const result=await readExecutiveDashboard({query:async sql=>{assert.match(sql,/WITH hardware/);assert.match(sql,/'orders'/);assert.doesNotMatch(sql,/UPDATE |INSERT |DELETE /);return {rows:[{data}]};}});
 assert.equal(result.orders.activas,0);assert.equal(result.distribution.length,8);assert.equal(result.distribution.reduce((n,x)=>n+x.total,0),0);
});

const remove=installMockFirebaseCredential();
const {default:admin}=await import('../src/firebase.js');
const {pool}=await import('../src/db.js');
const {default:app}=await import('../src/app.js');
const auth=admin.auth(),verify=auth.verifyIdToken,query=pool.query;
const roles=['admin','gerente','tecnico_laboratorio','logistica','qa','tecnico_terreno'];let readCount=0;
auth.verifyIdToken=async token=>({uid:token,email:token+'@fixture.test',rol:'admin'});
pool.query=async(sql,params=[])=>{
 assert.match(sql.trim(),/^(SELECT|WITH)/);
 if(sql.includes('WHERE firebase_uid=$1'))return {rows:[{id:params[0],firebase_uid:params[0],correo:params[1],rol:roles.includes(params[0])?params[0]:'invalid',activo:true}],rowCount:1};
 readCount++;return {rows:[{data:{counts:{camino:0},items:[],total:0,assets:{total:0},orders:{activas:0},distribution:[]}}],rowCount:1};
};
const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const base='http://127.0.0.1:'+server.address().port;
test.after(async()=>{auth.verifyIdToken=verify;pool.query=query;server.closeAllConnections?.();await new Promise(r=>server.close(r));await pool.end();remove();});
for(const path of ['/api/lab/reception','/api/dashboard/executive'])test(path+' aplica identidad y permisos incluso con parámetros manipulados',async()=>{
 for(const role of roles){const before=readCount;const r=await fetch(base+path+'?role=admin&scope=all',{headers:{authorization:'Bearer '+role}});assert.equal(r.status,['admin','gerente'].includes(role)?200:403);if(r.status===403)assert.equal(readCount,before);}
 assert.equal((await fetch(base+path)).status,401);
});
