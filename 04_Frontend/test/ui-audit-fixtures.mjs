// Presentation fixtures only. Never persisted or sent to an application service.
export const supplementalMock = `
const stamp='2026-10-12T12:00:00Z';
const summary={updatedAt:stamp,assets:{total:2,validadores:1,consolas:1,operacion:1,disponibles:1,bodega:1,laboratorio:0,qa:0,transito:0,noDisponibles:0},distribution:[{etapa:'OPERACION',label:'En operación',validadores:1,consolas:0,total:1}],transit:[],orders:{activas:1,cerradas:1,fallas:1,instalaciones:0,enRuta:0,retiros:0,recepciones:0,despachos:0},podCases:0,stockAlerts:1,qa:{RECEPCION:0,AMBIENTE:0,PRUEBAS:0,DESPACHO:0},labInsights:{recurrentAssets:0,frequentFaults:[{falla:'Lectura intermitente',total:1}],finished30Days:1,closuresByWeek:[{semana:'2026-10-05',total:1}],closureResults:[{resultado:'REPARADO',total:1}]},lab:{camino:0,recibidos:1,pendientes:1,diagnostico:1,reparacion:0,repuestos:0,salida:0,reingresos:0},labWorkload:[ticket],labTechnicians:[{tecnico_laboratorio_id:'fixture',tecnico_laboratorio:'Persona de prueba',total:1,listos:0}]};
const zero=value=>Array.isArray(value)?[]:value&&typeof value==='object'?Object.fromEntries(Object.entries(value).map(([k,v])=>[k,zero(v)])):typeof value==='number'?0:value;
async function supplement(path,options={}) {
 if(path==='/api/bodega/queue'&&location.hash.includes('/bodega/envios-'))return [{...ticket,estado_id:3,fue_laboratorio:location.hash.includes('envios-qa'),es_aprobado_qa:null}];
 if(path==='/api/ai/operational-insights')return {analysis:{updatedAt:stamp,assets:[{tipo:'VALIDADOR',serie:'TEST-01',failures:1,simulationFailures:0,firstFailure:stamp,lastFailure:stamp,medianDays:null,intervals:0,reportedFault:'Lectura intermitente',diagnosis:'Lector QR',result:'REPARADO',incidents:[],estimate:null}],parts:[{nombre:'Lector QR',tipo:'VALIDADOR',stock:0,critical:2,units90:1,realUnits90:1,simulationUnits90:0,deliveries90:1,dailyRate:null,coverageDays:null,depletionDate:null,suggestedUnits30:null,minimumGap:2,leadTimeDays:null}],outcomes:[{label:'REPARADO',total:1}],incidents:[],diagnostics:[],alerts:[],method:{prediction:'Sin estimacion',partsWindowDays:90,minimumIntervals:3,minimumHistoryDays:30,intervalDefinition:'Intervalos registrados.',partDefinition:'Salidas registradas.',outcomeDefinition:'Resultados registrados.',purchaseDefinition:'Referencia de stock.'}},updatedAt:stamp,summary:{orders:1,assets:1,buses:1,withoutBus:0,simulationOrders:0},buses:[{ppu:'TEST01',validadores:1,consolas:0,total:1,activos:1}],faults:[{falla:'Lectura intermitente',total:1}],diagnoses:[{falla:'Lector QR',total:1}],components:[{referencia:'1',nombre:'Lector QR',ordenes:1,unidades:1}]};
 if(path==='/api/dashboard/executive'||path==='/api/lab/supervision')return summary;
 if(path==='/api/lab/reportes')return {eficienciaSemanal:50,totalReparados:1,totalEnProceso:1,tiempoPromedioHoras:12,fallas:[{name:'Lectura intermitente',cantidad:1}],porTecnico:[{name:'Persona de prueba',cantidad:1}],porTipo:[{name:'Validador',value:1}]};
 if(path==='/api/os')return {items:[ticket],pagination:{total:1,limit:25,offset:0}};
 if(path==='/api/os/mis-ordenes')return [ticket];
 if(path.startsWith('/api/os/')&&!path.includes('pendientes')&&!path.includes('activos'))return ticket;
 if(path.startsWith('/api/lab/custody/'))return {...ticket,estado_id:4,en_camino_laboratorio:true,disponible_laboratorio:true};
 if(path==='/api/lab/reception')return {updatedAt:stamp,counts:{camino:1,recibidos:0,hoy:0,pendientes:0,incidencias:0,historial:0},items:[{...ticket,fecha_salida:stamp,en_camino:true,recibido:false}],total:1,limit:20,offset:0};
 if(path==='/api/bodega/stock')return {listos:[ticket],inventario:{total:1,validadores:1,consolas:0}};
 if(path==='/api/bodega/repuestos')return {repuestos:[{id:1,nombre:'Lector QR',categoria:'VALIDADOR',stock:0,stock_critico:2}],solicitudes:[{id:1,codigo_os:'MV-TEST',repuesto_solicitado:'Lector QR',estado:'PENDIENTE',fecha_solicitud:stamp}]};
 if(path==='/api/bodega/qa-users')return [{id:'fixture',nombre:'Persona',apellido:'Prueba'}];
 if(path==='/api/bodega/despacho/destinos')return [{bus_ppu:'TEST01',terminal_id:1,terminal:'Terminal de prueba',pst_codigo:'TEST',operador:'Operador de prueba'}];
 if(path==='/api/master/terminales')return [{id:1,nombre:'Terminal de prueba'}];
 if(path==='/api/master/psts')return [{codigo:'TEST',nombre:'Operador de prueba'}];
 if(path==='/api/requerimientos')return [];
 if(path==='/api/activos'||path==='/api/bridge/buscar')return [ticket];
 if(path==='/api/requerimientos/operativos'||path==='/api/requerimientos/buses'||path==='/api/os/activos-operativos')return {items:[ticket],has_more:false,total:1,limit:20,offset:0};
 if(path==='/api/ai/predictive-report')return [{tipo_equipo:'VALIDADOR',serie_equipo:ticket.serie,riesgo_score:0,fallas_previas:0}];
 if(path.endsWith('/historial')&&['jefe_laboratorio','tecnico_terreno'].includes(window.__auditRole))return {...ticket,estado_actual:'Operativo',intervenciones:[{codigo_os:'MV-TEST',fecha:stamp,falla_reportada:'Lectura intermitente',diagnostico:'Lector QR',trabajo_realizado:'Limpieza',resultado:'Reparado',pendiente:false,observaciones:[]}]};
 return undefined;
}
const originalRead=api.get;
api.get=async(path,options={})=>{
 const mode=new URLSearchParams(location.hash.split('?')[1]).get('mode')||window.__auditMode;
 if(path==='/api/dashboard/badges')return originalRead(path,options);
 if(mode==='loading'){window.__reads.push(path);return new Promise(()=>{});}
 if(mode==='error')return originalRead(path,options);
 const extra=await supplement(path,options);
 let result;
 if(extra!==undefined){window.__reads.push(path);result={data:extra};}
 else {try {result=await originalRead(path,options);}catch(e){window.__uncovered.push(path);throw e;}}
 if(path.startsWith('/api/qa/')&&path.endsWith('/work')){const step=location.hash.split('?')[0].split('/').at(-1).toUpperCase();if(['RECEPCION','AMBIENTE','PRUEBAS','DESPACHO'].includes(step)){result.data.etapa=step;result.data.trabajo.etapa=step;}}
 if(mode==='empty')return {data:zero(result.data)};
 return result;
};
`;
