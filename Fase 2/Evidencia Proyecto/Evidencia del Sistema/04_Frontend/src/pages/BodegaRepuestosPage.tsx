import {localReport} from '../utils/pageReports';
import FeedbackBanner from "../components/ui/FeedbackBanner";
import { useEffect, useState } from "react";
import { useOutletContext, useSearchParams } from "react-router-dom";
import { AlertTriangle, CheckCircle, Cpu, Monitor, PackageSearch, RefreshCw, Wrench } from "lucide-react";
import type { Me } from "../api/me";
import { entregarRepuesto, getRepuestos, type Repuesto, type SolicitudRepuesto } from "../api/bodega";
import { can, PERMISSIONS } from "../app/rbac";
import { getApiErrorMessage } from "../api/errors";
import { useAlert } from "../hooks/useAlert";
import InlineFeedback from "../components/InlineFeedback";
import EmptyState from "../components/ui/EmptyState";
import PageHeader from "../components/ui/PageHeader";
import StatusBadge from "../components/ui/StatusBadge";
import { healthFromStock } from "../utils/health";
import { formatDateTime, formatOperationalStatus } from "../utils/formatters";

export default function BodegaRepuestosPage() {
  const me = useOutletContext<Me | null>();
  const canWrite = can(me, PERMISSIONS.BODEGA_WRITE);
  const [repuestos, setRepuestos] = useState<Repuesto[]>([]);
  const [solicitudes, setSolicitudes] = useState<SolicitudRepuesto[]>([]);
  const [loadError,setLoadError]=useState('');
  const [loading, setLoading] = useState(true);
  const [delivery,setDelivery]=useState<number|null>(null),[partId,setPartId]=useState(''),[quantity,setQuantity]=useState('');
  const [processing, setProcessing] = useState<number | null>(null);
  const { feedback, showConfirm, showAlert, closeAlert } = useAlert();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "solicitudes";

  const load = async () => {
    setLoading(true);setLoadError('');
    try { const data = await getRepuestos(); setRepuestos(data.repuestos); setSolicitudes(data.solicitudes); }
    catch (error) { setLoadError(getApiErrorMessage(error)); } finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);

  const handleEntregar = async (id: number) => {
    if (!canWrite || !partId || !Number.isInteger(Number(quantity)) || Number(quantity)<1) return;
    const entrega={repuesto_id:Number(partId),cantidad:Number(quantity)};
    const part=repuestos.find(p=>p.id===entrega.repuesto_id);
    showConfirm("Confirmar entrega", `¿Confirmar entrega física de ${part?.nombre} × ${entrega.cantidad}? Se descontará el stock desde Bodega.`, async () => {
      closeAlert(); setProcessing(id);
      try { await entregarRepuesto(id,entrega); setDelivery(null); await load(); showAlert("success", "Repuesto entregado", "La solicitud fue procesada y el equipo volvió a taller."); }
      catch (error) { showAlert("error", "Error", getApiErrorMessage(error, "Hubo un problema al procesar la entrega de repuestos.")); }
      finally { setProcessing(null); }
    });
  };

  const category = activeTab === "validador" ? "VALIDADOR" : "CONSOLA";
  const categoryParts = repuestos.filter((part) => part.categoria === category);
  const CategoryIcon = category === "VALIDADOR" ? Cpu : Monitor;

  return (
    <>
      <InlineFeedback isOpen={canWrite && feedback.isOpen} type={feedback.type} title={feedback.title} message={feedback.message} onConfirm={feedback.onConfirm} onCancel={closeAlert} confirmText={feedback.confirmText} />
      <div className="page">

        <PageHeader report={localReport('Repuestos y stock',activeTab==='solicitudes'?solicitudes:categoryParts,loading||!!loadError,{bandeja:activeTab})} eyebrow="Inventario técnico" title="Inventario de repuestos" description="Control de existencias y solicitudes originadas en laboratorio." icon={<Wrench size={21} />} actions={<button onClick={load} className="btn ghost" disabled={loading}><RefreshCw size={17} className={loading ? "animate-spin" : ""} /> Actualizar</button>} />

        {loadError&&<FeedbackBanner tone="danger">{loadError}</FeedbackBanner>}
        {loading?<p role="status">Consultando inventario…</p>:loadError?null:<><div className="operation-tabs" role="tablist" aria-label="Secciones de repuestos">
          <button role="tab" aria-selected={activeTab === "solicitudes"} data-active={activeTab === "solicitudes"} data-health={solicitudes.length > 0 ? "warning" : "success"} onClick={() => setSearchParams({ tab: "solicitudes" })}><AlertTriangle size={16} /><span>Solicitudes</span><span className="tab-count">{solicitudes.length}</span></button>
          <button role="tab" aria-selected={activeTab === "validador"} data-active={activeTab === "validador"} onClick={() => setSearchParams({ tab: "validador" })}><Cpu size={16} /><span>Validadores</span><span className="tab-count">{repuestos.filter((part) => part.categoria === "VALIDADOR").length}</span></button>
          <button role="tab" aria-selected={activeTab === "consola"} data-active={activeTab === "consola"} onClick={() => setSearchParams({ tab: "consola" })}><Monitor size={16} /><span>Consolas</span><span className="tab-count">{repuestos.filter((part) => part.categoria === "CONSOLA").length}</span></button>
        </div>

        {activeTab === "solicitudes" ? (
          <section className="panel parts-requests">
            <div className="section-heading"><div><h2 className="section-title">Solicitudes pendientes</h2><p className="small muted">Repuestos requeridos para reactivar reparaciones pausadas.</p></div><StatusBadge health={solicitudes.length > 0 ? "warning" : "success"}>{solicitudes.length > 0 ? `${solicitudes.length} pendientes` : "Sin pendientes"}</StatusBadge></div>
            {solicitudes.length === 0 ? <EmptyState icon={<CheckCircle size={24} />} title="Solicitudes al día" description="No hay requerimientos pendientes del laboratorio." health="success" /> : (
              <div className="request-grid">{solicitudes.map((request) => <article className="request-card" data-health="warning" key={request.id}><div><strong>{request.codigo_os}</strong><StatusBadge health="warning">{formatOperationalStatus(request.estado)}</StatusBadge></div><span>Solicitado {formatDateTime(request.fecha_solicitud)}</span>{request.repuesto_solicitado&&<strong>{request.repuesto_solicitado}</strong>}{request.comentario&&<p>{request.comentario}</p>}{request.tecnico&&<span>{request.tecnico}</span>}{canWrite ? <button className="btn full" onClick={() => {setDelivery(request.id);setPartId('');setQuantity('');closeAlert();}} disabled={processing === request.id}>{processing === request.id ? <><RefreshCw className="animate-spin" size={16} /> Procesando…</> : "Atender solicitud"}</button> : <StatusBadge tone="neutral">Solo lectura</StatusBadge>}</article>)}</div>
            )}
            {canWrite&&delivery!==null&&<section className="operation-section" aria-label="Entrega de repuesto">
             <h3>Resolver solicitud y confirmar entrega</h3>
             <p>{solicitudes.find(r=>r.id===delivery)?.codigo_os} · {solicitudes.find(r=>r.id===delivery)?.tipo_equipo} {solicitudes.find(r=>r.id===delivery)?.serie}</p>
             <p className="muted">{solicitudes.find(r=>r.id===delivery)?.repuesto_solicitado} · {solicitudes.find(r=>r.id===delivery)?.comentario}</p>
             <div className="form-grid">
              <div className="field"><label className="field-label" htmlFor="delivery-part">Repuesto de inventario</label><select id="delivery-part" value={partId} onChange={e=>setPartId(e.target.value)} disabled={processing!==null}><option value="">Selecciona pieza</option>{repuestos.filter(p=>p.categoria===solicitudes.find(r=>r.id===delivery)?.tipo_equipo).map(p=><option key={p.id} value={p.id}>{p.nombre} · ID {p.id} · Stock {p.stock}</option>)}</select></div>
              <div className="field"><label className="field-label" htmlFor="delivery-quantity">Cantidad a entregar</label><input className="input" id="delivery-quantity" type="number" min={1} max={10000} value={quantity} onChange={e=>setQuantity(e.target.value)} disabled={processing!==null}/></div>
             </div>
             {partId&&Number(quantity)>Number(repuestos.find(p=>p.id===Number(partId))?.stock)&&<p role="alert">Stock insuficiente para la entrega.</p>}
             <div className="toolbar"><button className="btn ghost" onClick={()=>{setDelivery(null);closeAlert();}} disabled={processing!==null}>Cancelar</button><button className="btn" disabled={processing!==null||!partId||!Number.isInteger(Number(quantity))||Number(quantity)<1||Number(quantity)>10000||Number(quantity)>Number(repuestos.find(p=>p.id===Number(partId))?.stock)} onClick={()=>handleEntregar(delivery)}>Confirmar entrega física</button></div>
            </section>}
          </section>
        ) : (
          <section className="panel parts-stock">
            <div className="section-heading"><div><h2 className="section-title"><CategoryIcon size={19} /> Inventario · {category === "VALIDADOR" ? "Validador" : "Consola"}</h2><p className="small muted">Stock actual y umbrales críticos de componentes.</p></div><StatusBadge tone="neutral">{categoryParts.length} repuestos</StatusBadge></div>
            {categoryParts.length === 0 && !loading ? <EmptyState icon={<PackageSearch size={24} />} title="Sin repuestos registrados" /> : (
              <div className="table-wrap"><table><thead><tr><th>Repuesto</th><th>Stock actual</th><th>Estado</th></tr></thead><tbody>{categoryParts.map((part) => {
                const health = healthFromStock(part.stock, part.stock_critico);
                const status = health === "danger" ? "Sin stock" : health === "warning" ? `Bajo umbral (${part.stock_critico})` : "Stock correcto";
                return <tr key={part.id} data-health={health}><td><strong>{part.nombre}</strong></td><td><span className="stock-value">{part.stock}</span></td><td><StatusBadge health={health}>{status}</StatusBadge></td></tr>;
              })}</tbody></table></div>
            )}
          </section>
        )}
        </>}
      </div>
    </>
  );
}
