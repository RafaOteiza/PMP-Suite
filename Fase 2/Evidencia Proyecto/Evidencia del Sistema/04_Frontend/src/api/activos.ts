import { api } from './http';
export type AssetType = 'VALIDADOR' | 'CONSOLA';
export interface RegisteredAsset {
  tipo_equipo: AssetType; serie: string; modelo: string | null; marca: string | null;
  bus_ppu?: string | null; estado_actual: string; ultima_os?: string | null;
  puede_iniciar_recepcion: boolean;
}
export interface AssetRegistration {
  tipo_equipo: AssetType; serie: string; modelo?: string; marca?: string;
  origen: string; fecha_ingreso: string; observacion?: string;
}
export const searchAssets = async (params: {tipo_equipo: AssetType; q?: string; bus_ppu?: string}, signal?: AbortSignal) =>
  (await api.get<RegisteredAsset[]>('/api/activos', {params, signal})).data;
export const registerAsset = async (body: AssetRegistration) => (await api.post<RegisteredAsset>('/api/activos', body)).data;
export type ReceptionCapture = 'MANUAL'|'SCANNER'|'MANUAL_AUTORIZADO';
export const validateAssetReception = async (body: {tipo_equipo: AssetType; serie: string; codigo: string; origen_captura: ReceptionCapture; presencia_fisica_confirmada?:boolean;lectura_scanner?:{tipo:'KEYBOARD_WEDGE';intervalos_ms:number[]}}) =>
  (await api.post<{escaneo:{id:string}|null; validacion?:{id:string}; elegible:boolean}>('/api/activos/recepcion/validar', body)).data;
export const startAssetReception = async (body: {tipo_equipo: AssetType; serie: string; escaneo_id?:string; validacion_id?:string; validacion_inicial_conforme:boolean; observacion?: string}) =>
  (await api.post<{estado_actual:string;stock_origen_evento:string}>('/api/activos/recepcion', body)).data;
