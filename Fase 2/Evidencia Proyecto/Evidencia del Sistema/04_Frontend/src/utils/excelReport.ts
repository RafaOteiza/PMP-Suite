export type ReportRow = Record<string, string | number | boolean | null>;
export type ReportSheet = {name:string;rows:ReportRow[]};
export type ExcelReport = {title:string;filters?:Record<string,unknown>;load:()=>Promise<ReportSheet[]>|ReportSheet[];disabled?:boolean};
export const canExportReports = (role?:string) => ['admin','gerente','jefe_laboratorio','logistica'].includes(role||'');

// Allowlist: never export raw event metadata, authentication identifiers, images or password fields.
const labels:Record<string,string>={falla_reportada:'Falla reportada',diagnostico:'Diagnostico',trabajo_realizado:'Trabajo realizado',pendiente:'Pendiente',ultima_operacion:'Ultima operacion',ubicacion_nombre:'Ubicacion',ultima_os:'Ultima OS',creado_en:'Fecha registro',value:'Cantidad',metodo:'Metodo',observacion:'Observacion',etapa:'Etapa',dictamen:'Dictamen QA',tecnico_qa:'Tecnico QA',fecha_etapa:'Fecha etapa',fecha_recepcion_qa:'Recepcion QA',serie_origen:'Serie de origen',fecha_requerimiento:'Fecha del requerimiento',codigo_os:'OS PMP',tipo_equipo:'Tipo',tipo:'Tipo',serie:'Serie',serie_equipo:'Serie',validador_serie:'Serie validador',consola_serie:'Serie consola',modelo:'Modelo',marca:'Marca',bus_ppu:'PPU',ppu:'PPU',terminal:'Terminal',operador:'Operador',nombre:'Nombre',apellido:'Apellido',correo:'Correo',rol:'Rol',activo:'Activo',estado:'Estado',estado_actual:'Estado',estado_nombre:'Estado',estado_operacional:'Estado operacional',ubicacion:'Ubicación',falla:'Falla reportada',fecha:'Fecha',fecha_ingreso:'Fecha ingreso',fecha_ingreso_laboratorio:'Ingreso laboratorio',fecha_salida:'Fecha salida',fecha_evento:'Fecha evento',origen:'Origen',disponible:'Disponible',validacion_inicial_conforme:'Validación inicial',origen_captura:'Método de captura',tecnico_laboratorio:'Técnico laboratorio',tecnico_terreno:'Técnico terreno',tecnico:'Técnico',codigo_caso:'Caso',referencia_ar:'Referencia AR',referencia_externa:'Referencia externa',sistema_externo:'Sistema externo',categoria:'Categoría',stock:'Stock',stock_critico:'Umbral crítico',repuesto_solicitado:'Repuesto solicitado',fecha_solicitud:'Fecha solicitud',fecha_despacho:'Fecha despacho',comentario:'Observación',total:'Total',cantidad:'Cantidad',name:'Categoría',label:'Categoría',validadores:'Validadores',consolas:'Consolas',activos:'Activos',ordenes:'Órdenes',unidades:'Unidades',resultado:'Resultado',semana:'Semana',evento:'Evento',titulo:'Evento',descripcion:'Descripción',resumen:'Resumen'};
export function reportRows(values:unknown[]):ReportRow[]{return values.map(value=>{
 const row:ReportRow={};if(!value||typeof value!=='object')return row;
 for(const [key,label] of Object.entries(labels)){const v=(value as Record<string,unknown>)[key];if(v===null||['string','number','boolean'].includes(typeof v))row[label]=v as ReportRow[string];}
 return row;
});}
export function reportSheet(name:string,rows:unknown[]):ReportSheet{return {name,rows:reportRows(rows)};}
export function summarySheet(name:string,value:unknown):ReportSheet {
 const rows:ReportRow[]=[];
 const visit=(v:unknown,path:string)=>{if(v&&typeof v==='object'&&!Array.isArray(v)){for(const [k,child]of Object.entries(v))if(!/password|token|firebase|uid|secret|metadata|fotograf|evidenc|firma|^id$|_id$/i.test(k))visit(child,path?`${path} / ${labels[k]||k}`:labels[k]||k);}else if(v===null||['string','number','boolean'].includes(typeof v))rows.push({Indicador:path,Valor:v as ReportRow[string]});};
 visit(value,'');return {name,rows};
}
export async function collectReportPages<T>(fetchPage:(offset:number)=>Promise<{items:T[];total?:number;hasMore?:boolean}>,key:(item:T)=>string):Promise<T[]> {
 const result:T[]=[],seen=new Set<string>();let expected:number|undefined;
 for(let page=0;page<10000;page++){
  const next=await fetchPage(result.length);
  if(next.total!==undefined){if(expected!==undefined&&expected!==next.total)throw Error('Los datos cambiaron durante la exportación. Vuelve a intentarlo.');expected=next.total;}
  if(!next.items.length){if(next.hasMore||expected!==undefined&&result.length<expected)throw Error('La consulta devolvió un informe incompleto.');return result;}
  for(const item of next.items){const id=key(item);if(seen.has(id))throw Error('La paginación devolvió registros repetidos. No se descargó un informe parcial.');seen.add(id);result.push(item);}
  if(expected!==undefined&&result.length>=expected){if(result.length!==expected)throw Error('El total cambió durante la exportación.');return result;}
  if(next.hasMore===false)return result;
 }
 throw Error('La consulta excede el tamaño seguro de exportación. Acota los filtros.');
}
export async function downloadExcel(report:ExcelReport,role:string){
 if(!canExportReports(role))throw Error('Tu rol no tiene habilitada la exportación de informes.');
 if(report.disabled)throw Error('Espera a que termine la consulta antes de exportar.');
 const sheets=await report.load();
 const XLSX=await import('xlsx'),book=buildExcelWorkbook(XLSX,report,sheets);
 XLSX.writeFile(book,`PMP_${report.title.replace(/[^\p{L}\p{N}]+/gu,'_')}_${new Date().toISOString().slice(0,10)}.xlsx`);
}
export function buildExcelWorkbook(XLSX:typeof import('xlsx'),report:Pick<ExcelReport,'title'|'filters'>,sheets:ReportSheet[]){
 const book=XLSX.utils.book_new();
 const metadata:ReportRow[]=[{Campo:'Informe',Valor:report.title},{Campo:'Generado',Valor:new Date().toISOString()},{Campo:'Alcance',Valor:'Todos los registros coincidentes con los filtros; consulta de solo lectura.'},...Object.entries(report.filters||{}).map(([k,v])=>({Campo:`Filtro: ${k}`,Valor:String(v??'')}))];
 const used=new Set<string>();
 for(const sheet of [{name:'Información',rows:metadata},...sheets]){
  let name=sheet.name.replace(/[\\/?*\[\]:]/g,' ').slice(0,31)||'Datos';let i=1;const base=name;while(used.has(name))name=base.slice(0,26)+' '+i++;used.add(name);
  const ws=XLSX.utils.json_to_sheet(sheet.rows.length?sheet.rows:[{Información:'Sin registros para estos filtros'}]);
  // Explicit string cells prevent formula injection and retain long serial numbers exactly.
  for(const [address,cell]of Object.entries(ws)){if(address.startsWith('!'))continue;const c=cell as {v:unknown;t:string;f?:string};if(typeof c.v==='string'){c.t='s';delete c.f;}}
  const columns=Object.keys(sheet.rows[0]||{Información:0});ws['!cols']=columns.map(()=>({wch:28}));
  if(ws['!ref'])ws['!autofilter']={ref:ws['!ref']};
  XLSX.utils.book_append_sheet(book,ws,name);
 }
 return book;
}
