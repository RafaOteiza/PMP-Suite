import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeAranda, requirementInput } from '../src/services/requirements.js';
import { assetRegistrationInput } from '../src/services/assetManagement.js';

test('Aranda conserva el componente como texto y normaliza prefijo',()=>{
  for(const input of ['00123456','AR-00123456',' ar-00123456 '])
    assert.deepEqual(normalizeAranda(input),{referencia:'AR-00123456',componente:'00123456'});
  assert.equal(normalizeAranda('12345678').referencia,'AR-12345678');
});
test('rechaza Aranda numérico, incompleto, decimal y contenido ambiguo',()=>{
  for(const input of [12345678,'AR-','1.2','-123','AR-12A','123 456','1'.repeat(31),null])
    assert.throws(()=>normalizeAranda(input),e=>e.status===422);
});
const base={origen:'INTERNO',tipo_equipo:'VALIDADOR',serie:'0000740',bus_ppu:'BJ2514',
  terminal_id:1,pst_codigo:'PST',falla:'QR',fecha_requerimiento:'2026-01-01',clasificacion:'MANTENCION'};
test('un requerimiento interno no requiere ni inventa referencia externa',()=>{
  const input=requirementInput(base);assert.equal(input.serie,'0000740');assert.equal(input.referencia,null);assert.equal(input.pod,false);
  assert.equal(requirementInput({...base,clasificacion:'POD'}).pod,true);
});
test('ingreso rechaza origen, activo, clasificación y contexto inválidos',()=>{
  for(const value of [{origen:'OTRO'},{tipo_equipo:'MODULO'},{clasificacion:'IN'},{terminal_id:0},{bus_ppu:'STOCK'},{referencia_externa:'AR-1'},{fecha_requerimiento:'no fecha'}])
    assert.throws(()=>requirementInput({...base,...value}),e=>e.status===422);
});

test('requerimientos rechaza cualquier intento de alta del maestro',()=>{
  for(const registrar_activo of [true,false,'true',1,null,{}])
    assert.throws(()=>requirementInput({...base,registrar_activo}),e=>e.code==='ASSET_CREATION_NOT_ALLOWED');
});

test('Gestión de activos conserva serie textual y deriva atributos canónicos',()=>{
  const input=assetRegistrationInput({tipo_equipo:'CONSOLA',serie:' 9715a0044 ',origen:'Compra',fecha_ingreso:'2026-01-01'});
  assert.equal(input.serie,'9715A0044');assert.equal(input.modelo,'N9715');assert.equal(input.marca,'Waysion');
  assert.equal(input.origen,'Compra');
});
test('Gestión de activos exige procedencia, fecha e identidad válidas',()=>{
  const valid={tipo_equipo:'VALIDADOR',serie:'7400010',origen:'Compra',fecha_ingreso:'2026-01-01'};
  for(const change of [{origen:''},{fecha_ingreso:'no fecha'},{serie:''},{tipo_equipo:'OTRO'},{modelo:'x'.repeat(51)}])
    assert.throws(()=>assetRegistrationInput({...valid,...change}),e=>e.status===422);
});

import { validateManualReceptionInput } from '../src/services/assetManagement.js';
import { validateWithdrawal } from '../src/services/terrainWithdrawal.js';
import { validateWarehouseManualInput } from '../src/services/warehouseEvidence.js';
import { operationalSearchInput } from '../src/services/requirementSearch.js';

test('búsqueda operativa limita paginación y valida filtros sin cambiar identidad',()=>{
  assert.deepEqual(operationalSearchInput({tipo_equipo:'VALIDADOR',q:'74900',bus_ppu:' bj '}),{type:'VALIDADOR',q:'74900',bus:'BJ',limit:20,offset:0,exact:false});
  for(const change of [{tipo_equipo:'OTRO'},{limit:0},{limit:500},{offset:-1},{offset:'1 OR 1=1'},{q:['a','b']},{bus_exacto:'yes'},{q:'x'.repeat(51)}])
    assert.throws(()=>operationalSearchInput({tipo_equipo:'VALIDADOR',...change}),e=>e.status===422);
});

