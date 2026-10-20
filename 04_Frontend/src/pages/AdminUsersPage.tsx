import {usersReport} from '../utils/pageReports';
import {useOutletContext} from 'react-router-dom';
import type {Me} from '../api/me';
import FeedbackBanner from '../components/ui/FeedbackBanner';
import { useEffect, useId, useMemo, useState } from "react";
import { AlertTriangle, ChevronLeft, ChevronRight, Copy, Edit2, Key, Lock, Mail, RefreshCw, Search, Shield, User, UserPlus, X } from "lucide-react";
import { ALLOWED_ROLES, adminCreateUser, adminListUsers, adminResetPasswordLink, adminSetPassword, adminUpdateUser, type AdminUser } from "../api/adminUsers";
import EmptyState from "../components/ui/EmptyState";
import PageHeader from "../components/ui/PageHeader";
import StatusBadge from "../components/ui/StatusBadge";

type NotificationType = { message: string; type: "success" | "error" } | null;

function friendlyError(error: any, fallback: string): string {
  const raw = error?.response?.data?.error ?? error?.response?.data?.detail ?? error?.message ?? fallback;
  if (typeof raw !== "string") return fallback;
  const lower = raw.toLowerCase();
  if (lower.includes("transaction") || lower.includes("postgres") || lower.includes("25p02")) return "Error al actualizar el usuario. Reintenta. Si persiste, contacta soporte.";
  return raw;
}

const roleLabel = (role?: string) => role?.replaceAll("_", " ") || "Sin rol";

