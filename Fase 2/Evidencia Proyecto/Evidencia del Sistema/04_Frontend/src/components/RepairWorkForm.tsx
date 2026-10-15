import type {QaWork} from '../api/qa';
import {useEffect,useId,useRef,useState} from 'react';
import {CheckCircle,Clock,PlayCircle,Plus,Save} from 'lucide-react';
import {api} from '../api/http';
import {moveTicket} from '../api/lab';
import {getApiErrorMessage} from '../api/errors';
import {ACCIONES_REPARACION,FALLAS_CONSOLA,FALLAS_VALIDADOR} from '../data/fallas';
import {emptyWork,closureIssues,diagnosisOptions,resultOptions,podOptions,TEST_METHODS,type TechnicalWork} from '../utils/labTechnicalWork';
import FeedbackBanner from './ui/FeedbackBanner';
import StatusBadge from './ui/StatusBadge';

interface Props {os:string;fallaReportada?:string;initialState:number;tipoEquipo?:string;serie?:string;tecnico?:string;modelo?:string;referenciaAr?:string;onStarted:()=>void;onWaiting?:()=>void;onSuccess:()=>void;}
interface PartRequest {id:number;repuesto_solicitado:string;comentario:string;estado:string;}
interface Snapshot {antecedentes_qa?:{ciclo?:string;fecha:string;autor:string;trabajo:QaWork;evidencias?:{fecha:string;metodo:string;codigo_leido:string;proposito:string;motivo:string}[]}|null;revision:string|null;trabajo:TechnicalWork|null;guardado_en?:string;pod_contexto?:TechnicalWork['pod']&{origen:string};solicitudes?:PartRequest[];legado?:{pruebas:TechnicalWork['pruebas'];tiene_repuestos:boolean};}
export default function RepairWorkForm({os,initialState,tipoEquipo,serie,tecnico,modelo,referenciaAr,onStarted,onWaiting,onSuccess}:Props){
 const uid=useId(),id=(name:string)=>uid+name;
 const [stage,setStage]=useState(initialState),[work,setWork]=useState(emptyWork);
 const [revision,setRevision]=useState<string|null>(null),[loaded,setLoaded]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [needsPart,setNeedsPart]=useState(false),[need,setNeed]=useState(''),[reason,setReason]=useState('');
 const [qaReturn,setQaReturn]=useState<Snapshot['antecedentes_qa']>(null);
 const [podContext,setPodContext]=useState<Snapshot['pod_contexto']>(undefined),[requests,setRequests]=useState<PartRequest[]>([]),[legacy,setLegacy]=useState<Snapshot['legado']>();
 const guard=useRef(false),errorRef=useRef<HTMLDivElement|null>(null);
 useEffect(()=>{if(error){errorRef.current?.scrollIntoView({block:"center"});errorRef.current?.focus({preventScroll:true});}},[error]);
 const type=tipoEquipo||(os.startsWith('MV')||os.startsWith('PDV')?'VALIDADOR':'CONSOLA');
 const failures=type==='VALIDADOR'?FALLAS_VALIDADOR:FALLAS_CONSOLA;
 useEffect(()=>{let active=true;
  api.get<Snapshot>('/api/lab/work/'+encodeURIComponent(os)).then(s=>{
   if(!active)return;setRevision(s.data.revision);setPodContext(s.data.pod_contexto);setRequests(s.data.solicitudes||[]);setLegacy(s.data.legado);setQaReturn(s.data.antecedentes_qa);
   const restored=s.data.trabajo||emptyWork();
   if(s.data.pod_contexto&&!restored.pod.categoria)restored.pod={...s.data.pod_contexto};
   setWork(restored);
   if(s.data.trabajo)setNotice('Avance recuperado');setLoaded(true);
  }).catch(e=>{if(active)setError(getApiErrorMessage(e,'No se pudo recuperar el trabajo. Recarga antes de editar.'));});
  return()=>{active=false;};
 },[os]);
 const change=(next:Partial<TechnicalWork>)=>{setWork(w=>({...w,...next}));setNotice('Cambios sin guardar');};
 const diagnosis=(next:Partial<TechnicalWork['diagnostico']>)=>change({diagnostico:{...work.diagnostico,...next}});
 const run=async(action:()=>Promise<void>)=>{if(guard.current)return;guard.current=true;setBusy(true);setError('');setNotice('');try{await action();}catch(e){setError(getApiErrorMessage(e,'No se pudo registrar la operación. El trabajo permanece en pantalla.'));}finally{guard.current=false;setBusy(false);}};
 const save=async()=>{const r=await api.put<Snapshot>('/api/lab/work/'+encodeURIComponent(os),{revision,trabajo:work});setRevision(r.data.revision);setNotice('Avance guardado');return r.data.revision;};
 const photos=async(files:FileList|null)=>{
  if(!files?.length)return;
  await run(async()=>{
   if(work.pod.fotografias.length+files.length>3)throw Error('Adjunta hasta tres fotografías.');
   const added=await Promise.all(Array.from(files).map(file=>new Promise<{origen:string;base64:string;mime:string}>((resolve,reject)=>{
    if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>1024*1024){reject(Error('Usa imágenes JPEG, PNG o WebP de hasta 1 MB.'));return;}
    const reader=new FileReader();reader.onerror=()=>reject(Error('No se pudo leer la fotografía.'));
    reader.onload=()=>resolve({origen:'ARCHIVO',base64:String(reader.result).split(',')[1],mime:file.type});reader.readAsDataURL(file);
   })));
   change({pod:{...work.pod,fotografias:[...work.pod.fotografias,...added]}});
  });
 };
 const pending=requests.some(r=>!['DESPACHADA','RECHAZADA'].includes(r.estado));
 const hasPod=work.diagnostico.resultado==='POD'||!!podContext;
 const requestPod=work.diagnostico.resultado==='POD'?work.pod:podContext;
 const podReady=!!(requestPod?.categoria&&requestPod.observacion.trim()&&requestPod.fotografias.length);
 const issues=closureIssues(work,stage,pending);
 const selectOptions=(items:string[][])=>items.map(([value,label])=><option key={value} value={value}>{label}</option>);
 return <div className="lab-technical-work">
  {error&&<div ref={errorRef} tabIndex={-1}><FeedbackBanner tone="danger">{error}</FeedbackBanner></div>}
  {notice&&<FeedbackBanner tone={notice==='Cambios sin guardar'?'warning':'success'}>{notice}</FeedbackBanner>}
      {qaReturn&&<details className="panel operation-section"><summary>Rechazado por QA — antecedentes de revisión</summary><p>{qaReturn.trabajo.dictamen?.motivo}</p><p>Ciclo QA {qaReturn.ciclo||"histórico"} · {qaReturn.autor} · {new Date(qaReturn.fecha).toLocaleString('es-CL')}</p><p>{qaReturn.trabajo.ambiente.observacion}</p>{qaReturn.trabajo.pruebas.map(t=><p key={t.id}>{t.metodo} · {t.resultado==='APROBADA'?'Aprobada':t.resultado==='RECHAZADA'?'Rechazada':'Pendiente'} · {t.observacion}</p>)}{qaReturn.evidencias?.map((e,i)=><p key={i}>{e.proposito==='recepcion'?'Recepción QA':'Salida QA'} · {e.metodo==='SCANNER'?'Escáner físico':'Ingreso manual autorizado'} · {e.codigo_leido} · {new Date(e.fecha).toLocaleString('es-CL')}{e.motivo?' · '+e.motivo:''}</p>)}<p className="small muted">Antecedentes readonly del ciclo QA anterior; no sustituyen las nuevas pruebas técnicas.</p></details>}
  {!loaded?<p role="status">{error?'No se habilitará edición hasta recuperar el avance.':'Cargando trabajo…'}</p>:stage===4?
   <section className="panel operation-section repair-start"><Clock size={32}/><h2>Trabajo aún no iniciado</h2><p>Al iniciar, la OS pasará de En diagnóstico a <strong>En reparación</strong>.</p>
    <button className="btn" disabled={busy} onClick={()=>run(async()=>{await moveTicket(os,5);setStage(5);onStarted();})}><PlayCircle size={18}/> Iniciar trabajo</button>
   </section>:
   <>
    {stage===9&&<FeedbackBanner tone="warning">En espera de repuesto. Puedes guardar avances; el cierre queda bloqueado hasta la entrega de Bodega.</FeedbackBanner>}
    <fieldset className="lab-work-fields" disabled={busy}>
     <div className="lab-work-grid">
      <section className="panel operation-section"><h2>Diagnóstico técnico</h2>
       <div className="field"><label className="field-label" htmlFor={id('diagnosis')}>Resultado del diagnóstico</label><select id={id('diagnosis')} value={work.diagnostico.resultado} onChange={e=>diagnosis({resultado:e.target.value})}><option value="">Selecciona diagnóstico</option>{selectOptions(diagnosisOptions)}</select></div>
       {['CONFIRMADA','DIFERENTE'].includes(work.diagnostico.resultado)&&<div className="field"><label className="field-label" htmlFor={id('failure')}>Falla real encontrada</label><select id={id('failure')} value={work.diagnostico.falla_real} onChange={e=>diagnosis({falla_real:e.target.value})}><option value="">Selecciona del catálogo</option>{failures.map(f=><option key={f}>{f}</option>)}</select></div>}
       <div className="field"><label className="field-label" htmlFor={id('diagnosis-note')}>Observación del diagnóstico</label><textarea id={id('diagnosis-note')} maxLength={4000} rows={3} value={work.diagnostico.observacion} onChange={e=>diagnosis({observacion:e.target.value})}/></div>
       {work.diagnostico.resultado==='NFF'&&<p className="muted">NFF requiere observación y pruebas; no exige acciones ni repuestos artificiales.</p>}
       {work.diagnostico.resultado==='POD'&&<div className="repair-form">
        <FeedbackBanner tone="warning">El hallazgo PoD queda asociado a esta OS. No cambia su número ni su tipo.</FeedbackBanner>
        <div className="field"><label className="field-label" htmlFor={id('pod-category')}>Categoría de daño PoD</label><select id={id('pod-category')} value={work.pod.categoria} onChange={e=>change({pod:{...work.pod,categoria:e.target.value}})}><option value="">Selecciona categoría</option>{selectOptions(podOptions)}</select></div>
        <div className="field"><label className="field-label" htmlFor={id('pod-note')}>Observación técnica PoD</label><textarea id={id('pod-note')} maxLength={4000} value={work.pod.observacion} onChange={e=>change({pod:{...work.pod,observacion:e.target.value}})}/></div>
        <div className="field"><label className="field-label" htmlFor={id('photos')}>Evidencia fotográfica PoD</label><input className="input" id={id('photos')} type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={e=>{void photos(e.target.files);e.target.value='';}}/><small>Hasta 3 imágenes de 1 MB. Se registran como archivo adjunto.</small></div>
        <div className="lab-photo-list">{work.pod.fotografias.map((p,i)=><figure key={i}><img src={'data:'+(p.mime||'image/jpeg')+';base64,'+p.base64} alt={'Evidencia PoD '+(i+1)}/><button className="btn ghost" onClick={()=>change({pod:{...work.pod,fotografias:work.pod.fotografias.filter((_,j)=>i!==j)}})}>Quitar foto {i+1}</button></figure>)}</div>
       </div>}
      </section>
      <section className="panel operation-section"><h2>Intervención realizada</h2><div className="action-checks">{ACCIONES_REPARACION.map(a=><label key={a} data-selected={work.acciones.includes(a)}><input type="checkbox" checked={work.acciones.includes(a)} onChange={()=>change({acciones:work.acciones.includes(a)?work.acciones.filter(v=>v!==a):[...work.acciones,a]})}/><span>{a}</span></label>)}</div><p className="muted">Registra las pruebas en su sección independiente.</p></section>
     </div>
     {hasPod&&<section className="panel operation-section lab-request-section">
      <h2>Solicitud a Bodega</h2>

   {podContext&&<p className="muted">Condición PoD registrada en {podContext.origen}: {podContext.observacion}</p>}
      <label className="check-row"><input type="checkbox" checked={needsPart} disabled={stage===9||pending} onChange={e=>setNeedsPart(e.target.checked)}/> Necesito un repuesto para continuar</label>
      {needsPart&&<div className="repair-form" aria-label="Solicitud de repuesto">
       <dl className="asset-detail-grid lab-request-context"><div><dt>OS / Activo</dt><dd>{os} · {type} {serie}</dd></div><div><dt>Modelo / Referencia AR</dt><dd>{modelo||'Sin registro'} · {referenciaAr||'Sin referencia AR'}</dd></div><div><dt>Solicitante</dt><dd>{tecnico||'Técnico asignado'}</dd></div><div><dt>Diagnóstico / PoD</dt><dd>{diagnosisOptions.find(([v])=>v===work.diagnostico.resultado)?.[1]||'Diagnóstico pendiente'} · {requestPod?.observacion}</dd></div></dl>
       <div className="field"><label className="field-label" htmlFor={id('need')}>Repuesto o componente necesario</label><input className="input" id={id('need')} maxLength={200} value={need} onChange={e=>setNeed(e.target.value)}/></div>
       <div className="field"><label className="field-label" htmlFor={id('reason')}>Motivo técnico</label><textarea id={id('reason')} maxLength={2000} value={reason} onChange={e=>setReason(e.target.value)}/></div>
       {!podReady&&<p className="muted">Completa categoría, observación y fotografía PoD antes de solicitar.</p>}
       <p className="muted">Bodega identificará la pieza y cantidad. Se guardará el avance y la OS quedará En espera de repuesto.</p>
       <button className="btn secondary" disabled={!need.trim()||!reason.trim()||!podReady||pending||stage===9} onClick={()=>run(async()=>{
        await save();await api.post('/api/lab/request-part',{codigo_os:os,necesidad:need,motivo:reason});setStage(9);setNeedsPart(false);setNotice('Solicitud enviada. Avance guardado.');onWaiting?.();
        const r=await api.get<Snapshot>('/api/lab/work/'+encodeURIComponent(os));setRequests(r.data.solicitudes||[]);
       })}>Guardar avance y solicitar</button>
      </div>}
     </section>}
     {!!requests.length&&<section className="panel operation-section"><h2>Atención de Bodega</h2><ul>{requests.map(r=><li key={r.id}><strong>{r.repuesto_solicitado}</strong> · <StatusBadge tone={r.estado==='DESPACHADA'?'success':'warning'}>{r.estado==='DESPACHADA'?'Entregada':r.estado==='RECHAZADA'?'Rechazada':'Pendiente de atención'}</StatusBadge><p className="small muted">{r.comentario}</p></li>)}</ul></section>}
     <div className="lab-work-grid">
      <section className="panel operation-section"><h2>Pruebas realizadas</h2><p className="muted">Registra el método utilizado y su resultado. No es necesario realizar ambos métodos.</p>
       {!!legacy?.pruebas.length&&<details><summary>Pruebas de un avance anterior (solo lectura)</summary><ul>{legacy.pruebas.map((t,i)=><li key={i}>{t.nombre} · {t.resultado==='APROBADA'?'Aprobada':t.resultado==='RECHAZADA'?'Rechazada':'Pendiente'} · {t.observacion}</li>)}</ul><p className="muted">Se conservan sin reclasificar. Registra una nueva ejecución con Manual o Test MK para el cierre actual.</p></details>}
       {work.pruebas.length?work.pruebas.map((t,i)=><fieldset className="form-section repair-form" key={i}><legend>Prueba {i+1}</legend>
        <div className="field"><label className="field-label" htmlFor={id('test-'+i)}>Prueba realizada</label><select id={id('test-'+i)} value={t.nombre} onChange={e=>change({pruebas:work.pruebas.map((v,j)=>i===j?{...v,nombre:e.target.value}:v)})}><option value="">Selecciona método</option>{TEST_METHODS.map(method=><option key={method}>{method}</option>)}</select></div>
        <div className="field"><label className="field-label" htmlFor={id('test-result-'+i)}>Resultado de prueba {i+1}</label><select id={id('test-result-'+i)} value={t.resultado} onChange={e=>change({pruebas:work.pruebas.map((v,j)=>i===j?{...v,resultado:e.target.value}:v)})}><option value="">Pendiente</option><option value="APROBADA">Aprobada</option><option value="RECHAZADA">Rechazada</option></select></div>
        <div className="field"><label className="field-label" htmlFor={id('test-note-'+i)}>Observación de prueba {i+1} (opcional)</label><textarea id={id('test-note-'+i)} rows={2} maxLength={1000} value={t.observacion} onChange={e=>change({pruebas:work.pruebas.map((v,j)=>i===j?{...v,observacion:e.target.value}:v)})}/></div>
        <button className="btn ghost" onClick={()=>change({pruebas:work.pruebas.filter((_,j)=>i!==j)})}>Quitar prueba {i+1}</button>
       </fieldset>):<p className="small muted">Todavía no hay pruebas registradas.</p>}
       <button className="btn secondary" disabled={work.pruebas.length>=30} onClick={()=>change({pruebas:[...work.pruebas,{nombre:'',resultado:'',observacion:''}]})}><Plus size={16}/> Agregar prueba</button>
      </section>
      <section className="panel operation-section"><h2>Resultado técnico</h2><div className="field"><label className="field-label" htmlFor={id('result')}>Resultado del trabajo</label><select id={id('result')} value={work.resultado} onChange={e=>change({resultado:e.target.value})}><option value="">Selecciona resultado</option>{selectOptions(resultOptions)}</select></div><p className="muted">El resultado describe el trabajo; no cambia el estado por seleccionarlo.</p>
       <h2>Preparación para QA</h2><div className="field"><label className="field-label" htmlFor={id('qa-note')}>Observaciones técnicas para QA</label><textarea id={id('qa-note')} maxLength={4000} rows={4} value={work.observaciones_qa} onChange={e=>change({observaciones_qa:e.target.value})}/></div>
       <p>El cierre deja el trabajo Listo para QA, pendiente de logística. No confirma salida ni recepción física.</p>
       {!!issues.length&&<div role="status"><strong>Pendiente antes de cerrar</strong><ul>{issues.map(issue=><li key={issue}>{issue}</li>)}</ul></div>}
      </section>
     </div>
     <footer className="panel operation-section lab-work-actions">
      <button className="btn secondary" onClick={()=>run(async()=>{await save();})}><Save size={18}/> Guardar avance</button>
      <button className="btn success" disabled={issues.length>0} onClick={()=>run(async()=>{await api.post('/api/lab/finish',{codigo_os:os,revision,trabajo:work});onSuccess();})}><CheckCircle size={18}/> Finalizar trabajo y preparar envío a QA</button>
     </footer>
    </fieldset>
   </>
  }
 </div>;
}
