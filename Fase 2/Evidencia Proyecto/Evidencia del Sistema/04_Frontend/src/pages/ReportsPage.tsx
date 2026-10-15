import {useState} from 'react';
import {Link, Navigate, useOutletContext} from 'react-router-dom';
import {FileSpreadsheet} from 'lucide-react';
import type {Me} from '../api/me';
import {can, PERMISSIONS} from '../app/rbac';
import {availableReports,createCatalogReport,type ReportFilters} from '../utils/reportCatalog';
import {canExportReports} from '../utils/excelReport';
import PageHeader from '../components/ui/PageHeader';
import ExcelExportButton from '../components/ui/ExcelExportButton';
import FeedbackBanner from '../components/ui/FeedbackBanner';
import '../styles/reports.css';

export default function ReportsPage(){
 const me=useOutletContext<Me|null>();
 const reports=availableReports(me);
 const [busy,setBusy]=useState(false);
 const [selected,setSelected]=useState(''),[filters,setFilters]=useState<ReportFilters>({});
 if(!canExportReports(me?.rol))return <Navigate to="/403" replace/>;
 const definition=reports.find(r=>r.id===selected);
 const choose=(id:string)=>{setSelected(id);const next=reports.find(r=>r.id===id);setFilters(Object.fromEntries((next?.fields||[]).map(f=>[f.key,f.options?.[0]?.[0]||''])));};
 let report,validation='';
 if(definition){try{report=createCatalogReport(definition.id,filters,me);}catch(e){validation=e instanceof Error?e.message:'Revisa los filtros.';}}
 const groups=[...new Set(reports.map(r=>r.group))];
 return <div className="page reports-page">
  <PageHeader eyebrow="Informes y consultas" title="Centro de reportes" description="Elige la información que necesitas presentar y descarga tu informe en Excel." icon={<FileSpreadsheet size={21}/>}/>
  <section className="panel reports-workspace" aria-label="Preparar informe">
   <div className="reports-selection">
    <h2 className="section-title">1. Selecciona un informe</h2>
    <label htmlFor="report-selection">Información a descargar</label>
    <select id="report-selection" disabled={busy} className="input" value={selected} onChange={e=>choose(e.target.value)}>
     <option value="">Selecciona un informe</option>
     {groups.map(group=><optgroup key={group} label={group}>{reports.filter(r=>r.group===group).map(r=><option key={r.id} value={r.id}>{r.title}</option>)}</optgroup>)}
    </select>
    <p className="muted">Solo aparecen informes autorizados para tu rol.</p>
    {can(me,PERMISSIONS.REPORTS_VIEW)&&<Link className="btn ghost" to="/lab/reportes">Ver indicadores de laboratorio</Link>}
   </div>
   <div className="reports-options">
    <h2 className="section-title">2. Define el contenido</h2>
    {definition?<>
     <p>{definition.description}</p>
     <div className="reports-filters">{definition.fields.map(field=><div className="reports-field" key={field.key}>
      <label htmlFor={`report-${field.key}`}>{field.label}{field.required?' *':''}</label>
      {field.options?<select className="input" disabled={busy} id={`report-${field.key}`} value={filters[field.key]||''} onChange={e=>setFilters({...filters,[field.key]:e.target.value})} required={field.required}>{field.options.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select>:
       <input className="input" disabled={busy} id={`report-${field.key}`} value={filters[field.key]||''} placeholder={field.placeholder} onChange={e=>setFilters({...filters,[field.key]:e.target.value})} required={field.required}/>}
     </div>)}</div>
     {!definition.fields.length&&<p className="muted">Este informe consolida los indicadores actuales; no requiere filtros.</p>}
     <div className="reports-download">
      <span className="status-badge" data-tone="primary">Excel · .xlsx</span>
      <p className="small muted">Todos los registros que coincidan con estos filtros. La consulta se realiza al descargar.</p>
      {validation?<><p className="small" role="status">{validation}</p><button className="btn" disabled><FileSpreadsheet size={16}/> Descargar Excel</button></>:report&&<ExcelExportButton key={JSON.stringify([selected,filters])} primary report={report} onBusyChange={setBusy}/>}
     </div>
    </>:<div className="reports-placeholder"><FileSpreadsheet size={32} aria-hidden="true"/><p>Selecciona un informe para ver sus filtros y opciones de descarga.</p></div>}
   </div>
  </section>
  <FeedbackBanner tone="info">Consultas de solo lectura. Descargar un informe no modifica equipos, órdenes ni movimientos.</FeedbackBanner>
 </div>;
}
