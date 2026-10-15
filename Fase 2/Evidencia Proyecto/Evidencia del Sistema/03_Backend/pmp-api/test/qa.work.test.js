import test from 'node:test';
import assert from 'node:assert/strict';
import {qaTestInput,qaVerdictInput,applyQaTest} from '../src/services/qaWork.js';
const work=pruebas=>({ambiente:{estado:'COMPLETADO'},pruebas});
test('QA prueba inicia pendiente sin método; catálogo fijo',()=>{
 assert.deepEqual(qaTestInput({}),{metodo:'',resultado:'PENDIENTE',observacion:''});
 assert.throws(()=>qaTestInput({metodo:'Otro'}));
 assert.throws(()=>qaTestInput({resultado:'APROBADA'}));
 for(const metodo of ['Manual','Test MK'])assert.equal(qaTestInput({metodo,resultado:'RECHAZADA'}).resultado,'RECHAZADA');
});
test('QA operativo exige evaluación propia y ambiente explícito',()=>{
 const input={resultado:'OPERATIVO',confirmacion:true};
 assert.throws(()=>qaVerdictInput(work([]),input));
 assert.throws(()=>qaVerdictInput(work([{metodo:'Manual',resultado:'PENDIENTE'}]),input));
 assert.throws(()=>qaVerdictInput({...work([{metodo:'Manual',resultado:'APROBADA'}]),ambiente:{estado:'EN_CURSO'}},input));
 assert.equal(qaVerdictInput(work([{metodo:'Manual',resultado:'APROBADA'}]),input).resultado,'OPERATIVO');
});
test('QA rechazo conserva pruebas fallidas y exige motivo técnico',()=>{
 const w=work([{metodo:'Test MK',resultado:'RECHAZADA'}]);
 assert.throws(()=>qaVerdictInput(w,{resultado:'RECHAZADO',confirmacion:true}));
 assert.equal(qaVerdictInput(w,{resultado:'RECHAZADO',confirmacion:true,motivo:'QR intermitente; revisar lector'}).resultado,'RECHAZADO');
 assert.throws(()=>qaVerdictInput(w,{resultado:'OPERATIVO',confirmacion:true}));
 assert.equal(qaVerdictInput(work([...w.pruebas,{metodo:'Manual',resultado:'PENDIENTE'}]),{resultado:'RECHAZADO',confirmacion:true,motivo:'Evaluación fallida documentada; no es seguro continuar'}).resultado,'RECHAZADO');
});
test('QA reintentos preservan fracaso anterior, última ejecución aplica por método',()=>{
 const tests=[{metodo:'Manual',resultado:'RECHAZADA'},{metodo:'Manual',resultado:'APROBADA'}];
 assert.equal(qaVerdictInput(work(tests),{resultado:'OPERATIVO',confirmacion:true}).resultado,'OPERATIVO');
 assert.equal(tests[0].resultado,'RECHAZADA');
 assert.throws(()=>qaVerdictInput(work([...tests,{metodo:'Test MK',resultado:'RECHAZADA'}]),{resultado:'OPERATIVO',confirmacion:true}));
 assert.throws(()=>qaVerdictInput(work(tests),{resultado:'OPERATIVO'}));
});

test('QA comando compuesto conserva intentos terminados y autoría',()=>{
 const w=work([{id:'failed',metodo:'Manual',resultado:'RECHAZADA'}]);
 const actor={id:'fixture',nombre:'QA'};
 assert.throws(()=>applyQaTest(w,{prueba_id:'failed',metodo:'Manual',resultado:'APROBADA'},actor,'new','date'));
 applyQaTest(w,{metodo:'Manual',resultado:'APROBADA'},actor,'new','date');
 assert.equal(w.pruebas.length,2);assert.equal(w.pruebas[0].resultado,'RECHAZADA');
 assert.deepEqual(w.pruebas[1].autor,actor);assert.equal(w.pruebas[1].fecha,'date');
 assert.equal(qaVerdictInput(w,{resultado:'OPERATIVO',confirmacion:true}).resultado,'OPERATIVO');
});
