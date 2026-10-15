import FeedbackBanner from "./ui/FeedbackBanner";
import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { can, isOfficialRole, type Permission } from "../app/rbac";
import { useSession } from "../app/SessionContext";

type ProtectedRouteProps = {
  children: ReactNode;
  permission?: Permission | readonly Permission[];
};

export default function ProtectedRoute({ children, permission }: ProtectedRouteProps) {
  const { status, me, previewMe,error,refreshSession } = useSession();

  if (status === "loading") {
    const identity = previewMe?.nombre ? ` de ${previewMe.nombre}` : "";
    return (
      <div className="panel" role="status" aria-live="polite" aria-busy="true" style={{ margin: 24 }}>
        Verificando sesión{identity}…
      </div>
    );
  }

  if(status==='unavailable')return <div className="page"><FeedbackBanner tone="warning">{error}</FeedbackBanner><button className="btn secondary" onClick={()=>void refreshSession()}>Reintentar sesión</button></div>;
  if (status !== "authenticated" || !me) return <Navigate to="/login" replace />;
  if (!isOfficialRole(me.rol)) return <Navigate to="/403" replace />;

  const required = permission ? (Array.isArray(permission) ? permission : [permission]) : [];
  if (required.length > 0 && !required.every((item) => can(me, item))) {
    return <Navigate to="/403" replace />;
  }

  return <>{error&&<FeedbackBanner tone="warning">{error} <button className="btn secondary sm" onClick={()=>void refreshSession()}>Reintentar sesión</button></FeedbackBanner>}{children}</>;
}
