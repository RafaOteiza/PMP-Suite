import {existsSync} from 'node:fs';
import {buildMaintenanceAnalysis} from '../../03_Backend/pmp-api/src/services/maintenanceAnalysis.js';
// Render the three role dashboards with the actual PMP shell and isolated fixtures.
// These fixtures never contact Firebase, PostgreSQL or the habitual API.
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import * as XLSX from 'xlsx';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {spawn} from 'node:child_process';
import {createServer} from 'node:http';
import {createServer as probeServer} from 'node:net';
const sourceRoot=process.cwd();
const reportsOnly=process.argv.includes('--reports');
const aiOnly=process.argv.includes('--ai-only'),brand=process.argv.includes('--brand'),before=process.argv.includes('--before');
const out=resolve('../.local/pmp-verification/'+(reportsOnly?'report-center-2026-10-12':brand?'brand-refresh-2026-10-12/'+(before?'before':'after'):aiOnly?'maintenance-reports-2026-10-12':'operational-insights-2026-10-12')+'/visual');await mkdir(out,{recursive:true});
const pages=['BodegaDashboardPage','DashboardPage','LabDashboardPage','AIPredictionsPage',...(brand?['LoginPage']:[]),'ReportsPage'];
const routes={ReportsPage:'/reportes',AIPredictionsPage:'/ia/predicciones',DashboardPage:'/',LabDashboardPage:'/lab/dashboard',BodegaDashboardPage:'/bodega/dashboard'};
const analysisFixture=buildMaintenanceAnalysis({orders:Array.from({length:12},(_,i)=>({codigo_os:'MV-REPORT-'+i,tipo_equipo:i<4?'VALIDADOR':'CONSOLA',serie:i<4?'TEST-7490999':'TEST-9715B6697699'+i,fecha:new Date(Date.UTC(2026,6,1+i*7)).toISOString(),falla:i<4?'Lector QR intermitente':'[SIMULACION LOTE] Audio intermitente',bus_ppu:'TEST00'})),closures:[{codigo_os:'MV-REPORT-0',fecha:'2026-07-10',resultado:'REPARADO',diagnostico:'Lector QR confirmado'},{codigo_os:'MV-REPORT-5',fecha:'2026-09-10',resultado:'NFF'}],stock:[{id:1,nombre:'Lector QR',categoria:'VALIDADOR',stock:3,stock_critico:2},{id:2,nombre:'Cable de audio',categoria:'CONSOLA',stock:0,stock_critico:4}],deliveries:['2026-08-01','2026-09-01','2026-10-01'].map(fecha=>({repuesto_id:1,cantidad:30,fecha,falla:'Lector QR'}))},'2026-10-12T12:00:00Z');
const mock=`import {useLocation} from 'react-router-dom';
export const fbAuth={currentUser:null};
export const useSession=()=>{const l=useLocation();const role=new URLSearchParams(l.search).get('role')||'admin';return {status:l.pathname.includes('LoginPage')?'unauthenticated':'authenticated',me:{id:'fixture',nombre:'Persona de prueba',apellido:'Apellido extenso de prueba',rol:role},refreshSession:async()=>null,endSession(){}};};
const fail=async(...args)=>{window.__reads.push(args[0]);throw {response:{status:503,data:{message:'Consulta no disponible · fixture aislada'}}};};
const stamp='2026-10-09T01:13:32.000Z';
const lab={camino:1,recibidos:0,pendientes:0,diagnostico:0,reparacion:0,repuestos:0,salida:0,reingresos:0};
const summary={updatedAt:stamp,assets:{total:1,validadores:1,consolas:0,operacion:0,disponibles:0,bodega:0,laboratorio:0,qa:0,transito:1,noDisponibles:1},distribution:[{etapa:'TRANSITO',label:'En tránsito',validadores:1,consolas:0,total:1}],transit:[{destino:'En tránsito hacia Laboratorio',total:1}],orders:{activas:1,cerradas:1,fallas:1,instalaciones:0,enRuta:0,retiros:0,recepciones:0,despachos:0},podCases:0,stockAlerts:0,qa:{},lab,labWorkload:[],labTechnicians:[],labInsights:{recurrentAssets:0,frequentFaults:[{falla:'Falla QR',total:1}],finished30Days:0}};
const distribution=[['OPERACION','En operaci\u00f3n',8,5],['DISPONIBLE','Disponibles',4,3],['BODEGA','Bodega no disponibles',2,1],['LABORATORIO','Laboratorio',3,2],['QA','Control QA',1,2],['TRANSITO','En tr\u00e1nsito',2,1]].map(([etapa,label,validadores,consolas])=>({etapa,label,validadores,consolas,total:validadores+consolas}));
summary.distribution=distribution;summary.assets={total:34,validadores:20,consolas:14,operacion:13,disponibles:7,bodega:10,laboratorio:5,qa:3,transito:3,noDisponibles:3};
summary.labInsights={recurrentAssets:3,frequentFaults:[],finished30Days:23,closuresByWeek:[{semana:'2026-09-14',total:2},{semana:'2026-09-21',total:5},{semana:'2026-09-28',total:8},{semana:'2026-10-05',total:6},{semana:'2026-10-12',total:2}],closureResults:[{resultado:'REPARADO',total:15},{resultado:'NFF',total:5},{resultado:'POD',total:3}]};
const insights={updatedAt:stamp,summary:{orders:20,assets:18,buses:8,withoutBus:0,simulationOrders:20},buses:[{ppu:'TEST01',validadores:4,consolas:3,total:7,activos:5},{ppu:'TEST02',validadores:2,consolas:1,total:3,activos:2}],faults:[{falla:'[SIMULACION PMP-PRUEBA-20] Lectura intermitente de QR',total:6},{falla:'[SIMULACION PMP-PRUEBA-20] Audio intermitente',total:3}],diagnoses:[{falla:'Lector QR',total:5},{falla:'Conector de audio',total:2}],components:[{referencia:'1',nombre:'Lector QR',ordenes:4,unidades:5},{referencia:'2',nombre:'Cable de audio',ordenes:2,unidades:2}]};
insights.analysis=${JSON.stringify(analysisFixture)};
insights.buses=Array.from({length:10},(_,i)=>({ppu:'TEST'+String(i).padStart(2,'0'),validadores:1,consolas:0,total:1,activos:1}));
insights.faults=Array.from({length:10},(_,i)=>({falla:'[SIMULACION PMP-PRUEBA-20-20261011] '+['Audio intermitente','Bloqueo no reproducible','Botonera sin respuesta','Carcasa rota','Equipo no responde','Lectura intermitente'][i%6]+' '+i,total:1}));
insights.diagnoses=insights.faults.map((f,i)=>({...f,total:i<2?2:1}));
const tickets=[2,45,80,12,30].map((hours,i)=>({codigo_os:'MV-FIXTURE-'+i,tipo_equipo:i<3?'VALIDADOR':'CONSOLA',serie:'FIXTURE-'+i,estado_id:i%2?5:4,falla:'Lectura intermitente',fecha:new Date(Date.now()-hours*3600000).toISOString(),fecha_ingreso_laboratorio:new Date(Date.now()-hours*3600000).toISOString(),tecnico_laboratorio_id:i===4?null:'tech-'+i%2,tecnico_laboratorio:i%2?'Persona de prueba B':'Persona de prueba A'}));
const get=async(path,options={})=>{window.__reads.push(path);if(window.__scenario==='error')return fail(path);
 if(path==='/api/bodega/inventario')return {data:{resumen:window.__scenario==='empty'?{total:0,validadores:0,consolas:0,bodega:0,disponibles:0,noDisponibles:0}:summary.assets,distribucion:window.__scenario==='empty'?[]:distribution,secundarios:{instalaciones:2,recepciones:3,despachos:1,alertasStock:4},filtros:{modelos:[],origenes:[],estados:[]},items:[],totalFiltrado:0,limit:20,offset:0,recientes:[]}};
 if(path==='/api/lab/supervision')return {data:window.__scenario==='empty'?{...summary,labInsights:{finished30Days:0,recurrentAssets:0,frequentFaults:[],closuresByWeek:[],closureResults:[]}}:summary};
 if(path==='/api/ai/operational-insights')return {data:window.__scenario==='empty'?{...insights,analysis:{...insights.analysis,assets:[],parts:[],outcomes:[],incidents:[],diagnostics:[],alerts:[]},summary:{orders:0,assets:0,buses:0,withoutBus:0,simulationOrders:0},buses:[],faults:[],diagnoses:[],components:[]}:insights};
 if(path.startsWith('/api/lab/queue/'))return {data:window.__scenario==='empty'?[]:tickets.filter(t=>path.endsWith(t.tipo_equipo))};
 if(path==='/api/dashboard/badges')return {data:{lab:0,lab_dispatch:0,bodega:0,qa:0}};
 if(path==='/api/dashboard/executive')return {data:window.__scenario==='empty'?{...summary,assets:Object.fromEntries(Object.keys(summary.assets).map(k=>[k,0])),orders:Object.fromEntries(Object.keys(summary.orders).map(k=>[k,0])),distribution:[],transit:[],lab:{...lab,camino:0}}:summary};

 if(path==='/api/ai/predictive-report')return {data:window.__scenario==='empty'?[]:Array.from({length:10},(_,i)=>({tipo_equipo:'CONSOLA',serie_equipo:'TEST-9715B6697699'+i,riesgo_score:0,fallas_previas:0}))};

 if(path.startsWith('/api/lab/queue/')||path==='/api/lab/completed'||path==='/api/lab/technicians')return {data:[]};

 return fail(path);
};
export const api={get,post:async()=>{window.__writes++;throw Error('NO WRITES IN VISUAL TEST');},put:async()=>{window.__writes++;throw Error('NO WRITES IN VISUAL TEST');},patch:async()=>{window.__writes++;throw Error('NO WRITES IN VISUAL TEST');},delete:async()=>{window.__writes++;throw Error('NO WRITES IN VISUAL TEST');}};export const coreApi=api;`;
const entry=`import React from 'react';import {createRoot} from 'react-dom/client';import {RouterProvider,createHashRouter} from 'react-router-dom';import Shell from './src/components/AppLayout';
${pages.map((name,i)=>`import P${i} from './src/pages/${name}';`).join('\n')}
window.__reads=[];window.__writes=0;window.__renderErrors=[];window.__scenario=new URLSearchParams(location.hash.split('?')[1]).get('scenario')||'data';
class Boundary extends React.Component {state={error:null};static getDerivedStateFromError(error){return {error};}componentDidCatch(e){window.__renderErrors.push(e.message);}render(){return this.state.error?<p role="alert">RENDER ERROR: {this.state.error.message}</p>:this.props.children;}}
createRoot(document.getElementById('root')).render(<RouterProvider router={createHashRouter([{element:<Shell/>,children:[${pages.filter(n=>n!=='LoginPage').map((n)=>`{path:'${routes[n]||'/'+n}',element:<Boundary><P${pages.indexOf(n)} purpose="receipt"/></Boundary>}`).join(',')}]},{path:'/LoginPage',element:${brand?'<P4/>':'<div/>'}}])}/>);`;
if(!before||!existsSync(join(out,'fixture.html'))){
await build({stdin:{contents:entry,resolveDir:sourceRoot,loader:'tsx'},jsx:'automatic',nodePaths:[resolve('node_modules')],bundle:true,outfile:join(out,'fixture.js'),plugins:[{name:'isolated-transport',setup(b){b.onResolve({filter:/(^|\/)http$|app\/(SessionContext|firebase)$/},()=>({path:'fixture',namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:mock,loader:'js',resolveDir:process.cwd()}));}}]});
const css=(await Promise.all(['tokens','base','layout','components','pages','logistics-assets','product-ui'].map(n=>readFile(join(sourceRoot,'src/styles/'+n+'.css'),'utf8')))).join('\n');
await writeFile(join(out,'fixture.html'),`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style><link rel="stylesheet" href="/fixture.css"></head><body><div id="root"></div><script src="/fixture.js"></script></body></html>`);
}
const server=createServer(async(req,res)=>{try{const path=req.url.split('?')[0];const file=path.startsWith('/brand/')?resolve('public','.'+path):join(out,path==='/'?'fixture.html':path.slice(1));if(!file.startsWith(out)&&!file.startsWith(resolve('public/brand')))throw Error('path');res.setHeader('Content-Type',file.endsWith('.css')?'text/css':file.endsWith('.js')?'text/javascript':file.endsWith('.svg')?'image/svg+xml':file.endsWith('.png')?'image/png':'text/html');res.end(await readFile(file));}catch{res.writeHead(404).end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`;
const probe=probeServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const debugPort=probe.address().port;await new Promise(r=>probe.close(r));
const browser=spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--remote-debugging-port='+debugPort,'--user-data-dir='+join(out,'chrome-profile'),'--no-first-run','--no-default-browser-check','about:blank'],{windowsHide:true,stdio:'ignore'});
const delay=ms=>new Promise(r=>setTimeout(r,ms));let ws;const report=[];
try{
 let tabs;for(let i=0;i<60;i++){try{tabs=await(await fetch('http://127.0.0.1:'+debugPort+'/json/list')).json();break;}catch{await delay(100);}}assert.ok(tabs);
 ws=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise(r=>ws.addEventListener('open',r,{once:true}));let seq=0;const calls=new Map();
 ws.addEventListener('message',e=>{const v=JSON.parse(e.data);if(v.id){const p=calls.get(v.id);calls.delete(v.id);clearTimeout(p.timer);v.error?p.reject(v.error):p.resolve(v.result);}});
 const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;const timer=setTimeout(()=>{calls.delete(id);reject(Error('Browser timeout: '+method));},20000);calls.set(id,{resolve,reject,timer});ws.send(JSON.stringify({id,method,params}));});
 const js=async expression=>{const r=await call('Runtime.evaluate',{expression,returnByValue:true,userGesture:true});assert.ok(!r.exceptionDetails,JSON.stringify(r.exceptionDetails));return r.result.value;};await call('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:out});await call('Page.enable');await call('Page.bringToFront');await call('Emulation.setFocusEmulationEnabled',{enabled:true});await call('Network.enable');await call('Network.setBlockedURLs',{urls:['*localhost:4000*','*127.0.0.1:4000*','*googleapis.com*','*firebaseio.com*']});

 const cases=reportsOnly?['admin','gerente','jefe_laboratorio','logistica'].map(role=>['ReportsPage',role]):[['BodegaDashboardPage','logistica'],['DashboardPage','gerente'],['LabDashboardPage','jefe_laboratorio'],...['gerente','jefe_laboratorio','logistica'].map(r=>['AIPredictionsPage',r]),...(brand?[['LoginPage','guest']]:[])];
 for(const [page,role] of cases.filter(([page])=>(!process.argv.includes('--login-only')||page==='LoginPage')&&(!aiOnly||page==='AIPredictionsPage')))for(const scenario of (brand||reportsOnly)?['data']:['data','empty','error']){
  await call('Page.navigate',{url:`${origin}/?screen=${page}-${role}-${scenario}#${routes[page]||'/'+page}?role=${role}&scenario=${scenario}`});
  for(let retry=0;retry<80;retry++){if(await js("!!document.querySelector('main h1') && (!!document.querySelector('.login-shell,.reports-page') || window.__reads?.length>1)"))break;await delay(100);}
  await delay(450);
  if(page==='ReportsPage')await js("(()=>{const select=document.getElementById('report-selection');select.value='maintenance';select.dispatchEvent(new Event('change',{bubbles:true}));})()");
  for(const theme of ['light','dark'])for(const width of before?[390,1440]:scenario==='data'?[320,390,768,1024,1440]:[320,1440]){
   await call('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:false});await js(`document.documentElement.setAttribute('data-theme','${theme}')`);await delay(350);
   const metrics=await js(`({overflow:document.documentElement.scrollWidth>innerWidth,errors:window.__renderErrors||[],heading:document.querySelector('main h1')?.textContent,sidebarWidth:document.querySelector('.sidebar')?.getBoundingClientRect().width,logoWidth:Math.max(0,...[...document.querySelectorAll('.login-brand-logo,.login-mobile-brand img')].map(e=>e.getBoundingClientRect().width)),writes:window.__writes,charts:document.querySelectorAll('.pmp-data-chart').length,rings:document.querySelectorAll('.pmp-donut').length,text:document.querySelector('main').innerText})`);
   report.push({page,role,scenario,theme,width,...metrics});
   if(scenario==='data'&&[390,1440].includes(width)){
    const layout=await call('Page.getLayoutMetrics');const shot=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip:{x:0,y:0,width,height:Math.ceil(layout.cssContentSize.height),scale:1}});await writeFile(join(out,`${page}-${role}-${theme}-${width}.png`),Buffer.from(shot.data,'base64'));
   }
   if(metrics.overflow)console.log(await js("[...document.querySelectorAll('main *')].filter(e=>e.getBoundingClientRect().right>innerWidth+1).slice(0,15).map(e=>({tag:e.tagName,cls:e.className,width:e.getBoundingClientRect().width,text:e.textContent.slice(0,70)}))"));assert.equal(metrics.overflow,false,JSON.stringify({page,scenario,theme,width}));assert.equal(metrics.writes,0);assert.deepEqual(metrics.errors,[]);
   if(page==='LoginPage'){assert.equal(await js("document.querySelectorAll('form').length"),1);
    if(!before){assert.ok(metrics.logoWidth>=(width>900?300:180),'Visible brand logo');assert.ok(await js("[...document.querySelectorAll('.login-input,.login-submit')].every(e=>e.getBoundingClientRect().height>=44)"));await js("document.getElementById('login-email').focus()");assert.notEqual(await js("getComputedStyle(document.getElementById('login-email')).boxShadow"),'none');}
    continue;}
   if(page==='ReportsPage')continue;
   assert.equal(metrics.charts,scenario==='error'?0:['LabDashboardPage','AIPredictionsPage'].includes(page)?4:2,JSON.stringify(metrics));assert.equal(metrics.rings,scenario==='data'?(page==='AIPredictionsPage'?0:page==='LabDashboardPage'?2:1):0);
  }
  if(scenario==='data'&&page==='ReportsPage'){
   const downloadPath=join(out,'downloads',role+'-'+Date.now());await mkdir(downloadPath,{recursive:true});
   await call('Browser.setDownloadBehavior',{behavior:'allow',downloadPath});
   await js("document.querySelector('.excel-export button').click()");
   const filename='PMP_Análisis_de_fallas_y_mantenimiento_'+new Date().toISOString().slice(0,10)+'.xlsx';let bytes;
   for(let retry=0;retry<40;retry++){try{bytes=await readFile(join(downloadPath,filename));break;}catch{await delay(100);}}
   if(!bytes)console.log(await js("({errors:window.__renderErrors,reads:window.__reads,feedback:document.querySelector('.excel-export')?.textContent})"));
   assert.ok(bytes,'Excel download from Reports');const workbook=XLSX.read(bytes,{type:'buffer'});
   assert.equal(XLSX.utils.sheet_to_json(workbook.Sheets.Intervenciones).length,12);
   assert.equal(await js('window.__writes'),0);
   await delay(200);await js("window.__scenario='error';document.querySelector('.excel-export button').click()");await delay(400);
   assert.ok(await js("document.querySelector('.excel-export [role=alert]')?.textContent"),'Download errors are visible');
   assert.equal(await js("document.querySelectorAll('[aria-current=page]').length"),1);
  }
  if(scenario==='data'&&!['LoginPage','ReportsPage'].includes(page)){
   if(page==='AIPredictionsPage'){
    assert.equal(await js("document.querySelectorAll('.excel-export button').length"),0,'Reports belong in their own section');
    for(const tab of ['parts','outcomes','actions','recurrence']){
     await js(`document.getElementById('maintenance-${tab}').click()`);
     for(const width of [320,1440]){await call('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:false});await delay(350);assert.equal(await js('document.documentElement.scrollWidth>innerWidth'),false,'Maintenance '+tab);
      if(role==='gerente'&&tab==='parts'&&width===1440){for(const theme of ['light','dark']){await js(`document.documentElement.setAttribute('data-theme','${theme}')`);const box=await js("(()=>{const r=document.querySelector('.maintenance-insights').getBoundingClientRect();return {x:r.x+scrollX,y:r.y+scrollY,width:r.width,height:r.height}})()");const shot=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip:{...box,scale:1}});await writeFile(join(out,`Repuestos-${theme}.png`),Buffer.from(shot.data,'base64'));}}
}
    }
    assert.equal(await js("document.querySelector('.pmp-chart-bars').children.length"),5);
    await js("document.querySelector('.pmp-chart-expand').click()");
    assert.equal(await js("document.querySelector('.pmp-chart-bars').children.length"),10);
    await js("document.querySelector('.ai-insights-method').open=true");
    for(const width of [320,1440]){
     await call('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:false});await delay(350);
     assert.equal(await js("document.documentElement.scrollWidth>innerWidth"),false,'Expanded analysis must not overflow');
    }
   }
   await js("document.querySelector('.pmp-chart-data summary').focus()");
   await call('Input.dispatchKeyEvent',{type:'keyDown',key:' ',code:'Space',windowsVirtualKeyCode:32,text:' '});await call('Input.dispatchKeyEvent',{type:'keyUp',key:' ',code:'Space',windowsVirtualKeyCode:32});
   await delay(100);assert.equal(await js("document.querySelector('.pmp-chart-data').open"),true);
   assert.equal(await js("document.querySelectorAll('[aria-current=page]').length"),1);
  }
 }
 const loginOnly=process.argv.includes('--login-only');
 await writeFile(join(out,loginOnly?'report-login.json':'report.json'),JSON.stringify(report,null,2));
 console.log(JSON.stringify({renders:report.length,failures:0,writes:0,screenshots:reportsOnly?16:loginOnly?4:brand?30:aiOnly?14:26,excelDownloadVerified:reportsOnly,output:out},null,2));
}finally{ws?.close();browser.kill();server.closeAllConnections();await new Promise(r=>server.close(r));}
