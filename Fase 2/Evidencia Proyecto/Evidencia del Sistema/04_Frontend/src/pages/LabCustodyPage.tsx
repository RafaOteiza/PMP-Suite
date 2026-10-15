import {localReport} from '../utils/pageReports';
import {useEffect,useState} from 'react';
import {Link,useOutletContext,useParams,useLocation} from 'react-router-dom';
import {PackageCheck} from 'lucide-react';
import {api} from '../api/http';
import {getApiErrorMessage} from '../api/errors';
import type {Me} from '../api/me';
import type {BodegaTicket} from '../api/bodega';
import PageHeader from '../components/ui/PageHeader';
import FeedbackBanner from '../components/ui/FeedbackBanner';
import WarehouseReceptionForm from '../components/WarehouseReceptionForm';
import {formatDate,formatTime} from '../utils/formatters';
type CustodyTicket=BodegaTicket&{fecha_salida_laboratorio?:string;en_camino_laboratorio?:boolean;disponible_laboratorio?:boolean};

export default function LabCustodyPage(){
 const {osId,step}=useParams(),me=useOutletContext<Me|null>();
 const purpose=step==='recepcion'?'RECEPCION':'SALIDA';
 const location=useLocation();
 const storedBack=location.state?.returnTo;
 const defaultBack=purpose==='RECEPCION'?'/lab/recepcion':'/lab/despacho-qa';
 const back=typeof storedBack==='string'&&/^\/(lab\/(?:despacho-qa|recepcion)|admin\/despacho)(\?|$)/.test(storedBack)?storedBack:defaultBack;
 const [ticket,setTicket]=useState<CustodyTicket|null>(null),[error,setError]=useState(''),[done,setDone]=useState(false),[loading,setLoading]=useState(true);
 useEffect(()=>{let active=true;setLoading(true);setError('');setTicket(null);setDone(false);
  if(!['recepcion','salida'].includes(step||'')){setError('Operación no válida');setLoading(false);return;}
  api.get<BodegaTicket>(`/api/lab/custody/${encodeURIComponent(osId||'')}`).then(r=>{if(active)setTicket(r.data);})
   .catch(e=>{if(active)setError(getApiErrorMessage(e,'No se pudo consultar el equipo.'));}).finally(()=>{if(active)setLoading(false);});
  return()=>{active=false;};
 },[osId,step]);
 return <div className="page">
  <PageHeader report={localReport('Custodia laboratorio',ticket?[ticket]:[],loading||!!error)} eyebrow="Custodia de Laboratorio" title={purpose==='RECEPCION'?'Recepción en Laboratorio':'Salida hacia Bodega'} description={`${osId} · Validar identidad y confirmar el movimiento son acciones separadas.`} icon={<PackageCheck size={21}/>} actions={<Link className="btn ghost" to={back}>Volver a la bandeja</Link>}/>
  {loading&&<p role="status">Cargando equipo…</p>}{error&&<FeedbackBanner tone="danger">{error}</FeedbackBanner>}
  {purpose==='RECEPCION'&&ticket&&!done&&<section className="panel"><h2 className="section-title">Antecedentes del envío</h2><dl className="asset-detail-grid"><div><dt>Falla reportada</dt><dd>{ticket.falla||'Sin registro'}</dd></div><div><dt>Salida desde Bodega</dt><dd>{ticket.fecha_salida_laboratorio?`${formatDate(ticket.fecha_salida_laboratorio)} ${formatTime(ticket.fecha_salida_laboratorio)}`:'Sin salida registrada'}</dd></div></dl><p className="small muted">La lectura preliminar registra la validación. La custodia cambia únicamente al pulsar Confirmar recepción en Laboratorio.</p></section>}
  {done?<><FeedbackBanner tone="success">{purpose==='RECEPCION'?'Recepción física confirmada. El equipo está disponible para asignación.':'Salida confirmada. Equipo en tránsito hacia Bodega, pendiente de recepción.'}</FeedbackBanner><Link className="btn" to={back}>Continuar con el siguiente equipo</Link></>:
   ticket&&<WarehouseReceptionForm key={`${purpose}:${osId}`} ticket={ticket} role={me?.rol} labPurpose={purpose} onReceived={()=>{setDone(true);window.dispatchEvent(new Event('pmp:warehouse-queue-updated'));}}/>}
 </div>;
}
