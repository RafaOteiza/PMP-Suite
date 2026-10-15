import { api } from "./http";

export interface DashboardSummary {
  kpis: {
    totalEnProceso: number;
    consolasEnLab: number;    // <--- NUEVO
    validadoresEnLab: number; // <--- NUEVO
    totalReparados: number;
    totalOperativos: number;
    totalEnRuta: number;
    totalAsignados: number;
    totalEnBodega: number;
    totalEnTransito: number;
    totalReparadosLab: number;
    totalEnQa: number;
    totalPods: number;
    podsReparados: number;
    tiempoPromedio: number | null;
  };
  charts: {
    pieData: Array<{ name: string; value: number }>;
    barData: Array<{ name: string; cantidad: number }>;
  };
}

export async function getDashboardSummary(): Promise<DashboardSummary> {
  const { data } = await api.get("/api/dashboard/summary");
  return data;
}

export interface EquipoOperativo {
  tipo: 'VALIDADOR' | 'CONSOLA';
  serie: string;
  modelo: string | null;
  marca: string;
  bus_ppu: string | null;
  ultima_operacion: string | null;
}

export interface EquiposOperativosResponse {
  data: EquipoOperativo[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
  };
}

export async function getEquiposOperativos(q = '', offset = 0): Promise<EquiposOperativosResponse> {
  const { data } = await api.get("/api/dashboard/equipos-operativos", {
    params: { q, offset, limit: 20 }
  });
  return data;
}
