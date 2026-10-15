import {useEffect,useRef,useState,type KeyboardEvent} from 'react';
import {api} from '../api/http';
import {ScanBarcode} from 'lucide-react';
import {receiveInBodega,validateTerrainReceipt,dispatchToLab,validateLabDispatch,dispatchToQa,validateQaDispatch,type BodegaTicket,type WarehouseCapture,type WarehouseEvidence} from '../api/bodega';
import {getApiErrorMessage} from '../api/errors';
import {scannerProof,type ScannerProof} from '../utils/receiptScanner';
import FeedbackBanner from './ui/FeedbackBanner';
import StatusBadge from './ui/StatusBadge';

export default function WarehouseReceptionForm({ticket,role,onReceived,purpose='receipt',labPurpose}:{labPurpose?:'RECEPCION'|'SALIDA';purpose?:'receipt'|'lab'|'qa';ticket:BodegaTicket;role?:string;onReceived:()=>void}){
 const lab=labPurpose?labPurpose==='SALIDA':purpose!=='receipt',qa=!labPurpose&&purpose==='qa';
 const destination=labPurpose?(lab?'Bodega':'Laboratorio'):qa?'QA':'Laboratorio';
 const origin=labPurpose?(lab?'Laboratorio':'Bodega'):ticket.estado_id===11?(ticket.es_aprobado_qa!=null?'QA':'Laboratorio'):'Terreno';
 const facility=labPurpose?'Laboratorio':'Bodega';
 const validateOperation=labPurpose?async(body:Parameters<typeof validateTerrainReceipt>[0])=>(await api.post<WarehouseEvidence>(`/api/lab/custody/${encodeURIComponent(ticket.codigo_os)}/${labPurpose}/validar`,body)).data:qa?validateQaDispatch:lab?validateLabDispatch:validateTerrainReceipt;
 const confirmOperation=labPurpose?async(code:string,body:{validacion_id?:string|number;escaneo_id?:string|number})=>{await api.post(`/api/lab/custody/${encodeURIComponent(code)}/${labPurpose}/confirmar`,body);}:qa?dispatchToQa:lab?dispatchToLab:receiveInBodega;
 const input=useRef<HTMLInputElement>(null);
 const buffer=useRef({code:'',times:[] as number[]}),working=useRef(false);
 const [capture,setCapture]=useState<WarehouseCapture>('SCANNER'),[reading,setReading]=useState(''),[present,setPresent]=useState(false),[reason,setReason]=useState('');
 const [evidence,setEvidence]=useState<WarehouseEvidence|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const manualAllowed=labPurpose?role==='admin':role==='admin'||role==='logistica';
 useEffect(()=>{input.current?.focus();},[capture]);
 const clear=()=>{setEvidence(null);buffer.current={code:'',times:[]};};
 const mode=(value:WarehouseCapture)=>{clear();setCapture(value);setPresent(false);setReading('');setReason('');setError('');};
 const validate=async(code=reading,proof?:ScannerProof)=>{
  if(working.current)return;setEvidence(null);setError('');
  if(capture==='SCANNER'&&!proof){setError('Espera una lectura continua del escáner terminada en Enter. Para digitar utiliza Ingreso manual autorizado.');return;}
  if(capture==='MANUAL_AUTORIZADO'&&(!manualAllowed||!present||code!==ticket.serie||!reason.trim())){setError(`Ingresa la serie exacta, indica el motivo y confirma la presencia física en ${facility}.`);return;}
  working.current=true;setBusy(true);
  try{setEvidence(await validateOperation({codigo_os:ticket.codigo_os,tipo_equipo:ticket.tipo_equipo,codigo:code,origen_captura:capture,presencia_fisica_confirmada:present,motivo:reason,lectura_scanner:proof}));}
  catch(e){setError(getApiErrorMessage(e,'No se pudo validar la captura.'));}
  finally{working.current=false;setBusy(false);}
 };
 const scannerKey=(event:KeyboardEvent<HTMLInputElement>)=>{
  if(capture!=='SCANNER'||working.current)return;
  if(event.key==='Tab'||event.key==='Escape'){buffer.current={code:'',times:[]};return;}
  if(event.key==='Shift')return;
  event.preventDefault();setEvidence(null);
  if(!event.nativeEvent.isTrusted||event.ctrlKey||event.metaKey||event.altKey||event.repeat){clear();setReading('');setError('La digitación y el pegado no constituyen una lectura de escáner. Usa Ingreso manual autorizado.');return;}
  const time=event.timeStamp;
  if(event.key==='Enter'){
   const {code,times}=buffer.current,proof=scannerProof(code,times,time);buffer.current={code:'',times:[]};
   if(!proof){setReading('');setError('Lectura no reconocida como escáner. Vuelve a escanear o utiliza Ingreso manual autorizado.');return;}
   setReading(code);void validate(code,proof);return;
  }
  if(event.key.length!==1){clear();setReading('');return;}
  const current=buffer.current;
  if(current.times.length&&(time-current.times.at(-1)!>80||current.code.length>=64)){current.code='';current.times=[];}
  current.code+=event.key;current.times.push(time);setReading(current.code);
 };
 const ready=Boolean(evidence?.elegible&&evidence.coincide!==false&&(evidence.escaneo?.id||evidence.validacion?.id));
 const receive=async()=>{
  if(working.current||!ready)return;working.current=true;setBusy(true);setError('');
  try{await confirmOperation(ticket.codigo_os,evidence?.validacion?{validacion_id:evidence.validacion.id}:{escaneo_id:evidence!.escaneo!.id});onReceived();}
  catch(e){if((e as {response?:{status:number}}).response?.status===409)setEvidence(null);setError(getApiErrorMessage(e,lab?'No se pudo confirmar el envío.':'No se pudo confirmar la recepción.'));}
  finally{working.current=false;setBusy(false);}
 };
 const datum=(label:string,value?:string)=><div key={label}><dt>{label}</dt><dd>{value||'Sin registro'}</dd></div>;
 return <section role="region" className="panel operation-section receipt-section" aria-labelledby="warehouse-receipt-title">
  <header className="operation-header"><div><h2 id="warehouse-receipt-title">{lab?`Enviar a ${destination}`:`Recepción desde ${origin}`}</h2><p className="muted">{ticket.codigo_os} · {ticket.tipo_equipo}</p><StatusBadge tone="flow">{lab?`En ${facility}`:`En tránsito hacia ${facility}`}</StatusBadge></div></header>
  <div className="asset-detail-body receipt-body">
   <section aria-label="Equipo esperado"><h3>Equipo esperado</h3><dl className="asset-detail-grid">
    {datum('Serie',ticket.serie)}{ticket.modelo&&datum('Modelo',ticket.modelo)}{ticket.marca&&datum('Marca',ticket.marca)}
    {datum('Origen',lab?facility:labPurpose?origin:ticket.estado_id===11?origin:ticket.bus_ppu)}{datum('Destino',lab?destination:facility)}{lab&&ticket.bus_ppu&&datum('PPU origen',ticket.bus_ppu)}{lab&&ticket.falla&&datum('Falla',ticket.falla)}{ticket.terminal&&datum('Terminal',ticket.terminal)}
    {ticket.tecnico_laboratorio&&datum('Técnico de Laboratorio',ticket.tecnico_laboratorio)}{ticket.operador&&datum('Operador',ticket.operador)}{ticket.tecnico_retiro&&datum('Técnico que retiró',ticket.tecnico_retiro)}
    {(ticket.referencia_ar||ticket.codigo_caso)&&datum('Caso / referencia AR',ticket.referencia_ar||ticket.codigo_caso)}
   </dl>{ticket.trabajo_tecnico&&<details><summary>Ver resultado técnico de Laboratorio</summary>
    {ticket.trabajo_tecnico.observaciones_qa&&<p>{ticket.trabajo_tecnico.observaciones_qa}</p>}
    <ul>{ticket.trabajo_tecnico.pruebas?.map((test,i)=><li key={i}>{test.nombre} · {test.resultado==='APROBADA'?'Aprobada':test.resultado==='RECHAZADA'?'Rechazada':'Pendiente'}{test.observacion?' · '+test.observacion:''}</li>)}</ul><p className="muted">El resultado técnico no sustituye la certificación QA.</p>
   </details>}</section>
   {error&&<FeedbackBanner tone="danger">{error}</FeedbackBanner>}
   <form onSubmit={e=>{e.preventDefault();void validate();}}><fieldset disabled={busy} className="form-section">
    <legend>{lab?'Validación física de salida':`Validación física en ${facility}`}</legend>
    <p className="muted">{lab?'Esta salida requiere una nueva validación física. La recepción previa no sustituye la evidencia de despacho.':'Esta recepción requiere una nueva lectura. La evidencia del origen no sustituye la recepción en destino.'}</p>
    <label className="field">Origen de captura<select id="receipt-capture" value={capture} onChange={e=>mode(e.target.value as WarehouseCapture)}>
      <option value="SCANNER">Escáner físico</option>{manualAllowed&&<option value="MANUAL_AUTORIZADO">Ingreso manual autorizado</option>}{!lab&&!labPurpose&&<option value="MANUAL">Consulta manual (sin movimiento)</option>}
    </select></label>
    <label className="field">{capture==='SCANNER'?'Lectura del escáner':capture==='MANUAL_AUTORIZADO'?'Serie exacta':'Consulta por serie o AMID'}
      <input ref={input} autoFocus id="receipt-reading" className="input" value={reading} readOnly={capture==='SCANNER'} inputMode={capture==='SCANNER'?'none':'text'} autoComplete="off" placeholder={capture==='SCANNER'?'Esperando lectura del escáner…':undefined} onKeyDown={scannerKey}
       onPaste={e=>{if(capture==='SCANNER'){e.preventDefault();clear();setReading('');setError('El pegado no es una lectura del escáner. Usa Ingreso manual autorizado.');}}}
       onChange={e=>{clear();if(capture==='SCANNER'){setReading('');setError('Usa el escáner o Ingreso manual autorizado.');return;}setReading(e.target.value);}} maxLength={64}/>
    </label>
    {capture==='SCANNER'?<><p className="small muted"><ScanBarcode size={15}/> Lectura continua con Enter. {lab?'La digitación ordinaria no habilita el envío.':'La digitación ordinaria no habilita recepción.'}</p>{manualAllowed&&<button type="button" className="btn ghost sm" onClick={()=>mode('MANUAL_AUTORIZADO')}>Ingreso manual autorizado</button>}</>:null}
    {capture==='MANUAL_AUTORIZADO'&&<><label className="field">Motivo de ingreso manual<textarea id="receipt-reason" className="input" maxLength={1000} value={reason} onChange={e=>{setReason(e.target.value);clear();}}/></label>
      <label className="receipt-presence"><input id="receipt-present" type="checkbox" checked={present} onChange={e=>{setPresent(e.target.checked);clear();}}/> Confirmo que tengo físicamente este equipo en {facility} y verifiqué su identidad.</label></>}
    {capture!=='SCANNER'&&<button className="btn secondary" disabled={!reading||(capture==='MANUAL_AUTORIZADO'&&(!present||!reason.trim()))}>{lab?'Validar captura de salida':'Validar captura de recepción'}</button>}
   </fieldset></form>
   {ready?<FeedbackBanner tone="success"><strong>✓ Equipo validado</strong><div>Serie detectada: {evidence?.equipo?.serie||ticket.serie}. Coincide con {ticket.codigo_os}.</div></FeedbackBanner>:
    evidence?.coincide===false?<FeedbackBanner tone="warning"><strong>⚠ Equipo distinto al esperado</strong><div>Esperado: {ticket.serie}. Encontrado: {evidence.equipo?.serie||reading}.</div><div>{lab?'Discrepancia registrada. El envío permanece bloqueado.':'Discrepancia registrada. La recepción permanece bloqueada.'}</div></FeedbackBanner>:
    <p role="status" className="muted">{lab?'Pendiente de validación física para salida.':'Pendiente de evidencia válida para esta recepción.'}</p>}
  </div>
  <footer className="operation-actions"><button type="button" className="btn" disabled={busy||!ready} onClick={()=>void receive()}>{busy?'Procesando…':lab?`Confirmar envío a ${destination}`:`Confirmar recepción en ${facility}`}</button></footer>
 </section>;
}
