import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AlertCircle, Boxes, Lock, LogIn, Mail, ShieldCheck, Wrench } from "lucide-react";
import { login } from "../api/auth";
import { getAuthInvalidationMessage, getSafeReturnPath, SAFE_RETURN_PATH_KEY } from "../api/errors";
import { useSession } from "../app/SessionContext";

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { status, refreshSession, error: sessionError } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const authMessage = getAuthInvalidationMessage(new URLSearchParams(location.search).get("auth"));

  const consumeSafeReturnPath = () => {
    let stored: string | null = null;
    try {
      stored = sessionStorage.getItem(SAFE_RETURN_PATH_KEY);
      sessionStorage.removeItem(SAFE_RETURN_PATH_KEY);
    } catch {
      return "/";
    }
    if (!stored) return "/";
    const parsed = new URL(stored, window.location.origin);
    return getSafeReturnPath(parsed.pathname, parsed.search) || "/";
  };

  useEffect(() => {
    if (status === "authenticated") navigate(consumeSafeReturnPath(), { replace: true });
  }, [status, navigate]);

  if (status === "loading") {
    return (
      <main className="login-form-panel" role="status" aria-live="polite" aria-busy="true">
        <div className="login-loading">
          <div className="login-loading-brand">
            <img className="login-logo-on-light" src="/brand/logo-horizontal-color.svg" alt="PMP Suite" />
            <img className="login-logo-on-dark" src="/brand/logo-horizontal-dark.svg" alt="PMP Suite" />
          </div>
          <div className="skeleton" style={{ height: 380 }} />
          <span className="sr-only">Verificando sesión</span>
        </div>
      </main>
    );
  }

  if (status === "authenticated") return null;

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login({ email, password });
      const confirmed = await refreshSession();
      if (!confirmed) throw new Error("No fue posible confirmar el acceso a PMP Suite.");
      navigate(consumeSafeReturnPath(), { replace: true });
    } catch (submitError: any) {
      setError(submitError?.response?.data?.detail ?? submitError?.message ?? "Credenciales incorrectas");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="login-shell">
      <section className="login-brand-panel" aria-label="PMP Suite">
        <div className="login-brand"><img className="login-brand-logo" src="/brand/logo-horizontal-dark.svg" alt="PMP Suite" draggable="false" /></div>
        <div className="login-story">
          <div className="login-kicker">Control. Maintain. Move Forward.</div>
          <h1>Control operacional.<br/><span>Mantenimiento conectado.</span></h1>
          <p>Gestión de órdenes, laboratorio, bodega, calidad y trazabilidad para una operación de mantenimiento precisa y auditable.</p>
          <div className="login-capabilities" aria-label="Capacidades principales">
            <span className="login-capability"><Wrench size={20} aria-hidden="true" /><span>Mantenimiento<small>Gestión técnica</small></span></span>
            <span className="login-capability"><Boxes size={20} aria-hidden="true" /><span>Logística<small>Control de activos</small></span></span>
            <span className="login-capability"><ShieldCheck size={20} aria-hidden="true" /><span>Calidad QA<small>Trazabilidad</small></span></span>
          </div>
        </div>
        <div className="login-footnote"><span>PMP Suite</span> Una operación. Todo conectado.</div>
      </section>

      <section className="login-form-panel">
        <div className="login-card animate-fade-in">
          <header className="login-card-header">
            <div className="login-mobile-brand">
              <img className="login-logo-on-light" src="/brand/logo-horizontal-color.svg" alt="PMP Suite" draggable="false" />
              <img className="login-logo-on-dark" src="/brand/logo-horizontal-dark.svg" alt="PMP Suite" draggable="false" />
            </div>
            <div className="login-access-icon" aria-hidden="true"><ShieldCheck size={24}/></div>
            <h2>Acceso seguro</h2>
            <p>Ingresa con tus credenciales institucionales.</p>
          </header>

          {status==="unavailable"&&<button className="btn ghost" onClick={()=>void refreshSession()}>Reintentar verificación de sesión</button>}
          <form onSubmit={onSubmit}>
            <div className="login-field">
              <label htmlFor="login-email">Correo electrónico</label>
              <div className="login-input-wrap">
                <Mail size={18} aria-hidden="true" />
                <input id="login-email" className="login-input" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="correo@pmp-suite.cl" type="email" autoComplete="username" required />
              </div>
            </div>

            <div className="login-field">
              <label htmlFor="login-password">Contraseña</label>
              <div className="login-input-wrap">
                <Lock size={18} aria-hidden="true" />
                <input id="login-password" className="login-input" type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Ingresa tu contraseña" autoComplete="current-password" required />
              </div>
            </div>

            {(sessionError || error || authMessage) ? <div className="login-alert" role="alert"><AlertCircle size={18} aria-hidden="true" />{sessionError || error || authMessage}</div> : null}

            <button type="submit" className="btn login-submit" disabled={busy}>
              {busy ? "Validando acceso…" : <><span>Ingresar</span><LogIn size={18} /></>}
            </button>
          </form>

          <div className="login-security"><ShieldCheck size={14} /> Autenticación protegida por Firebase</div>
        </div>
      </section>
    </main>
  );
}
