import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync,mkdtempSync,rmdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {assertKnownTables,configuration,operational,safeIdentity,local,root} from '../tools/database-tools.mjs';
import {assertEphemeralPath} from '../tools/ephemeral-postgres.mjs';
test('la limpieza efímera rechaza el proyecto y directorios ajenos',()=>{
 mkdirSync(local,{recursive:true});const own=mkdtempSync(resolve(local,'pg-ephemeral-guard-'));
 try{assert.equal(assertEphemeralPath(own),own);assert.throws(()=>assertEphemeralPath(root),/Refuse/);assert.throws(()=>assertEphemeralPath(local),/Refuse/);}finally{rmdirSync(own);}
});
test('tablas desconocidas obligan a revisar dependencias',()=>{
 const tables=[...configuration,...operational].map(tablename=>({schemaname:'pmp',tablename}));
 assert.doesNotThrow(()=>assertKnownTables(tables));
 assert.throws(()=>assertKnownTables([...tables,{schemaname:'pmp',tablename:'nueva_evidencia'}]),/esquema cambió/);
 assert.throws(()=>assertKnownTables(tables.slice(1)),/esquema cambió/);
});
test('el diagnóstico de conexión nunca expone credenciales',()=>{
 assert.deepEqual(safeIdentity('postgresql://usuario:secreto@127.0.0.1:55889/postgres'),{host:'127.0.0.1',port:55889,database:'postgres'});
});
