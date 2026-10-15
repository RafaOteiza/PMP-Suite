import type {OperationalInsights} from '../api/ai';
import {reportSheet,summarySheet,type ReportSheet} from './excelReport';
export function maintenanceReport(data:OperationalInsights,assetQuery=''):ReportSheet[]{
 const original=data.analysis;
 const a=original?{...original,assets:original.assets.filter(v=>`${v.tipo} ${v.serie}`.toLocaleLowerCase('es').includes(assetQuery.toLocaleLowerCase('es')))}:undefined;
 const sheets=[summarySheet('Cobertura',data.summary),reportSheet('Fallas por bus',data.buses),reportSheet('Entregas por componente',data.components)];
 if(!a)return [...sheets,reportSheet('Fallas (ranking)',data.faults),reportSheet('Diagnósticos (ranking)',data.diagnoses)];
 return [...sheets,
 {name:'Recurrencia',rows:a.assets.map(v=>({Tipo:v.tipo,Serie:v.serie,Reportes:v.failures,Simulados:v.simulationFailures,'Primera falla':v.firstFailure,'Última falla':v.lastFailure,'Falla reportada':v.reportedFault,'Diagnóstico registrado':v.diagnosis,'Último resultado':v.result,'Intervalos observados':v.intervals,'Mediana días entre reportes':v.medianDays,'Intervalos reales para referencia':v.estimate?.intervals??0,'Referencia mínima días':v.estimate?.minDays??null,'Referencia máxima días':v.estimate?.maxDays??null,'Predicción individual':'Modelo no entrenado; la referencia histórica no predice una fecha'}))},
 {name:'Intervenciones',rows:a.assets.flatMap(v=>v.incidents.map(i=>({Tipo:v.tipo,Serie:v.serie,OS:i.os,Fecha:i.fecha,PPU:i.bus,Falla:i.falla})))},
 {name:'Repuestos y reposición',rows:a.parts.map(p=>({Repuesto:p.nombre,Tipo:p.tipo,Stock:p.stock,Umbral:p.critical,'Unidades 90 días':p.units90,'Unidades reales':p.realUnits90,'Unidades simuladas':p.simulationUnits90,'Salidas por día (referencia)':p.dailyRate,'Cobertura orientativa días':p.coverageDays,'Agotamiento orientativo':p.depletionDate,'Unidades sugeridas 30 días':p.suggestedUnits30,'Brecha al umbral':p.minimumGap,'Plazo proveedor':'No registrado; confirmar antes de comprar'}))},
 reportSheet('Resultados por equipo',a.outcomes),reportSheet('Incidencias completas',a.incidents),reportSheet('Diagnósticos completos',a.diagnostics),
 {name:'Acciones preventivas',rows:a.alerts.map(r=>({Prioridad:r.tone,Asunto:r.subject,Evidencia:r.evidence,Acción:r.action}))},summarySheet('Método y limitaciones',a.method)];
}
