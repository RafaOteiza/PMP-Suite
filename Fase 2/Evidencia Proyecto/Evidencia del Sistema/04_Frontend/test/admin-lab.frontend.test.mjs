import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import React from 'react';
import Renderer,{act} from 'react-test-renderer';
import {MemoryRouter,Routes,Route,Outlet,useLocation} from 'react-router-dom';
import ts from 'typescript';
const data=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64'),cache=new Map();
globalThis.__adminLab={};
const transport=data(`export const api={get:async(path,options)=>{const s=globalThis.__adminLab;s.reads.push({path,params:options?.params});if(s.get)return {data:await s.get(path,options?.params)};if(s.error)throw Error('Fixture unavailable');return {data:path.includes('/operational-insights')?s.insights:path.includes('/executive')?s.dashboard:path.includes('predictive')?s.risks:s.reception};},post:async()=>{throw Error('Writes forbidden');}};`);
async function compile(path){
 if(cache.has(path))return cache.get(path);
 const source=await readFile(path,'utf8');let js=ts.transpileModule(source,{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
 js=js.replace(/import\s+['"][^'"]+\.css['"];?/g,'');
 for(const match of [...js.matchAll(/from (["'])([^"']+)\1/g)]){
  const name=match[2];let module;
  if(name.endsWith('/api/http')||name==='./http')module=transport;
  else if(name.startsWith('.')){let file;for(const ext of ['.tsx','.ts','.js']){try{await readFile(resolve(dirname(path),name+ext));file=resolve(dirname(path),name+ext);break;}catch{}}if(!file)throw Error(name);module=await compile(file);}
  else module=import.meta.resolve(name);
  js=js.replace(match[0],'from '+JSON.stringify(module));
 }
 const result=data(js);cache.set(path,result);return result;
}
const {default:Reception}=await import(await compile(resolve('src/pages/LabReceptionPage.tsx')));
const {default:Dashboard}=await import(await compile(resolve('src/pages/DashboardPage.tsx')));
const {uniqueAssetRisks,insightLabel}=await import(await compile(resolve('src/utils/aiPresentation.ts')));
const {DashboardBars}=await import(await compile(resolve('src/components/ui/DashboardCharts.tsx')));
const {labSLA}=await import(await compile(resolve('src/utils/labWorkload.ts')));
const {default:AssetCharts}=await import(await compile(resolve('src/components/AssetDistributionCharts.tsx')));
const {default:LabCharts}=await import(await compile(resolve('src/components/LabWorkloadCharts.tsx')));
const {default:ActivityCharts}=await import(await compile(resolve('src/components/LabActivityCharts.tsx')));
const {default:InsightsPage}=await import(await compile(resolve('src/pages/AIPredictionsPage.tsx')));
const {default:TracePage}=await import(await compile(resolve('src/pages/TrazabilidadPage.tsx')));


const {getNavigationForUser}=await import(await compile(resolve('src/app/navigation.ts')));
const reception=()=>({updatedAt:new Date().toISOString(),counts:{camino:1,recibidos:0,hoy:0,pendientes:0,incidencias:0,historial:0},total:1,limit:20,offset:0,items:[{codigo_os:'MV-FIXTURE',tipo_equipo:'VALIDADOR',serie:'7490889',modelo:'CVB45',marca:'Mikroelektronika',falla:'Falla QR',bus_ppu:'BJ2149',terminal:'El Conquistador',operador:'VOYSANTIAGO',codigo_caso:'INT-FIXTURE',fecha_salida:new Date().toISOString(),fecha_evento:new Date().toISOString(),en_camino:true,recibido:false}]});
const dashboard=()=>({updatedAt:new Date().toISOString(),assets:{total:1,validadores:1,consolas:0,operacion:0,disponibles:1,bodega:1,laboratorio:0,qa:0,transito:0,noDisponibles:0},distribution:[{etapa:'DISPONIBLE',label:'Bodega · disponibles',validadores:1,consolas:0,total:1}],transit:[],orders:{activas:0,cerradas:0,fallas:0,instalaciones:0,enRuta:0,retiros:0,recepciones:0,despachos:0},podCases:0,stockAlerts:0,qa:{},lab:{camino:0,recibidos:0,pendientes:0,diagnostico:0,reparacion:0,repuestos:0,salida:0,reingresos:0},labWorkload:[],labTechnicians:[]});
async function mount(Page,role='admin',path='/lab/recepcion'){
 globalThis.__adminLab={reads:[],reception:reception(),dashboard:dashboard(),risks:[],...globalThis.__adminLab};
 function Context(){const location=useLocation();globalThis.__adminLab.location=location;return React.createElement(Outlet,{context:{rol:role}});}
 let render;await act(async()=>{render=Renderer.create(React.createElement(MemoryRouter,{initialEntries:[path],future:{v7_startTransition:true,v7_relativeSplatPath:true}},React.createElement(Routes,null,React.createElement(Route,{element:React.createElement(Context)},React.createElement(Route,{path:'*',element:React.createElement(Page)})))));});return render;
}
const text=render=>JSON.stringify(render.toJSON());
const content=node=>typeof node==='string'||typeof node==='number'?String(node):(node.children||[]).map(content).join('');
const reset=()=>{globalThis.__adminLab={reads:[],reception:reception(),dashboard:dashboard(),risks:[]};};

test('rankings compactos conservan escala, categorías originales y detalle al expandir',async()=>{
 const rows=Array.from({length:10},(_,i)=>({key:String(i),label:`[SIMULACION LOTE-${i}] Falla QR`,...insightLabel(`[SIMULACION LOTE-${i}] Falla QR`),values:[i+1]}));
 let r;await act(async()=>{r=Renderer.create(React.createElement(DashboardBars,{compact:true,title:'Ranking',description:'Fixture',series:[{key:'os',label:'OS',color:'blue'}],rows}));});
 try {
  assert.equal(r.root.findByType('ul').findAllByType('li').length,5);
  assert.equal(r.root.findByType('tbody').findAllByType('tr').length,10);
  assert.match(content(r.root),/Escala común: 0–10/);
  assert.match(content(r.root),/SIMULACION LOTE-9/);
  assert.equal(r.root.findAllByProps({className:'pmp-chart-track'})[0].children[0].props.style.width,'10%');
  await act(async()=>r.root.findByType('button').props.onClick());
  assert.equal(r.root.findByType('ul').findAllByType('li').length,10);
  assert.equal(r.root.findByType('button').props['aria-expanded'],true);
  await act(async()=>r.root.findByType('button').props.onClick());
  assert.equal(r.root.findByType('ul').findAllByType('li').length,5);
 } finally { await act(async()=>r.unmount()); }
});
test('etiquetas de simulación se simplifican sin fusionar registros ni alterar texto real',()=>{
 assert.deepEqual(insightLabel('[SIMULACION LOTE] Audio intermitente'),{displayLabel:'Audio intermitente',annotation:'Simulación'});
 assert.deepEqual(insightLabel('Audio intermitente'),{});
 assert.deepEqual(insightLabel('[Código técnico] Falla'),{});
});
test('prioridad cero es neutral en análisis, y actualización declara su frecuencia real',async()=>{
 reset();globalThis.__adminLab.insights={updatedAt:new Date().toISOString(),summary:{orders:0,assets:0,buses:0,withoutBus:0,simulationOrders:0},faults:[],diagnoses:[],buses:[],components:[]};
 globalThis.__adminLab.risks=[{tipo_equipo:'CONSOLA',serie_equipo:'FIXTURE',fallas_previas:0,riesgo_score:0}];
 const r=await mount(InsightsPage,'gerente','/ia/predicciones');try {
  assert.match(content(r.root),/Sin refresco periódico/);
  assert.match(content(r.root),/Sin señales en estas reglas/);
  assert.equal(r.root.findByProps({className:'ai-risk-row'}).props.style['--risk-color'],'var(--text-secondary)');
 } finally { await act(async()=>r.unmount()); }
});

test('actividad técnica usa semanas/resultados reales y conserva el total de cierres',async()=>{
 let r;await act(async()=>{r=Renderer.create(React.createElement(ActivityCharts,{insights:{finished30Days:3,recurrentAssets:1,frequentFaults:[],closuresByWeek:[{semana:'2026-10-05',total:3}],closureResults:[{resultado:'REPARADO',total:1},{resultado:'NFF',total:1},{resultado:'POD',total:1}]}}));});
 try{assert.match(text(r),/Cierres por semana/);assert.match(text(r),/Desde 05-10-2026: 3/);assert.match(text(r),/Sin falla encontrada/);assert.equal(r.root.findAllByProps({className:'pmp-data-chart'}).length,2);}finally{await act(async()=>r.unmount());}
});
test('menú de Jefatura expone consultas e IA; logística y gerente comparten análisis sin cuentas ajenas',()=>{
 for(const rol of ['jefe_laboratorio','logistica','gerente'])assert.ok(getNavigationForUser({rol}).flatMap(s=>s.items).some(i=>i.id==='ai'));
 const jefe=getNavigationForUser({rol:'jefe_laboratorio'}).flatMap(s=>s.items);
 for(const id of ['orders','equipment','trace'])assert.ok(jefe.some(i=>i.id===id));
 for(const id of ['users','warehouse-operations','qa-summary'])assert.ok(!jefe.some(i=>i.id===id));
 for(const rol of ['qa','tecnico_laboratorio','tecnico_terreno'])assert.ok(!getNavigationForUser({rol}).flatMap(s=>s.items).some(i=>i.id==='ai'));
});
test('análisis compartido muestra patrones, advertencia de simulación y prioridades sin probabilidades ficticias',async()=>{
 reset();globalThis.__adminLab.insights={updatedAt:new Date().toISOString(),summary:{orders:3,assets:2,buses:1,withoutBus:0,simulationOrders:1},faults:[{falla:'Falla QR',total:2}],diagnoses:[{falla:'Lector QR',total:1}],buses:[{ppu:'TEST00',validadores:2,consolas:1,total:3,activos:2}],components:[{referencia:'1',nombre:'Lector QR',ordenes:1,unidades:2}]};
 globalThis.__adminLab.risks=[{tipo_equipo:'VALIDADOR',serie_equipo:'FIXTURE',fallas_previas:1,riesgo_score:.3}];
 const r=await mount(InsightsPage,'logistica','/ia/predicciones');try{
  assert.match(text(r),/TEST00: 3/);assert.match(text(r),/simulación/);assert.match(text(r),/no demuestra causalidad/);assert.match(content(r.root),/30 \/ 100/);assert.match(text(r),/Componentes entregados/);
  const before=globalThis.__adminLab.reads.length;await act(async()=>r.root.findAllByType('button').find(b=>content(b).includes('Actualizar análisis')).props.onClick());assert.equal(globalThis.__adminLab.reads.length,before+2);
 }finally{await act(async()=>r.unmount());}
});
test('error de análisis no se transforma en ausencia de fallas',async()=>{
 reset();globalThis.__adminLab.error=true;const r=await mount(InsightsPage,'gerente','/ia/predicciones');try{assert.match(text(r),/No fue posible consultar los patrones/);assert.doesNotMatch(text(r),/Sin fallas reportadas/);}finally{await act(async()=>r.unmount());}
});

test('gráficos de activos: mezcla por etapa, ceros y consultas mantienen los filtros',async()=>{
 const calls=[];let r;await act(async()=>{r=Renderer.create(React.createElement(AssetCharts,{rows:[{etapa:'OPERACION',label:'En operación',validadores:3,consolas:2,total:5},{etapa:'QA',label:'QA',validadores:0,consolas:0,total:0}],onExplore:f=>calls.push(f),detail:React.createElement('table',null,React.createElement('caption',null,'Detalle original'))}));});
 try{
  const buttons=r.root.findAllByType('button');const stage=buttons.find(b=>b.props['aria-label'].startsWith('En operación:'));
  assert.match(stage.props['aria-label'],/5.*Validadores: 3; Consolas: 2/);
  await act(async()=>stage.props.onClick());await act(async()=>buttons.find(b=>b.props['aria-label']==='Consolas: 2. Consultar').props.onClick());
  assert.deepEqual(calls,[{etapa:'OPERACION'},{tipo:'CONSOLA'}]);assert.match(text(r),/QA: 0/);assert.equal(r.root.findAllByType('details')[0].props.open,undefined);
 }finally{await act(async()=>r.unmount());}
});
test('parque vacío: no genera porcentajes NaN ni gráficos de OS ficticias',async()=>{
 let r;await act(async()=>{r=Renderer.create(React.createElement(AssetCharts,{rows:[],onExplore:()=>assert.fail('No navigation expected'),detail:null}));});
 try{assert.match(text(r),/Sin activos registrados/);assert.doesNotMatch(text(r),/NaN|Infinity/);assert.equal(r.root.findAllByType('svg').filter(s=>s.props.viewBox==='0 0 120 120').length,0);}finally{await act(async()=>r.unmount());}
});
test('carga gráfica y SLA: categorías excluyentes, sin asignar y sin medición',async()=>{
 const at=hours=>new Date(Date.now()-hours*3600000).toISOString();const calls=[];
 const tickets=[{tecnico_laboratorio_id:'t1',tecnico_laboratorio:'Técnico uno',fecha_ingreso_laboratorio:at(1)},{tecnico_laboratorio_id:'t1',tecnico_laboratorio:'Técnico uno',fecha_ingreso_laboratorio:at(60)},{tecnico_laboratorio_id:'t2',tecnico_laboratorio:'Técnico dos',fecha_ingreso_laboratorio:at(90)},{tecnico_laboratorio_id:null,ingreso_legacy:false}];
 let r;await act(async()=>{r=Renderer.create(React.createElement(LabCharts,{tickets,onConsult:q=>calls.push(q)}));});
 try{
  const buttons=r.root.findAllByType('button');assert.ok(buttons.some(b=>b.props['aria-label'].includes('Técnico uno: 2. Dentro de plazo: 1; Próximo a vencer: 1; Vencido: 0; Sin medición: 0')));
  await act(async()=>buttons.find(b=>b.props['aria-label'].startsWith('Sin asignar:')).props.onClick());await act(async()=>buttons.find(b=>b.props['aria-label']==='Vencido: 1. Consultar').props.onClick());
  assert.deepEqual(calls,['tab=pending','tab=all&sla=vencido']);assert.match(text(r),/Sin medición: 1/);
 }finally{await act(async()=>r.unmount());}
});
test('recepción muestra identidad, salida y acción operacional sin escribir',async()=>{reset();const r=await mount(Reception,'jefe_laboratorio');try{assert.match(text(r),/MV-FIXTURE|Falla QR/);assert.match(text(r),/En tránsito hacia Laboratorio/);assert.ok(r.root.findAllByType('a').some(a=>a.props.href==='/lab/custodia/MV-FIXTURE/recepcion'));assert.ok(globalThis.__adminLab.reads.every(x=>x.path==='/api/lab/reception'));}finally{await act(async()=>r.unmount());}});
test('Gerente supervisa sin preparar recepción ni enlace de asignación',async()=>{reset();const r=await mount(Reception,'gerente');try{assert.doesNotMatch(text(r),/Preparar recepción/);assert.ok(!r.root.findAllByType('a').some(a=>/custodia|asignacion/.test(a.props.href)));}finally{await act(async()=>r.unmount());}});
test('búsqueda, tipo y bandeja se envían al backend y mantienen navegación',async()=>{reset();const r=await mount(Reception);try{
 await act(async()=>r.root.findByType('input').props.onChange({target:{value:'7490889'}}));await act(async()=>r.root.findByType('form').props.onSubmit({preventDefault(){}}));
 assert.equal(globalThis.__adminLab.reads.at(-1).params.q,'7490889');
 await act(async()=>r.root.findByType('select').props.onChange({target:{value:'CONSOLA'}}));assert.equal(globalThis.__adminLab.reads.at(-1).params.tipo,'CONSOLA');
 const tab=r.root.findAllByType('button').find(b=>b.props['aria-pressed']!==undefined&&content(b).includes('Incidencias'));await act(async()=>tab.props.onClick());assert.equal(globalThis.__adminLab.reads.at(-1).params.tab,'incidencias');
 }finally{await act(async()=>r.unmount());}});
test('error no se presenta como vacío ni muestra contadores anteriores',async()=>{reset();globalThis.__adminLab.error=true;const r=await mount(Reception);try{assert.match(text(r),/Fixture unavailable/);assert.doesNotMatch(text(r),/Sin equipos en camino|MV-FIXTURE/);}finally{await act(async()=>r.unmount());}});
test('empty real usa mensaje útil y cero real',async()=>{reset();globalThis.__adminLab.reception={...reception(),counts:{camino:0,recibidos:0,hoy:0,pendientes:0,incidencias:0,historial:0},total:0,items:[]};const r=await mount(Reception);try{assert.match(text(r),/Sin equipos en camino/);}finally{await act(async()=>r.unmount());}});
test('dashboard no confunde stock inicial con OS; KPI navega con filtros',async()=>{reset();const r=await mount(Dashboard,'admin','/');try{const cards=r.root.findAllByType('article');const orders=cards.find(c=>content(c).includes('OS activas'));assert.equal(orders.find(n=>n.props.className==='stat-value').children.join(''),'0');const available=cards.find(c=>content(c).includes('Disponibles'));await act(async()=>available.props.onClick());assert.equal(globalThis.__adminLab.location.pathname,'/bodega/dashboard');assert.equal(globalThis.__adminLab.location.search,'?consulta=1&etapa=DISPONIBLE');}finally{await act(async()=>r.unmount());}});
test('IA agrupa tipo + serie con máximo reportado, no cruza tipos ni muta predicciones',()=>{const rows=[{tipo_equipo:'VALIDADOR',serie_equipo:'same',riesgo_score:.3},{tipo_equipo:'VALIDADOR',serie_equipo:'same',riesgo_score:0},{tipo_equipo:'CONSOLA',serie_equipo:'same',riesgo_score:.1}];const copy=structuredClone(rows);assert.equal(uniqueAssetRisks(rows).length,2);assert.equal(uniqueAssetRisks(rows)[0].riesgo_score,.3);assert.deepEqual(rows,copy);});
test('SLA respeta recepción, tránsito y fallback legacy sin cambiar umbrales',()=>{const old=new Date(Date.now()-10*86400000).toISOString();assert.equal(labSLA({fecha:old,en_transito_laboratorio:true}).sinSla,true);assert.equal(labSLA({fecha:old,fecha_ingreso_laboratorio:new Date().toISOString()}).vencido,false);assert.equal(labSLA({fecha:old,ingreso_legacy:true}).vencido,true);});
test('recibidos hoy filtra el historial y cambiar bandeja elimina el filtro temporal',async()=>{
 reset();const r=await mount(Reception);try{
  const card=r.root.findAllByType('article').find(c=>content(c).includes('Recibidos hoy'));
  await act(async()=>card.props.onClick());assert.equal(globalThis.__adminLab.reads.at(-1).params.hoy,'1');assert.equal(globalThis.__adminLab.reads.at(-1).params.tab,'historial');
  const tab=r.root.findAllByType('button').find(b=>b.props['aria-pressed']!==undefined&&content(b).includes('En camino'));
  await act(async()=>tab.props.onClick());assert.equal(globalThis.__adminLab.reads.at(-1).params.hoy,'');
 }finally{await act(async()=>r.unmount());}
});
test('consulta del gerente enlaza historial por tipo y serie, conservando identidad',async()=>{
 reset();const r=await mount(Reception,'gerente');try{
  assert.ok(r.root.findAllByType('a').some(a=>a.props.href==='/trazabilidad?tipo=VALIDADOR&serie=7490889'));
 }finally{await act(async()=>r.unmount());}
});

const {pagedReport}=await import(await compile(resolve('src/utils/pageReports.ts')));
test('Excel integra filtros de consulta en todas las paginas y excluye parametros de pagina visible',async()=>{
 reset();const rows=Array.from({length:203},(_,i)=>({codigo_os:'MC-'+i,serie:'TEST-'+i}));
 globalThis.__adminLab.get=async(path,params)=>{assert.equal(path,'/api/os');assert.equal(params.q,'TEST');assert.equal(params.tipo,'CONSOLA');assert.equal(params.limit,100);return {items:rows.slice(params.offset,params.offset+100),total:rows.length};};
 const sheets=await pagedReport('OS','/api/os',{q:'TEST',tipo:'CONSOLA',offset:80,limit:20}).load();
 assert.equal(sheets[0].rows.length,203);assert.deepEqual(globalThis.__adminLab.reads.map(r=>r.params.offset),[0,100,200]);
});
test('Las descargas se concentran en Reportes, fuera del encabezado operacional',async()=>{
 for(const role of ['admin','gerente','logistica','jefe_laboratorio','tecnico_laboratorio','qa','tecnico_terreno']){reset();const r=await mount(Reception,role);try{assert.doesNotMatch(content(r.root),/Descargar Excel/);}finally{r.unmount();}}
});

test('Excel QA conserva ciclos distintos de la misma OS en todo el historial filtrado',async()=>{
 reset();const rows=Array.from({length:23},(_,i)=>({historial_id:String(i+1),codigo_os:'MC-TEST',etapa:'HISTORIAL'}));
 globalThis.__adminLab.get=async(path,p)=>{assert.equal(p.etapa,'HISTORIAL');return {items:rows.slice((p.page-1)*20,p.page*20),total:23,page_size:20};};
 const result=await pagedReport('QA','/api/qa/dashboard',{etapa:'HISTORIAL'},false,'qa').load();
 assert.equal(result[0].rows.length,23);assert.deepEqual(globalThis.__adminLab.reads.map(r=>r.params.page),[1,2]);
});

for(const role of ['jefe_laboratorio','tecnico_terreno'])test(`historial ${role}: renderiza la proyección técnica sin campos administrativos`,async()=>{
 globalThis.__adminLab={reads:[],get:async()=>({tipo_equipo:'VALIDADOR',serie:'TEST-01',modelo:'CVB45',marca:'Mikroelektronika',estado_actual:'Operativo',intervenciones:[]})};
 const r=await mount(TracePage,role,'/trazabilidad?tipo=VALIDADOR&serie=TEST-01');
 try{assert.match(content(r.root),/Sin fallas ni reparaciones registradas/);assert.match(content(r.root),/TEST-01/);assert.doesNotMatch(content(r.root),/Referencias externas|Historial del caso/);}
 finally{r.unmount();globalThis.__adminLab={};}
});

test('indicadores vacios: no reservan un grafico sin registros',async()=>{
 const {default:Page}=await import(await compile(resolve('src/pages/LabReportesPage.tsx')));
 globalThis.__adminLab={reads:[],get:async()=>({eficienciaSemanal:0,totalReparados:0,totalEnProceso:0,tiempoPromedioHoras:0,fallas:[],porTecnico:[],porTipo:[]})};
 const r=await mount(Page,'admin','/lab/reportes');
 try{assert.equal(r.root.findAll(n=>n.props.className==='empty-state').length,3);assert.equal(r.root.findAll(n=>n.props.className==='recharts-responsive-container').length,0);}
 finally{r.unmount();globalThis.__adminLab={};}
});
