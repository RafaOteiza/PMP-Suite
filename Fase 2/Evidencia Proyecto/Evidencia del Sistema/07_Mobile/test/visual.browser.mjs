// Browser layout simulation of the actual Mobile components (not a native emulator).
// No server, app session, API or database. Native primitives are mapped to DOM for visual inspection.
import assert from 'node:assert/strict';
import {build} from '../../04_Frontend/node_modules/esbuild/lib/main.js';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve,join,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
const mobile=resolve(dirname(fileURLToPath(import.meta.url)),'..'),workspace=resolve(mobile,'..');
const settingsMode=process.env.PMP_MOBILE_SCREENSET==='settings';
const historyMode=process.env.PMP_MOBILE_SCREENSET==='technical-history';
const phase=process.env.PMP_MOBILE_PHASE||'after';
const root=join(workspace,process.env.PMP_MOBILE_ARTIFACTS||(settingsMode?'.local/test-results/mobile-settings':'.local/test-results/mobile-ux')),out=join(root,phase+'-visual');await mkdir(out,{recursive:true});
// Header is an approximation; native stack geometry still requires device verification.
const appSource=await readFile(join(phase==='before'?join(root,'before'):mobile,'App.js'),'utf8');
const centeredHeader=/headerTitleAlign:\s*'center'/.test(appSource);
const frontend=join(workspace,'04_Frontend/node_modules');
const icons=JSON.parse(await readFile(join(mobile,'node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/Ionicons.json'),'utf8'));
const font=await readFile(join(mobile,'node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Ionicons.ttf'));
const native=`import React from 'react';
const flat=s=>Object.assign({},...(Array.isArray(s)?s.flat(Infinity):[s]).filter(Boolean));
function css(s){s=flat(s);const o={};for(const [k,v] of Object.entries(s)){if(k==='paddingHorizontal'){o.paddingLeft=v;o.paddingRight=v;}else if(k==='paddingVertical'){o.paddingTop=v;o.paddingBottom=v;}else if(k==='marginHorizontal'){o.marginLeft=v;o.marginRight=v;}else if(k==='marginVertical'){o.marginTop=v;o.marginBottom=v;}else if(k==='lineHeight')o[k]=typeof v==='number'?v+'px':v;else if(k==='flex')o.flex=v===1?'1 1 0%':v;else if(!['shadowColor','shadowOffset','shadowOpacity','shadowRadius','elevation','textAlignVertical','resizeMode'].includes(k))o[k]=v;}if(s.borderWidth||s.borderTopWidth||s.borderLeftWidth)o.borderStyle='solid';return o;}
const attrs=p=>({'aria-label':p.accessibilityLabel,role:p.accessibilityRole==='text'?undefined:p.accessibilityRole,'aria-disabled':p.accessibilityState?.disabled,'aria-selected':p.accessibilityState?.selected,'aria-checked':p.accessibilityState?.checked,'aria-live':p.accessibilityLiveRegion});
export function View({children,style,...p}){return <div {...attrs(p)} style={{display:'flex',flexDirection:'column',minWidth:0,flexShrink:0,...css(style)}}>{children}</div>;}
export function Text({children,style,...p}){return <span {...attrs(p)} style={{fontSize:14,whiteSpace:'pre-wrap',overflowWrap:'anywhere',...css(style)}}>{children}</span>;}
export function TouchableOpacity({children,style,onPress,disabled,...p}){return <button {...attrs(p)} disabled={disabled} onClick={onPress} style={{display:'flex',flexDirection:'column',minWidth:0,flexShrink:0,border:0,padding:0,background:'none',textAlign:'left',font:'inherit',...css(style)}}>{children}</button>;}
export function ScrollView({children,style,contentContainerStyle,...p}){return <div style={{display:'flex',flexDirection:'column',overflow:'auto',minHeight:0,...css(style)}}><div style={{display:'flex',flexDirection:'column',flexShrink:0,...css(contentContainerStyle)}}>{children}</div></div>;}
export function FlatList({data,renderItem,ListHeaderComponent,ListEmptyComponent,contentContainerStyle}){return <ScrollView style={{flex:1}} contentContainerStyle={contentContainerStyle}>{ListHeaderComponent}{data.length?data.map((item,i)=><React.Fragment key={i}>{renderItem({item})}</React.Fragment>):ListEmptyComponent}</ScrollView>;}
export function TextInput({style,value,onChangeText,multiline,editable=true,secureTextEntry,onSubmitEditing,...p}){const Tag=multiline?'textarea':'input';return <Tag {...attrs(p)} placeholder={p.placeholder} disabled={!editable} value={value} type={secureTextEntry?'password':'text'} onFocus={p.onFocus} onBlur={p.onBlur} onChange={e=>onChangeText?.(e.target.value)} onKeyDown={e=>e.key==='Enter'&&!multiline&&onSubmitEditing?.()} style={{minWidth:0,flexShrink:0,font:'inherit',...css(style)}}/>;}
export function Switch({value,onValueChange,disabled,...p}){return <input {...attrs(p)} role="switch" type="checkbox" checked={value} disabled={disabled} onChange={e=>onValueChange(e.target.checked)} style={{width:48,height:32,margin:'8px 0',accentColor:'#1565C0'}}/>;}
export function Image({source,style,...p}){return <img alt={p.accessibilityLabel||''} src={source?.uri||source} style={{objectFit:'contain',...css(style)}}/>;}
export function Ionicons({name,size=20,color,style}){return <span aria-hidden="true" style={{fontFamily:'Ionicons',fontSize:size,color,lineHeight:1,flexShrink:0,...css(style)}}>{String.fromCodePoint((${JSON.stringify(icons)})[name]||0)}</span>;}
export const ActivityIndicator=()=> <Text accessibilityRole="status">Cargando…</Text>,RefreshControl=()=>null,KeyboardAvoidingView=View;
export const StyleSheet={create:x=>x},Platform={OS:'ios',select:x=>x.ios||x.default},Appearance={getColorScheme:()=>window.fixture.theme},useColorScheme=()=>window.fixture.theme;
export const useHeaderHeight=()=>64;
export const useSafeAreaInsets=()=>({top:24,bottom:16,left:0,right:0});
const nav={navigate:(...args)=>window.fixture.navigation=args,goBack:()=>{},addListener:()=>()=>{}};export const useNavigation=()=>nav;
export const useAuth=()=>({user:{uid:'fixture-user',nombre:'Persona',apellido:'De prueba',correo:'persona.prueba@example.invalid',email:'persona.prueba@example.invalid',rol:'tecnico_terreno',activo:true},logout:()=>{},login:async()=>{throw Error('Sesión simulada');}});
export const useCameraPermissions=()=>[{granted:false},async()=>({granted:false})];
export const CameraView=()=> <View><Text>Cámara simulada</Text></View>;
export const requestCameraPermissionsAsync=async()=>({granted:false}),launchCameraAsync=async()=>({canceled:true});
export const apiErrorMessage=()=> 'Sin conexión. Reintenta cuando tengas señal.';
export const auth={currentUser:{uid:'fixture-user',email:'persona.prueba@example.invalid',providerData:[{providerId:'password'}]}};
export const EmailAuthProvider={credential:()=>{throw Error('Credentials forbidden in visual fixture');}};export const validatePassword=async()=>{throw Error('Policy not consulted during visual captures');},reauthenticateWithCredential=async()=>{throw Error('Reauth forbidden');},updatePassword=async()=>{window.fixture.writes++;throw Error('Password writes forbidden');};
export default {getItem:async()=>window.fixture.preference||'system',setItem:async(key,value)=>{window.fixture.preference=value;},get:async path=>{window.fixture.reads++;if(window.fixture.error)throw {response:{data:{message:'Sin conexión. Desliza para reintentar.'}}};return {data:path==='/os/activos-operativos'?{items:[window.fixture.order],has_more:false}:path.includes('/historial')?(window.fixture.history||{...window.fixture.order,intervenciones:[],estado_actual:'En operación',ordenes:[],referencias:[],eventos:[]}):window.fixture.empty?[]:[window.fixture.order]};},post:async()=>{window.fixture.writes++;throw Error('Operación prohibida en captura visual');}};`;
const entry=settingsMode?`import React from 'react';import {createRoot} from 'react-dom/client';
import Home from './src/screens/HomeScreen';import {SettingsScreen,ProfileScreen,AppearanceScreen,ChangePasswordScreen} from './src/screens/SettingsScreens';import {AppearanceProvider} from './src/context/AppearanceContext';import {usePmpTheme} from './src/constants/styles';import {useNavigation} from '@react-navigation/native';
const root=createRoot(document.getElementById('root'));let key=0,currentScene='settings';
function ScreenShell({scene}){const theme=usePmpTheme(),navigation=useNavigation();window.fixture.appliedTheme=theme.isDark?'dark':'light';document.body.style.background=theme.bg;document.body.style.color=theme.text;const Screen={home:Home,settings:SettingsScreen,profile:ProfileScreen,appearance:AppearanceScreen,password:ChangePasswordScreen,'password-errors':ChangePasswordScreen}[scene];return <div style={{height:'100dvh',display:'flex',flexDirection:'column',background:theme.bg}}>{scene!=='home'&&<header style={{display:'flex',alignItems:'center',gap:0,padding:'8px 16px',background:theme.navBg,color:theme.text,fontSize:18,fontWeight:700,flexShrink:0}}><span aria-hidden='true' style={{width:44,minHeight:44,display:'flex',alignItems:'center',flexShrink:0}}>‹</span><span style={{flex:1,textAlign:${JSON.stringify(centeredHeader)}?'center':'left'}}>{{settings:'Configuración',profile:'Mi perfil',appearance:'Apariencia',password:'Cambiar contraseña','password-errors':'Cambiar contraseña'}[scene]}</span>{${JSON.stringify(centeredHeader)}&&<span aria-hidden='true' style={{width:44,flexShrink:0}}/>}</header>}<Screen navigation={navigation}/></div>;}
const render=()=>root.render(<AppearanceProvider key={key}><ScreenShell scene={currentScene}/></AppearanceProvider>);
window.renderFixture=(scene,theme)=>{window.fixture={theme:theme==='dark'?'light':'dark',preference:theme,reads:0,writes:0};currentScene=scene;key++;render();};window.changeSystem=theme=>{window.fixture.theme=theme;render();};`:`import React from 'react';import {createRoot} from 'react-dom/client';
import Home from './src/screens/HomeScreen';import Orders from './src/screens/MyOrdersScreen';import Request from './src/screens/NewOrderScreen';import Login from './src/screens/LoginScreen';import History from './src/screens/AssetHistoryScreen';import Withdrawal from './src/components/TerrainWithdrawalForm';
const root=createRoot(document.getElementById('root'));let key=0;
window.renderFixture=(scene,theme)=>{window.fixture={theme,reads:0,writes:0,empty:scene==='empty',error:scene==='error',order:{codigo_os:'IN-TEST-01',tipo_equipo:'VALIDADOR',serie:'7490999',modelo:'CVB45',marca:'Mikroelektronika',bus_ppu:'TT0001',terminal:scene==='long'?'Terminal de prueba con denominación extensa para verificar lectura y adaptación':'Terminal de prueba',operador:'Operador de prueba',tecnico_nombre:'Persona de prueba',estado_id:1,estado_nombre:'EN_RUTA',es_instalacion:true,fecha:'2026-10-08T10:00:00Z',terminal_id:9,pst_codigo:'TEST'}};
if(scene.startsWith('history'))window.fixture.history={tipo_equipo:'VALIDADOR',serie:'7490999',modelo:'CVB45',marca:'Mikroelektronika',estado_actual:'En operación',intervenciones:scene==='history-empty'?[]:[{codigo_os:'MV-TEST-01',fecha:'2026-10-08T12:30:00Z',falla_reportada:'Lectura intermitente de QR',diagnostico:scene==='history-pending'?null:scene==='history-nff'?'Sin falla encontrada':'Lector desalineado',trabajo_realizado:scene==='history-pending'||scene==='history-nff'?null:'Ajuste del lector y verificación funcional',resultado:scene==='history-pending'?null:scene==='history-nff'?'NFF confirmado':scene==='history-rejected'?'Rechazado':'Reparado',pendiente:scene==='history-pending',observaciones:scene==='history-rejected'?['Persiste la falla durante la prueba de lectura']:[]}]};
const screens={'history-empty':History,'history-pending':History,'history-nff':History,'history-rejected':History,home:Home,orders:Orders,installation:Orders,request:Request,login:Login,history:History,withdrawal:Withdrawal,empty:Orders,error:Orders,long:Orders};const Screen=screens[scene];const title={'history-empty':'Historial del activo','history-pending':'Historial del activo','history-nff':'Historial del activo','history-rejected':'Historial del activo',orders:'Mis órdenes',installation:'Mis órdenes',request:'Reportar falla',history:'Historial del activo',withdrawal:'Retiro físico',empty:'Mis órdenes',error:'Mis órdenes',long:'Mis órdenes'}[scene];
document.body.style.background=theme==='dark'?'#07111C':'#F5F7FA';document.body.style.color=theme==='dark'?'#F2F5F9':'#0D1B2A';
root.render(<div key={++key} style={{height:'100dvh',display:'flex',flexDirection:'column'}}>{title&&<header style={{display:'flex',alignItems:'center',gap:12,padding:'16px',background:${JSON.stringify(phase)}==='before'?'#0D1B2A':theme==='dark'?'#0D1B2A':'white',color:${JSON.stringify(phase)}==='before'?'white':theme==='dark'?'#F2F5F9':'#0D1B2A',fontSize:18,fontWeight:700,flexShrink:0}}><span aria-hidden="true">‹</span>{title}</header>}<Screen route={{params:scene.startsWith('history')?{serie:'7490999',tipo_equipo:'VALIDADOR'}:{}}} order={window.fixture.order} onClose={()=>{}} onSuccess={()=>{}}/></div>);};`;
await build({stdin:{contents:entry,resolveDir:mobile,loader:'jsx'},bundle:true,outfile:join(out,'fixture.js'),loader:{'.png':'dataurl','.js':'jsx'},plugins:[{name:'isolated-mobile',setup(b){
 b.onResolve({filter:/^(react|react-dom\/client)$/},args=>({path:join(frontend,args.path==='react'?'react/index.js':'react-dom/client.js')}));
 b.onResolve({filter:/^(react-native|react-native-safe-area-context|@expo\/vector-icons|@react-navigation\/native|@react-navigation\/elements|@react-native-async-storage\/async-storage|firebase\/auth|expo-camera|expo-image-picker)$|services\/api$|services\/firebase$|^\.\/firebase$|context\/AuthContext$/},()=>({path:'native-fixture',namespace:'fixture'}));
 b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:native,loader:'jsx',resolveDir:mobile}));
 if(phase==='before')b.onLoad({filter:/07_Mobile[\\/]src[\\/].*\.js$/},async args=>({contents:await readFile(join(root,'before',args.path.slice(args.path.indexOf('src'))),'utf8'),loader:'jsx',resolveDir:dirname(args.path)}));
}}]});
await writeFile(join(out,'fixture.html'),`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>@font-face{font-family:Ionicons;src:url(data:font/ttf;base64,${font.toString('base64')})}*{box-sizing:border-box}div{border:0 solid transparent}body{margin:0;font-family:Arial,sans-serif}button{cursor:pointer}button:disabled{cursor:default}button:focus-visible,input:focus-visible,textarea:focus-visible{outline:2px solid #00B4B0;outline-offset:2px}#root{width:100%;height:100dvh}</style><div id="root"></div><script src="fixture.js"></script>`);
const probe=createServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;await new Promise(r=>probe.close(r));
const chrome=spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--remote-debugging-port='+port,'--user-data-dir='+join(out,'chrome-profile'),'--no-first-run','--no-default-browser-check','about:blank'],{windowsHide:true,stdio:'ignore'});
let ws;const delay=ms=>new Promise(r=>setTimeout(r,ms)),report=[];
try{
 let tabs;for(let i=0;i<60;i++){try{tabs=await(await fetch('http://127.0.0.1:'+port+'/json/list')).json();break;}catch{await delay(100);}}assert.ok(tabs);
 ws=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise(r=>ws.addEventListener('open',r,{once:true}));let seq=0;const calls=new Map();
 ws.addEventListener('message',e=>{const v=JSON.parse(e.data);if(v.id){const p=calls.get(v.id);calls.delete(v.id);v.error?p.reject(v.error):p.resolve(v.result);}});
 const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;calls.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
 const js=async expression=>{const r=await call('Runtime.evaluate',{expression,returnByValue:true});assert.ok(!r.exceptionDetails,JSON.stringify(r.exceptionDetails));return r.result.value;};
 await call('Page.enable');await call('Network.enable');await call('Network.setBlockedURLs',{urls:['http://*','https://*']});await call('Page.navigate',{url:pathToFileURL(join(out,'fixture.html')).href});
 for(let i=0;i<60;i++){if(await js('typeof window.renderFixture==="function"'))break;await delay(100);}
 const scenes=historyMode?['history','history-empty','history-pending','history-nff','history-rejected']:settingsMode?['home','settings','profile','appearance','password','password-errors']:phase==='before'?['home','orders','installation','request']:['home','orders','installation','request','login','history','withdrawal','empty','error','long'];
 for(const scene of scenes)for(const theme of ['light','dark'])for(const [width,height] of [[320,740],[390,844],[430,932],[768,1024],[1024,768]]){
  await call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});await js(`window.renderFixture('${scene}','${theme}')`);await delay(150);
  if(scene==='installation'){await js(`[...document.querySelectorAll('button')].find(e=>${JSON.stringify(phase)}==='before'?e.textContent.includes('IN-TEST-01'):e.textContent.includes('Instalar / devolver equipo'))?.click()`);await delay(100);assert.ok(await js("document.body.innerText.includes('Confirmar instalado OK')"));}
  if(settingsMode){
   assert.equal(await js('window.fixture.appliedTheme'),theme,'Restored explicit preference overrides opposite system theme');
   if(scene==='appearance'){
    const click=async label=>{await js(`[...document.querySelectorAll('button')].find(e=>e.getAttribute('aria-label')==='${label}').click()`);await delay(60);};
    await click(theme==='dark'?'Claro':'Oscuro');assert.equal(await js('window.fixture.appliedTheme'),theme==='dark'?'light':'dark');
    await click('Automático');assert.equal(await js('window.fixture.appliedTheme'),await js('window.fixture.theme'));
    await js(`window.changeSystem('${theme}')`);await delay(60);assert.equal(await js('window.fixture.appliedTheme'),theme);
    await click(theme==='dark'?'Oscuro':'Claro');assert.equal(await js('window.fixture.preference'),theme);
   }
   if(scene==='password'||scene==='password-errors'){
    await js("document.querySelector('input').focus()");assert.equal(await js("document.activeElement.getAttribute('aria-label')"),'Contraseña actual');
    await js("document.activeElement.blur();[...document.querySelectorAll('div')].forEach(e=>{if(e.scrollTop)e.scrollTop=0})");
    assert.equal(await js("document.querySelectorAll('input[type=password]').length"),3);
    if(scene==='password-errors'){await js("[...document.querySelectorAll('button')].find(e=>e.textContent.includes('Guardar contraseña')).click()");await delay(60);assert.ok(await js("document.querySelector('[role=alert]')!==null"));}
    assert.ok(await js("(()=>{const b=[...document.querySelectorAll('button')].find(e=>e.textContent.includes('Guardar contraseña'));b.scrollIntoView();return b.getBoundingClientRect().bottom<=innerHeight+1})()"),'Password action reachable by scroll');
    await js("[...document.querySelectorAll('div')].forEach(e=>{if(e.scrollTop)e.scrollTop=0})");
   }
  }
  const metrics=await js(`({overflow:[...document.querySelectorAll('div')].some(e=>e.scrollWidth>e.clientWidth+2&&getComputedStyle(e).overflowX!=='auto'),writes:window.fixture.writes,buttons:[...document.querySelectorAll('button')].map(e=>({text:e.textContent,height:e.getBoundingClientRect().height})),text:document.body.innerText})`);
  report.push({scene,theme,width,height,...metrics});assert.equal(metrics.writes,0);
  if(phase==='after'){
   assert.equal(metrics.overflow,false,scene+' '+theme+' '+width);assert.ok(metrics.text.length>20,'Visible content');for(const b of metrics.buttons)assert.ok(b.height>=44,scene+': '+b.text+' '+b.height);
   if(scene==='request'){
    await js("document.querySelector('input').focus()");await delay(30);assert.equal(await js("document.activeElement.getAttribute('aria-label')"),'Bus / PPU');
    await call('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});await call('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});assert.equal(await js("document.activeElement.getAttribute('aria-label')"),'Serie del activo');
    assert.ok(await js("(()=>{const b=[...document.querySelectorAll('button')].find(e=>e.textContent.includes('Crear requerimiento'));b.scrollIntoView();return b.getBoundingClientRect().bottom<=innerHeight+1})()"),'Primary action reachable by scrolling');
    await js("document.activeElement.blur();[...document.querySelectorAll('div')].forEach(e=>{if(e.scrollTop)e.scrollTop=0})");
   }
  }
  if(width===390||(settingsMode||historyMode)&&width===320){const shot=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile(join(out,`${scene}-${theme}${width===320?'-320':''}.png`),Buffer.from(shot.data,'base64'));}
 }
 await writeFile(join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({phase,simulatedRenders:report.length,passed:true,realApiCalls:0,writes:0}));
}finally{ws?.close();chrome.kill();}
