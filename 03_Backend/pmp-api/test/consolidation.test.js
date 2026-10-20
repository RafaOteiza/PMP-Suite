import test from 'node:test';
import assert from 'node:assert/strict';
import {assetIdentity} from '../../../shared/assetIdentity.js';
import {requireAssetIdentity} from '../src/services/assetIdentity.js';
import {createEnsureUser} from '../src/middleware/ensureUser.js';

for(const [type,series,model,brand] of [['VALIDADOR','7200001','CVB35','Mikroelektronika'],['VALIDADOR','7490001','CVB45','Mikroelektronika'],['VALIDADOR','7590001','CVB45','Mikroelektronika'],['CONSOLA','N-A1','N9715','Waysion']]){
 test(`API deriva identidad canónica ${type} ${series}`,()=>{
  assert.deepEqual(requireAssetIdentity(type,series),{modelo:model,marca:brand});
  assert.equal(assetIdentity(type,series).modelo,model);
  assert.throws(()=>requireAssetIdentity(type,series,{modelo:'OTRO'}),e=>e.status===422&&e.code==='ASSET_IDENTITY_CONFLICT');
  assert.throws(()=>requireAssetIdentity(type,series,{marca:'OTRA'}),e=>e.status===422);
 });
}
test('serie parcial espera; prefijo no definido no inventa modelo; consola no usa prefijos',()=>{
 assert.equal(assetIdentity('VALIDADOR','7').status,'pending');
 assert.equal(assetIdentity('VALIDADOR','99').status,'invalid');
 assert.equal(assetIdentity('CONSOLA','99-A').status,'valid');
 assert.throws(()=>requireAssetIdentity('VALIDADOR','990001'),e=>e.status===422);
});
for(const scenario of ['mismatch','ambiguous','inactive','role'])test(`identidad PostgreSQL: ${scenario}`,async()=>{
 const row={id:'actor',correo:'actor@example.invalid',firebase_uid:'firebase-actor',activo:true,rol:'qa'};
 if(scenario==='mismatch')row.firebase_uid='other';
 if(scenario==='inactive')row.activo=false;
 let next=false;const req={firebase:{uid:'firebase-actor',email:'actor@example.invalid',role:'admin'}};
 const res={statusCode:200,status(n){this.statusCode=n;return this;},json(body){this.body=body;return this;}};
 await createEnsureUser({query:async()=>({rowCount:scenario==='ambiguous'?2:1,rows:scenario==='ambiguous'?[row,{...row,id:'other'}]:[row]})})(req,res,()=>{next=true;});
 if(scenario==='role'){assert.equal(next,true);assert.equal(req.user.rol,'qa');}
 else{assert.equal(next,false);assert.equal(res.statusCode,403);assert.equal(res.body.code,scenario==='inactive'?'USER_INACTIVE':'IDENTITY_CONFLICT');}
});