test('retiro exige técnico asignado, identidad exacta y confirmación física',()=>{
 const order={tipo_equipo:'VALIDADOR',validador_serie:'7490010',bus_ppu:'BJ3070',tecnico_terreno_id:'tech'};
 const user={id:'tech',rol:'tecnico_terreno'};
 const body={tipo_equipo:'VALIDADOR',serie:'7490010',bus_ppu:'BJ3070',retiro_confirmado:true,evidencia:'Equipo retirado'};
 assert.equal(validateWithdrawal(body,order,user),'Equipo retirado');
 for(const change of [{serie:'7490010 '},{tipo_equipo:'CONSOLA'},{bus_ppu:'OTRO'},{retiro_confirmado:'true'},{evidencia:123}])assert.throws(()=>validateWithdrawal({...body,...change},order,user),e=>e.status===422);
 for(const change of [{id:'other'},{rol:'admin'}])assert.throws(()=>validateWithdrawal(body,order,{...user,...change}),e=>e.status===403);
});
test('captura operacional manual restringe identidad, permisos y presencia',()=>{
 const asset={tipo_equipo:'CONSOLA',serie:'AB001'},body={...asset,codigo:'AB001',presencia_fisica_confirmada:true};
 for(const rol of ['logistica'])assert.doesNotThrow(()=>validateWarehouseManualInput(body,asset,{rol}));
 for(const rol of ['admin','jefe_laboratorio','gerente','qa','tecnico_terreno','tecnico_laboratorio'])assert.throws(()=>validateWarehouseManualInput(body,asset,{rol}),e=>e.status===403);
 for(const change of [{codigo:'AB001 '},{codigo:'ab001'},{tipo_equipo:'VALIDADOR'},{presencia_fisica_confirmada:'true'},{presencia_fisica_confirmada:false}])assert.throws(()=>validateWarehouseManualInput({...body,...change},asset,{rol:'logistica'}),e=>e.status===422);
});
const manualAsset={tipo_equipo:'CONSOLA',serie:'AB001'};
const manualInput={...manualAsset,codigo:'AB001',presencia_fisica_confirmada:true};
test('recepción manual autorizada solo acepta admin y logística',()=>{
  for(const rol of ['logistica'])assert.doesNotThrow(()=>validateManualReceptionInput(manualInput,{rol},manualAsset));
  for(const rol of ['admin','jefe_laboratorio','gerente','qa','tecnico_terreno','tecnico_laboratorio',undefined])
    assert.throws(()=>validateManualReceptionInput(manualInput,{rol},manualAsset),e=>e.status===403);
});
test('recepción manual exige tipo, serie exacta y presencia explícita',()=>{
  for(const codigo of ['ab001',' AB001','AB001 ','AB002',null,123])
    assert.throws(()=>validateManualReceptionInput({...manualInput,codigo},{rol:'logistica'},manualAsset),e=>e.code==='SCANNED_ASSET_MISMATCH');
  assert.throws(()=>validateManualReceptionInput({...manualInput,tipo_equipo:'VALIDADOR'},{rol:'logistica'},manualAsset),e=>e.code==='SCANNED_ASSET_MISMATCH');
  for(const presencia_fisica_confirmada of [false,undefined,'true',1])
    assert.throws(()=>validateManualReceptionInput({...manualInput,presencia_fisica_confirmada},{rol:'logistica'},manualAsset),e=>e.code==='PHYSICAL_PRESENCE_REQUIRED');
});

import sharp from 'sharp';
import { withdrawalEvidence } from '../src/services/terrainWithdrawalEvidence.js';
import { presentWithdrawalEvent } from '../src/services/withdrawalTimeline.js';

