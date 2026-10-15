import { createContext, useCallback, useContext, useEffect, useMemo, useState, useRef, type ReactNode } from "react";
import { onIdTokenChanged } from "firebase/auth";
import type { Me } from "../api/me";
import { SESSION_INVALIDATED_EVENT } from "../api/errors";
import { fbAuth } from "./firebase";
import {
  getCachedMe,
  clearCachedMe,
  getInitialSessionState,
  loadMeOrNull,
  removeLegacyManualToken,
  type SessionStatus
} from "./session";

type SessionContextValue = {
  status: SessionStatus;
  error: string;
  me: Me | null;
  previewMe: Me | null;
  refreshSession: () => Promise<Me | null>;
  endSession: () => void;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const initial = getInitialSessionState(getCachedMe());
  const [status, setStatus] = useState<SessionStatus>(initial.status);
  const [me, setMe] = useState<Me | null>(initial.me);
  const [previewMe, setPreviewMe] = useState<Me | null>(initial.previewMe);

  const [error,setError]=useState('');
  const generation=useRef(0),confirmedUser=useRef<Me|null>(null),confirmedUid=useRef<string|null>(null);

  const refreshSession = useCallback(async () => {
    if (!fbAuth.currentUser) {
      generation.current++;confirmedUser.current=null;confirmedUid.current=null;clearCachedMe();
      setMe(null);
      setPreviewMe(null);
      setStatus("unauthenticated");
      return null;
    }

    const user=fbAuth.currentUser,version=++generation.current;
    if(confirmedUid.current!==user.uid){confirmedUser.current=null;setMe(null);setPreviewMe(null);clearCachedMe();}
    setError('');
    if(!confirmedUser.current){setMe(null);setPreviewMe(getCachedMe());setStatus("loading");}
    try{
      const confirmed = await loadMeOrNull();
      if(version!==generation.current||fbAuth.currentUser!==user)return null;
      confirmedUser.current=confirmed;confirmedUid.current=confirmed?user.uid:null;setMe(confirmed);setPreviewMe(confirmed);
      setStatus(confirmed ? "authenticated" : "unauthenticated");return confirmed;
    }catch{
      if(version!==generation.current||fbAuth.currentUser!==user)return null;
      setError('No pudimos verificar la sesión. Comprueba tu conexión y reintenta.');
      setStatus(confirmedUser.current?'authenticated':'unavailable');return null;
    }
  }, []);

  const endSession = useCallback(() => {
    generation.current++;confirmedUser.current=null;confirmedUid.current=null;setError('');
    clearCachedMe();
    setMe(null);
    setPreviewMe(null);
    setStatus("unauthenticated");
  }, []);

  useEffect(() => {
    removeLegacyManualToken();
    return onIdTokenChanged(fbAuth, (firebaseUser) => {
      if (firebaseUser) {
        void refreshSession();
        return;
      }
      endSession();
    });
  }, [refreshSession,endSession]);

  useEffect(() => {
    window.addEventListener(SESSION_INVALIDATED_EVENT, endSession);
    return () => window.removeEventListener(SESSION_INVALIDATED_EVENT, endSession);
  }, [endSession]);

  const value = useMemo(
    () => ({ status, me, previewMe, refreshSession, endSession,error }),
    [status, me, previewMe, refreshSession, endSession,error]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const context = useContext(SessionContext);
  if (!context) throw new Error("useSession debe utilizarse dentro de SessionProvider");
  return context;
}
