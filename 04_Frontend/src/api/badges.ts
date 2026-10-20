import { api } from "./http";

export interface BadgeCounts {
  lab: number;
  lab_dispatch: number;
  bodega: number;
  qa: number;
}

export const getBadgeCounts = async (): Promise<BadgeCounts> => {
  const { data } = await api.get<BadgeCounts>("/api/dashboard/badges");
  return data;
};
