import { useEffect, useMemo, useState } from "react";
import { CheckCircle, ClipboardList, Clock, RefreshCw, Truck } from "lucide-react";
import { getMyOs, type OrdenServicio } from "../api/os";
import EmptyState from "../components/ui/EmptyState";
import FeedbackBanner from "../components/ui/FeedbackBanner";
import PageHeader from "../components/ui/PageHeader";
import StatCard from "../components/ui/StatCard";
import StatusBadge from "../components/ui/StatusBadge";
import { healthFromMaintenanceState } from "../utils/health";
import { formatOperationalStatus } from "../utils/formatters";
import { formatDate } from "../utils/formatters";
import { Link } from 'react-router-dom';
import { assetHistoryUrl } from '../api/bridge';
import { caseHistoryUrl } from '../api/requerimientos';

const finalStates = new Set([8, 12, 13]);

export default function MyServiceOrdersPage() {
  const [orders, setOrders] = useState<OrdenServicio[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = async () => {
    setLoading(true);
    setError("");
    try { setOrders(await getMyOs()); }
    catch (requestError) { console.error(requestError); setError("No fue posible cargar tus órdenes de servicio."); }
    finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, []);

  const summary = useMemo(() => ({
    active: orders.filter((order) => !finalStates.has(order.estado_id)).length,
    transit: orders.filter((order) => order.estado_nombre === 'EN_RUTA').length,
    complete: orders.filter((order) => finalStates.has(order.estado_id)).length
  }), [orders]);

  return (
    <div className="page">
      <PageHeader
        eyebrow="Terreno"
        title="Mis órdenes de servicio"
        description="Historial y estado de las OS asociadas a tu usuario."
        icon={<ClipboardList size={21} />}
        actions={<button className="btn ghost" onClick={load} disabled={loading}><RefreshCw size={17} className={loading ? "animate-spin" : ""} /> Actualizar</button>}
      />
      {error ? <FeedbackBanner tone="danger">{error}</FeedbackBanner> : null}
      {loading?<p role="status">Consultando órdenes…</p>:error?null:<><section className="stat-grid" aria-label="Resumen de mis órdenes">
        <StatCard label="OS asociadas" value={orders.length} detail="20 recientes y todos los retiros pendientes" icon={<ClipboardList size={19} />} tone="neutral" />
        <StatCard label="En curso" value={summary.active} detail="Trabajo o proceso pendiente" icon={<Clock size={19} />} health="info" healthLabel="En curso" />
        <StatCard label="En ruta" value={summary.transit} detail="Salida física a terreno confirmada" icon={<Truck size={19} />} health="info" healthLabel="En movimiento" />
        <StatCard label="Estados finales" value={summary.complete} detail="Incluye cierres, instalaciones o rechazos" icon={<CheckCircle size={19} />} tone="neutral" />
      </section>

      <div className="section-heading"><h2 className="section-title">Historial propio</h2><StatusBadge tone="neutral">{orders.length}</StatusBadge></div>
      {!loading && orders.length === 0 ? (
        <section className="panel"><EmptyState icon={<ClipboardList size={24} />} title="Sin órdenes asociadas" description="Aún no existen OS registradas a tu nombre." /></section>
      ) : (
        <section className="priority-list" aria-label="Órdenes de servicio del usuario">
          {orders.map((order) => (
            <article className="priority-row" data-health={healthFromMaintenanceState(order.estado_id)} key={order.codigo_os}>
              <div className="priority-device"><ClipboardList size={20} /></div>
              <div className="priority-copy">
                <div><strong>{order.codigo_os}</strong><StatusBadge health={healthFromMaintenanceState(order.estado_id)}>{formatOperationalStatus(order.estado_nombre)}</StatusBadge></div>
                <p>{order.tipo_equipo} · {order.serie} · {order.modelo} · {order.marca}</p>
                <p>{order.falla || "Sin descripción"}</p>
                <p>{order.terminal || 'Sin terminal'} · {order.tecnico_nombre || order.tecnico_terreno || 'Técnico asignado'} · {formatDate(order.fecha)}</p>
                {order.caso_id && <p><Link to={caseHistoryUrl(order.caso_id)}>Caso {order.codigo_caso || order.caso_id}</Link>{order.os_origen && ` · OS origen ${order.os_origen}`}{order.referencia_externa && ` · ${order.referencia_externa}`}</p>}
                <Link to={assetHistoryUrl(order)}>Historial de este activo</Link>
                {order.estado_nombre==='PENDIENTE_RETIRO'&&<p className="field-hint">Confirma el retiro en Mobile → Mis órdenes, con validación de identidad y evidencia física.</p>}
              </div>
              <div className="priority-sla">
                <strong>{order.tipo_equipo}</strong>
                <span>{order.serie || "Sin serie"} · {order.bus_ppu || "Sin bus"}</span>
              </div>
            </article>
          ))}
        </section>
      )}
      </>}
    </div>
  );
}
