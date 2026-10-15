import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { correlationInput, createCorrelation, searchAssets } from '../src/services/assetHistory.js';
import { FlowError } from '../src/services/bridgeFlow.js';
const input={tipo_equipo:'VALIDADOR',serie:'0012345',codigo_os:'MC-1',sistema_externo:'ARANDA',referencia_externa:'AR-1'};
test('normaliza textos sin convertir serie ni reemplazar identificadores',()=>{
  assert.deepEqual(correlationInput({...input,serie:' 0012345 ',sistema_externo:' aranda '}),{
    tipo:'VALIDADOR',serie:'0012345',os:'MC-1',sistema:'ARANDA',referencia:'AR-1',comentario:null});
});
test('rechaza campos operacionales de clientes antiguos',()=>{
  for(const field of ['tecnico_terreno_id','estado_id','ubicacion_id','equipo_preparado_serie','equipo_instalado_serie'])
    assert.throws(()=>correlationInput({...input,[field]:'x'}),e=>e instanceof FlowError&&e.code==='CORRELATION_ONLY');
});
test('exige todos los identificadores y un tipo real de activo',()=>{
  for(const field of Object.keys(input))assert.throws(()=>correlationInput({...input,[field]:''}));
  assert.throws(()=>correlationInput({...input,tipo_equipo:'MODULO'}));
  assert.equal(correlationInput({...input,tipo_equipo:'CONSOLA'}).tipo,'CONSOLA');
});
function fakePool({match=true,duplicate=false}={}){
  const calls=[];let released=false;
  const client={async query(sql,params){calls.push({sql,params});
    if(sql.includes('FROM pmp.validadores'))return {rowCount:1,rows:[{serie:input.serie}]};
    if(sql.includes('FROM pmp.ordenes_servicio'))return {rowCount:match?1:0,rows:[]};
    if(sql.includes('INSERT INTO'))return {rowCount:duplicate?0:1,rows:[{id:1,...input}]};
    return {rowCount:0,rows:[]};
  },release(){released=true;}};
  return {calls,get released(){return released;},async connect(){return client;}};
}
test('solo inserta correlación y confirma la transacción',async()=>{
  const pool=fakePool();const result=await createCorrelation(pool,input,{id:'actor'});
  assert.equal(result.id,1);assert.equal(pool.calls.at(-1).sql,'COMMIT');assert.ok(pool.released);
  const writes=pool.calls.filter(c=>/INSERT|UPDATE |DELETE/.test(c.sql));
  assert.equal(writes.length,1);assert.match(writes[0].sql,/INSERT INTO pmp.bridge_referencias/);
});
test('OS de otra serie revierte y libera conexión sin insertar',async()=>{
  const pool=fakePool({match:false});
  await assert.rejects(createCorrelation(pool,input,{id:'actor'}),e=>e.code==='OS_ASSET_MISMATCH');
  assert.equal(pool.calls.at(-1).sql,'ROLLBACK');assert.ok(pool.released);
  assert.equal(pool.calls.some(c=>c.sql.includes('INSERT')),false);
});
test('duplicados producen conflicto y rollback',async()=>{
  const pool=fakePool({duplicate:true});
  await assert.rejects(createCorrelation(pool,input,{id:'actor'}),e=>e.status===409);
  assert.equal(pool.calls.at(-1).sql,'ROLLBACK');
});
test('búsqueda usa parámetros y trata comodines literalmente',async()=>{
  let bound;const pool={async query(sql,params){bound=params;assert.match(sql,/v_referencias_activo/);return {rows:[]};}};
  await searchAssets(pool,'AR_%');assert.deepEqual(bound,['%AR\\_\\%%']);
});
test('Bridge retira acciones operativas y mantiene autenticación',async()=>{
  const source=await readFile(new URL('../src/routes/bridge.routes.js',import.meta.url),'utf8');
  assert.match(source,/firebaseAuth, ensureUser, enforceReadOnlyRole/);
  assert.match(source,/status\(410\)/);assert.doesNotMatch(source,/UPDATE pmp\.|INSERT INTO pmp\.ordenes_servicio/);
  assert.match(source,/authorize\('bridge.link'\)/);
});
