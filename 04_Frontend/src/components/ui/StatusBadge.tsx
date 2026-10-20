import { Children, type ReactNode } from "react";
import type { HealthState } from "../../utils/health";
import { HealthIcon } from "./SemanticIndicator";
import { healthFromStatusName } from "../../utils/health";

export type StatusTone = "success" | "warning" | "danger" | "info" | "flow" | "primary" | "technical" | "neutral";

interface StatusBadgeProps {
  children: ReactNode;
  tone?: StatusTone;
  health?: HealthState;
  showHealthIcon?: boolean;
}

export default function StatusBadge({ children, tone, health, showHealthIcon = true }: StatusBadgeProps) {
  const text = Children.toArray(children).filter(child => typeof child === 'string' || typeof child === 'number').join(' ');
  const inferred = healthFromStatusName(text);
  // The former decorative flow tone now follows the same status semantics as other badges.
  const state: HealthState = health === 'flow' || (!health && tone === 'flow')
    ? inferred === 'neutral' ? 'info' : inferred
    : health || (tone ? (tone === 'primary' || tone === 'technical' ? 'info' : tone) : inferred);
  return (
    <span className="status-badge" data-tone={state} data-health={state}>
      {state !== 'neutral' && showHealthIcon ? <HealthIcon state={state} size={12} /> : null}
      {children}
    </span>
  );
}
