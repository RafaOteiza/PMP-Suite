import { api } from "./http";

export interface LabReceptionItem {
 codigo_os:string;tipo_equipo:'VALIDADOR'|'CONSOLA';serie:string;modelo:string|null;marca:string|null;falla:string;
 bus_ppu:string|null;terminal:string|null;operador:string|null;codigo_caso:string|null;referencia_ar:string|null;
 fecha_salida:string|null;fecha_recepcion:string|null;fecha_evento:string|null;evento_id:string|null;
 en_camino:boolean;recibido:boolean;discrepancia:boolean|null;tecnico_laboratorio:string;
}
export interface LabReception {
 updatedAt:string;counts:{camino:number;recibidos:number;hoy:number;pendientes:number;incidencias:number;historial:number};
 items:LabReceptionItem[];total:number;limit:number;offset:number;
}
export const getLabReception=async(params:Record<string,string>={},signal?:AbortSignal):Promise<LabReception> =>
 (await api.get('/api/lab/reception',{params,signal})).data;

export interface LabTicket {
  codigo_os: string;
  fecha: string;
  ingreso_legacy?: boolean;
  en_transito_laboratorio?: boolean;
  fecha_ingreso_laboratorio?: string | null;
  fuente_ingreso_laboratorio?: string | null;
  reingreso_laboratorio?: boolean;
  modelo?: string;
  marca?: string; terminal?: string; operador?: string;
  referencia_ar?: string;
  ubicacion?: string;
  falla: string;
  estado_id: number;
  estado_nombre: string;
  bus_ppu: string;
  serie: string;
  tecnico_origen: string;
  tecnico_laboratorio_id?: string; // ID del técnico asignado
  tipo_equipo?: string;
  tecnico_laboratorio?: string;
  recepcion_laboratorio_confirmada?: boolean;
}

export interface LabTech {
  id: string;
  nombre: string;
  apellido: string;
  email: string;
}

// Obtener cola
export const getLabQueue = async (type: 'VALIDADOR' | 'CONSOLA') => {
  const { data } = await api.get<LabTicket[]>(`/api/lab/queue/${type}`);
  return data;
};

// Obtener técnicos
export const getLabTechnicians = async () => {
  const { data } = await api.get<LabTech[]>("/api/lab/technicians");
  return data;
};

// Asignar
export const assignTicket = async (codigo_os: string, tecnico_id: string) => {
  const { data } = await api.put("/api/lab/assign", { codigo_os, tecnico_id });
  return data;
};

// Mover Estado
export const moveTicket = async (codigo_os: string, nuevo_estado_id: number, comentario?: string) => {
  const { data } = await api.put("/api/lab/move", { codigo_os, nuevo_estado_id, comentario });
  return data;
};

// Obtener equipos finalizados
export const getCompletedLab = async () => {
  const { data } = await api.get<LabTicket[]>("/api/lab/completed");
  return data;
};
