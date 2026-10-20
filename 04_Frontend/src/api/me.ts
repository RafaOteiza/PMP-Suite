import { coreApi } from "./http";

export type Me = {
  id: string;
  nombre: string;
  apellido?: string;
  correo: string;
  rol?: string;
  roles: string[];
  activo: boolean;
  firebase?: {
    uid?: string;
    email?: string;
    name?: string | null;
  };
};

export async function getMe(): Promise<Me> {
  const { data } = await coreApi.get("/api/auth/me");

  // Backend retorna { user: {...}, firebase: {...} }
  const u = data?.user ?? data ?? {};
  const fb = data?.firebase ?? null;

  const roles =
    Array.isArray(u.roles) ? u.roles.map((r: any) => (typeof r === "string" ? r : r.code)).filter(Boolean)
    : (u.rol ? [u.rol] : []);

  return {
    id: u.id,
    nombre: u.nombre,
    apellido: u.apellido,
    correo: u.correo ?? u.email,
    rol: u.rol,
    roles,
    activo: !!u.activo,
    firebase: fb ?? undefined
  };
}
