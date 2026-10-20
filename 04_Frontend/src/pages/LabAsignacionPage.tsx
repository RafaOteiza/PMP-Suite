import {localReport} from '../utils/pageReports';
import { useEffect, useState } from "react";
import { useOutletContext, useSearchParams } from "react-router-dom";
import { AlertTriangle, CheckCircle, Cpu, RefreshCw, User, Users } from "lucide-react";
import type { Me } from "../api/me";
import { assignTicket, getLabQueue, getLabTechnicians, type LabTech, type LabTicket } from "../api/lab";
import { can, PERMISSIONS } from "../app/rbac";
import { getApiErrorMessage } from "../api/errors";
import EmptyState from "../components/ui/EmptyState";
import FeedbackBanner from "../components/ui/FeedbackBanner";
import PageHeader from "../components/ui/PageHeader";
import StatCard from "../components/ui/StatCard";
import StatusBadge from "../components/ui/StatusBadge";
import { formatDate, formatTime, formatOperationalStatus } from "../utils/formatters";

import { healthFromSla, slaHealthLabel } from '../utils/health';
import { compareLabWorkload, labArrival, labSLA, labArrivalLabel } from '../utils/labWorkload';

export default function LabAsignacionPage() {
  const me = useOutletContext<Me | null>();
  const canAssign = can(me, PERMISSIONS.LAB_ASSIGN);
  const [params,setParams]=useSearchParams();
  const tab=params.get('tab')==='assigned'?'assigned':params.get('tab')==='all'?'all':'pending';
  const setTab=(value:string)=>setParams({...Object.fromEntries(params),tab:value});
  const [selection,setSelection]=useState<Record<string,string>>({});
  const [tickets, setTickets] = useState<LabTicket[]>([]);
  const [techs, setTechs] = useState<LabTech[]>([]);
  const [loading, setLoading] = useState(true);
  const [changing, setChanging] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [notification, setNotification] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const loadData = async () => {
    setLoading(true); setErrorMsg("");
    try { setTechs(await getLabTechnicians()); } catch (error) { console.error("Error cargando técnicos:", error); setErrorMsg("No se pudo cargar la lista de técnicos."); }
    try {
      const [validators, consoles] = await Promise.all([getLabQueue("VALIDADOR"), getLabQueue("CONSOLA")]);
      setTickets([...validators, ...consoles]);
    } catch (error) { console.error("Error cargando OS:", error); setErrorMsg("Error cargando las órdenes de servicio."); }
    finally { setLoading(false); }
  };
  useEffect(() => { void loadData(); }, []);
  useEffect(() => { if (!notification) return; const timer = window.setTimeout(() => setNotification(null), 3000); return () => window.clearTimeout(timer); }, [notification]);

  const handleAssign = async (os: string, techId: string) => {
    if (!canAssign) return;
    setChanging(os);
    try {
      await assignTicket(os, techId);
      setTickets((current) => current.map((ticket) => ticket.codigo_os === os ? { ...ticket, tecnico_laboratorio_id: techId, tecnico_laboratorio: techs.filter(t=>t.id===techId).map(t=>[t.nombre,t.apellido].filter(Boolean).join(" "))[0] || "" } : ticket));
      const techName = techs.find((tech) => tech.id === techId)?.nombre || "Técnico";
      setNotification({ message: techId ? `Asignado a ${techName} correctamente.` : "Asignación eliminada.", type: "success" });
    } catch (error) { console.error("Error asignando:", error); setNotification({ message: `Error: ${getApiErrorMessage(error, "Error de conexión")}`, type: "error" }); }
    finally { setChanging(null); }
  };

  const pending=tickets.filter(t=>!t.tecnico_laboratorio_id);
  const assigned=tickets.filter(t=>Boolean(t.tecnico_laboratorio_id));
  const visible=[...(tab==="pending"?pending:tab==="assigned"?assigned:tickets) ].filter(ticket=>{
    if(params.get('estado')&&String(ticket.estado_id)!==params.get('estado'))return false;
    if(params.get('tecnico')&&ticket.tecnico_laboratorio_id!==params.get('tecnico'))return false;
    const sla=labSLA(ticket),filter=params.get('sla');
    return !filter||(filter==='vigente'?!sla.sinSla&&!sla.critico&&!sla.vencido:filter==='critico'?sla.critico:filter==='vencido'?sla.vencido:sla.sinSla);
  }).sort(compareLabWorkload);
  const tabs=[{key:"pending" as const,label:"Pendientes de asignación",count:pending.length},{key:"assigned" as const,label:"Asignados",count:assigned.length},{key:"all" as const,label:"Todos",count:tickets.length}];
  const empty=tab==="pending"?"No hay equipos pendientes de asignación.":tab==="assigned"?"No hay equipos asignados actualmente.":"No hay equipos en Laboratorio.";
  return (
    <div className="page lab-assignment">
      {notification ? <div className="toast" data-tone={notification.type} role="status">{notification.type === "success" ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}<span>{notification.message}</span></div> : null}
      <PageHeader report={localReport('Gestion de carga',visible,loading||!!errorMsg,Object.fromEntries(params))} eyebrow="Planificación de laboratorio" title="Gestión de carga" description="Distribuye las órdenes de servicio entre los técnicos disponibles." icon={<Users size={21} />} actions={<button onClick={loadData} className="btn ghost" disabled={loading}><RefreshCw size={17} className={loading ? "animate-spin" : ""} /> Actualizar</button>} />
      {errorMsg ? <FeedbackBanner tone="danger">{errorMsg}</FeedbackBanner> : null}

      {loading ? <p role="status">Consultando carga...</p> : errorMsg ? null : <><section className="assignment-stats"><StatCard label="Tickets en laboratorio" value={tickets.length} detail="Carga técnica total" icon={<Cpu size={19} />} tone="technical" /><StatCard label="Sin asignar" value={tickets.filter((ticket) => !ticket.tecnico_laboratorio_id).length} detail="Requieren responsable" icon={<User size={19} />} health={tickets.some((ticket) => !ticket.tecnico_laboratorio_id) ? "warning" : "success"} healthLabel={tickets.some((ticket) => !ticket.tecnico_laboratorio_id) ? "Asignación pendiente" : "Carga asignada"} /></section>

      <div className="operation-tabs" role="tablist" aria-label="Carga de laboratorio">
        {tabs.map(item=><button key={item.key} role="tab" aria-selected={tab===item.key} data-active={tab===item.key} onClick={()=>setTab(item.key)}>{item.label}<span className="tab-count">{item.count}</span></button>)}
      </div>
      {(params.has('estado')||params.has('sla')||params.has('tecnico'))&&<FeedbackBanner tone="info">Consulta filtrada desde el resumen. <button className="btn ghost sm" onClick={()=>setParams({tab})}>Mostrar toda la carga</button></FeedbackBanner>}
      <section className="panel data-panel" aria-label={tabs.find(t=>t.key===tab)?.label}>
        {visible.length===0&&!loading?<EmptyState icon={<CheckCircle size={24}/>} title={empty}/>:(
          <div className="table-wrap withdrawal-table-wrap"><table className="withdrawal-table lab-assignment-table">
            <thead><tr><th>OS</th><th>Equipo / PPU</th><th>Falla</th><th>Ingreso a Laboratorio</th><th>SLA</th><th>Estado</th><th>Técnico / Acción</th></tr></thead>
            <tbody>{visible.map(ticket=>{
              const sla=labSLA(ticket);
              const value=selection[ticket.codigo_os]??ticket.tecnico_laboratorio_id??"";
              const techName=ticket.tecnico_laboratorio||techs.filter(t=>t.id===ticket.tecnico_laboratorio_id).map(t=>[t.nombre,t.apellido].join(" "))[0];
              return <tr key={ticket.codigo_os}>
                <td data-label="OS"><strong>{ticket.codigo_os}</strong></td>
                <td data-label="Equipo / PPU"><strong>{ticket.serie}</strong><span className="withdrawal-secondary">{ticket.tipo_equipo||(ticket.codigo_os.startsWith("MV")||ticket.codigo_os.startsWith("PDV")?"VALIDADOR":"CONSOLA")}{ticket.modelo?" · "+ticket.modelo:""}</span><span className="withdrawal-secondary">PPU {ticket.bus_ppu||"Sin registro"}</span></td>
                <td data-label="Falla">{ticket.falla}</td>
                <td data-label="Ingreso a Laboratorio">{formatDate(labArrival(ticket))} {formatTime(labArrival(ticket))}<span className="withdrawal-secondary">{labArrivalLabel(ticket)}</span></td>
                <td data-label="SLA"><StatusBadge health={healthFromSla(sla)}>{slaHealthLabel(sla)}</StatusBadge><span className="withdrawal-secondary" title={labArrivalLabel(ticket)}>{sla.texto}</span></td>
                <td data-label="Estado"><StatusBadge health="info">{formatOperationalStatus(ticket.estado_nombre)}</StatusBadge>{ticket.ubicacion&&<span className="withdrawal-secondary">{ticket.ubicacion}</span>}</td>
                <td data-label="Técnico / Acción"><span className="small">{ticket.tecnico_laboratorio_id?(techName||"Técnico asignado"):"Sin asignar"}</span>{canAssign&&<div className="withdrawal-assignment">
                  <select value={value} onChange={event=>setSelection(current=>({...current,[ticket.codigo_os]:event.target.value}))} disabled={changing===ticket.codigo_os} aria-label={`Asignar ${ticket.codigo_os}`}><option value="">Sin asignar</option>{techs.map(tech=><option key={tech.id} value={tech.id}>{tech.nombre} {tech.apellido}</option>)}</select>
                  <button className="btn sm" disabled={changing===ticket.codigo_os||value===(ticket.tecnico_laboratorio_id||"")} onClick={()=>void handleAssign(ticket.codigo_os,value)}>{changing===ticket.codigo_os?"Guardando…":ticket.tecnico_laboratorio_id?"Guardar":"Asignar"}</button>
                </div>}</td>
              </tr>;
            })}</tbody>
          </table></div>
        )}
      </section></>}
    </div>
  );
}
