import { api } from './http';
export type BridgeState = 'PENDIENTE_ASIGNACION' | 'ASIGNADA' | 'EN_TERRENO' | 'COMPLETADA' | 'CANCELADA'; // historical states only
export interface Asset { tipo_equipo: 'VALIDADOR' | 'CONSOLA'; serie: string; modelo?:string|null; marca?:string|null }
export interface ExternalReference extends Asset {
  id: string; codigo_os: string; sistema_externo: string; referencia_externa: string; fecha: string; comentario?: string;
}
export interface AssetHistory extends Asset {
  ordenes: Array<{codigo_os: string; fecha: string; estado: string; falla: string; ubicacion?: string; ticket_aranda?: string; caso_id?: string; codigo_caso?: string; os_origen?: string}>;
  referencias: ExternalReference[];
  eventos: Array<{id: string; codigo_os?: string; fecha: string; tipo: string; titulo?: string; comentario?: string; descripcion: string; cambios: Array<{campo:string;anterior:string;actual:string}>; detalle: Record<string, unknown>}>;
}
export const assetHistoryUrl = (asset: Asset) => `/trazabilidad?tipo=${encodeURIComponent(asset.tipo_equipo)}&serie=${encodeURIComponent(asset.serie)}`;
export const searchAssets = async (q: string, signal?: AbortSignal) => (await api.get<Asset[]>('/api/bridge/buscar',{params:{q},signal})).data;
export const getAssetHistory = async (asset: Asset, signal?: AbortSignal) => (await api.get<AssetHistory>(`/api/bridge/activos/${encodeURIComponent(asset.tipo_equipo)}/${encodeURIComponent(asset.serie)}/historial`,{signal})).data;
export const getReferences = async () => (await api.get<ExternalReference[]>('/api/bridge')).data;
export const createReference = async (payload: Asset & {codigo_os:string; sistema_externo:string; referencia_externa:string; comentario?:string}) => (await api.post('/api/bridge',payload)).data;
