import {sheetsReport,summarySheet,reportSheet} from '../utils/pageReports';
import {useEffect,useState} from 'react';
import {FileText,RefreshCw} from 'lucide-react';
import {getLabSupervision,type LabSupervision} from '../api/executive';
import PageHeader from './ui/PageHeader';
import StatCard from './ui/StatCard';
import EmptyState from './ui/EmptyState';
import FeedbackBanner from './ui/FeedbackBanner';
export default function LabSupervisionReport(){
 const [data,setData]=useState<LabSupervision|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(true);
 const load=async()=>{setBusy(true);setError('');try{setData(await getLabSupervision());}catch{setError('No se pudo consultar el reporte de Laboratorio.');}finally{setBusy(false);}};
 useEffect(()=>{void load();},[]);
 return <div className="page role-dashboard-page"><PageHeader report={sheetsReport('Reportes laboratorio',[summarySheet('Indicadores',data),reportSheet('Fallas',data?.labInsights.frequentFaults||[]),reportSheet('Semanas',data?.labInsights.closuresByWeek||[]),reportSheet('Resultados',data?.labInsights.closureResults||[])],busy||!!error)} title="Reportes de Laboratorio" description="Actividad registrada, carga recibida y recurrencia técnica." icon={<FileText size={21}/>} actions={<button className="btn ghost" onClick={load} disabled={busy}><RefreshCw size={16}/> Actualizar</button>}/>
 {busy?<p role="status">Consultando reporte…</p>:error?<FeedbackBanner tone="danger">{error}</FeedbackBanner>:data&&<><p className="small muted">Actualizado {new Date(data.updatedAt).toLocaleString('es-CL')}</p><section className="assignment-stats"><StatCard label="Cierres técnicos" value={data.labInsights.finished30Days} detail="Últimos 30 días · OS y ciclo" icon={<FileText size={18}/>}/><StatCard label="Carga recibida" value={data.lab.recibidos} detail="Excluye equipos en tránsito" icon={<FileText size={18}/>}/><StatCard label="Activos con recurrencia" value={data.labInsights.recurrentAssets} detail="Más de una OS registrada en Laboratorio" icon={<FileText size={18}/>}/></section><section className="panel"><h2 className="section-title">Fallas reportadas más frecuentes</h2><p className="small muted">Historial de OS con ingreso a Laboratorio. Los cierres técnicos incluyen NFF y PoD; no equivalen únicamente a reparaciones.</p>{data.labInsights.frequentFaults.length?<div className="table-wrap"><table><thead><tr><th>Falla</th><th>OS</th></tr></thead><tbody>{data.labInsights.frequentFaults.map(f=><tr key={f.falla}><td>{f.falla}</td><td>{f.total}</td></tr>)}</tbody></table></div>:<EmptyState icon={<FileText size={24}/>} title="Sin fallas registradas"/>}</section></>}
 </div>;
}
