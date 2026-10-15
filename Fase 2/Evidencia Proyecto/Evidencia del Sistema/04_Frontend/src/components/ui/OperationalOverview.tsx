import type { ReactNode } from "react";
import type { HealthState } from "../../utils/health";
import SemanticIndicator from "./SemanticIndicator";

interface OverviewMetric {
  label: string;
  value: ReactNode;
}

interface OperationalOverviewProps {
  title: string;
  primaryLabel: string;
  primaryValue: ReactNode;
  metrics: OverviewMetric[];
  updatedAt?: string;
  health?: HealthState;
  healthLabel?: string;
}

export default function OperationalOverview({
  title,
  primaryLabel,
  primaryValue,
  metrics,
  updatedAt,
  health,
  healthLabel
}: OperationalOverviewProps) {
  return (
    <section className="operational-overview" data-health={health} aria-labelledby="operational-overview-title">
      <header className="operational-overview-header">
        <h2 id="operational-overview-title">{title}</h2>
        <div className="overview-freshness" aria-label={updatedAt ? `Datos actualizados a las ${updatedAt}` : "Datos actualizados"}>
          <span>{updatedAt ? `Última actualización ${updatedAt}` : "Datos actualizados"}</span>
        </div>
      </header>

      <div className="operational-overview-body">
        <div className="overview-primary-metric">
          <strong>{primaryValue}</strong>
          <span>{primaryLabel}</span>
          {health ? <SemanticIndicator state={health} label={healthLabel} compact /> : null}
        </div>
        <dl className="overview-metrics">
          {metrics.map((metric) => (
            <div key={metric.label}>
              <dt>{metric.label}</dt>
              <dd>{metric.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
