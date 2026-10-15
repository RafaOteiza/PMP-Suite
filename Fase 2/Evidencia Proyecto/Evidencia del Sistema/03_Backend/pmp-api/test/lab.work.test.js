import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {workInput} from '../src/services/labWork.js';
const valid=()=>({diagnostico:{resultado:'CONFIRMADA',falla_real:'No lee QR'},acciones:['Limpieza Interna'],pruebas:[{nombre:'Manual',resultado:'APROBADA'}],resultado:'REPARADO'});
test('cierre normal y diagnóstico diferente conservan datos estructurados',async()=>{
 for(const result of ['CONFIRMADA','DIFERENTE']){const w=valid();w.diagnostico.resultado=result;assert.equal((await workInput(w,true)).diagnostico.resultado,result);}
});
test('NFF requiere nota y pruebas pero no reparación artificial',async()=>{
 const w={diagnostico:{resultado:'NFF',observacion:'No reproduce falla'},resultado:'NFF',pruebas:valid().pruebas};
 assert.deepEqual((await workInput(w,true)).acciones,[]);
 delete w.diagnostico.observacion;await assert.rejects(workInput(w,true));
});
test('cierre rechaza pendientes, pruebas incompletas, inventario manipulado y métodos arbitrarios',async()=>{
 for(const patch of [{resultado:'PENDIENTE_REPUESTO'},{pruebas:[]},{pruebas:[{nombre:'Manual',resultado:'RECHAZADA'}]},{repuestos:[{id:1,cantidad:0}]},{repuestos:[{id:1,cantidad:1},{id:1,cantidad:1}]},{acciones:['Pruebas de Estrés']}]){
  await assert.rejects(workInput({...valid(),...patch},true));
 }
 assert.ok(await workInput({...valid(),acciones:['Cambio de Repuesto']},true));
});
test('avance permite campos incompletos y no ignora valores inválidos',async()=>{
 assert.equal((await workInput({})).resultado,'');
 await assert.rejects(workInput({resultado:'inventado'}));
 await assert.rejects(workInput({diagnostico:[]}));
});
test('PoD laboratorio valida imágenes adjuntas y exige categoría y observación',async()=>{
 const w={diagnostico:{resultado:'POD'},resultado:'POD',pruebas:valid().pruebas,pod:{categoria:'ROTURA',observacion:'Cubierta rota',fotografias:[]}};
 await assert.rejects(workInput(w,true),e=>e.code==='POD_PHOTO_REQUIRED');
 w.pod.fotografias=[{origen:'ARCHIVO',base64:(await sharp({create:{width:8,height:8,channels:3,background:'#abcdef'}}).png().toBuffer()).toString('base64')}];
 const result=await workInput(w,true);assert.equal(result.pod.fotografias[0].origen,'ARCHIVO');assert.ok(result.pod.fotografias[0].sha256);
 w.pod.fotografias[0].base64='ZmFrZQ==';await assert.rejects(workInput(w,true),e=>e.code==='INVALID_PHOTO');
});

test('únicamente Manual y Test MK en nuevas ejecuciones; pendientes/rechazadas solo avance',async()=>{
 for(const nombre of ['Manual','Test MK']){
  for(const resultado of ['','RECHAZADA']){
   const w={...valid(),pruebas:[{nombre,resultado}]};assert.ok(await workInput(w));await assert.rejects(workInput(w,true));
  }
  assert.ok(await workInput({...valid(),pruebas:[{nombre,resultado:'APROBADA'}]},true));
 }
 for(const nombre of ['Otro','Pruebas de Estrés','manual','QR'])await assert.rejects(workInput({...valid(),pruebas:[{nombre,resultado:'APROBADA'}]}));
});
