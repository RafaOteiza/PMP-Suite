import {pagedReport} from '../utils/pageReports';
import {useScannerInput} from '../hooks/useScannerInput';
import type {ScannerProof} from '../utils/receiptScanner';
import {assetIdentity} from '../../../shared/assetIdentity.js';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ClipboardList, Search, X } from 'lucide-react';
import { registerAsset, searchAssets, startAssetReception, validateAssetReception, type AssetRegistration, type RegisteredAsset, type AssetType, type ReceptionCapture } from '../api/activos';
import { useSession } from '../app/SessionContext';
import { getApiErrorMessage } from '../api/errors';
import PageHeader from '../components/ui/PageHeader';
import FeedbackBanner from '../components/ui/FeedbackBanner';
import StatusBadge from '../components/ui/StatusBadge';
import EmptyState from '../components/ui/EmptyState';
import { formatOperationalStatus } from '../utils/formatters';

const initial=():AssetRegistration=>({tipo_equipo:'VALIDADOR',serie:'',modelo:'',marca:'',origen:'',fecha_ingreso:new Date().toISOString().slice(0,10),observacion:''});
export default function GestionActivosPage(){
  const {me}=useSession();
  const detailRef=useRef<HTMLElement>(null);
  const canAuthorizeManual=me?.rol==='admin'||me?.rol==='logistica';
  const [form,setForm]=useState(initial),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
  const [type,setType]=useState<AssetType>('VALIDADOR'),[query,setQuery]=useState(''),[rows,setRows]=useState<RegisteredAsset[]>([]),[searched,setSearched]=useState(false);
  const [selected,setSelected]=useState<RegisteredAsset|null>(null),[note,setNote]=useState('');
  const [reading,setReading]=useState(''),[capture,setCapture]=useState<ReceptionCapture>('MANUAL');
  const [scanId,setScanId]=useState<string|null>(null),[validationId,setValidationId]=useState<string|null>(null),[conforme,setConforme]=useState(false);
  const [present,setPresent]=useState(false),[detailError,setDetailError]=useState(''),[detailMessage,setDetailMessage]=useState('');
  const invalidateCapture=()=>{setScanId(null);setValidationId(null);setDetailError('');};
  const selectAsset=(asset:RegisteredAsset|null)=>{setSelected(asset);invalidateCapture();setConforme(false);setPresent(false);setReading('');setCapture('MANUAL');setNote('');setDetailMessage('');};
  useEffect(()=>{if(selected)detailRef.current?.scrollIntoView({block:'start'});},[selected?.tipo_equipo,selected?.serie]);
  const identity=assetIdentity(form.tipo_equipo,form.serie);
  const change=<K extends keyof AssetRegistration>(key:K,value:AssetRegistration[K])=>setForm(current=>{
   const next={...current,[key]:value};if(key==='tipo_equipo'||key==='serie'){const derived=assetIdentity(next.tipo_equipo,next.serie);next.modelo=derived.modelo;next.marca=derived.marca;}return next;
  });
  const create=async(e:FormEvent)=>{e.preventDefault();if(busy)return;setBusy(true);setError('');setMessage('');
    try{const asset=await registerAsset(form);selectAsset(asset);setRows([asset]);setType(asset.tipo_equipo);setQuery(asset.serie);setForm(initial());setMessage(`Activo ${asset.serie} registrado en el maestro. No está disponible en Bodega ni instalado.`);}
    catch(err){setError(getApiErrorMessage(err,'No se pudo registrar el activo.'));}finally{setBusy(false);}};
  const search=async(e:FormEvent)=>{e.preventDefault();if(busy)return;setBusy(true);setError('');selectAsset(null);
    try{setRows(await searchAssets({tipo_equipo:type,q:query}));setSearched(true);}catch(err){setError(getApiErrorMessage(err,'No se pudo consultar el maestro.'));}finally{setBusy(false);}};
  const validate=async(code=reading,proof?:ScannerProof)=>{if(busy||!selected)return;invalidateCapture();
    if(capture==='SCANNER'&&!proof){setDetailError('Usa una lectura continua del escáner con Enter o Ingreso manual autorizado.');return;}
    if(capture==='MANUAL_AUTORIZADO'){
      if(!canAuthorizeManual||!present){setDetailError('Confirma que tienes físicamente este equipo en Bodega y verificaste su identidad.');return;}
      if(code!==selected.serie){setDetailError('La serie debe coincidir exactamente con el activo seleccionado, sin espacios adicionales.');return;}
    }
    setBusy(true);
    try{const result=await validateAssetReception({tipo_equipo:selected.tipo_equipo,serie:selected.serie,codigo:code,origen_captura:capture,lectura_scanner:proof,...(capture==='MANUAL_AUTORIZADO'?{presencia_fisica_confirmada:present}:{})});
      if(result.elegible){setScanId(result.escaneo?.id||null);setValidationId(result.validacion?.id||null);}}
    catch(err){setDetailError(getApiErrorMessage(err,'No se pudo validar la lectura.'));}finally{setBusy(false);}};
  const scanner=useScannerInput((code,proof)=>{setReading(code);void validate(code,proof);},()=>{invalidateCapture();setReading('');setDetailError('Digitación o pegado no constituyen lectura de escáner. Usa Ingreso manual autorizado.');});
  const reception=async(e:FormEvent)=>{e.preventDefault();if(busy||!selected||(!scanId&&!validationId)||!conforme)return;setBusy(true);setDetailError('');setMessage('');
    try{const result=await startAssetReception({tipo_equipo:selected.tipo_equipo,serie:selected.serie,...(validationId?{validacion_id:validationId}:{escaneo_id:scanId!}),validacion_inicial_conforme:conforme,observacion:note});
      const received={...selected,puede_iniciar_recepcion:false,estado_actual:result.estado_actual};setSelected(received);setRows(current=>current.map(a=>a.tipo_equipo===received.tipo_equipo&&a.serie===received.serie?received:a));setDetailMessage('Activo recibido en Bodega y habilitado para instalación. No se ha creado ninguna OS.');}
    catch(err){if((err as {response?:{status:number}}).response?.status===409)invalidateCapture();setDetailError(getApiErrorMessage(err,'No se pudo confirmar la recepción.'));}finally{setBusy(false);}};
  return <div className="page asset-management-page">
    <PageHeader report={pagedReport('Maestro activos','/api/activos',{tipo_equipo:type,q:query},busy||!!error,'array')} title="Gestión de activos" eyebrow="Maestro" description="Registra identidades de equipos. El stock y la operación dependen de su circuito físico." icon={<ClipboardList size={21}/>}/>
    {error&&<FeedbackBanner tone="danger">{error}</FeedbackBanner>}
    {message&&<FeedbackBanner tone="success">{message}</FeedbackBanner>}
    <div className="asset-management-layout">
    <form className="panel operation-form asset-register-form" onSubmit={create}>
      <div className="section-heading"><h2 className="section-title"><ClipboardList size={19} aria-hidden="true"/>Registrar activo</h2><StatusBadge tone="neutral">Maestro</StatusBadge></div>
      <fieldset className="form-section entry-fields" disabled={busy}><legend className="sr-only">Registrar activo</legend><div className="form-grid">
        <label className="field">Tipo<select id="asset-type" value={form.tipo_equipo} onChange={e=>change('tipo_equipo',e.target.value as AssetType)}><option value="VALIDADOR">Validador</option><option value="CONSOLA">Consola</option></select></label>
        <label className="field">Serie<input id="asset-series" className="input" required maxLength={50} value={form.serie} onChange={e=>change('serie',e.target.value)}/></label>
        <label className="field">Modelo<input id="asset-model" className="input" value={identity.modelo} readOnly aria-describedby="asset-identity-help"/></label>
        <label className="field">Marca<input id="asset-brand" className="input" value={identity.marca} readOnly aria-describedby="asset-identity-help"/></label>
        <label className="field">Origen<input id="asset-origin" className="input" required maxLength={80} placeholder="Compra, transferencia…" value={form.origen} onChange={e=>change('origen',e.target.value)}/></label>
        <label className="field">Fecha de ingreso<input className="input" required type="date" value={form.fecha_ingreso} onChange={e=>change('fecha_ingreso',e.target.value)}/></label>
      </div><label className="field">Observación<textarea className="input" rows={2} maxLength={4000} value={form.observacion} onChange={e=>change('observacion',e.target.value)}/></label></fieldset>
      <p id="asset-identity-help" role="status" className="field-hint">{identity.message||"Modelo y marca derivados automáticamente del tipo y serie."}</p><footer className="entry-actions"><p className="field-hint">Registrar no aprueba QA, no recibe físicamente y no instala el equipo.</p><button className="btn" disabled={busy||identity.status!=='valid'}>Registrar en maestro</button></footer>
    </form>
    <form className="panel operation-form asset-search-form" onSubmit={search}>
      <div className="section-heading"><h2 className="section-title"><Search size={19} aria-hidden="true"/>Buscar activo registrado</h2>{!busy&&!error&&(searched||rows.length>0)&&<StatusBadge tone="neutral">{rows.length} resultados</StatusBadge>}</div>
      <fieldset className="form-section entry-fields" disabled={busy}><legend className="sr-only">Buscar activo registrado</legend><div className="asset-search-filters">
        <label className="field">Tipo<select value={type} onChange={e=>{setType(e.target.value as AssetType);setRows([]);selectAsset(null);setSearched(false);}}><option value="VALIDADOR">Validador</option><option value="CONSOLA">Consola</option></select></label>
        <label className="field">Serie<span className="search"><Search size={17} aria-hidden="true"/><input id="asset-search-series" type="search" placeholder="Serie o parte de la serie" value={query} maxLength={50} onChange={e=>setQuery(e.target.value)}/></span></label>
        <button className="btn secondary"><Search size={17} aria-hidden="true"/>Buscar</button>
      </div></fieldset>
      <p className="field-hint">Hasta 30 resultados. Escribe parte de la serie para acotar la búsqueda.</p>
      {!rows.length&&!busy&&!error&&<EmptyState icon={<Search size={24}/>} title={searched?'No hay coincidencias.':'Consulta el maestro de activos'} description={searched?'Revisa el tipo o busca con otra parte de la serie.':'Busca una serie para consultar su información, historial y recepción inicial.'}/>}
      {!!rows.length&&!error&&<div className="table-wrap asset-master-table"><table aria-label="Activos registrados"><thead><tr><th scope="col">Activo</th><th scope="col">Estado / PPU</th><th scope="col">Acción</th></tr></thead><tbody>{rows.map(a=><tr key={`${a.tipo_equipo}:${a.serie}`}>
        <td><strong className="mono-value">{a.serie}</strong><span className="asset-master-secondary">{a.tipo_equipo} · {a.modelo||'Modelo no informado'}</span></td>
        <td><StatusBadge tone={a.estado_actual==='EN_OPERACION'?'success':a.estado_actual==='DISPONIBLE_INSTALACION'?'success':undefined}>{a.estado_actual==='EN_OPERACION'?'En operación':formatOperationalStatus(a.estado_actual)}</StatusBadge><span className="asset-master-secondary">{a.bus_ppu||'Sin bus asociado'}</span></td>
        <td><button type="button" className="btn secondary sm" aria-label={`Ver detalle de ${a.serie}`} disabled={busy} onClick={()=>{selectAsset(a);setError('');}}>Ver detalle</button></td>
      </tr>)}</tbody></table></div>}
    </form>
    </div>
    {selected&&<section ref={detailRef} className="panel operation-section" role="region" aria-labelledby="asset-detail-title">
      <header className="operation-header"><div><span className="dashboard-eyebrow">Detalle del activo</span><h2 id="asset-detail-title">{selected.tipo_equipo} · {selected.serie}</h2></div><button type="button" className="icon-btn" aria-label="Cerrar detalle" title="Cerrar detalle" autoFocus disabled={busy} onClick={()=>selectAsset(null)}><X size={19} aria-hidden="true"/></button></header>
      <div className="asset-detail-body">
      <dl className="asset-detail-grid"><div><dt>Modelo</dt><dd>{selected.modelo||'No informado'}</dd></div><div><dt>Marca</dt><dd>{selected.marca||'No informada'}</dd></div><div><dt>Estado</dt><dd><StatusBadge tone={selected.estado_actual==='EN_OPERACION'?'success':selected.estado_actual==='DISPONIBLE_INSTALACION'?'success':undefined}>{selected.estado_actual==='EN_OPERACION'?'En operación':formatOperationalStatus(selected.estado_actual)}</StatusBadge></dd></div><div><dt>Bus / PPU</dt><dd>{selected.bus_ppu||'Sin bus asociado'}</dd></div></dl>
      <Link className="btn secondary" to={`/trazabilidad?tipo=${selected.tipo_equipo}&serie=${encodeURIComponent(selected.serie)}`}>Ver historial del activo</Link>
      {detailError&&<FeedbackBanner tone="danger">{detailError}</FeedbackBanner>}
      {detailMessage&&<FeedbackBanner tone="success">{detailMessage}</FeedbackBanner>}
      {selected.puede_iniciar_recepcion&&selected.estado_actual==='REGISTRADO'?<form className="asset-reception-form" onSubmit={reception}><fieldset className="form-section entry-fields" disabled={busy}><legend>Recepcionar activo nuevo</legend>
        <p>Valida la presencia del equipo en Bodega mediante escáner físico o ingreso manual autorizado. Esta recepción no es una reparación ni crea una OS.</p>
        <label className="field">Origen de captura<select id="asset-capture" value={capture} onChange={e=>{setCapture(e.target.value as ReceptionCapture);scanner.reset();setReading('');invalidateCapture();setPresent(false);}}><option value="MANUAL">Consulta manual (no habilita recepción)</option><option value="SCANNER">Escáner físico</option>{canAuthorizeManual&&<option value="MANUAL_AUTORIZADO">Ingreso manual autorizado</option>}</select></label>
        <label className="field">{capture==='MANUAL_AUTORIZADO'?'Serie exacta del activo':'Lectura del equipo'}<input id="asset-reading" className="input" value={reading} maxLength={64} readOnly={capture==='SCANNER'} inputMode={capture==='SCANNER'?'none':'text'} autoComplete="off" onPaste={e=>{if(capture==='SCANNER'){e.preventDefault();scanner.reset();invalidateCapture();}}} onChange={e=>{setReading(e.target.value);invalidateCapture();}} onKeyDown={e=>{if(capture==='SCANNER'){scanner.onKeyDown(e);return;}if(e.key==='Enter'){e.preventDefault();void validate();}}}/></label>
        {capture==='MANUAL_AUTORIZADO'&&<label className="check-row"><input id="asset-present" type="checkbox" checked={present} onChange={e=>{setPresent(e.target.checked);invalidateCapture();}}/> Confirmo que tengo físicamente este equipo en Bodega y verifiqué su identidad.</label>}
        <button type="button" className="btn secondary" disabled={busy||capture==='SCANNER'||!reading.trim()||(capture==='MANUAL_AUTORIZADO'&&(!present||!canAuthorizeManual))} onClick={()=>void validate()}>Validar lectura</button>
        <FeedbackBanner tone={scanId||validationId?'success':'warning'}>{scanId?'✓ Escaneado en Bodega':validationId?'✓ Ingreso manual autorizado validado (MANUAL_AUTORIZADO)':'⚠ Pendiente de captura válida en Bodega'}</FeedbackBanner>
        <label className="check-row"><input id="asset-conforme" type="checkbox" checked={conforme} onChange={e=>setConforme(e.target.checked)}/> Verifiqué identidad, integridad y conformidad inicial del activo.</label>
        <label className="field">Observación de recepción<textarea className="input" value={note} maxLength={4000} onChange={e=>setNote(e.target.value)}/></label>
        <button className="btn" disabled={busy||(!scanId&&!validationId)||!conforme}>Confirmar recepción inicial</button>
      </fieldset></form>:<p>{selected.estado_actual==='DISPONIBLE_INSTALACION'?'Disponible en Bodega para despacho por escaneo.':`Continúa su circuito${selected.ultima_os?' de '+selected.ultima_os:''}.`}</p>}
      <footer className="entry-actions"><Link className="btn ghost" to="/bodega/modulos">Inventario de equipos</Link><Link className="btn ghost" to="/bodega/despacho">Despacho por escaneo</Link></footer>
      </div>
    </section>}
  </div>;
}
