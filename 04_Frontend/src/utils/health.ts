import type { BridgeState } from "../api/bridge";

export type SemanticState = "success" | "warning" | "danger" | "info" | "flow" | "neutral";
export type HealthState = SemanticState;

export interface HealthPresentation {
  label: string;
  icon: "check-circle" | "alert-triangle" | "alert-circle" | "info" | "activity" | "circle";
  color: string;
  background: string;
  border: string;
  text: string;
  accent: string;
}

const presentation: Record<HealthState, HealthPresentation> = {
  success: {
    label: "Correcto",
    icon: "check-circle",
    color: "var(--status-success)",
    background: "var(--status-success-bg)",
    border: "var(--status-success-border)",
    text: "var(--status-success-text)",
    accent: "var(--status-success)"
  },
  warning: {
    label: "Atención",
    icon: "alert-triangle",
    color: "var(--status-warning)",
    background: "var(--status-warning-bg)",
    border: "var(--status-warning-border)",
    text: "var(--status-warning-text)",
    accent: "var(--status-warning)"
  },
  danger: {
    label: "Crítico",
    icon: "alert-circle",
    color: "var(--status-danger)",
    background: "var(--status-danger-bg)",
    border: "var(--status-danger-border)",
    text: "var(--status-danger-text)",
    accent: "var(--status-danger)"
  },
  info: {
    label: "En curso",
    icon: "info",
    color: "var(--status-info)",
    background: "var(--status-info-bg)",
    border: "var(--status-info-border)",
    text: "var(--status-info-text)",
    accent: "var(--status-info)"
  },
  flow: {
    label: "Flujo técnico",
    icon: "activity",
    color: "var(--status-flow)",
    background: "var(--status-flow-bg)",
    border: "var(--status-flow-border)",
    text: "var(--status-flow-text)",
    accent: "var(--status-flow)"
  },
  neutral: {
    label: "Neutral",
    icon: "circle",
    color: "var(--status-neutral)",
    background: "var(--status-neutral-bg)",
    border: "var(--status-neutral-border)",
    text: "var(--status-neutral-text)",
    accent: "var(--status-neutral)"
  }
};

export const getHealthPresentation = (state: HealthState) => presentation[state];

export interface ExistingSlaState {
  vencido: boolean;
  critico: boolean;
  sinSla?: boolean;
}

export const healthFromSla = (sla?: ExistingSlaState | null): HealthState => {
  if (!sla || sla.sinSla) return "neutral";
  if (sla.vencido) return "danger";
  if (sla.critico) return "warning";
  return "success";
};

export const slaHealthLabel = (sla?: ExistingSlaState | null) => {
  if (!sla || sla.sinSla) return "Sin SLA";
  if (sla.vencido) return "SLA vencido";
  if (sla.critico) return "Próximo a vencer";
  return "Dentro de SLA";
};

export const healthFromBridgeState = (state: BridgeState): HealthState => {
  if (state === "COMPLETADA") return "success";
  if (state === "CANCELADA") return "danger";
  if (state === "PENDIENTE_ASIGNACION") return "warning";
  if (state === "EN_TERRENO") return "info";
  return "info";
};

export const healthFromMaintenanceState = (stateId: number): HealthState => {
  if (stateId === 7) return "warning";
  if (stateId === 10) return "info";
  if (stateId === 12 || stateId === 13) return "success";
  if (stateId === 8) return "danger";
  if (stateId === 9) return "warning";
  if ([1, 2, 3, 4, 5, 6, 11].includes(stateId)) return "info";
  return "neutral";
};

export const healthFromStatusName = (status?: string | null): HealthState => {
  const normalized = (status || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase().replace(/_/g, " ");
  // Presentation only: precedence prevents "No disponible" or "No aprobado" from turning green.
  if (["SIN DATOS", "SIN MEDICION", "NO APLICA", "INACTIVO", "NO REGISTRAD"].some(term=>normalized.includes(term))) return "neutral";
  if (["SIN FALLA", "SIN PENDIENTES"].includes(normalized) || normalized === 'SIN FALLA ENCONTRADA') return "success";
  if (["RECHAZ", "FUERA DE SERVICIO", "ERROR", "BLOQUEAD", "CRITIC", "VENCID", "NO APROBAD", "NO OPERATIVO", "NO REPARABLE", "FALLA", "CANCELAD"].some(term=>normalized.includes(term))) return "danger";
  if (["NO DISPONIBLE", "NO DISPONIBLES", "NO COMPLET", "NO VALIDADO", "PENDIENTE", "POR VERIFICAR", "SIN ASIGNAR", "ESPERA", "OBSERVACION", "RIESGO MEDIO", "RETRAB"].some(term=>normalized.includes(term))) return "warning";
  if (["DISPONIBLE", "LISTO", "FINALIZADO", "CERRAD", "APROBAD", "OPERATIVO", "EN OPERACION", "COMPLET", "INSTALADO", "VALIDADO", "REPARADO"].some(term=>normalized.includes(term))) return "success";
  if (["VALIDACION", "VERIFICACION"].some(term=>normalized.includes(term))) return "warning";
  if (["RUTA", "TRANSITO", "TRAYECTO", "BODEGA", "DIAGNOST", "REPARACION", "LABORATORIO", "QA", "ASIGNAD", "EN CURSO", "RECEPCION", "AMBIENTE", "PRUEBAS", "DESPACHO"].some(term=>normalized.includes(term))) return "info";
  return "neutral";
};

export const healthFromQaResult = (result?: "APROBADO" | "RECHAZADO" | null): HealthState => {
  if (result === "APROBADO") return "success";
  if (result === "RECHAZADO") return "danger";
  return "info";
};

export const healthFromStock = (stock: number, criticalLevel: number): HealthState => {
  if (stock <= 0) return "danger";
  if (stock <= criticalLevel) return "warning";
  return "success";
};
