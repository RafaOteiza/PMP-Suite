import {can,PERMISSIONS} from '../app/rbac';
import { LogOut, Settings } from "lucide-react";
import { signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import type { Me } from "../api/me";
import { fbAuth } from "../app/firebase";
import { useSession } from "../app/SessionContext";

interface UserMenuProps {
  me: Me | null;
  displayName: string;
  initials: string;
  routeKey: string;
}

export default function UserMenu({ me, displayName, initials, routeKey }: UserMenuProps) {
  const roleLabel = me?.rol === "qa" ? "QA" : me?.rol?.replaceAll("_", " ");
  const { endSession } = useSession();
  const navigate = useNavigate();

  const logout = async () => {
    try {
      await signOut(fbAuth);
    } catch (error) {
      console.error("Firebase signOut error:", error);
    }
    endSession();
    navigate("/login");
  };

  return (
    <details className="user-menu" key={routeKey}>
      <summary className="user-menu-trigger" aria-label={`Opciones de ${displayName}`}>
        <span className="user-avatar" aria-hidden="true">{initials}</span>
        <span className="user-menu-copy">
          <span className="session-name">{displayName}</span>
          <span className="session-meta">{roleLabel || "Sesión activa"}</span>
        </span>
        <span className="user-menu-chevron" aria-hidden="true" />
      </summary>

      <div className="user-menu-popover" role="menu">
        <div className="user-menu-summary">
          <strong>{displayName}</strong>
          <span>{me?.correo}</span>
          <span className="status-badge" data-tone="neutral">{roleLabel}</span>
        </div>
        {can(me,PERMISSIONS.SETTINGS_VIEW)&&<button type="button" role="menuitem" onClick={() => navigate("/settings")}><Settings size={17} /> Mi cuenta y seguridad</button>}
        <div className="user-menu-separator" />
        <button type="button" role="menuitem" className="user-menu-logout" onClick={logout}><LogOut size={17} /> Cerrar sesión</button>
      </div>
    </details>
  );
}
