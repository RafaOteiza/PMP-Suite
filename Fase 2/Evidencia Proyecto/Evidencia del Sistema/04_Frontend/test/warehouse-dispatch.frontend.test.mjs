import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import React from 'react';
import TestRenderer,{act} from 'react-test-renderer';
import {MemoryRouter,Outlet,Routes,Route,useNavigate,useLocation} from 'react-router-dom';
import ts from 'typescript';
import {inventoryFixture,initialAsset} from './logistics-fixture.mjs';
const url=code=>'data:text/javascript;base64,'+Buffer.from(code).toString('base64');
const http=url(`export const api={get:(...args)=>globalThis.__inventory.get(...args),post:()=>{throw Error('Writes forbidden')},put:()=>{throw Error('Writes forbidden')}};`);
const cache=new Map();
async function compile(path) {
 path=resolve(path);if(cache.has(path))return cache.get(path);
 const source=await readFile(path,'utf8');
 let js=ts.transpileModule(source,{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace(/import ["'][^"']+\.css["'];?/g,'');
 const matches=[...js.matchAll(/from (["'])([^"']+)\1/g)];
 for(const match of matches){const name=match[2];let target;
 if(name.endsWith('/http'))target=http;
 else if(name.startsWith('.')){let file=resolve(dirname(path),name);try{await readFile(file+'.tsx');file+='.tsx';}catch{file+='.ts';}target=await compile(file);}
 else target=import.meta.resolve(name);
 js=js.replace(match[0],'from '+JSON.stringify(target));}
 const compiled=url(js);cache.set(path,compiled);return compiled;
}
const {default:Inventory}=await import(await compile('src/pages/BodegaModulosPage.tsx'));
const {default:Dashboard}=await import(await compile('src/pages/BodegaDashboardPage.tsx'));
const text=node=>typeof node==='string'?node:(node?.children||[]).map(text).join('');
let render,navigate,location,items,error,reads,recientes;
const button=label=>render.root.findAllByType('button').find(n=>text(n).includes(label));
function Harness({role}) {navigate=useNavigate();location=useLocation();return React.createElement(Outlet,{context:{rol:role}});}
async function mount(page=Inventory,role='logistica',path='/bodega/modulos') {
 await act(async()=>{render=TestRenderer.create(React.createElement(MemoryRouter,{initialEntries:[path],future:{v7_startTransition:true,v7_relativeSplatPath:true}},React.createElement(Routes,null,React.createElement(Route,{element:React.createElement(Harness,{role})},React.createElement(Route,{path:'*',element:React.createElement(page)})))));});
}
const go=path=>act(async()=>navigate(path));
const kpi=label=>render.root.findAllByProps({className:'stat-card'}).find(n=>text(n).startsWith(label));
test.beforeEach(()=>{items=[{...initialAsset}];error=null;reads=[];recientes=[];globalThis.__inventory={get:async(path,{params}={})=>{reads.push({path,params});if(error)throw error;return {data:{...inventoryFixture(items,params),recientes}};}};});
test.afterEach(async()=>{if(render)await act(async()=>render.unmount());render=null;});

test('Inventario: activo sin OS cuenta como stock, prepara despacho sin escribir',async()=>{
 await mount();assert.equal(kpi('En Bodega').findByProps({className:'stat-value'}).children[0],'1');
 assert.match(text(render.root),/Sin OS/);assert.match(text(render.root),/Pendiente de escaneo/);
 const a=render.root.findAllByType('a').find(a=>text(a)==='Preparar despacho físico');assert.equal(a.props.href,'/bodega/despacho');
 assert.ok(reads.every(r=>r.path==='/api/bodega/inventario'));
});
test('Inventario: error visible, no se interpreta como stock vacío; reintento recupera',async()=>{
 error={response:{status:503,data:{message:'Consulta no disponible'}}};await mount();assert.match(text(render.root.findByProps({role:'alert'})),/Consulta no disponible/);
 assert.doesNotMatch(text(render.root),/Sin equipos en esta consulta/);assert.equal(kpi('Disponibles').findByProps({className:'stat-value'}).children[0],'—');
 error=null;await act(async()=>button('Actualizar').props.onClick());assert.match(text(render.root),/7409101/);
});
test('Inventario: filtros tipo/modelo/estado/origen/disponibilidad y búsqueda llegan a lectura',async()=>{
 await mount();for(const [name,value] of [['Tipo','CONSOLA'],['Modelo','CVB45'],['Estado','Disponible para instalación'],['Origen','Inicial'],['Disponibilidad','SI']]){
 const label=render.root.findAllByType('label').find(n=>text(n).startsWith(name));await act(async()=>label.findByType('select').props.onChange({target:{value}}));}
 const input=render.root.findByType('input');await act(async()=>input.props.onChange({target:{value:'7409'}}));await act(async()=>render.root.findByType('form').props.onSubmit({preventDefault(){}}));
 assert.deepEqual(reads.at(-1).params,{tipo:'CONSOLA',modelo:'CVB45',estado:'Disponible para instalación',origen:'Inicial',disponibilidad:'SI',q:'7409'});
 assert.match(text(render.root),/Sin equipos en esta consulta/);
 await act(async()=>button('Limpiar filtros').props.onClick());assert.equal(location.search,'');
});
test('Inventario: secciones, alcance y paginación conservan contexto; volver respeta filtros',async()=>{
 items=Array.from({length:25},(_,n)=>({...initialAsset,serie:'7409'+String(n).padStart(3,'0')}));await mount();
 await act(async()=>button('Listos para instalación').props.onClick());assert.match(location.search,/etapa=DISPONIBLE/);
 await act(async()=>button('Siguiente').props.onClick());assert.match(location.search,/offset=20/);assert.equal(render.root.findAllByType('tbody')[0].findAllByType('tr').length,5);
 await act(async()=>button('No disponibles').props.onClick());assert.doesNotMatch(location.search,/offset/);assert.match(text(render.root),/Sin equipos en esta consulta/);
 await go('/bodega/modulos?alcance=BODEGA');assert.equal(render.root.findAllByType('select').at(-1).props.value,'BODEGA');
});
test('Actualizar evidencia no confirma despacho; los links de historial incluyen tipo y serie',async()=>{
 await mount();items[0].escaneado_bodega=true;await act(async()=>button('Actualizar').props.onClick());assert.match(text(render.root),/Escaneado en Bodega/);
 assert.ok(render.root.findAllByType('a').some(a=>a.props.href==='/trazabilidad?tipo=VALIDADOR&serie=7409101'));
});
for(const scenario of ['empty','stock','active'])test('Dashboard: '+scenario+' cuenta activos una vez y separa IN',async()=>{
 if(scenario==='empty')items=[];if(scenario==='active')items=[{...initialAsset,codigo_os:'IN-000001',disponible:false,en_bodega:false,etapa:'TRANSITO'}];
 await mount(Dashboard,'logistica','/bodega/dashboard');
 assert.equal(kpi('Total activos').findByProps({className:'stat-value'}).children[0],scenario==='empty'?'0':'1');
 assert.equal(kpi('Disponibles').findByProps({className:'stat-value'}).children[0],scenario==='stock'?'1':'0');
 assert.doesNotMatch(text(render.root),/Órdenes activas/);
 if(scenario==='empty')assert.match(text(render.root),/Sin activos registrados/);
 else assert.equal(render.root.findByType('tfoot').findAllByType('td').at(-1).children[0],'1');
});
test('Dashboard KPI/matriz navegan al inventario filtrado con teclado',async()=>{
 await mount(Dashboard,'logistica','/bodega/dashboard');await act(async()=>kpi('Disponibles').props.onKeyDown({key:'Enter',preventDefault(){}}));assert.equal(location.pathname,'/bodega/modulos');assert.match(location.search,/etapa=DISPONIBLE/);
});
test('Gerente consulta en el dashboard sin links a rutas operacionales restringidas',async()=>{
 await mount(Dashboard,'gerente','/bodega/dashboard');await act(async()=>kpi('Disponibles').props.onClick());assert.equal(location.pathname,'/bodega/dashboard');assert.match(text(render.root),/Consulta de activos/);
 assert.ok(render.root.findAllByType('a').every(a=>!a.props.href.startsWith('/bodega')));
 assert.equal(render.root.findAllByType('a').filter(a=>text(a)==='Preparar despacho físico').length,0);
});
test('Dashboard API fallida conserva error y no inventa métricas en cero',async()=>{
 error=new Error('Fallo de lectura');await mount(Dashboard,'logistica','/bodega/dashboard');assert.match(text(render.root),/Fallo de lectura/);assert.equal(render.root.findAllByProps({className:'stat-card'}).length,0);
});

for(const count of [0,1,24])test(`Dashboard: ${count} alertas de stock conservan conteo y severidad visual`,async()=>{
 const fixture=inventoryFixture();fixture.secundarios.alertasStock=count;
 globalThis.__inventory.get=async()=>({data:fixture});
 await mount(Dashboard,'logistica','/bodega/dashboard');
 const cards=render.root.findByProps({className:'asset-secondary'}).findAllByType('div');
 const stock=cards.find(c=>c.findAllByType('strong').length===1&&text(c).includes('Alertas de stock'));
 assert.equal(stock.props['data-health'],count>0?'danger':'neutral');
 assert.equal(stock.findByType('strong').children[0],String(count));
 assert.equal(stock.findByType('a').props.href,'/bodega/repuestos');
 for(const label of ['IN pendientes','Recepciones','Despachos']){
  const card=cards.find(c=>c.findAllByType('strong').length===1&&text(c).includes(label));
  assert.equal(card.findByType('strong').children[0],'0');assert.notEqual(card.props['data-health'],'danger');
 }
});

test('Movimientos recientes aparecen solo con eventos reales de la consulta',async()=>{
 await mount();assert.doesNotMatch(text(render.root),/Movimientos recientes/);
 recientes=[{id:'fixture-event',fecha:'2026-10-08T12:00:00Z',serie:'7409101',tipo_equipo:'VALIDADOR',codigo_os:null,titulo:'Recepción inicial confirmada'}];
 await act(async()=>button('Actualizar').props.onClick());assert.match(text(render.root),/Movimientos recientes/);assert.match(text(render.root),/Recepción inicial confirmada/);
});
