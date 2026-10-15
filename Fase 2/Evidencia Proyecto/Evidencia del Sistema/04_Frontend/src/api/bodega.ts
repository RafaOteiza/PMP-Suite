import { api } from "./http";

export interface LogisticsAsset {
  tipo_equipo: 'VALIDADOR' | 'CONSOLA'; serie: string; modelo: string | null; marca: string | null;
  procedencia: string; origen_registro: string | null; fecha: string | null; codigo_os: string | null;
  bus_ppu: string | null; etapa: string; estado_actual: string; ubicacion_actual: string;
  disponible: boolean; en_bodega: boolean; escaneado_bodega: boolean;
}
export interface LogisticsInventory {
  resumen: { total: number; validadores: number; consolas: number; bodega: number; disponibles: number; noDisponibles: number };
  distribucion: { etapa: string; label: string; validadores: number; consolas: number; total: number }[];
  secundarios: { instalaciones: number; recepciones: number; despachos: number; alertasStock: number };
  filtros: { modelos: string[]; origenes: string[]; estados: string[] };
  items: LogisticsAsset[]; totalFiltrado: number; limit: number; offset: number;
  recientes: {id:string;fecha:string;codigo_os:string|null;tipo_equipo:string;serie:string;titulo:string}[];
}
export async function getLogisticsInventory(params: Record<string,string> = {}, signal?: AbortSignal): Promise<LogisticsInventory> {
  return (await api.get('/api/bodega/inventario', { params, signal })).data;
}

export interface BodegaTicket {
  codigo_os: string;
  fecha: string;
  falla: string;
  estado_id: number;
  estado_nombre: string;
  bus_ppu: string;
  serie: string;
  tipo_equipo: string;
  modelo?:string; marca?:string; terminal?:string; operador?:string; tecnico_retiro?:string; codigo_caso?:string; referencia_ar?:string;
  tecnico_laboratorio?:string;trabajo_tecnico?:{resultado?:string;observaciones_qa?:string;pruebas?:{nombre:string;resultado:string;observacion?:string}[]};
  es_aprobado_qa?: boolean | null;
  escaneado_bodega?: boolean;
  fue_laboratorio: boolean;          // Si ya pasó por reparación en Lab
  origen_transito: 'terreno' | 'laboratorio' | 'qa_rechazado'; // Origen del equipo en tránsito
}

export interface BodegaStockItem extends Omit<BodegaTicket, 'codigo_os' | 'estado_id' | 'bus_ppu'> {
  codigo_os: string | null;
  estado_id: number | null;
  bus_ppu: string | null;
  stock_origen_evento?: string;
  validacion_inicial_conforme?: boolean;
}
export interface StockData {
  listos: BodegaStockItem[];
  inventario: {
    validadores: number;
    consolas: number;
    total: number;
  };
}

export interface Repuesto {
  id: number;
  nombre: string;
  categoria: string;
  stock: number;
  stock_critico: number;
  diferencia: number;
}

export interface SolicitudRepuesto {
  repuesto_solicitado?: string; comentario?: string; tecnico?: string; tipo_equipo?:string; serie?:string;
  id: number;
  codigo_os: string;
  estado: string;
  fecha_solicitud: string;
}

export interface TecnicoTerreno {
  id: string;
  nombre: string;
  apellido: string;
}

export interface QaUser {
  id: string;
  nombre: string;
  apellido: string;
}

export interface BodegaDashboardData {
  alertasStock: number;
  distribucionEstados: { name: string, value: number, estado_id: number | null }[];
  equiposEnRuta: number;
  equiposAsignados: number;
}

export async function getBodegaQueue(): Promise<BodegaTicket[]> {
  const { data } = await api.get("/api/bodega/queue");
  return data;
}

export async function getBodegaStock(): Promise<StockData> {
  const { data } = await api.get("/api/bodega/stock");
  return data;
}

export type WarehouseCapture = 'SCANNER'|'MANUAL'|'MANUAL_AUTORIZADO';
export interface WarehouseEvidence {equipo?:{serie:string;tipo_equipo?:string};esperado?:{serie:string};coincide?:boolean;escaneo?:{id:string|number}|null;validacion?:{id:string|number};elegible:boolean;}
export const validateTerrainReceipt=async(body:{codigo_os:string;tipo_equipo:string;codigo:string;origen_captura:WarehouseCapture;presencia_fisica_confirmada:boolean;motivo?:string;lectura_scanner?:{tipo:'KEYBOARD_WEDGE';intervalos_ms:number[]}})=>(await api.post<WarehouseEvidence>('/api/bodega/recepcion-terreno/validar',body)).data;
export async function receiveInBodega(codigo_os: string,evidence?:{escaneo_id?:string|number;validacion_id?:string|number}): Promise<void> {
  await api.put("/api/bodega/receive", { codigo_os,...evidence });
}

export async function dispatchToLab(codigo_os: string, evidence?:{validacion_id?:string|number}): Promise<void> {
  await api.put("/api/bodega/dispatch-lab", { codigo_os,...evidence });
}

export async function getQaUsers(): Promise<QaUser[]> {
  const { data } = await api.get("/api/bodega/qa-users");
  return data;
}

export async function dispatchToQa(codigo_os: string, evidence?:{validacion_id?:string|number}): Promise<void> {
  await api.put("/api/bodega/dispatch-qa", { codigo_os,...evidence });
}

export async function getRepuestos(): Promise<{repuestos: Repuesto[], solicitudes: SolicitudRepuesto[]}> {
  const { data } = await api.get("/api/bodega/repuestos");
  return data;
}

export async function entregarRepuesto(solicitudId: number, entrega:{repuesto_id:number;cantidad:number}): Promise<void> {
  await api.put(`/api/bodega/solicitudes/${solicitudId}/entregar`, entrega);
}

export async function getTecnicosTerreno(): Promise<TecnicoTerreno[]> {
  const { data } = await api.get("/api/bodega/tecnicos");
  return data;
}

export async function getBodegaDashboard(): Promise<BodegaDashboardData> {
  const { data } = await api.get("/api/bodega/dashboard");
  return data;
}

export const validateLabDispatch=async(body:Parameters<typeof validateTerrainReceipt>[0])=>(await api.post<WarehouseEvidence>('/api/bodega/dispatch-lab/validar',body)).data;

export const validateQaDispatch=async(body:Parameters<typeof validateTerrainReceipt>[0])=>(await api.post<WarehouseEvidence>('/api/bodega/dispatch-qa/validar',body)).data;
