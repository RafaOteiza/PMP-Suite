// Actual PMP shell/components and router; API responses are isolated fixtures. No habitual API calls.
import assert from 'node:assert/strict';
import {inventoryFixture,initialAsset,stageLabels} from './logistics-fixture.mjs';
import {build} from 'esbuild';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {spawn} from 'node:child_process';
import {createServer} from 'node:http';
import {createServer as createProbe} from 'node:net';

const out=resolve('../.local/test-results/logistics-redesign/browser');await mkdir(out,{recursive:true});
const mock=`
const initialAsset=${JSON.stringify(initialAsset)},stageLabels=${JSON.stringify(stageLabels)};
const inventoryFixture=${inventoryFixture.toString()};
export const fbAuth={currentUser:null};
export const useSession=()=>({status:'authenticated',me:{id:'fixture',nombre:'Usuario',apellido:'Prueba aislada',rol:window.__role},refreshSession:async()=>null,endSession(){}});
export const api={get:async(path,options={})=>{
 window.__reads.push(path);const scenario=window.__scenario;
 if(path==='/api/dashboard/badges')return {data:{bodega:0,lab:0,lab_dispatch:0,qa:0}};
 if(path==='/api/bodega/inventario') {
  if(scenario==='error')throw Error('Consulta de inventario no disponible');
  let rows=scenario==='empty'?[]:[initialAsset];
  if(scenario==='active')rows=[{...initialAsset,codigo_os:'IN-000001',etapa:'TRANSITO',estado_actual:'En ruta hacia terreno',ubicacion_actual:'En ruta hacia terreno',en_bodega:false,disponible:false}];
  if(scenario==='mixed')rows=Object.entries(stageLabels).map(([etapa,label],i)=>({...initialAsset,serie:String(7409100+i),tipo_equipo:i%2?'CONSOLA':'VALIDADOR',modelo:i%2?'CPV7':'CVB45',etapa,estado_actual:label,disponible:etapa==='DISPONIBLE',en_bodega:['DISPONIBLE','BODEGA'].includes(etapa),procedencia:i%2?'Compra':'Reparado',ubicacion_actual:label,codigo_os:i%2?'MV-9000'+i:null}));
  return {data:inventoryFixture(rows,options.params)};
 }
 if(path==='/api/bodega/dashboard')return {data:{alertasStock:0,equiposAsignados:0,equiposEnRuta:scenario==='active'?1:0,distribucionEstados:scenario==='active'?[{name:'EN_RUTA',estado_id:1,value:1}]:[]}};
 if(path==='/api/bodega/stock')return {data:{inventario:{validadores:scenario==='empty'?0:1,consolas:0,total:scenario==='empty'?0:1},listos:scenario==='stock'?[{codigo_os:null,tipo_equipo:'VALIDADOR',serie:'7409101',modelo:'CVB45',marca:'Mikroelektronika',bus_ppu:null,fecha:'2026-10-08T12:00:00Z',escaneado_bodega:false}]:[]}};
 if(path==='/api/bodega/queue')return {data:[]};
 throw Error('Unexpected fixture read: '+path);
},post:async()=>{throw Error('Writes forbidden');},put:async()=>{throw Error('Writes forbidden');},patch:async()=>{throw Error('Writes forbidden');}};
export const coreApi=api;`;
const entry=`import React from 'react';import {createRoot} from 'react-dom/client';import {RouterProvider,createHashRouter} from 'react-router-dom';
import Shell from './src/components/AppLayout';import Dashboard from './src/pages/BodegaDashboardPage';import Inventory from './src/pages/BodegaModulosPage';import Warehouse from './src/pages/BodegaPage';
import {getNavigationForUser} from './src/app/navigation';
const params=new URLSearchParams(location.hash.split('?')[1]);window.__role=params.get('role')||'logistica';window.__scenario=params.get('scenario')||'stock';window.__reads=[];window.__errors=[];
window.__links=getNavigationForUser({rol:window.__role}).flatMap(s=>s.items).map(i=>i.route);
class Boundary extends React.Component{state={error:null};static getDerivedStateFromError(error){return {error};}componentDidCatch(e){window.__errors.push(e.message);}render(){return this.state.error?<p role='alert'>Render error</p>:this.props.children;}}
window.__router=createHashRouter([{element:<Shell/>,children:[{path:'/bodega/dashboard',element:<Dashboard/>},{path:'/bodega/modulos',element:<Inventory/>},{path:'/bodega',element:<Warehouse/>},{path:'*',element:<div className='page'><h1>Verificación aislada de navegación</h1></div>}]}]);
createRoot(document.getElementById('root')).render(<Boundary><RouterProvider router={window.__router}/></Boundary>);`;
await build({stdin:{contents:entry,resolveDir:process.cwd(),loader:'tsx'},bundle:true,outfile:join(out,'fixture.js'),plugins:[{name:'isolated-transport',setup(b){b.onResolve({filter:/(^|\/)http$|app\/(SessionContext|firebase)$/},()=>({path:'mock',namespace:'mock'}));b.onLoad({filter:/.*/,namespace:'mock'},()=>({contents:mock,loader:'js',resolveDir:process.cwd()}));}}]});
const css=(await Promise.all(['tokens','base','layout','components','pages','logistics-assets'].map(n=>readFile('src/styles/'+n+'.css','utf8')))).join('\n');
await writeFile(join(out,'fixture.html'),`<!doctype html><html><head><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'><style>${css}</style></head><body><div id='root'></div><script src='/fixture.js'></script></body></html>`);
const server=createServer(async(req,res)=>{try{const path=req.url.split('?')[0];const file=path.startsWith('/brand/')?resolve('public','.'+path):join(out,path==='/'?'fixture.html':path.slice(1));if(!file.startsWith(out)&&!file.startsWith(resolve('public/brand')))throw Error('path');res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.svg')?'image/svg+xml':file.endsWith('.png')?'image/png':'text/html');res.end(await readFile(file));}catch{res.writeHead(404).end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
const probe=createProbe();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const debugPort=probe.address().port;await new Promise(r=>probe.close(r));
const browser=spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--remote-debugging-port='+debugPort,'--user-data-dir='+join(out,'chrome-profile'),'--no-first-run','--no-default-browser-check','about:blank'],{windowsHide:true,stdio:'ignore'});
const delay=ms=>new Promise(r=>setTimeout(r,ms));let ws;const report={renders:[],navigation:[],interaction:[],backendConnections:0};
try{
 let tabs;for(let i=0;i<60;i++){try{tabs=await(await fetch('http://127.0.0.1:'+debugPort+'/json/list')).json();break;}catch{await delay(100);}}assert.ok(tabs);
 ws=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise(r=>ws.addEventListener('open',r,{once:true}));let seq=0;const calls=new Map();
 ws.addEventListener('message',e=>{const v=JSON.parse(e.data);if(v.id){const p=calls.get(v.id);calls.delete(v.id);v.error?p.reject(v.error):p.resolve(v.result);}if(v.method==='Network.requestWillBeSent'&&/:4000\b|googleapis\.com|firebaseio\.com/.test(v.params.request.url))report.backendConnections++;});
 const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;calls.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
 const js=async expression=>{const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});assert.ok(!r.exceptionDetails,JSON.stringify(r.exceptionDetails));return r.result.value;};
 await call('Page.enable');await call('Network.enable');await call('Network.setBlockedURLs',{urls:['*localhost:4000*','*127.0.0.1:4000*','*googleapis.com*','*firebaseio.com*']});
 let loadId=0;
 const load=async(path,role='logistica',scenario='stock')=>{await call('Page.navigate',{url:origin+'/?fixture='+(++loadId)+'#'+path+'?role='+role+'&scenario='+scenario});await delay(700);};
 const go=async path=>{await js('window.__router.navigate('+JSON.stringify(path)+')');await delay(100);};
 const active=async expected=>{
  const found=await js(`({active:[...document.querySelectorAll('.sb-link.active')].map(a=>a.hash.slice(1)),current:[...document.querySelectorAll('.sb-link[aria-current="page"]')].map(a=>a.hash.slice(1))})`);
  const context=await js(`({role:window.__role,path:window.__router.state.location.pathname,hash:location.hash,links:[...document.querySelectorAll('.sb-link')].map(a=>({href:a.hash,text:a.textContent,class:a.className,current:a.getAttribute('aria-current')})),errors:window.__errors})`);
  assert.deepEqual(found.active,expected?[expected]:[],JSON.stringify(context));assert.deepEqual(found.current,expected?[expected]:[],JSON.stringify(context));return found;
 };
 for(const role of ['admin','logistica','gerente','qa','tecnico_terreno','tecnico_laboratorio']){
  await load('/settings',role);const links=await js('window.__links');
  for(const path of links){await go(path);await active(path);report.navigation.push({role,path,active:path});if(path!=='/'){await go(path+'/detalle');await active(path);report.navigation.push({role,path:path+'/detalle',active:path});}}
  const extra=role==='admin'?[['/lab/custodia/MV-FIXTURE/recepcion','/operacion/escaneo'],['/lab/custodia/MV-FIXTURE/salida','/lab/despacho-qa']]:role==='qa'?[['/mi-jornada','/qa'],['/qa/MV-FIXTURE/pruebas','/qa']]:role==='tecnico_laboratorio'?[['/mi-carga/MV-FIXTURE','/mi-jornada']]:[];
  for(const [path,parent] of extra){await go(path);await active(parent);report.navigation.push({role,path,active:parent});}
 }
 for(const scenario of ['empty','stock','active','mixed'])for(const path of ['/bodega/dashboard','/bodega/modulos']){
  await load(path,'logistica',scenario);
  for(const theme of ['light','dark'])for(const width of [320,375,390,768,1024,1440]){
   await call('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:false});await js('document.documentElement.setAttribute("data-theme",'+JSON.stringify(theme)+')');await delay(120);await active(path);
   const state=await js(`({overflow:document.documentElement.scrollWidth>innerWidth,errors:window.__errors,total:[...document.querySelectorAll('.stat-card')].find(e=>e.textContent.includes('Total activos')||e.textContent.includes('Total inventario'))?.querySelector('.stat-value')?.textContent,available:[...document.querySelectorAll('.stat-card')].find(e=>e.textContent.startsWith('Disponibles'))?.querySelector('.stat-value')?.textContent,table:!!document.querySelector('.asset-logistics-table')})`);
   assert.equal(state.overflow,false,JSON.stringify({scenario,path,theme,width,state}));assert.deepEqual(state.errors,[]);assert.equal(state.total,scenario==='empty'?'0':scenario==='mixed'?'8':'1');
   assert.equal(state.available,['empty','active'].includes(scenario)?'0':'1');
   report.renders.push({scenario,path,theme,width,...state});
   if([320,1440].includes(width)&&['stock','mixed'].includes(scenario)){const shot=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});await writeFile(join(out,path.endsWith('modulos')?'inventory-'+scenario+'-'+theme+'-'+width+'.png':'dashboard-'+scenario+'-'+theme+'-'+width+'.png'),Buffer.from(shot.data,'base64'));}
  }
 }
 // Real KPI click, filters, clear, empty/error and keyboard interaction.
 await load('/bodega/dashboard');await js(`[...document.querySelectorAll('.stat-card')].find(e=>e.textContent.startsWith('Disponibles')).click()`);await delay(200);
 assert.equal(await js('window.__router.state.location.pathname'),'/bodega/modulos');assert.ok((await js('window.__router.state.location.search')).includes('etapa=DISPONIBLE'));
 assert.ok(await js('document.querySelector("main").textContent.includes("7409101")'));
 await js(`[...document.querySelectorAll('.asset-sections button')].find(e=>e.textContent==='No disponibles').click()`);await delay(200);
 assert.ok(await js('document.querySelector("main").textContent.includes("Sin equipos en esta consulta")'));
 await js(`[...document.querySelectorAll('button')].find(e=>e.textContent==='Limpiar filtros').click()`);await delay(200);
 const labels=await js(`[...document.querySelectorAll('.asset-filters input,.asset-filters select')].every(e=>!!e.closest('label'))`);assert.ok(labels);
 report.interaction.push({kpiNavigation:true,filter:true,clear:true,labels:true});
 for(const path of ['/bodega/dashboard','/bodega/modulos']) {await load(path,'logistica','error');assert.ok(await js('!!document.querySelector("[role=alert]")'));assert.equal(await js('!!document.querySelector(".empty-state")'),false);}
 // Open and use the actual mobile drawer, including closing it on navigation.
 await load('/bodega/dashboard');
 for(const theme of ['light','dark'])for(const width of [320,390,768]){
  await call('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false});await js('document.documentElement.setAttribute("data-theme",'+JSON.stringify(theme)+')');
  for(const path of ['/bodega/modulos','/bodega','/bodega/dashboard']){
   await js('document.querySelector('+JSON.stringify('[aria-label="Abrir navegación"]')+').click()');await delay(350);
   assert.ok(await js('document.querySelector(".sidebar").classList.contains("is-mobile-open")'));
   assert.equal(await js('document.documentElement.scrollWidth>innerWidth'),false);
   await js('[...document.querySelectorAll(".sb-link")].find(a=>a.hash==='+JSON.stringify('#'+path)+').click()');await delay(350);await active(path);
   assert.equal(await js('document.querySelector(".sidebar").classList.contains("is-mobile-open")'),false);
  }
  report.interaction.push({theme,width,mobileNavigation:true});
 }
 // Genuine link clicks, hover and keyboard focus use the actual menu and CSS.
 await load('/bodega/dashboard');await call('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});
 for(const theme of ['light','dark']){
  await js('document.documentElement.setAttribute("data-theme",'+JSON.stringify(theme)+')');await delay(350);
  for(const path of ['/bodega/modulos','/bodega','/bodega/dashboard']){await js('[...document.querySelectorAll(".sb-link")].find(a=>a.hash==='+JSON.stringify('#'+path)+').click()');await delay(350);await active(path);if(path==='/bodega/modulos')assert.ok(await js('document.querySelector("main").textContent.includes("7409101")'));}
  await call('Input.dispatchMouseEvent',{type:'mouseMoved',x:900,y:30});await delay(200);
  const baseline=await js(`(()=>{const a=[...document.querySelectorAll('.sb-link')].find(a=>a.hash==='#/bodega');window.__target=a;return {normal:getComputedStyle(a).backgroundColor,active:getComputedStyle(document.querySelector('.sb-link.active')).backgroundColor,rect:{x:a.getBoundingClientRect().x+20,y:a.getBoundingClientRect().y+20}}})()`);
  await call('Input.dispatchMouseEvent',{type:'mouseMoved',...baseline.rect});await delay(200);
  const hover=await js('getComputedStyle(window.__target).backgroundColor');assert.notEqual(hover,baseline.normal);assert.notEqual(hover,baseline.active);
  await call('Input.dispatchMouseEvent',{type:'mouseMoved',x:900,y:30});await call('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});await call('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});await js('window.__target.focus()');
  const focus=await js(`({visible:window.__target.matches(':focus-visible'),style:getComputedStyle(window.__target).outlineStyle,width:getComputedStyle(window.__target).outlineWidth})`);assert.ok(focus.visible);assert.notEqual(focus.style,'none');assert.notEqual(focus.width,'0px');await active('/bodega/dashboard');
  report.interaction.push({theme,hoverDistinct:true,focusVisible:true,selectionUnchanged:true});
 }
 assert.equal(report.backendConnections,0);await writeFile(join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:true,renders:report.renders.length,navigationChecks:report.navigation.length,interactionChecks:report.interaction.length,backendConnections:0}));
}finally{ws?.close();browser.kill();server.closeAllConnections();await new Promise(r=>server.close(r));}
