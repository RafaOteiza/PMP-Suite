import {pagedReport} from '../utils/pageReports';
import {useEffect,useState} from 'react';
import {Link,useNavigate,useOutletContext,useSearchParams} from 'react-router-dom';
import {ArrowDownToLine,AlertTriangle,PackageCheck,RefreshCw,ScanBarcode,Truck,Users} from 'lucide-react';
import {getLabReception,type LabReception} from '../api/lab';
import {assetHistoryUrl} from '../api/bridge';
import {getApiErrorMessage} from '../api/errors';
import type {Me} from '../api/me';
import {can,PERMISSIONS} from '../app/rbac';
import PageHeader from '../components/ui/PageHeader';
import StatCard from '../components/ui/StatCard';
import StatusBadge from '../components/ui/StatusBadge';
import FeedbackBanner from '../components/ui/FeedbackBanner';
import EmptyState from '../components/ui/EmptyState';
import {formatDate,formatTime} from '../utils/formatters';

import '../styles/logistics-assets.css';
import '../styles/admin-control.css';

const tabs=[['camino','En camino'],['recibidos','Recibidos'],['incidencias','Incidencias'],['historial','Historial de ingresos']] as const;
export default function LabReceptionPage(){
 const navigate=useNavigate(),me=useOutletContext<Me|null>(),[params,setParams]=useSearchParams();
 const rawTab=params.get('tab'),tab=tabs.some(t=>t[0]===rawTab)?rawTab!:'camino';
 const [data,setData]=useState<LabReception|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState(''),[refresh,setRefresh]=useState(0);
 const q=params.get('q')||'',tipo=params.get('tipo')||'',offset=Number(params.get('offset'))||0,hoy=params.get('hoy')||'';
 const [search,setSearch]=useState(q);
 useEffect(()=>{setSearch(q);},[q]);
 useEffect(()=>{const controller=new AbortController();setLoading(true);setError('');
  getLabReception({tab,q,tipo,hoy,offset:String(offset)},controller.signal).then(result=>{if(!controller.signal.aborted)setData(result);})
   .catch(e=>{if(!controller.signal.aborted)setError(getApiErrorMessage(e,'No se pudo consultar la recepción. Intenta actualizar.'));})
   .finally(()=>{if(!controller.signal.aborted)setLoading(false);});return()=>controller.abort();
 },[tab,q,tipo,hoy,offset,refresh]);
 const change=(values:Record<string,string>)=>{const next=new URLSearchParams(params);next.delete('offset');if(values.tab)next.delete('hoy');for(const [k,v]of Object.entries(values)){v?next.set(k,v):next.delete(k);}setParams(next);};
 const date=(value:string|null)=>value?`${formatDate(value)} ${formatTime(value)}`:'Sin ingreso registrado';
 const canReceive=can(me,PERMISSIONS.LAB_DISPATCH),canAssign=can(me,PERMISSIONS.LAB_ASSIGN);
 return <div className="page logistics-assets lab-reception">
  <PageHeader report={pagedReport('Recepcion laboratorio','/api/lab/reception',{tab,q,tipo,hoy},loading||!!error)} eyebrow="Gestión de Laboratorio" title="Recepción de equipos" description="El envío no es una recepción. Confirma la llegada física antes de asignar carga." icon={<PackageCheck size={21}/>} actions={<><Link className="btn ghost" to="/operacion/escaneo"><ScanBarcode size={16}/> Estación de escaneo</Link><button className="btn ghost" disabled={loading} onClick={()=>setRefresh(n=>n+1)}><RefreshCw size={16}/> Actualizar</button></>}/>

  {loading?<p role="status">Consultando recepciones…</p>:error?<FeedbackBanner tone="danger">{error}</FeedbackBanner>:data&&<>
   <p className="small muted">Actualizado {date(data.updatedAt)} · Indicadores de OS; pueden coincidir entre sí.</p>
   <section className="asset-kpis" aria-label="Resumen de recepción">
    <StatCard label="En camino a Laboratorio" value={data.counts.camino} detail="Salida confirmada · aún no recibidos" icon={<Truck size={19}/>} health="info" onClick={()=>change({tab:'camino'})}/>
    <StatCard label="Recibidos hoy" value={data.counts.hoy} detail="Recepciones confirmadas · hora de Chile" icon={<ArrowDownToLine size={19}/>} health={data.counts.hoy?'success':'neutral'} onClick={()=>change({tab:'historial',hoy:'1'})}/>
    <StatCard label="Pendientes de asignación" value={data.counts.pendientes} detail="Carga recibida sin técnico" icon={<Users size={19}/>} health={data.counts.pendientes?'warning':'neutral'} onClick={canAssign?()=>navigate('/lab/asignacion?tab=pending'):()=>change({tab:'recibidos'})}/>
    <StatCard label="Incidencias de recepción" value={data.counts.incidencias} detail="Última lectura no coincidente · ciclo pendiente" icon={<AlertTriangle size={19}/>} health={data.counts.incidencias?'danger':'success'} onClick={()=>change({tab:'incidencias'})}/>
   </section>
  </>}
  <section className="panel">
   <div className="operation-tabs" aria-label="Bandejas de recepción">{tabs.map(([key,label])=><button key={key} data-active={tab===key} aria-pressed={tab===key} onClick={()=>change({tab:key})}>{label}{data&&!error&&!loading&&<span className="tab-count">{data.counts[key]}</span>}</button>)}</div>
   {hoy==='1'&&<FeedbackBanner tone="info">Recepciones de hoy · hora de Chile. <button className="btn ghost sm" onClick={()=>change({hoy:''})}>Ver todo el historial</button></FeedbackBanner>}
   <form className="asset-filters" onSubmit={e=>{e.preventDefault();change({q:search.trim()});}}><label className="asset-search">Buscar OS, serie o referencia<div><input className="input" value={search} maxLength={120} onChange={e=>setSearch(e.target.value)}/><button className="btn secondary">Buscar</button></div></label><label>Tipo de equipo<select value={tipo} onChange={e=>change({tipo:e.target.value})}><option value="">Todos</option><option value="VALIDADOR">Validadores</option><option value="CONSOLA">Consolas</option></select></label><button type="button" className="btn ghost" onClick={()=>setParams({tab})}>Limpiar filtros</button></form>
   {!loading&&!error&&data&&(data.items.length===0?<EmptyState icon={<PackageCheck size={24}/>} title={tab==='camino'?'Sin equipos en camino':'Sin registros en esta consulta'} description="Ajusta los filtros o actualiza la bandeja. Consultar no cambia la custodia."/>:<>
    <div className="table-wrap withdrawal-table-wrap"><table className="withdrawal-table reception-table"><thead><tr><th>OS / Equipo</th><th>Contexto</th><th>{tab==='camino'?'Salida / Tránsito':'Fecha / Recepción'}</th><th>Estado</th><th>Acción</th></tr></thead><tbody>{data.items.map(item=><tr key={item.evento_id||item.codigo_os}>
     <td data-label="OS / Equipo"><strong>{item.codigo_os}</strong><span className="withdrawal-secondary"><strong>{item.serie}</strong> · {item.tipo_equipo==='VALIDADOR'?'Validador':'Consola'}</span><span className="withdrawal-secondary">{[item.modelo,item.marca].filter(Boolean).join(' · ')||'Modelo sin registro'}</span></td>
     <td data-label="Contexto"><span>{item.falla||'Falla sin registro'}</span><span className="withdrawal-secondary">{item.referencia_ar||item.codigo_caso||'Sin referencia externa'}</span><span className="withdrawal-secondary">{[item.bus_ppu,item.terminal,item.operador].filter(Boolean).join(' · ')}</span></td>
     <td data-label="Fecha / Recepción">{date(item.fecha_evento)}{tab==='camino'&&item.fecha_salida&&<span className="withdrawal-secondary">Bodega → Laboratorio · {Math.max(0,Math.floor((Date.parse(data.updatedAt)-Date.parse(item.fecha_salida))/3600000))} h en tránsito</span>}{tab==='recibidos'&&!item.fecha_recepcion&&<span className="withdrawal-secondary">Registro histórico sin evidencia de ingreso</span>}</td>
     <td data-label="Estado"><StatusBadge health={tab==='incidencias'?'danger':tab==='historial'?'success':item.en_camino?'info':'success'}>{tab==='incidencias'?'Identidad no coincidente':tab==='historial'?'Recepción confirmada':item.en_camino?'En tránsito hacia Laboratorio':'Recibido en Laboratorio'}</StatusBadge>{item.recibido&&<span className="withdrawal-secondary">{item.tecnico_laboratorio||'Sin técnico asignado'}</span>}</td>
     <td data-label="Acción">{item.en_camino&&tab!=='historial'&&canReceive?<Link className="btn sm" to={`/lab/custodia/${encodeURIComponent(item.codigo_os)}/recepcion`} state={{returnTo:'/lab/recepcion?'+params.toString()}}>Preparar recepción</Link>:<Link className="btn ghost sm" to={assetHistoryUrl(item)}>Ver historial</Link>}</td>
    </tr>)}</tbody></table></div>
    <div className="asset-pagination"><span>{offset+1}–{Math.min(offset+data.limit,data.total)} de {data.total}</span><div><button className="btn ghost sm" disabled={offset===0} onClick={()=>change({offset:String(Math.max(0,offset-data.limit))})}>Anterior</button><button className="btn ghost sm" disabled={offset+data.limit>=data.total} onClick={()=>change({offset:String(offset+data.limit)})}>Siguiente</button></div></div>
   </>)}
  </section>
 </div>;
}
