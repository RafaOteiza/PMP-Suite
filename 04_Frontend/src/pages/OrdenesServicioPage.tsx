import {pagedReport} from '../utils/pageReports';
import { useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { ClipboardList, RefreshCw, Search } from "lucide-react";
import { listOs, type OrdenServicio, type OsListResponse } from "../api/os";
import { getApiErrorMessage } from "../api/errors";
import EmptyState from "../components/ui/EmptyState";
import FeedbackBanner from "../components/ui/FeedbackBanner";
import PageHeader from "../components/ui/PageHeader";
import StatusBadge from "../components/ui/StatusBadge";
import { healthFromMaintenanceState } from "../utils/health";
import { formatDate, formatOperationalStatus } from "../utils/formatters";

const EMPTY: OsListResponse = { items: [], pagination: { total: 0, limit: 25, offset: 0 } };

export default function OrdenesServicioPage() {
  const [params,setParams]=useSearchParams();
  const grupo=params.get("grupo")||"";
  const [query, setQuery] = useState("");
  const [type, setType] = useState<"" | "VALIDADOR" | "CONSOLA">("");
  const [data, setData] = useState<OsListResponse>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async (offset = 0) => {
    setLoading(true);
    setError("");
    try {
      setData(await listOs({ q: query.trim(), tipo_equipo: type, grupo, offset, limit: 25 }));
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, "No se pudieron cargar las órdenes de servicio"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(0); }, [grupo]);

  const submit = (event: FormEvent) => { event.preventDefault(); void load(0); };
  const page = Math.floor(data.pagination.offset / data.pagination.limit) + 1;
  const pages = Math.max(1, Math.ceil(data.pagination.total / data.pagination.limit));

  return (
    <div className="page">

      <PageHeader report={pagedReport('Ordenes de servicio','/api/os',{q:query.trim(),tipo_equipo:type,grupo},loading||!!error)}
        eyebrow="Operación"
        title="Órdenes de servicio"
        description="Consulta global, paginada y trazable de la operación."
        icon={<ClipboardList size={21} />}
        actions={<button className="btn ghost" onClick={() => void load(data.pagination.offset)} disabled={loading}><RefreshCw size={17} className={loading ? "animate-spin" : ""} /> Actualizar</button>}
      />

      {error ? <FeedbackBanner tone="danger">{error}</FeedbackBanner> : null}

      <section className="panel">
        <form className="filter-bar" onSubmit={submit}>
          <div className="search filter-search"><Search size={17} /><input aria-label="Buscar órdenes" value={query} maxLength={100} onChange={(event) => setQuery(event.target.value)} placeholder="OS, referencia, bus o serie" /></div>
          <select aria-label="Tipo de equipo" value={type} onChange={(event) => setType(event.target.value as typeof type)}>
            <option value="">Todos los equipos</option><option value="VALIDADOR">Validadores</option><option value="CONSOLA">Consolas</option>
          </select>
          <select aria-label="Grupo de órdenes" value={grupo} onChange={e=>setParams(e.target.value?{grupo:e.target.value}:{})}><option value="">Todas las OS</option><option value="activas">Activas</option><option value="cerradas">Cerradas / finalizadas</option><option value="pod">OS PoD</option><option value="fallas">Fallas registradas</option><option value="instalaciones">IN pendientes</option><option value="retiros">Retiros pendientes</option></select>
          <button className="btn" type="submit" disabled={loading}><Search size={17} /> Consultar</button>
        </form>

        {loading?<p role="status">Consultando órdenes…</p>:error?null:data.items.length === 0 ? (
          <EmptyState icon={<ClipboardList size={24} />} title="Sin órdenes para mostrar" description="Ajusta los filtros o actualiza la consulta para revisar nuevos registros." />
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>OS</th><th>Fecha</th><th>Equipo</th><th>Bus</th><th>Estado</th><th>Ubicación</th><th>Responsable</th></tr></thead>
              <tbody>{data.items.map((order: OrdenServicio) => (
                <tr key={order.codigo_os} data-health={healthFromMaintenanceState(order.estado_id)}>
                  <td><strong>{order.codigo_os}</strong>{order.ticket_aranda ? <div className="small muted">Ref. {order.ticket_aranda}</div> : null}</td>
                  <td>{formatDate(order.fecha)}</td>
                  <td>{order.tipo_equipo}<div className="small muted">{order.serie}</div><div className="small muted">{order.modelo} · {order.marca}</div></td>
                  <td>{order.bus_ppu || "Sin bus asociado"}</td>
                  <td><StatusBadge health={healthFromMaintenanceState(order.estado_id)}>{formatOperationalStatus(order.estado_nombre)}</StatusBadge></td>
                  <td>{order.ubicacion_nombre || "—"}</td>
                  <td>{order.tecnico_laboratorio || order.tecnico_terreno || "Sin asignar"}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}

        {!loading&&!error&&<footer className="pagination-bar">
          <span className="small muted">Página {page} de {pages} · {data.pagination.total} registros</span>
          <div className="toolbar-group">
            <button className="btn ghost" disabled={loading || data.pagination.offset === 0} onClick={() => void load(Math.max(0, data.pagination.offset - data.pagination.limit))}>Anterior</button>
            <button className="btn ghost" disabled={loading || data.pagination.offset + data.pagination.limit >= data.pagination.total} onClick={() => void load(data.pagination.offset + data.pagination.limit)}>Siguiente</button>
          </div>
        </footer>}
      </section>
    </div>
  );
}
