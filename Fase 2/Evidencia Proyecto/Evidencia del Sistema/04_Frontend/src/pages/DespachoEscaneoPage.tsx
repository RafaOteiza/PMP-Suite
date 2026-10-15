import {localReport,pagedReport} from '../utils/pageReports';
﻿import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ScanBarcode } from 'lucide-react';
import { getTecnicosTerreno, type TecnicoTerreno } from '../api/bodega';
import { getDispatchDestinations, type DispatchDestination, caseHistoryUrl, confirmDispatch, getCases, getRequestCatalogs, validateDispatch, type DispatchValidation, type OperationalCase } from '../api/requerimientos';
import { getApiErrorMessage } from '../api/errors';
import PageHeader from '../components/ui/PageHeader';
import FeedbackBanner from '../components/ui/FeedbackBanner';
import {assetHistoryUrl} from '../api/bridge';
import {scannerProof, type ScannerProof} from '../utils/receiptScanner';
import StatusBadge from '../components/ui/StatusBadge';
import {useSession} from '../app/SessionContext';
import '../styles/dispatch-scan.css';

// Presentation only: keep every source code, including equivalent labels with different contracts.
const catalogKey=(name:string)=>name.normalize('NFKC').trim().replace(/\s+/g,' ').toLocaleLowerCase('es');
const catalogOrder=new Intl.Collator('es',{sensitivity:'base',numeric:true});
export function dispatchCatalogName(name:string) {
  const clean=name.trim().replace(/\s+/g,' ');
  const sentence=clean.toLocaleLowerCase('es').replace(/\p{L}/u,letter=>letter.toLocaleUpperCase('es'))
    .replace(/^((?:\p{L}\.\s*)+)(\p{L})/u,(_,initials,letter)=>initials+letter.toLocaleUpperCase('es'));
  return sentence.replace(/\b(stu|stp|enea|spa|s\.a\.|s\.p\.a\.|eirl|ltda\.?|[a-z]\.)/gi,(token,_,offset,text)=>{
    if (/^[a-z]\.$/i.test(token))return token.toUpperCase();
    // Match full words, not the start of a longer company name.
    if (/\p{L}/u.test(text[offset+token.length]||''))return token;
    const key=token.toLowerCase();
    return key==='spa'?'SpA':key.startsWith('ltda')?'Ltda'+(key.endsWith('.')?'.':''):token.toUpperCase();
  });
}
export function dispatchOperatorGroups(operators:Array<{codigo:string;nombre:string}>) {
  const groups=new Map<string,{key:string;label:string;operators:typeof operators}>();
  for(const operator of [...operators].sort((a,b)=>catalogOrder.compare(a.codigo,b.codigo))){
    const key=catalogKey(operator.nombre);
    if(!groups.has(key))groups.set(key,{key,label:dispatchCatalogName(operator.nombre),operators:[]});
    if(!groups.get(key)!.operators.some(p=>p.codigo===operator.codigo))groups.get(key)!.operators.push(operator);
  }
  return [...groups.values()].sort((a,b)=>catalogOrder.compare(a.label,b.label));
}

