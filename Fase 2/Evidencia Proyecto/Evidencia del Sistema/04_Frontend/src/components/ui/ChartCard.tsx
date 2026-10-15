import type { ReactNode } from "react";

interface ChartCardProps {
  title: string;
  description?: string;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}

export default function ChartCard({ title, description, children, action, className = "" }: ChartCardProps) {
  return (
    <section className={`chart-card ${className}`.trim()}>
      <header className="chart-card-header">
        <div>
          <h2 className="chart-card-title">{title}</h2>
          {description ? <p className="chart-card-description">{description}</p> : null}
        </div>
        {action}
      </header>
      <div className="chart-card-body">{children}</div>
    </section>
  );
}
