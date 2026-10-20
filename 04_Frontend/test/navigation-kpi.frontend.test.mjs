import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import React from 'react';
import TestRenderer, {act} from 'react-test-renderer';
import {MemoryRouter, Outlet, Route, Routes, useNavigate} from 'react-router-dom';
import ts from 'typescript';

const url = source => 'data:text/javascript;base64,' + Buffer.from(source).toString('base64');
async function compile(path, modules = {}) {
  const source = await readFile(new URL(path, import.meta.url), 'utf8');
  const js = ts.transpileModule(source, {compilerOptions:{jsx:ts.JsxEmit.ReactJSX, module:ts.ModuleKind.ESNext, target:ts.ScriptTarget.ES2022}}).outputText;
  return url(js.replace(/from (["'])([^"']+)\1/g, (_, quote, name) => `from ${JSON.stringify(modules[name] || import.meta.resolve(name))}`)
    .replace(/import\((["'])([^"']+)\1\)/g, (_, quote, name) => `import(${JSON.stringify(modules[name] || import.meta.resolve(name))})`));
}
const rbac = await compile('../src/app/rbac.ts');
const navigation = await compile('../src/app/navigation.ts', {'./rbac':rbac});
const {getNavigationForUser} = await import(navigation);
const {ROLES} = await import(rbac);
const badges = url('export const getBadgeCounts=async()=>({lab:0,lab_dispatch:0,bodega:0,qa:0});');
const {default:Sidebar} = await import(await compile('../src/components/Sidebar.tsx', {'../app/navigation':navigation,'../app/rbac':rbac,'../api/badges':badges}));
globalThis.window = {addEventListener(){},removeEventListener(){},setInterval,clearInterval};

async function mountSidebar(role, path) {
  let navigate, render;
  function Harness() {
    navigate = useNavigate();
    return React.createElement(Sidebar, {me:{rol:role},collapsed:false,mobileOpen:false,onNavigate(){},onToggleCollapse(){}});
  }
  await act(async () => {render=TestRenderer.create(React.createElement(MemoryRouter,{initialEntries:[path],future:{v7_startTransition:true,v7_relativeSplatPath:true}},React.createElement(Harness)));});
  return {render, go:async path=>act(async()=>navigate(path))};
}
function assertActive(render, expected) {
  const links=render.root.findAllByType('a');
  const active=links.filter(link=>link.props.className?.split(/\s+/).includes('active'));
  const current=links.filter(link=>link.props['aria-current']==='page');
  assert.deepEqual(active.map(link=>link.props.href),expected?[expected]:[]);
  assert.deepEqual(current.map(link=>link.props.href),expected?[expected]:[]);
}

test('Sidebar real: Dashboard, Inventario y Recepciones conservan un único activo y aria-current',async()=>{
  const {render,go}=await mountSidebar('logistica','/bodega/dashboard');
  try {
    for(const path of ['/bodega/dashboard','/bodega/modulos','/bodega','/bodega/dashboard']){await go(path);assertActive(render,path);}
    await go('/bodega/modulos/?pagina=2');assertActive(render,'/bodega/modulos');
    await go('/bodega/recepciones/IN-FIXTURE');assertActive(render,'/bodega');
    await go('/bodega/envios-laboratorio/MV-FIXTURE');assertActive(render,'/bodega');
    await go('/bodega/envios-qa/MV-FIXTURE');assertActive(render,'/bodega');
    await go('/bodega/despacho');assertActive(render,'/bodega');
    await go('/bodega-inexistente');assertActive(render,undefined);
  } finally {await act(async()=>render.unmount());}
});

test('barra de recepción usa el ticket vigente para Terreno, Laboratorio y QA; sin origen queda genérica',async()=>{
  const previousWindow=globalThis.window,previousDocument=globalThis.document;
  globalThis.window=Object.assign(new EventTarget(),{setTimeout,clearTimeout});
  globalThis.document={documentElement:{getAttribute:()=>null}};
  const fixture=globalThis.__receiptNavigation={pending:[],unexpectedRequests:[]};
  const api=url(`
    const s=globalThis.__receiptNavigation;
    export const getBodegaQueue=()=>new Promise((resolve,reject)=>s.pending.push({resolve,reject}));
    export const api={get:async()=>{s.unexpectedRequests.push('get');throw Error('Unexpected request');},post:async()=>{s.unexpectedRequests.push('post');throw Error('No movements allowed');}};
    export const assetHistoryUrl=()=>'',caseHistoryUrl=()=>'',getCases=async()=>[];
    export const toggleTheme=()=>{},localReport=()=>({});
    export default ()=>null;
  `);
  const {default:TopBar}=await import(await compile('../src/components/TopBar.tsx',{
    '../app/theme':api,'../app/rbac':rbac,'../api/http':api,'../api/bridge':api,'../api/requerimientos':api,'./UserMenu':api
  }));
  const pageHeader=await compile('../src/components/ui/PageHeader.tsx');
  const feedback=await compile('../src/components/ui/FeedbackBanner.tsx');
  const {default:ReceptionPage}=await import(await compile('../src/pages/WarehouseOperationPage.tsx',{
    '../utils/pageReports':api,'../api/bodega':api,'../app/rbac':rbac,'../components/ui/PageHeader':pageHeader,
    '../components/ui/FeedbackBanner':feedback,'../components/WarehouseReceptionForm':api
  }));
  let render,navigate;
  function Harness(){
    navigate=useNavigate();
    return React.createElement(React.Fragment,null,
      React.createElement(TopBar,{me:{rol:'logistica'},sidebarCollapsed:false,onOpenMenu(){},onToggleSidebar(){}}),
      React.createElement(Outlet,{context:{rol:'logistica'}}));
  }
  const title=()=>render.root.findByProps({className:'topbar-title'}).children.join('');
  const go=path=>act(async()=>navigate(path));
  try{
    await act(async()=>{render=TestRenderer.create(React.createElement(MemoryRouter,{initialEntries:['/bodega/recepciones/MV-000210'],future:{v7_startTransition:true,v7_relativeSplatPath:true}},
      React.createElement(Routes,null,React.createElement(Route,{element:React.createElement(Harness)},
        React.createElement(Route,{path:'/bodega/recepciones/:osId',element:React.createElement(ReceptionPage,{purpose:'receipt'})}),
        React.createElement(Route,{path:'/bodega',element:React.createElement('div',null,'Bandeja')})))));});
    for(const [index,origin,state,qa] of [[0,'Laboratorio',11,null],[1,'Terreno',2,null],[2,'QA',11,false],[3,'QA',11,true]]){
      if(index)await go('/bodega/recepciones/MV-'+index);
      assert.equal(title(),'Recepción en Bodega','loading must not assume an origin or reuse the prior OS');
      assert.equal(fixture.pending.length,1,'reuse the page query without another request from TopBar');
      await act(async()=>fixture.pending.shift().resolve([{codigo_os:index?'MV-'+index:'MV-000210',serie:'7490004',estado_id:state,es_aprobado_qa:qa}]));
      assert.equal(title(),'Recepción desde '+origin);
      assert.equal(render.root.findByProps({className:'page-title'}).children.join(''),'Recepción desde '+origin,'existing banner stays coherent');
    }
    await go('/bodega/recepciones/MV-MISSING');
    await act(async()=>fixture.pending.shift().resolve([]));
    assert.equal(title(),'Recepción en Bodega');
    await go('/bodega/recepciones/MV-ERROR');
    await act(async()=>fixture.pending.shift().reject(Error('Simulated read failure')));
    assert.equal(title(),'Recepción en Bodega');
    await go('/bodega');assert.equal(title(),'Bodega y stock');
    await go('/bodega/recepciones/MV-000210');assert.equal(title(),'Recepción en Bodega','returning must not reuse a previous visit');
    await act(async()=>fixture.pending.shift().resolve([]));
    assert.deepEqual(fixture.unexpectedRequests,[]);
  }finally{
    if(render)await act(async()=>render.unmount());
    globalThis.window=previousWindow;globalThis.document=previousDocument;delete globalThis.__receiptNavigation;
  }
});

for(const role of Object.values(ROLES))test(`Sidebar real: rutas y subrutas únicas para ${role}`,async()=>{
  const {render,go}=await mountSidebar(role,'/');
  try {
    for(const item of getNavigationForUser({rol:role}).flatMap(section=>section.items)) {
      await go(item.route);assertActive(render,item.route);
      if(item.route!=='/') {await go(item.route+'/detalle');assertActive(render,item.route);}
    }
    await go('/settings');assertActive(render,role==='admin'?'/settings':undefined);
    if(role==='qa') {await go('/qa/MV-FIXTURE/pruebas');assertActive(render,'/qa');await go('/mi-jornada');assertActive(render,'/qa');}
    if(role==='tecnico_laboratorio') {await go('/mi-carga/MV-FIXTURE');assertActive(render,'/mi-jornada');}
    if(role==='jefe_laboratorio') {
      await go('/lab/custodia/MV-FIXTURE/recepcion');assertActive(render,'/lab/recepcion');
      await go('/lab/custodia/MV-FIXTURE/salida');assertActive(render,'/lab/despacho-qa');
    }
  } finally {await act(async()=>render.unmount());}
});

