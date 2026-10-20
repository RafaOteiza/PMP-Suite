// Render every current web page with the actual PMP shell/CSS and an unavailable API.
// These fixtures never contact Firebase, PostgreSQL or the habitual API.
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {readdir,readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {spawn} from 'node:child_process';
import {createServer} from 'node:http';
import {createServer as probeServer} from 'node:net';
const phase=process.argv.includes('--before')?'before':'after';
const sourceRoot=phase==='before'?resolve('../.local/test-results/admin-lab/before/04_Frontend'):process.cwd();
const out=resolve('../.local/test-results/admin-lab/visual-'+phase);await mkdir(out,{recursive:true});
const pages=(await readdir(join(sourceRoot,'src/pages'))).filter(x=>x.endsWith('.tsx')).map(x=>x.slice(0,-4)).filter(p=>phase!=='before'||['DashboardPage','EquipmentScanPage','LabDashboardPage','LabCustodyPage'].includes(p)).filter(p=>!['LoginPage','IngresoOSPage','MyServiceOrdersPage','RoleDashboardPage','LabWorkPage'].includes(p));
const routes={DashboardPage:'/',LabReceptionPage:'/lab/recepcion',LabDashboardPage:'/lab/dashboard',LabCustodyPage:'/lab/custodia/:osId/:step',EquipmentScanPage:'/operacion/escaneo',LabAsignacionPage:'/lab/asignacion',LabValidadoresPage:'/lab/validadores',LabConsolasPage:'/lab/consolas',LabDespachoQaPage:'/lab/despacho-qa',LabReportesPage:'/lab/reportes',AdminDespachoPage:'/admin/despacho',AdminUsersPage:'/admin/users',GestionActivosPage:'/operacion/activos',IngresoRequerimientosPage:'/operacion/requerimientos',RetirosTerrenoPage:'/operacion/retiros',OrdenesServicioPage:'/operacion/os',TrazabilidadPage:'/trazabilidad',EquiposOperativosPage:'/equipos-operativos',BridgeFlowPage:'/bridge',BodegaDashboardPage:'/bodega/dashboard',BodegaModulosPage:'/bodega/modulos',BodegaPage:'/bodega',BodegaRepuestosPage:'/bodega/repuestos',DespachoEscaneoPage:'/bodega/despacho',WarehouseOperationPage:'/bodega/recepciones/:osId',QaPage:'/qa',QaWorkPage:'/qa/:osId/:step',SettingsPage:'/settings',AIPredictionsPage:'/ia/predicciones'};
const mock=`import {useLocation} from 'react-router-dom';
export const fbAuth={currentUser:null};
export const useSession=()=>{const l=useLocation();const role=new URLSearchParams(l.search).get('role')||'admin';return {status:l.pathname.includes('LoginPage')?'unauthenticated':'authenticated',me:{id:'fixture',nombre:'Persona de prueba',apellido:'Apellido extenso de prueba',rol:role},refreshSession:async()=>null,endSession(){}};};
const fail=async(...args)=>{window.__reads.push(args[0]);throw {response:{status:503,data:{message:'Consulta no disponible · fixture aislada'}}};};
const stamp='2026-10-09T01:13:32.000Z';
const lab={camino:1,recibidos:0,pendientes:0,diagnostico:0,reparacion:0,repuestos:0,salida:0,reingresos:0};
const summary={updatedAt:stamp,assets:{total:1,validadores:1,consolas:0,operacion:0,disponibles:0,bodega:0,laboratorio:0,qa:0,transito:1,noDisponibles:1},distribution:[{etapa:'TRANSITO',label:'En tránsito',validadores:1,consolas:0,total:1}],transit:[{destino:'En tránsito hacia Laboratorio',total:1}],orders:{activas:1,cerradas:1,fallas:1,instalaciones:0,enRuta:0,retiros:0,recepciones:0,despachos:0},podCases:0,stockAlerts:0,qa:{},lab,labWorkload:[],labTechnicians:[],labInsights:{recurrentAssets:0,frequentFaults:[{falla:'Falla QR',total:1}],finished30Days:0}};
const incoming={codigo_os:'MV-FIXTURE',tipo_equipo:'VALIDADOR',serie:'7490889',modelo:'CVB45',marca:'Mikroelektronika',falla:'Falla QR',bus_ppu:'BJ2149',terminal:'El Conquistador',operador:'VOYSANTIAGO',codigo_caso:'INT-FIXTURE',fecha_salida:stamp,fecha_evento:stamp,en_camino:true,recibido:false};
const get=async(path,options={})=>{window.__reads.push(path);if(window.__scenario==='error')return fail(path);
 if(path==='/api/dashboard/badges')return {data:{lab:0,lab_dispatch:0,bodega:0,qa:0}};
 if(path==='/api/dashboard/executive')return {data:window.__scenario==='empty'?{...summary,assets:Object.fromEntries(Object.keys(summary.assets).map(k=>[k,0])),orders:Object.fromEntries(Object.keys(summary.orders).map(k=>[k,0])),distribution:[],transit:[],lab:{...lab,camino:0}}:summary};
 if(path==='/api/dashboard/summary')return {data:{kpis:{totalEnProceso:0,consolasEnLab:0,validadoresEnLab:0,totalReparados:0,totalOperativos:0,totalEnRuta:0,totalAsignados:0,totalEnBodega:0,totalEnTransito:1,totalReparadosLab:0,totalEnQa:0,totalPods:0,tiempoPromedio:null},charts:{barData:[{name:'Tránsito',cantidad:1}],pieData:[]}}};
 if(path==='/api/ai/predictive-report')return {data:[{tipo_equipo:'VALIDADOR',serie_equipo:'7490889',riesgo_score:.3,fallas_previas:1},{tipo_equipo:'VALIDADOR',serie_equipo:'7490889',riesgo_score:0,fallas_previas:0}]};
 if(path==='/api/lab/reception')return {data:{updatedAt:stamp,counts:{camino:window.__scenario==='empty'?0:1,recibidos:0,hoy:0,pendientes:0,incidencias:0,historial:0},items:window.__scenario==='empty'||(options.params?.tab&&options.params.tab!=='camino')?[]:[incoming],total:window.__scenario==='empty'?0:1,limit:20,offset:0}};
 if(path.startsWith('/api/lab/queue/')||path==='/api/lab/completed'||path==='/api/lab/technicians')return {data:[]};
 if(path.startsWith('/api/lab/custody/'))return {data:{...incoming,estado_id:2,fecha_salida_laboratorio:stamp,en_camino_laboratorio:true}};
 return fail(path);
};
export const api={get,post:async()=>{window.__writes++;throw Error('NO WRITES IN VISUAL TEST');},put:async()=>{window.__writes++;throw Error('NO WRITES IN VISUAL TEST');},patch:async()=>{window.__writes++;throw Error('NO WRITES IN VISUAL TEST');},delete:async()=>{window.__writes++;throw Error('NO WRITES IN VISUAL TEST');}};export const coreApi=api;`;
const entry=`import React from 'react';import {createRoot} from 'react-dom/client';import {RouterProvider,createHashRouter} from 'react-router-dom';import Shell from './src/components/AppLayout';
${pages.map((name,i)=>`import P${i} from './src/pages/${name}';`).join('\n')}
window.__reads=[];window.__writes=0;window.__renderErrors=[];window.__scenario=new URLSearchParams(location.hash.split('?')[1]).get('scenario')||'data';
class Boundary extends React.Component {state={error:null};static getDerivedStateFromError(error){return {error};}componentDidCatch(e){window.__renderErrors.push(e.message);}render(){return this.state.error?<p role="alert">RENDER ERROR: {this.state.error.message}</p>:this.props.children;}}
createRoot(document.getElementById('root')).render(<RouterProvider router={createHashRouter([{element:<Shell/>,children:[${pages.filter(n=>n!=='LoginPage').map((n)=>`{path:'${routes[n]||'/'+n}',element:<Boundary><P${pages.indexOf(n)} purpose="receipt"/></Boundary>}`).join(',')}]},{path:'/unused',element:<div/>}])}/>);`;
await build({stdin:{contents:entry,resolveDir:sourceRoot,loader:'tsx'},jsx:'automatic',nodePaths:[resolve('node_modules')],bundle:true,outfile:join(out,'fixture.js'),plugins:[{name:'isolated-transport',setup(b){b.onResolve({filter:/(^|\/)http$|app\/(SessionContext|firebase)$/},()=>({path:'fixture',namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:mock,loader:'js',resolveDir:process.cwd()}));}}]});
const css=(await Promise.all(['tokens','base','layout','components','pages','logistics-assets'].map(n=>readFile(join(sourceRoot,'src/styles/'+n+'.css'),'utf8')))).join('\n');
await writeFile(join(out,'fixture.html'),`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style><link rel="stylesheet" href="/fixture.css"></head><body><div id="root"></div><script src="/fixture.js"></script></body></html>`);
const server=createServer(async(req,res)=>{try{const path=req.url.split('?')[0];const file=path.startsWith('/brand/')?resolve('public','.'+path):join(out,path==='/'?'fixture.html':path.slice(1));if(!file.startsWith(out)&&!file.startsWith(resolve('public/brand')))throw Error('path');res.setHeader('Content-Type',file.endsWith('.css')?'text/css':file.endsWith('.js')?'text/javascript':file.endsWith('.svg')?'image/svg+xml':file.endsWith('.png')?'image/png':'text/html');res.end(await readFile(file));}catch{res.writeHead(404).end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`;
const probe=probeServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const debugPort=probe.address().port;await new Promise(r=>probe.close(r));
const browser=spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--remote-debugging-port='+debugPort,'--user-data-dir='+join(out,'chrome-profile'),'--no-first-run','--no-default-browser-check','about:blank'],{windowsHide:true,stdio:'ignore'});
const delay=ms=>new Promise(r=>setTimeout(r,ms));let ws;const report=[];
try{
 let tabs;for(let i=0;i<60;i++){try{tabs=await(await fetch('http://127.0.0.1:'+debugPort+'/json/list')).json();break;}catch{await delay(100);}}assert.ok(tabs);
 ws=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise(r=>ws.addEventListener('open',r,{once:true}));let seq=0;const calls=new Map();
 ws.addEventListener('message',e=>{const v=JSON.parse(e.data);if(v.id){const p=calls.get(v.id);calls.delete(v.id);v.error?p.reject(v.error):p.resolve(v.result);}});
 const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;calls.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
 const js=async expression=>{const r=await call('Runtime.evaluate',{expression,returnByValue:true});assert.ok(!r.exceptionDetails,JSON.stringify(r.exceptionDetails));return r.result.value;};await call('Page.enable');await call('Network.enable');await call('Network.setBlockedURLs',{urls:['*localhost:4000*','*127.0.0.1:4000*','*googleapis.com*','*firebaseio.com*']});
 for(const page of process.argv.includes('--checks-only')?[]:pages.filter(p=>!process.argv.includes('--shots-only')||['DashboardPage','LabReceptionPage','EquipmentScanPage','LabDashboardPage','LabCustodyPage'].includes(p))){
  const role=['IngresoOSPage','MyServiceOrdersPage','RoleDashboardPage'].includes(page)?'tecnico_terreno':page==='LabWorkPage'?'tecnico_laboratorio':page==='QaWorkPage'?'qa':'admin';
  const path=(routes[page]||'/'+page).replace(':osId','MV-FIXTURE').replace(':step','recepcion');
  await call('Page.navigate',{url:`${origin}/?screen=${page}#${path}?role=${role}`});
  for(let retry=0;retry<80;retry++){if(await js("typeof window.__reads!=='undefined' && !!document.querySelector('main')"))break;await delay(100);}
  await delay(400);
  for(const theme of ['light','dark'])for(const width of [320,390,768,1024,1440]){
   await call('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false});await js(`document.documentElement.setAttribute('data-theme','${theme}')`);await delay(350);
   const metrics=await js(`({overflow:document.documentElement.scrollWidth>innerWidth,errors:window.__renderErrors||[],heading:document.querySelector('main h1,h1')?.textContent,alerts:[...document.querySelectorAll('[role="alert"]')].map(e=>e.textContent),reads:window.__reads?.length||0,overlays:document.querySelectorAll('dialog[open],[aria-modal="true"]').length,culprits:[...document.querySelectorAll('main *')].filter(e=>e.getBoundingClientRect().right>innerWidth+1&&getComputedStyle(e).position!=='absolute').slice(0,5).map(e=>e.tagName+'.'+e.className)})`);
   report.push({page,role,theme,width,...metrics});
   if(['DashboardPage','LabReceptionPage','EquipmentScanPage','LabDashboardPage','LabCustodyPage'].includes(page)&&[390,1440].includes(width)){
    await js('document.activeElement?.blur();window.scrollTo(0,0)');await delay(100);const shot=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});await writeFile(join(out,`${page}-${theme}-${width}.png`),Buffer.from(shot.data,'base64'));
   }
  }
 }

 if(phase==='after'&&!process.argv.includes('--shots-only')){
  const checks=[];
  for(const page of ['DashboardPage','LabReceptionPage'])for(const scenario of ['empty','error'])for(const theme of ['light','dark'])for(const width of [320,1440]){
   await call('Page.navigate',{url:`${origin}/?check=${page}-${scenario}#${routes[page]}?scenario=${scenario}`});
   for(let retry=0;retry<80;retry++){if(await js("!!document.querySelector('main h1') && window.__reads?.length>1"))break;await delay(100);}
   await delay(150);await call('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false});await js(`document.documentElement.setAttribute('data-theme','${theme}')`);await delay(350);
   const state=await js(`({text:document.querySelector('main').innerText,overflow:document.documentElement.scrollWidth>innerWidth,writes:window.__writes,errors:window.__renderErrors})`);
   if(state.overflow){const shot=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});await writeFile(join(out,'overflow-state.png'),Buffer.from(shot.data,'base64'));}assert.equal(state.overflow,false,JSON.stringify({page,scenario,theme,width,culprits:await js("[...document.querySelectorAll('main *')].filter(e=>e.getBoundingClientRect().right>innerWidth+1).slice(0,10).map(e=>e.tagName+'.'+e.className)")}));assert.equal(state.writes,0);assert.deepEqual(state.errors,[]);
   assert.match(state.text,scenario==='empty'?/Sin activos registrados|Sin equipos en camino/:/No se pudo consultar|Consulta no disponible/);
   if(scenario==='error')assert.doesNotMatch(state.text,/Sin activos registrados|Sin equipos en camino/);
   checks.push({page,scenario,theme,width,passed:true});
  }
  await call('Page.navigate',{url:`${origin}/?check=navigation#/lab/recepcion`});
  for(let retry=0;retry<80;retry++){if(await js("[...document.querySelectorAll('a')].some(a=>a.textContent==='Preparar recepción')"))break;await delay(100);}
  assert.equal(await js("document.querySelectorAll('[aria-current=page]').length"),1);
  await js("[...document.querySelectorAll('a')].find(a=>a.textContent==='Preparar recepción').click()");await delay(300);
  const opened=await js("({text:document.querySelector('main').innerText,writes:window.__writes,modal:document.querySelectorAll('[aria-modal=true]').length,active:document.querySelectorAll('[aria-current=page]').length})");
  assert.match(opened.text,/MV-FIXTURE/);assert.match(opened.text,/7490889/);assert.equal(opened.writes,0);assert.equal(opened.modal,0);assert.equal(opened.active,1);
  await call('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});await call('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});
  assert.equal(await js("document.activeElement!==document.body"),true);
  await js("history.back()");await delay(200);assert.match(await js("document.querySelector('main').innerText"),/Recepción de equipos/);assert.equal(await js('window.__writes'),0);
  checks.push({check:'Preparar recepción abre página, identidad, sidebar única, teclado, volver sin escribir',passed:true});
  await writeFile(join(out,'interaction-report.json'),JSON.stringify(checks,null,2));
 }
 if(!process.argv.includes('--checks-only')&&!process.argv.includes('--shots-only'))await writeFile(join(out,'report.json'),JSON.stringify(report,null,2));
 const failures=report.filter(r=>r.overflow||r.errors.length||r.overlays||!r.heading);console.log(JSON.stringify({pages:pages.length,renders:report.length,failures},null,2));assert.equal(failures.length,0);
}finally{ws?.close();browser.kill();server.closeAllConnections();await new Promise(r=>server.close(r));}
