import {localReport} from '../utils/pageReports';
import { useEffect, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { Link2 } from 'lucide-react';
import type { Me } from '../api/me';
import { assetHistoryUrl, createReference, getReferences, searchAssets, getAssetHistory, type Asset, type AssetHistory, type ExternalReference } from '../api/bridge';
import { getApiErrorMessage } from '../api/errors';
import PageHeader from '../components/ui/PageHeader';
import FeedbackBanner from '../components/ui/FeedbackBanner';
import { formatDate } from '../utils/formatters';

export default function BridgeFlowPage() {
  const me = useOutletContext<Me | null>();
  const [references,setReferences] = useState<ExternalReference[]>([]);
  const [busy,setBusy] = useState(false), [error,setError] = useState(''), [message,setMessage] = useState('');
  const [query,setQuery]=useState(''),[assets,setAssets]=useState<Asset[]>([]),[selected,setSelected]=useState<Asset|null>(null);
  const [orders,setOrders]=useState<AssetHistory['ordenes']>([]),[code,setCode]=useState(''),[searching,setSearching]=useState(false);
  const canLink = me?.rol === 'logistica';
  const load = async () => { try { setReferences(await getReferences()); } catch(e) { setError(getApiErrorMessage(e,'No se pudieron cargar las referencias.')); } };
  useEffect(() => { void load(); },[]);
  useEffect(()=>{
    if(selected||query.trim().length<2){setAssets([]);return;}
    const controller=new AbortController();
    const timer=setTimeout(()=>{setSearching(true);searchAssets(query.trim(),controller.signal).then(setAssets)
      .catch(e=>{if(!controller.signal.aborted)setError(getApiErrorMessage(e,'No se pudo buscar el activo.'));})
      .finally(()=>{if(!controller.signal.aborted)setSearching(false);});},250);
    return()=>{clearTimeout(timer);controller.abort();};
  },[query,selected]);
  useEffect(()=>{
    setOrders([]);setCode('');if(!selected)return;
    const controller=new AbortController();setSearching(true);
    getAssetHistory(selected,controller.signal).then(history=>{setOrders(history.ordenes);if(history.ordenes.length===1)setCode(history.ordenes[0].codigo_os);})
      .catch(e=>{if(!controller.signal.aborted)setError(getApiErrorMessage(e,'No se pudieron consultar las OS del activo.'));})
      .finally(()=>{if(!controller.signal.aborted)setSearching(false);});
    return()=>controller.abort();
  },[selected]);
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const form=event.currentTarget; const data=new FormData(form);
    if(!selected||!orders.some(order=>order.codigo_os===code))return;
    setBusy(true);setError('');setMessage('');
    try {
      await createReference({tipo_equipo:selected.tipo_equipo,serie:selected.serie,
        codigo_os:code,sistema_externo:String(data.get('sistema_externo')).trim(),
        referencia_externa:String(data.get('referencia_externa')).trim(),comentario:String(data.get('comentario') || '').trim()});
      setMessage('Referencia vinculada al historial del activo.');form.reset();setSelected(null);setQuery('');await load();
    } catch(e) { setError(getApiErrorMessage(e,'No se pudo vincular la referencia.')); }
    finally { setBusy(false); }
  };
  return <div className="page">
    <PageHeader report={localReport('Referencias externas',references,busy||!!error)} title="Bridge · Referencias externas" description="Vincula una serie con una OS PMP existente y su referencia en un sistema externo." icon={<Link2 size={21}/>} />
    {error && <FeedbackBanner tone="danger">{error}</FeedbackBanner>}
    {message && <p role="status">{message}</p>}
    {canLink && <form className="panel" onSubmit={submit}><h2>Vincular referencia</h2><div className="form-grid">
      <label className="field">Buscar activo por serie, OS o referencia<input className="input" value={query} readOnly={!!selected} onChange={e=>{setQuery(e.target.value);setError('');}} autoComplete="off" /></label>
      {selected?<><label className="field">Tipo de equipo<input name="tipo_equipo" value={selected.tipo_equipo} readOnly/></label>
        <label className="field">Serie del activo<input name="serie" value={selected.serie} readOnly/></label>
        <label className="field">Modelo / Marca<input value={[selected.modelo,selected.marca].filter(Boolean).join(' · ')||'Sin registro en el maestro'} readOnly/></label>
        <button type="button" className="btn ghost" onClick={()=>{setSelected(null);setQuery('');setError('');}}>Cambiar activo</button></>:
        <div className="request-asset-list" aria-label="Activos encontrados">{assets.slice(0,6).map(asset=><button type="button" className="request-asset-option" key={`${asset.tipo_equipo}:${asset.serie}`} onClick={()=>{setSelected(asset);setQuery(asset.serie);setError('');}}><strong>{asset.serie}</strong><span>{asset.tipo_equipo} · {asset.modelo} · {asset.marca}</span></button>)}</div>}
      {searching&&<p role="status">Consultando…</p>}
      <label className="field">OS PMP existente<select name="codigo_os" value={code} onChange={e=>setCode(e.target.value)} required disabled={!selected||searching}><option value="">{selected&&!orders.length&&!searching?'El activo no tiene OS para vincular':'Selecciona una OS del activo'}</option>{orders.map(order=><option key={order.codigo_os} value={order.codigo_os}>{order.codigo_os}</option>)}</select></label>
      <label className="field">Sistema externo<input className="input" name="sistema_externo" defaultValue="ARANDA" maxLength={50} required /></label>
      <label className="field">Referencia externa (OS Aranda)<input className="input" name="referencia_externa" maxLength={120} required /></label>
      <label className="field">Comentario<textarea className="input" name="comentario" maxLength={3000}/></label>
    </div><button className="btn" disabled={busy||searching||!selected||!code}>{busy?'Vinculando…':'Vincular referencia'}</button></form>}
    <section className="panel"><h2>Referencias vinculadas</h2><div className="table-wrap"><table>
      <thead><tr><th>Serie</th><th>Tipo</th><th>OS PMP</th><th>Sistema</th><th>Referencia externa</th><th>Fecha</th></tr></thead>
      <tbody>{references.map(r=><tr key={r.id}><td><Link to={assetHistoryUrl(r)}>{r.serie}</Link></td><td>{r.tipo_equipo}</td><td>{r.codigo_os}</td><td>{r.sistema_externo}</td><td>{r.referencia_externa}</td><td>{formatDate(r.fecha)}</td></tr>)}</tbody>
    </table></div>{!references.length&&!error&&<p>No hay referencias vinculadas.</p>}</section>
  </div>;
}
