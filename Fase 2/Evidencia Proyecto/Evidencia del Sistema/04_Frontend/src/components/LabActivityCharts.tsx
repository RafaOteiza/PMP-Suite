import type {LabSupervision} from '../api/executive';
import {DashboardBars,DashboardDonut} from './ui/DashboardCharts';
import StatCard from './ui/StatCard';
import {CheckCircle,RefreshCw} from 'lucide-react';

const results:Record<string,{label:string;color:string}>={
 REPARADO:{label:'Reparado',color:'var(--status-success)'},NFF:{label:'Sin falla encontrada',color:'var(--chart-primary)'},
 POD:{label:'Daño de tercero',color:'var(--status-warning)'},NO_REPARABLE:{label:'No reparable',color:'var(--status-danger)'},
 SIN_REGISTRO:{label:'Sin resultado registrado',color:'var(--chart-neutral)'}
};
export default function LabActivityCharts({insights}:{insights:LabSupervision['labInsights']}){
 return <section aria-label="Actividad técnica registrada">
  <h2 className="section-title">Actividad técnica registrada</h2>
  <div className="assignment-stats">
   <StatCard label="Cierres técnicos" value={insights.finished30Days} detail="Últimos 30 días · una vez por OS y ciclo" icon={<CheckCircle size={19}/>} tone="info" variant="compact"/>
   <StatCard label="Activos reincidentes" value={insights.recurrentAssets} detail="Más de una OS por falla · historial completo" icon={<RefreshCw size={19}/>} tone={insights.recurrentAssets?'warning':'neutral'} variant="compact"/>
  </div>
  <div className="pmp-dashboard-charts">
   <DashboardBars title="Cierres por semana" description="Ventana móvil de 30 días; semanas inicial y actual pueden estar incompletas. Incluye NFF y PoD." emptyTitle={insights.closuresByWeek?'Sin cierres en el período':'Detalle semanal no disponible'} series={[{key:'cierres',label:'Cierres técnicos',color:'var(--chart-primary)'}]} rows={(insights.closuresByWeek||[]).map(w=>({key:w.semana,label:'Desde '+w.semana.split('-').reverse().join('-'),values:[w.total]}))}/>
   <DashboardDonut title="Resultados de los cierres" description="Resultado técnico registrado · últimos 30 días. No representa dictamen QA." unit="cierres" emptyTitle={insights.closureResults?'Sin cierres en el período':'Resultados no disponibles'} items={(insights.closureResults||[]).map(r=>({key:r.resultado,...(results[r.resultado]||{label:'Otro resultado registrado',color:'var(--chart-neutral)'}),value:r.total}))}/>
  </div>
 </section>;
}
