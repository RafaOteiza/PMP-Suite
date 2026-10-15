interface TooltipPayload {
  name?: string;
  value?: string | number;
  color?: string;
}

interface ChartTooltipProps {
  active?: boolean;
  label?: string;
  payload?: ReadonlyArray<TooltipPayload>;
}

export default function ChartTooltip({ active, label, payload }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      {label ? <div className="chart-tooltip-label">{label}</div> : null}
      {payload.map((item, index) => (
        <div className="chart-tooltip-value" key={`${item.name ?? "value"}-${index}`} style={{ color: item.color }}>
          {item.name ? `${item.name}: ` : ""}{item.value}
        </div>
      ))}
    </div>
  );
}
