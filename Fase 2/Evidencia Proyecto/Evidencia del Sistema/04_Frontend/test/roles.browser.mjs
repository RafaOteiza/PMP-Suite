// Actual App/ProtectedRoute/navigation, simulated identities and read-only fixtures.
// These fixtures never contact Firebase, PostgreSQL or the habitual API.
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {readdir,readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {spawn} from 'node:child_process';
import {createServer} from 'node:http';
import {createServer as probeServer} from 'node:net';
const phase='after',sourceRoot=process.cwd();
const out=resolve('../.local/test-results/roles/visual');await mkdir(out,{recursive:true});
const pages=['DashboardPage','AdminUsersPage','LabDashboardPage','LabReceptionPage','LabAsignacionPage','LabValidadoresPage','LabConsolasPage','LabDespachoQaPage','LabReportesPage','TrazabilidadPage'];
const routes={DashboardPage:'/',LabReceptionPage:'/lab/recepcion',LabDashboardPage:'/lab/dashboard',LabCustodyPage:'/lab/custodia/:osId/:step',EquipmentScanPage:'/operacion/escaneo',LabAsignacionPage:'/lab/asignacion',LabValidadoresPage:'/lab/validadores',LabConsolasPage:'/lab/consolas',LabDespachoQaPage:'/lab/despacho-qa',LabReportesPage:'/lab/reportes',AdminDespachoPage:'/admin/despacho',AdminUsersPage:'/admin/users',GestionActivosPage:'/operacion/activos',IngresoRequerimientosPage:'/operacion/requerimientos',RetirosTerrenoPage:'/operacion/retiros',OrdenesServicioPage:'/operacion/os',TrazabilidadPage:'/trazabilidad',EquiposOperativosPage:'/equipos-operativos',BridgeFlowPage:'/bridge',BodegaDashboardPage:'/bodega/dashboard',BodegaModulosPage:'/bodega/modulos',BodegaPage:'/bodega',BodegaRepuestosPage:'/bodega/repuestos',DespachoEscaneoPage:'/bodega/despacho',WarehouseOperationPage:'/bodega/recepciones/:osId',QaPage:'/qa',QaWorkPage:'/qa/:osId/:step',SettingsPage:'/settings',AIPredictionsPage:'/ia/predicciones'};
const mock=`import {useLocation} from 'react-router-dom';
export const fbAuth={currentUser:null};
export const useSession=()=>{const l=useLocation();const role=window.__role||'admin';return {status:l.pathname.includes('LoginPage')?'unauthenticated':'authenticated',me:{id:'fixture',nombre:'Persona de prueba',apellido:'Apellido extenso de prueba',rol:role},refreshSession:async()=>null,endSession(){}};};
const fail=async(...args)=>{window.__reads.push(args[0]);throw {response:{status:503,data:{message:'Consulta no disponible · fixture aislada'}}};};
const stamp='2026-10-09T01:13:32.000Z';
const lab={camino:1,recibidos:0,pendientes:0,diagnostico:0,reparacion:0,repuestos:0,salida:0,reingresos:0};
const summary={updatedAt:stamp,assets:{total:1,validadores:1,consolas:0,operacion:0,disponibles:0,bodega:0,laboratorio:0,qa:0,transito:1,noDisponibles:1},distribution:[{etapa:'TRANSITO',label:'En tránsito',validadores:1,consolas:0,total:1}],transit:[{destino:'En tránsito hacia Laboratorio',total:1}],orders:{activas:1,cerradas:1,fallas:1,instalaciones:0,enRuta:0,retiros:0,recepciones:0,despachos:0},podCases:0,stockAlerts:0,qa:{},lab,labWorkload:[],labTechnicians:[],labInsights:{recurrentAssets:0,frequentFaults:[{falla:'Falla QR',total:1}],finished30Days:0}};
const incoming={codigo_os:'MV-FIXTURE',tipo_equipo:'VALIDADOR',serie:'7490889',modelo:'CVB45',marca:'Mikroelektronika',falla:'Falla QR',bus_ppu:'BJ2149',terminal:'El Conquistador',operador:'VOYSANTIAGO',codigo_caso:'INT-FIXTURE',fecha_salida:stamp,fecha_evento:stamp,en_camino:true,recibido:false};
const get=async(path,options={})=>{window.__reads.push(path);if(window.__scenario==='error')return fail(path);
 if(path==='/api/dashboard/badges')return {data:{lab:0,lab_dispatch:0,bodega:0,qa:0}};
 if(path==='/api/dashboard/global-search')return {data:[{tipo_equipo:'VALIDADOR',serie:'7490889',modelo:'CVB45'}]};
 if(path==='/api/users')return {data:{items:[{id:'fixture',nombre:'Administrador',apellido:'Fixture',correo:'admin@fixture.test',rol:'admin',activo:true}]}};
 if(path==='/api/lab/supervision')return {data:{updatedAt:stamp,lab,labWorkload:[],labTechnicians:[],labInsights:summary.labInsights}};
 if(path.includes('/historial'))return {data:{tipo_equipo:'VALIDADOR',serie:'7490889',modelo:'CVB45',marca:'Mikroelektronika',estado_actual:'En diagnóstico',intervenciones:[{codigo_os:'MV-FIXTURE',fecha:stamp,falla_reportada:'Falla QR',diagnostico:null,trabajo_realizado:null,resultado:null,pendiente:true,observaciones:[]}]}};
 if(path==='/api/dashboard/executive')return {data:window.__scenario==='empty'?{...summary,assets:Object.fromEntries(Object.keys(summary.assets).map(k=>[k,0])),orders:Object.fromEntries(Object.keys(summary.orders).map(k=>[k,0])),distribution:[],transit:[],lab:{...lab,camino:0}}:summary};
 if(path==='/api/dashboard/summary')return {data:{kpis:{totalEnProceso:0,consolasEnLab:0,validadoresEnLab:0,totalReparados:0,totalOperativos:0,totalEnRuta:0,totalAsignados:0,totalEnBodega:0,totalEnTransito:1,totalReparadosLab:0,totalEnQa:0,totalPods:0,tiempoPromedio:null},charts:{barData:[{name:'Tránsito',cantidad:1}],pieData:[]}}};
 if(path==='/api/ai/predictive-report')return {data:[{tipo_equipo:'VALIDADOR',serie_equipo:'7490889',riesgo_score:.3,fallas_previas:1},{tipo_equipo:'VALIDADOR',serie_equipo:'7490889',riesgo_score:0,fallas_previas:0}]};
 if(path==='/api/lab/reception')return {data:{updatedAt:stamp,counts:{camino:window.__scenario==='empty'?0:1,recibidos:0,hoy:0,pendientes:0,incidencias:0,historial:0},items:window.__scenario==='empty'||(options.params?.tab&&options.params.tab!=='camino')?[]:[incoming],total:window.__scenario==='empty'?0:1,limit:20,offset:0}};
 if(path.startsWith('/api/lab/queue/')||path==='/api/lab/completed'||path==='/api/lab/technicians')return {data:[]};
 if(path.startsWith('/api/lab/custody/'))return {data:{...incoming,estado_id:2,fecha_salida_laboratorio:stamp,en_camino_laboratorio:true}};
 return fail(path);
};
export const api={get,post:async()=>{window.__writes++;throw Error('NO WRITES IN VISUAL TEST');},put:async()=>{window.__writes++;throw Error('NO WRITES IN VISUAL TEST');},patch:async()=>{window.__writes++;throw Error('NO WRITES IN VISUAL TEST');},delete:async()=>{window.__writes++;throw Error('NO WRITES IN VISUAL TEST');}};export const coreApi=api;`;
const entry=`import React from 'react';import {createRoot} from 'react-dom/client';import {HashRouter} from 'react-router-dom';import App from './src/App';
window.__role=new URLSearchParams(location.hash.split('?')[1]).get('role')||'admin';window.__reads=[];window.__writes=0;window.__renderErrors=[];window.__scenario='data';
window.addEventListener('error',e=>window.__renderErrors.push(e.message));
createRoot(document.getElementById('root')).render(<HashRouter><App/></HashRouter>);`;
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
 const cases=[...pages.map(page=>({page,role:['DashboardPage','AdminUsersPage'].includes(page)?'admin':'jefe_laboratorio'})),{page:'DashboardPage',role:'gerente'}];
 for(const {page,role} of process.argv.includes('--checks-only')?[]:process.argv.includes('--affected-only')?cases.filter(c=>['DashboardPage','LabReportesPage','TrazabilidadPage'].includes(c.page)):cases){
  const path=(routes[page]||'/'+page)+(page==='TrazabilidadPage'?'?tipo=VALIDADOR&serie=7490889&':'?');
  await call('Page.navigate',{url:`${origin}/?screen=${page}#${path}role=${role}`});
  for(let retry=0;retry<80;retry++){if(await js("typeof window.__reads!=='undefined' && !!document.querySelector('main')"))break;await delay(100);}
  await delay(400);
  for(const theme of ['light','dark'])for(const width of [320,390,768,1024,1440]){
   await call('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false});await js(`document.documentElement.setAttribute('data-theme','${theme}')`);await delay(350);
   const metrics=await js(`({overflow:document.documentElement.scrollWidth>innerWidth,errors:window.__renderErrors||[],heading:document.querySelector('main h1,h1')?.textContent,alerts:[...document.querySelectorAll('[role="alert"]')].map(e=>e.textContent),reads:window.__reads?.length||0,overlays:document.querySelectorAll('dialog[open],[aria-modal="true"]').length,culprits:[...document.querySelectorAll('main *')].filter(e=>e.getBoundingClientRect().right>innerWidth+1&&getComputedStyle(e).position!=='absolute').slice(0,5).map(e=>e.tagName+'.'+e.className)})`);
   report.push({page,role,theme,width,...metrics});
   if([390,1440].includes(width)){
    await js('document.activeElement?.blur();window.scrollTo(0,0)');await delay(100);const shot=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});await writeFile(join(out,`${role}-${page}-${theme}-${width}.png`),Buffer.from(shot.data,'base64'));
   }
  }
 }

 if(report.length)await writeFile(join(out,process.argv.includes('--affected-only')?'affected-report.json':'report.json'),JSON.stringify(report,null,2));
 const direct=[];
 for(const [role,path] of [['gerente','/admin/users'],['gerente','/lab/asignacion'],['admin','/lab/custodia/MV-FIXTURE/recepcion'],['admin','/bodega/despacho'],['jefe_laboratorio','/admin/users'],['jefe_laboratorio','/bodega'],['jefe_laboratorio','/qa'],['jefe_laboratorio','/mi-carga/MV-FIXTURE']]){
  await call('Page.navigate',{url:`${origin}/?rolecheck=${encodeURIComponent(role+path)}#${path}?role=${role}`});for(let i=0;i<100;i++){if(await js("location.hash.includes('/403')"))break;await delay(100);}
  const state=await js('({path:location.hash,writes:window.__writes,errors:window.__renderErrors})');assert.match(state.path,/403/);assert.equal(state.writes,0);assert.deepEqual(state.errors,[]);direct.push({role,path,denied:true});
 }
 await call('Page.navigate',{url:`${origin}/?searchcheck=1#/lab/recepcion?role=jefe_laboratorio`});
 for(let i=0;i<100;i++){if(await js("!!document.querySelector('input[aria-label]')"))break;await delay(100);}
 await call('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});
 await js("document.querySelector('input[aria-label]').focus()");await call('Input.insertText',{text:'7490889'});await delay(800);
 const reads=await js('window.__reads');assert.ok(reads.includes('/api/dashboard/global-search'));assert.ok(!reads.some(p=>p.includes('/requerimientos')));assert.equal(await js('window.__writes'),0);
 direct.push({check:'Búsqueda global Jefatura usa activos; no consulta casos administrativos',passed:true});
 await writeFile(join(out,'direct-routes.json'),JSON.stringify(direct,null,2));
 if(!process.argv.includes('--checks-only')&&!process.argv.includes('--shots-only'))await writeFile(join(out,process.argv.includes('--affected-only')?'affected-report.json':'report.json'),JSON.stringify(report,null,2));
 const failures=report.filter(r=>r.overflow||r.errors.length||r.overlays||!r.heading);console.log(JSON.stringify({pages:pages.length,renders:report.length,failures},null,2));assert.equal(failures.length,0);
}finally{ws?.close();browser.kill();server.closeAllConnections();await new Promise(r=>server.close(r));}
