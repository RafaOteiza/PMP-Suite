import {pagedReport} from '../utils/pageReports';
import {useEffect,useRef,useState} from 'react';
import {Link,useLocation,useSearchParams} from 'react-router-dom';
import {Microscope,RefreshCw,Search,ClipboardList} from 'lucide-react';
import {getQaDashboard,qaStages,qaPaths,type QaStage,type QaDashboard} from '../api/qa';
import {getApiErrorMessage} from '../api/errors';
import PageHeader from '../components/ui/PageHeader';
import StatusBadge from '../components/ui/StatusBadge';
import FeedbackBanner from '../components/ui/FeedbackBanner';
import EmptyState from '../components/ui/EmptyState';
import {formatDateTime} from '../utils/formatters';
const stages:QaStage[]=['RECEPCION','AMBIENTE','PRUEBAS','DESPACHO'];
export default function QaPage(){
 const [params,setParams]=useSearchParams(),location=useLocation();
 const tab=(Object.keys(qaStages).includes(params.get('etapa')||'')?params.get('etapa'):'RECEPCION') as QaStage;
 const q=params.get('q')||'',page=Math.max(1,Number(params.get('page'))||1);
 const [data,setData]=useState<QaDashboard>({items:[],counts:{},total:0,page:1,page_size:20}),[loading,setLoading]=useState(true),[error,setError]=useState('');
 const sequence=useRef(0);
 const load=async()=>{const id=++sequence.current;setLoading(true);setError('');try{const result=await getQaDashboard({etapa:tab,q,page});if(id===sequence.current)setData(result);}catch(e){if(id===sequence.current)setError(getApiErrorMessage(e,'No se pudo consultar QA.'));}finally{if(id===sequence.current)setLoading(false);}};
 useEffect(()=>{void load();return()=>{sequence.current++;};},[tab,q,page]);
 const restored=useRef(false);
 useEffect(()=>{if(!loading&&!restored.current){restored.current=true;const saved=sessionStorage.getItem('pmp:qa-scroll:'+location.pathname+location.search);if(saved)window.requestAnimationFrame(()=>window.scrollTo(0,Number(saved)));}},[loading,location.pathname,location.search]);
 const select=(etapa:QaStage)=>setParams({etapa,q,page:'1'});
 return <div className="page lab-assignment warehouse-flow"><PageHeader report={pagedReport('Supervision QA','/api/qa/dashboard',{etapa:tab,q},loading||!!error,'qa')} eyebrow="Calidad" title="Mi trabajo QA" description="Recepción, Instalación Ambiente, Pruebas y Despacho." icon={<Microscope size={21}/>} actions={<button className="btn ghost" disabled={loading} onClick={()=>void load()}><RefreshCw size={17}/> Actualizar</button>}/>
 {error&&<FeedbackBanner tone="danger">{error}</FeedbackBanner>}
 <div className="operation-tabs" role="tablist" aria-label="Etapas QA">{stages.map(stage=><button key={stage} role="tab" aria-selected={tab===stage} data-active={tab===stage} onClick={()=>select(stage)}>{qaStages[stage]}<span className="tab-count">{loading||error?"—":data.counts[stage]??0}</span></button>)}</div>
 <div className="toolbar"><div className="search page-search"><Search size={17}/><input type="search" aria-label="Buscar en QA" placeholder="OS, serie, referencia AR o PPU…" value={q} onChange={e=>setParams({etapa:tab,q:e.target.value,page:'1'})}/></div><button className="btn ghost" onClick={()=>select('POR_VERIFICAR')}>Por verificar ({loading||error?"—":data.counts.POR_VERIFICAR??0})</button><button className="btn ghost" onClick={()=>select('HISTORIAL')}>Historial</button></div>
 {tab==='POR_VERIFICAR'&&<FeedbackBanner tone="warning">Registros sin evidencia física suficiente. No se deduce tránsito ni recepción y no se regularizan automáticamente.</FeedbackBanner>}
 <section className="panel data-panel"><h2 className="section-title">{qaStages[tab]}</h2>{loading?<p role="status">Cargando QA…</p>:error?null:!data.items.length?<EmptyState icon={<ClipboardList size={24}/>} title="Sin equipos en esta consulta"/>:<div className="table-wrap withdrawal-table-wrap"><table className="withdrawal-table"><thead><tr><th>OS</th><th>Equipo</th><th>Etapa</th><th>Fecha</th><th>Responsable</th><th>Dictamen</th><th>Acción</th></tr></thead><tbody>{data.items.map(t=><tr key={`${t.codigo_os}-${t.ciclo_qa}`}>
 <td data-label="OS"><strong>{t.codigo_os}</strong><span className="withdrawal-secondary">{t.referencia_ar}</span></td><td data-label="Equipo"><strong>{t.serie}</strong><span className="withdrawal-secondary">{t.tipo_equipo} · {t.modelo}</span><span className="withdrawal-secondary">{t.bus_ppu}</span></td><td data-label="Etapa"><StatusBadge tone={t.etapa==='RECEPCION'||t.etapa==='POR_VERIFICAR'?'warning':'info'}>{qaStages[t.etapa]}</StatusBadge></td><td data-label="Fecha">{formatDateTime(t.fecha_etapa||t.fecha_recepcion_qa||t.fecha_envio_qa||t.fecha)}<span className="withdrawal-secondary">{t.fecha_etapa?qaStages[t.etapa]:t.fecha_recepcion_qa?'Recepción QA':t.fecha_envio_qa?'Envío desde Bodega':'Fecha OS · por verificar'}</span></td><td data-label="Responsable">{t.tecnico_qa||'Sin tomar'}</td><td data-label="Dictamen">{t.dictamen?<StatusBadge tone={t.dictamen==='OPERATIVO'?'success':'danger'}>{t.dictamen==='OPERATIVO'?'Operativo':'Rechazado'}</StatusBadge>:'Pendiente'}</td><td data-label="Acción"><Link className="btn sm" onClick={()=>sessionStorage.setItem('pmp:qa-scroll:'+location.pathname+location.search,String(window.scrollY))} state={{from:location.pathname+location.search}} to={`/qa/${encodeURIComponent(t.codigo_os)}/${qaPaths[t.etapa]}${t.etapa==='HISTORIAL'?'?ciclo='+encodeURIComponent(t.ciclo_qa||'legacy'):''}`}>{({RECEPCION:'Recepcionar',AMBIENTE:'Preparar ambiente',PRUEBAS:'Evaluar',DESPACHO:'Despachar',POR_VERIFICAR:'Consultar',HISTORIAL:'Consultar ciclo'})[t.etapa]}</Link></td>
 </tr>)}</tbody></table></div>}
 {!loading&&!error&&<div className="operation-actions"><span className="small muted">{data.total} {data.total===1?'resultado':'resultados'} · Página {page} de {Math.max(1,Math.ceil(data.total/data.page_size))}</span><button className="btn ghost" disabled={loading||page<=1} onClick={()=>setParams({etapa:tab,q,page:String(page-1)})}>Anterior</button><button className="btn secondary" disabled={loading||page*data.page_size>=data.total} onClick={()=>setParams({etapa:tab,q,page:String(page+1)})}>Siguiente</button></div>}</section></div>;
}
