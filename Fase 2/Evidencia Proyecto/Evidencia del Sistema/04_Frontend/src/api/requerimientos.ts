import { api } from './http';
import type { Asset, ExternalReference } from './bridge';

export interface CaseOrder extends Asset {
  validador_serie?: string;
  consola_serie?: string;
  codigo_os: string;
  es_instalacion?: boolean;
  es_pod?: boolean;
  estado_id?: number;
  os_origen?: string;
  fecha?: string;
  estado?: string;
  estado_nombre?: string;
  bus_ppu?: string;
  terminal?: string;
  tecnico_nombre?: string;
}
export interface OperationalCase {
  id: string;
  codigo_caso: string;
  origen: string;
  referencia_externa?: string;
  tipo_equipo: Asset['tipo_equipo'];
  serie_origen: string;
  bus_ppu: string;
  terminal_id?: number;
  terminal?: string;
  pst_codigo?: string;
  falla_reportada: string;
  observacion?: string;
  fecha_requerimiento?: string;
  ordenes: CaseOrder[];
}
export interface CaseHistory {
  caso: OperationalCase;
  ordenes: CaseOrder[];
  referencias: ExternalReference[];
  eventos: Array<{id: string; codigo_os: string; fecha: string; tipo: string; titulo?: string; descripcion?: string; comentario?: string; detalle?: Record<string, unknown>}>;
}
export interface RequestPayload {
  origen: 'ARANDA' | 'INTERNO';
  referencia_externa?: string;
  tipo_equipo: Asset['tipo_equipo'];
  serie: string;
  bus_ppu: string;
  terminal_id?: number;
  pst_codigo?: string;
  falla: string;
  observacion?: string;
  fecha_requerimiento: string;
  clasificacion: 'MANTENCION' | 'POD';
}
export const caseHistoryUrl = (id: string) => `/trazabilidad?caso=${encodeURIComponent(id)}`;
export const getCases = async (q = '', signal?: AbortSignal) => (await api.get<OperationalCase[]>('/api/requerimientos', { params: { q }, signal })).data;
export const getCaseHistory = async (id: string, signal?: AbortSignal) => (await api.get<CaseHistory>(`/api/requerimientos/${encodeURIComponent(id)}`, { signal })).data;
export const createRequest = async (payload: RequestPayload) => (await api.post<{caso: OperationalCase; os: CaseOrder}>('/api/requerimientos', payload)).data;
export interface RequirementAsset extends Asset {
  modelo: string|null; marca: string|null; bus_ppu: string; terminal_id: number; terminal: string|null;
  pst_codigo: string; operador: string|null; estado_actual: 'EN_OPERACION';
}
export interface ActiveRequirement {codigo_os:string;caso_id?:string;referencia_ar?:string;bus_ppu:string;falla:string;estado_actual:string;tecnico?:string;}
export interface SearchPage<T> {items:T[];has_more:boolean;limit:number;offset:number;}
export const searchRequirementAssets=async(params:{tipo_equipo:Asset['tipo_equipo'];q?:string;bus_ppu?:string;bus_exacto?:boolean;offset?:number;limit?:number},signal?:AbortSignal)=>(await api.get<SearchPage<RequirementAsset>>('/api/requerimientos/operativos',{params,signal})).data;
export const searchRequirementBuses=async(params:{tipo_equipo:Asset['tipo_equipo'];bus_ppu:string},signal?:AbortSignal)=>(await api.get<SearchPage<{bus_ppu:string}>>('/api/requerimientos/buses',{params,signal})).data;
export const getActiveRequirements=async(tipo_equipo:Asset['tipo_equipo'],serie:string,signal?:AbortSignal)=>(await api.get<ActiveRequirement[]>('/api/requerimientos/intervenciones-activas',{params:{tipo_equipo,serie},signal})).data;
export const derivePod = async (id: string, codigo_os: string) => (await api.post(`/api/requerimientos/${encodeURIComponent(id)}/pod`, { codigo_os })).data;
export async function getRequestCatalogs() {
  const [terminals, operators] = await Promise.all([
    api.get<Array<{id: number; nombre: string}>>('/api/master/terminales'),
    api.get<Array<{codigo: string; nombre: string}>>('/api/master/psts')
  ]);
  return { terminales: terminals.data, psts: operators.data };
}

export interface DispatchDestination {bus_ppu:string;terminal_id:number|null;pst_codigo:string|null;terminal:string|null;operador:string|null;}
export const getDispatchDestinations=async(q='')=>(await api.get<DispatchDestination[]>('/api/bodega/despacho/destinos',{params:{q}})).data;
export interface DispatchContext {
  contexto_instalacion?: 'NUEVA'|'REQUERIMIENTO';
  caso_id?: string;
  os_origen?: string;
  tecnico_terreno_id?:string;bus_ppu?:string;terminal_id?:number;pst_codigo?:string;
  tipo_equipo: Asset['tipo_equipo'];
}
export interface DispatchValidation {
  equipo: Asset & { modelo: string | null; marca?: string | null };
  stock: { codigo_os: string | null; es_aprobado_qa?: boolean; ubicacion?: string; validacion_inicial_conforme?: boolean };
  escaneo?: { id: string | number } | null;
  validacion?: { id: string | number };
  elegible: boolean;
}
export const validateDispatch = async (payload: DispatchContext & { codigo: string; origen_captura: 'SCANNER' | 'MANUAL'|'MANUAL_AUTORIZADO';presencia_fisica_confirmada?:boolean;lectura_scanner?:import('../utils/receiptScanner').ScannerProof;motivo?:string }) => (await api.post<DispatchValidation>('/api/bodega/despacho/validar', payload)).data;
export const confirmDispatch = async (payload: DispatchContext & { escaneo_id?: string | number;validacion_id?:string|number; tecnico_terreno_id: string; bus_ppu: string; terminal_id?: number; pst_codigo?: string }) => (await api.post<{os: CaseOrder; caso: OperationalCase|null;reutilizado?:boolean}>('/api/bodega/despacho/confirmar', payload)).data;