export default function AdminUsersPage() {
  const me=useOutletContext<Me|null>();
  const editTitleId = useId();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [busy, setBusy] = useState(false);
  const [notification, setNotification] = useState<NotificationType>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 5;

  const [email, setEmail] = useState("");
  const [nombre, setNombre] = useState("");
  const [apellido, setApellido] = useState("");
  const [rolCrear, setRolCrear] = useState<string>(ALLOWED_ROLES[0]);
  const [createPassword, setCreatePassword] = useState("");
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [editCorreo, setEditCorreo] = useState("");
  const [editNombre, setEditNombre] = useState("");
  const [editApellido, setEditApellido] = useState("");
  const [editRol, setEditRol] = useState<string>(ALLOWED_ROLES[0]);
  const [editActivo, setEditActivo] = useState(true);
  const [newPassword, setNewPassword] = useState("");
  const [newPassword2, setNewPassword2] = useState("");
  const [resetResult, setResetResult] = useState<{ correo: string; link: string } | null>(null);

  const [loadError,setLoadError]=useState("");
  const notify = (message: string, type: "success" | "error") => { setNotification({ message, type }); window.setTimeout(() => setNotification(null), 4000); };
  const processedUsers = useMemo(() => {
    let list = Array.isArray(users) ? [...users] : [];
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      list = list.filter((user) => `${user.nombre} ${user.apellido}`.toLowerCase().includes(term) || (user.email ?? user.correo ?? "").toLowerCase().includes(term) || (user.rol ?? "").toLowerCase().includes(term));
    }
    return list.sort((a, b) => (a.apellido || "").localeCompare(b.apellido || ""));
  }, [users, searchTerm]);
  const totalPages = Math.ceil(processedUsers.length / ITEMS_PER_PAGE);
  const displayedUsers = processedUsers.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  useEffect(() => { setCurrentPage(1); }, [searchTerm]);
  const load = async () => {
    setBusy(true);setLoadError("");
    try { setUsers(await adminListUsers()); } catch (error) { setLoadError(friendlyError(error, "No se pudo consultar usuarios. Reintenta la consulta.")); } finally { setBusy(false); }
  };
  useEffect(() => { void load(); }, []);

  const create = async (event?: React.FormEvent) => {
    event?.preventDefault(); setBusy(true);
    try {
      await adminCreateUser({ email: email.trim(), nombre: nombre.trim(), apellido: apellido.trim(), rol: rolCrear, password: createPassword.trim() || undefined });
      setEmail(""); setNombre(""); setApellido(""); setCreatePassword(""); setRolCrear(ALLOWED_ROLES[0]); notify("Usuario creado exitosamente.", "success"); await load();
    } catch (error) { notify(friendlyError(error, "Error creando usuario"), "error"); } finally { setBusy(false); }
  };

  const openEdit = (user: AdminUser) => {
    setNotification(null); setResetResult(null); setNewPassword(""); setNewPassword2(""); setEditing(user);
    setEditCorreo(user.correo ?? user.email ?? ""); setEditNombre(user.nombre ?? ""); setEditApellido(user.apellido ?? ""); setEditRol(user.rol ?? user.roles?.[0] ?? ALLOWED_ROLES[0]); setEditActivo(user.activo !== undefined ? user.activo : true);
  };
  const closeEdit = () => { setEditing(null); setResetResult(null); setNewPassword(""); setNewPassword2(""); };
  const saveEdit = async (event?: React.FormEvent) => {
    event?.preventDefault(); if (!editing) return; setBusy(true);
    try {
      const payload: Partial<AdminUser> = {};
      if (editCorreo.trim() !== (editing.correo ?? editing.email)) payload.correo = editCorreo.trim();
      if (editNombre.trim() !== editing.nombre) payload.nombre = editNombre.trim();
      if (editApellido.trim() !== (editing.apellido ?? "")) payload.apellido = editApellido.trim();
      if (editRol.trim() !== (editing.rol ?? editing.roles?.[0])) payload.rol = editRol.trim();
      if (editActivo !== editing.activo) payload.activo = editActivo;
      if (Object.keys(payload).length > 0) { await adminUpdateUser(editing.id, payload); notify("Usuario actualizado correctamente.", "success"); await load(); }
      closeEdit();
    } catch (error) { notify(friendlyError(error, "Error actualizando usuario"), "error"); } finally { setBusy(false); }
  };
  const doSetPassword = async () => {
    if (!editing) return;
    if (!newPassword || newPassword !== newPassword2) { notify("Las contraseñas no coinciden", "error"); return; }
    setBusy(true); try { await adminSetPassword(editing.id, newPassword); setNewPassword(""); setNewPassword2(""); notify("Contraseña actualizada correctamente", "success"); }
    catch (error) { notify(friendlyError(error, "Error cambiando contraseña"), "error"); } finally { setBusy(false); }
  };
  const doResetPasswordLink = async () => {
    if (!editing) return;
    setBusy(true); try { setResetResult(await adminResetPasswordLink(editing.id)); notify("Enlace generado correctamente", "success"); }
    catch (error) { notify(friendlyError(error, "Error generando enlace"), "error"); } finally { setBusy(false); }
  };
  const copyResetLink = async () => { if (resetResult?.link) try { await navigator.clipboard.writeText(resetResult.link); notify("Enlace copiado", "success"); } catch { notify("No se pudo copiar el enlace", "error"); } };
  const fullName = (user: AdminUser) => `${user.apellido ?? ""}, ${user.nombre ?? ""}`.trim();

  return (
    <div className="page">
      {notification ? <FeedbackBanner tone={notification.type === "error" ? "danger" : "success"}>{notification.message}<button className="btn ghost" onClick={() => setNotification(null)}>Cerrar mensaje</button></FeedbackBanner> : null}
      <PageHeader report={usersReport(searchTerm,busy||!!loadError)} eyebrow="Administración del sistema" title="Usuarios y accesos" description="Alta, edición, roles oficiales y seguridad de las cuentas." icon={<Shield size={21} />} actions={<button onClick={load} className="btn ghost" disabled={busy}><RefreshCw size={17} className={busy ? "animate-spin" : ""} /> Actualizar</button>} />

      <section className="panel user-create-panel">
        <div className="section-heading"><div><h2 className="section-title"><UserPlus size={19} /> Crear usuario</h2><p className="small muted">Registra una nueva identidad operacional con su rol oficial.</p></div></div>
        <form className="user-create-grid" onSubmit={create} autoComplete="off">
          <div className="field"><label className="field-label" htmlFor="new-email"><Mail size={14} /> Correo</label><input id="new-email" className="input" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="correo@pmp-suite.cl" autoComplete="off" name="new_user_email" /></div>
          <div className="field"><label className="field-label" htmlFor="new-name"><User size={14} /> Nombre</label><input id="new-name" className="input" value={nombre} onChange={(event) => setNombre(event.target.value)} placeholder="Nombre" autoComplete="off" name="new_user_name" /></div>
          <div className="field"><label className="field-label" htmlFor="new-lastname"><User size={14} /> Apellido</label><input id="new-lastname" className="input" value={apellido} onChange={(event) => setApellido(event.target.value)} placeholder="Apellido" autoComplete="off" name="new_user_surname" /></div>
          <div className="field"><label className="field-label" htmlFor="new-role"><Shield size={14} /> Rol</label><select id="new-role" value={rolCrear} onChange={(event) => setRolCrear(event.target.value)}>{ALLOWED_ROLES.map((role) => <option key={role} value={role}>{roleLabel(role)}</option>)}</select></div>
          <div className="field"><label className="field-label" htmlFor="new-pass"><Lock size={14} /> Contraseña opcional</label><input id="new-pass" className="input" type="password" value={createPassword} onChange={(event) => setCreatePassword(event.target.value)} placeholder="Vacía: usar recuperación para habilitar acceso" autoComplete="new-password" /></div>
          <button className="btn create-user-action" disabled={busy || !email.trim() || !nombre.trim() || !apellido.trim()}>{busy ? "Procesando…" : <><UserPlus size={17} /> Crear usuario</>}</button>
        </form>
      </section>

      <section className="panel users-table-panel">
        <div className="toolbar"><div className="search page-search"><Search size={17} /><input type="search" placeholder="Nombre, correo o rol…" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} aria-label="Buscar usuarios" /></div>{!busy&&!loadError&&<StatusBadge tone="neutral">{processedUsers.length} usuarios</StatusBadge>}</div>
        {busy?<p role="status">Consultando usuarios…</p>:loadError?<FeedbackBanner tone="danger">{loadError}</FeedbackBanner>:displayedUsers.length === 0 ? <EmptyState icon={<User size={24} />} title="Sin usuarios coincidentes" description="Ajusta la búsqueda o actualiza el listado." /> : (
          <div className="table-wrap"><table><thead><tr><th>Usuario</th><th>Correo</th><th>Rol</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>{displayedUsers.map((user) => <tr key={user.id} data-health={user.activo ? "success" : "neutral"}><td><span className="user-cell"><span className="user-avatar"><User size={15} /></span><strong>{fullName(user)}</strong></span></td><td>{user.email ?? user.correo}</td><td><StatusBadge tone="primary">{roleLabel(user.rol)}</StatusBadge></td><td><StatusBadge health={user.activo ? "success" : "neutral"}>{user.activo ? "Activo" : "Inactivo"}</StatusBadge></td><td><button className="icon-btn" disabled={busy} onClick={() => openEdit(user)} aria-label={`Editar ${fullName(user)}`}><Edit2 size={16} /></button></td></tr>)}</tbody></table></div>
        )}
        {!busy&&!loadError&&totalPages > 1 ? <footer className="pagination-bar"><span className="small muted">Página {currentPage} de {totalPages}</span><div className="toolbar-group"><button onClick={() => setCurrentPage((page) => Math.max(page - 1, 1))} disabled={currentPage === 1} className="icon-btn" aria-label="Página anterior"><ChevronLeft size={18} /></button><button onClick={() => setCurrentPage((page) => Math.min(page + 1, totalPages))} disabled={currentPage === totalPages} className="icon-btn" aria-label="Página siguiente"><ChevronRight size={18} /></button></div></footer> : null}
      </section>

      {editing ? (
        <div className="operation-section">
          <section className="panel operation-form user-edit-panel" role="region" aria-labelledby={editTitleId}>
            <header className="operation-header"><div><div className="dashboard-eyebrow">Cuenta del sistema</div><h2 id={editTitleId}>Editar usuario</h2></div><button onClick={closeEdit} className="icon-btn" aria-label="Cerrar edición"><X size={18} /></button></header>
            <form className="edit-user-form" onSubmit={saveEdit}>
              <div className="field"><label className="field-label" htmlFor="edit-email"><Mail size={14} /> Correo</label><input id="edit-email" className="input" value={editCorreo} onChange={(event) => setEditCorreo(event.target.value)} /></div>
              <div className="form-grid"><div className="field"><label className="field-label" htmlFor="edit-name">Nombre</label><input id="edit-name" className="input" value={editNombre} onChange={(event) => setEditNombre(event.target.value)} /></div><div className="field"><label className="field-label" htmlFor="edit-lastname">Apellido</label><input id="edit-lastname" className="input" value={editApellido} onChange={(event) => setEditApellido(event.target.value)} /></div></div>
              <div className="field"><label className="field-label" htmlFor="edit-role"><Shield size={14} /> Rol</label><select id="edit-role" disabled={editing?.id===me?.id} value={editRol} onChange={(event) => setEditRol(event.target.value)}>{ALLOWED_ROLES.map((role) => <option key={role} value={role}>{roleLabel(role)}</option>)}</select></div>
              <label className="check-row account-active"><input type="checkbox" disabled={editing?.id===me?.id} checked={editActivo} onChange={(event) => setEditActivo(event.target.checked)} /><span><strong>Usuario activo</strong><small>Permitir inicio de sesión y acceso según su rol.</small></span></label>
            </form>

            <section className="security-zone"><div className="security-zone-title"><AlertTriangle size={17} /><strong>Seguridad de la cuenta</strong></div><div className="form-grid"><div className="field"><label className="field-label" htmlFor="manual-pass">Nueva contraseña</label><input id="manual-pass" className="input" type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} autoComplete="new-password" /></div><div className="field"><label className="field-label" htmlFor="manual-pass-confirm">Confirmación</label><input id="manual-pass-confirm" className="input" type="password" value={newPassword2} onChange={(event) => setNewPassword2(event.target.value)} autoComplete="new-password" /></div></div><div className="security-actions"><button type="button" onClick={doSetPassword} disabled={busy || !newPassword} className="btn ghost"><Key size={15} /> Actualizar contraseña</button><button type="button" onClick={doResetPasswordLink} className="btn ghost" disabled={busy}>Generar enlace de recuperación</button></div>{resetResult ? <div className="reset-link"><span title={resetResult.link}>{resetResult.link}</span><button onClick={copyResetLink} className="icon-btn" title="Copiar enlace"><Copy size={15} /></button></div> : null}</section>

            <footer className="operation-actions"><button className="btn ghost" onClick={closeEdit} disabled={busy}>Cancelar</button><button className="btn" onClick={saveEdit} disabled={busy || !editNombre.trim()}>{busy ? "Guardando…" : "Guardar cambios"}</button></footer>
          </section>
        </div>
      ) : null}
    </div>
  );
}
