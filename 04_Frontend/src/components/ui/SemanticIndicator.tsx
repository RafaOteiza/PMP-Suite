import { Activity, AlertCircle, AlertTriangle, CheckCircle2, Circle, Info } from "lucide-react";
import type { HealthState } from "../../utils/health";
import { getHealthPresentation } from "../../utils/health";

const icons = {
  "check-circle": CheckCircle2,
  "alert-triangle": AlertTriangle,
  "alert-circle": AlertCircle,
  info: Info,
  activity: Activity,
  circle: Circle
};

interface SemanticIndicatorProps {
  state: HealthState;
  label?: string;
  detail?: string;
  detailTitle?: string;
  compact?: boolean;
}

export function HealthIcon({ state, size = 14 }: { state: HealthState; size?: number }) {
  const Icon = icons[getHealthPresentation(state).icon];
  return <Icon size={size} aria-hidden="true" />;
}

export default function SemanticIndicator({ state, label, detail, detailTitle, compact = false }: SemanticIndicatorProps) {
  const semantic = getHealthPresentation(state);
  return (
    <span className="semantic-indicator" data-health={state} data-compact={compact}>
      <span className="semantic-indicator-icon"><HealthIcon state={state} size={compact ? 12 : 14} /></span>
      <span className="semantic-indicator-label">{label || semantic.label}</span>
      {detail ? <span className="semantic-indicator-detail" title={detailTitle}>{detail}</span> : null}
    </span>
  );
}
