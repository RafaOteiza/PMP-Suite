import { useState, type CSSProperties, type ReactNode } from 'react';
import ChartCard from './ChartCard';
import EmptyState from './EmptyState';
import { BarChart3 } from 'lucide-react';
import '../../styles/dashboard-charts.css';

export type ChartSeries = { key: string; label: string; color: string };
export type ChartRow = { key: string; label: string; displayLabel?: string; annotation?: string; values: number[]; onSelect?: () => void };
const number = (value: number) => value.toLocaleString('es-CL');

/** Bars share a zero-based scale; labels and native buttons expose the same data to keyboard/AT. */
export function DashboardBars({ title, description, series, rows, emptyTitle = 'Sin registros', detail, compact = false }: {
  title: string; description: string; series: ChartSeries[]; rows: ChartRow[]; emptyTitle?: string; detail?: ReactNode; compact?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const totals = rows.map(row => row.values.reduce((sum, value) => sum + value, 0));
  const max = Math.max(0, ...totals);
  const visibleRows = compact && !expanded ? rows.slice(0, 5) : rows;
  return <ChartCard title={title} description={description} className={`pmp-data-chart${compact ? ' pmp-data-chart-dense' : ''}`}>
    {max === 0 ? <EmptyState icon={<BarChart3 size={24}/>} title={emptyTitle} description="El gráfico aparecerá cuando existan datos para comparar."/> : <>
      <div className="pmp-chart-legend">{series.map(s => <span key={s.key}><i style={{ background: s.color }} aria-hidden="true"/>{s.label}</span>)}</div>
      <p className="pmp-chart-scale small muted">Escala común: 0–{number(max)} · cantidades absolutas</p>
      <ul className="pmp-chart-bars" aria-label={title}>{visibleRows.map((row, index) => {
        const text = `${row.label}: ${number(totals[index])}. ${series.map((s, i) => `${s.label}: ${number(row.values[i])}`).join('; ')}`;
        const content = <><span className="pmp-chart-category">{row.displayLabel ?? row.label}{row.annotation && <small className="pmp-chart-annotation">{row.annotation}</small>}</span><span className="pmp-chart-track" aria-hidden="true">{series.map((s, i) => <span key={s.key} style={{ width: `${row.values[i] / max * 100}%`, background: s.color }}/>)}</span><strong>{number(totals[index])}</strong></>;
        return <li key={row.key}>{row.onSelect ? <button className="pmp-chart-bar" aria-label={`${text}. Consultar`} title={text} onClick={row.onSelect}>{content}</button> : <div className="pmp-chart-bar" aria-label={text} title={text}>{content}</div>}</li>;
      })}</ul>
      {compact && rows.length > 5 && <button className="btn ghost pmp-chart-expand" aria-expanded={expanded} onClick={() => setExpanded(value => !value)}>{expanded ? 'Mostrar 5 principales' : `Ver las ${rows.length} categorías`}</button>}
    </>}
    <details className="pmp-chart-data"><summary>Ver datos · {title}</summary>{detail || <div className="pmp-chart-table"><table><caption className="sr-only">{title}</caption><thead><tr><th scope="col">Categoría</th>{series.map(s => <th scope="col" key={s.key}>{s.label}</th>)}<th scope="col">Total</th></tr></thead><tbody>{rows.map((r, i) => <tr key={r.key}><th scope="row">{r.label}</th>{r.values.map((value, j) => <td key={series[j].key}>{number(value)}</td>)}<td>{number(totals[i])}</td></tr>)}</tbody></table></div>}</details>
  </ChartCard>;
}

export function DashboardDonut({ title, description, items, unit, emptyTitle = 'Sin registros' }: {
  title: string; description: string; items: { key: string; label: string; value: number; color: string; onSelect?: () => void }[]; unit: string; emptyTitle?: string;
}) {
  const total = items.reduce((sum, item) => sum + item.value, 0);
  let offset = 0;
  return <ChartCard title={title} description={description} className="pmp-data-chart">
    {!total ? <EmptyState icon={<BarChart3 size={24}/>} title={emptyTitle} description="Sin datos para calcular una distribución."/> : <div className="pmp-donut-layout">
      <div className="pmp-donut"><svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="48" fill="none" stroke="var(--border)" strokeWidth="12"/>{items.map(item => {
        const start = offset; const share = item.value / total * 100; offset += share;
        return item.value > 0 ? <circle key={item.key} cx="60" cy="60" r="48" fill="none" stroke={item.color} strokeWidth="12" pathLength="100" strokeDasharray={`${share} ${100-share}`} strokeDashoffset={-start} transform="rotate(-90 60 60)"/> : null;
      })}</svg><div className="pmp-donut-total"><strong>{number(total)}</strong><span>{unit}</span></div></div>
      <ul className="pmp-donut-legend" aria-label={title}>{items.map(item => {
        const content = <><i style={{ background: item.color }} aria-hidden="true"/><span>{item.label}</span><strong>{number(item.value)}</strong><small>{Math.round(item.value / total * 100)} %</small></>;
        return <li key={item.key} style={{ '--chart-item-color': item.color } as CSSProperties}>{item.onSelect ? <button aria-label={`${item.label}: ${number(item.value)}. Consultar`} onClick={item.onSelect}>{content}</button> : <div>{content}</div>}</li>;
      })}</ul>
    </div>}
  </ChartCard>;
}
