import {useEffect,useState} from 'react';
import {Link,useLocation,useOutletContext,useParams} from 'react-router-dom';
import {Wrench} from 'lucide-react';
import type {Me} from '../api/me';
import {getLabQueue,type LabTicket} from '../api/lab';
import {can,PERMISSIONS} from '../app/rbac';
import PageHeader from '../components/ui/PageHeader';
import FeedbackBanner from '../components/ui/FeedbackBanner';
import StatusBadge from '../components/ui/StatusBadge';
import RepairWorkForm from '../components/RepairWorkForm';
import {labArrival,labArrivalLabel,labSLA} from '../utils/labWorkload';
import {formatDate,formatTime,formatOperationalStatus} from '../utils/formatters';
export default function LabWorkPage(){
 const {osId}=useParams();const me=useOutletContext<Me|null>();const location=useLocation();
 const [ticket,setTicket]=useState<LabTicket|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState(''),[done,setDone]=useState(false);
 const origins=['/mi-jornada','/lab/validadores','/lab/consolas','/operacion/escaneo'];
 const back=origins.includes(location.state?.from)?location.state.from:'/mi-jornada';
 useEffect(()=>{let active=true;setTicket(null);setDone(false);setLoading(true);setError('');
  if(!can(me,PERMISSIONS.LAB_WRITE)){setError('No tienes permiso para trabajar esta OS.');setLoading(false);return;}
  Promise.all([getLabQueue('VALIDADOR'),getLabQueue('CONSOLA')]).then(groups=>{
   if(!active)return;
   const row=groups.flat().find(o=>o.codigo_os===osId&&o.tecnico_laboratorio_id===me?.id);
   if(!row||!row.recepcion_laboratorio_confirmada||row.en_transito_laboratorio||![4,5,9].includes(row.estado_id))setError('La OS no pertenece a tu carga o no tiene recepción física confirmada en Laboratorio.');
   else setTicket(row);
  }).catch(()=>{if(active)setError('No se pudo consultar tu carga. Vuelve a la bandeja e intenta nuevamente.');}).finally(()=>{if(active)setLoading(false);});
  return()=>{active=false;};
 },[osId,me?.id,me?.rol]);
 const datum=(label:string,value?:string)=><div key={label}><dt>{label}</dt><dd>{value||'Sin registro'}</dd></div>;
 return <div className="page">
  <PageHeader title={`Trabajo técnico · ${osId||''}`} icon={<Wrench size={21}/>} actions={<Link className="btn ghost" to={back}>Volver a la bandeja</Link>}/>
  {loading&&<p role="status">Cargando trabajo…</p>}{error&&<FeedbackBanner tone="danger">{error}</FeedbackBanner>}
  {done?<FeedbackBanner tone="success">Trabajo técnico finalizado. Disponible en Listos para QA; pendiente de logística. <Link to={back}>Volver a la bandeja</Link></FeedbackBanner>:ticket&&<>
   <section className="panel operation-section lab-case-summary"><h2>Resumen del caso</h2><StatusBadge tone="flow">{formatOperationalStatus(ticket.estado_nombre)}</StatusBadge><dl className="asset-detail-grid lab-case-context">
    {datum('Tipo',ticket.tipo_equipo)}{datum('Serie',ticket.serie)}{datum('Modelo',ticket.modelo)}{datum('Marca',ticket.marca)}{datum('PPU',ticket.bus_ppu)}{datum('Terminal',ticket.terminal)}{datum('Operador',ticket.operador)}{datum('Referencia AR',ticket.referencia_ar)}{datum('Falla reportada',ticket.falla)}{datum('Técnico',ticket.tecnico_laboratorio)}{datum('Ubicación',ticket.ubicacion)}
    {datum('Ingreso a Laboratorio',`${formatDate(labArrival(ticket))} ${formatTime(labArrival(ticket))}`)}{datum('SLA',labSLA(ticket).texto)}
   </dl><p className="small muted">{labArrivalLabel(ticket)}</p></section>
   <RepairWorkForm key={ticket.codigo_os} os={ticket.codigo_os} initialState={ticket.estado_id} tipoEquipo={ticket.tipo_equipo} serie={ticket.serie} tecnico={ticket.tecnico_laboratorio} modelo={ticket.modelo} referenciaAr={ticket.referencia_ar} onWaiting={()=>setTicket(t=>t?{...t,estado_id:9,estado_nombre:'ESPERA_REPUESTO'}:t)} fallaReportada={ticket.falla} onStarted={()=>setTicket(t=>t?{...t,estado_id:5,estado_nombre:'EN_REPARACION'}:t)} onSuccess={()=>setDone(true)}/>
  </>}
 </div>;
}
