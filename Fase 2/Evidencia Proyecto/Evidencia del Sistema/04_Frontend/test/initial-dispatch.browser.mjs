// Isolated browser regression: all API calls are mocked; no backend or database is used.
// Run: node test/operational-pages.browser.mjs (Chrome installed, or CHROME_PATH).
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

const out=resolve('../.local/pmp-verification/initial-dispatch-visual');await mkdir(out,{recursive:true});
const mock=`
export const useSession=()=>({me:{rol:'logistica'}});
export const getCases=async()=>[];
export const getTecnicosTerreno=async()=>[{id:'fixture-tech',nombre:'Rodrigo',apellido:'Prueba'}];
export const getRequestCatalogs=async()=>({terminales:[{id:1,nombre:'El Conquistador'}],psts:[{codigo:'PST',nombre:'VOYSANTIAGO'}]});
export const getDispatchDestinations=async()=>[{bus_ppu:'BJ2149',terminal_id:1,pst_codigo:'PST',terminal:'El Conquistador',operador:'VOYSANTIAGO'}];
export const assetHistoryUrl=asset=>'/trazabilidad?serie='+asset.serie,caseHistoryUrl=id=>'/trazabilidad?caso='+id;
window.__writes=[];
export const validateDispatch=async payload=>{window.__writes.push(payload);return {equipo:{tipo_equipo:'VALIDADOR',serie:payload.codigo,modelo:'CVB45',marca:'Mikroelektronika'},stock:{codigo_os:null,validacion_inicial_conforme:true},elegible:true,validacion:{id:'fixture'}};};
export const confirmDispatch=async payload=>{window.__writes.push(payload);return {os:{codigo_os:'IN-FIXTURE',tipo_equipo:'VALIDADOR',serie:'7408001'},caso:null};};`;
const entry=`import React from 'react';import {createRoot} from 'react-dom/client';import {MemoryRouter} from 'react-router-dom';import Page from './src/pages/DespachoEscaneoPage';
createRoot(document.getElementById('root')).render(<MemoryRouter><div className="app-shell"><aside className="sidebar">PMP Suite</aside><div className="app-main"><header className="topbar">PMP Suite · Prueba aislada</header><main className="app-content"><Page/></main></div></div></MemoryRouter>);`;
await build({stdin:{contents:entry,resolveDir:process.cwd(),loader:'tsx'},bundle:true,outfile:resolve(out,'fixture.js'),plugins:[{name:'isolated-api',setup(b){b.onResolve({filter:/api\/(requerimientos|bridge|bodega)$|app\/SessionContext$/},()=>({path:'mock',namespace:'mock'}));b.onLoad({filter:/.*/,namespace:'mock'},()=>({contents:mock,loader:'js',resolveDir:process.cwd()}));}}]});
const css=(await Promise.all(['tokens','base','layout','components','pages'].map(n=>readFile('src/styles/'+n+'.css','utf8')))).join('\n');
await writeFile(resolve(out,'fixture.html'),`<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body><div id="root"></div><script src="fixture.js"></script></body></html>`);
const browser=spawn(process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--remote-debugging-port=9350','--user-data-dir='+resolve(out,'chrome-profile'),'--no-first-run','--no-default-browser-check','about:blank'],{windowsHide:true,stdio:'ignore'});
let ws,call;
const delay=ms=>new Promise(r=>setTimeout(r,ms));
try{
 let tabs;
 for(let i=0;i<50;i++){try{tabs=await(await fetch('http://127.0.0.1:9350/json/list')).json();break;}catch{await delay(100);}}
 assert.ok(tabs,'Chrome debugging endpoint');
 ws=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);
 await new Promise(r=>ws.addEventListener('open',r,{once:true}));
 let seq=0;const calls=new Map();
 ws.addEventListener('message',e=>{const r=JSON.parse(e.data);if(r.id){const c=calls.get(r.id);calls.delete(r.id);r.error?c.reject(r.error):c.resolve(r.result);}});
 call=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;calls.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
 const js=async expression=>{const r=await call('Runtime.evaluate',{expression,returnByValue:true});assert.ok(!r.exceptionDetails,JSON.stringify(r.exceptionDetails));return r.result.value;};
 await call('Page.enable');
 const report=[];

 await call('Page.navigate',{url:pathToFileURL(resolve(out,'fixture.html')).href});
 for(let i=0;i<100;i++){if(await js("!!document.querySelector('#dispatch-mode')"))break;await delay(50);}
 const field=async(id,value)=>js(`(()=>{const e=document.getElementById(${JSON.stringify(id)});const set=Object.getOwnPropertyDescriptor(e.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype,'value').set;set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));})()`);
 await field('dispatch-bus','BJ2149');await delay(150);await field('dispatch-technician','fixture-tech');await field('dispatch-capture','MANUAL_AUTORIZADO');await field('dispatch-reading','7408001');await field('dispatch-reason','Sin lector durante ensayo');await js("document.querySelector('#dispatch-present').click()");
 await js("[...document.querySelectorAll('button')].find(e=>e.textContent.includes('Validar ingreso')).click()");await delay(150);
 assert.ok(await js("document.body.innerText.includes('Equipo válido')"));assert.equal(await js('window.__writes.length'),1);
 for(const theme of ['light','dark'])for(const width of [320,390,768,1024,1440]){
  await call('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:false});await js(`document.documentElement.setAttribute('data-theme',${JSON.stringify(theme)})`);await delay(100);
  const metrics=await js("({overflow:document.documentElement.scrollWidth>innerWidth,dialogs:document.querySelectorAll('[role=dialog],dialog').length})");assert.equal(metrics.overflow,false,theme+' '+width);assert.equal(metrics.dialogs,0);
  const shot=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});await writeFile(resolve(out,theme+'-'+width+'.png'),Buffer.from(shot.data,'base64'));report.push({theme,width,...metrics});
 }
 await writeFile(resolve(out,'report.json'),JSON.stringify({mockedApi:true,noDatabaseCalls:true,renders:report},null,2));console.log(JSON.stringify({passed:true,renders:report.length,noDatabaseCalls:true}));
}finally{ws?.close();browser.kill();}
