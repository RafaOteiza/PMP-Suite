import {useEffect,useState} from 'react';
import {Brain,Bus,ClipboardList,Cpu,RefreshCw} from 'lucide-react';
import {getOperationalInsights,type OperationalInsights} from '../api/ai';
import AIRiskPanel from '../components/AIRiskPanel';
import PageHeader from '../components/ui/PageHeader';
import StatCard from '../components/ui/StatCard';
import FeedbackBanner from '../components/ui/FeedbackBanner';
import {DashboardBars} from '../components/ui/DashboardCharts';
import {insightLabel} from '../utils/aiPresentation';
import '../styles/ai-insights.css';
import MaintenanceInsights from '../components/MaintenanceInsights';
import {maintenanceReport} from '../utils/maintenanceReport';

const equipment=[{key:'validador',label:'Validadores',color:'var(--chart-primary)'},{key:'consola',label:'Consolas',color:'var(--chart-secondary)'}];
const count=[{key:'count',label:'OS por falla',color:'var(--chart-primary)'}];
export default function AIPredictionsPage(){
 const [revision,setRevision]=useState(0);
 const [assetQuery,setAssetQuery]=useState('');
 const [data,setData]=useState<OperationalInsights|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(true);
 const load=async()=>{setLoading(true);setError('');try{setData(await getOperationalInsights());}catch{setData(null);setError('No fue posible consultar los patrones históricos. Reintenta la consulta.');}finally{setLoading(false);}};
 useEffect(()=>{void load();},[]);
 return <div className="page ai-insights-page">

  <PageHeader report={{title:'Analisis de mantenimiento',disabled:loading||!!error||!data,filters:{'Recurrencia e intervenciones':assetQuery||'Todos los activos'},load:()=>maintenanceReport(data!,assetQuery)}} eyebrow="Inteligencia operacional" title="Análisis de fallas / IA" description="Antecedentes compartidos para Gerencia, Jefatura y Bodega. Consulta de solo lectura." icon={<Brain size={21}/>} actions={<button className="btn ghost" onClick={()=>{void load();setRevision(r=>r+1);}} disabled={loading}><RefreshCw size={17}/> Actualizar análisis</button>}/>
  <div className="ai-insights-context"><span className="status-badge" data-tone="primary">Análisis histórico</span><span>Se recalcula al abrir esta vista o actualizar. Sin refresco periódico.</span></div>
  <details className="ai-insights-method"><summary>Cómo interpretar este análisis</summary><p>Los gráficos describen registros históricos. Una concentración de fallas en un bus requiere investigación: no demuestra causalidad ni considera kilómetros u horas de uso. La priorización IA es heurística, no una probabilidad validada de falla.</p><p>La longitud de cada barra compara cantidades dentro del mismo gráfico, desde cero. No representa un porcentaje de riesgo. Los rankings muestran hasta 10 categorías; «Ver datos» conserva el texto completo registrado.</p></details>
  {loading?<p role="status">Consultando patrones históricos…</p>:error?<FeedbackBanner tone="danger">{error}</FeedbackBanner>:data&&<>
   <section className="pmp-insight-stats" aria-label="Cobertura del análisis">
    <StatCard label="OS por falla analizadas" value={data.summary.orders} detail="Historial completo · excluye instalaciones IN" icon={<ClipboardList size={18}/>} variant="compact"/>
    <StatCard label="Activos con intervenciones" value={data.summary.assets} detail="Identidad única: tipo + serie" icon={<Cpu size={18}/>} variant="compact"/>
    <StatCard label="Buses relacionados" value={data.summary.buses} detail={`${data.summary.withoutBus} OS sin bus informado`} icon={<Bus size={18}/>} variant="compact"/>
   </section>
   <div className="ai-insights-context"><span>Actualizado: {new Date(data.updatedAt).toLocaleString('es-CL')}</span>{data.summary.simulationOrders>0&&<span className="status-badge" data-tone="warning">{data.summary.simulationOrders} OS de simulación · no validan predicciones</span>}</div>
   {data.analysis&&<MaintenanceInsights data={data.analysis} query={assetQuery} onQuery={setAssetQuery}/>}
   <div className="pmp-dashboard-charts">
    <DashboardBars compact title="Fallas registradas por bus" description="Bus asociado a la OS. Una OS cuenta una vez; no son tasas de falla." emptyTitle="Sin fallas asociadas a buses" series={equipment} rows={data.buses.slice(0,10).map(b=>({key:b.ppu,label:b.ppu,values:[b.validadores,b.consolas]}))}/>
    <DashboardBars compact title="Componentes entregados a reparación" description="OS con entrega física registrada de cada repuesto. Una entrega no confirma que el componente sea la causa de falla." emptyTitle="Sin entregas de componentes registradas" series={[{key:'os',label:'OS con entrega',color:'var(--chart-secondary)'}]} rows={data.components.slice(0,10).map(c=>({key:c.referencia+':'+c.nombre,label:c.nombre,values:[c.ordenes]}))} detail={<div className="pmp-chart-table"><table><thead><tr><th>Componente</th><th>OS</th><th>Unidades entregadas</th></tr></thead><tbody>{data.components.slice(0,10).map(c=><tr key={c.referencia+':'+c.nombre}><th scope="row">{c.nombre}</th><td>{c.ordenes}</td><td>{c.unidades}</td></tr>)}</tbody></table></div>}/>
   </div>
   <div className="pmp-dashboard-charts">
    <DashboardBars compact title="Fallas reportadas" description="Texto registrado en los requerimientos. No equivale al diagnóstico confirmado." emptyTitle="Sin fallas reportadas" series={count} rows={data.faults.slice(0,10).map(f=>({key:f.falla,label:f.falla,...insightLabel(f.falla),values:[f.total]}))}/>
    <DashboardBars compact title="Diagnósticos técnicos registrados" description="Falla real registrada al cerrar el trabajo. Una observación por OS y ciclo; sin inferir componentes ausentes." emptyTitle="Sin diagnósticos registrados" series={[{key:'diagnosis',label:'Cierres con diagnóstico',color:'var(--chart-secondary)'}]} rows={data.diagnoses.slice(0,10).map(f=>({key:f.falla,label:f.falla,...insightLabel(f.falla),values:[f.total]}))}/>
   </div>
  </>}
  <AIRiskPanel key={revision} compact/>
 </div>;
}
