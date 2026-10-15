import {sheetsReport,reportSheet,summarySheet} from '../utils/pageReports';
import {useEffect,useState} from 'react';
import {Link,useSearchParams} from 'react-router-dom';
import {ClipboardList} from 'lucide-react';
import {api} from '../api/http';
import {searchAssets,assetHistoryUrl,type Asset} from '../api/bridge';
import PageHeader from './ui/PageHeader';
import EmptyState from './ui/EmptyState';
import FeedbackBanner from './ui/FeedbackBanner';
import StatusBadge from './ui/StatusBadge';
import {formatDate} from '../utils/formatters';
type History=Asset&{estado_actual:string;intervenciones:{codigo_os:string;fecha:string|null;falla_reportada:string|null;diagnostico:string|null;trabajo_realizado:string|null;resultado:string|null;pendiente:boolean;observaciones:string[]}[]};
export default function LabTechnicalHistory(){
 const [params,setParams]=useSearchParams(),[query,setQuery]=useState(params.get('search')||'');
 const [history,setHistory]=useState<History|null>(null),[results,setResults]=useState<Asset[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const series=params.get('serie'),type=params.get('tipo'),term=params.get('search');
 useEffect(()=>{const controller=new AbortController();setHistory(null);setResults([]);setError('');setQuery(term||'');
  if(!series&&!term){setBusy(false);return()=>controller.abort();}setBusy(true);
  (async()=>{try{if(series&&(type==='VALIDADOR'||type==='CONSOLA')){const r=await api.get<History>(`/api/bridge/activos/${type}/${encodeURIComponent(series)}/historial`,{signal:controller.signal});if(!controller.signal.aborted)setHistory(r.data);}else{const rows=await searchAssets(term||'',controller.signal);if(!controller.signal.aborted)setResults(rows);}}catch{if(!controller.signal.aborted)setError('No se pudo consultar el historial técnico.');}finally{if(!controller.signal.aborted)setBusy(false);}})();return()=>controller.abort();
 },[series,type,term]);
 return <div className="page trace-page"><PageHeader report={sheetsReport('Antecedentes tecnicos',[reportSheet('Activos',results),summarySheet('Equipo',history),reportSheet('Intervenciones',history?.intervenciones||[])],busy||!!error,Object.fromEntries(params))} title="Antecedentes técnicos" description="Consulta por serie, OS PMP o referencia externa. Información técnica de solo lectura." icon={<ClipboardList size={21}/>}/>
  <form className="panel filter-bar" onSubmit={e=>{e.preventDefault();setParams({search:query.trim()});}}><input className="input" aria-label="Serie, OS o referencia" placeholder="Serie, OS PMP o referencia externa" value={query} onChange={e=>setQuery(e.target.value)}/><button className="btn" disabled={busy||!query.trim()}>Buscar</button></form>
  {error&&<FeedbackBanner tone="danger">{error}</FeedbackBanner>}{busy&&<p role="status">Consultando antecedentes…</p>}
  {results.map(a=><section className="panel" key={`${a.tipo_equipo}:${a.serie}`}><Link to={assetHistoryUrl(a)}>{a.tipo_equipo} · {a.serie}</Link></section>)}
  {history&&<><section className="panel"><h2 className="section-title">{history.tipo_equipo} · {history.serie}</h2><p>{[history.modelo,history.marca].filter(Boolean).join(' · ')}</p><StatusBadge health="info">{history.estado_actual}</StatusBadge></section>
   {history.intervenciones.length?history.intervenciones.map(i=><section className="panel" key={i.codigo_os}><div className="section-heading"><h2 className="section-title">{i.codigo_os}</h2><span>{i.fecha?formatDate(i.fecha):'Sin fecha registrada'}</span></div><StatusBadge health={i.pendiente?'warning':/Rechazado|No reparable|Falla persistente/.test(i.resultado||'')?'danger':/Reparado|NFF confirmado|Operativo/.test(i.resultado||'')?'success':'neutral'}>{i.resultado||(i.pendiente?'Pendiente':'Sin resultado registrado')}</StatusBadge><dl className="asset-detail-grid">{[['Falla reportada',i.falla_reportada],['Diagnóstico',i.diagnostico],['Trabajo realizado',i.trabajo_realizado]].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value||'Sin registro'}</dd></div>)}</dl>{i.observaciones.map((o,n)=><p key={n}>{o}</p>)}</section>):<EmptyState icon={<ClipboardList size={24}/>} title="Sin fallas ni reparaciones registradas"/>}</>}
  {!busy&&!error&&!term&&!series&&<EmptyState icon={<ClipboardList size={24}/>} title="Consulta el historial técnico" description="Ingresa una serie, OS o referencia para revisar las intervenciones del equipo."/>}
  {!busy&&!error&&term&&!history&&!results.length&&<EmptyState icon={<ClipboardList size={24}/>} title="Sin coincidencias" description="Revisa la serie, OS o referencia."/>}
 </div>;
}
