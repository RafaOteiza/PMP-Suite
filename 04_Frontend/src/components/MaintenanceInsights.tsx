import {useState} from 'react';
import {Search,Activity} from 'lucide-react';
import type {MaintenanceAnalysis} from '../api/ai';
import {formatDate} from '../utils/formatters';
import {DashboardDonut} from './ui/DashboardCharts';
import EmptyState from './ui/EmptyState';
import StatusBadge from './ui/StatusBadge';
import FeedbackBanner from './ui/FeedbackBanner';
export const outcomeLabels:Record<string,string>={REPARADO:'Reparado',NFF:'Sin falla encontrada',POD:'Daño de terceros',NO_REPARABLE:'No reparable',SIN_CIERRE:'Sin cierre técnico',REVISION:'En revisión',PENDIENTE_REPUESTO:'Pendiente de repuesto'};
export default function MaintenanceInsights({data,query,onQuery}:{data:MaintenanceAnalysis;query:string;onQuery:(value:string)=>void}){
 const [tab,setTab]=useState('recurrence');
 const assets=data.assets.filter(a=>`${a.tipo} ${a.serie}`.toLocaleLowerCase('es').includes(query.toLocaleLowerCase('es')));
 const tabs=[['recurrence','Recurrencia y tiempos'],['parts','Repuestos y compras'],['outcomes','Resultados técnicos'],['actions','Acciones preventivas']];
 return <section className="panel maintenance-insights" aria-label="Decisiones de mantenimiento">
  <header className="section-heading"><h2 className="section-title">Decisiones de mantenimiento</h2><StatusBadge tone="neutral">Basadas en registros</StatusBadge></header>
  <div className="tabs" role="tablist" aria-label="Análisis de mantenimiento">{tabs.map(([id,label],index)=><button key={id} role="tab" type="button" id={`maintenance-${id}`} aria-controls="maintenance-panel" aria-selected={tab===id} tabIndex={tab===id?0:-1} className={tab===id?'btn primary':'btn secondary'} onKeyDown={e=>{const next=e.key==='ArrowRight'?(index+1)%tabs.length:e.key==='ArrowLeft'?(index+tabs.length-1)%tabs.length:e.key==='Home'?0:e.key==='End'?tabs.length-1:null;if(next!==null){e.preventDefault();setTab(tabs[next][0]);(e.currentTarget.parentElement?.querySelectorAll('button')[next] as HTMLButtonElement)?.focus();}}} onClick={()=>setTab(id)}>{label}</button>)}</div>
  <div role="tabpanel" id="maintenance-panel" aria-labelledby={`maintenance-${tab}`}>
   {tab==='recurrence'&&<>
    <p className="small muted">Cuántas veces se reportó cada activo, su diagnóstico registrado y el intervalo observado. {data.method.intervalDefinition}</p>
    <label className="search"><Search size={16}/><input aria-label="Buscar recurrencia por tipo o serie" placeholder="Tipo o serie" value={query} onChange={e=>onQuery(e.target.value)}/></label>
    <div className="table-wrap"><table><thead><tr><th>Equipo</th><th>Reportes por falla</th><th>Última falla / diagnóstico</th><th>Tiempo entre reportes</th><th>Próximo mantenimiento</th></tr></thead><tbody>{assets.map(a=><tr key={a.tipo+':'+a.serie}>
     <td data-label="Equipo"><strong>{a.serie}</strong><div className="small muted">{a.tipo}</div></td>
     <td data-label="Reportes por falla">{a.failures}{a.simulationFailures>0&&<div className="small muted">{a.simulationFailures} de simulación</div>}</td>
     <td data-label="Última falla"><span>{formatDate(a.lastFailure)}</span><details><summary>Ver antecedentes</summary><p>Reportada: {a.reportedFault||'Sin registro'}</p><p>Diagnóstico: {a.diagnosis||'Sin diagnóstico confirmado'}</p><ul>{a.incidents.map(i=><li key={i.os}>{formatDate(i.fecha)} · {i.os} · {i.falla}</li>)}</ul></details></td>
     <td data-label="Tiempo entre reportes">{a.medianDays===null?'Sin intervalos comparables':`${a.medianDays} días (mediana)`}<div className="small muted">{a.intervals} intervalos observados</div></td>
     <td data-label="Próximo mantenimiento">{a.estimate?<><StatusBadge tone="warning">Referencia histórica</StatusBadge><p>{a.estimate.minDays}–{a.estimate.maxDays} días entre reportes reales; mediana {a.estimate.medianDays}.</p><span className="small muted">No predice una fecha de falla individual.</span></>:<StatusBadge tone="neutral">Historial real insuficiente</StatusBadge>}</td>
    </tr>)}</tbody></table></div>
    {!assets.length&&<EmptyState icon={<Activity size={22}/>} title="Sin fallas para esta consulta" description="Los activos sin reportes no se consideran fallidos."/>}
    <p className="field-hint">Predicción individual: todavía no hay un modelo entrenado y validado. La referencia histórica requiere al menos 3 intervalos reales y 30 días de historial; nunca utiliza simulaciones.</p>
   </>}
   {tab==='parts'&&<>
    <p className="small muted">{data.method.partDefinition} {data.method.purchaseDefinition}</p>
    <div className="table-wrap"><table><thead><tr><th>Repuesto</th><th>Salidas · 90 días</th><th>Stock / umbral</th><th>Cobertura estimada</th><th>Reposición orientativa</th></tr></thead><tbody>{data.parts.map(p=><tr key={p.tipo+':'+p.nombre}>
     <td data-label="Repuesto"><strong>{p.nombre}</strong><div className="small muted">{p.tipo}</div></td><td data-label="Salidas 90 días">{p.units90} unidades<div className="small muted">{p.realUnits90} reales · {p.simulationUnits90} de simulación</div></td>
     <td data-label="Stock / umbral"><StatusBadge tone={p.stock<=0?'danger':p.stock<=p.critical?'warning':'success'}>{p.stock} / {p.critical}</StatusBadge></td>
     <td data-label="Cobertura">{p.coverageDays===null?'Sin base real suficiente':`${p.coverageDays} días`} {p.depletionDate&&<div className="small muted">Agotamiento orientativo: {formatDate(p.depletionDate)}</div>}</td>
     <td data-label="Reposición">{p.suggestedUnits30===null?(p.minimumGap?`Faltan ${p.minimumGap} unidades para el umbral`:'Revisar demanda y plazo de proveedor'):`${p.suggestedUnits30} unidades para 30 días + umbral`}<div className="small muted">Descontar pedidos en curso antes de comprar.</div></td>
    </tr>)}</tbody></table></div>
    {!data.parts.length&&<EmptyState icon={<Activity size={22}/>} title="Sin catálogo de repuestos" description="No se puede estimar reposición sin existencias registradas."/>}
   </>}
   {tab==='outcomes'&&<DashboardDonut title="Equipos por último resultado técnico" description={data.method.outcomeDefinition+' NFF y PoD se muestran separados de reparado y no reparable.'} unit="equipos" items={data.outcomes.map(o=>({key:o.label,label:outcomeLabels[o.label]||o.label,value:o.total,color:o.label==='REPARADO'?'var(--green)':o.label==='NO_REPARABLE'?'var(--red)':o.label==='NFF'?'var(--chart-primary)':o.label==='SIN_CIERRE'?'var(--muted)':'var(--yellow)'}))}/>}
   {tab==='actions'&&<div className="maintenance-actions">{data.alerts.length?data.alerts.map((a,i)=><FeedbackBanner key={i} tone={a.tone}><strong>{a.subject}</strong><p>{a.evidence}</p><p>{a.action}</p></FeedbackBanner>):<EmptyState icon={<Activity size={22}/>} title="Sin alertas fundamentadas" description="Esto no garantiza ausencia de fallas. Se necesita historial para detectar patrones."/>}</div>}
  </div>
 </section>;
}
