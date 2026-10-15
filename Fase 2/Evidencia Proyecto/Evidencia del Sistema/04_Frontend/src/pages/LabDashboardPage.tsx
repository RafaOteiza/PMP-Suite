import {sheetsReport,reportSheet,summarySheet} from '../utils/pageReports';
import LabWorkloadCharts from '../components/LabWorkloadCharts';
import LabActivityCharts from '../components/LabActivityCharts';
import '../styles/admin-control.css';
import FeedbackBanner from "../components/ui/FeedbackBanner";
import { useEffect, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { Activity, AlertTriangle, ArrowRight, Bell, CheckCircle, Cpu, Microscope, Monitor, RefreshCw, Wrench } from "lucide-react";
import { getLabQueue, getCompletedLab, type LabTicket } from "../api/lab";
import {getLabSupervision,type LabSupervision} from '../api/executive';
import type { Me } from "../api/me";
import { can, PERMISSIONS } from "../app/rbac";
import { labSLA, labArrival } from "../utils/labWorkload";
import { useAlert } from "../hooks/useAlert";
import InlineFeedback from "../components/InlineFeedback";
import EmptyState from "../components/ui/EmptyState";
import PageHeader from "../components/ui/PageHeader";
import StatCard from "../components/ui/StatCard";
import StatusBadge from "../components/ui/StatusBadge";
import SemanticIndicator from "../components/ui/SemanticIndicator";
import { healthFromSla, slaHealthLabel, type HealthState } from "../utils/health";

export default function LabDashboardPage() {
  const [supervision,setSupervision]=useState<LabSupervision|null>(null);
  const incoming=supervision?.lab.camino??null;
  const [ready,setReady]=useState<LabTicket[]>([]);
  const [tickets, setTickets] = useState<LabTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const { feedback, showAlert, closeAlert } = useAlert();
  const me = useOutletContext<Me | null>();
  const showAll = can(me, PERMISSIONS.REPORTS_VIEW);
  const canManageEquipment = can(me, PERMISSIONS.LAB_EQUIPMENT_VIEW);
  const navigate = useNavigate();
  const [error,setError]=useState('');

  const load = async () => {
    if (tickets.length === 0) setLoading(true);
    setError('');
    try {
      const [validators, consoles,completed,reception] = await Promise.all([getLabQueue("VALIDADOR"), getLabQueue("CONSOLA"),getCompletedLab(),showAll?getLabSupervision():Promise.resolve(null)]);
      setSupervision(reception);
      setReady(showAll?completed:completed.filter(ticket=>ticket.tecnico_laboratorio_id===me?.id));
      const all = [...validators, ...consoles];
      const assigned = showAll ? all : all.filter((ticket) => ticket.tecnico_laboratorio_id === me?.id);
      assigned.sort((a,b)=>Number(labSLA(b).vencido)-Number(labSLA(a).vencido)||Number(labSLA(b).critico)-Number(labSLA(a).critico)||new Date(labArrival(a)).getTime()-new Date(labArrival(b)).getTime());
      setTickets(assigned);
    } catch { setError("No fue posible consultar la carga de Laboratorio. Reintenta la consulta."); } finally { setLoading(false); }
  };
  useEffect(() => { void load(); const interval = window.setInterval(load, 15000); return () => window.clearInterval(interval); }, []);

  const total = tickets.length;
  const enDiagnostico = tickets.filter((ticket) => ticket.estado_id === 4).length;
  const enReparacion = tickets.filter((ticket) => ticket.estado_id === 5).length;
  const withSla = tickets.filter((ticket) => !labSLA(ticket).sinSla);
  const overdue = tickets.filter((ticket) => labSLA(ticket).vencido);
  const nearDue = tickets.filter((ticket) => labSLA(ticket).critico);
  const critical = tickets.filter(ticket=>{const sla=labSLA(ticket);return sla.vencido||sla.critico;});
  const slaHealth: HealthState = overdue.length > 0 ? "danger" : nearDue.length > 0 ? "warning" : total === 0 || withSla.length === 0 ? "neutral" : "success";
  const slaHealthText = overdue.length > 0
    ? `${overdue.length} vencida${overdue.length === 1 ? "" : "s"}`
    : nearDue.length > 0
      ? `${nearDue.length} próxima${nearDue.length === 1 ? "" : "s"}`
      : total > 0 && withSla.length === 0
        ? "Sin SLA disponible"
        : total===0?"Sin carga activa":"Dentro de objetivo";

  return (
    <>
      <InlineFeedback isOpen={feedback.isOpen} type={feedback.type} title={feedback.title} message={feedback.message} onConfirm={closeAlert} onCancel={closeAlert} />
      <div className="page role-dashboard-page lab-role-dashboard">

        <PageHeader report={sheetsReport('Resumen laboratorio',[summarySheet('Indicadores',supervision),reportSheet('Carga',tickets),reportSheet('Listos para salida',ready)],loading||!!error)} eyebrow="Laboratorio" title={showAll ? "Resumen de laboratorio" : `Carga de ${me?.nombre || "técnico"}`} description={showAll ? "Carga global y prioridad por SLA." : "Diagnósticos y reparaciones asignados."} icon={<Microscope size={21} />} actions={<><button onClick={load} className="btn ghost" disabled={loading}><RefreshCw size={17} className={loading ? "animate-spin" : ""} /> Actualizar</button></>} />

        {error&&<FeedbackBanner tone="danger">{error}</FeedbackBanner>}
        {loading?<p role="status">Consultando carga…</p>:error?null:<><section className="lab-dashboard-stats">
          <StatCard label={showAll?"Tickets en laboratorio":"Total asignados"} value={total+ready.length} detail="OS recibidas: carga activa y lista para salida" icon={<Activity size={19} />} tone="info" variant="primary" onClick={showAll?()=>navigate("/lab/recepcion?tab=recibidos"):undefined} />
          <StatCard label="Listos para salida" value={ready.length} detail="OS terminadas, pendientes de salida física" icon={<CheckCircle size={19}/>} tone="success" variant="compact" onClick={can(me,PERMISSIONS.LAB_DISPATCH)?()=>navigate("/lab/despacho-qa"):undefined} />
          <StatCard label="SLA crítico o vencido" value={critical.length} detail="Prioridad calculada con el SLA vigente" icon={<AlertTriangle size={19} />} health={slaHealth} healthLabel={slaHealthText} variant="compact" />
          <article className="progress-card"><div className="stat-label">Distribución de carga</div><div className="progress-row"><span><Microscope size={15} /> Diagnóstico</span><strong>{enDiagnostico}</strong></div><div className="progress-track diagnosis"><span style={{ width: total ? `${(enDiagnostico / total) * 100}%` : "0%" }} /></div><div className="progress-row"><span><Wrench size={15} /> Reparación</span><strong>{enReparacion}</strong></div><div className="progress-track repair"><span style={{ width: total ? `${(enReparacion / total) * 100}%` : "0%" }} /></div></article>
        </section>

        {showAll&&<section className="assignment-stats" aria-label="Custodia y asignación">
          <StatCard label="En camino a Laboratorio" value={incoming} detail="No recibidos · excluidos de carga y SLA" icon={<Activity size={19}/>} health="info" onClick={()=>navigate('/lab/recepcion?tab=camino')}/>
          <StatCard label="Recibidos sin asignar" value={tickets.filter(t=>!t.tecnico_laboratorio_id).length} detail="Carga físicamente disponible" icon={<Cpu size={19}/>} health="warning" onClick={()=>navigate(can(me,PERMISSIONS.LAB_ASSIGN)?'/lab/asignacion?tab=pending':'/lab/recepcion?tab=recibidos')}/>
          <StatCard label="Espera de repuesto" value={tickets.filter(t=>t.estado_id===9).length} detail="Solicitud técnica pendiente" icon={<Wrench size={19}/>} health="warning" onClick={()=>navigate(can(me,PERMISSIONS.LAB_ASSIGN)?'/lab/asignacion?tab=all&estado=9':'/lab/recepcion?tab=recibidos')}/>
          <StatCard label="Reingresos en carga" value={tickets.filter(t=>t.reingreso_laboratorio).length} detail="Más de un ciclo de Laboratorio" icon={<RefreshCw size={19}/>} health="info" onClick={()=>navigate('/lab/recepcion?tab=historial')}/>
        </section>}
        {me?.rol==='jefe_laboratorio'?<LabWorkloadCharts tickets={tickets} onConsult={can(me,PERMISSIONS.LAB_ASSIGN)?query=>navigate('/lab/asignacion?'+query):undefined}/>:<>{showAll&&<section className="panel"><div className="section-heading"><h2 className="section-title">Carga por técnico</h2><button className="btn ghost sm" onClick={()=>navigate('/lab/reportes')}>Reportes disponibles</button></div>
          {tickets.every(t=>!t.tecnico_laboratorio_id)?<EmptyState icon={<Cpu size={24}/>} title="Sin carga asignada" description="La recepción física habilita la asignación; el tránsito no cuenta como carga."/>:<div className="table-wrap withdrawal-table-wrap"><table className="withdrawal-table"><thead><tr><th>Técnico</th><th>Carga activa</th><th>Prioridad SLA</th><th>Consulta</th></tr></thead><tbody>{[...new Set(tickets.map(t=>t.tecnico_laboratorio_id).filter(Boolean))].map(id=>{const work=tickets.filter(t=>t.tecnico_laboratorio_id===id);return <tr key={id}><td data-label="Técnico">{work[0].tecnico_laboratorio||'Técnico asignado'}</td><td data-label="Carga activa">{work.length}</td><td data-label="Prioridad SLA"><StatusBadge health={work.some(t=>labSLA(t).vencido)?'danger':work.some(t=>labSLA(t).critico)?'warning':'info'}>{work.filter(t=>labSLA(t).critico||labSLA(t).vencido).length} críticas / vencidas</StatusBadge></td><td data-label="Consulta">{can(me,PERMISSIONS.LAB_ASSIGN)&&<button className="btn ghost sm" onClick={()=>navigate('/lab/asignacion?tab=assigned&tecnico='+encodeURIComponent(id!))}>Ver carga</button>}</td></tr>;})}</tbody></table></div>}
          <p className="small muted">Carga y antigüedad no representan productividad. Solo los cierres técnicos registrados permiten medir trabajo completado.</p>
        </section>}</>}
        {showAll&&supervision&&(me?.rol==='jefe_laboratorio'?<LabActivityCharts insights={supervision.labInsights}/>:<section className="panel"><h2 className="section-title">Actividad técnica registrada</h2><div className="executive-context"><StatusBadge health="info">{supervision.labInsights.finished30Days} cierres técnicos · últimos 30 días</StatusBadge><StatusBadge health={supervision.labInsights.recurrentAssets?'warning':'neutral'}>{supervision.labInsights.recurrentAssets} activos con más de una OS por falla</StatusBadge></div>
          <p className="small muted">Cierres por OS y ciclo; incluye NFF y PoD registrados, no solo reparaciones. La recurrencia considera el historial completo.</p>
          {supervision.labInsights.frequentFaults.length?<ul className="asset-recent">{supervision.labInsights.frequentFaults.map(f=><li key={f.falla}><span>{f.falla}</span><StatusBadge health="info">{f.total} OS</StatusBadge></li>)}</ul>:<EmptyState icon={<CheckCircle size={24}/>} title="Sin fallas registradas"/>}
        </section>)}
        <div className="section-heading priority-heading"><h2 className="section-title">Prioridad por SLA</h2>{can(me,PERMISSIONS.LAB_ASSIGN)&&<button className="btn ghost sm" onClick={()=>navigate("/lab/asignacion")}>Ver todos</button>}<StatusBadge health={slaHealth}>{slaHealthText}</StatusBadge></div>
        {total === 0 && !loading ? <section className="panel"><EmptyState icon={<CheckCircle size={24} />} title="Sin tareas pendientes" description="La bandeja de laboratorio está al día." health="success" /></section> : (
          <section className="work-queue" role="table" aria-label="Cola de trabajo de laboratorio ordenada por SLA">
            <div className="work-queue-header" role="row">
              <span role="columnheader">Equipo</span>
              <span role="columnheader">Etapa</span>
              <span role="columnheader">Falla</span>
              <span role="columnheader">SLA</span>
              <span role="columnheader" className="sr-only">Acción</span>
            </div>
            <div role="rowgroup">{tickets.slice(0, 5).map((ticket) => {
            const sla = labSLA(ticket); const validator = ticket.codigo_os.startsWith("MV") || ticket.codigo_os.startsWith("PDV");
            const health = healthFromSla(sla);
            return <article className="work-queue-row" role="row" data-health={health} data-overdue={sla.vencido} key={ticket.codigo_os}>
              <div className="work-queue-equipment" role="cell" data-label="Equipo"><span aria-hidden="true">{validator ? <Cpu size={16} /> : <Monitor size={16} />}</span><strong>{ticket.codigo_os}</strong></div>
              <div className="work-queue-stage" role="cell" data-label="Etapa"><StatusBadge health="info">{ticket.estado_id === 4 ? "Diagnóstico" : ticket.estado_id===9?"Espera de repuesto":"Reparación"}</StatusBadge></div>
              <div className="work-queue-failure" role="cell" data-label="Falla" title={ticket.falla}>{ticket.falla}</div>
              <div className="work-queue-sla" role="cell" data-label="SLA"><SemanticIndicator state={health} label={slaHealthLabel(sla)} detail={sla.texto} detailTitle={sla.detalle} /></div>
              <div className="work-queue-action" role="cell">{canManageEquipment ? <button onClick={() => navigate(validator ? "/lab/validadores" : "/lab/consolas")} className="icon-btn" title="Gestionar equipo" aria-label={`Gestionar ${ticket.codigo_os}`}><ArrowRight size={18} /></button> : <span aria-hidden="true">—</span>}</div>
            </article>;
          })}</div></section>
        )}
      </>}
      </div>
    </>
  );
}
