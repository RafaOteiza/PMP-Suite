import { api } from "./http";

export type User = {
  id: string;
  correo: string;
  nombre: string;
  apellido?: string;
  rol?: string;
  activo: boolean;
};

export type UpdateUserPayload = {
  correo?: string;
  nombre?: string;
  apellido?: string;
  rol?: string;
  activo?: boolean;
};

export async function listUsers(params?: { q?: string; activo?: boolean; rol?: string; limit?: number; offset?: number }): Promise<User[]> {
  const { data } = await api.get("/api/users", {
    params: {
      limit: 50,
      offset: 0,
      ...(params ?? {})
    }
  });
  const items = Array.isArray(data?.items) ? data.items : [];
  return items.map((u: any) => ({
    id: u.id,
    correo: u.correo ?? u.email ?? "",
    nombre: u.nombre ?? "",
    apellido: u.apellido ?? "",
    rol: u.rol ?? undefined,
    activo: !!u.activo
  }));
}

export async function updateUser(id: string, payload: UpdateUserPayload) {
  const { data } = await api.patch(`/api/users/${id}`, payload);
  return data;
}

export const adminUpdateUser = updateUser;

export async function adminSetActive(id: string, value: boolean) {
  const path = value ? `/api/admin/users/${id}/activar` : `/api/admin/users/${id}/desactivar`;
  const { data } = await api.patch(path);
  return data;
}

export async function adminSetUserPassword(id: string, password: string) {
  const { data } = await api.post(`/api/users/${id}/password`, { password });
  return data;
}
