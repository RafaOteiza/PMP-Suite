import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, ShieldX } from "lucide-react";
import { useSession } from "../app/SessionContext";

export default function ForbiddenPage() {
  const { status } = useSession();
  const location = useLocation();
  const navigate = useNavigate();
  if (status === "unauthenticated") return <Navigate to="/login" replace />;
  return (
    <main className="system-state" role="alert">
      <div className="system-state-icon" data-tone="danger"><ShieldX size={28} aria-hidden="true" /></div>
      <div className="system-state-code">Error 403</div>
      <h1>Acceso restringido</h1>
      <p>Tu rol no posee la capacidad requerida para acceder a esta ruta.</p>
      <code>{location.state?.from ?? "Ruta no autorizada"}</code>
      <button className="btn" onClick={() => navigate("/", { replace: true })}><ArrowLeft size={17} /> Volver al inicio</button>
    </main>
  );
}
