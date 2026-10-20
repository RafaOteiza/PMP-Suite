import {pagedReport,reportSheet} from '../utils/pageReports';
import LabTechnicalHistory from '../components/LabTechnicalHistory';
import { useEffect, useState } from 'react';
import { Link, useSearchParams, useOutletContext } from 'react-router-dom';
import { ClipboardList } from 'lucide-react';
import { assetHistoryUrl, getAssetHistory, searchAssets, type Asset, type AssetHistory } from '../api/bridge';
import { getApiErrorMessage } from '../api/errors';
import PageHeader from '../components/ui/PageHeader';
import AssetTimeline from '../components/AssetTimeline';
import EmptyState from '../components/ui/EmptyState';
import { historyState, historyLocation, latestOrder, eventMetadata } from '../utils/traceabilityPresentation';
import StatusBadge from '../components/ui/StatusBadge';
import FeedbackBanner from '../components/ui/FeedbackBanner';
import { formatDate, formatTime } from '../utils/formatters';
import { caseHistoryUrl, derivePod, getCases, getCaseHistory, type CaseHistory, type OperationalCase } from '../api/requerimientos';
import { can, PERMISSIONS } from '../app/rbac';
import type { Me } from '../api/me';

function References({references}:{references:AssetHistory['referencias']}){
  return <section className="panel trace-references"><h2>Referencias externas <span className="muted">({references.length})</span></h2>
    {references.length?<ul>{references.map(r=><li key={r.id}><StatusBadge>{r.sistema_externo}</StatusBadge><strong>{r.referencia_externa} ↔ {r.codigo_os}</strong><time dateTime={r.fecha}>{formatDate(r.fecha)} {formatTime(r.fecha)}</time>{r.comentario&&<span>{r.comentario}</span>}</li>)}</ul>:<p className="muted">Sin referencias externas.</p>}
  </section>;
}
function ExistingTrazabilidadPage() {
  const [params,setParams]=useSearchParams();
  const me = useOutletContext<Me | null>();
  const caseId = params.get('caso') || '';
  const [caseHistory, setCaseHistory] = useState<CaseHistory | null>(null), [caseResults, setCaseResults] = useState<OperationalCase[]>([]);
  const [caseBusy, setCaseBusy] = useState(false), [caseError, setCaseError] = useState('');
  const term=params.get('search')||'', serie=params.get('serie')||'', tipo=params.get('tipo')||'';
  const [query,setQuery]=useState(term),[results,setResults]=useState<Asset[]>([]),[history,setHistory]=useState<AssetHistory|null>(null);
  const [loading,setLoading]=useState(false),[error,setError]=useState('');
  useEffect(()=>{
    const controller=new AbortController();setQuery(term);setHistory(null);setResults([]);setCaseResults([]);setError('');
    if(!term&&!serie) { setLoading(false);return ()=>controller.abort(); }
    setLoading(true);
    const run=async()=>{
      try {
        if(serie&&(tipo==='VALIDADOR'||tipo==='CONSOLA')) setHistory(await getAssetHistory({serie,tipo_equipo:tipo},controller.signal));
        else {
          const [matches, cases] = await Promise.all([searchAssets(term,controller.signal), getCases(term,controller.signal)]);
          if(controller.signal.aborted)return;
          setResults(matches);
          setCaseResults(cases);
          const exactAssets=matches.filter(asset=>asset.serie.toUpperCase()===term.toUpperCase());
          if(exactAssets.length===1) setParams({tipo:exactAssets[0].tipo_equipo,serie:exactAssets[0].serie},{replace:true});
          else if(matches.length===1 && !cases.length) setParams({tipo:matches[0].tipo_equipo,serie:matches[0].serie},{replace:true});
        }
      } catch(e){if(!controller.signal.aborted)setError(getApiErrorMessage(e,'No se pudo consultar el historial.'));}
      finally{if(!controller.signal.aborted)setLoading(false);}
    };void run();return ()=>controller.abort();
  },[term,serie,tipo,setParams]);
  useEffect(() => {
    const controller = new AbortController(); setCaseHistory(null); setCaseError('');
    if (!caseId) { setCaseBusy(false); return () => controller.abort(); }
    setCaseBusy(true);
    getCaseHistory(caseId, controller.signal).then(data => { if (!controller.signal.aborted) setCaseHistory(data); }).catch(e => { if (!controller.signal.aborted) setCaseError(getApiErrorMessage(e, 'No se pudo consultar el caso.')); }).finally(() => { if (!controller.signal.aborted) setCaseBusy(false); });
    return () => controller.abort();
  }, [caseId]);
  const createPod = async (codigo: string) => {
    if (!caseId || caseBusy) return; setCaseBusy(true); setCaseError('');
    try { await derivePod(caseId, codigo); setCaseHistory(await getCaseHistory(caseId)); }
    catch (e) { setCaseError(getApiErrorMessage(e, 'No se pudo registrar la intervención PoD.')); }
    finally { setCaseBusy(false); }
  };
  const activeOrders=history?.ordenes||caseHistory?.ordenes.filter(o=>o.serie===caseHistory.caso.serie_origen)||[];
  const current=latestOrder(activeOrders);
  const events=history?.eventos||caseHistory?.eventos||[];
  const assetSeries=history?.serie||caseHistory?.caso.serie_origen;
  const known=[...events].reverse().map(eventMetadata).filter(m=>m.serie===assetSeries);
  const model=history?.modelo||known.find(m=>m.modelo)?.modelo,brand=history?.marca||known.find(m=>m.marca)?.marca;
  const movementEvent=[...events].reverse().find(e=>e.tipo==='RETIRO_TERRENO_CONFIRMADO'&&e.codigo_os===current?.codigo_os);
  const movement=movementEvent?eventMetadata(movementEvent).bus_ppu:undefined;
  const relatedCase=caseHistory?.caso.codigo_caso||(current&&'codigo_caso' in current?current.codigo_caso:undefined)||known.find(m=>m.codigo_caso)?.codigo_caso;
  return <div className="page trace-page">
    <PageHeader report={{title:'Trazabilidad',disabled:loading||caseBusy||!!error||!!caseError,filters:Object.fromEntries(params),load:async()=>[reportSheet('Ordenes',caseHistory?.ordenes||activeOrders),reportSheet('Eventos',events),reportSheet('Referencias',history?.referencias||caseHistory?.referencias||[]),reportSheet('Activos encontrados',results),...(term&&!history&&!caseHistory?await pagedReport('Casos encontrados','/api/requerimientos',{q:term},false,'array').load():[])]}} title={caseHistory ? `Caso · ${caseHistory.caso.codigo_caso}` : history?`Historial · ${history.serie}`:'Historial de activos y casos'} description="Consulta por serie, OS PMP o referencia externa (OS Aranda). Cada activo conserva su historial individual." icon={<ClipboardList size={21}/>} />
    {(history||caseHistory)&&<section className="panel trace-asset-summary" aria-label="Resumen del activo">
      <div><h2>{history?.tipo_equipo||caseHistory?.caso.tipo_equipo} · {assetSeries}</h2>{(model||brand)&&<p>{[model,brand].filter(Boolean).join(' · ')}</p>}</div>
      {current&&<StatusBadge tone="flow">{historyState(current.estado_nombre||current.estado)}</StatusBadge>}
      <dl>{current&&<div><dt>Última ubicación</dt><dd>{historyLocation(current)}{historyLocation(current)==='En tránsito hacia Bodega'&&movement&&<span className="trace-secondary">{movement} → Bodega</span>}</dd></div>}
      {relatedCase&&<div><dt>Caso relacionado</dt><dd>{String(relatedCase)}</dd></div>}</dl>
    </section>}
    <form className="panel trace-search" onSubmit={e=>{e.preventDefault();setParams({search:query.trim()});}}>
      <input className="input" aria-label="Serie, OS PMP u OS Aranda" placeholder="Serie, OS PMP u OS Aranda" value={query} maxLength={120} onChange={e=>setQuery(e.target.value)}/>
      <button className="btn" disabled={!query.trim()||loading}>Buscar historial</button>
    </form>
    {error&&<FeedbackBanner tone="danger">{error}</FeedbackBanner>}
    {caseError&&<FeedbackBanner tone="danger">{caseError}</FeedbackBanner>}
    {caseBusy&&<p role="status">Cargando caso…</p>}
    {loading&&<p role="status">Cargando historial…</p>}
    {!loading&&!caseBusy&&!error&&!caseError&&!term&&!serie&&!caseId&&<EmptyState icon={<ClipboardList size={24}/>} title="Consulta el historial de un equipo" description="Busca por serie, OS PMP o referencia externa para revisar su trazabilidad."/>}
    {!loading&&!error&&term&&!results.length&&!caseResults.length&&!history&&<EmptyState icon={<ClipboardList size={24}/>} title="Sin coincidencias" description="No se encontraron activos ni casos. Revisa la serie, OS o referencia."/>}
    {caseResults.length>0&&<section className="panel"><h2>Casos relacionados</h2>{caseResults.map(c=><p key={c.id}><Link to={caseHistoryUrl(c.id)}>{c.codigo_caso} · {c.bus_ppu} · {c.falla_reportada}</Link></p>)}</section>}
    {results.length>0&&!history&&<section className="panel"><h2>Historial por activo</h2>{results.map(a=><p key={`${a.tipo_equipo}:${a.serie}`}><Link to={assetHistoryUrl(a)}>{a.tipo_equipo} · {a.serie}</Link></p>)}</section>}
    {caseHistory&&<>
      <section className="panel trace-case-context"><h2>{caseHistory.caso.codigo_caso} · {caseHistory.caso.origen}</h2><p>{caseHistory.caso.falla_reportada}</p><p>Bus: {caseHistory.caso.bus_ppu} · Terminal: {caseHistory.caso.terminal || 'Sin terminal'} · {formatDate(caseHistory.caso.fecha_requerimiento)}</p><p>Activo de origen: <Link to={assetHistoryUrl({ tipo_equipo: caseHistory.caso.tipo_equipo, serie: caseHistory.caso.serie_origen })}>{caseHistory.caso.tipo_equipo} · {caseHistory.caso.serie_origen}</Link></p>{can(me, PERMISSIONS.BODEGA_WRITE)&&<Link className="btn" to={`/bodega/despacho?caso=${encodeURIComponent(caseId)}`}>Preparar instalación por escaneo</Link>}</section>
      <section className="panel"><h2>Intervenciones del caso</h2><div className="table-wrap withdrawal-table-wrap"><table className="withdrawal-table"><thead><tr><th>OS PMP</th><th>Activo</th><th>Proceso / origen</th><th>Estado</th><th>Ubicación</th><th>Bus / técnico</th><th>Fecha</th><th>Acción</th></tr></thead><tbody>{caseHistory.ordenes.map(o=><tr key={o.codigo_os}><td data-label="OS PMP">{o.codigo_os}</td><td data-label="Activo"><Link to={assetHistoryUrl(o)}>{o.tipo_equipo} · {o.serie}</Link></td><td data-label="Proceso / origen">{o.es_instalacion ? 'Instalación' : 'Reparación / PoD'}{o.os_origen && <div>Origen: {o.os_origen}</div>}</td><td data-label="Estado"><StatusBadge tone="flow">{historyState(o.estado_nombre || o.estado)}</StatusBadge></td><td data-label="Ubicación">{historyLocation(o)}</td><td data-label="Bus / técnico">{o.bus_ppu} · {o.tecnico_nombre || 'Sin técnico'}<div>{o.terminal}</div></td><td data-label="Fecha">{formatDate(o.fecha)}</td><td data-label="Acción">{can(me, PERMISSIONS.REQUEST_CREATE) && !o.es_instalacion && !o.es_pod && [2,3,4,5,9].includes(o.estado_id ?? 0) && !caseHistory.ordenes.some(p => p.es_pod && p.serie === o.serie && p.tipo_equipo === o.tipo_equipo) && <button className="btn ghost sm" disabled={caseBusy} onClick={() => createPod(o.codigo_os)}>Derivar a PoD</button>}</td></tr>)}</tbody></table></div></section>
      <References references={caseHistory.referencias}/>
      <AssetTimeline events={caseHistory.eventos} title="Historial del caso"/>
    </>}
    {history&&<>
      <section className="panel trace-orders"><h2>Intervenciones / OS PMP <span className="muted">({history.ordenes.length})</span></h2>
        <div className="table-wrap withdrawal-table-wrap"><table className="withdrawal-table"><thead><tr><th>OS PMP</th><th>Fecha</th><th>Falla / Motivo</th><th>Estado</th><th>Ubicación</th><th>Referencias externas</th></tr></thead>
          <tbody>{history.ordenes.map(o=><tr key={o.codigo_os}><td data-label="OS PMP">{o.codigo_os}{o.caso_id&&<div><Link to={caseHistoryUrl(o.caso_id)}>Ver caso {o.codigo_caso}</Link></div>}</td><td data-label="Fecha ingreso">{formatDate(o.fecha)} {formatTime(o.fecha)}</td><td data-label="Falla">{o.falla}</td><td data-label="Estado"><StatusBadge tone="flow">{historyState(o.estado)}</StatusBadge></td><td data-label="Ubicación">{historyLocation(o)}</td><td data-label="Referencias externas">{history.referencias.filter(r=>r.codigo_os===o.codigo_os).map(r=><div key={r.id}>{r.sistema_externo} · {r.referencia_externa}</div>)}</td></tr>)}</tbody>
        </table></div>{!history.ordenes.length&&<EmptyState icon={<ClipboardList size={22}/>} title="Sin intervenciones" description="Este activo todavía no tiene OS PMP."/>}
      </section>
      <References references={history.referencias}/>
      <AssetTimeline events={history.eventos}/>
    </>}
  </div>;
}

export default function TrazabilidadPage(){const me=useOutletContext<Me|null>();return ['jefe_laboratorio','tecnico_terreno'].includes(me?.rol||'')?<LabTechnicalHistory/>:<ExistingTrazabilidadPage/>;}
