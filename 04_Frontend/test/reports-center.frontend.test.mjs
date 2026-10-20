import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import React from 'react';
import Renderer,{act} from 'react-test-renderer';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const out=resolve('../.local/pmp-verification/reports-center-tests');await mkdir(out,{recursive:true});
const bundle=await build({stdin:{contents:`export * from './src/utils/reportCatalog';export * from './src/app/theme';export * from './src/app/navigation';export {default as ReportsPage} from './src/pages/ReportsPage';`,resolveDir:process.cwd(),loader:'ts'},bundle:true,write:false,format:'esm',platform:'node',jsx:'automatic',plugins:[{name:'isolated-reads',setup(b){
 b.onResolve({filter:/react-router-dom$/},()=>({path:'router',namespace:'mock'}));
 b.onResolve({filter:/(^|\/)http$/},()=>({path:'http',namespace:'mock'}));
 b.onLoad({filter:/.*/,namespace:'mock'},a=>({contents:a.path==='http'?`export const api={get:async(url,options)=>{globalThis.__reports.reads.push({url,params:options?.params});return {data:await globalThis.__reports.get(url,options?.params)}}};`:`import React from 'react';export const useOutletContext=()=>globalThis.__reports.user;export const Navigate=({to})=>React.createElement('span',{'data-redirect':to});export const Link=({to,children,...props})=>React.createElement('a',{href:to,...props},children);`,loader:'js',resolveDir:process.cwd()}));
 b.onResolve({filter:/^(react|react\/jsx-runtime|lucide-react|xlsx)$/},a=>({path:import.meta.resolve(a.path),external:true}));
 b.onLoad({filter:/\.css$/},()=>({contents:'',loader:'js'}));
 }}]});
await writeFile(resolve(out,'fixture.mjs'),bundle.outputFiles[0].text);
const {availableReports,createCatalogReport,ReportsPage,getNavigationForUser,getActiveNavigationRoute,initTheme,toggleTheme}=await import(pathToFileURL(resolve(out,'fixture.mjs')));
const user=rol=>({rol});
const reset=(rol='admin')=>globalThis.__reports={user:user(rol),reads:[],get:async()=>{throw Error('Consulta inesperada');}};

test('Tema claro inicial; oscuro explícito persistido y alternancia inmediata',()=>{
 const values=new Map(),attributes=new Map();
 globalThis.localStorage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)};
 globalThis.document={documentElement:{setAttribute:(k,v)=>attributes.set(k,v),getAttribute:k=>attributes.get(k)}};
 initTheme();assert.equal(attributes.get('data-theme'),'light');
 toggleTheme();assert.equal(values.get('pmp_theme'),'dark');initTheme();assert.equal(attributes.get('data-theme'),'dark');
 toggleTheme();assert.equal(values.get('pmp_theme'),'light');values.set('pmp_theme','invalid');initTheme();assert.equal(attributes.get('data-theme'),'light');
});
test('Reportes tiene sección propia y selección única para cada rol autorizado',()=>{
 for(const rol of ['admin','gerente','jefe_laboratorio','logistica']){
  const nav=getNavigationForUser(user(rol)),section=nav.find(s=>s.id==='reports');assert.ok(section);
  assert.equal(section.items.filter(i=>i.route==='/reportes').length,1);
  assert.equal(getActiveNavigationRoute('/reportes',nav),'/reportes');
  assert.ok(nav.filter(s=>s.id!=='reports').every(s=>s.items.every(i=>i.id!=='lab-reports')));
 }
 for(const rol of ['tecnico_laboratorio','tecnico_terreno','qa','unknown']){assert.equal(availableReports(user(rol)).length,0);assert.ok(!getNavigationForUser(user(rol)).some(s=>s.id==='reports'));assert.throws(()=>createCatalogReport('users',{},user(rol)));}
});
test('El catálogo no amplía permisos entre departamentos',()=>{
 assert.ok(!availableReports(user('gerente')).some(d=>d.id==='users'));
 assert.ok(!availableReports(user('jefe_laboratorio')).some(d=>['qa','warehouse','parts','users'].includes(d.id)));
 assert.ok(!availableReports(user('logistica')).some(d=>['lab-load','users','orders'].includes(d.id)));
 assert.throws(()=>createCatalogReport('users',{},user('gerente')));
});
test('Inventario descarga 203 coincidencias y transmite tipo y etapa reales; ignora paginación externa',async()=>{
 reset('logistica');globalThis.__reports.get=async(url,p)=>{assert.equal(url,'/api/bodega/inventario');assert.equal(p.tipo,'CONSOLA');assert.equal(p.etapa,'DISPONIBLE');assert.equal(p.q,'TEST');return {items:Array.from({length:203},(_,i)=>({id:i,serie:'TEST-'+i,tipo_equipo:'CONSOLA'})).slice(p.offset,p.offset+100),totalFiltrado:203};};
 const report=createCatalogReport('inventory',{q:' TEST ',tipo:'CONSOLA',etapa:'DISPONIBLE',offset:'200'},user('logistica'));
 assert.equal(globalThis.__reports.reads.length,0);const sheets=await report.load();assert.equal(sheets[0].rows.length,203);assert.deepEqual(globalThis.__reports.reads.map(r=>r.params.offset),[0,100,200]);assert.ok(!('offset' in report.filters));
});
test('Repuestos respeta búsqueda, tipo y umbral; no altera existencias',async()=>{
 reset('logistica');globalThis.__reports.get=async()=>({repuestos:[{nombre:'Lector',categoria:'VALIDADOR',stock:1,stock_critico:2},{nombre:'Lector',categoria:'CONSOLA',stock:0,stock_critico:2},{nombre:'Fuente',categoria:'VALIDADOR',stock:8,stock_critico:2}],solicitudes:[]});
 const result=await createCatalogReport('parts',{q:'Lector',tipo_equipo:'VALIDADOR',stock:'critical'},user('logistica')).load();assert.equal(result[0].rows.length,1);assert.equal(result[0].rows[0].Stock,1);
});
test('No descarga historia sin serie ni filtros inválidos; errores no se convierten en Excel vacío',async()=>{
 reset();assert.throws(()=>createCatalogReport('history',{tipo_equipo:'CONSOLA'},user('admin')),/serie/);
 assert.throws(()=>createCatalogReport('inventory',{tipo:'INVALIDO'},user('admin')),/opción válida/);
 await assert.rejects(()=>createCatalogReport('inventory',{tipo:'',etapa:''},user('admin')).load(),/Consulta inesperada/);
});
test('Centro permite elegir informe, cambiar filtros y bloquea acceso técnico directo',async()=>{
 reset('logistica');let view;await act(async()=>{view=Renderer.create(React.createElement(ReportsPage));});
 assert.equal(globalThis.__reports.reads.length,0);
 await act(async()=>view.root.findByProps({id:'report-selection'}).props.onChange({target:{value:'inventory'}}));
 await act(async()=>view.root.findByProps({id:'report-tipo'}).props.onChange({target:{value:'CONSOLA'}}));
 assert.equal(view.root.findByProps({id:'report-tipo'}).props.value,'CONSOLA');
 assert.ok(view.root.findAllByType('button').some(b=>b.props.title?.includes('todos los registros')));view.unmount();
 for(const rol of ['qa','tecnico_terreno','tecnico_laboratorio']){reset(rol);await act(async()=>{view=Renderer.create(React.createElement(ReportsPage));});assert.equal(view.root.findByType('span').props['data-redirect'],'/403');view.unmount();}
});
