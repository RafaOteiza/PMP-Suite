import {sheetsReport,reportSheet,summarySheet} from '../utils/pageReports';
import {resultOptions,diagnosisOptions} from '../utils/labTechnicalWork';
import {can,PERMISSIONS} from '../app/rbac';
import {useEffect,useRef,useState} from 'react';
import {Link,useBlocker,useLocation,useNavigate,useOutletContext,useParams} from 'react-router-dom';
import {Microscope} from 'lucide-react';
import type {Me} from '../api/me';
import {getQaWork,qaCommand,validateQaPhysical,qaStages,qaPaths,type QaDetail,type QaTest} from '../api/qa';
import {getApiErrorMessage} from '../api/errors';
import PageHeader from '../components/ui/PageHeader';
import StatusBadge from '../components/ui/StatusBadge';
import FeedbackBanner from '../components/ui/FeedbackBanner';
import InlineFeedback from '../components/InlineFeedback';
import {scannerProof,type ScannerProof} from '../utils/receiptScanner';
import {formatDateTime} from '../utils/formatters';
import {eventTitle,captureLabel} from '../utils/traceabilityPresentation';

type Request={action:string;body:Record<string,unknown>;message:string};
type Draft={revision:string|null;observation:string;method:QaTest['metodo'];result:QaTest['resultado'];testNote:string;testId:string|null;verdict:string;reason:string;capture:string;code:string;motive:string;request:Request|null};
const stages=['RECEPCION','AMBIENTE','PRUEBAS','DESPACHO'] as const;
const resultLabel=(v:string)=>v==='APROBADA'?'Aprobada':v==='RECHAZADA'?'Rechazada':'Pendiente';
export default function QaWorkPage(){
 const {osId,step}=useParams(),me=useOutletContext<Me|null>(),location=useLocation(),navigate=useNavigate();
 const historicalCycle=step==='detalle'?new URLSearchParams(location.search).get('ciclo'):null;
 const from=location.state?.from,back=typeof from==='string'&&(from==='/mi-jornada'||from==='/qa'||from.startsWith('/qa?')||from.startsWith('/mi-jornada?'))?from:'/qa';
 const [data,setData]=useState<QaDetail|null>(null),[error,setError]=useState(''),[notice,setNotice]=useState(''),[physicalError,setPhysicalError]=useState(''),[success,setSuccess]=useState(''),[busy,setBusy]=useState(false);
 const [observation,setObservation]=useState(''),[method,setMethod]=useState<QaTest['metodo']>(''),[result,setResult]=useState<QaTest['resultado']>('PENDIENTE'),[testNote,setTestNote]=useState(''),[testId,setTestId]=useState<string|null>(null);
 const [verdict,setVerdict]=useState(''),[reason,setReason]=useState(''),[confirmed,setConfirmed]=useState(false);
 const [capture,setCapture]=useState('SCANNER'),[code,setCode]=useState(''),[present,setPresent]=useState(false),[motive,setMotive]=useState('');
 const [validation,setValidation]=useState<{coincide:boolean;validacion_id:string|null;encontrado:{serie:string}}|null>(null);
 const [pending,setPending]=useState<Request|null>(null),[recovery,setRecovery]=useState<Draft|null>(null),[storageError,setStorageError]=useState(false);
 const buffer=useRef<number[]>([]),working=useRef(false),readInput=useRef<HTMLInputElement>(null),allowNavigation=useRef(false);
 const storageKey=data?`pmp:qa-draft:${me?.id}:${data.codigo_os}:${data.ciclo_qa||'legacy'}`:null;
 const w=data?.trabajo,owner=me?.rol==='qa'&&w?.responsable?.id===String(me.id),current=!!data&&qaPaths[data.etapa]===step;
 const canWrite=can(me,PERMISSIONS.QA_WRITE),canOperate=canWrite&&me?.rol==='qa'&&current;
 const physical=current&&['recepcion','despacho'].includes(step||'');
 const hasTest=!!(method||testNote||testId||result!=='PENDIENTE');
 const dirty=!!data&&(observation!==w?.ambiente.observacion||hasTest||!!verdict||!!reason||!!code||!!motive);
 const blocker=useBlocker(({currentLocation,nextLocation})=>!allowNavigation.current&&(busy||dirty||!!pending||!!recovery)&&(currentLocation.pathname!==nextLocation.pathname||currentLocation.search!==nextLocation.search));
 const locked=busy||!!pending||!!recovery;
 const clearTest=()=>{setMethod('');setResult('PENDIENTE');setTestNote('');setTestId(null);};
 const restore=(d:Draft)=>{setObservation(d.observation);setMethod(d.method);setResult(d.result);setTestNote(d.testNote);setTestId(d.testId);setVerdict(d.verdict);setReason(d.reason);setCapture(d.capture);setCode(d.code);setMotive(d.motive);setPending(d.request);setError(d.request?'Hay una solicitud sin respuesta confirmada. Reinténtala para consultar su resultado sin duplicarla.':'');setRecovery(null);};
 useEffect(()=>{
  let active=true;setData(null);setError('');setSuccess('');clearTest();setVerdict('');setReason('');setPending(null);setRecovery(null);allowNavigation.current=false;
  getQaWork(osId!,historicalCycle).then(next=>{if(!active)return;setData(next);setObservation(next.trabajo.ambiente.observacion);
   if(!historicalCycle&&me?.rol==='qa')try{const saved=sessionStorage.getItem(`pmp:qa-draft:${me.id}:${next.codigo_os}:${next.ciclo_qa||'legacy'}`);if(saved){const draft=JSON.parse(saved) as Draft;setRecovery(draft);}}catch{setStorageError(true);}
  }).catch(e=>{if(active)setError(getApiErrorMessage(e,'No se pudo consultar el trabajo QA.'));});return()=>{active=false;};
 },[osId,historicalCycle,me?.id]);
 useEffect(()=>{setCapture('SCANNER');setValidation(null);setCode('');setConfirmed(false);setPresent(false);setMotive('');setPhysicalError('');buffer.current=[];},[osId,step]);
 useEffect(()=>{
  if(!storageKey||!data||historicalCycle||recovery)return;
  try{if(dirty||pending)sessionStorage.setItem(storageKey,JSON.stringify({revision:data.revision,observation,method,result,testNote,testId,verdict,reason,capture,code,motive,request:pending} satisfies Draft));else sessionStorage.removeItem(storageKey);}catch{setStorageError(true);}
 },[storageKey,data,dirty,pending,recovery,observation,method,result,testNote,testId,verdict,reason,capture,code,motive,historicalCycle]);
 const run=async(action:string,payload:Record<string,unknown>={},message='Guardado.',retry?:Request)=>{
  if(!data||working.current)return;working.current=true;setBusy(true);setError('');setNotice('');setSuccess('');
  const request=retry||{action,body:{...payload,ciclo_qa:data.ciclo_qa||'legacy',revision:data.revision,request_id:crypto.randomUUID()},message};
  setPending(request);
  try{
   const response=await qaCommand(data.codigo_os,request.action,request.body);
   // A confirmed command stays successful even if the following read fails.
   let next:QaDetail={...data,revision:response.revision,trabajo:response.trabajo,etapa:response.trabajo.etapa,estado_operacional:qaStages[response.trabajo.etapa as keyof typeof qaStages]};
   try{next=await getQaWork(data.codigo_os);}catch{setNotice('La acción quedó guardada; no se pudo actualizar la consulta.');}
   setData(next);setObservation(next.trabajo.ambiente.observacion);setSuccess(request.message);setConfirmed(false);setValidation(null);setPending(null);setCode('');setMotive('');setPresent(false);
   if(['prueba','dictamen'].includes(request.action))clearTest();
   if(request.action==='dictamen'){setVerdict('');setReason('');}
   try{if(storageKey)sessionStorage.removeItem(storageKey);}catch{setStorageError(true);}
   if(qaPaths[next.etapa]!==step){allowNavigation.current=true;navigate(`/qa/${encodeURIComponent(next.codigo_os)}/${qaPaths[next.etapa]}`,{replace:true,state:{from:back}});}
   window.dispatchEvent(new Event('pmp:warehouse-queue-updated'));
  }catch(e){
   const status=(e as {response?:{status:number}})?.response?.status;
   if(status&&status<500){setPending(null);if(physical)setValidation(null);}
   setError(getApiErrorMessage(e,'No se pudo confirmar el guardado. Reintenta la misma solicitud sin duplicarla.'));
  }finally{setBusy(false);working.current=false;allowNavigation.current=false;}
 };
 const validate=async(proof?:ScannerProof)=>{
  if(!data||working.current)return;setValidation(null);setPhysicalError('');setError('');
  if(capture==='SCANNER'&&!proof){setPhysicalError('Usa una lectura continua del escáner terminada en Enter o selecciona No puedo escanear.');return;}
  working.current=true;setBusy(true);
  try{setValidation(await validateQaPhysical(data.codigo_os,step!,{tipo_equipo:data.tipo_equipo,codigo:code,origen_captura:capture,presencia_fisica:present,motivo:motive,lectura_scanner:proof}));}
  catch(e){setPhysicalError(getApiErrorMessage(e,'No fue posible validar la identidad.'));}finally{setBusy(false);working.current=false;buffer.current=[];}
 };
 const datum=(label:string,value?:string|null)=>value?<div key={label}><dt>{label}</dt><dd>{value}</dd></div>:null;
 const testPayload={prueba_id:testId,metodo:method,resultado:result,observacion:testNote};
 const proposed=[...(w?.pruebas||[]).filter(t=>t.id!==testId),...(hasTest?[testPayload]:[])];
 const latest=Object.values(Object.fromEntries(proposed.map(t=>[t.metodo,t])));
 const hint=!verdict?'Selecciona el dictamen final.':!proposed.some(t=>t.metodo&&t.resultado!=='PENDIENTE')?'Completa al menos una evaluación QA.':hasTest&&!method&&result!=='PENDIENTE'?'Selecciona el método de la prueba.':verdict==='OPERATIVO'&&proposed.some(t=>!t.metodo||t.resultado==='PENDIENTE')?'Completa las pruebas pendientes para emitir Operativo.':verdict==='OPERATIVO'&&latest.some(t=>t.resultado!=='APROBADA')?'El último intento de cada método debe estar aprobado.':verdict==='RECHAZADO'&&!reason.trim()?'Indica el motivo técnico del rechazo.':'';
 const testActions=canOperate&&owner&&!w?.dictamen&&w?.pruebas.some(t=>t.resultado==='PENDIENTE');
 const tests=<>{!w?.pruebas.length?<p className="muted">Sin pruebas QA registradas.</p>:<div className="table-wrap withdrawal-table-wrap"><table className="withdrawal-table"><thead><tr><th>Método</th><th>Resultado</th><th>Observación</th><th>Autor / Fecha</th>{testActions&&<th>Acción</th>}</tr></thead><tbody>{w.pruebas.map(t=><tr key={t.id}><td data-label="Método">{t.metodo||'Sin seleccionar'}</td><td data-label="Resultado"><StatusBadge tone={t.resultado==='APROBADA'?'success':t.resultado==='RECHAZADA'?'danger':t.resultado==='PENDIENTE'?'warning':'neutral'}>{resultLabel(t.resultado)}</StatusBadge></td><td data-label="Observación">{t.observacion||'—'}</td><td data-label="Autor / Fecha">{t.autor.nombre}<span className="withdrawal-secondary">{formatDateTime(t.fecha)}</span></td>{testActions&&<td data-label="Acción">{t.resultado==='PENDIENTE'&&<button className="btn ghost sm" disabled={locked||hasTest} onClick={()=>{setTestId(t.id);setMethod(t.metodo);setResult(t.resultado);setTestNote(t.observacion);}}>Continuar prueba</button>}</td>}</tr>)}</tbody></table></div>}</>;
 return <div className="page warehouse-flow qa-work"><PageHeader report={sheetsReport('Detalle QA',[reportSheet('Equipo',data?[data]:[]),summarySheet('Trabajo registrado',w),reportSheet('Pruebas registradas',w?.pruebas||[])],!data||busy||!!error,{OS:osId,ciclo:historicalCycle||'Vigente'})} eyebrow="Calidad" title={osId||'Trabajo QA'} icon={<Microscope size={21}/>} actions={<Link className="btn ghost" to={back}>Volver a la bandeja</Link>}/>
 <InlineFeedback isOpen={blocker.state==='blocked'} type="confirm" title={busy?'Operación en curso':'Cambios sin guardar'} message={busy?'Espera la respuesta antes de salir.':'Puedes continuar aquí o salir conservando un borrador local en este navegador. No se confirmará ninguna operación.'} onCancel={()=>blocker.state==='blocked'&&blocker.reset()} onConfirm={()=>{if(!busy&&!storageError&&blocker.state==='blocked')blocker.proceed();}} confirmText={busy?'Esperar respuesta':storageError?'No se pudo conservar el borrador':'Salir y conservar borrador'} cancelText="Seguir aquí"/>
 {error&&<FeedbackBanner tone="danger">{error}{pending&&!busy&&<button className="btn secondary" onClick={()=>void run(pending.action,{},pending.message,pending)}>Reintentar solicitud</button>}{!pending&&!busy&&data&&<button className="btn ghost" onClick={()=>void getQaWork(data.codigo_os).then(next=>{setData(next);setError('Consulta actualizada. Revisa el avance antes de volver a guardar.');}).catch(()=>setError('No se pudo actualizar la consulta.'))}>Actualizar consulta sin descartar avance</button>}</FeedbackBanner>}
 {notice&&<FeedbackBanner tone="warning">{notice}</FeedbackBanner>}
 <p className="small muted" role="status" aria-live="polite">{busy?'Guardando…':error?'No se pudo completar la solicitud':dirty||pending?'Cambios sin guardar':success}</p>
 {storageError&&<FeedbackBanner tone="warning">No se pudo conservar el borrador local. Permanece aquí hasta guardar el avance.</FeedbackBanner>}
 {recovery&&<FeedbackBanner tone="warning">Hay un borrador local sin confirmar.{recovery.revision!==data?.revision&&' El servidor tiene otra revisión: revisa el trabajo vigente antes de recuperarlo.'}<div className="operation-actions"><button className="btn secondary" onClick={()=>restore(recovery)}>Recuperar borrador</button><button className="btn ghost" onClick={()=>{setRecovery(null);if(storageKey)sessionStorage.removeItem(storageKey);}}>Descartar borrador local</button></div></FeedbackBanner>}
 {!data||!w?<p role="status">Cargando trabajo QA…</p>:<>
 <section className="qa-identity" aria-label="Equipo seleccionado"><strong>{data.tipo_equipo} · {data.serie}</strong><span>{[data.modelo,data.marca].filter(Boolean).join(' · ')}</span><StatusBadge tone="flow">{qaStages[data.etapa]}</StatusBadge>{w.responsable&&<span>Responsable: {w.responsable.nombre}</span>}</section>
 <ol className="qa-progress" aria-label="Progreso QA">{stages.map((stage,i)=><li key={stage} aria-current={data.etapa===stage?'step':undefined}><span>{i+1}</span>{qaStages[stage]}</li>)}</ol>
 {!current&&<FeedbackBanner tone="info">La etapa vigente cambió. <Link to={`/qa/${encodeURIComponent(data.codigo_os)}/${qaPaths[data.etapa]}`} state={{from:back}}>Abrir etapa actual</Link></FeedbackBanner>}
 {data.etapa==='POR_VERIFICAR'&&<FeedbackBanner tone="warning">No hay evidencia suficiente para operar este ciclo. La consulta no regulariza ni fabrica movimientos.</FeedbackBanner>}
 {w.responsable&&!owner&&['AMBIENTE','PRUEBAS'].includes(data.etapa)&&<FeedbackBanner tone="info">En atención por {w.responsable.nombre}. Los antecedentes se muestran en modo consulta.</FeedbackBanner>}
 {data.etapa==='AMBIENTE'&&<section className="panel operation-section receipt-body"><h2>Instalación Ambiente</h2><StatusBadge tone="flow">{w.ambiente.estado==='PENDIENTE'?'Pendiente':w.ambiente.estado==='EN_CURSO'?'En curso':'Completada'}</StatusBadge>
 {canOperate&&(!w.responsable||owner)&&w.ambiente.estado==='PENDIENTE'?<><p>{w.responsable?'Iniciarás la preparación del ambiente.':'Al iniciar serás responsable de este trabajo QA.'}</p><button className="btn" disabled={locked} onClick={()=>void run('iniciar',{},'Trabajo QA iniciado.')}>Iniciar trabajo QA</button></>:<><dl className="asset-detail-grid">{datum('Inicio',w.ambiente.inicio?formatDateTime(w.ambiente.inicio):null)}{datum('Finalización',w.ambiente.fin?formatDateTime(w.ambiente.fin):null)}</dl><label className="field">Observación de lo realizado<textarea className="input" value={observation} readOnly={!canOperate||!owner} disabled={locked} maxLength={4000} onChange={e=>{setObservation(e.target.value);setConfirmed(false);}}/></label></>}
 {canOperate&&owner&&w.ambiente.estado==='EN_CURSO'&&<><label className="receipt-presence"><input type="checkbox" checked={confirmed} disabled={locked} onChange={e=>setConfirmed(e.target.checked)}/> Confirmo que Instalación Ambiente está completada</label><div className="operation-actions"><button className="btn secondary" disabled={locked||!dirty} onClick={()=>void run('ambiente-guardar',{observacion:observation})}>Guardar avance</button><button className="btn" disabled={locked||!confirmed} onClick={()=>void run('ambiente-completar',{observacion:observation,confirmacion:true},'Instalación Ambiente completada.')}>Completar Instalación Ambiente</button></div></>}
 </section>}
 {canOperate&&data.etapa==='PRUEBAS'&&!w.responsable&&<section className="panel operation-section"><p>Este ciclo ya completó Ambiente. Toma la evaluación pendiente.</p><button className="btn" disabled={locked} onClick={()=>void run('tomar')}>Tomar evaluación QA</button></section>}
 {data.etapa==='PRUEBAS'&&<section className="panel operation-section receipt-body"><h2>Evaluación QA</h2>
 {canOperate&&owner&&<><h3>{testId?'Continuar prueba pendiente':'Registrar ejecución de prueba'}</h3><div className="qa-test-fields"><label className="field">Método<select value={method} disabled={locked} onChange={e=>setMethod(e.target.value as QaTest['metodo'])}><option value="">Seleccionar método</option><option>Manual</option><option>Test MK</option></select></label><label className="field">Resultado de la prueba<select value={result} disabled={locked} onChange={e=>setResult(e.target.value as QaTest['resultado'])}><option value="PENDIENTE">Pendiente</option><option value="APROBADA">Aprobada</option><option value="RECHAZADA">Rechazada</option></select></label><label className="field">Observación de la prueba<textarea className="input" value={testNote} disabled={locked} maxLength={4000} rows={2} onChange={e=>setTestNote(e.target.value)}/></label></div>
 <div className="qa-test-fields"><label className="field">Dictamen<select value={verdict} disabled={locked} onChange={e=>setVerdict(e.target.value)}><option value="">Seleccionar dictamen</option><option value="OPERATIVO">Operativo</option><option value="RECHAZADO">Rechazado</option></select></label>{verdict==='RECHAZADO'&&<label className="field">Motivo técnico del rechazo (obligatorio)<textarea className="input" value={reason} disabled={locked} maxLength={4000} rows={2} onChange={e=>setReason(e.target.value)}/></label>}</div>
 <p className="small muted" role="status">{hint||`${hasTest?`Se guardará ${method} · ${resultLabel(result)}. `:'Se usarán las pruebas guardadas. '}Dictamen: ${verdict==='OPERATIVO'?'Operativo':'Rechazado'}. El equipo permanece en QA hasta su salida física.`}</p>
 <div className="operation-actions"><button className="btn secondary" disabled={locked||!hasTest||(!method&&result!=='PENDIENTE')} onClick={()=>void run('prueba',testPayload,'Avance guardado. Sin dictamen.')}>Guardar avance</button><button className="btn" disabled={locked||!!hint} onClick={()=>void run('dictamen',{resultado:verdict,motivo:reason,confirmacion:true,...(hasTest?{prueba:testPayload}:{})},'Dictamen registrado.')}>Registrar dictamen</button></div></>}
 {w.pruebas.length>0&&<details><summary>Pruebas guardadas ({w.pruebas.length})</summary>{tests}</details>}
 </section>}
 {w.dictamen&&<section className="qa-identity" aria-label="Dictamen QA"><StatusBadge tone={w.dictamen.resultado==='OPERATIVO'?'success':'danger'}>{w.dictamen.resultado==='OPERATIVO'?'Operativo':'Rechazado'}</StatusBadge><span>{w.dictamen.autor.nombre} · {formatDateTime(w.dictamen.fecha)}</span>{w.dictamen.motivo&&<p>{w.dictamen.motivo}</p>}</section>}
 {physical&&<section className="panel operation-section receipt-body"><h2>{step==='recepcion'?'Recibir equipo en QA':'Salida desde QA'}</h2><p><strong>{step==='recepcion'?'Bodega → QA':'QA → Bodega'}</strong> · {data.tipo_equipo} {data.serie}</p>
 {step==='despacho'&&<p className="small muted">{w.dictamen?.resultado==='OPERATIVO'?'Para instalación después de recepción física en Bodega.':'Retorno a Laboratorio después de recepción física en Bodega.'}</p>}
 {canOperate&&<><label className="field">{capture==='SCANNER'?'Lectura del escáner':'Serie exacta'}<input ref={readInput} className="input" autoFocus autoComplete="off" placeholder={capture==='SCANNER'?'Esperando lectura del escáner…':data.serie} value={code} disabled={locked} onPaste={()=>{buffer.current=[];}} onChange={e=>{setCode(e.target.value);setValidation(null);setPhysicalError('');}} onKeyDown={e=>{if(capture!=='SCANNER')return;if(e.key==='Enter'){e.preventDefault();const proof=scannerProof(code,buffer.current,performance.now());void validate(proof||undefined);buffer.current=[];}else if(e.key.length===1&&!e.repeat){buffer.current.push(performance.now());}else if(['Backspace','Delete'].includes(e.key)){buffer.current=[];}}}/></label>
 {capture==='SCANNER'?<button className="btn ghost" disabled={locked} onClick={()=>{setCapture('MANUAL_AUTORIZADO');setValidation(null);setCode('');setPhysicalError('');buffer.current=[];readInput.current?.focus();}}>No puedo escanear</button>:<><p className="small muted">Ingreso manual autorizado</p><label className="field">Motivo de ingreso manual<textarea className="input" value={motive} disabled={locked} rows={2} maxLength={1000} onChange={e=>{setMotive(e.target.value);setValidation(null);}}/></label><label className="receipt-presence"><input type="checkbox" checked={present} disabled={locked} onChange={e=>{setPresent(e.target.checked);setValidation(null);}}/> Confirmo presencia física del equipo en QA</label><div className="operation-actions"><button className="btn secondary" disabled={locked||!present||!motive.trim()||!code.trim()} onClick={()=>void validate()}>Validar identidad</button><button className="btn ghost" disabled={locked} onClick={()=>{setCapture('SCANNER');setCode('');setMotive('');setPresent(false);setValidation(null);setPhysicalError('');buffer.current=[];readInput.current?.focus();}}>Usar escáner</button></div></>}
 {physicalError&&<FeedbackBanner tone="danger">{physicalError}</FeedbackBanner>}
 {validation&&<FeedbackBanner tone={validation.coincide?'success':'danger'}>{validation.coincide?`Equipo validado · Serie ${validation.encontrado.serie}. Coincide con ${data.codigo_os}.`:`Equipo distinto al esperado. Esperado: ${data.serie}. Encontrado: ${validation.encontrado.serie}.`}</FeedbackBanner>}
 <div className="operation-actions"><button className="btn" disabled={locked||!validation?.coincide} onClick={()=>void run(step!,{validacion_id:validation!.validacion_id,confirmacion:true},step==='recepcion'?'Equipo recibido en QA.':'Salida confirmada. En tránsito hacia Bodega.')}>{step==='recepcion'?'Recibir equipo':'Confirmar salida a Bodega'}</button></div></>}
 </section>}
 <details className="panel operation-section"><summary>Detalles del equipo</summary><dl className="asset-detail-grid">{datum('Tipo',data.tipo_equipo)}{datum('Serie',data.serie)}{datum('Modelo',data.modelo)}{datum('Marca',data.marca)}{datum('PPU de origen',data.bus_ppu)}{datum('Terminal',data.terminal)}{datum('Operador',data.operador)}{datum('Referencia AR',data.referencia_ar)}{datum('Falla reportada',data.falla)}{datum('Técnico de Laboratorio',data.tecnico_reparador)}{datum('Envío Bodega → QA',data.fecha_envio_qa?formatDateTime(data.fecha_envio_qa):null)}{datum('Recepción física QA',data.fecha_recepcion_qa?formatDateTime(data.fecha_recepcion_qa):null)}{datum('Receptor',w.receptor?.nombre)}</dl>{data.fecha_recepcion_qa&&<p className="small muted">Tiempo desde recepción: {Math.max(0,Math.floor((Date.now()-Date.parse(data.fecha_recepcion_qa))/3600000))} h.</p>}</details>
 {data.antecedentes_laboratorio&&<details className="panel operation-section"><summary>Antecedentes de Laboratorio · solo lectura</summary><p>{data.antecedentes_laboratorio.autor} · {formatDateTime(data.antecedentes_laboratorio.fecha)}</p><dl className="asset-detail-grid">
 {datum('Diagnóstico',diagnosisOptions.find(([v])=>v===data.antecedentes_laboratorio?.metadata.trabajo?.diagnostico.resultado)?.[1])}{datum('Falla diagnosticada',data.antecedentes_laboratorio.metadata.trabajo?.diagnostico.falla_real)}{datum('Observación',data.antecedentes_laboratorio.metadata.trabajo?.diagnostico.observacion)}{datum('Intervención',data.antecedentes_laboratorio.metadata.trabajo?.acciones.join(' · '))}{datum('Resultado',resultOptions.find(([v])=>v===data.antecedentes_laboratorio?.metadata.trabajo?.resultado)?.[1])}{datum('Observaciones para QA',data.antecedentes_laboratorio.metadata.trabajo?.observaciones_qa)}</dl>
 {data.antecedentes_laboratorio.metadata.trabajo?.pruebas.map((t,i)=><p key={i}>{t.nombre} · {t.resultado==='APROBADA'?'Aprobada':t.resultado==='RECHAZADA'?'Rechazada':'Pendiente'} · {t.observacion}</p>)}<p className="small muted">Estos resultados no sustituyen la evaluación QA.</p></details>}

 {['DESPACHO','HISTORIAL'].includes(data.etapa)&&<details className="panel operation-section"><summary>Evaluación QA registrada</summary>{tests}</details>}
 <details className="panel operation-section"><summary>Historial · hitos principales</summary>{data.historial.filter(e=>['RECEPCION_QA_CONFIRMADA','QA_TRABAJO_TOMADO','QA_AMBIENTE_INICIADO','QA_AMBIENTE_COMPLETADO','QA_DICTAMEN_CONFIRMADO','SALIDA_QA_BODEGA'].includes(e.tipo)).map(e=><p key={e.id}>{eventTitle({id:e.id,tipo:e.tipo,fecha:e.fecha})}<span className="withdrawal-secondary">{formatDateTime(e.fecha)} · {e.autor}</span></p>)}
 <details className="panel operation-section"><summary>Historial y auditoría</summary>{data.historial.filter(e=>e.tipo!=='LAB_REPARACION_FINALIZADA').map(e=><details key={e.id} className="operation-section"><summary>{eventTitle({id:e.id,tipo:e.tipo,fecha:e.fecha})} · {formatDateTime(e.fecha)}</summary><p>{e.autor}</p>{e.metadata.origen_captura&&<p>{captureLabel(e.metadata.origen_captura)} · Código leído: {e.metadata.codigo_leido}</p>}{e.metadata.motivo&&<p>{e.metadata.motivo}</p>}{e.metadata.trabajo&&<><p>Responsable: {e.metadata.trabajo.responsable?.nombre||'Sin tomar'}</p><p>Instalación Ambiente: {e.metadata.trabajo.ambiente.observacion}</p>{e.metadata.trabajo.pruebas.map(t=><p key={t.id}>{t.metodo||'Sin seleccionar'} · {t.resultado==='APROBADA'?'Aprobada':t.resultado==='RECHAZADA'?'Rechazada':'Pendiente'} · {t.observacion}</p>)}{e.metadata.trabajo.dictamen&&<p>{e.metadata.trabajo.dictamen.resultado==='OPERATIVO'?'Operativo':'Rechazado'} · {e.metadata.trabajo.dictamen.motivo}</p>}</>}</details>)}</details></details>
 </>}
 </div>;
}
