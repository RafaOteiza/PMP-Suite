import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";

type FeedbackTone = "danger" | "warning" | "success" | "info";

const icons = {
  danger: AlertTriangle,
  warning: AlertTriangle,
  success: CheckCircle2,
  info: Info
};

export default function FeedbackBanner({ tone = "info", children, onDismiss }: { tone?: FeedbackTone; children: ReactNode; onDismiss?: () => void }) {
  const Icon = icons[tone];
  return (
    <div className="feedback-banner" data-tone={tone} role={tone === "danger" ? "alert" : "status"}>
      <div className="feedback-banner-content"><Icon size={19} aria-hidden="true" /><div>{children}</div></div>
      {onDismiss ? <button className="icon-btn" onClick={onDismiss} aria-label="Cerrar mensaje"><X size={16} /></button> : null}
    </div>
  );
}
