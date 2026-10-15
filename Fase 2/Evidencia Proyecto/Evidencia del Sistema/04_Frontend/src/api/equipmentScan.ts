import { api } from "./http";

export type ScanStation = "BODEGA" | "LABORATORIO" | "QA";
export type EquipmentType = "VALIDADOR" | "CONSOLA";

export interface ScanResolution {
  lectura: { codigo: string; tipo_codigo: "SERIE" | "AMID" };
  estacion: { codigo: ScanStation; ubicacion_id: number; ubicacion: string };
  equipo: {
    tipo_equipo: EquipmentType;
    serie: string;
    amid?: string | null;
    modelo: string | null;
    marca?: string | null;
    coincidencia: "SERIE" | "AMID" | "AMID_DERIVADO";
    tipo_codigo: "SERIE" | "AMID";
  };
  orden: {
    codigo_os: string;
    tipo_equipo: EquipmentType;
    falla: string;
    estado_id: number;
    estado: string;
    bus_ppu: string;
    terminal: string;
    pst_codigo: string;
    ubicacion?: string | null;
    tecnico_laboratorio_id?: string | null;
    qa_usuario_id?: string | null;
    es_aprobado_qa?: boolean | null;
    es_instalacion?: boolean;
    fue_laboratorio?: boolean;
    bridge_codigo?: string | null;
  } | null;
  ordenes_activas: number;
  ultima_ubicacion: {
    id: number;
    estacion: ScanStation;
    fecha: string;
    ubicacion: string;
    codigo_os: string;
  } | null;
  validacion: {
    estado: string;
    puede_confirmar: boolean;
    mensaje: string;
  };
}

export interface ScanConfirmation extends ScanResolution {
  escaneo: { id: number; fecha: string };
  duplicado: boolean;
}

export async function resolveEquipmentScan(codigo: string, estacion: ScanStation): Promise<ScanResolution> {
  const { data } = await api.get<ScanResolution>("/api/equipment-scan/resolve", {
    params: { codigo, estacion }
  });
  return data;
}
