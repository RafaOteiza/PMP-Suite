import { Eye } from "lucide-react";
import type { Me } from "../api/me";
import { isReadOnlyRole } from "../app/rbac";

export default function ReadOnlyNotice({ me }: { me: Me | null }) {
  if (!isReadOnlyRole(me)) return null;

  return (
    <div className="read-only-notice" role="status" aria-label="Modo solo lectura">
      <Eye size={18} aria-hidden="true" />
      <div>
        <div className="read-only-title">Modo solo lectura</div>
        <div className="read-only-copy">Puedes consultar información, pero tu rol no permite modificaciones.</div>
      </div>
    </div>
  );
}
