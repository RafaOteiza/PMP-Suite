import type { ReactNode } from "react";
import { CheckCircle, ChevronRight } from "lucide-react";
import type { HealthState } from "../../utils/health";
import SemanticIndicator from "./SemanticIndicator";

interface AttentionItem {
  label: string;
  value: number;
  detail: string;
  icon: ReactNode;
  health?: HealthState;
  healthLabel?: string;
  onClick?: () => void;
}

interface AttentionPanelProps {
  items: AttentionItem[];
  emptyTitle?: string;
  emptyDescription?: string;
}

export default function AttentionPanel({
  items,
  emptyTitle = "Sin excepciones operacionales",
  emptyDescription = "No hay alertas críticas o de atención con las reglas disponibles."
}: AttentionPanelProps) {
  const severity: Record<HealthState, number> = { danger: 6, warning: 5, info: 4, flow: 3, neutral: 2, success: 1 };
  const activeItems = items
    .filter((item) => item.value > 0)
    .map((item, index) => ({ item, index }))
    .sort((a, b) => severity[b.item.health || "info"] - severity[a.item.health || "info"] || a.index - b.index)
    .map(({ item }) => item);
  const panelHealth = activeItems.reduce<HealthState>((highest, item) => {
    const current = item.health || "info";
    return severity[current] > severity[highest] ? current : highest;
  }, activeItems.length ? "neutral" : "success");

  return (
    <section className="attention-panel" aria-labelledby="attention-panel-title">
      <header className="attention-panel-header">
        <h2 id="attention-panel-title">Requiere atención</h2>
        <span className="attention-count" data-health={panelHealth} data-empty={activeItems.length === 0} aria-label={`${activeItems.length} excepciones`}>{activeItems.length}</span>
      </header>

      {activeItems.length === 0 ? (
        <div className="attention-empty">
          <CheckCircle size={20} />
          <div><strong>{emptyTitle}</strong><span>{emptyDescription}</span></div>
        </div>
      ) : (
        <div className="attention-list">
          {activeItems.map((item) => (
            <button type="button" className="attention-item" data-health={item.health || "info"} key={item.label} onClick={item.onClick}>
              <span className="attention-item-icon" aria-hidden="true">{item.icon}</span>
              <span className="attention-item-copy"><strong>{item.label}</strong><small>{item.detail}</small><SemanticIndicator state={item.health || "info"} label={item.healthLabel} compact /></span>
              <span className="attention-item-value">{item.value}</span>
              {item.onClick ? <ChevronRight size={15} aria-hidden="true" /> : null}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
