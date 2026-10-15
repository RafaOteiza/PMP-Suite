import {useNavigate,useLocation} from 'react-router-dom';
import {useEffect,useState} from 'react';
import {ClipboardList,RefreshCw,Search,Wrench,CheckCircle,Clock} from 'lucide-react';
import type {Me} from '../api/me';
import {getLabQueue,getCompletedLab,type LabTicket} from '../api/lab';
import {labArrival,labArrivalLabel,labSLA} from '../utils/labWorkload';
import {formatDate,formatTime,formatOperationalStatus} from '../utils/formatters';
import {healthFromSla,slaHealthLabel} from '../utils/health';
import PageHeader from './ui/PageHeader';
import StatCard from './ui/StatCard';
import StatusBadge from './ui/StatusBadge';
import EmptyState from './ui/EmptyState';
import FeedbackBanner from './ui/FeedbackBanner';

type Tab='pending'|'repair'|'ready'|'all';
export default function LabTechnicianWorklist({me}:{me:Me}){
 const navigate=useNavigate(),location=useLocation();
 const [items,setItems]=useState<LabTicket[]>([]),[tab,setTab]=useState<Tab>('pending'),[search,setSearch]=useState('');
 const [loading,setLoading]=useState(true),[error,setError]=useState('');
 const load=async()=>{setLoading(true);setError('');try{
  const rows=(await Promise.all([getLabQueue('VALIDADOR'),getLabQueue('CONSOLA'),getCompletedLab()])).flat();
  setItems(rows.filter(o=>o.tecnico_laboratorio_id===me.id&&[4,5,9,10].includes(o.estado_id)));
 }catch{setError('No fue posible cargar tu trabajo de laboratorio.');}finally{setLoading(false);}};
 useEffect(()=>{void load();},[me.id]);
 const pending=items.filter(o=>o.estado_id===4),repair=items.filter(o=>[5,9].includes(o.estado_id)),ready=items.filter(o=>o.estado_id===10);
 const tabs=[{key:'pending' as const,label:'Pendientes',rows:pending},{key:'repair' as const,label:'En reparación',rows:repair},{key:'ready' as const,label:'Listos para QA',rows:ready},{key:'all' as const,label:'Todos',rows:items}];
 const rank=(o:LabTicket)=>{const sla=labSLA(o);return sla.vencido?0:sla.critico?1:2;};
 const query=search.trim().toLowerCase();
 const visible=[...tabs.find(t=>t.key===tab)!.rows].filter(o=>[o.codigo_os,o.serie,o.referencia_ar,o.bus_ppu].some(v=>v?.toLowerCase().includes(query)))
  .sort((a,b)=>rank(a)-rank(b)||(Date.parse(labArrival(a))||0)-(Date.parse(labArrival(b))||0)||a.codigo_os.localeCompare(b.codigo_os));
 return <div className="page lab-assignment lab-technician-worklist">
  <PageHeader title="Mi carga" eyebrow="Laboratorio" description={`Trabajo asignado a ${me.nombre||'tu usuario'}.`} icon={<ClipboardList size={21}/>} actions={<button className="btn ghost" disabled={loading} onClick={()=>void load()}><RefreshCw size={17}/> Actualizar</button>}/>
  {error&&<FeedbackBanner tone="danger">{error}</FeedbackBanner>}
  {loading?<p role="status">Consultando mi carga…</p>:error?null:<>
  <section className="lab-stat-grid">
   <StatCard label="Pendientes diagnóstico" value={pending.length} icon={<Clock size={19}/>} health="warning"/>
   <StatCard label="En reparación" value={repair.length} icon={<Wrench size={19}/>} health="info"/>
   <StatCard label="Listos para QA" value={ready.length} icon={<CheckCircle size={19}/>} health="success"/>
  </section>
  <div className="operation-tabs" role="tablist" aria-label="Mi trabajo de laboratorio">{tabs.map(t=><button role="tab" key={t.key} aria-selected={tab===t.key} data-active={tab===t.key} onClick={()=>setTab(t.key)}>{t.label}<span className="tab-count">{t.rows.length}</span></button>)}</div>
  <div className="toolbar"><div className="search page-search"><Search size={17}/><input type="search" aria-label="Buscar en mi carga" placeholder="OS, serie, referencia AR o PPU…" value={search} onChange={e=>setSearch(e.target.value)}/></div></div>
  <section className="panel data-panel">{!visible.length&&!loading?<EmptyState icon={<ClipboardList size={24}/>} title={query?'Sin coincidencias en tu carga':'No hay trabajos en esta etapa'}/>:<div className="table-wrap withdrawal-table-wrap"><table className="withdrawal-table">
   <thead><tr><th>OS</th><th>Equipo</th><th>Falla</th><th>Ingreso laboratorio</th><th>SLA</th><th>Estado</th><th>Acción</th></tr></thead>
   <tbody>{visible.map(o=>{const sla=labSLA(o),blocked=o.estado_id===4&&!o.recepcion_laboratorio_confirmada;return <tr key={o.codigo_os}>
    <td data-label="OS"><strong>{o.codigo_os}</strong>{o.referencia_ar&&<span className="withdrawal-secondary">{o.referencia_ar}</span>}</td>
    <td data-label="Equipo"><strong>{o.serie}</strong><span className="withdrawal-secondary">{o.tipo_equipo}{o.modelo?' · '+o.modelo:''}</span><span className="withdrawal-secondary">{o.bus_ppu}</span></td>
    <td data-label="Falla">{o.falla}</td>
    <td data-label="Ingreso laboratorio">{formatDate(labArrival(o))} {formatTime(labArrival(o))}<span className="withdrawal-secondary">{labArrivalLabel(o)}</span></td>
    <td data-label="SLA"><StatusBadge health={healthFromSla(sla)}>{slaHealthLabel(sla)}</StatusBadge><span className="withdrawal-secondary">{sla.texto}</span></td>
    <td data-label="Estado"><StatusBadge health="info">{formatOperationalStatus(o.estado_nombre)}</StatusBadge></td>
    <td data-label="Acción">{o.estado_id===10?<details><summary className="btn ghost sm">Ver resultado</summary><p className="small">Intervención terminada. Pendiente de despacho a Bodega para continuar a QA.</p></details>:<><button className="btn sm" disabled={blocked} onClick={()=>navigate(`/mi-carga/${encodeURIComponent(o.codigo_os)}`,{state:{from:location.pathname}})}>Abrir trabajo</button>{blocked&&<span className="withdrawal-secondary">Pendiente de recepción física en Laboratorio.</span>}</>}</td>
   </tr>;})}</tbody>
  </table></div>}</section></>}
 </div>;
}
