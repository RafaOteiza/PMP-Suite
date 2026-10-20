import test from 'node:test';
import assert from 'node:assert/strict';
import {POLICY,permits,authorize} from '../src/security/authorization.js';
import {protectUserChange,lockUserAdministration} from '../src/security/userAdministration.js';
import {ROLES} from '../src/constants/roles.js';

test('deny by default: rol, acción, cuenta y recurso deben estar autorizados',()=>{
 for(const action of Object.keys(POLICY))for(const role of [...Object.values(ROLES),'unknown']){
  assert.equal(permits({id:'a',rol:role,activo:true},action),POLICY[action].includes(role));
  assert.equal(permits({rol:role,activo:false},action),false);
 }
 assert.equal(permits({rol:'admin'},'unknown'),false);
 assert.equal(permits(null,'users.manage'),false);
 for(const [action,rol,key] of [['lab.work','tecnico_laboratorio','tecnico_laboratorio_id'],['terrain.work','tecnico_terreno','tecnico_terreno_id']]){
  assert.equal(permits({id:'owner',rol},action,{[key]:'owner'}),true);
  assert.equal(permits({id:'other',rol},action,{[key]:'owner'}),false);
 }
});
test('admin y gerente nunca obtienen escrituras operacionales; jefatura sólo custodia/asignación Lab',()=>{
 const writes=['lab.custody','lab.assign','lab.work','warehouse.move','warehouse.stock','assets.register','requirements.create','terrain.assign','terrain.work','qa.work','scan.validate','bridge.link'];
 for(const role of ['admin','gerente'])for(const action of writes)assert.equal(permits({rol:role},action),false,role+action);
 for(const action of writes)assert.equal(permits({rol:'jefe_laboratorio'},action),['lab.custody','lab.assign','scan.validate'].includes(action),action);
 assert.deepEqual(POLICY['users.manage'],['admin']);
});
test('la autorización ignora rol enviado por body, query y claims; auditoría sin secretos',()=>{
 const old=console.info,logs=[];console.info=(...args)=>logs.push(args);
 try{
  let status,body;const res={status(s){status=s;return this;},json(b){body=b;return this;}};
  authorize('users.manage')({user:{id:'fixture',rol:'jefe_laboratorio'},body:{rol:'admin',password:'SECRET'},query:{rol:'admin'},firebase:{rol:'admin',token:'SECRET'}},res,()=>assert.fail('no continuar'));
  assert.equal(status,403);assert.equal(body.error,'FORBIDDEN');assert.doesNotMatch(JSON.stringify(logs),/SECRET|password|token/);
 }finally{console.info=old;}
});
function client(row,count=1){return {async query(sql){if(sql.includes('count(*)'))return {rows:[{n:count}]};return {rows:row?[row]:[]};}};}
test('gestión de cuentas protege autoedición de rol, último admin y rol no oficial',async()=>{
 const row={id:'admin',rol:'admin',activo:true};
 for(const change of [{rol:'jefe_laboratorio'},{activo:false}])await assert.rejects(()=>protectUserChange(client(row),row,row.id,change),e=>e.status===403&&e.code==='SELF_PRIVILEGE_CHANGE');
 await assert.rejects(()=>protectUserChange(client(row),{id:'other'},row.id,{rol:'gerente'}),e=>e.code==='LAST_ADMIN');
 await assert.rejects(()=>protectUserChange(client(row),{id:'other'},row.id,{rol:'root'}),e=>e.code==='INVALID_ROLE');
 await assert.doesNotReject(()=>protectUserChange(client(row,2),{id:'other'},row.id,{rol:'jefe_laboratorio'}));
});
test('la gestión revalida el administrador después del bloqueo: sesión obsoleta denegada',async()=>{
 for(const row of [null,{id:'admin',rol:'gerente',activo:true},{id:'admin',rol:'admin',activo:false}])await assert.rejects(()=>lockUserAdministration(client(row),{id:'admin',rol:'admin'}),e=>e.status===403);
 await assert.doesNotReject(()=>lockUserAdministration(client({id:'admin',rol:'admin',activo:true}),{id:'admin'}));
});
