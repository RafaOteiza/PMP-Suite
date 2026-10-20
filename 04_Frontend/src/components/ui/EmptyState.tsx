import type { ReactNode } from "react";
import type { HealthState } from "../../utils/health";

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  health?: HealthState;
}

export default function EmptyState({ icon, title, description, action, health }: EmptyStateProps) {
  return (
    <div className="empty-state" data-health={health || 'neutral'}>
      <div>
        <div className="empty-state-icon" aria-hidden="true">{icon}</div>
        <h3 className="empty-state-title">{title}</h3>
        {description ? <p className="empty-state-copy">{description}</p> : null}
        {action ? <div className="empty-state-action">{action}</div> : null}
      </div>
    </div>
  );
}
