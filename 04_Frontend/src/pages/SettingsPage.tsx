import {localReport} from '../utils/pageReports';
import { useState } from "react";
import { useOutletContext } from "react-router-dom";
import { KeyRound, LockKeyhole, Save } from "lucide-react";
import { changeMyPassword } from "../api/auth";
import type { Me } from "../api/me";
import { can, PERMISSIONS } from "../app/rbac";
import { getApiErrorMessage } from "../api/errors";
import FeedbackBanner from "../components/ui/FeedbackBanner";
import PageHeader from "../components/ui/PageHeader";

export default function SettingsPage() {
  const me = useOutletContext<Me | null>();
  const canUpdatePassword = can(me, PERMISSIONS.OWN_PASSWORD_UPDATE);
  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!canUpdatePassword) return;
    setError(null); setInfo(null);
    if (!pw1 || pw1 !== pw2) { setError("Las contraseñas no coinciden o están vacías"); return; }
    setBusy(true);
    try {
      await changeMyPassword(pw1);
      setInfo("Contraseña actualizada correctamente.");
      setPw1(""); setPw2("");
    } catch (requestError: any) {
      setError(getApiErrorMessage(requestError, "No se pudo cambiar la contraseña"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page content-narrow">
      <PageHeader report={localReport('Perfil de cuenta',me?[me]:[],busy)} eyebrow="Cuenta personal" title="Seguridad" description="Actualiza la contraseña asociada exclusivamente a tu propia cuenta." icon={<KeyRound size={21} />} />
      {error ? <FeedbackBanner tone="danger">{error}</FeedbackBanner> : null}
      {info ? <FeedbackBanner tone="success">{info}</FeedbackBanner> : null}
      {canUpdatePassword ? (
        <section className="panel settings-card">
          <div className="settings-intro"><div className="page-heading-icon"><LockKeyhole size={20} /></div><div><h2 className="section-title">Cambiar contraseña</h2><p className="muted small">Usa una clave robusta que no reutilices en otros servicios.</p></div></div>
          <div className="form-grid">
            <div className="field"><label className="field-label" htmlFor="new-password">Nueva contraseña</label><input id="new-password" className="input" type="password" value={pw1} onChange={(event) => setPw1(event.target.value)} autoComplete="new-password" /></div>
            <div className="field"><label className="field-label" htmlFor="confirm-password">Confirmar contraseña</label><input id="confirm-password" className="input" type="password" value={pw2} onChange={(event) => setPw2(event.target.value)} autoComplete="new-password" /></div>
          </div>
          <div className="settings-actions"><button className="btn" onClick={save} disabled={busy || !pw1 || !pw2}><Save size={17} />{busy ? "Guardando…" : "Cambiar contraseña"}</button></div>
        </section>
      ) : null}
    </div>
  );
}
