import {pagedReport} from '../utils/pageReports';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ClipboardList, Search, X } from 'lucide-react';
import { caseHistoryUrl, createRequest, getRequestCatalogs, searchRequirementAssets, searchRequirementBuses, getActiveRequirements, type RequirementAsset, type ActiveRequirement, type RequestPayload } from '../api/requerimientos';
import { getApiErrorMessage } from '../api/errors';
import PageHeader from '../components/ui/PageHeader';
import FeedbackBanner from '../components/ui/FeedbackBanner';
import StatusBadge from '../components/ui/StatusBadge';

const initialForm = (): RequestPayload => ({ origen:'INTERNO',tipo_equipo:'VALIDADOR',serie:'',bus_ppu:'',falla:'',fecha_requerimiento:new Date().toISOString().slice(0,10),clasificacion:'MANTENCION' });

function OperationalAssetExplorer({type,initialQuery,initialBus,exactBus,onSelect,onClose}:{type:RequestPayload['tipo_equipo'];initialQuery:string;initialBus:string;exactBus:boolean;onSelect:(asset:RequirementAsset)=>void;onClose:()=>void}) {
  const panel=useRef<HTMLElement>(null);
  useEffect(()=>{panel.current?.scrollIntoView({block:'start'});},[]);
  const [query,setQuery]=useState(initialQuery),[bus,setBus]=useState(initialBus),[exact,setExact]=useState(exactBus);
  const [offset,setOffset]=useState(0),[rows,setRows]=useState<RequirementAsset[]>([]),[more,setMore]=useState(false);
  const [loading,setLoading]=useState(true),[error,setError]=useState(''),[revision,setRevision]=useState(0);
  useEffect(()=>{
    const controller=new AbortController();setLoading(true);setError('');setRows([]);setMore(false);
    void searchRequirementAssets({tipo_equipo:type,...(query.trim()?{q:query.trim()}:bus.trim()?{bus_ppu:bus.trim(),...(exact?{bus_exacto:true}:{})}:{}),offset,limit:20},controller.signal)
      .then(result=>{if(!controller.signal.aborted){setRows(result.items.filter(a=>a.estado_actual==='EN_OPERACION'));setMore(result.has_more);}})
      .catch(e=>{if(!controller.signal.aborted)setError(getApiErrorMessage(e,'No se pudieron consultar los activos en operación.'));})
      .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return()=>controller.abort();
  },[type,query,bus,exact,offset,revision]);
  return <section ref={panel} className="panel operation-section request-asset-explorer" role="region" aria-labelledby="request-explorer-title">
    <header className="operation-header request-explorer-header"><div><span className="dashboard-eyebrow">Selección de activo</span><h2 id="request-explorer-title">Explorar activos en operación</h2><p>{type==='VALIDADOR'?'Validadores':'Consolas'} · 20 activos por página</p></div><button autoFocus type="button" className="icon-btn" aria-label="Cerrar explorador" title="Cerrar explorador" onClick={onClose}><X size={19} aria-hidden="true"/></button></header>
    <div className="request-explorer-body">

    <div className="request-explorer-filters">
      <label className="field">Buscar por serie<input id="explorer-series" className="input" value={query} maxLength={50} onChange={e=>{setQuery(e.target.value);setOffset(0);}}/></label>
      <label className="field">Bus / PPU<input id="explorer-bus" className="input" value={bus} maxLength={10} onChange={e=>{setBus(e.target.value.toUpperCase());setExact(false);setOffset(0);}}/></label>
    </div>
    <p className="field-hint">La serie tiene prioridad. Déjala vacía para buscar por PPU; sin ambos filtros puedes explorar todos los activos operativos del tipo seleccionado.</p>
    {error&&<FeedbackBanner tone="danger">{error}<button type="button" className="btn ghost" onClick={()=>setRevision(n=>n+1)}>Reintentar búsqueda</button></FeedbackBanner>}
    {loading&&<p role="status">Buscando activos…</p>}
    <div className="table-wrap request-explorer-table" tabIndex={0} role="region" aria-label="Tabla de activos operativos" aria-busy={loading}>
      <table><caption className="sr-only">Activos en operación del tipo seleccionado</caption><thead><tr><th scope="col">Serie / Modelo</th><th scope="col">Marca</th><th scope="col">PPU</th><th scope="col">Terminal</th><th scope="col">Operador</th><th scope="col">Acción</th></tr></thead>
        <tbody>{rows.map(a=><tr key={`${a.tipo_equipo}:${a.serie}`}><td><strong className="mono-value">{a.serie}</strong><span className="request-explorer-model">{a.modelo||'Modelo no informado'}</span><StatusBadge tone="success">EN OPERACIÓN</StatusBadge></td><td>{a.marca||'—'}</td><td>{a.bus_ppu}</td><td>{a.terminal||'—'}</td><td>{a.operador||'—'}</td><td><button type="button" className="btn secondary sm" aria-label={`Seleccionar ${a.serie}`} onClick={()=>onSelect(a)}>Seleccionar</button></td></tr>)}</tbody>
      </table>
      {!loading&&!error&&!rows.length&&<p role="status">No se encontraron activos en operación para estos filtros.</p>}
    </div>
    <footer className="request-explorer-pagination"><button type="button" className="btn ghost" disabled={!offset||loading} onClick={()=>setOffset(n=>Math.max(0,n-20))}>Anterior</button><span aria-live="polite">Página {offset/20+1}</span><button type="button" className="btn ghost" disabled={!more||loading} onClick={()=>setOffset(n=>n+20)}>Siguiente</button></footer>
    </div>
  </section>;
}
export default function IngresoRequerimientosPage() {
  const [form,setForm]=useState(initialForm);
  const [catalogs,setCatalogs]=useState<Awaited<ReturnType<typeof getRequestCatalogs>>>({terminales:[],psts:[]});
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  const [created,setCreated]=useState<Awaited<ReturnType<typeof createRequest>>|null>(null);
  const [query,setQuery]=useState(''),[options,setOptions]=useState<RequirementAsset[]>([]);
  const [selected,setSelected]=useState<RequirementAsset|null>(null),[loading,setLoading]=useState(false);
  const [searched,setSearched]=useState(false),[searchError,setSearchError]=useState(''),[active,setActive]=useState(0);
  const [buses,setBuses]=useState<Array<{bus_ppu:string}>>([]),[busActive,setBusActive]=useState(0),[chosenBus,setChosenBus]=useState('');
  const [busError,setBusError]=useState(''),[busLoading,setBusLoading]=useState(false),[moreBuses,setMoreBuses]=useState(false);
  const [explore,setExplore]=useState(false),[revision,setRevision]=useState(0),[offset,setOffset]=useState(0),[hasMore,setHasMore]=useState(false);
  const [interventions,setInterventions]=useState<ActiveRequirement[]>([]),[checking,setChecking]=useState(false),[activeError,setActiveError]=useState('');
  const [assetOpen,setAssetOpen]=useState(true),[busOpen,setBusOpen]=useState(true);
  const assetList=useRef<HTMLDivElement>(null),busList=useRef<HTMLDivElement>(null);
  const busInput=useRef<HTMLInputElement>(null),seriesInput=useRef<HTMLInputElement>(null);
  useEffect(()=>{if(assetOpen)assetList.current?.querySelector<HTMLElement>(`#request-option-${active}`)?.scrollIntoView?.({block:'nearest'});},[active,assetOpen]);
  useEffect(()=>{if(busOpen)busList.current?.querySelector<HTMLElement>(`#request-bus-option-${busActive}`)?.scrollIntoView?.({block:'nearest'});},[busActive,busOpen]);
  useEffect(()=>{void getRequestCatalogs().then(setCatalogs).catch(e=>setError(getApiErrorMessage(e,'No se pudieron cargar terminales y operadores.')));},[]);
  useEffect(()=>{
    setBuses([]);setBusError('');setBusActive(0);setMoreBuses(false);
    if(!form.bus_ppu.trim()||form.bus_ppu===chosenBus){setBusLoading(false);return;}
    const controller=new AbortController();setBusLoading(true);
    void searchRequirementBuses({tipo_equipo:form.tipo_equipo,bus_ppu:form.bus_ppu.trim()},controller.signal)
      .then(result=>{if(!controller.signal.aborted){setBuses(result.items);setMoreBuses(result.has_more);}})
      .catch(e=>{if(!controller.signal.aborted)setBusError(getApiErrorMessage(e,'No se pudieron buscar buses.'));})
      .finally(()=>{if(!controller.signal.aborted)setBusLoading(false);});
    return()=>controller.abort();
  },[form.tipo_equipo,form.bus_ppu,chosenBus]);
  const choose=(asset:RequirementAsset)=>{
    if(asset.estado_actual!=='EN_OPERACION'||asset.tipo_equipo!==form.tipo_equipo)return;
    setAssetOpen(false);setBusOpen(false);setExplore(false);
    setSelected({...asset});setChecking(true);setInterventions([]);setActiveError('');setError('');setCreated(null);
    setChosenBus(asset.bus_ppu);setBuses([]);setOptions([]);setBusError('');setSearchError('');
    setForm(current=>({...current,serie:asset.serie,bus_ppu:asset.bus_ppu,terminal_id:asset.terminal_id,pst_codigo:asset.pst_codigo}));
  };
  useEffect(()=>{
    setOptions([]);setSearched(false);setSearchError('');setActive(0);setHasMore(false);
    if(explore||selected||(!chosenBus&&query.trim().length<2)){setLoading(false);return;}
    const controller=new AbortController();setLoading(true);
    void searchRequirementAssets({tipo_equipo:form.tipo_equipo,...(query.trim()?{q:query.trim()}:chosenBus?{bus_ppu:chosenBus,bus_exacto:true}:form.bus_ppu.trim()?{bus_ppu:form.bus_ppu.trim()}:{}),offset,limit:20},controller.signal)
      .then(result=>{if(!controller.signal.aborted){
        const rows=result.items.filter(a=>a.estado_actual==='EN_OPERACION');setOptions(rows);setHasMore(result.has_more);setSearched(true);
        if(chosenBus&&!query.trim()&&offset===0&&rows.length===1&&!result.has_more)choose(rows[0]);
      }})
      .catch(e=>{if(!controller.signal.aborted)setSearchError(getApiErrorMessage(e,'No se pudieron consultar los activos en operación.'));})
      .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return()=>controller.abort();
  },[form.tipo_equipo,form.bus_ppu,chosenBus,query,selected,explore,offset,revision]);
  useEffect(()=>{
    setInterventions([]);setActiveError('');
    if(!selected){setChecking(false);return;}
    const controller=new AbortController();setChecking(true);
    void getActiveRequirements(selected.tipo_equipo,selected.serie,controller.signal)
      .then(rows=>{if(!controller.signal.aborted)setInterventions(rows);})
      .catch(e=>{if(!controller.signal.aborted)setActiveError(getApiErrorMessage(e,'No se pudo verificar si existe una intervención activa.'));})
      .finally(()=>{if(!controller.signal.aborted)setChecking(false);});
    return()=>controller.abort();
  },[selected,revision]);
  const clearAssetContext=()=>{
    setSelected(null);setQuery('');setChosenBus('');setExplore(false);setOffset(0);
    setOptions([]);setBuses([]);setSearched(false);setHasMore(false);setMoreBuses(false);
    setActive(0);setBusActive(0);setAssetOpen(true);setBusOpen(true);
    setLoading(false);setBusLoading(false);setChecking(false);
    setInterventions([]);setActiveError('');setSearchError('');setBusError('');setError('');setCreated(null);
    setForm(current=>({...current,serie:'',bus_ppu:'',terminal_id:undefined,pst_codigo:undefined}));
  };
  const change=<K extends keyof RequestPayload>(key:K,value:RequestPayload[K])=>{
    if(key==='tipo_equipo'||key==='bus_ppu')clearAssetContext();
    setForm(current=>({...current,[key]:value}));
    setCreated(null);setError('');
  };
  const chooseBus=(bus:string)=>{clearAssetContext();setChosenBus(bus);setBusOpen(false);setForm(current=>({...current,bus_ppu:bus}));};
  const changeSeries=(value:string)=>{
    if(selected)clearAssetContext();
    setQuery(value);setOffset(0);setAssetOpen(true);setError('');setCreated(null);
  };
  const compatible=selected?.estado_actual==='EN_OPERACION'&&selected.tipo_equipo===form.tipo_equipo&&selected.serie===form.serie
    &&selected.bus_ppu===form.bus_ppu.trim().toUpperCase()&&selected.terminal_id===form.terminal_id&&selected.pst_codigo===form.pst_codigo;
  const submit=async(event:FormEvent)=>{
    event.preventDefault();if(busy)return;
    if(!selected||!compatible||checking||activeError||interventions.length){setError('Selecciona un activo operativo sin intervención activa y corrige los conflictos.');return;}
    setBusy(true);setError('');setCreated(null);
    try{
      const current=await getActiveRequirements(selected.tipo_equipo,selected.serie);setInterventions(current);if(current.length)return;
      const result=await createRequest({...form,serie:selected.serie,bus_ppu:selected.bus_ppu,terminal_id:selected.terminal_id,pst_codigo:selected.pst_codigo,referencia_externa:form.origen==='ARANDA'?form.referencia_externa?.trim():undefined});
      setCreated(result);setForm(initialForm());setSelected(null);setQuery('');setChosenBus('');setExplore(false);setOffset(0);
    }catch(e){setError(getApiErrorMessage(e,'No se pudo registrar el requerimiento.'));setRevision(n=>n+1);}finally{setBusy(false);}
  };
  return <div className="page request-entry-page">
    <PageHeader report={pagedReport('Activos operativos','/api/requerimientos/operativos',{tipo_equipo:form.tipo_equipo,...(query.trim()?{q:query.trim()}:{bus_ppu:form.bus_ppu})},busy||loading||!!searchError)} title="Ingreso de requerimientos" eyebrow="Operación" description="Identifica el activo instalado que presenta la falla y registra su intervención PMP." icon={<ClipboardList size={21}/>}/>
    {error&&<FeedbackBanner tone="danger">{error}</FeedbackBanner>}
    {created&&<FeedbackBanner tone="success">OS {created.os.codigo_os} creada. Pendiente de asignación para retiro en terreno. <Link to="/operacion/retiros">Ir a Retiros de terreno</Link> · <Link to={caseHistoryUrl(created.caso.id)}>Ver caso e intervenciones</Link></FeedbackBanner>}
    <form className="request-entry-form" onSubmit={submit}>
      <fieldset className="panel entry-section request-origin-section" disabled={busy}><legend className="sr-only">Origen del requerimiento</legend><h2 className="section-title"><ClipboardList size={19} aria-hidden="true"/>Origen del requerimiento</h2><div className="form-grid">
        <label className="field">Origen<select id="request-origin" value={form.origen} onChange={e=>change('origen',e.target.value as RequestPayload['origen'])}><option value="INTERNO">Interno</option><option value="ARANDA">Aranda · ingreso asistido</option></select></label>
        {form.origen==='ARANDA'&&<label className="field">Referencia Aranda<input id="request-reference" className="input" value={form.referencia_externa||''} onChange={e=>change('referencia_externa',e.target.value)} maxLength={33} required placeholder="AR-00123456 o 00123456"/><span className="field-hint">Los ceros iniciales se conservan.</span></label>}
        <label className="field">Fecha del requerimiento<input className="input" type="date" required value={form.fecha_requerimiento} onChange={e=>change('fecha_requerimiento',e.target.value)}/></label>
        <label className="field">Intervención<select value={form.clasificacion} onChange={e=>change('clasificacion',e.target.value as RequestPayload['clasificacion'])}><option value="MANTENCION">Mantención</option><option value="POD">PoD</option></select></label>
      </div></fieldset>
      <fieldset className="panel entry-section" disabled={busy}><legend className="sr-only">Contexto y activo existente</legend><h2 className="section-title"><Search size={19} aria-hidden="true"/>Contexto y activo existente</h2><div className="form-grid">
        <label className="field">Tipo de equipo<select id="request-type" value={form.tipo_equipo} onChange={e=>change('tipo_equipo',e.target.value as RequestPayload['tipo_equipo'])}><option value="VALIDADOR">Validador</option><option value="CONSOLA">Consola</option></select></label>
        <div className="request-combobox" onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget as Node|null))setBusOpen(false);}}>
          <label className="field">Bus / PPU<input ref={busInput} id="request-bus" className="input" role="combobox" readOnly={!!selected} aria-describedby={selected?'request-installation-hint':undefined} aria-autocomplete="list" aria-expanded={busOpen&&buses.length>0} aria-controls="request-bus-options" aria-activedescendant={busOpen&&buses.length?`request-bus-option-${busActive}`:undefined} required maxLength={10} value={form.bus_ppu} placeholder="Escribe parte de la PPU" onFocus={()=>setBusOpen(true)} onChange={e=>change('bus_ppu',e.target.value.toUpperCase())}
            onKeyDown={e=>{if(e.key==='Escape'){e.preventDefault();setBusOpen(false);return;}if(e.key==='Tab'){setBusOpen(false);return;}if(!buses.length)return;if(e.key==='ArrowDown'){e.preventDefault();setBusOpen(true);setBusActive(i=>busOpen?(i+1)%buses.length:0);}else if(e.key==='ArrowUp'){e.preventDefault();setBusOpen(true);setBusActive(i=>busOpen?(i+buses.length-1)%buses.length:0);}else if(e.key==='Enter'&&busOpen){e.preventDefault();chooseBus(buses[busActive].bus_ppu);}}}/></label>
          {selected&&<button type="button" className="btn ghost" onClick={()=>{clearAssetContext();busInput.current?.focus();}}>Cambiar bus / PPU</button>}
          {busOpen&&buses.length>0&&<div className="request-suggestions"><div ref={busList} id="request-bus-options" className="request-bus-list" role="listbox" aria-label="Buses con activos en operación">{buses.map((b,i)=><button type="button" role="option" tabIndex={-1} id={`request-bus-option-${i}`} aria-selected={i===busActive} key={b.bus_ppu} className="request-bus-option" onMouseDown={e=>e.preventDefault()} onClick={()=>chooseBus(b.bus_ppu)}>{b.bus_ppu}</button>)}</div>{moreBuses&&<p className="request-suggestion-hint">Escribe más caracteres para acotar los 20 buses mostrados.</p>}</div>}
        </div>
        <label className="field">Terminal<input id="request-terminal" className="input" readOnly value={selected?.terminal||catalogs.terminales.find(t=>t.id===form.terminal_id)?.nombre||''} placeholder="Se completa desde la instalación"/></label>
        <label className="field">Operador<input id="request-operator" className="input" readOnly value={selected?.operador||catalogs.psts.find(p=>p.codigo===form.pst_codigo)?.nombre||''} placeholder="Se completa desde la instalación"/></label>
      </div>
      {selected&&<p id="request-installation-hint" className="field-hint">Serie, modelo, marca, PPU, terminal y operador provienen de la instalación vigente del activo seleccionado.</p>}
      {busLoading&&<p role="status">Buscando buses en operación…</p>}
      {busError&&<FeedbackBanner tone="danger">{busError}</FeedbackBanner>}
      <div className="request-combobox" onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget as Node|null))setAssetOpen(false);}}>
        <label className="field">{selected?'Serie':'Buscar activo existente por serie'}<input ref={seriesInput} id="request-series" className="input" role="combobox" readOnly={!!selected} aria-describedby={selected?'request-installation-hint':undefined} aria-autocomplete="list" aria-expanded={assetOpen&&!selected&&!explore&&options.length>0} aria-controls="request-asset-options" aria-activedescendant={assetOpen&&!selected&&!explore&&options.length?`request-option-${active}`:undefined} value={selected?.serie??query} maxLength={50}
          onFocus={()=>setAssetOpen(true)} onChange={e=>changeSeries(e.target.value)}
          onKeyDown={e=>{if(e.key==='Escape'){e.preventDefault();setAssetOpen(false);return;}if(e.key==='Tab'){setAssetOpen(false);return;}if(e.key==='Enter')e.preventDefault();if(selected||!options.length)return;if(e.key==='ArrowDown'){e.preventDefault();setAssetOpen(true);setActive(i=>assetOpen?(i+1)%options.length:0);}else if(e.key==='ArrowUp'){e.preventDefault();setAssetOpen(true);setActive(i=>assetOpen?(i+options.length-1)%options.length:0);}else if(e.key==='Enter'&&assetOpen)choose(options[active]);}}/>
        </label>
        {assetOpen&&!selected&&!explore&&options.length>0&&<div className="request-suggestions">
          <div ref={assetList} id="request-asset-options" className="request-asset-list" role="listbox" aria-label="Activos en operación">
            {options.map((a,i)=><button type="button" className="request-asset-option" id={`request-option-${i}`} key={a.serie} role="option" tabIndex={-1} aria-selected={i===active} onMouseDown={e=>e.preventDefault()} onClick={()=>choose(a)}>
              <span className="request-asset-heading"><span className="request-asset-identity"><strong>{a.serie}</strong><span className="request-asset-model">{a.modelo||'Modelo no informado'}</span></span><StatusBadge tone="success">EN OPERACIÓN</StatusBadge></span>
              <span className="request-asset-context" title={`${a.bus_ppu} · ${a.terminal||'Sin terminal'} · ${a.operador||'Sin operador'}`}>{a.bus_ppu} · {a.terminal||'Sin terminal'} · {a.operador||'Sin operador'}</span>
            </button>)}
          </div>
          {hasMore&&<button type="button" className="btn ghost request-more-results" onClick={()=>{setExplore(true);setAssetOpen(false);}}>Ver más en el explorador</button>}
        </div>}
      </div>
      <p className="field-hint">Busca por PPU o por serie. Solo se muestran activos en operación del tipo seleccionado.</p>
      <button className="btn secondary" type="button" onClick={()=>{setExplore(true);setAssetOpen(false);setBusOpen(false);}}><Search size={17} aria-hidden="true"/>Buscar / Explorar activos en operación</button>
      {!explore&&loading&&<p role="status">Buscando activos…</p>}
      {!explore&&searchError&&<FeedbackBanner tone="danger">{searchError}</FeedbackBanner>}
      {!explore&&!selected&&searched&&!options.length&&<FeedbackBanner tone="warning">No se encontraron activos en operación para estos filtros. Un activo registrado en Bodega, QA o laboratorio no puede seleccionarse aquí.</FeedbackBanner>}
      {selected&&<FeedbackBanner tone={compatible?'success':'warning'}><strong>Activo seleccionado: {selected.tipo_equipo} · {selected.serie}</strong><p>{selected.modelo||'Modelo no informado'} · {selected.marca||'Marca no informada'} · {selected.bus_ppu} · {selected.terminal} · {selected.operador}</p>
        {!compatible&&<p>Conflicto: los datos del formulario no coinciden con la instalación vigente. Vuelve a seleccionar el activo antes de crear el requerimiento.</p>}
        <button className="btn secondary" type="button" onClick={()=>{clearAssetContext();seriesInput.current?.focus();}}>Cambiar activo</button></FeedbackBanner>}
      {checking&&<p role="status">Verificando intervenciones activas…</p>}
      {activeError&&<FeedbackBanner tone="danger">{activeError}<button className="btn secondary" type="button" onClick={()=>setRevision(n=>n+1)}>Reintentar verificación</button></FeedbackBanner>}
      {!!interventions.length&&<FeedbackBanner tone="warning"><strong>Ya existe una intervención activa para este activo</strong>{interventions.map(o=><div key={o.codigo_os}><p>{o.codigo_os} · {o.referencia_ar||'Sin referencia AR'} · Bus {o.bus_ppu} · {o.falla} · {o.estado_actual.replaceAll('_',' ')} · {o.tecnico||'Sin técnico asignado'}</p><Link to={o.caso_id?caseHistoryUrl(o.caso_id):`/trazabilidad?tipo=${selected?.tipo_equipo}&serie=${encodeURIComponent(selected?.serie||'')}`}>Ver intervención</Link></div>)}</FeedbackBanner>}
      </fieldset>
      <fieldset className="panel entry-section" disabled={busy}><legend className="sr-only">Detalle</legend><h2 className="section-title"><ClipboardList size={19} aria-hidden="true"/>Detalle de la intervención</h2>
        <p className="field-hint">Describe la falla del activo seleccionado y agrega los antecedentes necesarios para la intervención.</p>
        <label className="field">Falla reportada<textarea id="request-failure" className="input" required rows={3} value={form.falla} maxLength={3000} onChange={e=>change('falla',e.target.value)}/></label>
        <label className="field">Observación<textarea className="input" rows={2} value={form.observacion||''} maxLength={3000} onChange={e=>change('observacion',e.target.value)}/></label>
      </fieldset>
      <footer className="panel entry-actions"><p className="field-hint">La OS se registra sobre el activo y la instalación seleccionados.</p><button className="btn" disabled={busy||!selected||!compatible||checking||!!activeError||interventions.length>0||!selected.terminal_id||!selected.pst_codigo}>{busy?'Registrando…':'Confirmar requerimiento y crear OS PMP'}</button></footer>
    </form>
    {explore&&<OperationalAssetExplorer type={form.tipo_equipo} initialQuery={query} initialBus={chosenBus||form.bus_ppu} exactBus={!!chosenBus} onClose={()=>setExplore(false)} onSelect={asset=>choose(asset)}/>}
  </div>;
}
