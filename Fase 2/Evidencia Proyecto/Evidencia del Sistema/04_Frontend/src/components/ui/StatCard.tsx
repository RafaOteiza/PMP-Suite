import type { CSSProperties, KeyboardEvent, ReactNode } from "react";
import type { HealthState } from "../../utils/health";
import { getHealthPresentation } from "../../utils/health";
import { HealthIcon } from "./SemanticIndicator";

export type StatTone = "neutral" | "primary" | "technical" | "success" | "warning" | "danger" | "info" | "flow";
type StatVariant = "primary" | "standard" | "compact" | "inline";

interface StatCardProps {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  meta?: ReactNode;
  icon: ReactNode;
  tone?: StatTone;
  health?: HealthState;
  healthLabel?: string;
  variant?: StatVariant;
  onClick?: () => void;
}

export default function StatCard({ label, value, detail, meta, icon, tone = "primary", health, healthLabel, variant = "standard", onClick }: StatCardProps) {
  const noData = value == null || value === '' || value === '—' || value === 'Sin mediciones';
  const displayHealth: HealthState = noData ? 'neutral' : health || (tone === 'primary' || tone === 'technical' || tone === 'flow' ? 'info' : tone);
  const semantic = getHealthPresentation(displayHealth);
  const tokens = { accent: semantic.accent, soft: semantic.background };
  const style = {
    "--stat-accent": tokens.accent,
    "--stat-soft": tokens.soft
  } as CSSProperties;

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (!onClick) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onClick();
    }
  };

  return (
    <article
      className="stat-card"
      data-interactive={Boolean(onClick)}
      data-variant={variant}
      data-health={displayHealth}
      onClick={onClick}
      onKeyDown={onKeyDown}
      role={onClick ? "link" : undefined}
      tabIndex={onClick ? 0 : undefined}
      style={style}
    >
      <div className="stat-card-top">
        <div>
          <div className="stat-label">{label}</div>
          <div className="stat-value">{value}</div>
        </div>
        <div className="stat-icon" aria-hidden="true">{icon}</div>
      </div>
      <div>
        {detail ? <div className="stat-detail">{detail}</div> : null}
        {meta ? <div className="stat-meta">{meta}</div> : null}
        {health ? <div className="stat-health"><HealthIcon state={displayHealth} size={13} /><span>{noData ? 'Sin datos' : healthLabel || semantic.label}</span></div> : null}
      </div>
    </article>
  );
}
