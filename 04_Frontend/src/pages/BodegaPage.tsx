import {localReport} from '../utils/pageReports';
import { useEffect, useState, type ReactNode } from "react";
import { useNavigate, useOutletContext, useSearchParams } from "react-router-dom";
import { ArrowDownToLine, CheckCircle, Cpu, FlaskConical, Monitor, Package, RefreshCw, ShieldAlert, Truck } from "lucide-react";
import type { Me } from "../api/me";
import { getBodegaQueue, type BodegaTicket } from "../api/bodega";
import { can, PERMISSIONS } from "../app/rbac";
import EmptyState from "../components/ui/EmptyState";
import FeedbackBanner from "../components/ui/FeedbackBanner";
import PageHeader from "../components/ui/PageHeader";
import StatusBadge from "../components/ui/StatusBadge";
import type { HealthState } from "../utils/health";

type Tab = "transito" | "para-lab" | "para-qa";
interface TabDefinition { key: Tab; label: string; icon: ReactNode; count: number; health: HealthState; }

function OriginStatus({ ticket }: { ticket: BodegaTicket }) {
  if (ticket.estado_id === 2) return <StatusBadge health="info">Nuevo desde terreno</StatusBadge>;
  if (ticket.estado_id === 11 && ticket.es_aprobado_qa === false) return <StatusBadge health="danger">QA rechazado</StatusBadge>;
  if (ticket.estado_id === 11) return <StatusBadge health="flow">Reparado en laboratorio</StatusBadge>;
  return null;
}

function DestinationStatus({ ticket }: { ticket: BodegaTicket }) {
  if (ticket.es_aprobado_qa === false) return <StatusBadge health="danger">Retorno a laboratorio</StatusBadge>;
  if (ticket.fue_laboratorio && ticket.es_aprobado_qa == null) return <StatusBadge health="flow">Listo para QA</StatusBadge>;
  return <StatusBadge health="info">Pendiente de laboratorio</StatusBadge>;
}

const ticketHealth = (ticket: BodegaTicket, tab: Tab): HealthState => {
  if (ticket.es_aprobado_qa === false) return "danger";
  if (tab === "para-qa" && ticket.fue_laboratorio) return "flow";
  return "info";
};

