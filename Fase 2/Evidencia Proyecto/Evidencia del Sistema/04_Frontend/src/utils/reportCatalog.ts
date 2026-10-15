import {getExecutiveDashboard, getLabSupervision} from '../api/executive';
import {getOperationalInsights} from '../api/ai';
import {getLabQueue, getCompletedLab} from '../api/lab';
import {getBodegaQueue, getRepuestos} from '../api/bodega';
import {getPendingWithdrawals} from '../api/os';
import {getAssetHistory, getReferences} from '../api/bridge';
import {can, PERMISSIONS as P, type Permission, type RbacUser} from '../app/rbac';
import {canExportReports, type ExcelReport, type ReportSheet} from './excelReport';
import {pagedReport, usersReport, reportSheet, summarySheet} from './pageReports';
import {maintenanceReport} from './maintenanceReport';

export type ReportFilters = Record<string,string>;
export type ReportField = {key:string;label:string;placeholder?:string;required?:boolean;options?:readonly (readonly [string,string])[]};
type Definition = {id:string;title:string;group:string;description:string;permission:Permission;roles?:string[];fields:ReportField[];load:(filters:ReportFilters)=>Promise<ReportSheet[]>};
const q:ReportField={key:'q',label:'Buscar',placeholder:'OS, serie, PPU o texto del registro'};
const type:ReportField={key:'tipo_equipo',label:'Tipo de equipo',options:[['','Todos'],['VALIDADOR','Validador'],['CONSOLA','Consola']]};
const paged=(title:string,url:string,mode:'items'|'data'|'array'|'qa'='items')=>(filters:ReportFilters)=>Promise.resolve(pagedReport(title,url,filters,false,mode).load());
function filterRows<T>(rows:T[],filters:ReportFilters):T[]{
 const term=(filters.q||'').toLocaleLowerCase('es');
 return rows.filter(value=>{const row=value as Record<string,unknown>;return (!filters.tipo_equipo||(row.tipo_equipo??row.categoria)===filters.tipo_equipo)&&(!term||Object.values(row).some(v=>typeof v==='string'&&v.toLocaleLowerCase('es').includes(term)));});
}
const catalog:Definition[]=[
 {id:'executive',title:'Resumen ejecutivo',group:'Gestión',permission:P.DASHBOARD_VIEW,roles:['admin','gerente'],fields:[],description:'Indicadores globales, distribución de activos y carga de laboratorio.',load:async()=>{const d=await getExecutiveDashboard();return [summarySheet('Indicadores',d),reportSheet('Distribución',d.distribution),reportSheet('Carga laboratorio',d.labWorkload)];}},
 {id:'maintenance',title:'Análisis de fallas y mantenimiento',group:'Gestión',permission:P.AI_VIEW,fields:[{...q,label:'Filtrar recurrencia e intervenciones',placeholder:'Tipo o serie'}],description:'Recurrencia, intervenciones, repuestos, resultados y acciones preventivas. Incluye el método y sus limitaciones.',load:async f=>maintenanceReport(await getOperationalInsights(),f.q)},
 {id:'orders',title:'Órdenes de servicio',group:'Operación',permission:P.OS_VIEW,fields:[q,type],description:'Todas las OS coincidentes con la búsqueda y el tipo seleccionado.',load:paged('Órdenes de servicio','/api/os')},
 {id:'operating',title:'Equipos en operación',group:'Operación',permission:P.EQUIPOS_VIEW,fields:[q],description:'Activos instalados y operativos, con su contexto vigente.',load:paged('Equipos en operación','/api/dashboard/equipos-operativos','data')},
 {id:'assets',title:'Maestro de activos',group:'Operación',permission:P.ASSET_MANAGE,fields:[q,type],description:'Identidad, modelo y estado de los activos registrados.',load:paged('Maestro de activos','/api/activos','array')},
 {id:'withdrawals',title:'Retiros de terreno',group:'Operación',permission:P.WITHDRAWAL_ASSIGN,fields:[q,type],description:'Retiros pendientes y técnico asignado. Descargar no confirma un retiro.',load:async f=>[reportSheet('Retiros pendientes',filterRows(await getPendingWithdrawals(),f))]},
 {id:'inventory',title:'Inventario de equipos',group:'Bodega',permission:P.BODEGA_VIEW,fields:[q,{...type,key:'tipo'},{key:'etapa',label:'Etapa / disponibilidad',options:[['','Todas'],['DISPONIBLE','Listos para instalación'],['BODEGA','En Bodega · no disponibles'],['VALIDACION','Pendientes de validación']]}],description:'Todos los activos que coinciden con los filtros, sin limitarse a la página visible.',load:paged('Inventario de equipos','/api/bodega/inventario')},
 {id:'warehouse',title:'Recepciones y despachos',group:'Bodega',permission:P.BODEGA_OPERATIONS_VIEW,fields:[q,type],description:'Cola logística actual, con estado y contexto de cada equipo.',load:async f=>[reportSheet('Recepciones y despachos',filterRows(await getBodegaQueue(),f))]},
 {id:'parts',title:'Repuestos y stock',group:'Bodega',permission:P.BODEGA_OPERATIONS_VIEW,fields:[q,type,{key:'stock',label:'Disponibilidad',options:[['','Todo el stock'],['critical','En o bajo el umbral crítico'],['empty','Sin stock']]}],description:'Existencias actuales y umbrales de reposición registrados.',load:async f=>{const d=await getRepuestos();return [reportSheet('Repuestos',filterRows(d.repuestos,f).filter(p=>!f.stock||(f.stock==='empty'?p.stock===0:p.stock<=p.stock_critico)))];}},
 {id:'part-requests',title:'Solicitudes de repuestos',group:'Bodega',permission:P.BODEGA_OPERATIONS_VIEW,fields:[q,type],description:'Solicitudes registradas y su estado actual.',load:async f=>[reportSheet('Solicitudes',filterRows((await getRepuestos()).solicitudes,f))]},
 {id:'lab-summary',title:'Supervisión de laboratorio',group:'Laboratorio',permission:P.REPORTS_VIEW,fields:[],description:'Indicadores, SLA, carga por técnico y actividad registrada.',load:async()=>{const d=await getLabSupervision();return [summarySheet('Indicadores',d),reportSheet('Carga',d.labWorkload),reportSheet('Técnicos',d.labTechnicians)];}},
 {id:'lab-load',title:'Carga de laboratorio',group:'Laboratorio',permission:P.LAB_VIEW,fields:[q,type],description:'Carga activa físicamente recibida en laboratorio.',load:async f=>{const types=f.tipo_equipo?[f.tipo_equipo as 'VALIDADOR'|'CONSOLA']:['VALIDADOR','CONSOLA'] as const;const rows=(await Promise.all(types.map(t=>getLabQueue(t)))).flat();return [reportSheet('Carga de laboratorio',filterRows(rows,f))];}},
 {id:'lab-reception',title:'Recepción de laboratorio',group:'Laboratorio',permission:P.REPORTS_VIEW,fields:[q,{...type,key:'tipo'},{key:'tab',label:'Bandeja',required:true,options:[['camino','En camino'],['recibidos','Recibidos'],['incidencias','Incidencias'],['historial','Historial']]}],description:'Consulta de recepciones y equipos en camino. No confirma movimientos físicos.',load:paged('Recepción de laboratorio','/api/lab/reception')},
 {id:'lab-completed',title:'Listos para salida de laboratorio',group:'Laboratorio',permission:P.LAB_VIEW,fields:[q,type],description:'Equipos finalizados que esperan su salida física.',load:async f=>[reportSheet('Listos para salida',filterRows(await getCompletedLab(),f))]},
 {id:'qa',title:'Supervisión QA',group:'Calidad',permission:P.QA_SUMMARY_VIEW,fields:[q,{key:'etapa',label:'Etapa',required:true,options:[['RECEPCION','Recepción'],['AMBIENTE','Instalación Ambiente'],['PRUEBAS','Pruebas'],['DESPACHO','Despacho'],['POR_VERIFICAR','Por verificar'],['HISTORIAL','Historial']]}],description:'Registros de la etapa QA elegida, incluyendo todas sus páginas.',load:paged('Supervisión QA','/api/qa/dashboard','qa')},
 {id:'history',title:'Historial de un activo',group:'Trazabilidad',permission:P.TRACE_VIEW,fields:[{...type,required:true,options:type.options!.slice(1)},{key:'serie',label:'Serie exacta',required:true,placeholder:'Serie del equipo'}],description:'Órdenes, eventos y referencias del activo. Excluye metadatos sensibles.',load:async f=>{const d=await getAssetHistory({tipo_equipo:f.tipo_equipo as 'VALIDADOR'|'CONSOLA',serie:f.serie});return [reportSheet('Equipo',[d]),reportSheet('Órdenes',d.ordenes),reportSheet('Eventos',d.eventos),reportSheet('Referencias',d.referencias)];}},
 {id:'references',title:'Referencias externas',group:'Trazabilidad',permission:P.BRIDGE_FLOW_VIEW,fields:[q,type],description:'Vínculos existentes entre activos, OS y referencias externas.',load:async f=>[reportSheet('Referencias',filterRows(await getReferences(),f))]},
 {id:'users',title:'Usuarios y accesos',group:'Administración',permission:P.USERS_VIEW,fields:[{...q,placeholder:'Nombre, correo o rol'}],description:'Datos de administración autorizados. Nunca incluye credenciales ni UID Firebase.',load:async f=>usersReport(f.q||'').load()},
];
export function availableReports(user:RbacUser){
 const role=user?.rol??user?.roles?.[0];
 return canExportReports(role||'')?catalog.filter(d=>can(user,d.permission)&&(!d.roles||d.roles.includes(role||''))):[];
}
export function createCatalogReport(id:string,values:ReportFilters,user:RbacUser):ExcelReport{
 const definition=availableReports(user).find(d=>d.id===id);
 if(!definition)throw Error('Este informe no está disponible para tu rol.');
 const filters:ReportFilters={};
 for(const field of definition.fields){const value=(values[field.key]||'').trim();if(field.required&&!value)throw Error(`Completa ${field.label.toLowerCase()}.`);if(field.options&&!field.options.some(([key])=>key===value))throw Error(`Selecciona una opción válida para ${field.label.toLowerCase()}.`);if(value)filters[field.key]=value;}
 return {title:definition.title,filters,load:()=>definition.load(filters)};
}
