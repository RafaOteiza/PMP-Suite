import type {RequirementAsset} from "./requerimientos";
import { api } from "./http";

export type PendingWithdrawal = {
  codigo_os:string;tipo_equipo:'VALIDADOR'|'CONSOLA';serie:string;bus_ppu:string;tecnico_terreno_id:string|null;
  modelo:string|null;marca?:string|null;terminal:string|null;operador:string|null;falla:string|null;referencia_ar:string|null;tecnico:string|null;estado_actual:string;
};
export const getPendingWithdrawals=async()=>(await api.get<PendingWithdrawal[]>('/api/os/pendientes-retiro')).data;
export const assignWithdrawal=async(codigo_os:string,tecnico_terreno_id:string)=>(await api.post('/api/os/asignar-retiro',{codigo_os,tecnico_terreno_id})).data;


export interface CreateOSPayload {
  tipo: "CONSOLA" | "VALIDADOR";
  es_pod: boolean;
  foto_dano_url?: string;
  falla: string;
  bus_ppu: string;
  serie_equipo: string;
  amid?: string;
  modelo?: string;
  marca?: string;
  terminal_id?:number; pst_codigo?:string;
}

export interface OrdenServicio {
  codigo_os: string;
  fecha: string;
  actualizado_en?: string;
  tipo_equipo: "CONSOLA" | "VALIDADOR";
  falla: string;
  bus_ppu: string;
  ticket_aranda?: string;
  estado_id: number;
  estado_nombre: string;
  ubicacion_id?: number;
  ubicacion_nombre?: string;
  serie: string;
  modelo?:string|null; marca?:string|null; operador?:string;
  tecnico_terreno?: string;
  tecnico_laboratorio?: string;
  tecnico_nombre?: string;
  terminal?: string;
  caso_id?: string;
  codigo_caso?: string;
  origen?: string;
  referencia_externa?: string;
  os_origen?: string;
  es_instalacion?: boolean;
}

export interface OsListParams {
  grupo?: string;
  q?: string;
  tipo_equipo?: "CONSOLA" | "VALIDADOR" | "";
  estado_id?: number;
  limit?: number;
  offset?: number;
}

export interface OsListResponse {
  items: OrdenServicio[];
  pagination: { total: number; limit: number; offset: number };
}

export const createOS = async (payload: CreateOSPayload) => {
  const { data } = await api.post("/api/os/crear", payload);
  return data;
};

export async function getOs(codigoOS: string): Promise<OrdenServicio> {
  const { data } = await api.get<OrdenServicio>(`/api/os/${encodeURIComponent(codigoOS)}`);
  return data;
}

export async function listOs(params: OsListParams = {}): Promise<OsListResponse> {
  const { data } = await api.get<OsListResponse>("/api/os", {
    params: { limit: 25, offset: 0, ...params }
  });
  return data;
}

export async function getMyOs(): Promise<OrdenServicio[]> {
  const { data } = await api.get<OrdenServicio[]>("/api/os/mis-ordenes");
  return data;
}

export const searchFieldAssets=async(params:{tipo_equipo:'VALIDADOR'|'CONSOLA';q:string;bus_ppu:string})=>(await api.get<{items:RequirementAsset[];has_more:boolean}>('/api/os/activos-operativos',{params:{...params,limit:6}})).data;
