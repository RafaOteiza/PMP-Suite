import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {assetIdentity} from '../../shared/assetIdentity.js';
import {createSessionToken,sessionErrorKind} from '../../shared/sessionToken.js';

test('tokens SDK concurrentes se coordinan y nunca sobreviven al cambio de identidad',async()=>{
 let finish,calls=0;let current={getIdToken:()=>{calls++;return new Promise(r=>finish=r);}};
 const get=createSessionToken(()=>current);const a=get(),b=get();await Promise.resolve();assert.equal(calls,1);
 finish('fresh');assert.deepEqual(await Promise.all([a,b]),['fresh','fresh']);
 const c=get();await Promise.resolve();current={getIdToken:async()=>'other'};finish('old');assert.equal(await c,null);assert.equal(await get(),'other');
});
test('renovación forzada única para varias respuestas 401',async()=>{
 let calls=0;const user={getIdToken:async force=>{calls++;assert.equal(force,true);return 'renewed';}};
 const get=createSessionToken(()=>user);assert.deepEqual(await Promise.all([get(true),get(true),get(true)]),['renewed','renewed','renewed']);assert.equal(calls,1);
});
test('red, permisos y revocación conservan significados distintos',()=>{
 assert.equal(sessionErrorKind(new Error('offline')),'network');
 assert.equal(sessionErrorKind({response:{status:403}}),'permission');
 assert.equal(sessionErrorKind({response:{status:403,data:{code:'IDENTITY_CONFLICT'}}}),'session');
 assert.equal(sessionErrorKind({response:{status:500}}),'server');
});
test('Web y Mobile importan la misma identidad, sin mapas divergentes',async()=>{
 for(const path of ['../src/pages/GestionActivosPage.tsx','../../07_Mobile/src/components/PmpUi.js'])assert.match(await readFile(new URL(path,import.meta.url),'utf8'),/shared\/assetIdentity.js/);
 assert.equal(assetIdentity('VALIDADOR','72001').modelo,'CVB35');assert.equal(assetIdentity('CONSOLA','ALFA-1').marca,'Waysion');
});
test('Web y Mobile no repiten escrituras al renovar token',async()=>{
 for(const path of ['../src/api/http.ts','../../07_Mobile/src/services/api.js']){
  const source=await readFile(new URL(path,import.meta.url),'utf8');
  assert.match(source,/createSessionToken/);assert.match(source,/\['get','head'\]\.includes/);assert.match(source,/_sessionRetried=true/);
  assert.doesNotMatch(source,/setAuthToken|localStorage\.setItem\([^)]*token/);
 }
});
