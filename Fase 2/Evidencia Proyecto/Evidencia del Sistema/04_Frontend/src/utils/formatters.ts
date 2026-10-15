const OPERATIONAL_STATUS_LABELS: Record<string, string> = {
  PENDIENTE_ASIGNACION: "Pendiente de asignación",
  ASIGNADA: "Asignada",
  EN_TERRENO: "En terreno",
  COMPLETADA: "Completada",
  CANCELADA: "Cancelada",
  EN_RUTA: "En ruta",
  ASIGNADO_TECNICO: "Asignado a técnico",
  PENDIENTE_SALIDA: "Pendiente de salida",
  DISPONIBLE_INSTALACION: "Disponible para instalación",
  PENDIENTE_VERIFICACION_BODEGA: "Pendiente de verificar disponibilidad",
  EN_TRANSITO: "En tránsito",
  EN_TRAYECTO_BODEGA: "En trayecto a bodega",
  RECIBIDO_BODEGA: "Recibido en bodega",
  EN_BODEGA: "En bodega",
  BODEGA_MERSAN: "Bodega Mersan",
  LABORATORIO: "Laboratorio",
  EN_DIAGNOSTICO: "En diagnóstico",
  DIAGNOSTICO: "Diagnóstico",
  EN_REPARACION: "En reparación",
  REPARACION: "Reparación",
  ESPERA_REPUESTO: "Espera de repuesto",
  ESPERANDO_REPUESTO: "Esperando repuesto",
  EN_QA: "En QA",
  PENDIENTE_QA: "Pendiente QA",
  FINALIZADO_TALLER: "Finalizado taller",
  DISPONIBLE: "Disponible para instalación",
  INSTALADO: "Instalado",
  CERRADA: "Cerrada",
  APROBADO: "Aprobado",
  RECHAZADO: "Rechazado"
};

const ACRONYMS = new Set(["QA", "OS", "PMP", "PST", "SLA", "ID", "UID"]);

export type DateValue = string | number | Date | null | undefined;

const parseDateValue = (value: DateValue): Date | null => {
  if (value === null || value === undefined || value === "" || value === 0) return null;
  if (typeof value === "string" && !value.trim()) return null;

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatDateValue = (value: DateValue, options: Intl.DateTimeFormatOptions, fallback: string) => {
  const date = parseDateValue(value);
  return date ? new Intl.DateTimeFormat("es-CL", options).format(date) : fallback;
};

export const formatDate = (value: DateValue, fallback = "Sin fecha") =>
  formatDateValue(value, { day: "2-digit", month: "2-digit", year: "numeric" }, fallback);

export const formatDateTime = (value: DateValue, fallback = "Sin fecha") =>
  formatDateValue(value, { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }, fallback);

export const formatTime = (value: DateValue, fallback = "Sin hora") =>
  formatDateValue(value, { hour: "2-digit", minute: "2-digit" }, fallback);

const toStatusKey = (value: string) => value
  .trim()
  .replace(/[\s-]+/g, "_")
  .replace(/_+/g, "_")
  .toUpperCase();

export const formatOperationalStatus = (value?: string | null, fallback = "Sin estado") => {
  if (!value?.trim()) return fallback;
  const key = toStatusKey(value);
  const knownLabel = OPERATIONAL_STATUS_LABELS[key];
  if (knownLabel) return knownLabel;

  return key.split("_").map((word, index) => {
    if (ACRONYMS.has(word)) return word;
    const lower = word.toLocaleLowerCase("es-CL");
    return index === 0 ? `${lower.charAt(0).toLocaleUpperCase("es-CL")}${lower.slice(1)}` : lower;
  }).join(" ");
};
