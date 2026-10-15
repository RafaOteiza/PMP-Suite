import {pagedReport} from '../utils/pageReports';
import { useCallback, useEffect, useState } from "react";
import { AlertCircle, Bus, ChevronLeft, ChevronRight, Cpu, Info, Monitor, RefreshCw, Search } from "lucide-react";
import { getEquiposOperativos, type EquipoOperativo } from "../api/dashboard";
import EmptyState from "../components/ui/EmptyState";
import FeedbackBanner from "../components/ui/FeedbackBanner";
import PageHeader from "../components/ui/PageHeader";
import StatusBadge from "../components/ui/StatusBadge";
import { formatDate } from "../utils/formatters";

export default function EquiposOperativosPage() {
  const [data, setData] = useState<EquipoOperativo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const limit = 20;

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getEquiposOperativos(searchTerm, page * limit);
      setData(response.data);
      setTotal(response.pagination.total);
    } catch (requestError: any) {
      console.error("Error loading operativos:", requestError);
      setError(requestError.response?.data?.error || "Error cargando datos de la API");
    } finally {
      setLoading(false);
    }
  }, [searchTerm, page]);

  useEffect(() => {
    const delay = window.setTimeout(loadData, 500);
    return () => window.clearTimeout(delay);
  }, [loadData]);

  return (
    <div className="page">

      <PageHeader report={pagedReport('Equipos en operacion','/api/dashboard/equipos-operativos',{q:searchTerm},loading||!!error,'data')}
        eyebrow="Activos instalados"
        title="Equipos en operación"
        description="Validadores y consolas instalados, operativos y sin reportes de falla activos."
        icon={<Bus size={21} />}
        actions={<><div className="search page-search"><Search size={17} /><input type="search" placeholder="Serie o PPU…" value={searchTerm} onChange={(event) => { setSearchTerm(event.target.value); setPage(0); }} aria-label="Buscar equipos" /></div><button onClick={loadData} className="icon-btn" disabled={loading} aria-label="Actualizar equipos"><RefreshCw size={18} className={loading ? "animate-spin" : ""} /></button></>}
      />

      {error ? <FeedbackBanner tone="danger"><strong>{error}</strong></FeedbackBanner> : null}
      <div className="feedback-banner" role="status"><div className="feedback-banner-content"><Info size={18} /><span>La vista incluye exclusivamente activos instalados en buses y actualmente operativos.</span></div></div>

      <section className="panel">
        {loading && data.length === 0 ? (
          <div className="table-skeleton">{Array.from({ length: 6 }, (_, index) => <div className="skeleton" style={{ height: 48 }} key={index} />)}</div>
        ) : error ? null : data.length === 0 ? (
          <EmptyState icon={<AlertCircle size={24} />} title="Sin equipos operativos" description="No se encontraron activos que coincidan con los filtros aplicados." />
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Tipo</th><th>Serie</th><th>Modelo / marca</th><th>Bus (PPU)</th><th>Última operación</th><th>Estado</th></tr></thead>
              <tbody>{data.map((equipment) => (
                <tr key={`${equipment.tipo}:${equipment.serie}`}>
                  <td><span className="inline-icon">{equipment.tipo === "VALIDADOR" ? <Cpu size={17} /> : <Monitor size={17} />}<strong>{equipment.tipo}</strong></span></td>
                  <td><span className="mono-value">{equipment.serie}</span></td>
                  <td>{equipment.modelo}<div className="small muted">{equipment.marca}</div></td>
                  <td>{equipment.bus_ppu ? <span className="inline-icon"><Bus size={15} />{equipment.bus_ppu}</span> : <span className="muted">Sin PPU registrada</span>}</td>
                  <td>{formatDate(equipment.ultima_operacion, "N/D")}</td>
                  <td><StatusBadge health="flow">En operación</StatusBadge></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}

        {!error&&!loading&&<footer className="pagination-bar">
          <div className="small muted">Mostrando {data.length} de {total} activos</div>
          <div className="toolbar-group">
            <button className="icon-btn" disabled={page === 0 || loading} onClick={() => setPage(page - 1)} aria-label="Página anterior"><ChevronLeft size={19} /></button>
            <span className="pagination-current">Página {page + 1}</span>
            <button className="icon-btn" disabled={(page + 1) * limit >= total || loading} onClick={() => setPage(page + 1)} aria-label="Página siguiente"><ChevronRight size={19} /></button>
          </div>
        </footer>}
      </section>
    </div>
  );
}
