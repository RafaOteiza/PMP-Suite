import { getMe, type Me } from "../api/me";
import { ME_CACHE_KEY } from "../api/errors";

const LEGACY_TOKEN_KEY = "pmp_token";

export type SessionStatus = "loading" | "authenticated" | "unauthenticated" | "unavailable";

export type InitialSessionState = {
  status: SessionStatus;
  me: Me | null;
  previewMe: Me | null;
};

export function getCachedMe(): Me | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(ME_CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Me;
  } catch {
    try {
      localStorage.removeItem(ME_CACHE_KEY);
    } catch {
      // El estado en memoria sigue siendo la fuente activa de la interfaz.
    }
    return null;
  }
}

export function setCachedMe(me: Me): void {
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(ME_CACHE_KEY, JSON.stringify(me));
    } catch {
      // El caché es opcional y nunca concede autenticación.
    }
  }
}

export function clearCachedMe(): void {
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.removeItem(ME_CACHE_KEY);
    } catch {
      // La identidad en memoria se limpia aunque el almacenamiento no esté disponible.
    }
  }
}

export function removeLegacyManualToken(): void {
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.removeItem(LEGACY_TOKEN_KEY);
    } catch {
      // La aplicación ya no lee ni escribe este token legado.
    }
  }
}

export function getInitialSessionState(cachedMe: Me | null): InitialSessionState {
  return {
    status: "loading",
    me: null,
    previewMe: cachedMe
  };
}

export async function loadMeOrNull(): Promise<Me | null> {
  try {
    const me = await getMe();
    setCachedMe(me);
    return me;
  } catch (error) {
    const status=(error as {response?:{status?:number}})?.response?.status;
    if(status===401||status===403)return null;
    throw error;
  }
}
