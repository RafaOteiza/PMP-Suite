import type { ReactNode } from 'react';
import { DashboardBars, DashboardDonut } from './ui/DashboardCharts';
type Distribution = { etapa: string; label: string; validadores: number; consolas: number; total: number };
export default function AssetDistributionCharts({ rows, onExplore, detail }: { rows: Distribution[]; onExplore: (filters: Record<string,string>) => void; detail: ReactNode }) {
  const validadores=rows.reduce((sum,r)=>sum+r.validadores,0),consolas=rows.reduce((sum,r)=>sum+r.consolas,0);
  return <div className="pmp-dashboard-charts">
    <DashboardBars title="Distribución de activos" description="Etapas y ubicaciones · cada activo cuenta una vez. Selecciona una barra para consultar." emptyTitle="Sin activos registrados"
      series={[{key:'validadores',label:'Validadores',color:'var(--chart-primary)'},{key:'consolas',label:'Consolas',color:'var(--chart-secondary)'}]}
      rows={rows.map(r=>({key:r.etapa,label:r.label,values:[r.validadores,r.consolas],onSelect:()=>onExplore({etapa:r.etapa})}))} detail={detail}/>
    <DashboardDonut title="Composición del parque" description="Tipos de equipo registrados · selecciona un tipo para ver sus activos." unit="activos" emptyTitle="Sin activos registrados" items={[
      {key:'validadores',label:'Validadores',value:validadores,color:'var(--chart-primary)',onSelect:()=>onExplore({tipo:'VALIDADOR'})},
      {key:'consolas',label:'Consolas',value:consolas,color:'var(--chart-secondary)',onSelect:()=>onExplore({tipo:'CONSOLA'})}
    ]}/>
  </div>;
}