test('retiro requiere decisión PoD explícita; No conserva evidencia textual sin foto',async()=>{
 for(const pod of [undefined,null,'false',0])await assert.rejects(()=>withdrawalEvidence({pod,evidencia:'Retiro'}),e=>e.code==='POD_DECISION_REQUIRED');
 const evidence=await withdrawalEvidence({pod:false,evidencia:'Retiro',fotografias:[]});assert.deepEqual(evidence.fotografias,[]);
 for(const change of [{},{categoria_pod:'GOLPE'},{categoria_pod:'INVENTADO'}])await assert.rejects(()=>withdrawalEvidence({pod:true,evidencia:'Daño',...change}),e=>e.status===422);
});
test('evidencia PoD valida imagen real, límites, origen, normaliza JPEG y elimina metadatos',async()=>{
 const photo=await sharp({create:{width:1600,height:800,channels:3,background:'#123456'}}).withMetadata().png().toBuffer();
 const base={pod:true,categoria_pod:'ROTURA',evidencia:'Carcasa rota',fotografias:[{base64:photo.toString('base64'),origen:'CAMARA'}]};
 const result=await withdrawalEvidence(base);assert.equal(result.fotografias[0].width,1280);assert.equal(result.fotografias[0].mime,'image/jpeg');
 assert.match(result.fotografias[0].sha256,/^[a-f0-9]{64}$/);assert.equal((await sharp(Buffer.from(result.fotografias[0].base64,'base64')).metadata()).exif,undefined);
 for(const fotografias of [[{origen:'CAMARA',base64:'YWJj'}],[{origen:'GALERIA',base64:photo.toString('base64')}],Array(4).fill(base.fotografias[0]),[{origen:'CAMARA',base64:'A'.repeat(1400004)}]])await assert.rejects(()=>withdrawalEvidence({...base,fotografias}),e=>e.status===422);
});
test('historial activo y caso comparten texto legible de retiro y contingencia',()=>{
 const metadata={serie:'7490004',tipo_equipo:'VALIDADOR',bus_ppu:'BJ2149',tecnico:'Rodrigo Escobar',codigo_caso:'AR-87126356',metodo_validacion:'MANUAL',motivo_manual:'QR_ILEGIBLE',codigo_leido:'7490004',pod:false,estado_nuevo:'EN_TRANSITO'};
 for(const detalle of [metadata,{metadata}]){const e=presentWithdrawalEvent({tipo:'RETIRO_TERRENO_CONFIRMADO',detalle});assert.equal(e.titulo,'Retiro físico confirmado');assert.match(e.descripcion,/contingencia manual, sin escaneo/);assert.match(e.descripcion,/Pendiente de retiro → En tránsito/);assert.match(e.descripcion,/Rodrigo Escobar/);}
});

test('retiro normal admite observación y fotos vacías; PoD exige ambas',async()=>{
 const order={tipo_equipo:'VALIDADOR',validador_serie:'TEST-NORMAL',bus_ppu:'E2ENORM',tecnico_terreno_id:'tech'};
 const body={tipo_equipo:'VALIDADOR',serie:'TEST-NORMAL',bus_ppu:'E2ENORM',retiro_confirmado:true,pod:false};
 const user={id:'tech',rol:'tecnico_terreno'};
 for(const evidencia of [undefined,null,'','   ']){
   assert.equal(validateWithdrawal({...body,evidencia},order,user),null);
   const result=await withdrawalEvidence({...body,evidencia,fotografias:[],categoria_pod:'GOLPE'});
   assert.equal(result.pod,false);assert.equal(result.categoria_pod,null);assert.equal(result.observacion,null);assert.deepEqual(result.fotografias,[]);
   await assert.rejects(()=>withdrawalEvidence({...body,pod:true,evidencia,categoria_pod:'GOLPE'}),e=>e.status===422);
 }
 await assert.rejects(()=>withdrawalEvidence({...body,pod:true,evidencia:'Golpe visible',categoria_pod:'GOLPE',fotografias:[]}),e=>e.code==='POD_PHOTO_REQUIRED');
 const photo=await sharp({create:{width:10,height:10,channels:3,background:'#123456'}}).jpeg().toBuffer();
 const optional=await withdrawalEvidence({...body,fotografias:[{origen:'CAMARA',base64:photo.toString('base64')}],categoria_pod:'GOLPE'});
 assert.equal(optional.pod,false);assert.equal(optional.categoria_pod,null);assert.equal(optional.fotografias.length,1);
});

