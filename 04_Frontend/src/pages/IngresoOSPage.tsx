import {pagedReport} from '../utils/pageReports';
import {useRef,useState,type FormEvent} from 'react';
import {ClipboardList,Search} from 'lucide-react';
import {createOS,searchFieldAssets} from '../api/os';
import type {RequirementAsset} from '../api/requerimientos';
import {getApiErrorMessage} from '../api/errors';
import PageHeader from '../components/ui/PageHeader';
import FeedbackBanner from '../components/ui/FeedbackBanner';
import StatusBadge from '../components/ui/StatusBadge';

export default function IngresoOSPage(){
 const [type,setType]=useState<'VALIDADOR'|'CONSOLA'>('VALIDADOR'),[ppu,setPpu]=useState(''),[series,setSeries]=useState('');
 const [selected,setSelected]=useState<RequirementAsset|null>(null),[rows,setRows]=useState<RequirementAsset[]>([]),[more,setMore]=useState(false),[searched,setSearched]=useState(false);
 const [fault,setFault]=useState(''),[pod,setPod]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[success,setSuccess]=useState('');const revision=useRef(0);
 const clear=()=>{revision.current++;setSelected(null);setRows([]);setPpu('');setSeries('');setMore(false);setSearched(false);setError('');};
 const search=async()=>{const version=++revision.current;setBusy(true);setError('');try{const data=await searchFieldAssets({tipo_equipo:type,q:series,bus_ppu:ppu});if(version===revision.current){setRows(data.items);setMore(data.has_more);setSearched(true);}}catch(e){setError(getApiErrorMessage(e));}finally{setBusy(false);}};
 const select=(asset:RequirementAsset)=>{setSelected(asset);setPpu(asset.bus_ppu||'');setSeries(asset.serie);setRows([]);setError('');};
 const submit=async(e:FormEvent)=>{e.preventDefault();if(!selected||!fault.trim()||busy)return;setBusy(true);setError('');try{const result=await createOS({tipo:type,serie_equipo:selected.serie,bus_ppu:selected.bus_ppu!,terminal_id:selected.terminal_id!,pst_codigo:selected.pst_codigo!,falla:fault.trim(),es_pod:pod});setSuccess(`OS ${result.os.codigo_os} creada. El activo permanece instalado hasta confirmar su retiro físico.`);clear();setFault('');setPod(false);}catch(e){setError(getApiErrorMessage(e));}finally{setBusy(false);}};
 return <div className="page content-narrow"><PageHeader report={pagedReport('Activos operativos','/api/os/activos-operativos',{tipo_equipo:type,q:series,bus_ppu:ppu},busy||!!error)} eyebrow="Operación en terreno" title="Reportar falla" description="Selecciona un activo existente. Su instalación vigente completa el contexto del requerimiento." icon={<ClipboardList size={21}/>}/>
  {error&&<FeedbackBanner tone="danger">{error}</FeedbackBanner>}{success&&<FeedbackBanner tone="success">{success}</FeedbackBanner>}
  <form className="panel operation-form" onSubmit={submit}><fieldset className="form-section" disabled={busy}><legend>Activo en operación</legend>
   <div className="form-grid"><label className="field">Tipo<select value={type} onChange={e=>{clear();setType(e.target.value as typeof type);}}><option value="VALIDADOR">Validador</option><option value="CONSOLA">Consola</option></select></label>
   <label className="field">Bus / PPU<input className="input" value={ppu} readOnly={!!selected} maxLength={6} onChange={e=>{setPpu(e.target.value.toUpperCase());setRows([]);setSearched(false);}}/></label>
   <label className="field">Serie<input className="input" value={series} readOnly={!!selected} maxLength={50} onChange={e=>{setSeries(e.target.value);setRows([]);setSearched(false);}}/></label></div>
   {selected?<><dl className="asset-detail-grid"><div><dt>Modelo</dt><dd>{selected.modelo}</dd></div><div><dt>Marca</dt><dd>{selected.marca}</dd></div><div><dt>Terminal</dt><dd>{selected.terminal||'Pendiente de revisión'}</dd></div><div><dt>Operador</dt><dd>{selected.operador||'Pendiente de revisión'}</dd></div></dl><p className="field-hint">Datos de la instalación vigente · Solo lectura.</p><button type="button" className="btn secondary" onClick={clear}>Cambiar activo o PPU</button></>:<>
   <button type="button" className="btn secondary" onClick={()=>void search()}><Search size={17}/> Buscar activos en operación</button>
   {searched&&!rows.length&&!error&&<p>No hay coincidencias.</p>}
   {!!rows.length&&<div className="table-wrap"><table><thead><tr><th>Equipo</th><th>Instalación</th><th>Acción</th></tr></thead><tbody>{rows.map(a=><tr key={a.serie}><td><strong>{a.serie}</strong><div>{a.modelo} · {a.marca}</div><StatusBadge tone="flow">En operación</StatusBadge></td><td>{a.bus_ppu}<div className="small muted">{a.terminal} · {a.operador}</div></td><td><button type="button" className="btn secondary sm" onClick={()=>select(a)}>Seleccionar</button></td></tr>)}</tbody></table></div>}
   {more&&<p className="field-hint">Completa parte de la serie o PPU para acotar las coincidencias.</p>}</>}
  </fieldset><fieldset className="form-section" disabled={busy}><legend>Falla reportada</legend><label className="field">Descripción técnica<textarea className="input" rows={3} required value={fault} onChange={e=>setFault(e.target.value)}/></label>
   <label className="check-row"><input type="checkbox" checked={pod} onChange={e=>setPod(e.target.checked)}/> Clasificar requerimiento como daño atribuible a tercero (PoD)</label><p className="field-hint">La identidad y evidencia física se confirman durante el retiro en Mobile.</p>
  </fieldset><footer className="entry-actions"><button className="btn" disabled={busy||!selected?.terminal_id||!selected?.pst_codigo||!fault.trim()}>{busy?'Procesando…':'Crear requerimiento'}</button></footer></form>
 </div>;
}
