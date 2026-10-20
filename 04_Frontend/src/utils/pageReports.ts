import {api} from '../api/http';
import {collectReportPages,reportSheet,summarySheet,type ExcelReport,type ReportSheet} from './excelReport';
type Params=Record<string,unknown>;
export function localReport(title:string,rows:unknown[],disabled=false,filters:Params={}):ExcelReport {
 return {title,disabled,filters,load:()=>[reportSheet(title,rows)]};
}
export function sheetsReport(title:string,sheets:ReportSheet[],disabled=false,filters:Params={}):ExcelReport {
 return {title,disabled,filters,load:()=>sheets};
}
export function pagedReport(title:string,url:string,filters:Params,disabled=false,mode:'items'|'data'|'array'|'qa'='items'):ExcelReport {
 const params={...filters};delete params.offset;delete params.page;delete params.limit;
 return {title,disabled,filters:params,load:async()=>{
  const rows=await collectReportPages<Record<string,unknown>>(async offset=>{
   const {data}=await api.get(url,{params:{...params,...(mode==='qa'?{page:Math.floor(offset/20)+1}:{limit:100,offset})}});
   const items=mode==='array'?data:mode==='data'?data.data:data.items;
   if(!Array.isArray(items))throw Error('La respuesta no tiene el formato esperado. No se generó un Excel parcial.');
   const total=data.pagination?.total??data.totalFiltrado??data.total;
   return {items,total:typeof total==='number'?total:undefined,hasMore:typeof data.has_more==='boolean'?data.has_more:items.length?undefined:false};
  },r=>String(r.historial_id??r.id??r.codigo_os??`${r.tipo_equipo??r.tipo}:${r.serie}`));
  return [reportSheet(title,rows)];
 }};
}
export {reportSheet,summarySheet};
export function usersReport(q:string,disabled=false):ExcelReport {
 return {title:'Usuarios',filters:{q},disabled,load:async()=>{
  const users=await collectReportPages<Record<string,unknown>>(async offset=>{const {data}=await api.get('/api/users',{params:{limit:100,offset}});if(!Array.isArray(data.items))throw Error('No se pudo completar la consulta de usuarios.');return {items:data.items};},u=>String(u.id));
  const term=q.toLowerCase();return [reportSheet('Usuarios',users.filter(u=>`${u.nombre} ${u.apellido}`.toLowerCase().includes(term)||String(u.correo||'').toLowerCase().includes(term)||String(u.rol||'').toLowerCase().includes(term)))];
 }};
}
