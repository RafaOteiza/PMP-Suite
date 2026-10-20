// Render every current web page with the actual PMP shell/CSS and an unavailable API.
// These fixtures never contact Firebase, PostgreSQL or the habitual API.
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {readdir,readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {spawn} from 'node:child_process';
import {createServer} from 'node:http';
const out=resolve('../.local/test-results/consolidation/visual-all');await mkdir(out,{recursive:true});
const pages=(await readdir('src/pages')).filter(x=>x.endsWith('.tsx')).map(x=>x.slice(0,-4));
const mock=`import {useLocation} from 'react-router-dom';
export const fbAuth={currentUser:null};
export const useSession=()=>{const l=useLocation();const role=new URLSearchParams(l.search).get('role')||'admin';return {status:l.pathname.includes('LoginPage')?'unauthenticated':'authenticated',me:{id:'fixture',nombre:'Persona de prueba',apellido:'Apellido extenso de prueba',rol:role},refreshSession:async()=>null,endSession(){}};};
const fail=async(...args)=>{window.__reads.push(args[0]);throw {response:{status:503,data:{message:'Consulta no disponible · fixture aislada'}}};};
export const api={get:fail,post:async()=>{throw Error('NO WRITES IN VISUAL TEST');},put:async()=>{throw Error('NO WRITES IN VISUAL TEST');},patch:async()=>{throw Error('NO WRITES IN VISUAL TEST');},delete:async()=>{throw Error('NO WRITES IN VISUAL TEST');}};export const coreApi=api;`;
const entry=`import React from 'react';import {createRoot} from 'react-dom/client';import {RouterProvider,createHashRouter} from 'react-router-dom';import Shell from './src/components/AppLayout';
${pages.map((name,i)=>`import P${i} from './src/pages/${name}';`).join('\n')}
window.__reads=[];window.__renderErrors=[];
class Boundary extends React.Component {state={error:null};static getDerivedStateFromError(error){return {error};}componentDidCatch(e){window.__renderErrors.push(e.message);}render(){return this.state.error?<p role="alert">RENDER ERROR: {this.state.error.message}</p>:this.props.children;}}
createRoot(document.getElementById('root')).render(<RouterProvider router={createHashRouter([{element:<Shell/>,children:[${pages.filter(n=>n!=='LoginPage').map((n)=>`{path:'/${n}/:osId?/:step?',element:<Boundary><P${pages.indexOf(n)} purpose="receipt"/></Boundary>}`).join(',')}]},{path:'/LoginPage',element:<P${pages.indexOf('LoginPage')}/>}])}/>);`;
await build({stdin:{contents:entry,resolveDir:process.cwd(),loader:'tsx'},bundle:true,outfile:join(out,'fixture.js'),plugins:[{name:'isolated-transport',setup(b){b.onResolve({filter:/(^|\/)http$|app\/(SessionContext|firebase)$/},()=>({path:'fixture',namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:mock,loader:'js',resolveDir:process.cwd()}));}}]});
const css=(await Promise.all(['tokens','base','layout','components','pages'].map(n=>readFile('src/styles/'+n+'.css','utf8')))).join('\n');
await writeFile(join(out,'fixture.html'),`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body><div id="root"></div><script src="/fixture.js"></script></body></html>`);
const server=createServer(async(req,res)=>{try{const path=req.url.split('?')[0];const file=path.startsWith('/brand/')?resolve('public','.'+path):join(out,path==='/'?'fixture.html':path.slice(1));if(!file.startsWith(out)&&!file.startsWith(resolve('public/brand')))throw Error('path');res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.svg')?'image/svg+xml':file.endsWith('.png')?'image/png':'text/html');res.end(await readFile(file));}catch{res.writeHead(404).end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`;
const browser=spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--remote-debugging-port=9354','--user-data-dir='+join(out,'chrome-profile'),'--no-first-run','--no-default-browser-check','about:blank'],{windowsHide:true,stdio:'ignore'});
const delay=ms=>new Promise(r=>setTimeout(r,ms));let ws;const report=[];
try{
 let tabs;for(let i=0;i<60;i++){try{tabs=await(await fetch('http://127.0.0.1:9354/json/list')).json();break;}catch{await delay(100);}}assert.ok(tabs);
 ws=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise(r=>ws.addEventListener('open',r,{once:true}));let seq=0;const calls=new Map();
 ws.addEventListener('message',e=>{const v=JSON.parse(e.data);if(v.id){const p=calls.get(v.id);calls.delete(v.id);v.error?p.reject(v.error):p.resolve(v.result);}});
 const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;calls.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
 const js=async expression=>{const r=await call('Runtime.evaluate',{expression,returnByValue:true});assert.ok(!r.exceptionDetails,JSON.stringify(r.exceptionDetails));return r.result.value;};await call('Page.enable');await call('Network.enable');await call('Network.setBlockedURLs',{urls:['*localhost:4000*','*127.0.0.1:4000*','*googleapis.com*','*firebaseio.com*']});
 for(const page of pages){
  const role=['IngresoOSPage','MyServiceOrdersPage','RoleDashboardPage'].includes(page)?'tecnico_terreno':page==='LabWorkPage'?'tecnico_laboratorio':page==='QaWorkPage'?'qa':'admin';
  const suffix=['LabCustodyPage','QaWorkPage'].includes(page)?'/MV-FIXTURE/recepcion':['LabWorkPage','WarehouseOperationPage'].includes(page)?'/MV-FIXTURE':'';
  await call('Page.navigate',{url:`${origin}/#/${page}${suffix}?role=${role}`});await delay(700);
  for(const theme of ['light','dark'])for(const width of [320,390,768,1024,1440]){
   await call('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false});await js(`document.documentElement.setAttribute('data-theme','${theme}')`);await delay(350);
   const metrics=await js(`({overflow:document.documentElement.scrollWidth>innerWidth,errors:window.__renderErrors||[],heading:document.querySelector('main h1,h1')?.textContent,alerts:[...document.querySelectorAll('[role="alert"]')].map(e=>e.textContent),reads:window.__reads.length,overlays:document.querySelectorAll('dialog[open],[aria-modal="true"]').length,culprits:[...document.querySelectorAll('main *')].filter(e=>e.getBoundingClientRect().right>innerWidth+1&&getComputedStyle(e).position!=='absolute').slice(0,5).map(e=>e.tagName+'.'+e.className)})`);
   report.push({page,role,theme,width,...metrics});
   if(['GestionActivosPage','IngresoRequerimientosPage','LabCustodyPage','BodegaRepuestosPage','TrazabilidadPage','LoginPage'].includes(page)&&[320,390,1440].includes(width)){
    const shot=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});await writeFile(join(out,`${page}-${theme}-${width}.png`),Buffer.from(shot.data,'base64'));
   }
  }
 }
 await writeFile(join(out,'report.json'),JSON.stringify(report,null,2));
 const failures=report.filter(r=>r.overflow||r.errors.length||r.overlays);console.log(JSON.stringify({pages:pages.length,renders:report.length,failures},null,2));assert.equal(failures.length,0);
}finally{ws?.close();browser.kill();server.closeAllConnections();await new Promise(r=>server.close(r));}
