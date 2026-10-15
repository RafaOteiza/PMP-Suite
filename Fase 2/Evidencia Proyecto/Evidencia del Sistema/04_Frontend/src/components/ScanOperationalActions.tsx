import { Link } from 'react-router-dom';
import { useState, type ReactNode } from "react";
import {
  CheckCircle2,
  PackageCheck,
  RotateCcw,
  Send,
  UserPlus,
  Wrench
} from "lucide-react";
import type { ScanResolution } from "../api/equipmentScan";

import { getApiErrorMessage } from "../api/errors";
import { ROLES } from "../app/rbac";
import FeedbackBanner from "./ui/FeedbackBanner";
import StatusBadge from "./ui/StatusBadge";

interface ScanOperationalActionsProps {
  result: ScanResolution;
  role?: string;
  onCompleted: (message: string, keepContext: boolean) => Promise<void>;
  onBusyChange: (busy: boolean) => void;
  onOpenRepair: () => void;
  onReset: () => void;
}

export default function ScanOperationalActions({ result, role, onCompleted, onBusyChange, onOpenRepair, onReset }: ScanOperationalActionsProps) {
  const order = result.orden;
  const station = result.estacion.codigo;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const warehouseNeedsQa = station === "BODEGA"
    && order?.estado_id === 3
    && order.fue_laboratorio === true
    && order.es_aprobado_qa !== false;

  if (!order) return null;

  const run = async (operation: () => Promise<unknown>, message: string, keepContext: boolean) => {
    setBusy(true);
    onBusyChange(true);
    setError("");
    try {
      await operation();
      await onCompleted(message, keepContext);
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, "No fue posible completar la operación."));
    } finally {
      setBusy(false);
      onBusyChange(false);
    }
  };

  const shell = (title: string, description: string, content: ReactNode) => (
    <section className="panel scan-operational-action" aria-labelledby="scan-action-title">
      <header className="scan-action-header">
        <div><span className="dashboard-eyebrow">Siguiente acción</span><h2 id="scan-action-title">{title}</h2><p>{description}</p></div>
        <StatusBadge tone="primary">PASO 2 DE 2</StatusBadge>
      </header>
      {error ? <FeedbackBanner tone="danger">{error}</FeedbackBanner> : null}
      <div className="scan-action-body">{content}</div>
      <button type="button" className="btn ghost full scan-next-reading" onClick={onReset} disabled={busy}>
        <RotateCcw size={17} /> Preparar siguiente lectura
      </button>
    </section>
  );


  if (station === "BODEGA") {
    if ([2,11].includes(order.estado_id)) {
      return shell("Preparar recepción en Bodega", "Valida una evidencia nueva y confirma la recepción en la página operacional.",
        <Link className="btn full" to={`/bodega/recepciones/${encodeURIComponent(order.codigo_os)}`}>Validar recepción en Bodega</Link>);
    }
    if (order.estado_id === 3 && !warehouseNeedsQa) {
      return shell("Preparar envío a Laboratorio", "La salida requiere una validación física nueva y específica, distinta de la recepción.",
        <Link className="btn full" to="/bodega?tab=para-lab">Preparar envío a Laboratorio</Link>);
    }

    if (order.estado_id === 3 && warehouseNeedsQa) {
      return shell("Preparar envío a QA", "Destino: área QA. QA confirmará la recepción y tomará su trabajo de forma autónoma.",
        <Link className="btn full" to={`/bodega/envios-qa/${encodeURIComponent(order.codigo_os)}`}>Preparar envío a QA</Link>);
    }

    if (order.estado_id === 7 || (order.estado_id === 13 && order.es_aprobado_qa === true)) {
      return shell("Asignar y despachar a terreno", "Confirma cuando el equipo salga físicamente de Bodega. Seleccionar un técnico no confirma por sí solo la salida.", <>
        <p>Inicia el despacho con el caso de instalación y escanea el equipo que entregarás. La nueva OS IN se genera al confirmar.</p>
        <a className="btn full" href="/bodega/despacho"><UserPlus size={18} /> Despacho por escaneo</a>
      </>);
    }
  }

  if (station === "LABORATORIO") {
    if (role === ROLES.JEFE_LABORATORIO) {
      if (order.estado_id === 10) {
        return shell("Despachar equipo reparado", "La reparación terminó. Como jefe de laboratorio, confirma el despacho físico hacia Bodega.",
          <a className="btn full" href={`/lab/custodia/${encodeURIComponent(order.codigo_os)}/salida`}><Send size={18}/> Preparar salida a Bodega</a>);
      }
      return shell("Recepción de laboratorio confirmada", "El equipo quedó validado físicamente y ya puede ser trabajado por el técnico de laboratorio asignado.",
        <div className="scan-action-note"><PackageCheck size={20} /><span>Recepción registrada por jefatura de laboratorio</span></div>);
    }
    if (role === ROLES.TECNICO_LABORATORIO && [4, 5, 9].includes(order.estado_id)) {
      return shell("Gestionar reparación", "El equipo y la asignación técnica coinciden. Continúa el diagnóstico sin buscar nuevamente la OS.",
        <button type="button" className="btn full" onClick={onOpenRepair} disabled={busy}><Wrench size={18} /> Gestionar reparación</button>);
    }
  }

  if (station === "QA" && order.estado_id === 6) {
    return shell("Recepción QA confirmada", "La recepción no asigna ni certifica. Continúa con Tomar trabajo e Instalación Ambiente en QA.",
      <Link className="btn full" to="/qa">Ir a Control QA</Link>);
  }

  return shell("Lectura validada", "No existe otra acción operacional disponible para este estado en la estación actual.", <div className="scan-action-note"><CheckCircle2 size={20} /><span>El registro físico quedó guardado correctamente.</span></div>);
}
