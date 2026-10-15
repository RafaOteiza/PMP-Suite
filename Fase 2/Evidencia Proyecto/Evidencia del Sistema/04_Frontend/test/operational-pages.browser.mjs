// Isolated browser regression: all API calls are mocked; no backend or database is used.
// Run: node test/operational-pages.browser.mjs (Chrome installed, or CHROME_PATH).
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const out=resolve(process.env.PMP_BROWSER_OUTPUT||'../tmp/operational-pages-qa');
await mkdir(out,{recursive:true});
const mock=`
import {useLocation} from 'react-router-dom';
const me={id:'fixture',nombre:'Técnico de prueba',rol:location.hash.includes('bodega')?'logistica':'tecnico_laboratorio'};
export const useSession=()=>({status:'authenticated',me:{...me,rol:useLocation().pathname.startsWith('/qa')?(sessionStorage.getItem('qaRole')||'admin'):useLocation().pathname.includes('bodega')?'logistica':'tecnico_laboratorio'}});
const base={tipo_equipo:'VALIDADOR',serie:'TEST-0',modelo:'CVB45',marca:'Mikroelektronika',bus_ppu:'TEST01',terminal:'El Conquistador',operador:'Operador de prueba',referencia_ar:'AR-TEST',falla:'Falla QR',estado_id:4,estado_nombre:'EN_DIAGNOSTICO',tecnico_laboratorio_id:'fixture',tecnico_laboratorio:'Técnico de prueba',recepcion_laboratorio_confirmada:true,fecha:new Date().toISOString(),fecha_ingreso_laboratorio:new Date().toISOString(),fuente_ingreso_laboratorio:'RECEPCION_FISICA',ubicacion:'Laboratorio Garantías'};
const rows=[{...base,codigo_os:'MV-TEST-0'},{...base,codigo_os:'MV-NO-RECEIPT',recepcion_laboratorio_confirmada:false},{...base,codigo_os:'MV-PRIVATE',tecnico_laboratorio_id:'other'}];
window.__rows=rows; window.__writes=[];window.__reads=[];
export const getLabQueue=async type=>type==='VALIDADOR'?rows:[];
export const getCompletedLab=async()=>[];
export const moveTicket=async(...args)=>{window.__writes.push(args);sessionStorage.setItem('writes',String(+(sessionStorage.getItem('writes')||0)+1));};
export const api={
 get:async path=>{window.__reads.push(path);if(path.endsWith('/parts'))throw Error('Inventario no permitido');return {data:JSON.parse(sessionStorage.getItem('draft')||'{"revision":null,"trabajo":null}')};},
 put:async(path,payload)=>{window.__writes.push([path,payload]);const data={revision:'1',trabajo:payload.trabajo};sessionStorage.setItem('draft',JSON.stringify(data));return {data};},post:moveTicket};
export const getBodegaQueue=async()=>[{...base,codigo_os:'MV-RECEIPT',estado_id:2},{...base,codigo_os:'MV-SEND',estado_id:3,fue_laboratorio:false},{...base,codigo_os:'MV-QA',estado_id:3,fue_laboratorio:true,es_aprobado_qa:null},{...base,codigo_os:'MV-LAB-RETURN',estado_id:11,fue_laboratorio:true,es_aprobado_qa:null}];
export const receiveInBodega=moveTicket,dispatchToLab=moveTicket,validateTerrainReceipt=moveTicket,validateLabDispatch=moveTicket,dispatchToQa=moveTicket,validateQaDispatch=moveTicket;
export const qaStages={RECEPCION:'Recepción',AMBIENTE:'Instalación Ambiente',PRUEBAS:'Pruebas',DESPACHO:'Despacho',POR_VERIFICAR:'Por verificar',HISTORIAL:'Historial'};
export const qaPaths={RECEPCION:'recepcion',AMBIENTE:'ambiente',PRUEBAS:'pruebas',DESPACHO:'despacho',POR_VERIFICAR:'detalle',HISTORIAL:'detalle'};
const qaFixture=()=>{const step=location.hash.split('/').at(-1),etapa={recepcion:'RECEPCION',ambiente:'AMBIENTE',pruebas:'PRUEBAS',despacho:'DESPACHO',detalle:'HISTORIAL'}[step]||'RECEPCION';
 const actor={id:'fixture',nombre:'Certificador de prueba',fecha:'2026-10-07T12:00:00Z'};
 const trabajo={etapa,responsable:etapa==='RECEPCION'?null:actor,receptor:actor,ambiente:{estado:etapa==='AMBIENTE'?'EN_CURSO':'COMPLETADO',inicio:'2026-10-07T12:00:00Z',fin:null,observacion:'Hito de preparación realizado en fixture aislada.'},pruebas:etapa==='RECEPCION'||etapa==='AMBIENTE'?[]:[{id:'test',metodo:'Manual',resultado:'RECHAZADA',observacion:'Lectura QR intermitente; revisar conexión del lector.',autor:actor,fecha:actor.fecha}],dictamen:['DESPACHO','HISTORIAL'].includes(etapa)?{resultado:'RECHAZADO',motivo:'Lectura QR intermitente. Revisar conexión y repetir prueba funcional.',autor:actor,fecha:actor.fecha}:null};
 return {...base,codigo_os:'MV-QA-TEST',serie:'7490991',estado_operacional:qaStages[etapa],etapa,ciclo_qa:'30',revision:'31',tecnico_qa:actor.nombre,fecha_envio_qa:actor.fecha,fecha_recepcion_qa:etapa==='RECEPCION'?null:actor.fecha,trabajo,historial:[],antecedentes_laboratorio:{fecha:actor.fecha,autor:'Técnico laboratorio',metadata:{trabajo:{diagnostico:{falla_real:'Falla QR',observacion:'Conexión revisada'},acciones:['Limpieza interna'],pruebas:[{nombre:'Manual',resultado:'APROBADA',observacion:'Prueba de fixture'}],resultado:'REPARADO',observaciones_qa:'Verificar lectura QR'}}}};};
export const getQaDashboard=async params=>({items:[{...qaFixture(),etapa:params.etapa}],counts:{RECEPCION:1,AMBIENTE:3,PRUEBAS:2,DESPACHO:1,POR_VERIFICAR:25},total:1,page:1,page_size:20});
export const getQaWork=async()=>structuredClone(window.__qaDetail||qaFixture());
const qaRequests=new Map();
export const qaCommand=async(code,action,body)=>{
 window.__writes.push({code,action,body});
 if(qaRequests.has(body.request_id))return structuredClone(qaRequests.get(body.request_id));
 const d=window.__qaDetail||qaFixture(),w=d.trabajo,actor={id:'fixture',nombre:'Certificador de prueba',fecha:new Date().toISOString()};
 if(action==='iniciar'){w.responsable=actor;w.ambiente.estado='EN_CURSO';w.ambiente.inicio=actor.fecha;}
 if(action==='ambiente-guardar')w.ambiente.observacion=body.observacion;
 if(action==='ambiente-completar'){w.ambiente.estado='COMPLETADO';w.ambiente.observacion=body.observacion;d.etapa='PRUEBAS';}
 if(action==='prueba'||body.prueba){const t=body.prueba||body;w.pruebas.push({...t,id:body.request_id,autor:actor,fecha:actor.fecha});}
 if(action==='dictamen'){w.dictamen={resultado:body.resultado,motivo:body.motivo,autor:actor,fecha:actor.fecha};d.etapa='DESPACHO';}
 if(action==='recepcion'){d.etapa='AMBIENTE';w.responsable=null;w.ambiente={estado:'PENDIENTE',observacion:'',inicio:null,fin:null};}
 if(action==='despacho')d.etapa='HISTORIAL';
 w.etapa=d.etapa;d.revision=String(Number(d.revision)+1);window.__qaDetail=d;
 const response={revision:d.revision,trabajo:structuredClone(w)};qaRequests.set(body.request_id,response);
 if(window.__loseQaReply){window.__loseQaReply=false;throw new Error('Network response lost');}
 return response;
};
export const validateQaPhysical=async(code,purpose,body)=>{window.__writes.push({code,purpose,body});return {coincide:body.codigo==='7490991',validacion_id:'50',encontrado:{serie:body.codigo}};};

`;
const entry=`import React from 'react';import {createRoot} from 'react-dom/client';import {RouterProvider,createHashRouter,createRoutesFromElements,Route,Outlet,Link} from 'react-router-dom';
import QaPage from './src/pages/QaPage';import QaWorkPage from './src/pages/QaWorkPage';import Worklist from './src/components/LabTechnicianWorklist';import LabWorkPage from './src/pages/LabWorkPage';import WarehousePage from './src/pages/WarehouseOperationPage';import ProtectedRoute from './src/components/ProtectedRoute';import {useSession} from './src/app/SessionContext';import {PERMISSIONS} from './src/app/rbac';
function Shell(){const {me}=useSession();return <div className="app-shell"><aside className="sidebar">PMP Suite</aside><div className="app-main"><header className="topbar">PMP Suite · Prueba aislada</header><main className="app-content"><Outlet context={me}/></main></div></div>}
function List(){const {me}=useSession();return <Worklist me={me}/>}
createRoot(document.getElementById('root')).render(<RouterProvider router={createHashRouter(createRoutesFromElements(<Route element={<Shell/>}><Route path="/qa" element={<QaPage/>}/><Route path="/qa/:osId/:step" element={<QaWorkPage/>}/><Route path="/bodega/envios-qa/:osId" element={<WarehousePage purpose="qa"/>}/><Route path="/mi-jornada" element={<List/>}/><Route path="/mi-carga/:osId" element={<ProtectedRoute permission={PERMISSIONS.LAB_WRITE}><LabWorkPage/></ProtectedRoute>}/><Route path="/bodega/recepciones/:osId" element={<ProtectedRoute permission={PERMISSIONS.BODEGA_WRITE}><WarehousePage purpose="receipt"/></ProtectedRoute>}/><Route path="/bodega/envios-laboratorio/:osId" element={<ProtectedRoute permission={PERMISSIONS.BODEGA_WRITE}><WarehousePage purpose="lab"/></ProtectedRoute>}/><Route path="/bodega" element={<Link to="/bodega/recepciones/MV-RECEIPT">Recepcionar siguiente</Link>}/><Route path="/403" element={<p>Sin permiso</p>}/></Route>))}/>);`;
await build({stdin:{contents:entry,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:true,outfile:resolve(out,'fixture.js'),plugins:[{name:'isolated-api',setup(b){b.onResolve({filter:/api\/(lab|http|bodega|qa)$|app\/SessionContext$/},()=>({path:'mock',namespace:'mock'}));b.onLoad({filter:/.*/,namespace:'mock'},()=>({contents:mock,loader:'js',resolveDir:process.cwd()}));}}]});
const css=(await Promise.all(['tokens','base','layout','components','pages'].map(n=>readFile('src/styles/'+n+'.css','utf8')))).join('\n');
await writeFile(resolve(out,'fixture.html'),`<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body><div id="root"></div><script src="fixture.js"></script></body></html>`);
const browser=spawn(process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--remote-debugging-port=9346','--user-data-dir='+resolve(out,'chrome-profile'),'--no-first-run','--no-default-browser-check','about:blank'],{windowsHide:true,stdio:'ignore'});
let ws,call;
const delay=ms=>new Promise(r=>setTimeout(r,ms));
try{
 let tabs;
 for(let i=0;i<50;i++){try{tabs=await(await fetch('http://127.0.0.1:9346/json/list')).json();break;}catch{await delay(100);}}
 assert.ok(tabs,'Chrome debugging endpoint');
 ws=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);
 await new Promise(r=>ws.addEventListener('open',r,{once:true}));
 let seq=0;const calls=new Map();
 ws.addEventListener('message',e=>{const r=JSON.parse(e.data);if(r.id){const c=calls.get(r.id);calls.delete(r.id);r.error?c.reject(r.error):c.resolve(r.result);}});
 call=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;calls.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
 const js=async expression=>{const r=await call('Runtime.evaluate',{expression,returnByValue:true});assert.ok(!r.exceptionDetails,JSON.stringify(r.exceptionDetails));return r.result.value;};
 await call('Page.enable');
 const report=[];
 const click=label=>js(`[...document.querySelectorAll('button,a')].find(e=>e.textContent.includes(${JSON.stringify(label)})).click()`);
 const waitText=async text=>{for(let i=0;i<60;i++){if(await js(`document.body?.textContent?.includes(${JSON.stringify(text)})`))return;await delay(50);}assert.fail('Missing text: '+text);};
 const screenshot=async(name,width,theme)=>{
  await js("window.scrollTo(0,0)");await delay(300);
  const metrics=await js(`({height:document.documentElement.scrollHeight,overflow:document.documentElement.scrollWidth>innerWidth,dialogs:document.querySelectorAll('[role="dialog"],dialog,[aria-modal]').length,locked:document.body.style.overflow==='hidden'})`);
  assert.equal(metrics.dialogs,0);assert.equal(metrics.locked,false);assert.equal(metrics.overflow,false,name+' horizontal overflow at '+width);
  report.push({name,width,theme,...metrics});const shot=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});await writeFile(resolve(out,name+'-'+theme+'-'+width+'.png'),Buffer.from(shot.data,'base64'));
 };
 if(!process.env.PMP_QA_VISUAL_ONLY)for(const theme of ['light','dark'])for(const width of [320,375,390,768,1024,1440]){
  await call('Emulation.setDeviceMetricsOverride',{width,height:950,deviceScaleFactor:1,mobile:false});
  await call('Page.navigate',{url:pathToFileURL(resolve(out,'fixture.html')).href+'#/mi-jornada'});
  await waitText('Abrir trabajo');await js(`document.documentElement.setAttribute('data-theme','${theme}');sessionStorage.setItem('writes','0');sessionStorage.removeItem('draft')`);
  assert.equal(await js(`[...document.querySelectorAll('tr')].find(e=>e.textContent.includes('MV-NO-RECEIPT')).querySelector('button').disabled`),true);
  await js(`[...document.querySelectorAll('tr')].find(e=>e.textContent.includes('MV-TEST-0')).querySelector('button').click()`);await waitText('Trabajo aún no iniciado');
  assert.ok(await js(`location.hash.endsWith('/mi-carga/MV-TEST-0')`));await screenshot('diagnostico',width,theme);
  await js(`window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}))`);assert.ok(await js(`document.body.textContent.includes('Trabajo aún no iniciado')`));
  await click('Volver a la bandeja');await waitText('Abrir trabajo');assert.equal(await js(`sessionStorage.getItem('writes')`),'0');
  await js(`location.hash='/mi-carga/MV-TEST-0'`);await waitText('Trabajo aún no iniciado');await call('Page.reload');await waitText('Trabajo aún no iniciado');assert.equal(await js(`sessionStorage.getItem('writes')`),'0');
  await js(`document.documentElement.setAttribute('data-theme','${theme}')`);await click('Iniciar trabajo');await waitText('Diagnóstico técnico');assert.equal(await js(`window.__writes.length`),1);
  await screenshot('reparacion',width,theme);
  assert.equal(await js(`document.body.textContent.includes('Stock')||document.body.textContent.includes('Solicitud a Bodega')`),false);
  assert.equal(await js(`document.querySelectorAll('nav[aria-label="Ruta de navegación"]').length`),0);
  const setField=async(label,value)=>{await js(`(()=>{const l=[...document.querySelectorAll('label')].find(e=>e.textContent===${JSON.stringify(label)});const el=document.getElementById(l.htmlFor);Object.getOwnPropertyDescriptor(el instanceof HTMLSelectElement?HTMLSelectElement.prototype:el instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,'value').set.call(el,${JSON.stringify(value)});el.dispatchEvent(new Event(el instanceof HTMLSelectElement?'change':'input',{bubbles:true}));})()`);await delay(60);};
  await setField('Resultado del diagnóstico','NFF');await setField('Observación del diagnóstico','Sin falla tras prueba funcional');
  await setField('Resultado del trabajo','NFF');await click('Agregar prueba');await setField('Prueba realizada','Manual');await setField('Resultado de prueba 1','APROBADA');
  assert.equal(await js(`[...document.querySelectorAll('button')].find(e=>e.textContent.includes('Finalizar trabajo')).disabled`),false);
  await screenshot('nff',width,theme);
  await screenshot('pruebas-manual',width,theme);
  await click('Guardar avance');await waitText('Avance guardado');assert.equal(await js('window.__writes.length'),2);
  await click('Volver a la bandeja');await waitText('Abrir trabajo');
  await js(`location.hash='/mi-carga/MV-TEST-0'`);await waitText('Avance recuperado');await click('Iniciar trabajo');await waitText('Diagnóstico técnico');
  assert.equal(await js(`[...document.querySelectorAll('textarea')].some(e=>e.value==='Sin falla tras prueba funcional')`),true);
  await setField('Resultado del diagnóstico','POD');await setField('Resultado del trabajo','POD');await screenshot('pod',width,theme);
  await js(`[...document.querySelectorAll('label')].find(e=>e.textContent.includes('Necesito un repuesto')).querySelector('input').click()`);
  await waitText('Repuesto o componente necesario');await setField('Repuesto o componente necesario','Lector QR dañado');await setField('Motivo técnico','Daño por impacto impide continuar');
  assert.equal(await js(`[...document.querySelectorAll('button')].find(e=>e.textContent.includes('Guardar avance y solicitar')).disabled`),true);
  await screenshot('solicitud-pod',width,theme);
  assert.equal(await js(`window.__reads.some(p=>p.endsWith('/parts'))`),false);
  assert.equal(await js(`[...document.querySelectorAll('button')].find(e=>e.textContent.includes('Finalizar trabajo')).disabled`),true);
  await js(`location.hash='/mi-carga/MV-PRIVATE'`);await waitText('no pertenece');assert.equal(await js(`window.__writes.length`),3);
  await js(`location.hash='/mi-carga/MV-NO-RECEIPT'`);await waitText('no pertenece');assert.equal(await js(`window.__writes.length`),3);
  for(const [path,title,name] of [['recepciones/MV-RECEIPT','Confirmar recepción en Bodega','recepcion'],['envios-laboratorio/MV-SEND','Confirmar envío a Laboratorio','envio'],['envios-qa/MV-QA','Confirmar envío a QA','envio-qa'],['recepciones/MV-LAB-RETURN','Confirmar recepción en Bodega','recepcion-laboratorio']]){
   await call('Page.navigate',{url:'about:blank'});await delay(50);
   await call('Page.navigate',{url:pathToFileURL(resolve(out,'fixture.html')).href+'#/bodega/'+path});await waitText(title);await js(`document.documentElement.setAttribute('data-theme','${theme}')`);
   assert.equal(await js(`[...document.querySelectorAll('button')].find(e=>e.textContent.includes(${JSON.stringify(title)})).disabled`),true);
   await screenshot(name,width,theme);await click('Ingreso manual autorizado');await waitText('Motivo de ingreso manual');await screenshot(name+'-manual',width,theme);
   assert.equal(await js(`window.__writes.length`),0);await click('Volver a Bodega');await waitText('Recepcionar siguiente');assert.equal(await js(`window.__writes.length`),0);
  }
 }
 if(!process.env.PMP_QA_JOURNEYS_ONLY)for(const theme of ['light','dark'])for(const width of [320,375,390,768,1024,1440])for(const role of ['admin','qa']){
  await call('Emulation.setDeviceMetricsOverride',{width,height:950,deviceScaleFactor:1,mobile:false});
  await call('Page.navigate',{url:pathToFileURL(resolve(out,'fixture.html')).href+'#/qa'});await waitText('Mi trabajo QA');
  await js(`sessionStorage.setItem('qaRole','${role}')`);await call('Page.reload');await waitText('MV-QA-TEST');
  await js(`document.documentElement.setAttribute('data-theme','${theme}')`);
  assert.equal(await js(`document.querySelectorAll('[role="tab"]').length`),4);assert.equal(await js(`[...document.querySelectorAll('button')].find(e=>e.textContent==='Siguiente').disabled`),true);assert.ok(await js(`document.body.textContent.includes('1 resultado ·')`));assert.equal(await js(`window.__writes.length`),0);
  await screenshot('qa-dashboard-'+role,width,theme);
  for(const step of ['recepcion','ambiente','pruebas','despacho','detalle']){
   await js(`location.hash='/qa/MV-QA-TEST/${step}'`);await waitText('Detalles del equipo');await delay(100);
   await screenshot('qa-'+step+'-'+role,width,theme);
   assert.equal(await js(`window.__writes.length`),0,'open/read never mutates');
   if(role==='admin')assert.equal(await js(`document.querySelectorAll('select,textarea,input').length`),step==='ambiente'?1:0,'Admin no operational controls');
   if(role==='qa'&&['recepcion','despacho'].includes(step)){
    assert.equal(await js(`[...document.querySelectorAll('button')].find(e=>e.textContent.includes(${JSON.stringify(step==='recepcion'?'Recibir equipo':'Confirmar salida a Bodega')})).disabled`),true);
    await click('No puedo escanear');await waitText('Motivo de ingreso manual');
    await screenshot('qa-'+step+'-manual',width,theme);
   }
   await click('Volver a la bandeja');await waitText('Mi trabajo QA');assert.equal(await js(`window.__writes.length`),0);
  }
 }


 // Exercise real router blocking, forms, keyboard focus and same-request retries, without any backend.
 const setQaField=async(label,value)=>{await js(`(()=>{const el=[...document.querySelectorAll('label')].find(e=>e.textContent.startsWith(${JSON.stringify(label)})).querySelector('input,select,textarea');Object.getOwnPropertyDescriptor(el instanceof HTMLSelectElement?HTMLSelectElement.prototype:el instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,'value').set.call(el,${JSON.stringify(value)});el.dispatchEvent(new Event(el instanceof HTMLSelectElement?'change':'input',{bubbles:true}));})()`);await delay(50);};
 const resetQa=async step=>{
  await call('Page.navigate',{url:pathToFileURL(resolve(out,'fixture.html')).href+'#/qa/MV-QA-TEST/'+step});
  await js(`sessionStorage.clear();sessionStorage.setItem('qaRole','qa')`);await call('Page.reload');await waitText('Detalles del equipo');
 };
 const primary=async label=>await js(`[...document.querySelectorAll('button')].find(e=>e.textContent===${JSON.stringify(label)}).disabled`);
 const journeys=[];
 await resetQa('recepcion');
 // Real browser keyboard events with wedge timing; an ordinary single Enter was tested separately.
 for(const char of '7490991')await call('Input.dispatchKeyEvent',{type:'keyDown',key:char,text:char});
 await call('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter'});await waitText('Equipo validado');
 assert.equal(await primary('Recibir equipo'),false);assert.equal(await js('window.__writes[0].body.origen_captura'),'SCANNER');
 await click('Recibir equipo');await waitText('Iniciar trabajo QA');
 assert.equal(await js(`window.__writes.filter(e=>e.action==='recepcion').length`),1);

 for(const width of [320,1440])for(const theme of ['light','dark']){
  await call('Emulation.setDeviceMetricsOverride',{width,height:950,deviceScaleFactor:1,mobile:false});await resetQa('recepcion');await js(`document.documentElement.setAttribute('data-theme','${theme}')`);
  assert.equal(await js(`document.activeElement===document.querySelector('input')`),true,'scanner receives keyboard focus');
  await click('Volver a la bandeja');await waitText('Mi trabajo QA');await click('Recepcionar');await waitText('Recibir equipo');
  await setQaField('Lectura del escáner','7490991');await call('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter'});await waitText('lectura continua');assert.equal(await primary('Recibir equipo'),true);
  await click('No puedo escanear');await setQaField('Serie exacta','OTRO');await setQaField('Motivo de ingreso manual','Contingencia de prueba');
  await js(`document.querySelector('input[type="checkbox"]').click()`);await click('Validar identidad');await waitText('Equipo distinto');assert.equal(await primary('Recibir equipo'),true);
  await setQaField('Serie exacta','7490991');await click('Validar identidad');await waitText('Equipo validado');assert.equal(await primary('Recibir equipo'),false);
  assert.equal(await js(`window.__writes.filter(e=>e.action).length`),0,'validation never receives');
  await click('Recibir equipo');await waitText('Iniciar trabajo QA');await click('Iniciar trabajo QA');await waitText('Observación de lo realizado');
  await setQaField('Observación de lo realizado','Borrador que debe conservarse');await click('Volver a la bandeja');await waitText('Salir y conservar borrador');
  assert.ok(await js(`location.hash.includes('/ambiente')`));assert.equal(await js(`document.querySelectorAll('[role="dialog"]').length`),0);
  await click('Seguir aquí');
  await js('history.back()');await waitText('Salir y conservar borrador');await click('Seguir aquí');
  assert.ok(await js(`location.hash.includes('/ambiente')`),'browser back is also blocked inline');
  await js('window.__loseQaReply=true');await click('Guardar avance');await waitText('Reintentar solicitud');
  const first=await js(`window.__writes.at(-1).body.request_id`);await click('Reintentar solicitud');await waitText('Guardado.');assert.equal(await js('window.__writes.at(-1).body.request_id'),first);
  await setQaField('Observación de lo realizado','Borrador conservado al salir');await click('Volver a la bandeja');await click('Salir y conservar borrador');await waitText('Mi trabajo QA');
  await js(`location.hash='/qa/MV-QA-TEST/ambiente'`);await waitText('Recuperar borrador');await click('Recuperar borrador');
  assert.equal(await js(`document.querySelector('textarea').value`),'Borrador conservado al salir');
  await js(`document.querySelector('input[type="checkbox"]').click()`);await click('Completar Instalación Ambiente');await waitText('Registrar dictamen');
  await setQaField('Método','Manual');await setQaField('Resultado de la prueba','APROBADA');await setQaField('Dictamen','OPERATIVO');
  const before=await js('window.__writes.length');await click('Registrar dictamen');await waitText('Confirmar salida a Bodega');assert.equal(await js('window.__writes.length'),before+1);
  assert.equal(await js(`window.__writes.at(-1).body.prueba.metodo`),'Manual');assert.equal(await primary('Confirmar salida a Bodega'),true,'reception evidence never authorizes dispatch');
  await click('No puedo escanear');await setQaField('Serie exacta','7490991');await setQaField('Motivo de ingreso manual','Salida manual de fixture');await js(`document.querySelector('input[type="checkbox"]').click()`);await click('Validar identidad');await waitText('Equipo validado');
  await screenshot('qa-salida-validada',width,theme);await click('Confirmar salida a Bodega');await waitText('Salida confirmada.');
  journeys.push({width,theme,scannerReception:true,browserBackGuard:true,manualReception:true,wrongIdentityBlocked:true,atomicStart:true,inlineNavigation:true,draftRecovery:true,lostReplyRetry:true,atomicVerdict:true,newDispatchEvidence:true});
 }
 await resetQa('recepcion');await click('Volver a la bandeja');await waitText('Mi trabajo QA');
 await call('Emulation.setDeviceMetricsOverride',{width:320,height:700,deviceScaleFactor:1,mobile:false});
 await js(`location.hash='/qa?etapa=RECEPCION&q=TEST&page=1'`);await waitText('Recepcionar');await delay(100);await js('window.scrollTo(0,200)');
 const listScroll=await js('scrollY');await click('Recepcionar');await waitText('Recibir equipo');await click('Volver a la bandeja');await waitText('Mi trabajo QA');await delay(100);
 assert.ok(await js(`location.hash.includes('q=TEST')&&location.hash.includes('page=1')`));assert.ok(Math.abs(await js('scrollY')-listScroll)<2,'list scroll is restored');
 await click('Recepcionar');await waitText('Recibir equipo');await call('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});
 assert.equal(await js(`document.activeElement.textContent`),'No puedo escanear','keyboard reaches contingency');
 assert.ok(await js(`document.activeElement.matches(':focus-visible')`),'keyboard focus visible');
 await writeFile(resolve(out,'journeys.json'),JSON.stringify(journeys,null,2));
 if(!process.env.PMP_QA_VISUAL_ONLY)for(const name of ['explorador','activo','confirmacion','usuario','entrega-repuesto'])for(const theme of ['light','dark'])for(const width of [320,375,390,768,1024,1440]){
  await call('Emulation.setDeviceMetricsOverride',{width,height:950,deviceScaleFactor:1,mobile:false});
  await call('Page.navigate',{url:pathToFileURL(resolve(out,'inline',name+'-'+theme+'.html')).href});await delay(100);
  await screenshot(name,width,theme);
 }
 await writeFile(resolve(out,'report.json'),JSON.stringify(report,null,2));
 console.log(JSON.stringify({renders:report.length,passed:true,qaTaskJourneys:journeys.length,backendConnections:0}));
}finally{if(call){await call('Browser.close').catch(()=>{});ws.close();}else browser.kill();}