import { presentWithdrawalTimeline, historyStateLabel } from '../src/services/withdrawalTimeline.js';
test('historial agrupa éxitos sin borrar discrepancias ni alterar la auditoría',()=>{
 const event=(id,coincide)=>({id:'flujo:'+id,codigo_os:'MV-TEST',tipo:'VALIDACION_IDENTIDAD_RETIRO',detalle:{metadata:{coincide,esperado:{serie:'TEST'},encontrado:{serie:coincide?'TEST':'OTRO'},codigo_leido:coincide?'TEST':'OTRO',metodo_validacion:'SCAN'}}});
 const events=[event(1,true),event(2,false),event(3,true),{id:'flujo:4',codigo_os:'MV-TEST',tipo:'RETIRO_TERRENO_CONFIRMADO',detalle:{metadata:{validacion_id:3,pod:false,estado_nuevo:'EN_TRANSITO'}}}];
 const original=JSON.stringify(events),result=presentWithdrawalTimeline(events);
 assert.equal(JSON.stringify(events),original);assert.equal(result.length,3);
 assert.equal(result[0].titulo,'Validación de identidad no coincidente');
 assert.equal(result[1].titulo,'Identidad del retiro verificada');
 assert.equal(result[2].detalle.metadata.esperado.serie,'TEST');
 assert.equal(result[2].detalle.metadata.coincide,true);
 assert.match(result[2].descripcion,/Pendiente de retiro → En tránsito hacia Bodega/);
 for(const state of ['EN_RUTA','EN_TRANSITO','PENDIENTE_RETIRO'])assert.ok(!historyStateLabel(state).includes('_'));
});

test('historial conserva todos los intentos agrupados con su fecha y método',()=>{
 const event=(id,method='SCAN',coincide=true)=>({id:'flujo:'+id,codigo_os:'MV-TEST',fecha:'2026-10-04T03:58:0'+id+'Z',tipo:'VALIDACION_IDENTIDAD_RETIRO',detalle:{metadata:{serie:'TEST',coincide,metodo_validacion:method,codigo_leido:'TEST'}}});
 const input=[event(1),event(2),event(3),event(4),event(5,'MANUAL'),event(6,'SCAN',false)];
 const original=JSON.stringify(input),result=presentWithdrawalTimeline(input);
 assert.equal(result.length,3);
 const scans=result.find(e=>e.detalle.intentos?.length===4);
 assert.deepEqual(scans.detalle.intentos.map(e=>[e.id,e.fecha]),input.slice(0,4).map(e=>[e.id,e.fecha]));
 assert.equal(result.find(e=>e.id==='flujo:6').titulo,'Validación de identidad no coincidente');
 assert.equal(JSON.stringify(input),original);
});

import { validateReceiptScanner } from '../src/services/warehouseReceipt.js';
test('recepción scanner exige una ráfaga con Enter; digitación ordinaria no es evidencia',()=>{
 const body={codigo:'7490010',lectura_scanner:{tipo:'KEYBOARD_WEDGE',intervalos_ms:Array(7).fill(10)}};
 assert.equal(validateReceiptScanner(body).tipo,'KEYBOARD_WEDGE');
 for(const lectura_scanner of [undefined,{}, {...body.lectura_scanner,tipo:'MANUAL'}, {...body.lectura_scanner,intervalos_ms:[10]}, {...body.lectura_scanner,intervalos_ms:Array(7).fill(150)}, {...body.lectura_scanner,intervalos_ms:[10,10,10,-1,10,10,10]}])
   assert.throws(()=>validateReceiptScanner({...body,lectura_scanner}),e=>e.status===422);
});
