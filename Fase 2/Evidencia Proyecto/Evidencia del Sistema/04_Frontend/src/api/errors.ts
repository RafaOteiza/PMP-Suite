export const READ_ONLY_ROLE = "READ_ONLY_ROLE";
export const READ_ONLY_ROLE_MESSAGE = "El rol gerente posee acceso de solo lectura";
export const READ_ONLY_DENIED_EVENT = "pmp:read-only-denied";
export const SESSION_INVALIDATED_EVENT = "pmp:session-invalidated";
export const ME_CACHE_KEY = "pmp_me_cache";
export const SAFE_RETURN_PATH_KEY = "pmp_safe_return_path";

export const AUTH_INVALIDATION_MESSAGES = {
  USER_INACTIVE: "Tu usuario está inactivo. Contacta al administrador.",
  IDENTITY_CONFLICT: "La vinculación de tu identidad requiere revisión administrativa.",
  TOKEN_REVOKED: "Tu sesión fue cerrada por seguridad. Inicia sesión nuevamente.",
  TOKEN_EXPIRED: "Tu sesión expiró. Inicia sesión nuevamente.",
  INVALID_TOKEN: "No fue posible validar tu sesión. Inicia sesión nuevamente.",
  USER_DISABLED: "Tu cuenta se encuentra deshabilitada. Contacta al administrador."
} as const;

export type AuthInvalidationCode = keyof typeof AUTH_INVALIDATION_MESSAGES;

const AUTH_INVALIDATION_CODES = new Set<string>(Object.keys(AUTH_INVALIDATION_MESSAGES));
const SAFE_READ_PATHS = new Set([
  "/",
  "/admin/despacho",
  "/operacion/os",
  "/lab/dashboard",
  "/lab/validadores",
  "/lab/consolas",
  "/lab/reportes",
  "/qa",
  "/bodega",
  "/bodega/dashboard",
  "/bodega/modulos",
  "/bodega/repuestos",
  "/equipos-operativos",
  "/trazabilidad",
  "/ia/predicciones",
  "/settings"
]);

type ApiErrorLike = {
  response?: {
    data?: {
      error?: unknown;
      code?: unknown;
      message?: unknown;
      detail?: unknown;
    };
  };
  message?: unknown;
};

export function isReadOnlyRoleError(error: unknown): boolean {
  return (error as ApiErrorLike)?.response?.data?.error === READ_ONLY_ROLE;
}

export function getAuthInvalidationCode(error: unknown): AuthInvalidationCode | null {
  const code = (error as ApiErrorLike)?.response?.data?.code;
  return typeof code === "string" && AUTH_INVALIDATION_CODES.has(code)
    ? code as AuthInvalidationCode
    : null;
}

export function getAuthInvalidationMessage(code: string | null): string | null {
  return code && AUTH_INVALIDATION_CODES.has(code)
    ? AUTH_INVALIDATION_MESSAGES[code as AuthInvalidationCode]
    : null;
}

export function getSafeReturnPath(pathname: string, search = ""): string | null {
  return SAFE_READ_PATHS.has(pathname) ? `${pathname}${search}` : null;
}

export function getLoginRedirectTarget(
  currentPathWithSearch: string,
  code: AuthInvalidationCode
): string | null {
  const target = `/login?auth=${encodeURIComponent(code)}`;
  return currentPathWithSearch === target ? null : target;
}

type AuthInvalidationDependencies = {
  signOutUser: () => Promise<unknown> | unknown;
  removeMeCache: () => void;
  clearSessionMemory: (code: AuthInvalidationCode, message: string) => void;
  redirectToLogin: (code: AuthInvalidationCode, message: string) => void;
};

export function createAuthInvalidationHandler(dependencies: AuthInvalidationDependencies) {
  let inFlight: Promise<void> | null = null;

  return async function handleAuthInvalidation(error: unknown): Promise<boolean> {
    const code = getAuthInvalidationCode(error);
    if (!code) return false;

    if (!inFlight) {
      const message = AUTH_INVALIDATION_MESSAGES[code];
      inFlight = (async () => {
        try {
          await dependencies.signOutUser();
        } catch {
          // Una falla local de signOut no debe impedir limpiar la sesión de PMP Suite.
        }
        for (const action of [
          dependencies.removeMeCache,
          () => dependencies.clearSessionMemory(code, message),
          () => dependencies.redirectToLogin(code, message)
        ]) {
          try {
            action();
          } catch {
            // Cada paso es independiente para evitar dejar la sesión activa parcialmente.
          }
        }
      })();
    }

    await inFlight;
    return true;
  };
}

export function getApiErrorMessage(error: unknown, fallback = "No se pudo completar la operación"): string {
  const candidate = error as ApiErrorLike;
  const data = candidate?.response?.data;
  if (data?.error === READ_ONLY_ROLE) {
    return typeof data.message === "string" && data.message.trim()
      ? data.message
      : READ_ONLY_ROLE_MESSAGE;
  }

  for (const value of [data?.message, data?.detail, data?.error, data?.code, candidate?.message]) {
    if (typeof value === "string" && value.trim()) return value;
  }
  return fallback;
}
