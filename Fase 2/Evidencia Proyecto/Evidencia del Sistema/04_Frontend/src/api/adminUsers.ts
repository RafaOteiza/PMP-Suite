import { api } from "./http";

export const ALLOWED_ROLES = ["admin", "gerente", "jefe_laboratorio", "logistica", "qa", "tecnico_laboratorio", "tecnico_terreno"] as const;
export type AllowedRole = typeof ALLOWED_ROLES[number];

export type AdminUser = {
  id: string;
  correo: string;
  email: string;
  nombre: string;
  apellido?: string;
  rol?: string;
  roles?: string[];
  activo: boolean;
  firebase_uid?: string; // Agregamos esto por si acaso lo necesitas en el frontend
};

// --- AQUÍ ESTABA EL CAMBIO IMPORTANTE ---
export type AdminCreateUserPayload = {
  email: string;
  nombre: string;
  apellido?: string;
  rol: string;
  password?: string; // <--- Agregamos password opcional
};

export type AdminUpdateUserPayload = {
  correo?: string;
  nombre?: string;
  apellido?: string;
  rol?: string;
  activo?: boolean;
};

export async function adminListUsers(params?: { q?: string; activo?: boolean; rol?: string; limit?: number; offset?: number }): Promise<AdminUser[]> {
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
    email: u.correo ?? u.email ?? "",
    nombre: u.nombre ?? "",
    apellido: u.apellido ?? "",
    rol: u.rol ?? undefined,
    roles: u.roles ?? (u.rol ? [u.rol] : []),
    activo: !!u.activo,
    firebase_uid: u.firebase_uid
  }));
}

export async function adminCreateUser(payload: AdminCreateUserPayload) {
  const body = {
    correo: payload.email,
    nombre: payload.nombre,
    apellido: payload.apellido,
    rol: payload.rol,
    password: payload.password // <--- Enviamos la password al backend
  };
  const { data } = await api.post("/api/admin/users", body);
  return data;
}

export async function adminUpdateUser(id: string, payload: AdminUpdateUserPayload) {
  const { data } = await api.put(`/api/admin/users/${id}`, payload);
  return data;
}

export async function adminSetPassword(id: string, password: string): Promise<{ ok?: boolean }> {
  const { data } = await api.post(`/api/admin/users/${id}/set-password`, { password });
  return data;
}

export async function adminResetPasswordLink(id: string): Promise<{ correo: string; link: string }> {
  const { data } = await api.post(`/api/admin/users/${id}/reset-password-link`);
  return data;
}

// Funciones extra que usa el Frontend nuevo
export const adminActivateUser = async (id: string) => {
  const { data } = await api.patch(`/api/admin/users/${id}/activar`);
  return data;
};

export const adminDeactivateUser = async (id: string) => {
  const { data } = await api.patch(`/api/admin/users/${id}/desactivar`);
  return data;
};
