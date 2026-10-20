// Static file render: no application server, no parallel environment, no database.
// Real pages/components; in-memory read fixtures only. All commands are forbidden.
// These fixtures never contact Firebase, PostgreSQL or the habitual API.
import assert from 'node:assert/strict';
import {build,transform} from 'esbuild';
import {supplementalMock} from './ui-audit-fixtures.mjs';
const globalAudit=process.env.PMP_UX_GLOBAL==='1';
const detailAudit=process.env.PMP_UX_DETAILS==='1';
import {readdir,readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {spawn} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {createServer as createProbe} from 'node:net';
import {inventoryFixture,initialAsset,stageLabels} from './logistics-fixture.mjs';
const phase=process.env.PMP_UX_PHASE||'after';
const out=resolve(process.env.PMP_UX_OUTPUT||'../.local/test-results/ux-suite',phase);
const baseline=resolve('../.local/test-results/ux-suite/before-source');await mkdir(out,{recursive:true});
const pages=(await readdir('src/pages')).filter(x=>x.endsWith('.tsx')).map(x=>x.slice(0,-4));
const mock=`
const initialAsset=${JSON.stringify(initialAsset)},stageLabels=${JSON.stringify(stageLabels)};
const inventoryFixture=${inventoryFixture.toString()};
import {useLocation} from 'react-router-dom';
export const fbAuth={currentUser:null};
export const useSession=()=>{const l=useLocation();const role=new URLSearchParams(l.search).get('role')||window.__auditRole||'admin';return {status:(l.pathname.includes('LoginPage')||l.pathname==='/login')?'unauthenticated':'authenticated',me:{id:'fixture',nombre:'Persona de prueba',apellido:'Apellido extenso de prueba',rol:role},refreshSession:async()=>null,endSession(){}};};
const ticket={codigo_os:'MV-TEST',tipo_equipo:'VALIDADOR',serie:'7409101',modelo:'CVB45',marca:'Mikroelektronika',bus_ppu:'TEST01',terminal:'Terminal de prueba',operador:'Operador de prueba',referencia_ar:'AR-TEST',falla:'Lectura QR intermitente',estado_id:4,estado_nombre:'EN_DIAGNOSTICO',fecha:'2026-10-08T12:00:00Z',fecha_ingreso_laboratorio:'2026-10-08T12:00:00Z',fuente_ingreso_laboratorio:'RECEPCION_FISICA',ubicacion:'Laboratorio Garantías',tecnico_laboratorio_id:'fixture',tecnico_laboratorio:'Persona de prueba',recepcion_laboratorio_confirmada:true};
const reference={...ticket,id:'reference-fixture',sistema_externo:'ARANDA',referencia_externa:'AR-TEST'};
const actor={id:'fixture',nombre:'Persona de prueba',fecha:ticket.fecha};
const fail=async(path,options={})=>{window.__reads.push(path);
 if(path==='/api/dashboard/badges')return {data:{bodega:0,lab:0,lab_dispatch:0,qa:0}};
 const mode=new URLSearchParams(location.hash.split('?')[1]).get('mode')||window.__auditMode;
 if(mode==='data'||(window.__globalAudit&&mode==='empty')){
  if(path==='/api/bridge')return {data:[reference]};
  if(path.endsWith('/historial'))return {data:{...ticket,ordenes:[{...ticket,estado:'EN_DIAGNOSTICO'}],referencias:[reference],eventos:[{id:'event-fixture',codigo_os:ticket.codigo_os,fecha:ticket.fecha,tipo:'RECEPCION_LABORATORIO_CONFIRMADA',descripcion:'Recepcion fisica confirmada',cambios:[],detalle:{metadata:{serie:ticket.serie,tecnico:actor.nombre,ubicacion:'Laboratorio',origen_captura:'SCANNER'}}}]}};
  if(path==='/api/os/pendientes-retiro')return {data:[{...ticket,estado_id:1,estado_operacional:'Pendiente de retiro',estado_actual:'PENDIENTE_RETIRO',tecnico_terreno_id:null},{...ticket,codigo_os:'MC-TEST',tipo_equipo:'CONSOLA',serie:'9100100',estado_id:1,estado_operacional:'Pendiente de retiro',estado_actual:'PENDIENTE_RETIRO',tecnico_terreno_id:'fixture',tecnico_terreno:actor.nombre}]};
  if(path==='/api/bodega/tecnicos')return {data:[{id:'fixture',nombre:'Persona',apellido:'Prueba'}]};
  if(path.startsWith('/api/lab/work/'))return {data:{revision:'1',trabajo:{diagnostico:{resultado:'CONFIRMADA',falla_real:'Falla QR',observacion:'Lectura intermitente'},acciones:['Limpieza interna'],pruebas:[],resultado:'',observaciones_qa:'',pod:{categoria:'',observacion:'',fotografias:[]}}}};
  if(path.startsWith('/api/qa/')&&path.endsWith('/work'))return {data:{...ticket,codigo_os:'MV-TEST',etapa:'PRUEBAS',estado_operacional:'Pruebas',ciclo_qa:'1',revision:'1',trabajo:{etapa:'PRUEBAS',responsable:actor,receptor:actor,ambiente:{estado:'COMPLETADO',inicio:ticket.fecha,fin:ticket.fecha,observacion:'Instalacion de prueba preparada'},pruebas:[{id:'test',metodo:'Manual',resultado:'PENDIENTE',observacion:'Verificar lectura',autor:actor,fecha:ticket.fecha}],dictamen:null},historial:[],antecedentes_laboratorio:null}};
  if(path==='/api/bodega/inventario'){const data=inventoryFixture(Object.entries(stageLabels).map(([etapa,label],i)=>({...initialAsset,serie:String(7409100+i),etapa,estado_actual:label,en_bodega:['BODEGA','DISPONIBLE'].includes(etapa),disponible:etapa==='DISPONIBLE'})),options.params);data.secundarios.alertasStock=${Number(process.env.PMP_UX_STOCK_ALERTS||0)};return {data};}
  if(path==='/api/dashboard/summary')return {data:{kpis:{totalEnProceso:4,consolasEnLab:2,validadoresEnLab:2,totalReparados:3,totalOperativos:42,totalEnRuta:2,totalAsignados:1,totalEnBodega:5,totalEnTransito:3,totalReparadosLab:2,totalEnQa:4,totalPods:2,podsReparados:1,tiempoPromedio:18},charts:{pieData:[{name:'Validadores',value:2},{name:'Consolas',value:2}],barData:[{name:'En operación',cantidad:42},{name:'Disponibles',cantidad:3},{name:'Pendientes',cantidad:5}]}}};
  if(path==='/api/bodega/queue')return {data:[{...ticket,estado_id:2,origen_transito:'terreno'}]};
  if(path.startsWith('/api/lab/queue/'))return {data:[{...ticket,...((location.hash.includes('LabWorkPage')||location.hash.includes('/mi-carga/'))?{estado_id:5,estado_nombre:'EN_REPARACION'}:{}),codigo_os:path.endsWith('CONSOLA')?'MC-TEST':'MV-TEST',tipo_equipo:path.endsWith('CONSOLA')?'CONSOLA':'VALIDADOR'}]};
  if(path==='/api/lab/completed')return {data:[]};
  if(path==='/api/lab/technicians')return {data:[{id:'fixture',nombre:'Persona',apellido:'Prueba'}]};
  if(path==='/api/qa/dashboard')return {data:{items:[{...ticket,etapa:'RECEPCION',estado_operacional:'Pendiente recepción',dictamen:null}],counts:{RECEPCION:1,AMBIENTE:2,PRUEBAS:3,DESPACHO:1},total:1,page:1,page_size:20}};
  if(path==='/api/dashboard/equipos-operativos')return {data:{data:[{...ticket,tipo:'VALIDADOR',ultima_operacion:ticket.fecha}],pagination:{total:1,limit:20,offset:0}}};
  if(path==='/api/users')return {data:{items:[{id:'fixture',nombre:'Persona',apellido:'Prueba',correo:'prueba@example.test',rol:'logistica',activo:true}]}};
 }
 throw {response:{status:503,data:{message:'Consulta no disponible · fixture aislada'}}};};
export const api={get:fail,post:async()=>{window.__writes++;throw Error('NO WRITES IN VISUAL TEST');},put:async()=>{window.__writes++;throw Error('NO WRITES IN VISUAL TEST');},patch:async()=>{window.__writes++;throw Error('NO WRITES IN VISUAL TEST');},delete:async()=>{window.__writes++;throw Error('NO WRITES IN VISUAL TEST');}};export const coreApi=api;${globalAudit?supplementalMock:''}`;
const entry=globalAudit?`import React from 'react';import {createRoot} from 'react-dom/client';import {RouterProvider,createHashRouter} from 'react-router-dom';import App from './src/App';
window.__globalAudit=true;window.__auditMode=new URLSearchParams(location.search).get('mode');window.__auditRole=new URLSearchParams(location.search).get('role');window.__reads=[];window.__uncovered=[];window.__renderErrors=[];window.__writes=0;
class Boundary extends React.Component {state={error:null};static getDerivedStateFromError(error){return {error};}componentDidCatch(e){window.__renderErrors.push(e.message);}render(){return this.state.error?<p role='alert'>RENDER ERROR: {this.state.error.message}</p>:this.props.children;}}
createRoot(document.getElementById('root')).render(<RouterProvider router={createHashRouter([{path:'*',element:<Boundary><App/></Boundary>}])}/>);`:`import React from 'react';import {createRoot} from 'react-dom/client';import {RouterProvider,createHashRouter} from 'react-router-dom';import Shell from './src/components/AppLayout';
${pages.map((name,i)=>`import P${i} from './src/pages/${name}';`).join('\n')}
window.__reads=[];window.__renderErrors=[];window.__writes=0;
class Boundary extends React.Component {state={error:null};static getDerivedStateFromError(error){return {error};}componentDidCatch(e){window.__renderErrors.push(e.message);}render(){return this.state.error?<p role="alert">RENDER ERROR: {this.state.error.message}</p>:this.props.children;}}
createRoot(document.getElementById('root')).render(<RouterProvider router={createHashRouter([{element:<Shell/>,children:[${pages.filter(n=>n!=='LoginPage').map((n)=>`{path:'/${n}/:osId?/:step?',element:<Boundary><P${pages.indexOf(n)} purpose="receipt"/></Boundary>}`).join(',')}]},{path:'/LoginPage',element:<P${pages.indexOf('LoginPage')}/>}])}/>);`;
await build({stdin:{contents:entry,resolveDir:process.cwd(),loader:'tsx'},jsx:'automatic',bundle:true,outfile:join(out,'fixture.js'),plugins:[{name:'isolated-transport',setup(b){if(phase==='before')b.onLoad({filter:/[\\/]src[\\/].*\.(ts|tsx)$/},async args=>({contents:await readFile(resolve(baseline,args.path.slice(resolve('src').length+1).replace(/^/, 'src/')),'utf8'),loader:args.path.endsWith('.tsx')?'tsx':'ts',resolveDir:resolve(args.path,'..')}));b.onResolve({filter:/(^|\/)http$|app\/(SessionContext|firebase)$/},()=>({path:'fixture',namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:mock,loader:'js',resolveDir:process.cwd()}));}}]});
const css=(await Promise.all(['tokens','base','layout','components','pages','logistics-assets',...(phase==='after'?['product-ui']:[])].map(n=>readFile(resolve(phase==='before'?baseline:'.','src/styles/'+n+'.css'),'utf8')))).join('\n');
let bundle=await readFile(join(out,'fixture.js'),'utf8');bundle=bundle.replaceAll('/brand/',pathToFileURL(resolve('public/brand')).href+'/');await writeFile(join(out,'fixture.js'),bundle);
await writeFile(join(out,'fixture.html'),`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${(css+'\n'+await readFile(join(out,'fixture.css'),'utf8').catch(()=>'' )).replaceAll('/brand/',pathToFileURL(resolve('public/brand')).href+'/')}</style></head><body><div id="root"></div><script src="fixture.js"></script></body></html>`);
const origin=pathToFileURL(join(out,'fixture.html')).href;
const probe=createProbe();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const debugPort=probe.address().port;await new Promise(r=>probe.close(r));
const browser=spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--remote-debugging-port='+debugPort,'--user-data-dir='+join(out,'chrome-profile'),'--no-first-run','--no-default-browser-check','about:blank'],{windowsHide:true,stdio:'ignore'});
const delay=ms=>new Promise(r=>setTimeout(r,ms));let ws;const report=[],keyboard=[];
try{
 let tabs;for(let i=0;i<60;i++){try{tabs=await(await fetch('http://127.0.0.1:'+debugPort+'/json/list')).json();break;}catch{await delay(100);}}assert.ok(tabs);
 ws=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise(r=>ws.addEventListener('open',r,{once:true}));let seq=0;const calls=new Map();
 ws.addEventListener('message',e=>{const v=JSON.parse(e.data);if(v.id){const p=calls.get(v.id);calls.delete(v.id);clearTimeout(p.timer);v.error?p.reject(v.error):p.resolve(v.result);}});
 const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;const timer=setTimeout(()=>{calls.delete(id);reject(Error('Browser timeout: '+method));},20000);calls.set(id,{resolve,reject,timer});ws.send(JSON.stringify({id,method,params}));});
 const js=async expression=>{const r=await call('Runtime.evaluate',{expression,returnByValue:true});assert.ok(!r.exceptionDetails,JSON.stringify(r.exceptionDetails));return r.result.value;};await call('Page.enable');if(globalAudit)await call('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});await call('Network.enable');await call('Network.setBlockedURLs',{urls:['http://*','https://*']});
 const rich=['DashboardPage','BodegaDashboardPage','BodegaModulosPage','BodegaPage','LabDashboardPage','LabAsignacionPage','LabValidadoresPage','LabConsolasPage','QaPage','EquiposOperativosPage','AdminUsersPage','RoleDashboardPage','LabWorkPage','QaWorkPage','TrazabilidadPage','RetirosTerrenoPage','BridgeFlowPage'];
 let cases=[...pages.map(page=>({page,mode:'error'})),...rich.map(page=>({page,mode:'data'}))];
 if(globalAudit){
  const code=(await transform(await readFile('src/app/rbac.ts','utf8'),{loader:'ts',format:'esm'})).code;
  const {ROLES,PERMISSIONS,can}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
  const app=await readFile('src/App.tsx','utf8');
  const routes=[...app.matchAll(/<Route path="([^"]+)" element={<Guarded permission={PERMISSIONS\.(\w+)}><(\w+)/g)].map(m=>({route:m[1],permission:m[2],page:m[3]==='RootRedirector'?'DashboardPage':m[3]}));
  routes.push({route:'/reportes',page:'ReportsPage'});
  const matrix=Object.values(ROLES).flatMap(role=>routes.map(r=>({...r,role,allowed:r.permission?can({rol:role},PERMISSIONS[r.permission]):['admin','gerente','jefe_laboratorio','logistica'].includes(role)})));
  await writeFile(join(out,'role-route-matrix.json'),JSON.stringify(matrix,null,2));
  cases=matrix.flatMap(r=>(r.allowed?['data','empty','error','loading']:['denied']).map(mode=>({...r,mode})));
  cases.push(...['/login','/403','/404'].map((route,i)=>({route,page:['LoginPage','ForbiddenPage','NotFoundPage'][i],role:'guest',mode:'data',allowed:true})));
  if(detailAudit){
   cases=cases.filter(c=>c.allowed&&['data','empty'].includes(c.mode)&&['LabReportesPage','LabAsignacionPage','TrazabilidadPage','AdminUsersPage','ReportsPage','RoleDashboardPage','WarehouseOperationPage'].includes(c.page));
   cases.push(...['recepcion','ambiente','pruebas','despacho','detalle'].map(step=>({route:'/qa/MV-TEST/'+step,page:'QaWorkPage',role:'qa',mode:'data',allowed:true})),...['recepcion','salida'].map(step=>({route:'/lab/custodia/MV-TEST/'+step,page:'LabCustodyPage',role:'jefe_laboratorio',mode:'data',allowed:true})));
  }
 }
 for(const item of cases.filter(c=>(!process.env.PMP_UX_ROLES||process.env.PMP_UX_ROLES.split(',').includes(c.role))&&(!process.env.PMP_UX_PAGES||process.env.PMP_UX_PAGES.split(',').includes(c.page)))){
  const {page,mode}=item;
  const role=item.role||(['IngresoOSPage','MyServiceOrdersPage'].includes(page)?'tecnico_terreno':page==='RoleDashboardPage'?'tecnico_laboratorio':page==='LabWorkPage'?'tecnico_laboratorio':page==='QaWorkPage'?'qa':'admin');
  const suffix=page==='QaWorkPage'&&mode==='data'?'/MV-TEST/pruebas':page==='LabWorkPage'&&mode==='data'?'/MV-TEST':['LabCustodyPage','QaWorkPage'].includes(page)?'/MV-FIXTURE/recepcion':['LabWorkPage','WarehouseOperationPage'].includes(page)?'/MV-FIXTURE':'';
  const extra=page==='TrazabilidadPage'&&mode==='data'?'&tipo=VALIDADOR&serie=7409101':'';
  const route=globalAudit?item.route.replace(':osId','MV-TEST').replace(':step',page==='QaWorkPage'?'pruebas':'recepcion'):'/'+page+suffix;
  await call('Page.navigate',{url:`${origin}?page=${page}-${mode}&role=${role}&mode=${mode}&route=${encodeURIComponent(route)}#${route}?role=${role}&mode=${mode}${extra}`});if(globalAudit){for(let attempt=0;attempt<100;attempt++){if(await js("Array.isArray(window.__reads)&&document.readyState==='complete'&&!!document.getElementById('root')?.children.length"))break;await delay(100);}}await delay(globalAudit?200:650);
  if(detailAudit&&mode==='data'&&page==='AdminUsersPage')await js("document.querySelector('button[aria-label^=Editar]')?.click()");
  if(detailAudit&&mode==='data'&&page==='ReportsPage')await js("(()=>{const select=document.getElementById('report-selection');select.value=select.querySelector('optgroup option')?.value||'';select.dispatchEvent(new Event('change',{bubbles:true}));})()");
  for(const theme of (mode==='denied'?['light']:['light','dark']))for(const width of (globalAudit?(mode==='denied'?[390]:mode==='data'?[320,390,768,1366,1440,1536,1920]:[390,1440]):phase==='before'?[1440]:[320,390,768,1024,1440])){
   await call('Emulation.setDeviceMetricsOverride',{width,height:width===1920?1080:width===1536?864:width===1366?768:900,deviceScaleFactor:1,mobile:false});await js(`document.documentElement.setAttribute('data-theme','${theme}')`);await delay(globalAudit?70:400);
   const metrics=await js(`({overflow:document.documentElement.scrollWidth>innerWidth,errors:window.__renderErrors||[],heading:document.querySelector('main h1,h1')?.textContent,alerts:[...document.querySelectorAll('[role="alert"]')].map(e=>e.textContent),reads:window.__reads?.length||0,writes:window.__writes,sidebar:document.querySelector(".sidebar")?.getBoundingClientRect().width,sidebarFont:getComputedStyle(document.querySelector(".sb-link")||document.body).fontSize,contentMetrics:{button:document.querySelector("main .btn")?.getBoundingClientRect().height,card:document.querySelector("main .stat-card")?.getBoundingClientRect().height,title:document.querySelector("main h1")&&getComputedStyle(document.querySelector("main h1")).fontSize},overlays:document.querySelectorAll('dialog[open],[aria-modal="true"]').length,culprits:[...document.querySelectorAll('main *')].filter(e=>e.getBoundingClientRect().right>innerWidth+1&&getComputedStyle(e).position!=='absolute').slice(0,5).map(e=>e.tagName+'.'+e.className)})`);
   report.push({page,route,mode,role,theme,width,...metrics,...(globalAudit?await js("({uncovered:window.__uncovered,hash:location.hash,readOnly:document.querySelectorAll('.read-only-notice').length,unlabelled:[...document.querySelectorAll('main input:not([type=hidden]),main select,main textarea')].filter(e=>e.getClientRects().length&&!e.labels?.length&&!e.getAttribute('aria-label')&&!e.getAttribute('aria-labelledby')).map(e=>({tag:e.tagName,placeholder:e.placeholder,id:e.id})),headerHeight:document.querySelector('.page-header')?.getBoundingClientRect().height,emptyHeights:[...document.querySelectorAll('.empty-state')].map(e=>e.getBoundingClientRect().height),text:document.querySelector('main')?.innerText.slice(0,800)})"): {})});
   if((!globalAudit||metrics.overflow||detailAudit)&&(mode==='data'||detailAudit||['GestionActivosPage','IngresoRequerimientosPage','TrazabilidadPage','BridgeFlowPage','LoginPage'].includes(page))&&[320,390,1440].includes(width)){
    const shot=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});await writeFile(join(out,`${page}-${detailAudit?role+'-'+route.split('/').at(-1)+'-':''}${mode}-${theme}-${width}.png`),Buffer.from(shot.data,'base64'));
   }
  }
  if(!globalAudit&&mode==='data'&&page==='BodegaDashboardPage'){
   if(process.env.PMP_UX_CIRCUIT==='1'){
    const motion=await js("(()=>{const svg=document.querySelector('.page-header-circuit'),path=svg.querySelector('.header-circuit-signal'),animation=path.getAnimations()[0];animation.pause();animation.currentTime=1000;const first=getComputedStyle(path).strokeDashoffset;animation.currentTime=3000;return {hidden:svg.getAttribute('aria-hidden'),pointerEvents:getComputedStyle(svg).pointerEvents,first,second:getComputedStyle(path).strokeDashoffset,duration:animation.effect.getTiming().duration,iterations:animation.effect.getTiming().iterations};})()");
    assert.equal(motion.hidden,'true');assert.equal(motion.pointerEvents,'none');assert.notEqual(motion.first,motion.second);assert.ok(motion.duration<=5000);assert.equal(motion.iterations,1);
    for(const theme of ['light','dark']){
     await js(`document.documentElement.setAttribute('data-theme','${theme}')`);
     const box=await js("(()=>{const r=document.querySelector('.page-header').getBoundingClientRect();return {x:r.x+scrollX,y:r.y+scrollY,width:r.width,height:r.height,scale:1};})()");
     const shot=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip:box});await writeFile(join(out,`header-circuit-${theme}.png`),Buffer.from(shot.data,'base64'));
    }
    await call('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
    assert.equal(await js("getComputedStyle(document.querySelector('.header-circuit-signal')).animationName"),'none');
    await call('Emulation.setEmulatedMedia',{features:[]});
    await writeFile(join(out,'circuit-motion.json'),JSON.stringify({...motion,reducedMotion:true},null,2));
   }
   await js("document.querySelector('main [data-interactive=\"true\"]').focus()");
   await call('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});
   await call('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});
   const focused=await js("({tag:document.activeElement.tagName,role:document.activeElement.getAttribute('role'),visible:document.activeElement.matches(':focus-visible'),outline:getComputedStyle(document.activeElement).outlineStyle,width:getComputedStyle(document.activeElement).outlineWidth})");
   keyboard.push({page,...focused});assert.equal(focused.visible,true);assert.notEqual(focused.outline,'none');
  }
  if(globalAudit){
   await writeFile(join(out,'progress.json'),JSON.stringify({page,route,role,mode,renders:report.length,failures:report.filter(r=>r.errors?.length||r.overflow).slice(-6)},null,2));
   if(mode==='denied'&&!await js("location.hash.startsWith('#/403')"))report.push({page,route,role,mode,errors:['Guard did not deny route']});
   if(mode==='data'&&role!=='guest'&&await js("!!document.querySelector('.topbar-mobile-menu')")){
    await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:false});await delay(100);
    assert.equal(await js("getComputedStyle(document.querySelector('.sidebar')).visibility"),'hidden');
    await js("document.querySelector('.topbar-mobile-menu').click()");await delay(100);
    assert.equal(await js("getComputedStyle(document.querySelector('.sidebar')).visibility"),'visible');
    await js("document.querySelector('.sidebar-backdrop').click()");await delay(100);
    const count=await js("document.querySelectorAll('[role=tablist] button,.operation-tabs button').length");
    for(let i=0;i<Math.min(count,8);i++){
     await js(`document.querySelectorAll('[role=tablist] button,.operation-tabs button')[${i}]?.click()`);await delay(80);
     const m=await js("({overflow:document.documentElement.scrollWidth>innerWidth,errors:window.__renderErrors||[],writes:window.__writes,heading:document.querySelector('main h1')?.textContent})");
     report.push({page,route,role,mode:'tab-'+i,width:390,theme:'dark',...m});
    }
    if(page==='ReportsPage'){await js("(()=>{const select=document.getElementById('report-selection');select.value=select.querySelector('optgroup option')?.value||'';select.dispatchEvent(new Event('change',{bubbles:true}));})()");await delay(100);}
    await js("document.querySelector('main input:not(:disabled),main select:not(:disabled),main button:not(:disabled),main a[href]')?.focus()");
    await call('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});
    await call('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});
    const focus=await js("({tag:document.activeElement.tagName,label:document.activeElement.getAttribute('aria-label')||document.activeElement.textContent?.slice(0,90),visible:document.activeElement.matches(':focus-visible'),outline:getComputedStyle(document.activeElement).outlineStyle})");keyboard.push({page,role,...focus});
    if(detailAudit){assert.equal(focus.visible,true);assert.notEqual(focus.outline,'none');}
    assert.equal(await js('window.__writes'),0);
   }
   if(mode==='data'&&role!=='guest'&&await js("!!document.querySelector('.topbar-sidebar-toggle')")){
    await call('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});
    await js("if(!document.querySelector('.app-shell')?.classList.contains('sidebar-collapsed'))document.querySelector('.topbar-sidebar-toggle')?.click()");await delay(400);
    const collapsed=await js("({width:document.querySelector('.sidebar')?.getBoundingClientRect().width,overflow:document.documentElement.scrollWidth>innerWidth})");
    if(collapsed.width!==undefined&&(!Number.isFinite(collapsed.width)||Math.abs(collapsed.width-84)>=1||collapsed.overflow))report.push({page,route,role,mode:'collapsed',overflow:collapsed.overflow,errors:['Sidebar width '+collapsed.width]});
    await js("document.querySelector('.topbar-sidebar-toggle')?.click()");await delay(400);
   }
   if(mode==='data'&&['DashboardPage','RoleDashboardPage','TrazabilidadPage','LabReportesPage','ReportsPage'].includes(page)){
    await call('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});
    await delay(1600);for(const theme of ['light','dark']){await js(`document.documentElement.setAttribute('data-theme','${theme}')`);await delay(100);const shot=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});await writeFile(join(out,`${page}-${role}-${theme}.png`),Buffer.from(shot.data,'base64'));}
   }
  }
 }
 await writeFile(join(out,process.env.PMP_UX_PAGES?'report-targeted.json':'report.json'),JSON.stringify(report,null,2));
 if(keyboard.length)await writeFile(join(out,'keyboard.json'),JSON.stringify(keyboard,null,2));
 const failures=report.filter(r=>r.overflow||r.errors.length||r.overlays||r.writes);console.log(JSON.stringify({pages:pages.length,renders:report.length,failures},null,2));assert.equal(failures.length,0);
}finally{ws?.close();browser.kill();}
