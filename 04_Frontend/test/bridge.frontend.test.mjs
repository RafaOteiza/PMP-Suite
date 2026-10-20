import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
import React from 'react';
import Renderer,{act} from 'react-test-renderer';
const source=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const apiSource=await source('src/api/bridge.ts');
const calls=[];
globalThis.__bridgeApi={get:async(...args)=>{calls.push(['GET',...args]);return {data:[]};},post:async(...args)=>{calls.push(['POST',...args]);return {data:{}};}};
const js=ts.transpileModule(apiSource.replace("import { api } from './http';","const api = globalThis.__bridgeApi;"),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const bridge=await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
test('enlace canónico conserva tipo y serie con caracteres especiales',()=>{
  assert.equal(bridge.assetHistoryUrl({tipo_equipo:'CONSOLA',serie:'00/A &B'}),'/trazabilidad?tipo=CONSOLA&serie=00%2FA%20%26B');
});
test('cliente envía correlación sin construir acciones operativas',async()=>{
  const body={tipo_equipo:'VALIDADOR',serie:'001',codigo_os:'MC-1',sistema_externo:'ARANDA',referencia_externa:'AR-1'};
  await bridge.createReference(body);assert.deepEqual(calls.at(-1),['POST','/api/bridge',body]);
  assert.doesNotMatch(apiSource,/asignar-terreno|completar-reparacion|recibir-qa/);
});
test('búsqueda e historial usan endpoints diferentes y la identidad del activo',async()=>{
  await bridge.searchAssets('AR-1');assert.equal(calls.at(-1)[1],'/api/bridge/buscar');
  await bridge.getAssetHistory({tipo_equipo:'CONSOLA',serie:'A/B'});assert.equal(calls.at(-1)[1],'/api/bridge/activos/CONSOLA/A%2FB/historial');
});
test('formulario solo vincula identificadores y la jornada opera OS normales',async()=>{
  const page=await source('src/pages/BridgeFlowPage.tsx');
  for(const field of ['serie','codigo_os','sistema_externo','referencia_externa'])assert.ok(page.includes(`name="${field}"`));
  assert.doesNotMatch(page,/tecnico_terreno_id|equipo_preparado_serie|estado_id|asignar/i);
  const dashboard=await source('src/pages/RoleDashboardPage.tsx');
  assert.match(dashboard,/getMyOs/);assert.match(dashboard,/getLabQueue/);assert.match(dashboard,/QaPage/);
  assert.doesNotMatch(dashboard,/getMyBridges|getMaintenance/);
});
test('historial muestra múltiples OS, referencias y eventos y reacciona a URL',async()=>{
  const page=await source('src/pages/TrazabilidadPage.tsx');
  assert.match(page,/history.ordenes.map/);assert.match(page,/references=\{history.referencias\}/);assert.match(page,/events=\{history.eventos\}/);
  assert.match(page,/\[term,serie,tipo,setParams\]/);
});

test('Bridge selecciona el maestro, muestra modelo/marca y propone solo OS del activo sin escribir',async()=>{
 const asset={tipo_equipo:'VALIDADOR',serie:'7490999',modelo:'CVB45',marca:'Mikroelektronika'};
 const state=globalThis.__bridgeSelection={asset,writes:[],reads:[]};
 const uri=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64');
 const mocked=uri(`import React from ${JSON.stringify(import.meta.resolve('react'))};const s=globalThis.__bridgeSelection;
 export const useOutletContext=()=>({rol:'logistica'}),Link=({children})=>React.createElement('a',null,children),Link2=()=>null;
 export const getReferences=async()=>[],searchAssets=async q=>{s.reads.push(q);return [s.asset];},getAssetHistory=async a=>({ordenes:[{codigo_os:'MV-FIXTURE'}]});
 export const createReference=async body=>s.writes.push(body),assetHistoryUrl=()=>'/trazabilidad',formatDate=x=>x,getApiErrorMessage=()=> 'Error';
 export const localReport=(...args)=>({}),pagedReport=localReport,sheetsReport=localReport,reportSheet=localReport,summarySheet=localReport;
  export default function Decoration({children,title}){return React.createElement('section',null,title,children);}`);
 const code=ts.transpileModule(await source('src/pages/BridgeFlowPage.tsx'),{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace(/from (["'])([^"']+)\1/g,(_,q,name)=>'from '+JSON.stringify(name==='react'||name==='react/jsx-runtime'?import.meta.resolve(name):mocked));
 const {default:Page}=await import(uri(code));let renderer;
 try{
  await act(async()=>{renderer=Renderer.create(React.createElement(Page));});const root=renderer.root;
  await act(async()=>root.findAllByType('input')[0].props.onChange({target:{value:'749'}}));
  await act(async()=>new Promise(r=>setTimeout(r,280)));
  const option=root.findByProps({className:'request-asset-option'});await act(async()=>option.props.onClick());
  assert.equal(root.findByProps({name:'serie'}).props.value,asset.serie);assert.equal(root.findByProps({name:'serie'}).props.readOnly,true);
  assert.ok(root.findAllByType('input').some(n=>n.props.value==='CVB45 · Mikroelektronika'));
  assert.equal(root.findByProps({name:'codigo_os'}).props.value,'MV-FIXTURE');assert.equal(state.writes.length,0);
  const button=root.findAllByType('button').find(n=>n.children.join('')==='Cambiar activo');await act(async()=>button.props.onClick());
  assert.equal(root.findByProps({name:'codigo_os'}).props.value,'');assert.equal(root.findAllByProps({name:'serie'}).length,0);assert.equal(state.writes.length,0);
 }finally{await act(async()=>renderer?.unmount());delete globalThis.__bridgeSelection;}
});
