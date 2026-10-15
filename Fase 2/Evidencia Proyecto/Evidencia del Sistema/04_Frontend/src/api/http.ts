import {createSessionToken} from '../../../shared/sessionToken.js';
import axios from "axios";
import { signOut } from "firebase/auth";
import { fbAuth } from "../app/firebase";
import {
  createAuthInvalidationHandler,
  getApiErrorMessage,
  getLoginRedirectTarget,
  getSafeReturnPath,
  isReadOnlyRoleError,
  ME_CACHE_KEY,
  READ_ONLY_DENIED_EVENT,
  SAFE_RETURN_PATH_KEY,
  SESSION_INVALIDATED_EVENT
} from "./errors";

// Compat: VITE_CORE_URL (nuevo) o VITE_API_URL (legacy)
const CORE_BASE =
  import.meta.env.VITE_CORE_URL ??
  import.meta.env.VITE_API_URL ??
  "http://localhost:4000";

export const coreApi = axios.create({
  baseURL: CORE_BASE,
  timeout: 30000
});

// alias cómodo
export const api = coreApi;

const currentToken=createSessionToken(()=>fbAuth.currentUser);

// Firebase conserva la sesión; cada solicitud obtiene el ID token vigente del SDK.
coreApi.interceptors.request.use(async (config) => {
  const token = await currentToken();
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  } else { delete config.headers.Authorization; }
  return config;
});

const handleAuthInvalidation = createAuthInvalidationHandler({
  signOutUser: () => signOut(fbAuth),
  removeMeCache: () => {
    if (typeof localStorage !== "undefined") localStorage.removeItem(ME_CACHE_KEY);
  },
  clearSessionMemory: (code, message) => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(SESSION_INVALIDATED_EVENT, {
        detail: { code, message }
      }));
    }
  },
  redirectToLogin: (code) => {
    if (typeof window === "undefined") return;

    const safeReturnPath = getSafeReturnPath(window.location.pathname, window.location.search);
    if (safeReturnPath) {
      try {
        sessionStorage.setItem(SAFE_RETURN_PATH_KEY, safeReturnPath);
      } catch {
        // La navegación segura no depende de que sessionStorage esté disponible.
      }
    }

    const currentPath = `${window.location.pathname}${window.location.search}`;
    const target = getLoginRedirectTarget(currentPath, code);
    if (target) window.location.replace(target);
  }
});

coreApi.interceptors.response.use(
  (res) => res,
  async (err) => {
    const config=err.config;
    if(err.response?.data?.code==='TOKEN_EXPIRED'&&!config?._sessionRetried){
      try {
        await currentToken(true);
        if(config&&['get','head'].includes((config.method||'get').toLowerCase())){
          config._sessionRetried=true;return coreApi(config);
        }
        // A write is never replayed after refresh. Keep the draft for explicit retry.
        return Promise.reject(err);
      }catch(refreshError){await handleAuthInvalidation(refreshError);return Promise.reject(refreshError);}
    }
    await handleAuthInvalidation(err);
    if (isReadOnlyRoleError(err) && typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(READ_ONLY_DENIED_EVENT, {
        detail: { message: getApiErrorMessage(err) }
      }));
    }
    return Promise.reject(err);
  }
);
