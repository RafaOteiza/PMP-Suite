import type { LabTicket } from '../api/lab';
import { labSLA } from '../utils/labWorkload';
import { DashboardBars, DashboardDonut } from './ui/DashboardCharts';
const series = [
  {key:'vigente',label:'Dentro de plazo',color:'var(--status-success)'},
  {key:'critico',label:'Próximo a vencer',color:'var(--status-warning)'},
  {key:'vencido',label:'Vencido',color:'var(--status-danger)'},
  {key:'sinSla',label:'Sin medición',color:'var(--chart-neutral)'}
];
function bucket(ticket: LabTicket) {
  const sla=labSLA(ticket);
  return sla.sinSla?3:sla.vencido?2:sla.critico?1:0;
}
export default function LabWorkloadCharts({ tickets, onConsult }: { tickets: LabTicket[]; onConsult?: (query: string) => void }) {
  const groups=[...new Set(tickets.map(t=>t.tecnico_laboratorio_id||''))];
  const counts=(items:LabTicket[])=>series.map((_,i)=>items.filter(t=>bucket(t)===i).length);
  const totals=counts(tickets);
  return <div className="pmp-dashboard-charts">
    <DashboardBars title="Carga por técnico" description="OS activas recibidas físicamente. Cada OS cuenta una vez; carga no equivale a productividad." emptyTitle="Sin carga activa" series={series} rows={groups.map(id=>{
      const work=tickets.filter(t=>(t.tecnico_laboratorio_id||'')===id);
      return {key:id||'pending',label:id?(work[0].tecnico_laboratorio||'Técnico asignado'):'Sin asignar',values:counts(work),onSelect:onConsult?()=>onConsult(id?'tab=assigned&tecnico='+encodeURIComponent(id):'tab=pending'):undefined};
    })}/>
    <DashboardDonut title="Estado del SLA" description="Carga activa · desde la recepción vigente. Excluye equipos en camino y listos para salida." unit="OS activas" emptyTitle="Sin carga activa" items={series.map((s,i)=>({...s,value:totals[i],onSelect:onConsult?()=>onConsult('tab=all&sla='+s.key):undefined}))}/>
  </div>;
}
