import admin from "../firebase.js";

const AUTH_RESPONSES = Object.freeze({
  AUTH_REQUIRED: {
    status: 401,
    message: "Se requiere autenticación."
  },
  TOKEN_REVOKED: {
    status: 401,
    message: "La sesión fue revocada. Inicia sesión nuevamente."
  },
  TOKEN_EXPIRED: {
    status: 401,
    message: "La sesión expiró. Inicia sesión nuevamente."
  },
  USER_DISABLED: {
    status: 403,
    message: "La cuenta está deshabilitada."
  },
  INVALID_TOKEN: {
    status: 401,
    message: "La sesión no es válida."
  },
  AUTH_SERVICE_UNAVAILABLE: {
    status: 503,
    message: "No fue posible validar la sesión."
  }
});

const INVALID_TOKEN_CODES = new Set([
  "auth/argument-error",
  "auth/invalid-argument",
  "auth/invalid-id-token"
]);

function normalizeFirebaseError(error) {
  if (error?.code === "auth/id-token-revoked") return "TOKEN_REVOKED";
  if (error?.code === "auth/id-token-expired") return "TOKEN_EXPIRED";
  if (error?.code === "auth/user-disabled") return "USER_DISABLED";
  if (INVALID_TOKEN_CODES.has(error?.code)) return "INVALID_TOKEN";
  return "AUTH_SERVICE_UNAVAILABLE";
}

function routeForLog(req) {
  return req.originalUrl || `${req.baseUrl || ""}${req.path || ""}` || req.url || "/";
}

function requestIdForLog(req) {
  return req.id || req.requestId || req.headers?.["x-request-id"] || null;
}

export function createFirebaseAuth(firebaseAdmin = admin, options = {}) {
  const logger = options.logger || console;
  const now = options.now || (() => new Date());

  function rejectAuthentication(req, res, code) {
    const response = AUTH_RESPONSES[code];
    logger.warn("firebase_auth_rejected", {
      code,
      route: routeForLog(req),
      method: req.method || "UNKNOWN",
      date: now().toISOString(),
      requestId: requestIdForLog(req)
    });
    return res.status(response.status).json({ code, message: response.message });
  }

  return async function firebaseAuthMiddleware(req, res, next) {
    const header = req.headers?.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7).trim() : null;
    if (!token) return rejectAuthentication(req, res, "AUTH_REQUIRED");

    try {
      const decoded = await firebaseAdmin.auth().verifyIdToken(token, true);

      req.firebase = {
        uid: decoded.uid,
        email: decoded.email || null,
        name: decoded.name || null
      };

      return next();
    } catch (error) {
      return rejectAuthentication(req, res, normalizeFirebaseError(error));
    }
  };
}

export const firebaseAuth = createFirebaseAuth();
