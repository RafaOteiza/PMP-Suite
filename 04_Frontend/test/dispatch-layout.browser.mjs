// Static browser checks only. No app server, Firebase session, database or real dispatch.
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
const phase=process.env.PMP_DISPATCH_PHASE||'after';
const root=resolve('../.local/test-results/dispatch-ux'),out=join(root,phase);await mkdir(out,{recursive:true});
const catalogs={terminales:[{id:1,nombre:'EL CONQUISTADOR'},{id:2,nombre:'DIEGO PORTALES'}],psts:[{codigo:'U14',nombre:'VOYSANTIAGO'},{codigo:'U15',nombre:' voysantiago '},{codigo:'U4',nombre:'VOYSANTIAGO SPA'},{codigo:'US17',nombre:'CONECTA'},{codigo:'US18',nombre:'Conecta'},{codigo:'U10',nombre:'STU'}]};
const mock=`
export const fbAuth={currentUser:null};
export const useSession=()=>({status:'authenticated',me:{id:'fixture-user',rol:'logistica',nombre:'Persona',apellido:'De prueba'}});
export const getCases=async()=>[];
export const getTecnicosTerreno=async()=>[{id:'fixture-tech',nombre:'TECNICO',apellido:'DE PRUEBA'}];
export const getRequestCatalogs=async()=>(${JSON.stringify(catalogs)});
export const getDispatchDestinations=async q=>q==='TEST01'?[{bus_ppu:'TEST01',terminal_id:1,pst_codigo:'U15',terminal:'EL CONQUISTADOR',operador:'VOYSANTIAGO'}]:[];
export const assetHistoryUrl=()=>'/trazabilidad',caseHistoryUrl=()=>'/trazabilidad';
export const api={get:async path=>{if(path==='/api/dashboard/badges')return {data:{bodega:0,lab:0,qa:0}};throw Error('Unexpected read '+path);}};export const coreApi=api;
export const validateDispatch=async payload=>{window.__validationCalls++;return {equipo:{tipo_equipo:'VALIDADOR',serie:payload.codigo,modelo:'CVB45',marca:'Mikroelektronika'},stock:{validacion_inicial_conforme:true},elegible:true,validacion:{id:'fixture-validation'}};};
export const confirmDispatch=async()=>{window.__dispatchCalls++;throw Error('Confirming a dispatch is forbidden in visual checks');};`;
const entry=`import React from 'react';import {createRoot} from 'react-dom/client';import {RouterProvider,createHashRouter} from 'react-router-dom';import Shell from './src/components/AppLayout';import Page from './src/pages/DespachoEscaneoPage';
window.__validationCalls=0;window.__dispatchCalls=0;createRoot(document.getElementById('root')).render(<RouterProvider router={createHashRouter([{element:<Shell/>,children:[{path:'/bodega/despacho',element:<Page/>}]}])}/>);`;
await build({stdin:{contents:entry,resolveDir:process.cwd(),loader:'tsx'},bundle:true,outfile:join(out,'fixture.js'),plugins:[{name:'read-fixture',setup(b){
 if(phase==='before')b.onLoad({filter:/DespachoEscaneoPage\.tsx$/},async args=>({contents:await readFile(join(root,'before-source/DespachoEscaneoPage.tsx'),'utf8'),loader:'tsx',resolveDir:resolve(args.path,'..')}));
 b.onResolve({filter:/api\/(requerimientos|bridge|bodega)$|(^|\/)http$|app\/(SessionContext|firebase)$/},()=>({path:'fixture',namespace:'fixture'}));
 b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:mock,loader:'js',resolveDir:process.cwd()}));
}}]});
const css=(await Promise.all(['tokens','base','layout','components','pages','product-ui',...(phase==='after'?['dispatch-scan']:[])].map(n=>readFile('src/styles/'+n+'.css','utf8')))).join('\n');
const brand=pathToFileURL(resolve('public/brand')).href+'/';
await writeFile(join(out,'fixture.js'),(await readFile(join(out,'fixture.js'),'utf8')).replaceAll('/brand/',brand));
await writeFile(join(out,'fixture.html'),`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css.replaceAll('/brand/',brand)}</style></head><body><div id="root"></div><script src="fixture.js"></script></body></html>`);
const probe=createServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;await new Promise(r=>probe.close(r));
const chrome=spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--remote-debugging-port='+port,'--user-data-dir='+join(out,'chrome-profile'),'--no-first-run','--no-default-browser-check','about:blank'],{windowsHide:true,stdio:'ignore'});
let ws;const delay=ms=>new Promise(r=>setTimeout(r,ms)),report=[];
try{
 let tabs;for(let i=0;i<60;i++){try{tabs=await(await fetch('http://127.0.0.1:'+port+'/json/list')).json();break;}catch{await delay(100);}}assert.ok(tabs);
 ws=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise(r=>ws.addEventListener('open',r,{once:true}));let seq=0;const calls=new Map();
 ws.addEventListener('message',e=>{const v=JSON.parse(e.data);if(v.id){const p=calls.get(v.id);calls.delete(v.id);v.error?p.reject(v.error):p.resolve(v.result);}});
 const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;calls.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
 const js=async expression=>{const r=await call('Runtime.evaluate',{expression,returnByValue:true});assert.ok(!r.exceptionDetails,JSON.stringify(r.exceptionDetails));return r.result.value;};
 await call('Page.enable');await call('Network.enable');await call('Network.setBlockedURLs',{urls:['http://*','https://*']});
 const field=async(id,value)=>{await js(`(()=>{const el=document.getElementById(${JSON.stringify(id)});Object.getOwnPropertyDescriptor(el.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype,'value').set.call(el,${JSON.stringify(value)});el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));})()`);await delay(80);};
 await call('Page.navigate',{url:pathToFileURL(join(out,'fixture.html')).href+'#/bodega/despacho'});
 for(let i=0;i<60;i++){if(await js("!!document.querySelector('#dispatch-mode')"))break;await delay(100);}
 assert.ok(await js("!!document.querySelector('#dispatch-mode')"),await js('document.body.innerText'));
 for(const scene of ['initial','validated']){
  if(scene==='validated'){
   await field('dispatch-bus','TEST01');await field('dispatch-technician','fixture-tech');await field('dispatch-capture','MANUAL_AUTORIZADO');await field('dispatch-reading','7408001');await field('dispatch-reason','Lectura de prueba local');
   await js("document.getElementById('dispatch-present').click()");
   await js("[...document.querySelectorAll('button')].find(e=>e.textContent.includes('Validar ingreso')).click()");await delay(200);
   assert.equal(await js('window.__validationCalls'),1);assert.equal(await js('window.__dispatchCalls'),0);
  }
  for(const theme of ['light','dark'])for(const width of [320,390,768,1024,1440]){
   await call('Emulation.setDeviceMetricsOverride',{width,height:950,deviceScaleFactor:1,mobile:false});await js(`document.documentElement.setAttribute('data-theme','${theme}');window.scrollTo(0,0)`);await delay(400);
   const metrics=await js(`(()=>{const p=document.querySelector('main .page'),sections=[...p.querySelectorAll('section.operation-section')],r=sections.map(e=>{const b=e.getBoundingClientRect();return {left:b.left,top:b.top,width:b.width}}),main=document.querySelector('main'),style=getComputedStyle(main);return {overflow:document.documentElement.scrollWidth>innerWidth,dialogs:document.querySelectorAll('[role=dialog],dialog').length,dispatches:window.__dispatchCalls,sidebar:document.querySelector('.sidebar').getBoundingClientRect().width,pageWidth:p.getBoundingClientRect().width,available:main.clientWidth-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight),sections:r,operator:document.querySelector('#dispatch-operator')?.value,operatorCode:document.querySelector('#dispatch-operator-code')?.value,buttonEnabled:![...document.querySelectorAll('button')].find(e=>e.textContent.includes('Confirmar asignación')).disabled};})()`);
   report.push({scene,theme,width,...metrics});assert.equal(metrics.overflow,false);assert.equal(metrics.dialogs,0);assert.equal(metrics.dispatches,0);assert.equal(metrics.buttonEnabled,scene==='validated');
   if(phase==='after'){
    assert.ok(Math.abs(metrics.pageWidth-metrics.available)<2,'Full available content width');
    if(width>=1024)assert.ok(Math.abs(metrics.sections[0].top-metrics.sections[1].top)<2,'Two columns');else assert.ok(metrics.sections[1].top>metrics.sections[0].top,'Stacked columns');
    if(scene==='validated'){assert.equal(metrics.operator,'voysantiago');assert.equal(metrics.operatorCode,'U15');}
   }
   if([320,1440].includes(width)){const shot=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});await writeFile(join(out,`${scene}-${theme}-${width}.png`),Buffer.from(shot.data,'base64'));}
  }
 }
 await writeFile(join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({phase,renders:report.length,passed:true,dispatches:0,realApiCalls:0}));
}finally{ws?.close();chrome.kill();}