export default function BodegaPage() {
  const navigate=useNavigate();
  const me = useOutletContext<Me | null>();
  const canWrite = can(me, PERMISSIONS.BODEGA_WRITE);
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab: Tab = (searchParams.get("tab") as Tab) || "transito";
  const [tickets, setTickets] = useState<BodegaTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");


  const loadData = async () => {
    setLoading(true); setError("");
    try {
      const queue = await getBodegaQueue();
      setTickets(queue);
      window.dispatchEvent(new Event('pmp:warehouse-queue-updated'));
    } catch {
      setError("Error cargando operaciones de bodega.");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { void loadData(); }, []);
  useEffect(() => { if (!success) return; const timer = window.setTimeout(() => setSuccess(""), 3500); return () => window.clearTimeout(timer); }, [success]);

  const enTransito = tickets.filter((ticket) => ticket.estado_id === 2 || ticket.estado_id === 11);
  const paraLab = tickets.filter((ticket) => ticket.estado_id === 3 && (ticket.es_aprobado_qa === false || !ticket.fue_laboratorio));
  const paraQa = tickets.filter((ticket) => ticket.estado_id === 3 && ticket.fue_laboratorio && ticket.es_aprobado_qa == null);
  const tabs: TabDefinition[] = [
    { key: "transito", label: "Recepcionar", icon: <ArrowDownToLine size={16} />, count: enTransito.length, health: enTransito.length === 0 ? "success" : "info" },
    { key: "para-lab", label: "Para laboratorio", icon: <Truck size={16} />, count: paraLab.length, health: paraLab.some((ticket) => ticket.es_aprobado_qa === false) ? "danger" : paraLab.length > 0 ? "info" : "success" },
    { key: "para-qa", label: "Para control QA", icon: <FlaskConical size={16} />, count: paraQa.length, health: paraQa.length === 0 ? "success" : "info" }
  ];
  const activeItems = activeTab === "transito" ? enTransito : activeTab === "para-lab" ? paraLab : paraQa;
  const laneDescription = activeTab === "transito" ? "Equipos en camino desde terreno, laboratorio o QA. Confirma su recepción física para continuar su circuito." : activeTab === "para-lab" ? "Equipos en Bodega que requieren diagnóstico o reingreso al laboratorio después de QA." : "Equipos reparados en laboratorio y listos para certificación de calidad.";
  const emptyTitle = activeTab === "transito" ? "No hay equipos pendientes de recepción." : activeTab === "para-lab" ? "No hay equipos pendientes de envío a laboratorio." : "No hay equipos pendientes de envío a control QA.";

  const actionFor = (ticket:BodegaTicket) => activeTab==='transito'?{label:'Preparar recepción',icon:<ArrowDownToLine size={16}/>,path:`/bodega/recepciones/${encodeURIComponent(ticket.codigo_os)}`}:
   activeTab==='para-lab'?{label:'Preparar envío a Laboratorio',icon:<Truck size={16}/>,path:`/bodega/envios-laboratorio/${encodeURIComponent(ticket.codigo_os)}`}:
   {label:'Preparar envío a QA',icon:<FlaskConical size={16}/>,path:`/bodega/envios-qa/${encodeURIComponent(ticket.codigo_os)}`};

  return (
    <div className="page warehouse-flow">

      <PageHeader report={localReport('Recepciones y despachos',activeItems,loading||!!error,{bandeja:activeTab})} eyebrow="Operación logística" title="Bodega y logística" description="Recepción y despacho de equipos según su etapa en la cadena de reparación." icon={<Package size={21} />} actions={<button onClick={loadData} className="btn ghost" disabled={loading}><RefreshCw size={17} className={loading ? "animate-spin" : ""} /> Actualizar</button>} />
      {error ? <FeedbackBanner tone="danger">{error}</FeedbackBanner> : null}
      {success ? <FeedbackBanner tone="success">{success}</FeedbackBanner> : null}

      <div className="operation-tabs" role="tablist" aria-label="Etapas de bodega">
        {tabs.map((tab) => <button key={tab.key} role="tab" aria-selected={activeTab === tab.key} data-active={activeTab === tab.key} data-health={loading||error?"neutral":tab.health} onClick={() => setSearchParams({ tab: tab.key })}>{tab.icon}<span>{tab.label}</span><span className="tab-count">{loading||error?"—":tab.count}</span></button>)}
      </div>

      <section className="lane-section">
        <p className="lane-description">{laneDescription}</p>
        {loading?<p role="status">Consultando operaciones…</p>:error?null:activeItems.length === 0 ? <div className="panel"><EmptyState icon={<Package size={24} />} title={emptyTitle} health="success" /></div> : (
          <div className="logistics-list">{activeItems.map((ticket) => {
            const action = actionFor(ticket); const validator = ticket.tipo_equipo === "VALIDADOR";
            return <article className="logistics-card" data-health={ticketHealth(ticket, activeTab)} key={ticket.codigo_os}>
              <div className="logistics-card-head"><div className="logistics-identity"><span className="logistics-device">{validator ? <Cpu size={19} /> : <Monitor size={19} />}</span><div><div><strong>{ticket.codigo_os}</strong><StatusBadge tone="neutral">{ticket.tipo_equipo}</StatusBadge>{activeTab === "transito" ? <OriginStatus ticket={ticket} /> : activeTab === "para-lab" && ticket.es_aprobado_qa === false ? <StatusBadge health="danger"><ShieldAlert size={12} /> Reingreso QA</StatusBadge> : activeTab === "para-qa" ? <StatusBadge health="flow"><CheckCircle size={12} /> Reparado</StatusBadge> : <StatusBadge health="info">Nuevo ingreso</StatusBadge>}</div><span>Serie <strong>{ticket.serie}</strong>{[ticket.modelo, ticket.marca].filter(Boolean).map((value, index) => <span key={index}> · {value}</span>)}</span></div></div><StatusBadge health={ticketHealth(ticket, activeTab)}>{activeTab === "transito" ? "En tránsito hacia Bodega" : activeTab === "para-lab" ? "En Bodega" : "Pendiente control QA"}</StatusBadge></div>
              <p className="warehouse-context">{[ticket.bus_ppu, ticket.terminal, ticket.operador].filter(Boolean).join(" · ") || "Sin instalación informada"}</p>
              {ticket.falla ? <p className="logistics-failure">{ticket.falla}</p> : null}
              {activeTab === "para-lab" && <StatusBadge health="warning">Pendiente de validación de salida</StatusBadge>}
              <div className="warehouse-actions">
              {canWrite ? <>
                <button className="btn logistics-action" onClick={()=>navigate(action.path)}>{action.icon}{action.label}</button>
              </> : <DestinationStatus ticket={ticket} />}
              </div>
            </article>;
          })}</div>
        )}
      </section>
    </div>
  );
}
