import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import React from 'react';
import TestRenderer,{act} from 'react-test-renderer';
import ts from 'typescript';
const url=code=>`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`;
const state=globalThis.__requirementsTest={};
const mock=url(`import React from ${JSON.stringify(import.meta.resolve('react'))};
  const s=globalThis.__requirementsTest;
  export const api={post:async(path,body)=>{s.labReads.push({path,body});if(s.error)throw s.error;return {data:path.endsWith('/validar')?{coincide:true,elegible:true,equipo:{serie:body.codigo},validacion:{id:'700'}}:{}};}};
  export const useSession=()=>({me:{rol:s.role||'logistica'}});
  export const useSearchParams=()=>[new URLSearchParams(s.dispatchParams??'caso=1')];
  export const Link=({children,to})=>React.createElement('a',{href:to},children);
  export const assetHistoryUrl=asset=>'/trazabilidad?serie='+asset.serie;
  export const getDispatchDestinations=async()=>s.dispatchDestinations??[{bus_ppu:'BJ2149',terminal_id:1,pst_codigo:'PST',terminal:'El Conquistador',operador:'VOYSANTIAGO'}];
  export const caseHistoryUrl=id=>'/trazabilidad?caso='+id;
  export const getCases=async()=>[{id:'1',codigo_caso:'AR-00123456',tipo_equipo:'VALIDADOR',serie_origen:'7404593',bus_ppu:'BJ2514',terminal_id:1,pst_codigo:'PST',falla_reportada:'QR',ordenes:[{codigo_os:'MV-00123456',es_instalacion:false}]}];
  export const getTecnicosTerreno=async()=>[{id:'tech',nombre:'Rodrigo',apellido:'Escobar'}];
  export const getPendingWithdrawals=async()=>{s.withdrawalReads++;if(s.withdrawalError)throw s.withdrawalError;return s.withdrawals.map(o=>({...o}));};
  export const assignWithdrawal=async(codigo_os,tecnico_terreno_id)=>{s.assignments.push({codigo_os,tecnico_terreno_id});if(s.assignmentError)throw s.assignmentError;s.withdrawals=s.withdrawals.map(o=>o.codigo_os===codigo_os?{...o,tecnico_terreno_id,tecnico:'Rodrigo Escobar'}:o);};
  export const getRequestCatalogs=async()=>s.dispatchCatalogs??({terminales:[{id:1,nombre:'Terminal'}],psts:[{codigo:'PST',nombre:'Operador'}]});
  export const validateDispatch=async payload=>{s.reads.push(payload);if(s.readError)throw s.readError;return {equipo:{tipo_equipo:'VALIDADOR',serie:payload.codigo,modelo:'CVB45'},stock:{codigo_os:'MV-OLD',es_aprobado_qa:true},elegible:payload.origen_captura!=='MANUAL',validacion:payload.origen_captura==='MANUAL_AUTORIZADO'?{id:'33'}:undefined,escaneo:payload.origen_captura==='SCANNER'?{id:'22'}:null};};
  export const validateTerrainReceipt=async payload=>{s.receiptReads.push(payload);return {equipo:{serie:payload.codigo},coincide:payload.codigo==='7490010',elegible:payload.origen_captura!=='MANUAL'&&payload.codigo==='7490010',validacion:payload.origen_captura==='MANUAL_AUTORIZADO'?{id:'44'}:undefined,escaneo:payload.origen_captura==='SCANNER'?{id:'45'}:null};};
  export const validateLabDispatch=validateTerrainReceipt,validateQaDispatch=validateTerrainReceipt;
  export const dispatchToLab=async(code,payload)=>{s.receiptWrites.push({code,...payload});if(s.error)throw s.error;};
  export const dispatchToQa=dispatchToLab;
  export const receiveInBodega=async (code,payload)=>{s.receiptWrites.push({code,...payload});if(s.error)throw s.error;};
  export const confirmDispatch=async payload=>{s.dispatches.push(payload);if(s.error)throw s.error;return {os:{codigo_os:'IN-000184',validador_serie:'7400010'},caso:payload.contexto_instalacion==='NUEVA'?null:{id:'1'}};};
  export const searchAssets=async params=>{s.lookups.push(params);if(s.searchError)throw s.searchError;if(s.unknown)return [];return [{tipo_equipo:params.tipo_equipo,serie:params.tipo_equipo==='VALIDADOR'?'7404593':'9715A0044',modelo:'CVB45',marca:'Known',bus_ppu:s.assetBus||'WXSS18',estado_actual:s.assetState||'EN_OPERACION',puede_iniciar_recepcion:s.assetState==='REGISTRADO'}];};
  export const searchRequirementAssets=async params=>{s.lookups.push(params);if(s.searchError)throw s.searchError;return {items:s.unknown||s.assetState&&s.assetState!=='EN_OPERACION'?[]:s.assets||[{tipo_equipo:params.tipo_equipo,serie:params.tipo_equipo==='VALIDADOR'?'7404593':'9715A0044',modelo:'CVB45',marca:'Known',bus_ppu:s.assetBus||'WXSS18',estado_actual:'EN_OPERACION',terminal_id:1,terminal:'Terminal vigente',pst_codigo:'PST',operador:'Operador vigente'}],has_more:!!s.moreAssets,offset:params.offset,limit:20};};
  export const searchRequirementBuses=async params=>{s.busLookups.push(params);return {items:[{bus_ppu:s.assetBus||'WXSS18'}],has_more:false,offset:0,limit:20};};
  export const getActiveRequirements=async(tipo,serie)=>{s.activeLookups.push({tipo,serie});if(s.activeError)throw s.activeError;return s.activeOrders||[];};
  export const registerAsset=async body=>{s.registrations.push(body);return {...body,estado_actual:'REGISTRADO',puede_iniciar_recepcion:true};};
  export const validateAssetReception=async body=>{s.receptionScans.push(body);if(s.receptionScanError)throw s.receptionScanError;return {elegible:body.origen_captura!=='MANUAL',escaneo:body.origen_captura==='SCANNER'?{id:'111'}:null,validacion:body.origen_captura==='MANUAL_AUTORIZADO'?{id:'222'}:undefined};};
  export const startAssetReception=async body=>{s.receptions.push(body);if(s.receptionError)throw s.receptionError;return {estado_actual:'DISPONIBLE_INSTALACION',stock_origen_evento:'777'};};
  export const createRequest=async payload=>{s.requests.push(payload);if(s.requestError)throw s.requestError;
    const prefix=payload.clasificacion==='POD'?(payload.tipo_equipo==='VALIDADOR'?'PDV':'PDC'):(payload.tipo_equipo==='VALIDADOR'?'MV':'MC');
    const codigo_os=prefix+'-00123456';s.withdrawals.push({...payload,codigo_os,tecnico_terreno_id:null,tecnico:null,estado_actual:'PENDIENTE_RETIRO',terminal:'Terminal vigente',operador:'Operador vigente',referencia_ar:payload.referencia_externa||null});
    return {os:{codigo_os},caso:{id:'1',codigo_caso:'AR-00123456'}};};
  export const ScanBarcode=()=>null, ClipboardList=ScanBarcode,AlertTriangle=ScanBarcode,CheckCircle2=ScanBarcode,Info=ScanBarcode,X=ScanBarcode,UserCheck=ScanBarcode,Search=ScanBarcode,RefreshCw=ScanBarcode;
  export const localReport=(...args)=>({}),pagedReport=localReport,sheetsReport=localReport,reportSheet=localReport,summarySheet=localReport;
  export const usersReport=(q,disabled=false)=>({title:'Usuarios',filters:{q},disabled,load:async()=>[]});
  export default function Decoration({children,title}){return React.createElement('section',null,title,children);}`);