export default function DespachoEscaneoPage() {
  const {me}=useSession();
  const manualAllowed=me?.rol==='admin'||me?.rol==='logistica';
  const [params] = useSearchParams();
  const [mode,setMode]=useState<'NUEVA'|'REQUERIMIENTO'>(params.get('caso')?'REQUERIMIENTO':'NUEVA');
  const [destinations,setDestinations]=useState<DispatchDestination[]>([]);
  const [reason,setReason]=useState('');
  const [operatorChoice,setOperatorChoice]=useState('');
  const [destinationLoading,setDestinationLoading]=useState(false);
  const scanner=useRef({code:'',times:[] as number[]}),working=useRef(false);
  const [cases, setCases] = useState<OperationalCase[]>([]), [technicians, setTechnicians] = useState<TecnicoTerreno[]>([]);
  const [catalogs, setCatalogs] = useState<Awaited<ReturnType<typeof getRequestCatalogs>>>({ terminales: [], psts: [] });
  const [caseQuery, setCaseQuery] = useState(''), [loading, setLoading] = useState(true), [busy, setBusy] = useState(false);
  const [context, setContext] = useState({ caso_id: '', os_origen: '', tipo_equipo: 'VALIDADOR' as 'VALIDADOR' | 'CONSOLA', tecnico_terreno_id: '', bus_ppu: '', terminal_id: '', pst_codigo: '' });
  const [code, setCode] = useState(''), [capture, setCapture] = useState<'SCANNER' | 'MANUAL'|'MANUAL_AUTORIZADO'>('SCANNER');
  const [present,setPresent]=useState(false);
  const [validation, setValidation] = useState<DispatchValidation | null>(null), [error, setError] = useState('');
  const [completed, setCompleted] = useState<Awaited<ReturnType<typeof confirmDispatch>> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null), errorRef = useRef<HTMLDivElement>(null);
  const selectedCase = cases.find(c => String(c.id) === context.caso_id);
  const exactDestinations=[...new Map(destinations.filter(d=>d.bus_ppu===context.bus_ppu).map(d=>[`${d.terminal_id}:${d.pst_codigo}`,d])).values()];
  const knownDestination=exactDestinations.length===1?exactDestinations[0]:undefined;
  const relatedDestinations=exactDestinations.filter(d=>d.terminal_id&&d.pst_codigo);
  const destinationConflict=mode==='NUEVA'&&relatedDestinations.length>0&&context.terminal_id&&context.pst_codigo&&!relatedDestinations.some(d=>String(d.terminal_id)===context.terminal_id&&d.pst_codigo===context.pst_codigo);
  const contextReady = Boolean(!destinationConflict&&(mode!=='NUEVA'||!destinationLoading)&&(mode==='NUEVA'||(context.caso_id && context.os_origen)) && context.tecnico_terreno_id && context.bus_ppu.trim() && context.terminal_id && context.pst_codigo);
  const operators=dispatchOperatorGroups(catalogs.psts);
  const selectedOperator=operators.find(group=>group.operators.some(p=>p.codigo===context.pst_codigo))||operators.find(group=>group.key===operatorChoice);
  const terminalOptions=[...catalogs.terminales].sort((a,b)=>catalogOrder.compare(dispatchCatalogName(a.nombre),dispatchCatalogName(b.nombre)));
  const technicianOptions=[...technicians].sort((a,b)=>catalogOrder.compare(`${a.nombre} ${a.apellido}`,`${b.nombre} ${b.apellido}`));
  const payload=()=>({...context,contexto_instalacion:mode,caso_id:mode==='NUEVA'?undefined:context.caso_id,os_origen:mode==='NUEVA'?undefined:context.os_origen,terminal_id:context.terminal_id?Number(context.terminal_id):undefined});
  const canConfirm = Boolean(contextReady && validation?.elegible && ((capture==='SCANNER'&&validation.escaneo?.id)||(capture==='MANUAL_AUTORIZADO'&&manualAllowed&&present&&validation.validacion?.id)));

  const chooseCase = (caseItem?: OperationalCase) => {
    setOperatorChoice('');
    setMode('REQUERIMIENTO');setValidation(null); setCode(''); setError(''); setCompleted(null);
    setContext(current => ({ ...current, caso_id: caseItem ? String(caseItem.id) : '', os_origen: caseItem?.ordenes?.find(o => !o.es_instalacion)?.codigo_os || '', tipo_equipo: caseItem?.tipo_equipo || 'VALIDADOR', bus_ppu: caseItem?.bus_ppu || '', terminal_id: caseItem?.terminal_id ? String(caseItem.terminal_id) : '', pst_codigo: caseItem?.pst_codigo || '' }));
  };
  useEffect(() => {
    let active = true;
    Promise.all([getCases(), getTecnicosTerreno(), getRequestCatalogs()]).then(([items, users, catalog]) => {
      if (!active) return;
      setCases(items); setTechnicians(users); setCatalogs(catalog);
      const initial = items.find(c => String(c.id) === params.get('caso'));
      if (initial) chooseCase(initial);
    }).catch(e => { if (active) setError(getApiErrorMessage(e, 'No se pudo cargar el contexto de despacho.')); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  useEffect(() => { if (error) { errorRef.current?.focus({ preventScroll: true }); errorRef.current?.scrollIntoView({ block: 'nearest' }); } }, [error]);
  useEffect(()=>{
    if(mode!=='NUEVA')return;
    let active=true;setDestinationLoading(true);setDestinations([]);
    getDispatchDestinations(context.bus_ppu).then(items=>{
      if(!active)return;setDestinations(items);
      const matches=[...new Map(items.filter(d=>d.bus_ppu===context.bus_ppu).map(d=>[`${d.terminal_id}:${d.pst_codigo}`,d])).values()];
      const exact=matches.length===1?matches[0]:undefined;
      if(exact&&(exact.terminal_id||exact.pst_codigo)){
        setValidation(null);
        setContext(c=>({...c,terminal_id:exact.terminal_id?String(exact.terminal_id):c.terminal_id,pst_codigo:exact.pst_codigo||c.pst_codigo}));
      }
    }).catch(e=>{if(active)setError(getApiErrorMessage(e,'No se pudo consultar el destino.'));}).finally(()=>{if(active)setDestinationLoading(false);});
    return()=>{active=false;};
  },[mode,context.bus_ppu]);
  const changeMode=(next:'NUEVA'|'REQUERIMIENTO')=>{
    setOperatorChoice('');
    setMode(next);setContext({caso_id:'',os_origen:'',tipo_equipo:'VALIDADOR',tecnico_terreno_id:'',bus_ppu:'',terminal_id:'',pst_codigo:''});
    setValidation(null);setCode('');setError('');setCompleted(null);setPresent(false);setReason('');scanner.current={code:'',times:[]};
  };
  const updateContext = (key: keyof typeof context, value: string) => {
    if(key==='bus_ppu')setOperatorChoice('');
    setContext(current => {
      const next={ ...current, [key]: value,...(key==='bus_ppu'?{terminal_id:'',pst_codigo:''}:{}) };
      if(mode==='NUEVA'&&relatedDestinations.length&&(key==='terminal_id'||key==='pst_codigo')){
        const matches=relatedDestinations.filter(d=>key==='terminal_id'?String(d.terminal_id)===value:d.pst_codigo===value);
        if(matches.length===1){next.terminal_id=String(matches[0].terminal_id);next.pst_codigo=matches[0].pst_codigo!;}
        else if(key==='terminal_id')next.pst_codigo='';
        else if(!matches.some(d=>String(d.terminal_id)===next.terminal_id))next.terminal_id='';
      }
      return next;
    }); setValidation(null); setCompleted(null); setError('');
  };
  const chooseOperator=(key:string)=>{
    setOperatorChoice(key);
    const group=operators.find(g=>g.key===key);
    const matches=group?.operators.filter(p=>relatedDestinations.some(d=>d.pst_codigo===p.codigo&&(!context.terminal_id||String(d.terminal_id)===context.terminal_id)))||[];
    updateContext('pst_codigo',matches.length===1?matches[0].codigo:group?.operators.length===1?group.operators[0].codigo:'');
  };
  const searchCases = async () => {
    setLoading(true); setError('');
    try {
      const items = await getCases(caseQuery.trim());
      setCases(current => { const selected = current.find(c => String(c.id) === context.caso_id); return selected && !items.some(c => c.id === selected.id) ? [selected, ...items] : items; });
    } catch (e) { setError(getApiErrorMessage(e, 'No se pudieron buscar casos.')); }
    finally { setLoading(false); }
  };
  const read = async (event?: FormEvent, physical?:{code:string;proof:ScannerProof}) => {
    event?.preventDefault(); const reading=physical?.code||code; if (working.current||busy || loading || !contextReady || !reading.trim()) return;
    if(capture==='SCANNER'&&!physical){setError('Usa una lectura continua del escáner con Enter o Ingreso manual autorizado.');return;}
    if(capture==='MANUAL_AUTORIZADO'&&(!manualAllowed||!present||reading!==reading.trim()||!reason.trim())){setValidation(null);setError('Ingresa la serie exacta sin espacios adicionales y confirma la presencia física en Bodega.');return;}
    working.current=true;setBusy(true); setError(''); setValidation(null); setCompleted(null);
    try { setValidation(await validateDispatch({...payload(),codigo:reading,origen_captura:capture,lectura_scanner:physical?.proof,presencia_fisica_confirmada:present,motivo:reason})); }
    catch (e) { setError(getApiErrorMessage(e, 'Equipo no elegible. Selecciona otro equipo físico.')); }
    finally { working.current=false;setBusy(false); inputRef.current?.focus(); }
  };
  const scannerKey=(event:KeyboardEvent<HTMLInputElement>)=>{
    if(capture!=='SCANNER'||working.current)return;
    if(event.key==='Tab'||event.key==='Escape'){scanner.current={code:'',times:[]};return;}
    if(event.key==='Shift')return;
    event.preventDefault();setValidation(null);
    if(!event.nativeEvent.isTrusted||event.ctrlKey||event.metaKey||event.altKey||event.repeat){scanner.current={code:'',times:[]};setCode('');setError('Usa el escáner o Ingreso manual autorizado.');return;}
    if(event.key==='Enter'){
      const buffered=scanner.current,proof=scannerProof(buffered.code,buffered.times,event.timeStamp);scanner.current={code:'',times:[]};
      if(!proof){setCode('');setError('Lectura no reconocida como escáner. Usa Ingreso manual autorizado para digitar.');return;}
      setCode(buffered.code);void read(undefined,{code:buffered.code,proof});return;
    }
    if(event.key.length!==1){scanner.current={code:'',times:[]};setCode('');return;}
    const current=scanner.current;
    if(current.times.length&&(event.timeStamp-current.times.at(-1)!>80||current.code.length>=64)){current.code='';current.times=[];}
    current.code+=event.key;current.times.push(event.timeStamp);setCode(current.code);
  };
  const dispatch = async () => {
    if (working.current||busy || !canConfirm || !validation) return;
    working.current=true;setBusy(true); setError('');
    try {
      const result = await confirmDispatch({ ...payload(), tecnico_terreno_id:context.tecnico_terreno_id,bus_ppu:context.bus_ppu.trim().toUpperCase(), ...(validation.validacion?{validacion_id:validation.validacion.id}:{escaneo_id:validation.escaneo!.id}) });
      setCompleted(result); setValidation(null); setCode('');
    } catch (e) {
      setError(getApiErrorMessage(e, 'No se pudo confirmar el despacho. El contexto se conserva; verifica el equipo antes de reintentar.'));
      // Keep evidence after a lost response; a definite validation rejection requires a new capture.
      const status=(e as {response?:{status?:number}})?.response?.status;
      if(status&&status<500)setValidation(null);
    } finally { working.current=false;setBusy(false); }
  };

  return <div className="page dispatch-scan-page">
    <PageHeader report={mode==='REQUERIMIENTO'?pagedReport('Casos para despacho','/api/requerimientos',{q:caseQuery.trim()},loading||busy||!!error,'array'):localReport('Contexto de despacho',completed?[completed.os]:validation?[validation.equipo]:[],loading||busy||!!error||(!completed&&!validation))} eyebrow="Salida física a terreno" title="Despacho por escaneo" description="Indica la necesidad de instalación y lee la etiqueta del equipo que entregarás. La OS IN se crea al confirmar el despacho." icon={<ScanBarcode size={21} />} />
    {error && <div ref={errorRef} tabIndex={-1}><FeedbackBanner tone="danger">{error}</FeedbackBanner></div>}
    {completed && <FeedbackBanner tone="success">Despacho confirmado: {completed.os.codigo_os} · Serie {completed.os.serie || completed.os.validador_serie || completed.os.consola_serie}. El técnico verá esta instalación en Mis Órdenes. <Link to={completed.caso?caseHistoryUrl(completed.caso.id):assetHistoryUrl({tipo_equipo:completed.os.tipo_equipo,serie:completed.os.serie||completed.os.validador_serie||completed.os.consola_serie||''})}>{completed.caso?'Ver caso completo':'Ver historial del activo'}</Link></FeedbackBanner>}
    <div className="dispatch-scan-grid">
    <section className="panel operation-form operation-section dispatch-context" aria-labelledby="dispatch-context-title">
      <div className="dispatch-section-heading"><h2 id="dispatch-context-title">1. Necesidad de instalación</h2><p className="field-hint">Define el destino y el técnico que recibirá el equipo.</p></div>
      <label className="field">Contexto de instalación<select id="dispatch-mode" value={mode} disabled={busy||loading} onChange={e=>changeMode(e.target.value as typeof mode)}><option value="NUEVA">Nueva instalación</option><option value="REQUERIMIENTO">Instalación vinculada a un requerimiento</option></select></label>
      {mode==='REQUERIMIENTO'&&<div className="toolbar-group"><input aria-label="Buscar caso" className="input" placeholder="Caso, referencia u OS origen" value={caseQuery} disabled={busy} onChange={e => setCaseQuery(e.target.value)} /><button className="btn ghost" disabled={busy || loading} onClick={searchCases}>Buscar casos</button></div>}
      <fieldset className="form-section" disabled={busy || loading}><div className="form-grid">
        {mode==='REQUERIMIENTO'&&<><label className="field">Caso<select id="dispatch-case" value={context.caso_id} onChange={e => chooseCase(cases.find(c => String(c.id) === e.target.value))}><option value="">Selecciona un caso</option>{cases.map(c => <option key={c.id} value={c.id}>{c.codigo_caso} · {c.bus_ppu} · {c.falla_reportada}</option>)}</select></label>
        <label className="field">Intervención origen<select id="dispatch-origin" value={context.os_origen} onChange={e => updateContext('os_origen', e.target.value)}><option value="">Selecciona la OS origen</option>{selectedCase?.ordenes?.map(o => <option key={o.codigo_os} value={o.codigo_os}>{o.codigo_os} · {o.tipo_equipo} · {o.serie}</option>)}</select></label></>}
        <label className="field">Equipo requerido<select id="dispatch-type" value={context.tipo_equipo} onChange={e => updateContext('tipo_equipo', e.target.value)}><option value="VALIDADOR">Validador</option><option value="CONSOLA">Consola</option></select></label>
        <label className="field">Bus destino / PPU<input id="dispatch-bus" list={mode==='NUEVA'?'dispatch-buses':undefined} className="input" value={context.bus_ppu} maxLength={10} onChange={e => updateContext('bus_ppu', e.target.value.toUpperCase())} /></label>
        <datalist id="dispatch-buses">{[...new Set(destinations.map(d=>d.bus_ppu))].map(ppu=><option key={ppu} value={ppu}/>)}</datalist>
        <label className="field">Terminal<select disabled={mode==='NUEVA'&&!!knownDestination?.terminal_id} id="dispatch-terminal" value={context.terminal_id} onChange={e => updateContext('terminal_id', e.target.value)}><option value="">Seleccionar terminal</option>{terminalOptions.map(t => <option key={t.id} value={t.id} disabled={mode==='NUEVA'&&relatedDestinations.length>0&&!relatedDestinations.some(d=>d.terminal_id===t.id)}>{dispatchCatalogName(t.nombre)}</option>)}</select></label>
        <label className="field">Operador<select id="dispatch-operator" disabled={mode==='NUEVA'&&!!knownDestination?.pst_codigo} value={selectedOperator?.key||''} onChange={e => chooseOperator(e.target.value)}><option value="">Seleccionar operador</option>{operators.map(group => <option key={group.key} value={group.key} disabled={mode==='NUEVA'&&relatedDestinations.length>0&&!relatedDestinations.some(d=>group.operators.some(p=>p.codigo===d.pst_codigo)&&(!context.terminal_id||String(d.terminal_id)===context.terminal_id))}>{group.label}</option>)}</select></label>
        {selectedOperator&&selectedOperator.operators.length>1&&<label className="field dispatch-contract">Código de operador<select id="dispatch-operator-code" disabled={mode==='NUEVA'&&!!knownDestination?.pst_codigo} value={context.pst_codigo} onChange={e=>updateContext('pst_codigo',e.target.value)}><option value="">Selecciona el código correspondiente</option>{selectedOperator.operators.map(p=><option key={p.codigo} value={p.codigo} disabled={mode==='NUEVA'&&relatedDestinations.length>0&&!relatedDestinations.some(d=>d.pst_codigo===p.codigo&&(!context.terminal_id||String(d.terminal_id)===context.terminal_id))}>{p.codigo} · {selectedOperator.label}</option>)}</select><span className="field-hint">{mode==='NUEVA'&&knownDestination?.pst_codigo?'Código conservado desde el destino seleccionado.':'Este nombre tiene varios códigos. Selecciona el que corresponde al destino; no se fusionan sus registros.'}</span></label>}
        <label className="field">Técnico de terreno<select id="dispatch-technician" value={context.tecnico_terreno_id} onChange={e => updateContext('tecnico_terreno_id', e.target.value)}><option value="">Selecciona un técnico</option>{technicianOptions.map(t => <option key={t.id} value={t.id}>{dispatchCatalogName(t.nombre)} {dispatchCatalogName(t.apellido)}</option>)}</select></label>
      </div></fieldset>
      {!contextReady && <p className="field-hint">{mode==='NUEVA'?'Selecciona bus, contexto de destino y técnico antes de leer el equipo físico.':'Selecciona caso, intervención origen, bus y técnico antes de leer el equipo físico.'}</p>}
      {mode==='NUEVA'&&destinationLoading&&<p role="status" className="field-hint">Consultando contexto del destino…</p>}
      {mode==='NUEVA'&&knownDestination?.terminal_id&&knownDestination.pst_codigo&&<p className="field-hint">Terminal y operador completados desde el contexto conocido del destino.</p>}
      {mode==='NUEVA'&&relatedDestinations.length>1&&<FeedbackBanner tone="warning">La PPU tiene más de una relación conocida. Selecciona el terminal y el operador correspondientes.</FeedbackBanner>}
      {destinationConflict&&<FeedbackBanner tone="danger">El terminal y el operador no coinciden con las relaciones conocidas de esta PPU.</FeedbackBanner>}
      {mode==='REQUERIMIENTO'&&selectedCase && <p>Falla / motivo: {selectedCase.falla_reportada}. Activo de origen: {selectedCase.tipo_equipo} · {selectedCase.serie_origen}.</p>}
    </section>
    <section className="panel operation-form operation-section dispatch-physical" aria-labelledby="dispatch-physical-title">
      <div className="dispatch-section-heading"><h2 id="dispatch-physical-title">2. Validación física del equipo</h2><p className="field-hint">Lee la etiqueta del equipo presente en Bodega.</p></div>
      {!contextReady&&<FeedbackBanner tone="info">Completa la necesidad de instalación para habilitar la lectura.</FeedbackBanner>}
      <form onSubmit={e=>void read(e)}>
        <fieldset className="form-section" disabled={busy || loading || !contextReady}>
          <label className="field">Origen de captura<select id="dispatch-capture" value={capture} onChange={e => { setCapture(e.target.value as typeof capture); setValidation(null); setCode('');setPresent(false); scanner.current={code:'',times:[]}; }}><option value="MANUAL">Manual · solo consulta</option><option value="SCANNER">Escáner físico</option>{manualAllowed&&<option value="MANUAL_AUTORIZADO">Ingreso manual autorizado</option>}</select></label>
          <label className="field">{capture==='SCANNER'?'Lectura del escáner':'Serie exacta'}<input id="dispatch-reading" ref={inputRef} className="input" value={code} autoComplete="off" autoFocus maxLength={64} readOnly={capture==='SCANNER'} inputMode={capture==='SCANNER'?'none':'text'} onKeyDown={scannerKey} onPaste={e=>{if(capture==='SCANNER'){e.preventDefault();setValidation(null);setCode('');scanner.current={code:'',times:[]};setError('El pegado no es una lectura del escáner. Usa Ingreso manual autorizado.');}}} onChange={e => {setValidation(null);if(capture==='SCANNER'){setCode('');setError('Usa el escáner o Ingreso manual autorizado.');return;} setCode(e.target.value);}} placeholder={capture==='SCANNER'?'Esperando lectura del escáner…':'Serie del equipo presente en Bodega'} /></label>
          {capture==='MANUAL_AUTORIZADO'&&<label className="field">Motivo de ingreso manual<input id="dispatch-reason" className="input" value={reason} maxLength={1000} onChange={e=>{setReason(e.target.value);setValidation(null);}}/></label>}
          {capture==='MANUAL_AUTORIZADO'&&<label><input id="dispatch-present" type="checkbox" checked={present} onChange={e=>{setPresent(e.target.checked);setValidation(null);}}/> Confirmo que tengo físicamente este equipo en Bodega y verifiqué su identidad.</label>}
          <p className="field-hint">{capture === 'SCANNER' ? 'Usa el lector conectado y finaliza la lectura con Enter.' : capture==='MANUAL_AUTORIZADO'?'Ingresa exactamente la serie. La autorización queda auditada como ingreso manual autorizado y solo sirve para este despacho.':'Una consulta manual no confirma movimientos.'}</p>
          {capture!=='SCANNER'&&<button className="btn ghost" type="submit" disabled={!code.trim()||(capture==='MANUAL_AUTORIZADO'&&(!present||!reason.trim()))}>{busy ? 'Validando…' : capture==='MANUAL_AUTORIZADO'?'Validar ingreso manual autorizado':'Consultar equipo'}</button>}
        </fieldset>
      </form>
      {validation && <div className="scan-result" role="status" data-status={canConfirm ? 'success' : 'warning'}>
        <div><StatusBadge tone="neutral">{validation.stock.validacion_inicial_conforme?'Stock inicial · recepción conforme':'Stock reparado · elegibilidad validada'}</StatusBadge></div>
        <h3>{validation.elegible ? 'Equipo válido' : capture === 'MANUAL' ? 'Equipo disponible · pendiente de escaneo físico' : 'Equipo no elegible'}</h3>
        <dl className="scan-details"><div><dt>Tipo</dt><dd>{validation.equipo.tipo_equipo}</dd></div><div><dt>Serie</dt><dd>{validation.equipo.serie}</dd></div><div><dt>Modelo</dt><dd>{validation.equipo.modelo || 'Sin modelo'}</dd></div><div><dt>Marca</dt><dd>{validation.equipo.marca||'Sin marca'}</dd></div><div><dt>Ubicación</dt><dd>Bodega</dd></div><div><dt>Validación de ingreso</dt><dd>{validation.stock.validacion_inicial_conforme ? 'Recepción inicial conforme' : validation.stock.es_aprobado_qa === true ? 'Aprobado' : 'Elegibilidad de stock validada'}</dd></div><div><dt>Validación física</dt><dd>{capture === 'SCANNER' && validation.escaneo?.id ? '✓ Escaneado en Bodega' : capture==='MANUAL_AUTORIZADO'&&validation.validacion ? '✓ Ingreso manual autorizado' : '⚠ Pendiente de escaneo'}</dd></div></dl>
        {capture === 'MANUAL_AUTORIZADO'&&validation.validacion&&<p>✓ Presencia física validada · Ingreso manual autorizado. No se ha despachado todavía.</p>}
        {capture === 'MANUAL' && <p>Consulta manual. Usa escáner o ingreso manual autorizado para habilitar el despacho.</p>}
      </div>}
      <div className="dispatch-confirmation" aria-labelledby="dispatch-confirmation-title"><h3 id="dispatch-confirmation-title">Confirmación final</h3>
      <button className="btn full" disabled={busy || !canConfirm} onClick={dispatch}>{busy ? 'Procesando…' : 'Confirmar asignación y despacho'}</button>
      <p className="field-hint">Solo la confirmación crea la OS IN, asigna al técnico y registra la salida de Bodega.</p>
      </div>
    </section>
    </div>
  </div>;
}

