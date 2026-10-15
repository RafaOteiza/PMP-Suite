import {localReport} from '../utils/pageReports';
import {useEffect,useState} from 'react';
import {Link,useOutletContext,useSearchParams} from 'react-router-dom';
import {Package,RefreshCw,Search,Truck} from 'lucide-react';
import {getCompletedLab,type LabTicket} from '../api/lab';
import type {Me} from '../api/me';
import {can,PERMISSIONS} from '../app/rbac';
import {getApiErrorMessage} from '../api/errors';
import EmptyState from '../components/ui/EmptyState';
import FeedbackBanner from '../components/ui/FeedbackBanner';
import PageHeader from '../components/ui/PageHeader';
import StatusBadge from '../components/ui/StatusBadge';
export default function LabDespachoQaPage(){
 const me=useOutletContext<Me|null>(),canDispatch=can(me,PERMISSIONS.LAB_DISPATCH);
 const [tickets,setTickets]=useState<LabTicket[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState('');
 const [params,setParams]=useSearchParams(),search=params.get('q')||'';
 const load=async()=>{setLoading(true);setError('');try{setTickets(await getCompletedLab());}catch(e){setError(getApiErrorMessage(e,'No se pudo consultar la cola de salida.'));}finally{setLoading(false);}};
 useEffect(()=>{void load();},[]);
 const filtered=tickets.filter(t=>`${t.codigo_os} ${t.serie}`.toLowerCase().includes(search.toLowerCase()));
 return <div className="page">
  <PageHeader report={localReport('Despacho laboratorio',filtered,loading||!!error,{q:search})} eyebrow="Laboratorio" title="Despacho a Bodega" description="Trabajo finalizado y equipo físicamente en Laboratorio. Cada salida requiere evidencia propia; Bodega confirma la llegada posteriormente." icon={<Truck size={21}/>} actions={<button className="btn ghost" onClick={()=>void load()} disabled={loading}><RefreshCw size={17}/> Actualizar</button>}/>
  {error&&<FeedbackBanner tone="danger">{error}</FeedbackBanner>}
  <section className="panel data-panel"><div className="toolbar"><label className="search page-search"><Search size={17}/><input type="search" value={search} onChange={e=>setParams({q:e.target.value},{replace:true})} placeholder="Buscar OS o serie" aria-label="Buscar equipos finalizados"/></label><StatusBadge tone="neutral">{loading?'Consultando…':`${filtered.length} equipos`}</StatusBadge></div>
   {loading?<p role="status">Cargando despachos…</p>:error?null:!filtered.length?<EmptyState icon={<Package size={24}/>} title="Sin equipos para despacho" description="Aquí aparecen los equipos con trabajo finalizado y custodia confirmada en Laboratorio."/>:
    <div className="table-wrap"><table><thead><tr><th>OS</th><th>Equipo</th><th>Técnico</th><th>Falla</th><th>Acción</th></tr></thead><tbody>{filtered.map(t=><tr key={t.codigo_os}><td><strong>{t.codigo_os}</strong></td><td><strong>{t.serie}</strong><div className="small muted">{t.tipo_equipo} · {t.modelo} · {t.marca}</div></td><td>{t.tecnico_laboratorio||'Sin asignar'}</td><td>{t.falla}</td><td>{canDispatch?<Link className="btn sm" state={{returnTo:`/lab/despacho-qa?${params.toString()}`}} to={`/lab/custodia/${encodeURIComponent(t.codigo_os)}/salida`}>Preparar salida</Link>:<StatusBadge tone="neutral">Solo lectura</StatusBadge>}</td></tr>)}</tbody></table></div>}
  </section>
 </div>;
}