async function compile(path,imports={}){
  const source=(await readFile(new URL(`../${path}`,import.meta.url),'utf8')).replace(/import ['"][^'"]+\.css['"];?/g,'');
  return url(ts.transpileModule(source,{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace(/from (["'])([^"']+)\1/g,(_,q,name)=>`from ${JSON.stringify(imports[name]||(name.startsWith('react')?import.meta.resolve(name):mock))}`));
}
const labTechnicalWork=await compile('src/utils/labTechnicalWork.ts');
const banner=await compile('src/components/ui/FeedbackBanner.tsx'),errors=await compile('src/api/errors.ts');
const formatters=await compile('src/utils/formatters.ts');
const health=await compile('src/utils/health.ts'),healthIcon=url('export const HealthIcon=()=>null;');
const statCard=await compile('src/components/ui/StatCard.tsx',{'../../utils/health':health,'./SemanticIndicator':healthIcon});
const statusBadge=await compile('src/components/ui/StatusBadge.tsx',{'./SemanticIndicator':healthIcon,'../../utils/health':health});
const emptyState=await compile('src/components/ui/EmptyState.tsx');
const imports={'react-router-dom':mock,'../components/ui/FeedbackBanner':banner,'../api/errors':errors,'../components/ui/StatusBadge':statusBadge,'../components/ui/EmptyState':emptyState,'../utils/formatters':formatters};
const receiptScanner=await compile('src/utils/receiptScanner.ts');
const {default:Reception}=await import(await compile('src/components/WarehouseReceptionForm.tsx',{'lucide-react':import.meta.resolve('lucide-react'),'./ui/FeedbackBanner':banner,'../utils/labTechnicalWork':labTechnicalWork,'./ui/EmptyState':emptyState,'./ui/StatusBadge':statusBadge,'../api/errors':errors,'../utils/receiptScanner':receiptScanner}));
const {default:Dispatch,dispatchCatalogName,dispatchOperatorGroups}=await import(await compile('src/pages/DespachoEscaneoPage.tsx',{...imports,'../utils/receiptScanner':receiptScanner}));
const scannerHook=await compile('src/hooks/useScannerInput.ts',{'../utils/receiptScanner':receiptScanner});
const {default:Management}=await import(await compile('src/pages/GestionActivosPage.tsx',{...imports,'../hooks/useScannerInput':scannerHook,'../../../shared/assetIdentity.js':new URL('../../shared/assetIdentity.js',import.meta.url).href}));
const {default:Ingress}=await import(await compile('src/pages/IngresoRequerimientosPage.tsx',imports));
const withdrawals=await compile('src/components/TerrainWithdrawalAssignments.tsx',{'./ui/FeedbackBanner':banner,'./ui/StatCard':statCard,'../utils/labTechnicalWork':labTechnicalWork,'./ui/EmptyState':emptyState,'./ui/StatusBadge':statusBadge,'./ui/EmptyState':emptyState,'../api/errors':errors,'../utils/formatters':formatters});
const {default:Withdrawals}=await import(await compile('src/pages/RetirosTerrenoPage.tsx',{'../components/TerrainWithdrawalAssignments':withdrawals}));
const text=node=>typeof node==='string'?node:(node?.children||[]).map(text).join('');
const button=(root,label)=>root.findAllByType('button').find(n=>text(n).includes(label));
let renderer;
test.beforeEach(()=>Object.assign(state,{dispatchDestinations:undefined,dispatchCatalogs:undefined,dispatchParams:undefined,dispatchCode:'7400010',labReads:[],labSnapshot:{revision:null,trabajo:null},labReadError:null,labWriteError:null,labParts:[{id:1,nombre:'Lector QR',categoria:'VALIDADOR',stock:4}],historyFixture:null,cameraGranted:true,photoCanceled:false,withdrawals:[],withdrawalReads:0,assignments:[],withdrawalError:null,assignmentError:null,assets:null,activeLookups:[],busLookups:[],activeOrders:[],activeError:null,moreAssets:false,receiptClosed:false,receiptReads:[],receiptWrites:[],reads:[],dispatches:[],requests:[],lookups:[],unknown:false,error:null,readError:null,requestError:null,registrations:[],receptions:[],receptionScans:[],receptionError:null,receptionScanError:null,assetBus:null,assetState:null,searchError:null,role:'logistica'}));
test.afterEach(async()=>{if(renderer)await act(async()=>renderer.unmount());renderer=null;});
async function mount(Page=Dispatch){await act(async()=>{renderer=TestRenderer.create(React.createElement(Page));});return renderer.root;}
async function change(root,id,value){await act(async()=>root.findByProps({id}).props.onChange({target:{value}}));}
async function ready(root){await change(root,'dispatch-technician','tech');await change(root,'dispatch-capture','SCANNER');state.dispatchCode='7400010';}
async function read(root){
 const scanner=root.findAllByProps({id:'dispatch-capture'})[0];
 if(scanner?.props.value==='SCANNER'){let time=100;for(const key of [...state.dispatchCode,'Enter']){await act(async()=>root.findByProps({id:'dispatch-reading'}).props.onKeyDown({key,timeStamp:time,nativeEvent:{isTrusted:true},preventDefault(){}}));time+=10;}return;}
 await act(async()=>root.findByType('form').props.onSubmit({preventDefault(){}}));}

test('catálogo de despacho agrupa solo nombres equivalentes y conserva todos los códigos',()=>{
 const input=[{codigo:'U15',nombre:' VOYSANTIAGO '},{codigo:'U14',nombre:'voysantiago'},{codigo:'U4',nombre:'VOYSANTIAGO SPA'},{codigo:'B',nombre:'Gran  Américas'},{codigo:'C',nombre:'Gran\u00a0Américas'},{codigo:'A',nombre:'CONECTA'},{codigo:'D',nombre:'Empresa Uno'},{codigo:'E',nombre:'Empresa Dos'}];
 const original=JSON.stringify(input),groups=dispatchOperatorGroups(input);
 assert.deepEqual(groups.map(g=>g.label),['Conecta','Empresa dos','Empresa uno','Gran américas','Voysantiago','Voysantiago SpA']);
 assert.deepEqual(groups.find(g=>g.key==='voysantiago').operators.map(p=>p.codigo),['U14','U15']);
 assert.equal(groups.find(g=>g.label==='Gran américas').operators.length,2);
 assert.equal(JSON.stringify(input),original);
});
test('formato del despacho conserva siglas, sufijos legales e iniciales',()=>{
 for(const [raw,label] of [[' CONECTA ','Conecta'],['VOYSANTIAGO','Voysantiago'],['STU','STU'],['STP','STP'],['ENEA','ENEA'],['VOYSANTIAGO SPA','Voysantiago SpA'],['EMPRESA S.A.','Empresa S.A.'],['J. J. AGUIRRE LUCO','J. J. Aguirre luco'],['DIEGO  PORTALES','Diego portales']])assert.equal(dispatchCatalogName(raw),label);
});
const dispatchCatalogFixture=()=>({terminales:[{id:2,nombre:'DIEGO PORTALES'},{id:1,nombre:'El Conquistador'}],psts:[{codigo:'U14',nombre:'VOYSANTIAGO'},{codigo:'U15',nombre:' voysantiago '},{codigo:'U4',nombre:'VOYSANTIAGO SPA'},{codigo:'US17',nombre:'CONECTA'}]});
test('PPU única conserva U15 y presenta una sola opción Voysantiago; validar no despacha',async()=>{
 state.dispatchParams='';state.dispatchCatalogs=dispatchCatalogFixture();state.dispatchDestinations=[{bus_ppu:'TEST01',terminal_id:1,pst_codigo:'U15'}];
 const root=await mount();await change(root,'dispatch-bus','TEST01');await change(root,'dispatch-technician','tech');
 const op=root.findByProps({id:'dispatch-operator'});assert.equal(op.props.value,'voysantiago');assert.equal(op.props.disabled,true);
 assert.equal(op.findAllByType('option').filter(o=>text(o)==='Voysantiago').length,1);
 assert.equal(root.findByProps({id:'dispatch-operator-code'}).props.value,'U15');
 await read(root);assert.equal(state.reads.at(-1).pst_codigo,'U15');assert.equal(state.reads.at(-1).terminal_id,1);assert.equal(state.dispatches.length,0);
});
test('operador equivalente con varios códigos no selecciona uno arbitrariamente',async()=>{
 state.dispatchParams='';state.dispatchCatalogs=dispatchCatalogFixture();state.dispatchDestinations=[{bus_ppu:'TEST01',terminal_id:null,pst_codigo:null}];
 const root=await mount();await change(root,'dispatch-bus','TEST01');await change(root,'dispatch-terminal','1');await change(root,'dispatch-technician','tech');await change(root,'dispatch-operator','voysantiago');
 assert.equal(root.findByProps({id:'dispatch-operator-code'}).props.value,'');assert.equal(button(root,'Confirmar asignación y despacho').props.disabled,true);
 await change(root,'dispatch-operator-code','U14');await read(root);assert.equal(state.reads.at(-1).pst_codigo,'U14');assert.equal(state.dispatches.length,0);
 await change(root,'dispatch-operator','voysantiago spa');assert.equal(root.findAllByProps({id:'dispatch-operator-code'}).length,0);
 await read(root);assert.equal(state.reads.at(-1).pst_codigo,'U4');
});
test('PPU ambigua pide selección; terminal y operador resuelven la relación en ambos sentidos',async()=>{
 state.dispatchParams='';state.dispatchCatalogs=dispatchCatalogFixture();state.dispatchDestinations=[{bus_ppu:'TEST01',terminal_id:1,pst_codigo:'U15'},{bus_ppu:'TEST01',terminal_id:2,pst_codigo:'US17'}];
 const root=await mount();await change(root,'dispatch-bus','TEST01');
 assert.equal(root.findByProps({id:'dispatch-terminal'}).props.value,'');assert.equal(root.findByProps({id:'dispatch-operator'}).props.value,'');assert.match(text(root),/más de una relación/);
 await change(root,'dispatch-terminal','1');assert.equal(root.findByProps({id:'dispatch-operator-code'}).props.value,'U15');
 await change(root,'dispatch-bus','TEST02');await change(root,'dispatch-bus','TEST01');await change(root,'dispatch-operator','conecta');assert.equal(root.findByProps({id:'dispatch-terminal'}).props.value,'2');
 assert.equal(state.dispatches.length,0);
});
test('cambiar PPU limpia contexto derivado y validación previa',async()=>{
 state.dispatchParams='';state.dispatchCatalogs=dispatchCatalogFixture();state.dispatchDestinations=[{bus_ppu:'TEST01',terminal_id:1,pst_codigo:'U15'},{bus_ppu:'TEST02',terminal_id:2,pst_codigo:'US17'}];
 const root=await mount();await change(root,'dispatch-bus','TEST01');await change(root,'dispatch-technician','tech');await read(root);
 assert.equal(button(root,'Confirmar asignación y despacho').props.disabled,false);
 await change(root,'dispatch-bus','TEST02');assert.equal(root.findByProps({id:'dispatch-terminal'}).props.value,'2');assert.equal(root.findByProps({id:'dispatch-operator'}).props.value,'conecta');assert.equal(button(root,'Confirmar asignación y despacho').props.disabled,true);
 assert.equal(state.dispatches.length,0);
});

test('despacho manual exige presencia, no crea IN al validar y usa validacion_id',async()=>{
  const root=await mount();await change(root,'dispatch-technician','tech');await change(root,'dispatch-capture','MANUAL_AUTORIZADO');
  await change(root,'dispatch-reading','7201234');await read(root);assert.equal(state.reads.length,0);
  await checked(root,'dispatch-present');await change(root,'dispatch-reason','Lector no disponible');await read(root);
  assert.equal(state.dispatches.length,0);assert.equal(state.reads[0].presencia_fisica_confirmada,true);
  assert.equal(button(root,'Confirmar asignación y despacho').props.disabled,false);
  await act(async()=>button(root,'Confirmar asignación y despacho').props.onClick());
  assert.equal(state.dispatches[0].validacion_id,'33');assert.equal('escaneo_id' in state.dispatches[0],false);
});
test('revocar presencia y cambiar serie invalidan despacho manual; 4xx conserva técnico y bus',async()=>{
  const root=await mount();await change(root,'dispatch-technician','tech');await change(root,'dispatch-capture','MANUAL_AUTORIZADO');
  await change(root,'dispatch-reading','7201234');await checked(root,'dispatch-present');await change(root,'dispatch-reason','Lector no disponible');await read(root);
  await checked(root,'dispatch-present',false);assert.equal(button(root,'Confirmar asignación y despacho').props.disabled,true);
  await checked(root,'dispatch-present');await change(root,'dispatch-reason','Lector no disponible');await read(root);await change(root,'dispatch-reading','7201234 ');await read(root);
  assert.equal(button(root,'Confirmar asignación y despacho').props.disabled,true);
  await change(root,'dispatch-reading','7201234');await read(root);
  state.error={response:{status:409,data:{message:'Valida nuevamente la presencia física'}}};
  await act(async()=>button(root,'Confirmar asignación y despacho').props.onClick());
  assert.match(text(root.findByProps({role:'alert'})),/presencia física/);
  assert.equal(root.findByProps({id:'dispatch-technician'}).props.value,'tech');assert.equal(root.findByProps({id:'dispatch-bus'}).props.value,'BJ2514');
});
async function reception(role='logistica',purpose='receipt'){
  await act(async()=>{renderer=TestRenderer.create(React.createElement(Reception,{role,purpose,ticket:{codigo_os:'MV-87126355',tipo_equipo:'VALIDADOR',serie:'7490010',bus_ppu:'BJ3070',modelo:'CVB45',marca:'Mikroelektronika',terminal:'El Conquistador',operador:'VOYSANTIAGO',tecnico_retiro:'Rodrigo Escobar',referencia_ar:'AR-87126355'},onClose(){state.receiptClosed=true;},onReceived(){state.received=true;}}));});return renderer.root;
}
async function wedge(root,code,gap=10,trusted=true){
 let time=100;
 for(const key of [...code,'Enter']){
  await act(async()=>root.findByProps({id:'receipt-reading'}).props.onKeyDown({key,timeStamp:time,nativeEvent:{isTrusted:trusted},preventDefault(){}}));time+=gap;
 }
}
test('recepción manual exacta y explícita conserva 4xx dentro del panel abierto',async()=>{
  const root=await reception();await change(root,'receipt-capture','MANUAL_AUTORIZADO');await change(root,'receipt-reading','7490010');await change(root,'receipt-reason','Escáner no disponible');
  await read(root);assert.equal(state.receiptReads.length,0);
  await checked(root,'receipt-present');await change(root,'receipt-reading','7490010 ');await read(root);assert.equal(state.receiptReads.length,0);
  await change(root,'receipt-reading','7490010');await read(root);assert.equal(state.receiptWrites.length,0);
  state.error={response:{status:409,data:{message:'Valida nuevamente la presencia física'}}};
  await act(async()=>button(root,'Confirmar recepción en Bodega').props.onClick());
  const dialog=root.findByProps({'aria-labelledby':'warehouse-receipt-title'});assert.match(text(dialog.findByProps({role:'alert'})),/presencia física/);
  assert.equal(dialog.findByProps({id:'receipt-reading'}).props.value,'7490010');assert.equal(dialog.findByProps({id:'receipt-present'}).props.checked,true);
  assert.equal(state.receiptWrites[0].validacion_id,'44');assert.equal('escaneo_id' in state.receiptWrites[0],false);
  assert.equal(button(root,'Confirmar recepción en Bodega').props.disabled,true);
});
test('recepción por scanner conserva token; consulta manual no habilita movimiento',async()=>{
  const root=await reception();await wedge(root,'7490010');
  await act(async()=>button(root,'Confirmar recepción en Bodega').props.onClick());assert.equal(state.receiptWrites[0].escaneo_id,'45');
  await change(root,'receipt-capture','MANUAL');await change(root,'receipt-reading','7490010');await read(root);
  assert.equal(button(root,'Confirmar recepción en Bodega').props.disabled,true);
});
test('contexto y lectura física no crean IN; únicamente confirmación explícita despacha',async()=>{
  const root=await mount();await ready(root);assert.equal(state.dispatches.length,0);
  await read(root);assert.equal(state.dispatches.length,0);assert.equal(state.reads[0].codigo,'7400010');
  assert.equal(button(root,'Confirmar asignación y despacho').props.disabled,false);
  await act(async()=>button(root,'Confirmar asignación y despacho').props.onClick());
  assert.equal(state.dispatches.length,1);assert.equal(state.dispatches[0].escaneo_id,'22');assert.match(text(root),/IN-000184/);
});
test('captura manual consulta sin habilitar despacho',async()=>{
  const root=await mount();await change(root,'dispatch-technician','tech');await change(root,'dispatch-capture','MANUAL');await change(root,'dispatch-reading','7400010');await read(root);
  assert.equal(state.reads[0].origen_captura,'MANUAL');assert.equal(button(root,'Confirmar asignación y despacho').props.disabled,true);
  assert.equal(state.dispatches.length,0);assert.match(text(root),/Pendiente de escaneo/);
});
test('rechazo 409 se ve inline y conserva caso, técnico y bus',async()=>{
  const root=await mount();await ready(root);await read(root);
  state.error={response:{status:409,data:{error:'PHYSICAL_SCAN_REQUIRED',message:'Escanea físicamente el equipo en BODEGA'}}};
  await act(async()=>button(root,'Confirmar asignación y despacho').props.onClick());
  assert.match(text(root.findByProps({role:'alert'})),/Escanea físicamente/);
  assert.equal(root.findByProps({id:'dispatch-technician'}).props.value,'tech');
  assert.equal(root.findByProps({id:'dispatch-bus'}).props.value,'BJ2514');
  assert.equal(root.findByProps({id:'dispatch-case'}).props.value,'1');
  assert.equal(button(root,'Confirmar asignación y despacho').props.disabled,true);
});
test('tipo incorrecto no habilita confirmación y permite nueva lectura',async()=>{
  const root=await mount();await ready(root);state.readError={response:{status:409,data:{message:'Tipo detectado: CONSOLA. Tipo requerido: VALIDADOR'}}};await read(root);
  assert.match(text(root.findByProps({role:'alert'})),/CONSOLA.*VALIDADOR/);assert.equal(button(root,'Confirmar asignación y despacho').props.disabled,true);
  state.readError=null;await read(root);assert.equal(button(root,'Confirmar asignación y despacho').props.disabled,false);
  await change(root,'dispatch-reading','7400011');assert.equal(button(root,'Confirmar asignación y despacho').props.disabled,true);
});

async function selectSuggested(root){await act(async()=>root.findByProps({id:'request-option-0'}).props.onClick());}
const installedAssets=[
 {tipo_equipo:'VALIDADOR',serie:'7490004',modelo:'CVB45',marca:'Mikroelektronika',bus_ppu:'BJ2149',terminal_id:1,terminal:'El Conquistador',pst_codigo:'PST',operador:'VOYSANTIAGO',estado_actual:'EN_OPERACION'},
 {tipo_equipo:'VALIDADOR',serie:'7490005',modelo:'CVB45',marca:'Mikroelektronika',bus_ppu:'BJ2514',terminal_id:2,terminal:'El Conquistador',pst_codigo:'GA',operador:'Gran Américas',estado_actual:'EN_OPERACION'},
];
function assertInstallation(root,asset){
 assert.ok(text(root).includes(`Activo seleccionado: ${asset.tipo_equipo} · ${asset.serie}`));
 for(const value of [asset.modelo,asset.marca])assert.ok(text(root).includes(value));
 assert.equal(root.findByProps({id:'request-type'}).props.value,asset.tipo_equipo);
 for(const [id,value] of [['request-series',asset.serie],['request-bus',asset.bus_ppu],['request-terminal',asset.terminal],['request-operator',asset.operador]]){
  assert.equal(root.findByProps({id}).props.value,value);assert.equal(root.findByProps({id}).props.readOnly,true);
 }
 assert.match(text(root),/provienen de la instalación vigente/);assert.doesNotMatch(text(root),/Conflicto:/);
}
function assertEmptyInstallation(root){
 assert.doesNotMatch(text(root),/Activo seleccionado:|Conflicto:|Ya existe una intervención activa/);
 for(const id of ['request-series','request-bus','request-terminal','request-operator'])assert.equal(root.findByProps({id}).props.value,'');
 assert.equal(root.findByProps({id:'request-bus'}).props.readOnly,false);
 assert.equal(root.findByProps({id:'request-series'}).props.readOnly,false);
 assert.doesNotMatch(text(root),/Mikroelektronika|CVB45|provienen de la instalación vigente/);
 assert.equal(root.findAllByProps({role:'option'}).length,0);assert.equal(button(root,'Confirmar requerimiento').props.disabled,true);
}
async function chooseFirstBus(root){
 state.assets=[installedAssets[0]];state.assetBus='BJ2149';
 await change(root,'request-bus','BJ21');
 await act(async()=>root.findByProps({id:'request-bus-option-0'}).props.onClick());
}
test('PPU parcial busca buses por tipo; seleccionar bus propone único activo y contexto',async()=>{
 const root=await mount(Ingress);await chooseFirstBus(root);
 assert.deepEqual(state.busLookups.at(-1),{tipo_equipo:'VALIDADOR',bus_ppu:'BJ21'});
 assert.deepEqual(state.lookups.at(-1),{tipo_equipo:'VALIDADOR',bus_ppu:'BJ2149',bus_exacto:true,offset:0,limit:20});
 assertInstallation(root,installedAssets[0]);
 assert.equal(button(root,'Confirmar requerimiento').props.disabled,false);assert.equal(state.requests.length,0);
});
test('serie parcial sin PPU completa bus, terminal y operador; conserva ceros Aranda',async()=>{
 const root=await mount(Ingress);await change(root,'request-origin','ARANDA');await change(root,'request-reference','AR-00123456');
 await change(root,'request-series','740');assert.equal(state.lookups.at(-1).q,'740');await selectSuggested(root);
 assert.equal(root.findByProps({id:'request-bus'}).props.value,'WXSS18');await read(root);
 assert.equal(state.requests[0].serie,'7404593');assert.equal(state.requests[0].terminal_id,1);assert.equal(state.requests[0].pst_codigo,'PST');
 assert.equal(state.requests[0].referencia_externa,'AR-00123456');assert.equal(state.registrations.length,0);
});
test('sin coincidencia operativa no confunde ausencia con activo no registrado',async()=>{
 state.unknown=true;const root=await mount(Ingress);await change(root,'request-series','NO-EXISTE');
 assert.match(text(root),/No se encontraron activos en operación/);assert.doesNotMatch(text(root),/Activo no registrado en PMP Suite/);
 await read(root);assert.equal(state.requests.length,0);assert.equal(state.registrations.length,0);
});
test('otra selección por serie actualiza una PPU autocompletada sin inventar un conflicto',async()=>{
 const root=await mount(Ingress);await change(root,'request-series','740');await selectSuggested(root);
 assert.equal(root.findByProps({id:'request-bus'}).props.value,'WXSS18');
 await act(async()=>button(root,'Cambiar activo').props.onClick());
 state.assetBus='BJ3070';await change(root,'request-series','7404');await selectSuggested(root);
 assert.equal(root.findByProps({id:'request-bus'}).props.value,'BJ3070');assert.doesNotMatch(text(root),/Conflicto:/);
 assert.equal(button(root,'Confirmar requerimiento').props.disabled,false);
});
test('seleccionar otra serie tras elegir PPU reemplaza toda la instalación y envía solo el contexto final',async()=>{
 const root=await mount(Ingress);await chooseFirstBus(root);assertInstallation(root,installedAssets[0]);
 await change(root,'request-failure','Falla reportada');state.assets=[installedAssets[1]];
 await act(async()=>button(root,'Cambiar activo').props.onClick());assertEmptyInstallation(root);
 await change(root,'request-series','74900');await selectSuggested(root);
 assertInstallation(root,installedAssets[1]);assert.equal(button(root,'Usar bus del activo'),undefined);
 assert.equal(root.findAllByProps({id:'request-asset-options'}).length,0);
 assert.equal(root.findByProps({id:'request-failure'}).props.value,'Falla reportada');
 await read(root);assert.equal(state.requests.length,1);
 const payload=state.requests[0];assert.deepEqual([payload.tipo_equipo,payload.serie,payload.bus_ppu,payload.terminal_id,payload.pst_codigo],['VALIDADOR','7490005','BJ2514',2,'GA']);
 assert.deepEqual(state.activeLookups.at(-1),{tipo:'VALIDADOR',serie:'7490005'});
});
test('selección en explorador reemplaza directamente el activo y la PPU anteriores',async()=>{
 const root=await mount(Ingress);await chooseFirstBus(root);
 const replacement={...installedAssets[1],modelo:'CVB50',marca:'Otra marca',terminal:'Otro terminal'};state.assets=[replacement];
 await act(async()=>button(root,'Buscar / Explorar').props.onClick());
 const dialog=root.findByProps({'aria-labelledby':'request-explorer-title'});await change(dialog,'explorer-series','7490005');
 await act(async()=>button(dialog,'Seleccionar').props.onClick());
 assertInstallation(root,replacement);assert.equal(root.findAllByProps({'aria-labelledby':'request-explorer-title'}).length,0);
 assert.doesNotMatch(text(root),/CVB45|Mikroelektronika|VOYSANTIAGO|El Conquistador/);
 assert.equal(button(root,'Confirmar requerimiento').props.disabled,false);
});
test('seleccionar una serie reemplaza también una PPU escrita sin seleccionar',async()=>{
 const root=await mount(Ingress);await change(root,'request-bus','OTRO');await change(root,'request-series','740');await selectSuggested(root);
 assert.equal(root.findByProps({id:'request-bus'}).props.value,'WXSS18');assert.doesNotMatch(text(root),/Conflicto:/);
 assert.equal(button(root,'Confirmar requerimiento').props.disabled,false);
});
test('cambiar PPU libera el campo y borra activo, serie, terminal y operador antes de otra búsqueda',async()=>{
 const root=await mount(Ingress);await chooseFirstBus(root);await change(root,'request-failure','Se conserva');
 await act(async()=>button(root,'Cambiar bus / PPU').props.onClick());assertEmptyInstallation(root);
 await read(root);assert.equal(state.requests.length,0);
 state.assets=[installedAssets[1]];state.assetBus='BJ2514';await change(root,'request-bus','BJ25');
 assert.doesNotMatch(text(root),/Activo seleccionado:/);
 assert.equal(root.findByProps({id:'request-terminal'}).props.value,'');assert.equal(root.findByProps({id:'request-operator'}).props.value,'');
 assert.deepEqual(state.busLookups.at(-1),{tipo_equipo:'VALIDADOR',bus_ppu:'BJ25'});
 await act(async()=>root.findByProps({id:'request-bus-option-0'}).props.onClick());assertInstallation(root,installedAssets[1]);
 assert.equal(root.findByProps({id:'request-failure'}).props.value,'Se conserva');
});
test('cambiar tipo en ambos sentidos limpia contexto, resultados y advertencias sin buscar con datos anteriores',async()=>{
 const root=await mount(Ingress);
 for(const [current,next] of [['VALIDADOR','CONSOLA'],['CONSOLA','VALIDADOR']]){
  state.assets=[{...installedAssets[0],tipo_equipo:current}];
  state.activeOrders=[{codigo_os:'OS-ACTIVA',bus_ppu:'BJ2149',falla:'Falla',estado_actual:'PENDIENTE_RETIRO'}];
  await change(root,'request-series','74900');await selectSuggested(root);
  assert.match(text(root),/Ya existe una intervención activa/);await read(root);
  const lookups=state.lookups.length,busLookups=state.busLookups.length;
  await change(root,'request-type',next);assertEmptyInstallation(root);
  assert.equal(state.lookups.length,lookups);assert.equal(state.busLookups.length,busLookups);
  assert.doesNotMatch(text(root),/OS-ACTIVA|corrige los conflictos|Verificando intervenciones/);
 }
 assert.equal(state.requests.length,0);
});
test('cambiar activo limpia la instalación, enfoca serie y permite seleccionar 7490005 por búsqueda parcial',async()=>{
 let seriesFocused=0;
 await act(async()=>{renderer=TestRenderer.create(React.createElement(Ingress),{createNodeMock:el=>el.props.id==='request-series'?{focus(){seriesFocused++;}}:null});});
 const root=renderer.root;await chooseFirstBus(root);assertInstallation(root,installedAssets[0]);
 await act(async()=>button(root,'Cambiar activo').props.onClick());assertEmptyInstallation(root);assert.equal(seriesFocused,1);
 state.assets=[installedAssets[1]];await change(root,'request-series','74900');
 assert.equal(state.lookups.at(-1).q,'74900');assert.equal(root.findByProps({id:'request-series'}).props.value,'74900');
 await selectSuggested(root);assertInstallation(root,installedAssets[1]);
 assert.equal(root.findAllByProps({id:'request-asset-options'}).length,0);assert.equal(state.requests.length,0);
});
test('instalación excepcional incompatible sigue bloqueada y una selección válida limpia el conflicto',async()=>{
 state.assets=[{...installedAssets[0],bus_ppu:' BJ2149'}];
 const root=await mount(Ingress);await change(root,'request-series','74900');await selectSuggested(root);
 assert.match(text(root),/Conflicto: los datos del formulario no coinciden/);assert.equal(button(root,'Confirmar requerimiento').props.disabled,true);
 await read(root);assert.equal(state.requests.length,0);
 await act(async()=>button(root,'Cambiar activo').props.onClick());
 state.assets=[installedAssets[1]];await change(root,'request-series','7490005');await selectSuggested(root);
 assertInstallation(root,installedAssets[1]);assert.equal(button(root,'Confirmar requerimiento').props.disabled,false);
 assert.doesNotMatch(text(root),/corrige los conflictos/);
});
test('explorar vacío pagina con límites sin cargar todo el inventario',async()=>{
 const root=await mount(Ingress);assert.equal(state.lookups.length,0);state.moreAssets=true;
 await act(async()=>button(root,'Buscar / Explorar').props.onClick());
 assert.deepEqual(state.lookups.at(-1),{tipo_equipo:'VALIDADOR',limit:20,offset:0});
 assert.equal(root.findByProps({'aria-labelledby':'request-explorer-title'}).findAllByType('table').length,1);assert.equal(root.findAllByProps({id:'request-asset-options'}).length,0);
 assert.equal(state.requests.length,0);
 await act(async()=>button(root,'Siguiente').props.onClick());assert.equal(state.lookups.at(-1).offset,20);
 await act(async()=>button(root,'Anterior').props.onClick());assert.equal(state.lookups.at(-1).offset,0);
});
test('intervención activa muestra datos y enlace; bloquea creación por activo',async()=>{
 state.activeOrders=[{codigo_os:'MV-87126355',caso_id:'7',referencia_ar:'AR-87126355',bus_ppu:'WXSS18',falla:'QR roto',estado_actual:'PENDIENTE_RETIRO',tecnico:'Rodrigo'}];
 const root=await mount(Ingress);await change(root,'request-series','740');await selectSuggested(root);
 for(const part of ['Ya existe una intervención activa para este activo','MV-87126355','AR-87126355','QR roto','PENDIENTE RETIRO','Rodrigo'])assert.ok(text(root).includes(part));
 assert.equal(root.findAllByType('a').find(a=>text(a)==='Ver intervención').props.href,'/trazabilidad?caso=7');
 await read(root);assert.equal(state.requests.length,0);assert.equal(button(root,'Confirmar requerimiento').props.disabled,true);
});

test('combobox compacto presenta serie, modelo, estado y contexto; Escape cierra y Enter selecciona',async()=>{
 state.assets=Array.from({length:8},(_,i)=>({tipo_equipo:'VALIDADOR',serie:`749000${i}`,modelo:'CVB45',marca:'Marca',bus_ppu:'BJ3070',terminal_id:1,terminal:'Terminal',pst_codigo:'PST',operador:'Operador',estado_actual:'EN_OPERACION'}));
 const root=await mount(Ingress);await change(root,'request-series','74900');
 const list=root.findByProps({id:'request-asset-options'});assert.equal(list.findAllByProps({role:'option'}).length,8,'los restantes resultados siguen accesibles por scroll');
 const option=root.findByProps({id:'request-option-0'});assert.equal(option.findByType('strong').children[0],'7490000');
 for(const value of ['CVB45','EN OPERACIÓN','BJ3070 · Terminal · Operador'])assert.ok(text(option).includes(value));
 assert.equal(option.props.tabIndex,-1);
 assert.equal(option.findByProps({className:'status-badge'}).props['data-tone'],'success');
 const key=async key=>act(async()=>root.findByProps({id:'request-series'}).props.onKeyDown({key,preventDefault(){}}));
 await key('Escape');assert.equal(root.findByProps({id:'request-series'}).props['aria-expanded'],false);assert.equal(root.findAllByProps({id:'request-asset-options'}).length,0);
 await key('ArrowDown');for(let i=0;i<6;i++)await key('ArrowDown');
 assert.equal(root.findByProps({id:'request-series'}).props['aria-activedescendant'],'request-option-6');
 await key('Enter');assert.match(text(root),/Activo seleccionado: VALIDADOR · 7490006/);
 assert.equal(root.findAllByProps({id:'request-asset-options'}).length,0);assert.equal(state.requests.length,0);
});

test('explorador inline conserva foco y scroll; cancelar conserva selección y campos',async()=>{
 const previousDocument=globalThis.document;let opened=0,closed=0,focused=0;
 globalThis.document={body:{style:{overflow:'auto'}},activeElement:{focus(){focused++;}}};
 try{
  await act(async()=>{renderer=TestRenderer.create(React.createElement(Ingress),{createNodeMock:el=>el.type==='dialog'?{showModal(){opened++;},close(){closed++;}}:null});});
  const root=renderer.root;await change(root,'request-series','740');await selectSuggested(root);await change(root,'request-failure','Falla que se conserva');
  await act(async()=>button(root,'Buscar / Explorar').props.onClick());
  assert.equal(opened,0);assert.equal(globalThis.document.body.style.overflow,'auto');
  const dialog=root.findByProps({'aria-labelledby':'request-explorer-title'});assert.equal(dialog.props['aria-modal'],undefined);
  await change(dialog,'explorer-series','OTRA');
  await act(async()=>dialog.findByProps({'aria-label':'Cerrar explorador'}).props.onClick());
  assert.equal(root.findAllByProps({'aria-labelledby':'request-explorer-title'}).length,0);assert.equal(closed,0);assert.equal(focused,0);assert.equal(globalThis.document.body.style.overflow,'auto');
  assert.match(text(root),/Activo seleccionado: VALIDADOR · 7404593/);assert.equal(root.findByProps({id:'request-failure'}).props.value,'Falla que se conserva');
  assert.equal(root.findByProps({id:'request-series'}).props.value,'7404593');assert.equal(root.findByProps({id:'request-series'}).props.readOnly,true);assert.equal(state.requests.length,0);
 }finally{await act(async()=>renderer.unmount());renderer=null;globalThis.document=previousDocument;}
});

test('seleccionar en tabla cierra el explorador, sincroniza tarjeta y mantiene bloqueo por intervención activa',async()=>{
 state.activeOrders=[{codigo_os:'MV-87126355',caso_id:'7',bus_ppu:'WXSS18',falla:'QR',estado_actual:'PENDIENTE_RETIRO'}];
 const root=await mount(Ingress);await act(async()=>button(root,'Buscar / Explorar').props.onClick());
 const dialog=root.findByProps({'aria-labelledby':'request-explorer-title'});await act(async()=>button(dialog,'Seleccionar').props.onClick());
 assert.equal(root.findAllByProps({'aria-labelledby':'request-explorer-title'}).length,0);assert.match(text(root),/Activo seleccionado: VALIDADOR · 7404593/);
 assert.equal(root.findByProps({id:'request-bus'}).props.value,'WXSS18');assert.match(text(root),/Ya existe una intervención activa/);
 assert.equal(button(root,'Confirmar requerimiento').props.disabled,true);assert.equal(state.requests.length,0);
});

test('errores y resultado vacío del explorador permanecen en el panel y permiten reintentar',async()=>{
 state.searchError={response:{status:503,data:{message:'Consulta temporalmente no disponible'}}};
 const root=await mount(Ingress);await act(async()=>button(root,'Buscar / Explorar').props.onClick());
 const dialog=root.findByProps({'aria-labelledby':'request-explorer-title'});assert.match(text(dialog.findByProps({role:'alert'})),/temporalmente no disponible/);
 state.searchError=null;state.unknown=true;await act(async()=>button(dialog,'Reintentar búsqueda').props.onClick());
 assert.match(text(dialog),/No se encontraron activos en operación/);assert.equal(button(dialog,'Siguiente').props.disabled,true);
 assert.equal(state.requests.length,0);await act(async()=>dialog.findByProps({'aria-label':'Cerrar explorador'}).props.onClick());
 assert.equal(root.findAllByProps({'aria-labelledby':'request-explorer-title'}).length,0);
});
test('fallo en verificación bloquea y permite reintentar; duplicado surgido después de selección también bloquea',async()=>{
 state.activeError={response:{status:503,data:{message:'Verificación no disponible'}}};
 const root=await mount(Ingress);await change(root,'request-series','740');await selectSuggested(root);
 assert.match(text(root),/Verificación no disponible/);assert.equal(button(root,'Confirmar requerimiento').props.disabled,true);
 state.activeError=null;await act(async()=>button(root,'Reintentar verificación').props.onClick());
 assert.equal(button(root,'Confirmar requerimiento').props.disabled,false);
 state.activeOrders=[{codigo_os:'MV-NUEVA',bus_ppu:'WXSS18',falla:'Nueva',estado_actual:'PENDIENTE_RETIRO'}];await read(root);
 assert.equal(state.requests.length,0);assert.match(text(root),/MV-NUEVA/);
});
test('conflicto al guardar conserva activo y referencia',async()=>{
 const root=await mount(Ingress);await change(root,'request-origin','ARANDA');await change(root,'request-reference','AR-00123456');
 await change(root,'request-series','740');await selectSuggested(root);state.requestError={response:{status:409,data:{message:'El requerimiento ya existe'}}};await read(root);
 assert.match(text(root.findByProps({role:'alert'})),/ya existe/);assert.match(text(root),/7404593/);
 assert.equal(root.findByProps({id:'request-reference'}).props.value,'AR-00123456');
});

for(const [type,classification,prefix] of [['VALIDADOR','MANTENCION','MV'],['CONSOLA','MANTENCION','MC'],['VALIDADOR','POD','PDV'],['CONSOLA','POD','PDC']]){
 test(`crear ${prefix} enlaza a la vista independiente y aparece pendiente de asignación`,async()=>{
  const root=await mount(Ingress);
  assert.doesNotMatch(await readFile(new URL('../src/pages/IngresoRequerimientosPage.tsx',import.meta.url),'utf8'),/TerrainWithdrawalAssignments/);
  assert.doesNotMatch(text(root),/Retiros pendientes de Terreno|Pendientes de asignación|Actualizar retiros/);
  await change(root,'request-type',type);
  await act(async()=>root.findAllByType('select').find(n=>n.props.value==='MANTENCION').props.onChange({target:{value:classification}}));
  await change(root,'request-series','74');await selectSuggested(root);await change(root,'request-failure','Falla del lector');await read(root);
  assert.ok(text(root).includes(`OS ${prefix}-00123456 creada. Pendiente de asignación para retiro en terreno.`));
  assert.equal(root.findAllByType('a').find(a=>text(a)==='Ir a Retiros de terreno').props.href,'/operacion/retiros');
  assert.equal(state.withdrawalReads,0);assert.equal(state.assignments.length,0);
  await act(async()=>renderer.unmount());renderer=null;
  const queue=await mount(Withdrawals),pending=queue.findByProps({'aria-labelledby':'withdrawals-unassigned'});
  assert.match(text(queue),/Retiros de terreno/);assert.ok(text(pending).includes(`${prefix}-00123456`));
  for(const value of ['Sin asignar','Pendiente retiro','Falla del lector','Terminal vigente','Operador vigente','WXSS18'])assert.ok(text(pending).includes(value));
 });
}

const withdrawalRows=root=>root.findAllByType('tr').filter(row=>row.props['aria-label']);
const withdrawalFixture=()=>({codigo_os:'MV-87126356',tipo_equipo:'VALIDADOR',serie:'7490004',modelo:'CVB45',bus_ppu:'BJ2149',terminal:'El Conquistador',operador:'VOYSANTIAGO',falla:'Falla QR',referencia_ar:'AR-87126356',estado_actual:'PENDIENTE_RETIRO',tecnico_terreno_id:null,tecnico:null});
test('retiros muestra contexto de solo lectura; asignar Rodrigo cambia de grupo sin registrar movimiento físico',async()=>{
 state.withdrawals=[withdrawalFixture()];const root=await mount(Withdrawals);
 const pending=()=>root.findByProps({'aria-labelledby':'withdrawals-unassigned'}),assigned=()=>root.findByProps({'aria-labelledby':'withdrawals-assigned'});
 const card=withdrawalRows(pending())[0];
 for(const value of Object.values(withdrawalFixture()).filter(v=>typeof v==='string'&&v!=='PENDIENTE_RETIRO'))assert.ok(text(card).includes(value));
 assert.equal(card.findAllByType('input').length,0);assert.equal(card.findAllByType('textarea').length,0);
 assert.equal(button(card,'Asignar').props.disabled,true);
 await act(async()=>card.findByType('select').props.onChange({target:{value:'tech'}}));
 assert.equal(withdrawalRows(pending()).length,1);assert.equal(withdrawalRows(assigned()).length,0);assert.equal(state.assignments.length,0);
 await act(async()=>button(card,'Asignar').props.onClick());
 assert.deepEqual(state.assignments,[{codigo_os:'MV-87126356',tecnico_terreno_id:'tech'}]);
 assert.equal(withdrawalRows(pending()).length,0);assert.equal(withdrawalRows(assigned()).length,1);
 assert.match(text(assigned()),/Rodrigo Escobar/);assert.match(text(assigned()),/Pendiente retiro/);assert.doesNotMatch(text(assigned()),/En tránsito/);
 assert.equal(button(assigned(),'Cambiar').props.disabled,true);
 assert.deepEqual(state.withdrawals[0],{...withdrawalFixture(),tecnico_terreno_id:'tech',tecnico:'Rodrigo Escobar'});
 assert.equal(state.receiptWrites.length,0);assert.equal(state.dispatches.length,0);assert.equal(state.requests.length,0);
});
test('cambiar técnico conserva el grupo confirmado; un rechazo conserva contexto y permite reintentar',async()=>{
 state.withdrawals=[{...withdrawalFixture(),tecnico_terreno_id:'other',tecnico:'Técnico anterior'}];const root=await mount(Withdrawals);
 const select=root.findByType('select');await act(async()=>select.props.onChange({target:{value:'tech'}}));
 state.assignmentError={response:{status:409,data:{message:'La OS ya fue retirada'}}};
 await act(async()=>button(root,'Cambiar').props.onClick());
 assert.match(text(root.findByProps({role:'alert'})),/ya fue retirada/);assert.match(text(root),/Técnico anterior/);
 assert.equal(root.findByType('select').props.value,'tech');assert.equal(state.withdrawals[0].tecnico_terreno_id,'other');
 state.assignmentError=null;await act(async()=>button(root,'Cambiar').props.onClick());
 assert.match(text(root),/Rodrigo Escobar/);assert.equal(root.findAllByProps({role:'alert'}).length,0);
 state.withdrawals=[];await act(async()=>button(root,'Actualizar retiros').props.onClick());
 assert.equal(withdrawalRows(root).length,0);
});
test('fallo de carga de retiros se muestra y permite actualizar sin crear asignaciones',async()=>{
 state.withdrawalError={response:{status:503,data:{message:'Consulta no disponible'}}};const root=await mount(Withdrawals);
 assert.match(text(root.findByProps({role:'alert'})),/Consulta no disponible/);
 state.withdrawalError=null;state.withdrawals=[withdrawalFixture()];await act(async()=>button(root,'Actualizar retiros').props.onClick());
 assert.equal(withdrawalRows(root).length,1);assert.equal(state.assignments.length,0);
});

test('retiros usa tabla compacta con modelo, badge y acción en la fila; responsive sin duplicar controles',async()=>{
 state.withdrawals=[withdrawalFixture(),{...withdrawalFixture(),codigo_os:'MC-90000001',serie:'CON001',tipo_equipo:'CONSOLA',modelo:'Consola',tecnico_terreno_id:'tech',tecnico:'Rodrigo Escobar'}];
 const root=await mount(Withdrawals);assert.equal(root.findAllByType('table').length,2);
 const summary=root.findByProps({'aria-label':'Resumen de retiros'});
 assert.deepEqual(summary.findAllByProps({className:'stat-value'}).map(text),['1','1']);
 assert.equal(summary.findAllByProps({className:'stat-card','data-variant':'inline'}).length,2);
 assert.equal(root.findAllByProps({className:'table-wrap withdrawal-table-wrap'}).length,2);
 assert.equal(root.findAllByProps({className:'panel withdrawal-group'}).length,2);
 assert.equal(root.findByProps({id:'withdrawal-search'}).props['aria-label'],'Buscar por OS, serie o PPU');
 const row=withdrawalRows(root)[0];assert.equal(row.findAllByType('td').length,8);
 assert.equal(row.findByProps({'data-label':'Equipo'}).findByType('strong').children[0],'7490004');
 assert.match(text(row),/CVB45/);assert.match(text(row.findByProps({'className':'status-badge'})),/Pendiente retiro/);
 const action=row.findByProps({'className':'withdrawal-assignment'});
 assert.equal(action.findAllByType('select').length,1);assert.equal(action.findAllByType('button').length,1);
 assert.equal(root.findAllByType('select').length,2,'una sola acción por OS para desktop y móvil');
 assert.doesNotMatch(text(row),/Sin terminal|Sin operador|Sin referencia|Sin falla|Sin estado/);
 const css=await readFile(new URL('../src/styles/pages.css',import.meta.url),'utf8');
 assert.match(css,/\.withdrawal-table\s*\{[^}]*table-layout: fixed/);
 assert.match(css,/@media \(max-width: 760px\)\s*\{\s*\.withdrawal-table, \.withdrawal-table tbody \{ display: block/);
 assert.match(css,/\.withdrawal-table tr \{ display: grid; grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
});
test('búsqueda parcial por OS, serie o PPU filtra ambos grupos y conserva totales y selección',async()=>{
 state.withdrawals=[withdrawalFixture(),{...withdrawalFixture(),codigo_os:'MC-90000001',serie:'CON001',bus_ppu:'ZZ1234',tecnico_terreno_id:'tech',tecnico:'Rodrigo Escobar'}];
 const root=await mount(Withdrawals);
 await act(async()=>withdrawalRows(root)[0].findByType('select').props.onChange({target:{value:'tech'}}));
 for(const term of [' mv-87126356 ','74900','bj21']){
  await change(root,'withdrawal-search',term);assert.equal(withdrawalRows(root).length,1);assert.match(text(withdrawalRows(root)[0]),/MV-87126356/);
 }
 await change(root,'withdrawal-search','zz12');assert.equal(withdrawalRows(root).length,1);assert.match(text(withdrawalRows(root)[0]),/MC-90000001/);
 await change(root,'withdrawal-search','NO-COINCIDE');assert.equal(withdrawalRows(root).length,0);assert.match(text(root),/No hay coincidencias/);
 assert.deepEqual(root.findByProps({'aria-label':'Resumen de retiros'}).findAllByProps({className:'stat-value'}).map(text),['1','1']);
 await change(root,'withdrawal-search','');assert.equal(withdrawalRows(root).length,2);assert.equal(withdrawalRows(root)[0].findByType('select').props.value,'tech');
 assert.equal(state.assignments.length,0);assert.equal(state.withdrawalReads,1);
});

test('recepción inicial requiere lectura física y conformidad, sin crear OS',async()=>{
  const root=await mount(Management);await change(root,'asset-series','7499001');await change(root,'asset-origin','Compra');
  await act(async()=>root.findAllByType('form')[0].props.onSubmit({preventDefault(){}}));
  await change(root,'asset-reading','7499001');await act(async()=>button(root,'Validar lectura').props.onClick());
  assert.equal(button(root,'Confirmar recepción inicial').props.disabled,true);assert.equal(state.receptions.length,0);
  await change(root,'asset-capture','SCANNER');await assetWedge(root,'7499001');
  assert.equal(button(root,'Confirmar recepción inicial').props.disabled,true);
  await act(async()=>root.findByProps({id:'asset-conforme'}).props.onChange({target:{checked:true}}));
  assert.equal(button(root,'Confirmar recepción inicial').props.disabled,false);
  await act(async()=>root.findAllByType('form')[2].props.onSubmit({preventDefault(){}}));
  assert.equal(state.receptions[0].escaneo_id,'111');assert.equal(state.receptions[0].validacion_inicial_conforme,true);
  assert.equal('bus_ppu' in state.receptions[0],false);assert.equal(state.requests.length,0);
  assert.match(text(root),/No se ha creado ninguna OS/);
});

test('rechazo de recepción queda inline y cambiar lectura invalida evidencia',async()=>{
  const root=await mount(Management);await change(root,'asset-series','7499001');await change(root,'asset-origin','Compra');
  await act(async()=>root.findAllByType('form')[0].props.onSubmit({preventDefault(){}}));
  await change(root,'asset-capture','SCANNER');await assetWedge(root,'7499001');
  await act(async()=>root.findByProps({id:'asset-conforme'}).props.onChange({target:{checked:true}}));
  await change(root,'asset-reading','OTRO');assert.equal(button(root,'Confirmar recepción inicial').props.disabled,true);
  await assetWedge(root,'7499001');
  state.receptionError={response:{status:409,data:{message:'Escanea físicamente este activo en Bodega'}}};
  await act(async()=>root.findAllByType('form')[2].props.onSubmit({preventDefault(){}}));
  assert.match(text(root.findByProps({role:'alert'})),/Escanea físicamente/);
  assert.equal(root.findByProps({id:'asset-reading'}).props.value,'7499001');assert.equal(button(root,'Confirmar recepción inicial').props.disabled,true);
});

async function assetWedge(root,code){let time=100;for(const key of [...code,'Enter']){await act(async()=>root.findByProps({id:'asset-reading'}).props.onKeyDown({key,timeStamp:time,nativeEvent:{isTrusted:true},preventDefault(){}}));time+=10;}}
async function newAsset(root){
  await change(root,'asset-series','7201234');await change(root,'asset-origin','Compra');
  await act(async()=>root.findAllByType('form')[0].props.onSubmit({preventDefault(){}}));
}
async function checked(root,id,value=true){await act(async()=>root.findByProps({id}).props.onChange({target:{checked:value}}));}
async function manualReady(root){
  await newAsset(root);await change(root,'asset-capture','MANUAL_AUTORIZADO');
  await change(root,'asset-reading','7201234');await checked(root,'asset-present');
  await act(async()=>button(root,'Validar lectura').props.onClick());
}

test('seleccionar resultado abre detalle inline, muestra detalle y cerrar conserva filtros',async()=>{
  const previousDocument=globalThis.document;
  globalThis.document={body:{style:{overflow:'auto'}}};
  let opened=0,closed=0;
  try{
    await act(async()=>{renderer=TestRenderer.create(React.createElement(Management),{createNodeMock:el=>el.type==='dialog'?{showModal(){opened++;},close(){closed++;}}:null});});
    const root=renderer.root;
    const searchForm=root.findAllByType('form')[1];
    await act(async()=>searchForm.findByType('input').props.onChange({target:{value:'740'}}));
    await act(async()=>searchForm.props.onSubmit({preventDefault(){}}));
    const table=root.findByType('table');assert.equal(table.props['aria-label'],'Activos registrados');
    assert.deepEqual(table.findAllByType('th').map(text),['Activo','Estado / PPU','Acción']);
    assert.equal(table.findByProps({className:'status-badge'}).props['data-tone'],'success');
    await act(async()=>root.findByProps({'aria-label':'Ver detalle de 7404593'}).props.onClick());
    assert.equal(opened,0);assert.equal(globalThis.document.body.style.overflow,'auto');
    const dialog=root.findByProps({role:'region'});
    for(const value of ['VALIDADOR','7404593','CVB45','Known','En operación','WXSS18','Ver historial del activo'])assert.ok(text(dialog).includes(value));
    assert.equal(button(dialog,'Confirmar recepción inicial'),undefined);
    await act(async()=>dialog.findByProps({'aria-label':'Cerrar detalle'}).props.onClick());
    assert.equal(root.findAllByProps({role:'region'}).length,0);assert.equal(closed,0);
    assert.equal(globalThis.document.body.style.overflow,'auto');
    assert.equal(root.findAllByType('form')[1].findByType('input').props.value,'740');
    assert.ok(root.findByProps({'aria-label':'Ver detalle de 7404593'}));assert.equal(state.receptions.length,0);assert.equal(state.receptionScans.length,0);
  }finally{await act(async()=>renderer.unmount());renderer=null;globalThis.document=previousDocument;}
});

test('manual autorizado exige presencia, serie exacta y conformidad independiente',async()=>{
  const root=await mount(Management);await newAsset(root);
  await change(root,'asset-capture','MANUAL_AUTORIZADO');await change(root,'asset-reading','7201234');
  assert.equal(button(root,'Validar lectura').props.disabled,true);
  await checked(root,'asset-present');await act(async()=>button(root,'Validar lectura').props.onClick());
  assert.equal(state.receptionScans[0].origen_captura,'MANUAL_AUTORIZADO');
  assert.equal(state.receptionScans[0].presencia_fisica_confirmada,true);
  assert.match(text(root),/Ingreso manual autorizado validado/);
  assert.equal(button(root,'Confirmar recepción inicial').props.disabled,true);
  await checked(root,'asset-conforme');assert.equal(button(root,'Confirmar recepción inicial').props.disabled,false);
  await act(async()=>root.findAllByType('form')[2].props.onSubmit({preventDefault(){}}));
  assert.equal(state.receptions[0].validacion_id,'222');assert.equal('escaneo_id' in state.receptions[0],false);
  assert.match(text(root.findByProps({role:'region'})),/No se ha creado ninguna OS/);
  assert.equal(state.requests.length,0);assert.equal(state.dispatches.length,0);
});

test('serie manual incorrecta o con espacios bloquea inline sin solicitar captura ni eventos',async()=>{
  const root=await mount(Management);await newAsset(root);await change(root,'asset-capture','MANUAL_AUTORIZADO');
  await checked(root,'asset-present');await checked(root,'asset-conforme');
  for(const value of ['7201235','7201234 ',' 7201234']){
    await change(root,'asset-reading',value);await act(async()=>button(root,'Validar lectura').props.onClick());
    assert.match(text(root.findByProps({role:'region'}).findByProps({role:'alert'})),/exactamente/);
    assert.equal(button(root,'Confirmar recepción inicial').props.disabled,true);
  }
  assert.equal(state.receptionScans.length,0);assert.equal(state.receptions.length,0);
});

test('cambiar origen o revocar presencia invalida la evidencia manual',async()=>{
  const root=await mount(Management);await manualReady(root);await checked(root,'asset-conforme');
  assert.equal(button(root,'Confirmar recepción inicial').props.disabled,false);
  await checked(root,'asset-present',false);assert.equal(button(root,'Confirmar recepción inicial').props.disabled,true);
  await checked(root,'asset-present');await act(async()=>button(root,'Validar lectura').props.onClick());
  await change(root,'asset-capture','MANUAL');assert.equal(button(root,'Confirmar recepción inicial').props.disabled,true);
  await act(async()=>button(root,'Validar lectura').props.onClick());
  assert.equal(button(root,'Confirmar recepción inicial').props.disabled,true);
});

test('4xx manual permanece dentro del panel y conserva la serie y conformidad',async()=>{
  const root=await mount(Management);await manualReady(root);await checked(root,'asset-conforme');
  state.receptionError={response:{status:409,data:{message:'Valida nuevamente la presencia física'}}};
  await act(async()=>root.findAllByType('form')[2].props.onSubmit({preventDefault(){}}));
  const dialog=root.findByProps({role:'region'});
  assert.match(text(dialog.findByProps({role:'alert'})),/presencia física/);
  assert.equal(dialog.findByProps({id:'asset-reading'}).props.value,'7201234');
  assert.equal(dialog.findByProps({id:'asset-conforme'}).props.checked,true);
  assert.equal(button(dialog,'Confirmar recepción inicial').props.disabled,true);
});

test('solo admin y logistica ven la alternativa de ingreso manual autorizado',async()=>{
  for(const role of ['admin','logistica','gerente','tecnico_terreno','tecnico_laboratorio','qa']){
    state.role=role;const root=await mount(Management);await newAsset(root);
    assert.equal(root.findAllByProps({value:'MANUAL_AUTORIZADO'}).length>0,['admin','logistica'].includes(role));
    await act(async()=>renderer.unmount());renderer=null;
  }
});

const nativeMock=url(`import React from ${JSON.stringify(import.meta.resolve('react'))};
  const s=globalThis.__requirementsTest;
  export const Button='Button',View='View',Text='Text',TouchableOpacity='TouchableOpacity',ActivityIndicator='ActivityIndicator',RefreshControl='RefreshControl',TextInput='TextInput',Switch='Switch',ScrollView='ScrollView',Ionicons='Ionicons',Image='Image',CameraView='CameraView';
  export const useCameraPermissions=()=>[{granted:s.cameraGranted},async()=>({granted:s.cameraGranted})];
  export const requestCameraPermissionsAsync=async()=>({granted:s.cameraGranted});
  export const launchCameraAsync=async()=>({canceled:s.photoCanceled,assets:[{base64:'aGVsbG8=',uri:'file:///photo.jpg'}]});
  export const Modal=({visible,children,...props})=>visible?React.createElement('Modal',props,children):null;
  export const FlatList=({data,renderItem,ListHeaderComponent})=>React.createElement('List',null,ListHeaderComponent,data.map(item=>React.createElement(React.Fragment,{key:item.codigo_os},renderItem({item}))));
  export const useAuth=()=>({user:{rol:s.role},loading:false,sessionError:''});
  export const StyleSheet={create:x=>x},Platform={OS:'android'},Alert={alert(){}};
  export const apiErrorMessage=e=>e.response?.data?.message||'Sin conexión. Reintenta.';
  export const getGlobalStyles=()=>({}),getTheme=()=>({}),usePmpTheme=()=>({}),colors={}; const navigation={navigate:(...args)=>s.navigation=args,addListener:()=>()=>{}}; export const useNavigation=()=>navigation;
  export default {get:async(path)=>({data:path==='/os/activos-operativos'?{items:s.assets||[],has_more:false}:s.historyFixture||[{codigo_os:'MV-87126356',tipo_equipo:'VALIDADOR',serie:'7490004',bus_ppu:'BJ2149',estado_id:1,estado_nombre:'PENDIENTE_RETIRO',modelo:'CVB45',marca:'Mikroelektronika',terminal:'El Conquistador',operador:'VOYSANTIAGO',falla:'Falla QR',referencia_ar:'AR-87126356',tecnico:'Rodrigo Escobar'}]}),post:async(path,payload)=>{s.requests.push({path,payload});if(s.error)throw s.error;
    return {data:path==='/os/crear'?{os:{codigo_os:'MV-FIXTURE'}}:path.endsWith('validar-identidad-retiro')?{validacion_id:'99',metodo_validacion:payload.metodo_validacion,codigo_leido:payload.codigo_leido,coincide:payload.codigo_leido==='7490004',encontrado:{tipo_equipo:'VALIDADOR',serie:payload.codigo_leido}}:{}};}};`);
const nativeImports=Object.fromEntries(['react-native','@expo/vector-icons','../services/api','../constants/styles','../context/AuthContext','@react-navigation/native','expo-camera','expo-image-picker'].map(key=>[key,nativeMock]));
const nativeUi=await compile('../07_Mobile/src/components/PmpUi.js',{...nativeImports,'../../../shared/assetIdentity.js':new URL('../../shared/assetIdentity.js',import.meta.url).href});
nativeImports['../components/PmpUi']=nativeUi;
const nativeWithdrawal=await compile('../07_Mobile/src/components/TerrainWithdrawalForm.js',nativeImports);
const {default:WithdrawalForm}=await import(nativeWithdrawal);
const {default:MobileOrders}=await import(await compile('../07_Mobile/src/screens/MyOrdersScreen.js',{...nativeImports,'../components/TerrainWithdrawalForm':nativeWithdrawal}));
const nativeAction=(root,label)=>root.findAllByType('TouchableOpacity').find(n=>n.props.accessibilityLabel===label||text(n)===label);
const press=async(root,label)=>act(async()=>nativeAction(root,label).props.onPress());
const nativeInput=async(root,label,value)=>act(async()=>root.findByProps({accessibilityLabel:label}).props.onChangeText(value));
async function openWithdrawal(){
   const {default:api}=await import(nativeMock);const {data}=await api.get();
   await act(async()=>{renderer=TestRenderer.create(React.createElement(WithdrawalForm,{order:data[0],onClose(){},onSuccess(){state.withdrawalDone=true;}}));});return renderer.root;
  }
async function cameraIdentity(root,code='7490004'){await press(root,'Escanear equipo');await act(async()=>root.findByType('CameraView').props.onBarcodeScanned({data:code}));}
async function physicalConfirmation(root){await act(async()=>root.findByProps({accessibilityLabel:'Confirmar retiro físico'}).props.onValueChange(true));}

test('mobile autocompleta contexto sin redigitación; SCAN + No no exige foto y un error conserva tarea',async()=>{
 const root=await openWithdrawal();
 for(const value of ['7490004','BJ2149','El Conquistador','VOYSANTIAGO','CVB45','Mikroelektronika','AR-87126356','Falla QR','Pendiente de retiro'])assert.ok(text(root).includes(value),value);
 assert.equal(root.findAllByProps({accessibilityLabel:'Serie del retiro'}).length,0);assert.equal(root.findAllByProps({accessibilityLabel:'Bus del retiro'}).length,0);
 assert.equal(nativeAction(root,'Confirmar retiro hacia Bodega').props.disabled,true);
 await cameraIdentity(root);assert.match(text(root),/Equipo validado/);
 assert.equal(state.requests[0].payload.metodo_validacion,'SCAN');assert.equal(root.findByProps({accessibilityLabel:'Confirmar retiro físico'}).props.disabled,true);
 await press(root,'No');await nativeInput(root,'Observación del retiro','Retirado físicamente');
 assert.equal(nativeAction(root,'Confirmar retiro hacia Bodega').props.disabled,true);await physicalConfirmation(root);
 assert.equal(nativeAction(root,'Confirmar retiro hacia Bodega').props.disabled,false);
 state.error={response:{status:500,data:{message:'No se pudo guardar el retiro'}}};await press(root,'Confirmar retiro hacia Bodega');
 assert.match(text(root),/No se pudo guardar/);assert.equal(root.findByProps({accessibilityLabel:'Observación del retiro'}).props.value,'Retirado físicamente');
 state.error=null;await press(root,'Confirmar retiro hacia Bodega');assert.equal(state.withdrawalDone,true);
 assert.deepEqual(state.requests.at(-1).payload.fotografias,[]);assert.equal(state.requests.at(-1).payload.bus_ppu,'BJ2149');assert.equal(state.requests.at(-1).payload.serie,'7490004');
});
test('mobile equipo distinto registra discrepancia sin retirar ni cambiar contexto',async()=>{
 const root=await openWithdrawal();await cameraIdentity(root,'7499999');assert.match(text(root),/Equipo distinto al esperado/);
 assert.equal(nativeAction(root,'Confirmar retiro hacia Bodega').props.disabled,true);
 await nativeInput(root,'Observación de discrepancia','Equipo encontrado diferente');await press(root,'Registrar discrepancia');
 assert.equal(state.requests.at(-1).path,'/os/discrepancia-retiro');assert.match(text(root),/No se confirmó el retiro/);
 assert.equal(state.requests.some(r=>r.path==='/os/confirmar-retiro'),false);assert.match(text(root),/7490004/);
});
test('mobile PoD exige categoría, observación y foto; cancelar cámara o eliminar foto bloquea',async()=>{
 const root=await openWithdrawal();await cameraIdentity(root);await press(root,'Sí');await press(root,'Golpe');await nativeInput(root,'Observación técnica','Carcasa rota');
 assert.equal(root.findByProps({accessibilityLabel:'Confirmar retiro físico'}).props.disabled,true);
 state.photoCanceled=true;await press(root,'Tomar fotografía PoD');assert.equal(root.findAllByType('Image').length,0);
 state.photoCanceled=false;await press(root,'Tomar fotografía PoD');assert.equal(root.findAllByType('Image').length,1);await physicalConfirmation(root);
 assert.equal(nativeAction(root,'Confirmar retiro hacia Bodega').props.disabled,false);
 await press(root,'Eliminar foto 1');assert.equal(nativeAction(root,'Confirmar retiro hacia Bodega').props.disabled,true);
 await press(root,'Tomar fotografía PoD');await physicalConfirmation(root);await press(root,'Confirmar retiro hacia Bodega');
 const payload=state.requests.at(-1).payload;assert.equal(payload.pod,true);assert.equal(payload.categoria_pod,'GOLPE');assert.equal(payload.fotografias[0].origen,'CAMARA');assert.equal(payload.codigo_os,'MV-87126356');
});
test('mobile cámara denegada permite contingencia explícita MANUAL; serie incorrecta bloquea',async()=>{
 state.cameraGranted=false;const root=await openWithdrawal();await press(root,'Escanear equipo');assert.match(text(root),/No hay permiso de cámara/);assert.equal(root.findAllByType('CameraView').length,0);
 await press(root,'No puedo escanear el código');await nativeInput(root,'Serie manual','7490005');await press(root,'Cámara no disponible');await nativeInput(root,'Observación de contingencia','Permiso denegado, serie visible');
 await press(root,'Validar serie manual');assert.equal(nativeAction(root,'Confirmar retiro hacia Bodega').props.disabled,true);
 await nativeInput(root,'Serie manual','7490004');await press(root,'Validar serie manual');assert.equal(state.requests.at(-1).payload.metodo_validacion,'MANUAL');
 await press(root,'No');await nativeInput(root,'Observación del retiro','Equipo retirado');await physicalConfirmation(root);await press(root,'Confirmar retiro hacia Bodega');
 assert.equal(root.findAllByType('Modal').length,0);assert.equal(state.requests.at(-1).payload.validacion_id,'99');
});

test('buscar maestro sin coincidencias permite corregir filtros sin registrar ni recepcionar',async()=>{
 const root=await mount(Management);
 assert.match(text(root),/Consulta el maestro de activos/);
 state.unknown=true;
 await change(root,'asset-search-series','NO-EXISTE');
 await act(async()=>root.findAllByType('form')[1].props.onSubmit({preventDefault(){}}));
 assert.match(text(root),/No hay coincidencias/);assert.equal(root.findAllByType('table').length,0);
 assert.equal(root.findByProps({id:'asset-search-series'}).props.value,'NO-EXISTE');
 state.unknown=false;await change(root,'asset-search-series','740');
 await act(async()=>root.findAllByType('form')[1].props.onSubmit({preventDefault(){}}));
 assert.ok(root.findByProps({'aria-label':'Ver detalle de 7404593'}));
 assert.equal(state.registrations.length,0);assert.equal(state.receptions.length,0);
});

const {default:MobileHistory}=await import(await compile('../07_Mobile/src/screens/AssetHistoryScreen.js',nativeImports));
test('historial Mobile presenta retiro y foto PoD tanto por activo como por caso',async()=>{
 for(const caso of [false,true]){
  const metadata={pod:true,fotografias:[{mime:'image/jpeg',base64:'aGVsbG8='}]};
  state.historyFixture={tipo_equipo:'VALIDADOR',serie:'7490004',caso:{codigo_caso:'AR-87126356'},ordenes:[],referencias:[],eventos:[{id:'1',tipo:'RETIRO_TERRENO_CONFIRMADO',titulo:'Retiro físico confirmado',codigo_os:'MV-87126356',fecha:'2026-10-03',descripcion:'Bus BJ2149 · Escaneo con cámara',cambios:[],detalle:caso?metadata:{metadata}}]};
  await act(async()=>{renderer=TestRenderer.create(React.createElement(MobileHistory,{route:{params:caso?{caso_id:'1'}:{tipo_equipo:'VALIDADOR',serie:'7490004'}}}));});
  const root=renderer.root;
  assert.match(text(root),/Retiro físico confirmado/);assert.match(text(root),/PoD detectado/);assert.match(text(root),/BJ2149/);
  assert.equal(root.findByType('Image').props.source.uri,'data:image/jpeg;base64,aGVsbG8=');
  await act(async()=>renderer.unmount());renderer=null;
 }
});

for(const optionalPhoto of [false,true])for(const changeFromPod of [false,true]){
 test(`mobile retiro normal sin observación: foto opcional ${optionalPhoto}, cambio Sí a No ${changeFromPod}`,async()=>{
  const root=await openWithdrawal();await cameraIdentity(root);
  assert.equal(root.findByProps({accessibilityLabel:'Confirmar retiro físico'}).props.disabled,true);
  assert.equal(nativeAction(root,'Confirmar retiro hacia Bodega').props.disabled,true);
  if(changeFromPod){
    await press(root,'Sí');
    if(optionalPhoto)await press(root,'Tomar fotografía PoD');
    assert.equal(root.findByProps({accessibilityLabel:'Confirmar retiro físico'}).props.disabled,true);
  }
  await press(root,'No');
  if(optionalPhoto&&!changeFromPod)await press(root,'Agregar evidencia fotográfica');
  assert.equal(root.findByProps({accessibilityLabel:'Observación del retiro'}).props.value,'');
  assert.match(text(root),/fotografías son opcionales/);
  assert.equal(root.findByProps({accessibilityLabel:'Confirmar retiro físico'}).props.disabled,false);
  assert.equal(nativeAction(root,'Confirmar retiro hacia Bodega').props.disabled,true);
  await physicalConfirmation(root);
  assert.equal(nativeAction(root,'Confirmar retiro hacia Bodega').props.disabled,false);
  await press(root,'Confirmar retiro hacia Bodega');
  const payload=state.requests.at(-1).payload;
  assert.equal(payload.pod,false);assert.equal(payload.categoria_pod,null);assert.equal(payload.evidencia,'');
  assert.equal(payload.fotografias.length,optionalPhoto?1:0);
  assert.equal(root.findAllByType('Modal').length,0);
 });
}

const traceMock=url(`import React from ${JSON.stringify(import.meta.resolve('react'))};
 const s=globalThis.__requirementsTest;
 const setParams=()=>{};
 export const useSearchParams=()=>[new URLSearchParams(s.traceCase?'caso=1':'tipo=VALIDADOR&serie=7490004'),setParams];
 export const useOutletContext=()=>({rol:'logistica'});
 export const Link=({children,to,...props})=>React.createElement('a',{href:to,...props},children);
 export const assetHistoryUrl=()=>'/trazabilidad',caseHistoryUrl=()=>'/trazabilidad?caso=1';
 export const getAssetHistory=async()=>s.traceFixture,getCaseHistory=getAssetHistory;
 export const searchAssets=async()=>[],getCases=searchAssets,derivePod=()=>{};
 export const can=()=>false,PERMISSIONS={};
`);
const pageHeader=await compile('src/components/ui/PageHeader.tsx');
const tracePresentation=await compile('src/utils/traceabilityPresentation.ts',{'./formatters':formatters});
const traceTimeline=await compile('src/components/AssetTimeline.tsx',{'lucide-react':import.meta.resolve('lucide-react'),'../utils/labTechnicalWork':labTechnicalWork,'./ui/EmptyState':emptyState,'./ui/StatusBadge':statusBadge,'./ui/EmptyState':emptyState,'../utils/formatters':formatters,'../utils/traceabilityPresentation':tracePresentation});
const {default:Traceability}=await import(await compile('src/pages/TrazabilidadPage.tsx',{
 ...imports,'../components/AssetTimeline':traceTimeline,'../utils/traceabilityPresentation':tracePresentation,'react-router-dom':traceMock,'../api/bridge':traceMock,'../api/requerimientos':traceMock,'../app/rbac':traceMock,'../components/ui/PageHeader':pageHeader
}));
for(const caseView of [false,true])test(`trazabilidad ${caseView?'caso':'activo'} presenta retiro compacto y detalle legible`,async()=>{
 state.traceCase=caseView;
 const metadata={modelo:'CVB45',marca:'Mikroelektronika',codigo_caso:'AR-87126356',terminal:'El Conquistador',operador:'VOYSANTIAGO',tipo_equipo:'VALIDADOR',serie:'7490004',bus_ppu:'BJ2149',tecnico:'Rodrigo Escobar',metodo_validacion:'SCAN',codigo_leido:'7490004',pod:false,coincide:true,esperado:{serie:'7490004'},encontrado:{serie:'7490004'},estado_nuevo:'EN_TRANSITO'};
 state.traceFixture={tipo_equipo:'VALIDADOR',serie:'7490004',caso:{origen:'ARANDA',fecha_requerimiento:'2026-10-02T10:19:00Z',codigo_caso:'AR-87126356',tipo_equipo:'VALIDADOR',serie_origen:'7490004',bus_ppu:'BJ2149',terminal:'El Conquistador',falla_reportada:'Falla QR'},
 ordenes:[{codigo_os:'MV-87126356',tipo_equipo:'VALIDADOR',serie:'7490004',fecha:'2026-10-04T03:58:00Z',falla:'Falla QR',estado:'EN_TRANSITO',estado_nombre:'EN_TRANSITO',ubicacion:null,bus_ppu:'BJ2149',tecnico_nombre:'Rodrigo Escobar'}],referencias:[{id:'ref:1',sistema_externo:'ARANDA',referencia_externa:'AR-87126356',codigo_os:'MV-87126356',fecha:'2026-10-02T10:19:00Z'}],
 eventos:[{id:'1',codigo_os:'MV-87126356',fecha:'2026-10-04T03:58:00Z',tipo:'VALIDACION_IDENTIDAD_RETIRO',titulo:'Validación de identidad no coincidente',descripcion:'No coincide; no confirma retiro',detalle:{...metadata,coincide:false,encontrado:{serie:'7490999'},codigo_leido:'7490999'},cambios:[]},
 {id:'2',codigo_os:'MV-87126356',fecha:'2026-10-04T03:58:00Z',tipo:'RETIRO_TERRENO_CONFIRMADO',titulo:'Retiro físico confirmado',detalle:metadata,cambios:[]}]};
 const attempts=['2026-10-03T23:56:00Z','2026-10-04T00:14:00Z','2026-10-04T03:26:00Z','2026-10-04T03:58:00Z'].map((fecha,i)=>({id:'validation:'+i,codigo_os:'MV-87126356',fecha,tipo:'VALIDACION_IDENTIDAD_RETIRO',detalle:metadata,cambios:[]}));
 state.traceFixture.eventos.push(...attempts,
 {id:'technical',codigo_os:'MV-87126356',fecha:'2026-10-04T03:58:00Z',tipo:'OS_ACTUALIZADA',detalle:{anterior:{estado_id:1,ubicacion_id:null},actual:{estado_id:2,ubicacion_id:null}},cambios:[{campo:'Estado',anterior:'Pendiente de retiro',actual:'En tránsito hacia Bodega'}]},
 {id:'assigned',codigo_os:'MV-87126356',fecha:'2026-10-02T21:15:00Z',tipo:'RETIRO_ASIGNADO',detalle:{tecnico:'Rodrigo Escobar'}},
 {id:'request',codigo_os:'MV-87126356',fecha:'2026-10-02T10:19:00Z',tipo:'REQUERIMIENTO_INGRESADO',detalle:{codigo_caso:'AR-87126356',falla_reportada:'Falla QR'}},
 {id:'created',codigo_os:'MV-87126356',fecha:'2026-10-02T10:19:00Z',tipo:'OS_CREADA',detalle:{}});
 const root=await mount(Traceability);
 assert.match(text(root),/En tránsito hacia Bodega/);assert.match(text(root),/Validación de identidad no coincidente/);
 assert.doesNotMatch(text(root),/EN_RUTA|EN_TRANSITO|PENDIENTE_RETIRO|Sin ubicación/);
 const event=root.findAllByType('article').find(n=>text(n).includes('Retiro físico confirmado'));
 assert.equal(event.findByType('details').props.open,undefined);
 assert.match(text(event),/Escaneo con cámara/);assert.match(text(event),/PoD: No/);
 assert.match(text(event),/Pendiente de retiro → En tránsito hacia Bodega/);
 assert.equal(event.findByType('summary').props.className,'trace-entry-summary');
 assert.ok(event.findAllByProps({className:'status-badge'}).length);
 assert.ok(root.findAllByProps({className:'withdrawal-table'}).length);
 assert.match(text(root.findByProps({'aria-label':'Resumen del activo'})),/7490004.*CVB45.*Mikroelektronika/);
 assert.match(text(root),/4 validaciones realizadas durante el retiro/);
 assert.equal(root.findByProps({'aria-label':'Intentos de validación'}).findAllByType('li').length,4);
 assert.equal(root.findAllByType('article').filter(n=>text(n.findByType('summary')).includes('Identidad del equipo validada')).length,1);
 assert.ok(!root.findAllByType('article').some(n=>text(n.findByType('summary')).includes('OS actualizada')));
 assert.match(text(event),/OS actualizada/);

 if(process.env.PMP_TRACE_RENDER_DIR){
   const {writeFile,mkdir}=await import('node:fs/promises');
   const {renderToStaticMarkup}=await import('react-dom/server');
   const element=n=>n===null?null:typeof n==='string'?n:Array.isArray(n)?n.map(element):React.createElement(n.type,n.props,...(n.children||[]).map(element));
   const css=(await Promise.all(['tokens','base','layout','components','pages'].map(name=>readFile(new URL('../src/styles/'+name+'.css',import.meta.url),'utf8')))).join('\n');
   const html=renderToStaticMarkup(element(renderer.toJSON()));
   await mkdir(process.env.PMP_TRACE_RENDER_DIR,{recursive:true});
   for(const theme of ['light','dark'])await writeFile(process.env.PMP_TRACE_RENDER_DIR+'/'+(caseView?'case':'asset')+'-'+theme+'.html','<!DOCTYPE html><html data-theme="'+theme+'"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>'+css+'</style><body><main class="app-content">'+html+'</main></body></html>');
 }
});

const traceHelpers=await import(tracePresentation);
test('agrupación visual conserva auditoría, separa métodos y no oculta cambios adicionales',()=>{
 const scan={id:'scan1',tipo:'VALIDACION_IDENTIDAD_RETIRO',codigo_os:'MV-TEST',fecha:'2026-10-04T03:58:00Z',detalle:{serie:'TEST',coincide:true,metodo_validacion:'SCAN',codigo_leido:'TEST'}};
 const events=[scan,{...scan,id:'scan2'},{...scan,id:'manual',detalle:{...scan.detalle,metodo_validacion:'MANUAL'}},{...scan,id:'wrong',detalle:{...scan.detalle,coincide:false}}];
 const original=JSON.stringify(events),grouped=traceHelpers.buildTimeline(events);
 assert.equal(JSON.stringify(events),original);assert.equal(grouped.length,3);assert.equal(grouped.find(e=>e.id==='scan1').attempts.length,2);
 const alreadyGrouped={...scan,detalle:{...scan.detalle,intentos:[scan,{...scan,id:'scan2'}]}};
 assert.equal(traceHelpers.buildTimeline([alreadyGrouped,scan])[0].attempts.length,2);
 const withdrawal={id:'retire',tipo:'RETIRO_TERRENO_CONFIRMADO',codigo_os:'MV-TEST',fecha:scan.fecha,detalle:{}};
 const change={id:'update',tipo:'OS_ACTUALIZADA',codigo_os:'MV-TEST',fecha:scan.fecha,detalle:{anterior:{estado_id:1,falla:'QR'},actual:{estado_id:2,falla:'Otra falla'}}};
 assert.equal(traceHelpers.buildTimeline([withdrawal,change]).length,2);
 assert.equal(traceHelpers.buildTimeline([withdrawal,{...change,detalle:{anterior:{estado_id:1},actual:{estado_id:2}}}]).length,1);
 assert.equal(traceHelpers.buildTimeline([withdrawal,{...change,codigo_os:'OTRA',detalle:{anterior:{estado_id:1},actual:{estado_id:2}}}]).length,2);
 assert.equal(traceHelpers.historyLocation({codigo_os:'TEST',estado:'EN_TRANSITO',ubicacion:null}),'En tránsito hacia Bodega');
 assert.equal(traceHelpers.historyState('INSTALADO'),'Instalado');
 assert.equal(traceHelpers.historyLocation({codigo_os:'TEST',estado:'INSTALADO',ubicacion:'BJ2149'}),'BJ2149');
 assert.equal(traceHelpers.historyLocation({codigo_os:'TEST',estado:'INSTALADO',ubicacion:'BUS'}),'Bus');
});

test('recepción scanner rechaza digitación, pegado, teclas lentas y eventos sintéticos',async()=>{
 const root=await reception();
 assert.equal(root.findByProps({id:'receipt-reading'}).props.readOnly,true);
 await change(root,'receipt-reading','7490010');await read(root);assert.equal(state.receiptReads.length,0);
 await act(async()=>root.findByProps({id:'receipt-reading'}).props.onPaste({preventDefault(){}}));assert.equal(state.receiptReads.length,0);
 await wedge(root,'7490010',200);assert.equal(state.receiptReads.length,0);
 await wedge(root,'7490010',10,false);assert.equal(state.receiptReads.length,0);
 assert.equal(button(root,'Confirmar recepción en Bodega').props.disabled,true);
 await wedge(root,'7490010');assert.equal(state.receiptReads.length,1);assert.equal(state.receiptReads[0].origen_captura,'SCANNER');
 assert.equal(button(root,'Confirmar recepción en Bodega').props.disabled,false);assert.match(text(root),/Equipo validado/);
 await act(async()=>renderer.unmount());renderer=null;assert.equal(state.receiptWrites.length,0);
});
test('recepción no coincidente muestra esperado y encontrado sin habilitar recepción',async()=>{
 const root=await reception();await wedge(root,'7490999');
 assert.match(text(root),/Equipo distinto al esperado/);assert.match(text(root),/Esperado: 7490010/);assert.match(text(root),/Encontrado: 7490999/);
 assert.equal(button(root,'Confirmar recepción en Bodega').props.disabled,true);assert.equal(state.receiptWrites.length,0);
});
test('recepción manual exige motivo y conserva permiso explícito',async()=>{
 const root=await reception();await change(root,'receipt-capture','MANUAL_AUTORIZADO');await change(root,'receipt-reading','7490010');await checked(root,'receipt-present');await read(root);
 assert.equal(state.receiptReads.length,0);
 await change(root,'receipt-reason','Pistola sin conexión');await read(root);
 assert.equal(state.receiptReads[0].motivo,'Pistola sin conexión');assert.equal(state.receiptReads[0].origen_captura,'MANUAL_AUTORIZADO');
});

test('formulario de recepción muestra contexto readonly, permisos y estados visuales PMP',async()=>{
 const root=await reception();
 for(const value of ['CVB45','Mikroelektronika','El Conquistador','VOYSANTIAGO','Rodrigo Escobar','AR-87126355'])assert.ok(text(root).includes(value));
 assert.equal(root.findByProps({id:'receipt-reading'}).props.autoFocus,true);
 assert.equal(root.findAllByType('input').length,1);
 const save=async name=>{
  if(!process.env.PMP_RECEIPT_RENDER_DIR)return;
  const {writeFile,mkdir}=await import('node:fs/promises'),{renderToStaticMarkup}=await import('react-dom/server');
  const element=n=>n===null?null:typeof n==='string'?n:Array.isArray(n)?n.map(element):React.createElement(n.type,n.props,...(n.children||[]).map(element));
  const css=(await Promise.all(['tokens','base','layout','components','pages'].map(n=>readFile(new URL('../src/styles/'+n+'.css',import.meta.url),'utf8')))).join('\n');
  await mkdir(process.env.PMP_RECEIPT_RENDER_DIR,{recursive:true});
  for(const theme of ['light','dark'])await writeFile(process.env.PMP_RECEIPT_RENDER_DIR+'/'+name+'-'+theme+'.html','<!DOCTYPE html><html data-theme="'+theme+'"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>'+css+'</style><body>'+renderToStaticMarkup(element(renderer.toJSON()))+'</body></html>');
 };
 await save('scanner');
 await wedge(root,'7490010');await save('validated');
 await wedge(root,'7490999');await save('mismatch');
 await change(root,'receipt-capture','MANUAL_AUTORIZADO');await change(root,'receipt-reading','7490010');await change(root,'receipt-reason','Escáner sin conexión');await checked(root,'receipt-present');await save('manual');
 await act(async()=>renderer.unmount());renderer=null;
 const readOnly=await reception('gerente');assert.equal(readOnly.findAllByProps({value:'MANUAL_AUTORIZADO'}).length,0);
});

const warehouseMock=url(`import React from ${JSON.stringify(import.meta.resolve('react'))};
const s=globalThis.__requirementsTest;
export const useNavigate=()=>((...args)=>s.navigation=args);
export const useOutletContext=()=>({rol:s.role});
export function useSearchParams(){const [p,set]=React.useState(new URLSearchParams());return [p,v=>set(new URLSearchParams(v))];}
export const can=()=>s.role==='logistica',PERMISSIONS={BODEGA_WRITE:'warehouse'};
export const getBodegaQueue=async()=>s.warehouseTickets;
export const getQaUsers=async()=>[{id:'qa1',nombre:'Ana',apellido:'QA'}];
export const receiveInBodega=async c=>s.warehouseWrites.push(['receive',c]);
export const dispatchToLab=async c=>s.warehouseWrites.push(['lab',c]);
export const dispatchToQa=async(c,q)=>s.warehouseWrites.push(['qa',c,q]);
export default ()=>null;`);
const {default:Warehouse}=await import(await compile('src/pages/BodegaPage.tsx',{
 ...imports,'lucide-react':import.meta.resolve('lucide-react'),'react-router-dom':warehouseMock,
 '../api/bodega':warehouseMock,'../app/rbac':warehouseMock,
 '../components/ReadOnlyNotice':warehouseMock,'../components/WarehouseReceptionForm':warehouseMock,
 '../components/ui/PageHeader':pageHeader
}));
const warehouseFixture=[
 {codigo_os:'MV-TEST01',estado_id:2,fue_laboratorio:false},
 {codigo_os:'MC-TEST02',estado_id:3,fue_laboratorio:false},
 {codigo_os:'MV-TEST03',estado_id:3,fue_laboratorio:true,es_aprobado_qa:null}
].map((o,i)=>({...o,tipo_equipo:i===1?'CONSOLA':'VALIDADOR',serie:'TEST-'+i,modelo:'Modelo de prueba',marca:'Marca de prueba',bus_ppu:'TEST01',terminal:'Terminal de prueba',operador:'Operador de prueba',falla:'Falla de prueba',estado_nombre:'INTERNAL_CODE'}));
async function mountWarehouse(empty=false){
 globalThis.window={setTimeout,clearTimeout,dispatchEvent(){}};
 state.warehouseTickets=empty?[]:warehouseFixture;state.warehouseWrites=[];
 return mount(Warehouse);
}
test('bodega comparte contexto, badges, acciones y contadores en sus tres etapas',async()=>{
 const root=await mountWarehouse();
 for(const [i,label,status] of [[0,'Preparar recepción','En tránsito hacia Bodega'],[1,'Preparar envío a Laboratorio','En Bodega'],[2,'Preparar envío a QA','Pendiente control QA']]){
  await act(async()=>root.findAllByProps({role:'tab'})[i].props.onClick());
  assert.deepEqual(root.findAllByProps({className:'tab-count'}).map(text),['1','1','1']);
  const card=root.findByType('article');
  for(const value of [warehouseFixture[i].codigo_os,'TEST-'+i,'Modelo de prueba','Marca de prueba','TEST01','Terminal de prueba','Operador de prueba','Falla de prueba',status])assert.ok(text(card).includes(value),value);
  assert.ok(!text(card).includes('INTERNAL_CODE'));
  assert.equal(button(root,label).props.className,'btn logistics-action');
  assert.equal(button(root,label).props['data-tone'],undefined);
 }
 assert.equal(root.findAllByType('select').length,0,'logística no elige certificador');
 await act(async()=>button(root,'Preparar envío a QA').props.onClick());
 assert.equal(state.navigation[0],'/bodega/envios-qa/MV-TEST03');assert.equal(state.warehouseWrites.length,0);
 await act(async()=>root.findAllByProps({role:'tab'})[1].props.onClick());
 await act(async()=>button(root,'Preparar envío a Laboratorio').props.onClick());
 assert.equal(state.warehouseWrites.length,0,'preparar no despacha');
});
test('bodega conserva permisos de lectura y no expone acciones de escritura',async()=>{
 state.role='gerente';const root=await mountWarehouse();
 for(let i=0;i<3;i++){
  await act(async()=>root.findAllByProps({role:'tab'})[i].props.onClick());
  assert.equal(root.findAllByProps({className:'btn logistics-action'}).length,0);
 }
 assert.equal(state.warehouseWrites.length,0);
});
for(const empty of [false,true])test('bodega renderiza tres etapas '+(empty?'vacías':'con datos'),async()=>{
 const root=await mountWarehouse(empty);
 for(const [i,name] of ['transito','para-lab','para-qa'].entries()){
  await act(async()=>root.findAllByProps({role:'tab'})[i].props.onClick());
  if(empty){
   assert.equal(root.findAllByType('article').length,0);
   assert.match(text(root.findByProps({className:'empty-state-title'})),/^No hay equipos pendientes de/);
   assert.deepEqual(root.findAllByProps({className:'tab-count'}).map(text),['0','0','0']);
  }
  if(process.env.PMP_WAREHOUSE_RENDER_DIR){
   const {mkdir,writeFile}=await import('node:fs/promises'),{renderToStaticMarkup}=await import('react-dom/server');
   const element=n=>n===null?null:typeof n==='string'?n:Array.isArray(n)?n.map(element):React.createElement(n.type,n.props,...(n.children||[]).map(element));
   const css=(await Promise.all(['tokens','base','layout','components','pages'].map(n=>readFile(new URL('../src/styles/'+n+'.css',import.meta.url),'utf8')))).join('\n');
   await mkdir(process.env.PMP_WAREHOUSE_RENDER_DIR,{recursive:true});
   for(const theme of ['light','dark'])await writeFile(process.env.PMP_WAREHOUSE_RENDER_DIR+'/'+name+'-'+(empty?'empty':'data')+'-'+theme+'.html','<!DOCTYPE html><html data-theme="'+theme+'"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>'+css+'</style><body><main class="app-content">'+renderToStaticMarkup(element(renderer.toJSON()))+'</main></body></html>');
  }
 }
});

test('salida a laboratorio valida sin mover, cancela y muestra errores inline',async()=>{
 let root=await reception('logistica','lab');
 assert.ok(text(root).includes('Enviar a Laboratorio'));
 assert.equal(button(root,'Confirmar envío a Laboratorio').props.disabled,true);
 await wedge(root,'7490010',150);
 assert.equal(state.receiptReads.length,0);
 await wedge(root,'7490999');assert.equal(button(root,'Confirmar envío a Laboratorio').props.disabled,true);
 await wedge(root,'7490010');assert.equal(button(root,'Confirmar envío a Laboratorio').props.disabled,false);
 assert.equal(state.receiptWrites.length,0);
 await act(async()=>renderer.unmount());renderer=null;assert.equal(state.receiptWrites.length,0);
 root=await reception('logistica','lab');await wedge(root,'7490010');
 state.error={response:{status:409,data:{message:'Valida nuevamente la salida'}}};
 await act(async()=>button(root,'Confirmar envío a Laboratorio').props.onClick());
 assert.match(text(root.findByProps({role:'alert'})),/Valida nuevamente/);
 assert.equal(button(root,'Confirmar envío a Laboratorio').props.disabled,true);
});
test('salida manual exige serie, motivo, presencia y conserva origen autorizado',async()=>{
 const root=await reception('logistica','lab');
 await change(root,'receipt-capture','MANUAL_AUTORIZADO');
 await change(root,'receipt-reading','7490999');await change(root,'receipt-reason','Sin pistola');await checked(root,'receipt-present');await read(root);
 assert.equal(state.receiptReads.length,0);
 await change(root,'receipt-reading','7490010');await read(root);
 assert.equal(state.receiptReads[0].origen_captura,'MANUAL_AUTORIZADO');assert.equal(state.receiptWrites.length,0);
 await act(async()=>button(root,'Confirmar envío a Laboratorio').props.onClick());
 assert.equal(state.receiptWrites[0].validacion_id,'44');
});
test('formulario de salida a laboratorio muestra contexto readonly, permisos y estados visuales PMP',async()=>{
 const root=await reception('logistica','lab');
 for(const value of ['CVB45','Mikroelektronika','El Conquistador','VOYSANTIAGO','Rodrigo Escobar','AR-87126355'])assert.ok(text(root).includes(value));
 assert.equal(root.findByProps({id:'receipt-reading'}).props.autoFocus,true);
 assert.equal(root.findAllByType('input').length,1);
 const save=async name=>{
  if(!process.env.PMP_LAB_RENDER_DIR)return;
  const {writeFile,mkdir}=await import('node:fs/promises'),{renderToStaticMarkup}=await import('react-dom/server');
  const element=n=>n===null?null:typeof n==='string'?n:Array.isArray(n)?n.map(element):React.createElement(n.type,n.props,...(n.children||[]).map(element));
  const css=(await Promise.all(['tokens','base','layout','components','pages'].map(n=>readFile(new URL('../src/styles/'+n+'.css',import.meta.url),'utf8')))).join('\n');
  await mkdir(process.env.PMP_LAB_RENDER_DIR,{recursive:true});
  for(const theme of ['light','dark'])await writeFile(process.env.PMP_LAB_RENDER_DIR+'/'+name+'-'+theme+'.html','<!DOCTYPE html><html data-theme="'+theme+'"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>'+css+'</style><body>'+renderToStaticMarkup(element(renderer.toJSON()))+'</body></html>');
 };
 await save('scanner');
 await wedge(root,'7490010');await save('validated');
 await wedge(root,'7490999');await save('mismatch');
 await change(root,'receipt-capture','MANUAL_AUTORIZADO');await change(root,'receipt-reading','7490010');await change(root,'receipt-reason','Escáner sin conexión');await checked(root,'receipt-present');await save('manual');
 await act(async()=>renderer.unmount());renderer=null;
 const readOnly=await reception('gerente','lab');assert.equal(readOnly.findAllByProps({value:'MANUAL_AUTORIZADO'}).length,0);
});

test('historial presenta envío laboratorio con título, método y destino legibles',async()=>{
 const {eventTitle}=await import(tracePresentation);
 assert.equal(eventTitle({tipo:'SALIDA_BODEGA_LABORATORIO'}),'Envío a Laboratorio confirmado');
 assert.equal(eventTitle({tipo:'DISCREPANCIA_SALIDA_LAB'}),'Validación de salida no coincidente');
 const {default:Timeline}=await import(traceTimeline);
 await act(async()=>{renderer=TestRenderer.create(React.createElement(Timeline,{events:[{id:'lab1',tipo:'SALIDA_BODEGA_LABORATORIO',codigo_os:'MV-TEST',fecha:'2026-10-05T12:00:00Z',detalle:{metadata:{metodo_validacion:'MANUAL_AUTORIZADO',serie:'TEST1',usuario_nombre:'Logística prueba',falla:'Falla QR'}}}]}));});
 for(const label of ['Envío a Laboratorio confirmado','Bodega → Laboratorio','Ingreso manual autorizado','En tránsito','Falla QR','Logística prueba'])assert.ok(text(renderer.root).includes(label));
});

const labSla=await compile('src/utils/sla.ts');
const labWorkload=await compile('src/utils/labWorkload.ts',{'./sla':labSla});
const labAssignmentMock=url(`import React from ${JSON.stringify(import.meta.resolve('react'))};
 const s=globalThis.__requirementsTest;
 export const useSearchParams=()=>{const [p,set]=React.useState(new URLSearchParams());return [p,v=>set(new URLSearchParams(v))];};
 export const useNavigate=()=>((...args)=>s.navigation=args);
export const useOutletContext=()=>({rol:s.role});
 export const can=()=>s.role==='admin',PERMISSIONS={LAB_ASSIGN:'lab'};
 export const getLabTechnicians=async()=>[{id:'tech1',nombre:'Ana',apellido:'Laboratorio'}];
 export const getLabQueue=async type=>s.labTickets.filter(t=>t.tipo_equipo===type);
 export const assignTicket=async(code,id)=>{s.labWrites.push({code,id});if(s.labFailure)throw {response:{data:{message:'No se pudo asignar'}}};};
`);
const {default:LabAssignment}=await import(await compile('src/pages/LabAsignacionPage.tsx',{
 ...imports,'lucide-react':import.meta.resolve('lucide-react'),'react-router-dom':labAssignmentMock,
 '../api/lab':labAssignmentMock,'../app/rbac':labAssignmentMock,'../components/ui/PageHeader':pageHeader,
 '../components/ui/StatCard':statCard,'../utils/sla':labSla,'../utils/health':health,'../utils/labWorkload':labWorkload
}));
const ago=hours=>new Date(Date.now()-hours*3600000).toISOString();
const labFixtures=()=>[
 {codigo_os:'MV-TEST-NEW',serie:'TEST-NEW',fecha:ago(2),fecha_ingreso_laboratorio:ago(1)},
 {codigo_os:'MV-TEST-OLD',serie:'TEST-OLD',fecha:ago(4),fecha_ingreso_laboratorio:ago(3)},
 {codigo_os:'MV-TEST-LATE',serie:'TEST-LATE',fecha:ago(100),fecha_ingreso_laboratorio:ago(90)},
 {codigo_os:'MV-TEST-NEAR',serie:'TEST-NEAR',fecha:ago(60),fecha_ingreso_laboratorio:ago(55)},
 {codigo_os:'MV-TEST-ASSIGNED',serie:'TEST-ASSIGNED',fecha:ago(120),fecha_ingreso_laboratorio:ago(4),tecnico_laboratorio_id:'tech1'},
].map(t=>({...t,tipo_equipo:'VALIDADOR',estado_id:4,estado_nombre:'EN_DIAGNOSTICO',modelo:'CVB45',bus_ppu:'TEST01',falla:'Falla QR',ubicacion:'Laboratorio Garantías'}));
async function mountLab(tickets=labFixtures(),role='admin'){
 globalThis.window={setTimeout,clearTimeout};state.role=role;state.labTickets=tickets;state.labWrites=[];state.labFailure=false;
 return mount(LabAssignment);
}
const labRows=root=>root.findByType('tbody').findAllByType('tr');
test('carga abre pendientes, ordena SLA y fecha de ingreso descendente y conserva Todos',async()=>{
 const root=await mountLab();
 assert.equal(root.findAllByProps({role:'tab'})[0].props['aria-selected'],true);
 assert.deepEqual(root.findAllByProps({className:'tab-count'}).map(text),['4','1','5']);
 assert.deepEqual(labRows(root).map(r=>text(r.findAllByType('td')[0])),['MV-TEST-LATE','MV-TEST-NEAR','MV-TEST-NEW','MV-TEST-OLD']);
 assert.ok(!text(root).includes('MV-TEST-ASSIGNED'));
 for(const value of ['CVB45','Falla QR','Laboratorio Garantías','En diagnóstico','SLA vencido','Próximo a vencer'])assert.ok(text(root).includes(value));
 await act(async()=>root.findAllByProps({role:'tab'})[2].props.onClick());
 assert.equal(labRows(root).length,5);assert.ok(text(labRows(root).at(-1)).includes('MV-TEST-ASSIGNED'));
});
test('asignar requiere confirmar, cambia de pestaña sin cambiar estado; permite reasignar y quitar',async()=>{
 const fixture=labFixtures().slice(0,1),root=await mountLab(fixture);
 const select=root.findByType('select');
 await act(async()=>select.props.onChange({target:{value:'tech1'}}));
 assert.equal(state.labWrites.length,0);
 await act(async()=>button(root,'Asignar').props.onClick());
 assert.equal(root.findAllByType('tbody').length,0);
 assert.deepEqual(root.findAllByProps({className:'tab-count'}).map(text),['0','1','1']);
 await act(async()=>root.findAllByProps({role:'tab'})[1].props.onClick());
 assert.ok(text(root).includes('En diagnóstico'));assert.ok(text(root).includes('Ana Laboratorio'));
 assert.deepEqual(state.labWrites,[{code:'MV-TEST-NEW',id:'tech1'}]);
 await act(async()=>root.findByType('select').props.onChange({target:{value:''}}));
 await act(async()=>button(root,'Guardar').props.onClick());
 assert.deepEqual(root.findAllByProps({className:'tab-count'}).map(text),['1','0','1']);
});
test('carga conserva permisos y error sin perder selección',async()=>{
 let root=await mountLab(labFixtures(),'gerente');
 assert.equal(root.findAllByType('select').length,0);
 await act(async()=>renderer.unmount());renderer=null;
 root=await mountLab(labFixtures().slice(0,1));
 await act(async()=>root.findByType('select').props.onChange({target:{value:'tech1'}}));
 state.labFailure=true;await act(async()=>button(root,'Asignar').props.onClick());
 assert.ok(text(root).includes('No se pudo asignar'));assert.equal(root.findByType('select').props.value,'tech1');assert.equal(labRows(root).length,1);
});
test('carga usa ingreso real para desempate y rotula fallback histórico',async()=>{
 const {compareLabWorkload}=await import(labWorkload);
 const fixture=labFixtures().slice(0,2);
 fixture[0].fecha=ago(20);fixture[1].fecha=ago(1);
 assert.equal([...fixture].sort(compareLabWorkload)[0].codigo_os,'MV-TEST-NEW');
 delete fixture[0].fecha_ingreso_laboratorio;
 const root=await mountLab(fixture);assert.ok(text(root).includes('Fecha OS · ingreso no registrado'));
});
for(const empty of [false,true])test('render bandeja laboratorio '+(empty?'vacía':'con carga'),async()=>{
 const root=await mountLab(empty?[]:labFixtures());
 for(const [i,name] of ['pending','assigned','all'].entries()){
  await act(async()=>root.findAllByProps({role:'tab'})[i].props.onClick());
  if(empty)assert.equal(text(root.findByProps({className:'empty-state-title'})),['No hay equipos pendientes de asignación.','No hay equipos asignados actualmente.','No hay equipos en Laboratorio.'][i]);
  if(process.env.PMP_LAB_ASSIGN_RENDER_DIR){
   const {mkdir,writeFile}=await import('node:fs/promises'),{renderToStaticMarkup}=await import('react-dom/server');
   const element=n=>n===null?null:typeof n==='string'?n:Array.isArray(n)?n.map(element):React.createElement(n.type,n.props,...(n.children||[]).map(element));
   const css=(await Promise.all(['tokens','base','layout','components','pages'].map(n=>readFile(new URL('../src/styles/'+n+'.css',import.meta.url),'utf8')))).join('\n');
   await mkdir(process.env.PMP_LAB_ASSIGN_RENDER_DIR,{recursive:true});
   for(const theme of ['light','dark'])await writeFile(process.env.PMP_LAB_ASSIGN_RENDER_DIR+'/'+name+'-'+(empty?'empty':'data')+'-'+theme+'.html','<!DOCTYPE html><html data-theme="'+theme+'"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>'+css+'</style><body><main class="app-content">'+renderToStaticMarkup(element(renderer.toJSON()))+'</main></body></html>');
  }
 }
});

test('SLA laboratorio usa ciclo real en OS antigua, reingreso y fallback explícito',async()=>{
 const {labSLA,labArrival,labArrivalLabel}=await import(labWorkload);
 const ticket={...labFixtures()[0],codigo_os:'MV-87126356',serie:'7490004',fecha:ago(200),fecha_ingreso_laboratorio:ago(1),fuente_ingreso_laboratorio:'ENVIO_BODEGA'};
 assert.equal(labSLA(ticket).vencido,false);assert.equal(labSLA(ticket).critico,false);
 assert.equal(labArrivalLabel(ticket),'Recepción física en Laboratorio confirmada');
 const root=await mountLab([ticket]);
 assert.ok(text(root).includes('MV-87126356'));assert.ok(!text(root).includes('ingreso no registrado'));assert.ok(!text(root).includes('SLA vencido'));
 assert.equal(labArrivalLabel({...ticket,reingreso_laboratorio:true}),'Reingreso a Laboratorio');
 assert.equal(labSLA({...ticket,reingreso_laboratorio:true}).vencido,false);
 const fallback={...ticket,fecha_ingreso_laboratorio:null};
 assert.equal(labArrival(fallback),ticket.fecha);assert.equal(labSLA(fallback).vencido,true);
 assert.equal(labArrivalLabel(fallback),'Fecha OS · ingreso no registrado');
});
test('vistas SLA de laboratorio comparten fuente temporal y umbrales intactos',async()=>{
 for(const path of ['src/pages/LabAsignacionPage.tsx','src/pages/LabDashboardPage.tsx']){
  const source=await readFile(new URL('../'+path,import.meta.url),'utf8');
  assert.match(source,/labSLA\(ticket\)/);assert.doesNotMatch(source,/calculateSLA\(ticket.fecha\)/);
 }
 const sla=await import(labSla);assert.equal(sla.SLA_HOURS_LIMIT,72);
});

const technicianMock=url(`import React from ${JSON.stringify(import.meta.resolve('react'))};
const s=globalThis.__requirementsTest;
export const getLabQueue=async type=>s.techRows.filter(t=>t.tipo_equipo===type&&t.estado_id!==10);
export const getCompletedLab=async()=>s.techRows.filter(t=>t.estado_id===10);
export const useNavigate=()=>((...args)=>s.navigation=args); export const useLocation=()=>({pathname:'/mi-jornada'});
`);
const {default:TechWork}=await import(await compile('src/components/LabTechnicianWorklist.tsx',{
 'lucide-react':import.meta.resolve('lucide-react'),'../api/lab':technicianMock,'../utils/labWorkload':labWorkload,
 '../utils/formatters':formatters,'../utils/health':health,'react-router-dom':technicianMock,
 './ui/PageHeader':pageHeader,'./ui/StatCard':statCard,'../utils/labTechnicalWork':labTechnicalWork,'./ui/EmptyState':emptyState,'./ui/StatusBadge':statusBadge,'./ui/EmptyState':emptyState,'./ui/FeedbackBanner':banner
}));
const techFixtures=()=>[
 {...labFixtures()[0],codigo_os:'MV-87126356',serie:'7490004',referencia_ar:'AR-87126356',fecha:'2026-10-02T12:00:00Z',fecha_ingreso_laboratorio:'2026-10-06T12:07:37Z',fuente_ingreso_laboratorio:'RECEPCION_FISICA'},
 {...labFixtures()[1],codigo_os:'MV-REPAIR',estado_id:5,estado_nombre:'EN_REPARACION'},
 {...labFixtures()[2],codigo_os:'MC-READY',tipo_equipo:'CONSOLA',estado_id:10,estado_nombre:'REPARADO'},
 {...labFixtures()[3],codigo_os:'MV-WAIT',estado_id:9,estado_nombre:'ESPERA_REPUESTO'},
 {...labFixtures()[4],codigo_os:'MV-PRIVATE',tecnico_laboratorio_id:'other'},
].map(t=>({...t,tecnico_laboratorio_id:t.codigo_os==='MV-PRIVATE'?'other':'self',recepcion_laboratorio_confirmada:true}));
async function mountTech(empty=false){
 state.techRows=empty?[]:techFixtures();
 await act(async()=>{renderer=TestRenderer.create(React.createElement(TechWork,{me:{id:'self',rol:'tecnico_laboratorio',nombre:'Técnico prueba'}}));});
 return renderer.root;
}
test('Mi carga filtra al técnico, inicia Pendientes y busca OS/serie/AR/PPU sin mutaciones',async()=>{
 const root=await mountTech();
 assert.equal(root.findAllByProps({role:'tab'})[0].props['aria-selected'],true);
 assert.deepEqual(root.findAllByProps({className:'tab-count'}).map(text),['1','2','1','4']);
 assert.ok(text(root).includes('MV-87126356'));assert.ok(text(root).includes('En diagnóstico'));assert.ok(!text(root).includes('EN_DIAGNOSTICO'));
 assert.ok(!text(root).includes('ingreso no registrado'));assert.ok(!text(root).includes('Abrir bandeja de trabajo'));
 for(const query of ['7490004','MV-87126356','AR-87126356','TEST01']){
  await act(async()=>root.findByProps({'aria-label':'Buscar en mi carga'}).props.onChange({target:{value:query}}));
  assert.ok(text(root).includes('MV-87126356'));
 }
 await act(async()=>root.findAllByProps({role:'tab'})[3].props.onClick());
 await act(async()=>root.findByProps({'aria-label':'Buscar en mi carga'}).props.onChange({target:{value:'MV-PRIVATE'}}));
 assert.ok(text(root).includes('Sin coincidencias'));assert.equal(state.techRows[0].estado_id,4);
});
test('Abrir trabajo reutiliza reparación y abrir/cerrar no cambia estado ni fecha',async()=>{
 const root=await mountTech(),before=JSON.stringify(state.techRows);
 await act(async()=>button(root,'Abrir trabajo').props.onClick());
 assert.equal(state.navigation[0],'/mi-carga/MV-87126356');assert.equal(JSON.stringify(state.techRows),before);
 await act(async()=>renderer.unmount());renderer=null;
 state.techRows[0].recepcion_laboratorio_confirmada=false;
 await act(async()=>{renderer=TestRenderer.create(React.createElement(TechWork,{me:{id:'self',rol:'tecnico_laboratorio'}}));});
 assert.equal(button(renderer.root,'Abrir trabajo').props.disabled,true);
});
for(const empty of [false,true])test('render Mi carga '+(empty?'vacía':'con datos'),async()=>{
 const root=await mountTech(empty);
 for(const [i,name] of ['pending','repair','ready','all'].entries()){
  await act(async()=>root.findAllByProps({role:'tab'})[i].props.onClick());
  if(!empty&&i===3)assert.equal(labRows(root).length,4);
  if(!process.env.PMP_TECH_RENDER_DIR)continue;
  const {mkdir,writeFile}=await import('node:fs/promises'),{renderToStaticMarkup}=await import('react-dom/server');
  const element=n=>n===null?null:typeof n==='string'?n:Array.isArray(n)?n.map(element):React.createElement(n.type,n.props,...(n.children||[]).map(element));
  const css=(await Promise.all(['tokens','base','layout','components','pages'].map(n=>readFile(new URL('../src/styles/'+n+'.css',import.meta.url),'utf8')))).join('\n');
  await mkdir(process.env.PMP_TECH_RENDER_DIR,{recursive:true});
  for(const theme of ['light','dark'])await writeFile(process.env.PMP_TECH_RENDER_DIR+'/'+name+'-'+(empty?'empty':'data')+'-'+theme+'.html','<!DOCTYPE html><html data-theme="'+theme+'"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>'+css+'</style><body><main class="app-content">'+renderToStaticMarkup(element(renderer.toJSON()))+'</main></body></html>');
 }
});

test('Mi carga prioriza SLA y antigüedad del ingreso real, no número ni fecha OS',async()=>{
 state.techRows=[2,60,90,5].map((hours,i)=>({...techFixtures()[0],codigo_os:'MV-SORT-'+i,fecha:ago(200-i),fecha_ingreso_laboratorio:ago(hours)}));
 await act(async()=>{renderer=TestRenderer.create(React.createElement(TechWork,{me:{id:'self',rol:'tecnico_laboratorio'}}));});
 assert.deepEqual(labRows(renderer.root).map(row=>text(row.findAllByType('td')[0]).split('AR-')[0]),['MV-SORT-2','MV-SORT-1','MV-SORT-3','MV-SORT-0']);
});

test('tránsito laboratorio nunca inicia SLA ni usa fallback OS',async()=>{
 const {labArrival,labSLA,labArrivalLabel}=await import(labWorkload);
 const transit={...labFixtures()[0],fecha:ago(200),fecha_ingreso_laboratorio:null,ingreso_legacy:false,en_transito_laboratorio:true};
 assert.equal(labArrival(transit),'');assert.equal(labSLA(transit).sinSla,true);
 assert.equal(labArrivalLabel(transit),'Pendiente de recepción física en Laboratorio');
 const received={...transit,en_transito_laboratorio:false,fecha_ingreso_laboratorio:ago(1)};
 assert.equal(labSLA(received).vencido,false);
});

test('trazabilidad distingue salida, recepción física histórica y asignación sin alterar eventos',async()=>{
 const {default:Timeline}=await import(traceTimeline);
 const events=[
 {id:'exit',tipo:'SALIDA_BODEGA_LABORATORIO',codigo_os:'MV-TEST',fecha:'2026-10-05T15:55:00Z',comentario:'En Bodega → En diagnóstico.',detalle:{metadata:{serie:'TEST',metodo_validacion:'MANUAL_AUTORIZADO'}}},
 {id:'receipt',tipo:'UBICACION_FISICA_CONFIRMADA',codigo_os:'MV-TEST',fecha:'2026-10-06T12:07:37Z',detalle:{metadata:{estacion:'LABORATORIO',ubicacion:'Laboratorio Garantías'}}},
 {id:'assigned',tipo:'TECNICO_LABORATORIO_ASIGNADO',codigo_os:'MV-TEST',fecha:'2026-10-06T12:08:00Z',detalle:{metadata:{tecnico_laboratorio_id:'fixture'}}}
 ];
 const before=JSON.stringify(events);
 await act(async()=>{renderer=TestRenderer.create(React.createElement(Timeline,{events}));});
 for(const value of ['Bodega → Laboratorio · En tránsito','Recepción física en Laboratorio confirmada','Laboratorio Garantías','Técnico de Laboratorio asignado'])assert.ok(text(renderer.root).includes(value),value);
 assert.ok(!text(renderer.root).includes('En Bodega → En diagnóstico'));assert.equal(JSON.stringify(events),before);
 if(process.env.PMP_TECH_RENDER_DIR){
  const {writeFile,mkdir}=await import('node:fs/promises'),{renderToStaticMarkup}=await import('react-dom/server');
  const element=n=>n===null?null:typeof n==='string'?n:Array.isArray(n)?n.map(element):React.createElement(n.type,n.props,...(n.children||[]).map(element));
  const css=(await Promise.all(['tokens','base','layout','components','pages'].map(n=>readFile(new URL('../src/styles/'+n+'.css',import.meta.url),'utf8')))).join('\n');
  await mkdir(process.env.PMP_TECH_RENDER_DIR,{recursive:true});
  for(const theme of ['light','dark'])await writeFile(process.env.PMP_TECH_RENDER_DIR+'/timeline-'+theme+'.html','<!DOCTYPE html><html data-theme="'+theme+'"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>'+css+'</style><body><main class="app-content">'+renderToStaticMarkup(element(renderer.toJSON()))+'</main></body></html>');
 }
});

// Operational pages: direct URL resolution always rechecks the authorized queue.
const pageMock=url(`import React from ${JSON.stringify(import.meta.resolve('react'))};
const s=globalThis.__requirementsTest;
export const useParams=()=>({osId:s.pageOs}); export const useLocation=()=>({state:{from:'/mi-jornada'}});
export const useOutletContext=()=>s.pageMe;
export const Link=({to,children,...props})=>React.createElement('a',{...props,href:to},children);
export const getLabQueue=async type=>s.techRows.filter(t=>t.tipo_equipo===type);
export const getBodegaQueue=async()=>s.warehouseTickets;
export const moveTicket=async(os,state)=>{s.requests.push({os,state});};
export const api={
 get:async path=>{s.labReads.push(path);if(path.endsWith('/parts'))throw Error('Inventario prohibido al técnico');if(s.labReadError)throw s.labReadError;return {data:path.endsWith('/parts')?s.labParts:s.labSnapshot};},
 put:async(path,payload)=>{s.requests.push({path,payload});if(s.labWriteError)throw s.labWriteError;s.labSnapshot={revision:String(s.requests.length),trabajo:structuredClone(payload.trabajo)};return {data:s.labSnapshot};},
 post:async(path,payload)=>{s.requests.push({path,payload});if(s.labWriteError)throw s.labWriteError;return {data:{success:true}};}
};
`);
const realRbac=await compile('src/app/rbac.ts');
const realRepair=await compile('src/components/RepairWorkForm.tsx',{'lucide-react':import.meta.resolve('lucide-react'),'../api/lab':pageMock,'../api/http':pageMock,'../api/errors':errors,'../data/fallas':await compile('src/data/fallas.ts'),'./ui/FeedbackBanner':banner,'../utils/labTechnicalWork':labTechnicalWork,'./ui/EmptyState':emptyState,'./ui/StatusBadge':statusBadge});
const pageImports={'react-router-dom':pageMock,'lucide-react':import.meta.resolve('lucide-react'),'../api/lab':pageMock,'../api/bodega':pageMock,'../app/rbac':realRbac,'../utils/labWorkload':labWorkload,'../utils/formatters':formatters,'../components/ui/PageHeader':pageHeader,'../components/ui/FeedbackBanner':banner,'../components/ui/StatusBadge':statusBadge,'../components/RepairWorkForm':realRepair,'../components/WarehouseReceptionForm':await compile('src/components/WarehouseReceptionForm.tsx',{'lucide-react':import.meta.resolve('lucide-react'),'./ui/FeedbackBanner':banner,'../utils/labTechnicalWork':labTechnicalWork,'./ui/EmptyState':emptyState,'./ui/StatusBadge':statusBadge,'../api/errors':errors,'../utils/receiptScanner':receiptScanner})};
const {default:LabWorkPage}=await import(await compile('src/pages/LabWorkPage.tsx',pageImports));
const {default:WarehousePage}=await import(await compile('src/pages/WarehouseOperationPage.tsx',pageImports));
test('página técnica: entrar, volver y recargar no escriben; solo Iniciar trabajo transiciona',async()=>{
 state.pageMe={id:'self',rol:'tecnico_laboratorio'};state.pageOs='MV-87126356';state.techRows=techFixtures();
 let root=await mount(LabWorkPage);assert.match(text(root),/Trabajo aún no iniciado/);assert.equal(state.requests.length,0);assert.equal(root.findAllByProps({role:'dialog'}).length,0);
 assert.equal(root.findAllByType('a').some(a=>a.props.href==='/mi-jornada'),true);
 await act(async()=>renderer.unmount());renderer=null;root=await mount(LabWorkPage);assert.equal(state.requests.length,0);
 await act(async()=>button(root,'Iniciar trabajo').props.onClick());assert.deepEqual(state.requests,[{os:'MV-87126356',state:5}]);
 assert.match(text(root),/Diagnóstico técnico/);assert.match(text(root),/En reparación/);
});
test('URL técnica bloquea otra carga, rol incorrecto y recepción pendiente sin escrituras',async()=>{
 for(const [role,id,received] of [['tecnico_laboratorio','other',true],['logistica','self',true],['tecnico_laboratorio','self',false]]){
  state.pageMe={id,rol:role};state.pageOs='MV-87126356';state.techRows=techFixtures();state.techRows[0].recepcion_laboratorio_confirmada=received;
  const root=await mount(LabWorkPage);assert.ok(root.findByProps({role:'alert'}));assert.equal(button(root,'Iniciar trabajo'),undefined);assert.equal(state.requests.length,0);
  await act(async()=>renderer.unmount());renderer=null;
 }
});
test('Bodega URL consulta bandeja vigente; abrir y abandonar no validan ni mueven',async()=>{
 globalThis.window=new EventTarget();
 state.pageMe={id:'fixture',rol:'logistica'};state.pageOs='MV-TEST01';state.warehouseTickets=[{codigo_os:'MV-TEST01',estado_id:2,tipo_equipo:'VALIDADOR',serie:'TEST',bus_ppu:'TEST01'}];
 await act(async()=>{renderer=TestRenderer.create(React.createElement(WarehousePage,{purpose:'receipt'}));});
 assert.equal(button(renderer.root,'Confirmar recepción en Bodega').props.disabled,true);assert.equal(state.receiptReads.length,0);assert.equal(state.receiptWrites.length,0);
 await act(async()=>renderer.unmount());renderer=null;assert.equal(state.receiptWrites.length,0);
 state.warehouseTickets=[];await act(async()=>{renderer=TestRenderer.create(React.createElement(WarehousePage,{purpose:'receipt'}));});assert.match(text(renderer.root),/ya no está pendiente/);
});
test('Mobile navega al retiro por OS, consulta propia y volver no genera escritura',async()=>{
 const root=await mount(MobileOrders);await press(root,'Confirmar retiro físico hacia Bodega');assert.deepEqual(state.navigation,['TerrainWithdrawal',{codigo_os:'MV-87126356'}]);assert.equal(state.requests.length,0);
});
test('fuentes propias no incluyen interfaces flotantes de operación',async()=>{
 const {readdir}=await import('node:fs/promises');
 async function walk(dir){for(const entry of await readdir(dir,{withFileTypes:true})){const path=new URL(entry.name+(entry.isDirectory()?'/':''),dir);if(entry.isDirectory())await walk(path);else if(/\.(tsx?|jsx?)$/.test(entry.name)){const source=await readFile(path,'utf8');assert.doesNotMatch(source,/role=["']dialog["']|aria-modal|showModal\(|createPortal\(|window\.(alert|confirm)\(|Alert\.alert\(|<(Modal|Dialog)\b/,path.pathname);}}}
 await walk(new URL('../src/',import.meta.url));await walk(new URL('../../07_Mobile/src/',import.meta.url));
});

async function exportInlineFixture(name){
 if(!process.env.PMP_INLINE_RENDER_DIR)return;
 const {mkdir,writeFile}=await import('node:fs/promises'),{renderToStaticMarkup}=await import('react-dom/server');
 const element=n=>n===null?null:typeof n==='string'?n:Array.isArray(n)?n.map(element):React.createElement(n.type,n.props,...(n.children||[]).map(element));
 const css=(await Promise.all(['tokens','base','layout','components','pages'].map(n=>readFile(new URL('../src/styles/'+n+'.css',import.meta.url),'utf8')))).join('\n');
 await mkdir(process.env.PMP_INLINE_RENDER_DIR,{recursive:true});
 for(const theme of ['light','dark'])await writeFile(process.env.PMP_INLINE_RENDER_DIR+'/'+name+'-'+theme+'.html','<!DOCTYPE html><html data-theme="'+theme+'"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>'+css+'</style><body><main class="app-content">'+renderToStaticMarkup(element(renderer.toJSON()))+'</main></body></html>');
}
test('explorador y recepción inicial renderizan inline sin bloquear documento',async()=>{
 let root=await mount(Ingress);await act(async()=>button(root,'Buscar / Explorar').props.onClick());await exportInlineFixture('explorador');
 await act(async()=>renderer.unmount());renderer=null;root=await mount(Management);await newAsset(root);await exportInlineFixture('activo');
 assert.equal(root.findAllByType('dialog').length,0);
});
const {default:InlineFeedback}=await import(await compile('src/components/InlineFeedback.tsx',{'./ui/FeedbackBanner':banner}));
test('confirmación inline necesita acción explícita y mantiene resultado visible',async()=>{
 let writes=0;await act(async()=>{renderer=TestRenderer.create(React.createElement(InlineFeedback,{isOpen:true,type:'confirm',title:'Confirmar envío a QA',message:'Confirma el envío del equipo de prueba.',onConfirm:()=>writes++,onCancel(){}}));});
 assert.equal(writes,0);await exportInlineFixture('confirmacion');await act(async()=>button(renderer.root,'Confirmar').props.onClick());assert.equal(writes,1);
});
const adminMock=url(`export const ALLOWED_ROLES=['admin','logistica','tecnico_laboratorio','tecnico_terreno','qa','gerente'];export const adminListUsers=async()=>[{id:'fixture',nombre:'Nombre prueba',apellido:'Apellido prueba',correo:'fixture@example.invalid',rol:'tecnico_laboratorio',activo:true}];export const adminCreateUser=async()=>{},adminResetPasswordLink=async()=>{},adminSetPassword=async()=>{},adminUpdateUser=async()=>{};`);
const {default:AdminPage}=await import(await compile('src/pages/AdminUsersPage.tsx',{'lucide-react':import.meta.resolve('lucide-react'),'../api/adminUsers':adminMock,'../components/ui/PageHeader':pageHeader,'../components/ui/EmptyState':emptyState,'../components/ui/StatusBadge':statusBadge,'../components/ui/FeedbackBanner':banner}));
test('edición administrativa utiliza panel inline',async()=>{
 const root=await mount(AdminPage);await act(async()=>root.findAllByType('button').find(b=>b.props['aria-label']?.startsWith('Editar ')).props.onClick());
 assert.equal(root.findAllByProps({role:'dialog'}).length,0);assert.equal(root.findAllByProps({role:'region'}).length,1);await exportInlineFixture('usuario');
});

const {default:WithdrawalScreen}=await import(await compile('../07_Mobile/src/screens/TerrainWithdrawalScreen.js',{...nativeImports,'../components/TerrainWithdrawalForm':nativeWithdrawal}));
test('Mobile screen consulta OS propia al entrar y bloquea URL sin tarea vigente',async()=>{
 let backs=0;const props={route:{params:{codigo_os:'MV-87126356'}},navigation:{goBack(){backs++;}}};
 await act(async()=>{renderer=TestRenderer.create(React.createElement(WithdrawalScreen,props));});
 assert.match(text(renderer.root),/7490004/);assert.equal(state.requests.length,0);
 await press(renderer.root,'Volver a Mis Órdenes');assert.equal(backs,1);assert.equal(state.requests.length,0);
 await act(async()=>renderer.unmount());renderer=null;state.historyFixture=[];
 await act(async()=>{renderer=TestRenderer.create(React.createElement(WithdrawalScreen,props));});
 assert.match(text(renderer.root),/no pertenece a tus retiros/);assert.equal(state.requests.length,0);
});

const {default:TechnicalForm}=await import(realRepair);
async function mountTechnical(stage=5){
 await act(async()=>{renderer=TestRenderer.create(React.createElement(TechnicalForm,{os:'MV-UNIT',initialState:stage,tipoEquipo:'VALIDADOR',serie:'UNIT',tecnico:'Técnico prueba',onStarted(){},onSuccess(){state.finished=true;}}));});
 return renderer.root;
}
async function field(root,label,value){
 const control=root.findAllByType('label').find(l=>text(l)===label);
 assert.ok(control,'label '+label);
 await change(root,control.props.htmlFor,value);
}
test('trabajo normal no consulta ni gestiona inventario; guarda y recupera diagnóstico y Manual',async()=>{
 let root=await mountTechnical();assert.equal(state.requests.length,0);
 assert.deepEqual(state.labReads,['/api/lab/work/MV-UNIT']);assert.doesNotMatch(text(root),/Stock|Código interno|Agregar repuesto|Solicitud a Bodega/);
 await field(root,'Resultado del diagnóstico','DIFERENTE');await field(root,'Falla real encontrada','No lee QR');
 await act(async()=>button(root,'Agregar prueba').props.onClick());await field(root,'Prueba realizada','Manual');await field(root,'Resultado de prueba 1','APROBADA');
 await act(async()=>button(root,'Guardar avance').props.onClick());assert.match(text(root),/Avance guardado/);
 assert.equal(state.requests.length,1);assert.equal(state.requests[0].payload.trabajo.repuestos,undefined);
 await act(async()=>renderer.unmount());renderer=null;root=await mountTechnical();
 assert.match(text(root),/Avance recuperado/);assert.equal(root.findAllByType('select').some(s=>s.props.value==='DIFERENTE'),true);
 assert.equal(root.findAllByType('select').some(i=>i.props.value==='Manual'),true);assert.equal(state.requests.length,1);
});
test('NFF finaliza sin acciones ni repuestos; solo Manual/Test MK y resultado pendiente por defecto',async()=>{
 const root=await mountTechnical();assert.equal(button(root,'Finalizar trabajo').props.disabled,true);
 await field(root,'Resultado del diagnóstico','NFF');await field(root,'Observación del diagnóstico','Prueba repetida sin falla');await field(root,'Resultado del trabajo','NFF');
 await act(async()=>button(root,'Agregar prueba').props.onClick());
 const label=root.findAllByType('label').find(l=>text(l)==='Prueba realizada'),select=root.findByProps({id:label.props.htmlFor});
 assert.deepEqual(select.findAllByType('option').map(text),['Selecciona método','Manual','Test MK']);
 assert.equal(root.findAllByType('select').filter(s=>s.findAllByType('option').some(o=>text(o)==='Aprobada'))[0].props.value,'');
 await field(root,'Prueba realizada','Test MK');await field(root,'Resultado de prueba 1','RECHAZADA');
 assert.equal(button(root,'Finalizar trabajo').props.disabled,true);await field(root,'Resultado de prueba 1','APROBADA');
 assert.equal(button(root,'Finalizar trabajo').props.disabled,false);
 await act(async()=>button(root,'Finalizar trabajo').props.onClick());assert.equal(state.requests[0].path,'/api/lab/finish');
 assert.deepEqual(state.requests[0].payload.trabajo.acciones,[]);assert.equal(state.requests[0].payload.trabajo.repuestos,undefined);
});
test('Cambio de Repuesto no exige inventario; PoD conserva evidencia y cierre bloqueado en espera',async()=>{
 const {closureIssues,emptyWork}=await import(labTechnicalWork);const w=emptyWork();
 w.diagnostico={resultado:'CONFIRMADA',falla_real:'No lee QR',observacion:''};w.resultado='REPARADO';w.acciones=['Cambio de Repuesto'];w.pruebas=[{nombre:'Manual',resultado:'APROBADA',observacion:''}];
 assert.equal(closureIssues(w,5).length,0);
 w.diagnostico.resultado='POD';w.resultado='POD';assert.ok(closureIssues(w,5).some(x=>x.includes('fotografía')));
 w.pod={categoria:'GOLPE',observacion:'Impacto comprobado',fotografias:[{origen:'ARCHIVO',base64:'test'}]};
 assert.equal(closureIssues(w,5).length,0);assert.ok(closureIssues(w,9).length);assert.ok(closureIssues(w,5,true).length);
});
test('guardar falla visible sin perder datos; no edición si no pudo recuperar el borrador',async()=>{
 let root=await mountTechnical();await field(root,'Observación del diagnóstico','Trabajo pendiente');state.labWriteError={response:{data:{message:'Conflicto de revisión'}}};
 await act(async()=>button(root,'Guardar avance').props.onClick());assert.match(text(root),/Conflicto de revisión/);
 assert.equal(root.findAllByType('textarea').some(t=>t.props.value==='Trabajo pendiente'),true);
 await act(async()=>renderer.unmount());renderer=null;state.labReadError=Error('Sin conexión');root=await mountTechnical();assert.equal(button(root,'Guardar avance'),undefined);
});
test('PoD documentado y necesidad explícita habilitan solicitud descriptiva, guardando primero',async()=>{
 state.labSnapshot.pod_contexto={categoria:'ROTURA',observacion:'Daño constatado',fotografias:[{origen:'CAMARA',base64:'test'}],origen:'Retiro de terreno'};
 const root=await mountTechnical();
 assert.match(text(root),/Solicitud a Bodega/);assert.equal(root.findAllByType('label').some(l=>text(l)==='Repuesto o componente necesario'),false);
 const check=root.findAllByType('label').find(l=>text(l).includes('Necesito un repuesto')).findByType('input');
 await act(async()=>check.props.onChange({target:{checked:true}}));
 await field(root,'Repuesto o componente necesario','Lector dañado');await field(root,'Motivo técnico','Impacto impide reparación');
 await act(async()=>button(root,'Guardar avance y solicitar').props.onClick());
 assert.deepEqual(state.requests.map(r=>r.path),['/api/lab/work/MV-UNIT','/api/lab/request-part']);
 assert.deepEqual(state.requests[1].payload,{codigo_os:'MV-UNIT',necesidad:'Lector dañado',motivo:'Impacto impide reparación'});
 assert.match(text(root),/En espera de repuesto/);assert.equal(button(root,'Finalizar trabajo').props.disabled,true);
});
test('PoD incompleto no solicita; prueba legacy se muestra readonly sin reclasificar',async()=>{
 state.labSnapshot.legado={pruebas:[{nombre:'Prueba QR antigua',resultado:'RECHAZADA',observacion:'No cambiar'}],tiene_repuestos:true};
 const root=await mountTechnical();assert.match(text(root),/Prueba QR antigua/);assert.match(text(root),/Rechazada/);
 await field(root,'Resultado del diagnóstico','POD');await act(async()=>root.findAllByType('label').find(l=>text(l).includes('Necesito un repuesto')).findByType('input').props.onChange({target:{checked:true}}));
 await field(root,'Repuesto o componente necesario','Lector');await field(root,'Motivo técnico','Daño');assert.equal(button(root,'Guardar avance y solicitar').props.disabled,true);
 assert.doesNotMatch(text(root),/Stock|Código interno|Agregar repuesto/);
});
test('SLA comparte plural correcto sin cambiar horas ni umbral',async()=>{
 const {calculateSLA}=await import(await compile('src/utils/sla.ts'));
 assert.equal(calculateSLA(new Date(Date.now()-40*3600000).toISOString()).texto,'1 día restante');
 assert.equal(calculateSLA(new Date(Date.now()-1*3600000).toISOString()).texto,'2 días restantes');
});
test('trazabilidad agrupa cierre y avances por ciclo conservando detalle legible',async()=>{
 const {buildTimeline,eventTitle}=await import(await compile('src/utils/traceabilityPresentation.ts',{'./formatters':formatters}));
 const work=(await import(labTechnicalWork)).emptyWork();work.diagnostico={resultado:'NFF',falla_real:'',observacion:'Sin falla observada'};work.resultado='NFF';work.pruebas=[{nombre:'Prueba funcional',resultado:'APROBADA',observacion:''}];
 const e=(id,tipo,metadata,fecha='2026-10-07T15:00:00Z')=>({id,tipo,codigo_os:'MV-UNIT',fecha,detalle:{metadata}});
 const events=[e('1','LAB_AVANCE_GUARDADO',{ciclo:'1',trabajo:work},'2026-10-07T12:00:00Z'),e('2','LAB_AVANCE_GUARDADO',{ciclo:'1',trabajo:work},'2026-10-07T13:00:00Z'),e('3','LAB_DIAGNOSTICO_CONFIRMADO',{ciclo:'1'}),e('4','LAB_REPARACION_FINALIZADA',{ciclo:'1',trabajo:work}),e('5','LAB_LISTO_QA',{ciclo:'1'}),e('6','REPARACION',{})];
 const before=JSON.stringify(events),grouped=buildTimeline(events);assert.equal(grouped.length,2);assert.equal(grouped.find(e=>e.tipo==='LAB_REPARACION_FINALIZADA').technical.length,3);assert.equal(JSON.stringify(events),before);
 assert.equal(eventTitle(events[3]),'Trabajo técnico finalizado · Listo para QA');
 const {default:Timeline}=await import(traceTimeline);
 await act(async()=>{renderer=TestRenderer.create(React.createElement(Timeline,{events}));});
 assert.match(text(renderer.root),/Sin falla encontrada/);assert.match(text(renderer.root),/Prueba funcional/);assert.match(text(renderer.root),/Aprobada/);assert.doesNotMatch(text(renderer.root),/LAB_REPARACION_FINALIZADA/);
});

const partDeliveryMock=url(`import React from ${JSON.stringify(import.meta.resolve('react'))};const s=globalThis.__requirementsTest;
export const useOutletContext=()=>({id:'warehouse',rol:s.role||'logistica'}),useSearchParams=()=>[new URLSearchParams('tab=solicitudes'),()=>{}];
export const getRepuestos=async()=>({repuestos:[{id:1,nombre:'Lector QR',categoria:'VALIDADOR',stock:3,stock_critico:1},{id:2,nombre:'Pieza consola',categoria:'CONSOLA',stock:9}],solicitudes:[{id:7,codigo_os:'MV-UNIT',tipo_equipo:'VALIDADOR',serie:'UNIT',tecnico:'Técnico prueba',repuesto_solicitado:'Lector dañado',comentario:'Daño por impacto',estado:'PENDIENTE',fecha_solicitud:'2026-10-07T10:00:00Z'}]});
export const entregarRepuesto=async(id,payload)=>{s.requests.push({id,payload});},updateRepuestoStock=async()=>{};`);
const {default:WarehouseParts}=await import(await compile('src/pages/BodegaRepuestosPage.tsx',{
 'react-router-dom':partDeliveryMock,'lucide-react':import.meta.resolve('lucide-react'),'../api/bodega':partDeliveryMock,'../app/rbac':realRbac,'../api/errors':errors,
 '../hooks/useAlert':await compile('src/hooks/useAlert.ts'),'../components/InlineFeedback':await compile('src/components/InlineFeedback.tsx',{'./ui/FeedbackBanner':banner}),
 '../components/ReadOnlyNotice':await compile('src/components/ReadOnlyNotice.tsx',{'lucide-react':import.meta.resolve('lucide-react'),'../app/rbac':realRbac}),
 '../components/ui/EmptyState':emptyState,'../components/ui/PageHeader':pageHeader,'../components/ui/StatusBadge':statusBadge,'../utils/health':health,'../utils/formatters':formatters
}));
test('Bodega identifica pieza y cantidad, bloquea falta de stock y entrega solo tras confirmar',async()=>{
 const root=await mount(WarehouseParts);await act(async()=>button(root,'Atender solicitud').props.onClick());
 assert.equal(state.requests.length,0);assert.equal(button(root,'Confirmar entrega física').props.disabled,true);
 assert.doesNotMatch(text(root.findByProps({id:'delivery-part'})),/Pieza consola/);
 await change(root,'delivery-part','1');await change(root,'delivery-quantity','4');assert.equal(button(root,'Confirmar entrega física').props.disabled,true);
 await change(root,'delivery-quantity','2');assert.equal(button(root,'Confirmar entrega física').props.disabled,false);
 await exportInlineFixture('entrega-repuesto');
 await act(async()=>button(root,'Confirmar entrega física').props.onClick());assert.equal(state.requests.length,0);assert.match(text(root),/Se descontará el stock desde Bodega/);
 await act(async()=>root.findAllByType('button').find(b=>text(b)==='Confirmar').props.onClick());
 assert.deepEqual(state.requests,[{id:7,payload:{repuesto_id:1,cantidad:2}}]);
});
test('vista de atención no permite entregar al técnico',async()=>{
 state.role='tecnico_laboratorio';const root=await mount(WarehouseParts);assert.equal(button(root,'Atender solicitud'),undefined);assert.equal(button(root,'Confirmar entrega física'),undefined);
});

const qaMock=url(`import React from ${JSON.stringify(import.meta.resolve('react'))};
const s=globalThis.__requirementsTest;
export const useBlocker=fn=>{s.qaBlockCheck=fn;return s.qaBlocker||{state:'unblocked'};};
export const useOutletContext=()=>({id:'qa',rol:s.role});
export const useParams=()=>({osId:'MV-QA-TEST',step:s.qaStep});
export const useLocation=()=>({pathname:'/qa',search:'?etapa=RECEPCION&q=TEST&page=2',state:{from:'/qa?etapa=RECEPCION&q=TEST&page=2'}});
export const useNavigate=()=>path=>{s.qaNavigation=path;s.qaStep=path.split('/').at(-1);};
export const useSearchParams=()=>React.useState(new URLSearchParams('etapa=RECEPCION')) .map((v,i)=>i?next=>v(new URLSearchParams(next)):v);
export const Link=({children,to,...props})=>React.createElement('a',{href:to,...props},children);
export const qaStages={RECEPCION:'Recepción',AMBIENTE:'Instalación Ambiente',PRUEBAS:'Pruebas',DESPACHO:'Despacho',POR_VERIFICAR:'Por verificar',HISTORIAL:'Historial'};
export const qaPaths={RECEPCION:'recepcion',AMBIENTE:'ambiente',PRUEBAS:'pruebas',DESPACHO:'despacho',POR_VERIFICAR:'detalle',HISTORIAL:'detalle'};
export const getQaDashboard=async params=>{s.qaReads.push(params);return {items:[s.qaData],counts:{RECEPCION:25,AMBIENTE:3,PRUEBAS:2,DESPACHO:1,POR_VERIFICAR:4},total:25,page:params.page,page_size:20};};
export const getQaWork=async()=>{if(s.qaReadError&&s.qaWrites.length)throw Error('Read failed');return structuredClone(s.qaData);};
export const validateQaPhysical=async(code,purpose,body)=>{s.qaValidations.push({code,purpose,body});return {coincide:body.codigo==='7490991',validacion_id:body.codigo==='7490991'?'evidence':null,encontrado:{serie:body.codigo}};};
export const qaCommand=async(code,action,body)=>{s.qaWrites.push({code,action,body});if(s.qaError)throw s.qaError;const w=s.qaData.trabajo;
 if(action==='iniciar'){w.responsable={id:'qa',nombre:'QA Prueba'};w.ambiente.estado='EN_CURSO';}
 if(action==='tomar')w.responsable={id:'qa',nombre:'QA Prueba'};
 if(action==='ambiente-iniciar')w.ambiente.estado='EN_CURSO';
 if(action==='ambiente-guardar')w.ambiente.observacion=body.observacion;
 if(action==='ambiente-completar'){w.ambiente.estado='COMPLETADO';s.qaData.etapa='PRUEBAS';}
 if(action==='dictamen'){w.dictamen={resultado:body.resultado,motivo:body.motivo,autor:{nombre:'QA Prueba'},fecha:'2026-10-07T12:00:00Z'};s.qaData.etapa='DESPACHO';}
 if(action==='recepcion')s.qaData.etapa='AMBIENTE';
 if(action==='despacho')s.qaData.etapa='HISTORIAL';
 if(action==='prueba')w.pruebas.push({...body,id:'test',autor:{nombre:'QA'},fecha:'2026-10-07T12:00:00Z'});
 w.etapa=s.qaData.etapa;return {revision:'32',trabajo:structuredClone(w)};
};`);
const qaImports={...imports,'../components/InlineFeedback':await compile('src/components/InlineFeedback.tsx',{'./ui/FeedbackBanner':banner}),'../utils/labTechnicalWork':labTechnicalWork,'../app/rbac':realRbac,'react-router-dom':qaMock,'../api/qa':qaMock,'lucide-react':import.meta.resolve('lucide-react'),'../components/ui/PageHeader':pageHeader,'../components/ui/StatCard':statCard,'../utils/receiptScanner':receiptScanner,'../utils/traceabilityPresentation':tracePresentation};
const {default:QaPage}=await import(await compile('src/pages/QaPage.tsx',qaImports));
const {default:QaWorkPage}=await import(await compile('src/pages/QaWorkPage.tsx',qaImports));
const qaFixture={codigo_os:'MV-QA-TEST',tipo_equipo:'VALIDADOR',serie:'7490991',modelo:'CVB45',marca:'Marca',bus_ppu:'TEST01',terminal:'Terminal',operador:'Operador',referencia_ar:'AR-TEST',falla:'Falla QR',tecnico_reparador:'Técnico laboratorio',estado_operacional:'En tránsito hacia QA',fecha_envio_qa:'2026-10-07T12:00:00Z',ciclo_qa:'30',revision:'31',historial:[],antecedentes_laboratorio:null};
function initQa(stage='RECEPCION',role='qa'){
 state.role=role;state.qaStep={RECEPCION:'recepcion',AMBIENTE:'ambiente',PRUEBAS:'pruebas',DESPACHO:'despacho',POR_VERIFICAR:'detalle'}[stage];state.qaError=null;state.qaReadError=false;state.qaWrites=[];state.qaReads=[];state.qaValidations=[];
 state.qaData={...qaFixture,etapa:stage,trabajo:{etapa:stage,responsable:null,ambiente:{estado:'PENDIENTE',observacion:'',inicio:null,fin:null},pruebas:[],dictamen:null}};globalThis.window={dispatchEvent(){},requestAnimationFrame:fn=>fn(),scrollTo(){}};globalThis.sessionStorage={getItem:k=>state.qaStorage[k]||null,setItem:(k,v)=>state.qaStorage[k]=v,removeItem:k=>delete state.qaStorage[k]};state.qaStorage={};state.qaBlocker=null;
}
const qaField=(root,label)=>root.findAllByType('label').find(n=>text(n).trim().startsWith(label));
async function qaChange(root,label,value,type='select'){await act(async()=>qaField(root,label).findByType(type).props.onChange({target:{value}}));}
async function qaCheck(root,label){await act(async()=>qaField(root,label).findByType('input').props.onChange({target:{checked:true}}));}
test('QA dashboard tiene cuatro etapas, tabla compacta, búsqueda servidor y paginación',async()=>{
 initQa();const root=await mount(QaPage);assert.equal(root.findAllByProps({role:'tab'}).length,4);assert.equal(root.findAllByType('table').length,1);
 await act(async()=>button(root,'Siguiente').props.onClick());assert.equal(state.qaReads.at(-1).page,2);
 await act(async()=>root.findByProps({'aria-label':'Buscar en QA'}).props.onChange({target:{value:'AR-TEST'}}));assert.equal(state.qaReads.at(-1).q,'AR-TEST');assert.equal(state.qaReads.at(-1).page,1);
 assert.equal(state.qaWrites.length,0);assert.equal(button(root,'Asignar'),undefined);
});
test('QA abrir recepción conserva contexto y volver preserva búsqueda/página sin recibir',async()=>{
 initQa();const root=await mount(QaWorkPage);for(const v of ['7490991','CVB45','TEST01','AR-TEST','Terminal','Operador'])assert.ok(text(root).includes(v));
 assert.equal(state.qaWrites.length,0);assert.equal(button(root,'Recibir equipo').props.disabled,true);
 assert.equal(root.findAllByType('a').find(a=>text(a)==='Volver a la bandeja').props.href,'/qa?etapa=RECEPCION&q=TEST&page=2');
});
test('QA manual exige presencia y motivo; validar no recibe; confirmación separada',async()=>{
 initQa();const root=await mount(QaWorkPage);await act(async()=>button(root,'No puedo escanear').props.onClick());
 await qaChange(root,'Serie exacta','7490991','input');assert.equal(button(root,'Validar identidad').props.disabled,true);
 await qaChange(root,'Motivo de ingreso manual','Escáner sin conexión','textarea');await qaCheck(root,'Confirmo presencia física');
 await act(async()=>button(root,'Validar identidad').props.onClick());assert.equal(state.qaWrites.length,0);assert.match(text(root),/Equipo validado/);
 assert.equal(state.qaValidations[0].body.origen_captura,'MANUAL_AUTORIZADO');await act(async()=>button(root,'Recibir equipo').props.onClick());
 assert.equal(state.qaWrites[0].action,'recepcion');assert.equal(state.qaWrites[0].body.validacion_id,'evidence');
});
test('QA digitación normal no registra scanner y discrepancia bloquea confirmación',async()=>{
 initQa();const root=await mount(QaWorkPage);await qaChange(root,'Lectura del escáner','7490991','input');
 await act(async()=>qaField(root,'Lectura del escáner').findByType('input').props.onKeyDown({key:'Enter',preventDefault(){}}));
 assert.equal(state.qaValidations.length,0);assert.match(text(root),/lectura continua/);
 await act(async()=>button(root,'No puedo escanear').props.onClick());await qaChange(root,'Serie exacta','OTRO','input');await qaChange(root,'Motivo de ingreso manual','Contingencia','textarea');await qaCheck(root,'Confirmo presencia física');await act(async()=>button(root,'Validar identidad').props.onClick());
 assert.match(text(root),/Equipo distinto/);assert.equal(button(root,'Recibir equipo').props.disabled,true);
});
test('QA ambiente requiere tomar e iniciar; guardar persiste sin completar',async()=>{
 initQa('AMBIENTE');const root=await mount(QaWorkPage);assert.equal(button(root,'Iniciar Instalación Ambiente'),undefined);
 await act(async()=>button(root,'Iniciar trabajo QA').props.onClick());assert.equal(state.qaWrites.length,1);assert.equal(state.qaWrites[0].action,'iniciar');
 await qaChange(root,'Observación de lo realizado','Preparación realizada','textarea');await act(async()=>button(root,'Guardar avance').props.onClick());
 assert.equal(state.qaWrites.at(-1).action,'ambiente-guardar');assert.equal(state.qaData.etapa,'AMBIENTE');assert.equal(button(root,'Completar Instalación Ambiente').props.disabled,true);
 await qaCheck(root,'Confirmo que Instalación');await act(async()=>button(root,'Completar Instalación Ambiente').props.onClick());assert.equal(state.qaWrites.at(-1).action,'ambiente-completar');
});
test('QA pruebas inician vacías/pendientes, guardar no emite dictamen',async()=>{
 initQa('PRUEBAS');state.qaData.trabajo.responsable={id:'qa',nombre:'QA'};const root=await mount(QaWorkPage);
 assert.equal(qaField(root,'Método').findByType('select').props.value,'');assert.equal(qaField(root,'Resultado de la prueba').findByType('select').props.value,'PENDIENTE');assert.equal(qaField(root,'Dictamen').findByType('select').props.value,'');
 await qaChange(root,'Método','Manual');await act(async()=>button(root,'Guardar avance').props.onClick());assert.equal(state.qaWrites[0].action,'prueba');assert.equal(state.qaData.trabajo.dictamen,null);
});
test('QA dictamen requiere confirmación y deja despacho separado',async()=>{
 initQa('PRUEBAS');state.qaData.trabajo.responsable={id:'qa',nombre:'QA'};const root=await mount(QaWorkPage);
 await qaChange(root,'Dictamen','RECHAZADO');assert.equal(state.qaWrites.length,0);await qaChange(root,'Motivo técnico','QR intermitente','textarea');await qaChange(root,'Método','Manual');await qaChange(root,'Resultado de la prueba','RECHAZADA');await act(async()=>button(root,'Registrar dictamen').props.onClick());
 assert.equal(state.qaWrites[0].action,'dictamen');assert.equal(state.qaData.etapa,'DESPACHO');assert.equal(state.qaWrites.length,1);
});
test('QA conflicto de versión se muestra inline conservando avance',async()=>{
 initQa('AMBIENTE');state.qaData.trabajo.responsable={id:'qa',nombre:'QA'};state.qaData.trabajo.ambiente.estado='EN_CURSO';state.qaError={response:{status:409,data:{message:'Otro avance fue guardado'}}};
 const root=await mount(QaWorkPage);await qaChange(root,'Observación de lo realizado','No perder avance','textarea');await act(async()=>button(root,'Guardar avance').props.onClick());
 assert.match(text(root),/Otro avance fue guardado/);assert.equal(qaField(root,'Observación de lo realizado').findByType('textarea').props.value,'No perder avance');assert.equal(root.findAllByProps({role:'dialog'}).length,0);
});
test('QA otros usuarios no sobrescriben y Admin/Logística consultan sin operar',async()=>{
 for(const role of ['qa','admin','logistica','gerente']){initQa('AMBIENTE',role);state.qaData.trabajo.responsable={id:'otro',nombre:'Otro QA'};state.qaData.trabajo.ambiente.estado='EN_CURSO';const root=await mount(QaWorkPage);
 assert.equal(button(root,'Guardar avance'),undefined);assert.equal(button(root,'Tomar trabajo'),undefined);assert.equal(qaField(root,'Observación de lo realizado').findByType('textarea').props.readOnly,true);await act(async()=>renderer.unmount());renderer=null;}
});
test('QA datos legacy por verificar no exponen recepción ni dictamen',async()=>{
 initQa('POR_VERIFICAR');const root=await mount(QaWorkPage);assert.match(text(root),/No hay evidencia suficiente/);assert.equal(button(root,'Recibir equipo'),undefined);assert.equal(button(root,'Registrar dictamen'),undefined);
});

test('recepción desde Laboratorio reutiliza captura y confirmación explícita',async()=>{
 globalThis.window={dispatchEvent(){}};await act(async()=>{renderer=TestRenderer.create(React.createElement(Reception,{ticket:{...warehouseFixture[2],serie:'7490010',estado_id:11},role:'logistica',onReceived(){}}));});
 const root=renderer.root;assert.match(text(root),/Recepción desde Laboratorio/);assert.equal(button(root,'Confirmar recepción en Bodega').props.disabled,true);
 await change(root,'receipt-capture','MANUAL_AUTORIZADO');await change(root,'receipt-reading','7490010');await change(root,'receipt-reason','Escáner sin conexión');await checked(root,'receipt-present');await read(root);
 assert.equal(state.receiptWrites.length,0);await act(async()=>button(root,'Confirmar recepción en Bodega').props.onClick());assert.equal(state.receiptWrites[0].validacion_id,'44');
});
test('salida QA no solicita técnico y 4xx permanece inline sin perder contexto',async()=>{
 await act(async()=>{renderer=TestRenderer.create(React.createElement(Reception,{purpose:'qa',ticket:{...warehouseFixture[2],serie:'7490010'},role:'logistica',onReceived(){}}));});const root=renderer.root;
 assert.match(text(root),/Enviar a QA/);assert.equal(root.findAllByType('select').length,1,'solo origen de captura');
 await change(root,'receipt-capture','MANUAL_AUTORIZADO');await change(root,'receipt-reading','7490010');await change(root,'receipt-reason','Escáner sin conexión');await checked(root,'receipt-present');await read(root);
 assert.equal(state.receiptWrites.length,0);state.error={response:{status:409,data:{message:'Valida nuevamente esta salida QA'}}};await act(async()=>button(root,'Confirmar envío a QA').props.onClick());
 assert.match(text(root),/Valida nuevamente esta salida QA/);assert.equal(root.findByProps({id:'receipt-reading'}).props.value,'7490010');assert.equal(button(root,'Confirmar envío a QA').props.disabled,true);
 assert.equal('qa_usuario_id' in state.receiptWrites[0],false);
});

const qaScannerMock=url(`import React from ${JSON.stringify(import.meta.resolve('react'))};
const s=globalThis.__requirementsTest;
export const useOutletContext=()=>({rol:'qa',id:'qa'}),useNavigate=()=>()=>{};
const result=()=>({lectura:{codigo:'7490991',tipo_codigo:'SERIE'},equipo:{tipo_equipo:'VALIDADOR',serie:'7490991',modelo:'CVB45'},estacion:{codigo:'QA',ubicacion:'Certificación QA'},orden:{codigo_os:'MV-SCAN-QA',estado_id:6,estado:'En tránsito hacia QA',bus_ppu:'TEST01',falla:'QR'},validacion:{puede_confirmar:true,estado:'LISTO',mensaje:'Coincide'},ultima_ubicacion:null});
export const resolveEquipmentScan=async(...args)=>{s.qaScanReads.push(args);return result();};
export const confirmEquipmentScan=async(...args)=>{s.qaScanWrites.push(args);return {...result(),escaneo:{id:1,fecha:'2026-10-07T12:00:00Z'},duplicado:s.qaScanWrites.length>1};};
`);
const {default:QaScanner}=await import(await compile('src/pages/EquipmentScanPage.tsx',{...imports,'react-router-dom':qaScannerMock,'../api/equipmentScan':qaScannerMock,'../utils/receiptScanner':receiptScanner,'lucide-react':import.meta.resolve('lucide-react'),'../app/rbac':realRbac,'../components/ui/PageHeader':pageHeader,'../components/ScanOperationalActions':url('export default()=>null;')}));
async function scannerPage(){state.qaScanReads=[];state.qaScanWrites=[];globalThis.window={requestAnimationFrame:fn=>fn()};return mount(QaScanner);}
test('digitación QA solo consulta y nunca registra SCANNER',async()=>{
 const root=await scannerPage();await change(root,'equipment-scan','7490991');await read(root);
 assert.equal(state.qaScanReads.length,1);assert.equal(state.qaScanWrites.length,0);assert.match(text(root),/sin movimiento/);
});
test('scanner genérico QA identifica y conduce a recepción explícita sin escribir',async()=>{
 const root=await scannerPage();
 for(let attempt=0;attempt<2;attempt++){
  await change(root,'equipment-scan','7490991');
  const key=root.findByProps({id:'equipment-scan'}).props.onKeyDown;
  for(const [i,char] of [...'7490991'].entries())key({key:char,timeStamp:i*10,nativeEvent:{isTrusted:true}});
  key({key:'Enter',timeStamp:70,nativeEvent:{isTrusted:true}});await read(root);
 }
 assert.equal(state.qaScanReads.length,2);assert.equal(state.qaScanWrites.length,0);assert.ok(button(root,'Abrir Recepción QA'));
});


test('historial renderiza evidencia y trabajo QA sin interpretarlos como reparación de Laboratorio',async()=>{
 const {default:Timeline}=await import(traceTimeline);initQa('DESPACHO');
 const work={...state.qaData.trabajo,dictamen:{resultado:'RECHAZADO',motivo:'Falla QR persiste',autor:{nombre:'QA Prueba'},fecha:'2026-10-07T12:00:00Z'}};
 await act(async()=>{renderer=TestRenderer.create(React.createElement(Timeline,{events:[{id:'qa-fixture',tipo:'SALIDA_QA_BODEGA',codigo_os:'MV-QA-TEST',fecha:'2026-10-07T12:00:00Z',detalle:{metadata:{trabajo:work,origen_captura:'MANUAL_AUTORIZADO',codigo_leido:'7490991',disposicion:'Retorno a Laboratorio'}}}]}));});
 assert.match(text(renderer.root),/QA → Bodega/);assert.match(text(renderer.root),/Falla QR persiste/);assert.match(text(renderer.root),/Ingreso manual autorizado/);
});

test('QA dictamen y prueba se envían juntos; no requiere guardado previo ni casilla redundante',async()=>{
 initQa('PRUEBAS');state.qaData.trabajo.responsable={id:'qa',nombre:'QA'};const root=await mount(QaWorkPage);
 await qaChange(root,'Dictamen','OPERATIVO');assert.equal(button(root,'Registrar dictamen').props.disabled,true);
 await qaChange(root,'Método','Manual');await qaChange(root,'Resultado de la prueba','APROBADA');
 assert.equal(button(root,'Registrar dictamen').props.disabled,false);assert.match(text(root),/Se guardará Manual/);
 await act(async()=>button(root,'Registrar dictamen').props.onClick());
 assert.equal(state.qaWrites.length,1);assert.equal(state.qaWrites[0].body.prueba.metodo,'Manual');assert.equal(state.qaWrites[0].body.confirmacion,true);
});
test('QA fallo de red conserva solicitud exacta y bloquea cambios hasta reintento',async()=>{
 initQa('AMBIENTE');state.qaData.trabajo.responsable={id:'qa',nombre:'QA'};state.qaData.trabajo.ambiente.estado='EN_CURSO';const root=await mount(QaWorkPage);
 await qaChange(root,'Observación de lo realizado','Avance offline','textarea');state.qaError=new Error('Red');
 await act(async()=>button(root,'Guardar avance').props.onClick());const first=structuredClone(state.qaWrites[0]);
 assert.equal(qaField(root,'Observación de lo realizado').findByType('textarea').props.disabled,true);
 assert.match(text(root),/Reintentar solicitud/);state.qaError=null;
 await act(async()=>button(root,'Reintentar solicitud').props.onClick());assert.deepEqual(state.qaWrites[1],first);assert.match(text(root),/Guardado/);
});
test('QA navegación con borrador se bloquea inline y conserva copia local sin movimiento',async()=>{
 initQa('AMBIENTE');state.qaData.trabajo.responsable={id:'qa',nombre:'QA'};state.qaData.trabajo.ambiente.estado='EN_CURSO';const root=await mount(QaWorkPage);
 const navigation={currentLocation:{pathname:'/qa/OS/ambiente'},nextLocation:{pathname:'/qa'}};
 assert.equal(state.qaBlockCheck(navigation),false);await qaChange(root,'Observación de lo realizado','No perder','textarea');
 assert.equal(state.qaBlockCheck(navigation),true);assert.match(Object.values(state.qaStorage)[0],/No perder/);assert.equal(state.qaWrites.length,0);
 state.qaBlocker={state:'blocked',reset(){state.qaStayed=true;},proceed(){state.qaLeft=true;}};
 await qaChange(root,'Observación de lo realizado','No perder contexto','textarea');assert.ok(button(root,'Seguir aquí'));
 await act(async()=>button(root,'Seguir aquí').props.onClick());assert.equal(state.qaStayed,true);assert.equal(root.findAllByProps({role:'dialog'}).length,0);
});

test('menú de usuario conserva QA como sigla y las otras etiquetas',async()=>{
 const {default:Menu}=await import(await compile('src/components/UserMenu.tsx',{'../app/rbac':realRbac,'lucide-react':import.meta.resolve('lucide-react'),'firebase/auth':url('export const signOut=async()=>{};'),'react-router-dom':qaMock,'../app/firebase':url('export const fbAuth={};'),'../app/SessionContext':url('export const useSession=()=>({endSession(){}});')}));
 for(const [role,label] of [['qa','QA'],['logistica','logistica'],['tecnico_laboratorio','tecnico laboratorio']]){
  await act(async()=>{renderer=TestRenderer.create(React.createElement(Menu,{me:{rol:role},displayName:'Fixture',initials:'F',routeKey:'qa'}));});
  assert.equal(text(renderer.root.findByProps({className:'session-meta'})),label);await act(async()=>renderer.unmount());renderer=null;
 }
});

test('QA un guardado confirmado sigue exitoso si falla la actualización posterior',async()=>{
 initQa('AMBIENTE');state.qaData.trabajo.responsable={id:'qa',nombre:'QA'};state.qaData.trabajo.ambiente.estado='EN_CURSO';const root=await mount(QaWorkPage);
 await qaChange(root,'Observación de lo realizado','Guardado real','textarea');state.qaReadError=true;
 await act(async()=>button(root,'Guardar avance').props.onClick());
 assert.match(text(root),/La acción quedó guardada/);assert.equal(button(root,'Reintentar solicitud'),undefined);assert.equal(state.qaWrites.length,1);
 assert.equal(qaField(root,'Observación de lo realizado').findByType('textarea').props.value,'Guardado real');
 assert.equal(root.findAllByProps({'data-tone':'danger'}).length,0);
});


test('nueva instalación no pide caso, autocompleta destino y confirma sin AR',async()=>{
 state.dispatchParams='';const root=await mount();assert.equal(root.findAllByProps({id:'dispatch-case'}).length,0);
 await change(root,'dispatch-bus','BJ2149');await change(root,'dispatch-technician','tech');
 assert.equal(root.findByProps({id:'dispatch-terminal'}).props.value,'1');assert.equal(root.findByProps({id:'dispatch-terminal'}).props.disabled,true);
 await change(root,'dispatch-capture','MANUAL_AUTORIZADO');await change(root,'dispatch-reading','7400010');await checked(root,'dispatch-present');await read(root);assert.equal(state.reads.length,0);
 await change(root,'dispatch-reason','Sin lector');await read(root);assert.equal(state.dispatches.length,0);
 assert.equal(state.reads[0].contexto_instalacion,'NUEVA');assert.equal(state.reads[0].caso_id,undefined);assert.equal(state.reads[0].os_origen,undefined);
 await act(async()=>button(root,'Confirmar asignación y despacho').props.onClick());assert.equal(state.dispatches.length,1);
 assert.match(text(root),/IN-000184/);assert.match(text(root),/Ver historial del activo/);assert.doesNotMatch(text(root),/AR-00123456/);
});
test('respuesta perdida conserva evidencia para reintentar y cambiar contexto la invalida',async()=>{
 state.dispatchParams='';const root=await mount();await change(root,'dispatch-bus','BJ2149');await ready(root);await read(root);
 state.error=new Error('Network Error');await act(async()=>button(root,'Confirmar asignación y despacho').props.onClick());
 assert.equal(button(root,'Confirmar asignación y despacho').props.disabled,false);state.error=null;
 await act(async()=>button(root,'Confirmar asignación y despacho').props.onClick());assert.deepEqual(state.dispatches[0],state.dispatches[1]);
 await change(root,'dispatch-mode','REQUERIMIENTO');assert.equal(button(root,'Confirmar asignación y despacho').props.disabled,true);assert.equal(root.findByProps({id:'dispatch-bus'}).props.value,'');
});
test('digitación ordinaria en despacho no se registra como scanner',async()=>{
 const root=await mount();await ready(root);await change(root,'dispatch-reading','7400010');
 await act(async()=>root.findByType('form').props.onSubmit({preventDefault(){}}));assert.equal(state.reads.length,0);
 assert.equal(root.findByProps({id:'dispatch-reading'}).props.readOnly,true);assert.equal(button(root,'Confirmar asignación y despacho').props.disabled,true);
});
test('Mobile muestra IN sin caso, origen ni AR y confirma solo al pulsar acción física',async()=>{
 state.historyFixture=[{codigo_os:'IN-000123',es_instalacion:true,tipo_equipo:'VALIDADOR',serie:'7408001',modelo:'CVB45',marca:'Mikroelektronika',bus_ppu:'BJ2149',terminal:'El Conquistador',operador:'VOYSANTIAGO',estado_id:1,estado_nombre:'EN_RUTA',fecha:new Date().toISOString(),caso_id:null,os_origen:null,referencia_externa:null,falla:'Instalación nueva'}];
 const root=await mount(MobileOrders);assert.match(text(root),/CVB45.*El Conquistador.*VOYSANTIAGO/);assert.doesNotMatch(text(root),/OS origen:|Referencia externa:|Ver caso|Instalación nueva/);
 await act(async()=>root.findByProps({accessibilityLabel:'Instalar / devolver equipo'}).props.onPress());assert.equal(state.requests.length,0);
 await press(root,'Cancelar');assert.equal(state.requests.length,0);
 await act(async()=>root.findByProps({accessibilityLabel:'Instalar / devolver equipo'}).props.onPress());await press(root,'Confirmar instalado OK');
 assert.deepEqual(state.requests[0],{path:'/os/completar-instalacion',payload:{codigo_os:'IN-000123',operativo:true,bus_ppu:'BJ2149'}});
});

const {default:MobileRequest}=await import(await compile('../07_Mobile/src/screens/NewOrderScreen.js',nativeImports));
test('Mobile selecciona instalación vigente y cambiar tipo elimina contexto sin escribir',async()=>{
 state.assets=installedAssets;const root=await mount(MobileRequest);
 await nativeInput(root,'Bus / PPU','BJ21');await press(root,'Buscar activos en operación');
 await press(root,'Seleccionar 7490004');
 assert.equal(root.findByProps({accessibilityLabel:'Serie del activo'}).props.value,'7490004');
 assert.equal(root.findByProps({accessibilityLabel:'Bus / PPU'}).props.editable,false);
 assert.match(text(root),/CVB45.*Mikroelektronika.*El Conquistador.*VOYSANTIAGO/);
 await press(root,'Cambiar activo o PPU');assert.equal(root.findByProps({accessibilityLabel:'Bus / PPU'}).props.value,'');
 await press(root,'Buscar activos en operación');await press(root,'Seleccionar 7490005');assert.equal(root.findByProps({accessibilityLabel:'Bus / PPU'}).props.value,'BJ2514');
 await press(root,'Consola');assert.equal(root.findByProps({accessibilityLabel:'Serie del activo'}).props.value,'');assert.equal(state.requests.length,0);
});
test('alta recalcula modelo/marca readonly; prefijo desconocido bloquea sin arrastre',async()=>{
 const root=await mount(Management);
 await change(root,'asset-series','720001');assert.equal(root.findByProps({id:'asset-model'}).props.value,'CVB35');
 await change(root,'asset-series','7490004');assert.equal(root.findByProps({id:'asset-model'}).props.value,'CVB45');
 assert.equal(root.findByProps({id:'asset-model'}).props.readOnly,true);
 await change(root,'asset-series','7');assert.doesNotMatch(text(root),/Prefijo de serie no reconocido/);
 await change(root,'asset-series','99');assert.match(text(root),/Prefijo de serie no reconocido/);assert.equal(button(root,'Registrar en maestro').props.disabled,true);assert.equal(root.findByProps({id:'asset-model'}).props.value,'');
 await change(root,'asset-type','CONSOLA');assert.equal(root.findByProps({id:'asset-model'}).props.value,'N9715');assert.equal(root.findByProps({id:'asset-brand'}).props.value,'Waysion');assert.equal(state.registrations.length,0);
});
test('custodia Laboratorio valida sin mover; confirma propia evidencia y error no pierde lectura',async()=>{
 await act(async()=>{renderer=TestRenderer.create(React.createElement(Reception,{labPurpose:'RECEPCION',ticket:{codigo_os:'MV-FIXTURE',tipo_equipo:'VALIDADOR',serie:'7490010'},role:'admin',onReceived(){}}));});const root=renderer.root;
 await wedge(root,'7490010');assert.equal(state.labReads.length,1);assert.match(state.labReads[0].path,/RECEPCION\/validar$/);assert.equal(state.labReads[0].body.origen_captura,'SCANNER');
 state.error={response:{status:409,data:{message:'Evidencia de otro ciclo'}}};await act(async()=>button(root,'Confirmar recepción en Laboratorio').props.onClick());
 assert.match(text(root),/Evidencia de otro ciclo/);assert.equal(root.findByProps({id:'receipt-reading'}).props.value,'7490010');assert.equal(button(root,'Confirmar recepción en Laboratorio').props.disabled,true);assert.equal(state.labReads[1].body.validacion_id,'700');
});
