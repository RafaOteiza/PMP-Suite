import {localReport} from '../utils/pageReports';
import {useNavigate,useLocation} from 'react-router-dom';
import { useEffect, useState } from "react";
import { Clock, Cpu, Microscope, Monitor, RefreshCw, Search, User, Wrench } from "lucide-react";
import { getLabQueue, type LabTicket } from "../api/lab";
import type { Me } from "../api/me";
import FeedbackBanner from "./ui/FeedbackBanner";
import EmptyState from "./ui/EmptyState";
import PageHeader from "./ui/PageHeader";
import StatCard from "./ui/StatCard";
import StatusBadge from "./ui/StatusBadge";
import { healthFromMaintenanceState } from "../utils/health";
import { formatOperationalStatus } from "../utils/formatters";

const STATE_DIAGNOSTICO = 4;
const STATE_REPARACION = 5;
const STATE_ESPERA_REPUESTO = 9;

interface LabEquipmentViewProps {
  me: Me | null;
  canWrite: boolean;
  type: "VALIDADOR" | "CONSOLA";
}

export default function LabEquipmentView({ me, canWrite, type }: LabEquipmentViewProps) {
  const navigate=useNavigate(),location=useLocation();
  const [tickets, setTickets] = useState<LabTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError,setLoadError]=useState("");
  const [searchTerm, setSearchTerm] = useState("");

  const isValidator = type === "VALIDADOR";
  const TypeIcon = isValidator ? Cpu : Monitor;
  const load = async () => {
    setLoading(true);setLoadError("");
    try { setTickets(await getLabQueue(type)); } catch { setLoadError("No se pudo consultar la carga de Laboratorio. Reintenta la consulta."); } finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, [type]);

  const normalized = searchTerm.toLowerCase();
  const filtered = tickets.filter((ticket) => ticket.codigo_os.toLowerCase().includes(normalized) || ticket.serie.toLowerCase().includes(normalized) || ticket.bus_ppu.toLowerCase().includes(normalized));

  return (
    <div className="page">


      <PageHeader report={localReport('Equipos laboratorio',filtered,loading||!!loadError,{tipo:type,q:searchTerm})}
        eyebrow="Laboratorio"
        title={`Laboratorio · ${isValidator ? "Validadores" : "Consolas"}`}
        description="Consulta técnica por tipo de equipo. Mi carga es la bandeja diaria; ambas vistas abren el mismo trabajo."
        icon={<TypeIcon size={21} />}
        actions={<button onClick={load} className="btn ghost" disabled={loading}><RefreshCw size={17} className={loading ? "animate-spin" : ""} /> Actualizar</button>}
      />

      {loading?<p role="status">Consultando carga…</p>:loadError?<FeedbackBanner tone="danger">{loadError}</FeedbackBanner>:<>
      <section className="lab-stat-grid" aria-label="Resumen de carga">
        <StatCard label="En diagnóstico" value={tickets.filter((ticket) => ticket.estado_id === STATE_DIAGNOSTICO).length} detail="Pendientes de evaluación" icon={<Microscope size={19} />} health="info" healthLabel="En curso" />
        <StatCard label="En reparación" value={tickets.filter((ticket) => ticket.estado_id === STATE_REPARACION).length} detail="Trabajo técnico activo" icon={<Wrench size={19} />} health="info" healthLabel="En curso" />
        <StatCard label="Espera repuesto" value={tickets.filter((ticket) => ticket.estado_id === STATE_ESPERA_REPUESTO).length} detail="SLA detenido por stock" icon={<Clock size={19} />} health={tickets.some((ticket) => ticket.estado_id === STATE_ESPERA_REPUESTO) ? "warning" : "success"} healthLabel={tickets.some((ticket) => ticket.estado_id === STATE_ESPERA_REPUESTO) ? "Bloqueado por stock" : "Sin bloqueos"} />
      </section>

      <div className="toolbar lab-toolbar"><div className="search page-search"><Search size={17} /><input type="search" placeholder="Buscar OS, serie o PPU…" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} aria-label={`Buscar ${type.toLowerCase()}`} /></div><StatusBadge tone="neutral">{filtered.length} tickets</StatusBadge></div>

      {filtered.length === 0 && !loading ? (
        <section className="panel"><EmptyState icon={<TypeIcon size={24} />} title={`Sin ${isValidator ? "validadores" : "consolas"} en la cola`} description="No existen equipos que coincidan con la búsqueda actual." /></section>
      ) : (
        <section className="asset-grid">
          {filtered.map((ticket) => {
            const assignedToMe = me?.id === ticket.tecnico_laboratorio_id;
            const awaitingReception = ticket.estado_id === STATE_DIAGNOSTICO && !ticket.recepcion_laboratorio_confirmada;
            const actionLabel = awaitingReception ? "Pendiente recepción del jefe" : ticket.estado_id === STATE_DIAGNOSTICO ? "Iniciar diagnóstico" : ticket.estado_id === STATE_REPARACION ? "Continuar reparación" : ticket.estado_id === STATE_ESPERA_REPUESTO ? "Ver solicitud en espera" : "Gestionar ticket";
            const StateIcon = ticket.estado_id === STATE_ESPERA_REPUESTO ? Clock : ticket.estado_id === STATE_REPARACION ? Wrench : TypeIcon;
            const ActionIcon = awaitingReception ? Clock : Wrench;
            return (
              <article className="asset-card" data-assigned={assignedToMe} data-health={healthFromMaintenanceState(ticket.estado_id)} key={ticket.codigo_os}>
                <div className="asset-card-header">
                  <div className="asset-state-icon" data-health={healthFromMaintenanceState(ticket.estado_id)}><StateIcon size={21} /></div>
                  <div className="asset-card-title"><div><strong>{ticket.codigo_os}</strong><StatusBadge health={healthFromMaintenanceState(ticket.estado_id)}>{formatOperationalStatus(ticket.estado_nombre)}</StatusBadge></div>{assignedToMe ? <StatusBadge tone="primary"><User size={12} /> Mi carga</StatusBadge> : null}</div>
                </div>
                <dl className="asset-data"><div><dt>Serie</dt><dd>{ticket.serie}</dd></div><div><dt>Modelo / Marca</dt><dd>{ticket.modelo||"Sin registro"} · {ticket.marca||"Sin registro"}</dd></div><div><dt>Bus</dt><dd>{ticket.bus_ppu || "Sin asignar"}</dd></div></dl>
                <div className="asset-failure"><span>Falla reportada</span><p>{ticket.falla}</p></div>
                {canWrite ? <button className="btn full asset-action" onClick={() => navigate(`/mi-carga/${encodeURIComponent(ticket.codigo_os)}`,{state:{from:location.pathname}})} disabled={awaitingReception} title={awaitingReception ? "El jefe de laboratorio debe escanear y recepcionar físicamente el equipo" : undefined}><ActionIcon size={17} />{actionLabel}</button> : null}
              </article>
            );
          })}
        </section>
      )}</>}
    </div>
  );
}
