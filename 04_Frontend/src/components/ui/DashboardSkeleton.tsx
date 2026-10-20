function Block({ height }: { height: number }) {
  return <div className="skeleton" style={{ height }} aria-hidden="true" />;
}

export default function DashboardSkeleton() {
  return (
    <div className="page dashboard-page" role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">Cargando métricas del dashboard</span>
      <Block height={96} />
      <div className="dashboard-priority-grid">
        {Array.from({ length: 4 }, (_, index) => <Block key={index} height={106} />)}
      </div>
      <div className="chart-grid">
        <Block height={180} />
        <Block height={180} />
      </div>
    </div>
  );
}
