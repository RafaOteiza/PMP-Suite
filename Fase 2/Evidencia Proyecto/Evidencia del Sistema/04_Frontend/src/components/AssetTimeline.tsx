import type {QaWork} from '../api/qa';
import {diagnosisOptions,resultOptions,type TechnicalWork} from '../utils/labTechnicalWork';
import { ClipboardList, FileText, UserCheck, ScanLine, Truck, PackageCheck, Wrench, ShieldCheck, AlertTriangle, MapPin } from 'lucide-react';
import StatusBadge from './ui/StatusBadge';
import EmptyState from './ui/EmptyState';
import { formatDate, formatTime } from '../utils/formatters';
import { buildTimeline, eventMetadata, eventTitle, historyState, captureLabel, type TimelineEvent } from '../utils/traceabilityPresentation';

function WithdrawalPhotos({detalle}:{detalle?:Record<string,unknown>}){
  const metadata=(detalle?.metadata||detalle) as {pod?:boolean;fotografias?:Array<{base64:string;mime:string}>}|undefined;
  if(!metadata?.fotografias?.length)return null;
  return <details><summary>{metadata.pod&&<StatusBadge tone="warning">PoD detectado</StatusBadge>} Ver evidencia fotográfica ({metadata.fotografias.length})</summary>
    <div className="form-grid">{metadata.fotografias.map((photo,i)=><img key={i} alt={`Evidencia física ${i+1}`} src={`data:image/jpeg;base64,${photo.base64}`} className="trace-evidence-photo" loading="lazy"/>)}</div></details>;
}

function TechnicalDetail({work,parts}:{work?:TechnicalWork|QaWork;parts?:{id:number;nombre:string;cantidad:number}[]}){
 if(!work)return null;
 if('ambiente' in work)return <section aria-label="Detalle del trabajo QA"><dl className="asset-detail-grid">
  <div><dt>Responsable QA</dt><dd>{work.responsable?.nombre||'Sin tomar'}</dd></div><div><dt>Receptor</dt><dd>{work.receptor?.nombre||'Sin registro'}</dd></div><div><dt>Despachador</dt><dd>{work.despachador?.nombre||'Pendiente'}</dd></div>
  <div><dt>Instalación Ambiente</dt><dd>{work.ambiente.estado==='COMPLETADO'?'Completada':work.ambiente.estado==='EN_CURSO'?'En curso':'Pendiente'} · {work.ambiente.observacion}</dd></div>
  {work.dictamen&&<><div><dt>Dictamen</dt><dd>{work.dictamen.resultado==='OPERATIVO'?'Operativo':'Rechazado'} · {work.dictamen.motivo}</dd></div><div><dt>Autor del dictamen</dt><dd>{work.dictamen.autor.nombre} · {formatDate(work.dictamen.fecha)} {formatTime(work.dictamen.fecha)}</dd></div></>}
 </dl><h4>Pruebas QA</h4><ul>{work.pruebas.map(t=><li key={t.id}>{t.metodo||'Sin seleccionar'} · {t.resultado==='APROBADA'?'Aprobada':t.resultado==='RECHAZADA'?'Rechazada':'Pendiente'} · {t.observacion} · {t.autor.nombre}</li>)}</ul></section>;
 return <section aria-label="Detalle del trabajo técnico"><dl className="asset-detail-grid">
  <div><dt>Diagnóstico</dt><dd>{diagnosisOptions.find(([v])=>v===work.diagnostico.resultado)?.[1]||'Pendiente'} · {work.diagnostico.falla_real}</dd></div>
  <div><dt>Observación de diagnóstico</dt><dd>{work.diagnostico.observacion||'Sin observación adicional'}</dd></div>
  <div><dt>Intervención</dt><dd>{work.acciones.join(' · ')||'Sin intervención física registrada'}</dd></div>
  <div><dt>Resultado técnico</dt><dd>{resultOptions.find(([v])=>v===work.resultado)?.[1]||'Pendiente'}</dd></div>
  {work.repuestos&&<div><dt>Repuestos registrados en el cierre histórico</dt><dd>{work.repuestos.map(p=>(parts?.find(v=>v.id===p.id)?.nombre||'ID '+p.id)+' × '+p.cantidad).join(' · ')||'Sin repuestos'}</dd></div>}
  {work.justificacion_repuestos&&<div><dt>Justificación</dt><dd>{work.justificacion_repuestos}</dd></div>}
  <div><dt>Observaciones para QA</dt><dd>{work.observaciones_qa||'Sin observaciones adicionales'}</dd></div>
 </dl><h4>Pruebas técnicas</h4><ul>{work.pruebas.map((t,i)=><li key={i}>{t.nombre||'Sin nombre'} · {t.resultado==='APROBADA'?'Aprobada':t.resultado==='RECHAZADA'?'Rechazada':'Pendiente'}{t.observacion?' · '+t.observacion:''}</li>)}</ul></section>;
}

function eventIcon(type:string){
  if(type.includes('DISCREPANCIA')||type.includes('POD'))return AlertTriangle;
  if(type.includes('VALIDACION')||type.includes('ESCANEO'))return ScanLine;
  if(type==='RETIRO_TERRENO_CONFIRMADO'||type==='SALIDA_BODEGA_LABORATORIO')return Truck;
  if(type.includes('ASIGNAD'))return UserCheck;
  if(type.includes('RECEPCION')||type.includes('RECIBIDO'))return PackageCheck;
  if(type.includes('REPARACION')||type.includes('DIAGNOSTICO'))return Wrench;
  if(type.includes('QA'))return ShieldCheck;
  if(type.includes('INSTALACION'))return MapPin;
  if(type.includes('REQUERIMIENTO'))return ClipboardList;
  return FileText;
}
function TimelineEntry({event:e}:{event:TimelineEvent}){
  const m=eventMetadata(e),withdrawal=e.tipo==='RETIRO_TERRENO_CONFIRMADO',validation=e.tipo==='VALIDACION_IDENTIDAD_RETIRO';
  const qaReturn=e.tipo==='SALIDA_QA_BODEGA';
  const labExit=e.tipo==='SALIDA_BODEGA_LABORATORIO',qaExit=e.tipo==='SALIDA_BODEGA_QA',qaReceipt=e.tipo==='RECEPCION_QA_CONFIRMADA';
  const labReceipt=e.tipo==='RECEPCION_LABORATORIO_CONFIRMADA'||(e.tipo==='UBICACION_FISICA_CONFIRMADA'&&m.estacion==='LABORATORIO');
  const method=m.metodo_validacion?captureLabel(m.metodo_validacion):undefined;
  const Icon=eventIcon(e.tipo);
  return <article className="trace-event">
    <span className="trace-event-marker" aria-hidden="true"><Icon size={15}/></span>
    <details className="trace-event-detail">
      <summary className="trace-entry-summary">
        <time dateTime={e.fecha}>{formatTime(e.fecha)}</time>
        <span className="trace-entry-main">
          <span className="trace-event-heading"><strong>{eventTitle(e)}</strong>
            {labExit||qaExit||qaReturn?<StatusBadge tone="flow">En tránsito</StatusBadge>:withdrawal?<StatusBadge tone="flow">En tránsito</StatusBadge>:validation?<StatusBadge tone={m.coincide?'success':'warning'}>{m.coincide?'Coincide':'Discrepancia'}</StatusBadge>:null}
          </span>
          <span className="trace-event-context">{e.codigo_os||'Activo'}{withdrawal&&m.bus_ppu?' · '+m.bus_ppu+' → Bodega':m.serie?' · Serie '+m.serie:''}</span>
          {labExit&&<span className="trace-secondary">Bodega → Laboratorio · En tránsito{m.usuario_nombre?' · '+m.usuario_nombre:''}</span>}
          {qaExit&&<span className="trace-secondary">Bodega → QA · En tránsito{m.usuario_nombre?' · '+m.usuario_nombre:''}</span>}
          {qaReturn&&<span className="trace-secondary">QA → Bodega · En tránsito · {m.disposicion}</span>}
          {qaReceipt&&<span className="trace-secondary">{m.ubicacion||'Área QA'} · {formatDate(e.fecha)} {formatTime(e.fecha)}</span>}
          {labReceipt&&<span className="trace-secondary">{m.ubicacion||'Laboratorio'} · {formatDate(e.fecha)} {formatTime(e.fecha)}</span>}
          {m.tecnico&&<span className="trace-secondary">{m.tecnico}</span>}
          {(method||typeof m.pod==='boolean')&&<span className="trace-secondary">{[method,typeof m.pod==='boolean'?'PoD: '+(m.pod?'Sí':'No'):null].filter(Boolean).join(' · ')}</span>}
          {e.attempts&&<span className="trace-secondary">{e.attempts.length} {e.attempts.length===1?'validación realizada':'validaciones realizadas'} durante el retiro</span>}
          {!withdrawal&&!validation&&(m.referencia_ar||m.codigo_caso||m.falla_reportada||m.falla)&&<span className="trace-secondary">{[m.referencia_ar||m.codigo_caso,m.falla_reportada||m.falla].filter(Boolean).join(' · ')}</span>}
        </span>
        <span className="btn ghost sm trace-detail-action">Ver detalle</span>
      </summary>
      <div className="trace-event-expanded">
      <p className="trace-secondary">{formatDate(e.fecha)} {formatTime(e.fecha)} · Registro {e.id}{m.usuario_nombre?' · '+m.usuario_nombre:''}</p>
      {e.attempts&&<ol className="trace-attempts" aria-label="Intentos de validación">{e.attempts.map(attempt=>{
        const a=eventMetadata(attempt);
        return <li key={attempt.id}><time dateTime={attempt.fecha}>{formatDate(attempt.fecha)} {formatTime(attempt.fecha)}</time><span>Coincide · {captureLabel(a.metodo_validacion)} · {a.codigo_leido}</span><span className="trace-secondary">Registro {attempt.id}{a.tecnico?' · '+a.tecnico:''}</span></li>;
      })}</ol>}
      {e.comentario&&<p>{labExit?'Envío a Laboratorio confirmado. Bodega → Laboratorio · En tránsito.':e.comentario}</p>}
      {withdrawal?<dl className="asset-detail-grid">
        <div><dt>Origen</dt><dd>Bus {m.bus_ppu}</dd></div><div><dt>Destino</dt><dd>Bodega</dd></div>
        <div><dt>Validación</dt><dd>{method}</dd></div><div><dt>Código leído</dt><dd>{m.codigo_leido}</dd></div>
        <div><dt>Serie esperada / encontrada</dt><dd>{m.esperado?.serie||m.serie} / {m.encontrado?.serie||'Sin registro'}</dd></div>
        <div><dt>Resultado</dt><dd>{m.coincide===true?'Coincide':m.coincide===false?'No coincide':'Sin registro'}</dd></div>
        <div><dt>Estado</dt><dd>Pendiente de retiro → En tránsito hacia Bodega</dd></div>
        {m.terminal&&<div><dt>Terminal</dt><dd>{m.terminal}</dd></div>}
        {m.operador&&<div><dt>Operador</dt><dd>{m.operador}</dd></div>}
        {(m.referencia_ar||m.codigo_caso)&&<div><dt>Caso / referencia AR</dt><dd>{m.referencia_ar||m.codigo_caso}</dd></div>}
        {m.pod&&m.categoria_pod&&<div><dt>Daño PoD</dt><dd>{m.categoria_pod.replaceAll('_',' ').toLowerCase()}</dd></div>}
        {m.motivo_manual&&<div><dt>Motivo de contingencia</dt><dd>{m.motivo_manual.replaceAll('_',' ').toLowerCase()}</dd></div>}
        {m.observacion_manual&&<div><dt>Observación de contingencia</dt><dd>{m.observacion_manual}</dd></div>}
      </dl>:<p>{e.descripcion}</p>}
      {m.origen_captura&&<p>{captureLabel(m.origen_captura)} · Código leído: {m.codigo_leido}</p>}
      <TechnicalDetail work={m.trabajo} parts={m.repuestos}/>
      <WithdrawalPhotos detalle={e.detalle}/>
      {e.cambios?.map(c=><p key={c.campo}><strong>{c.campo}</strong>: {c.campo==='Estado'?historyState(c.anterior):c.anterior} → {c.campo==='Estado'?historyState(c.actual):c.actual}</p>)}

      {e.technical?.map(technical=><div className="trace-technical" key={technical.id}><strong>{eventTitle(technical)} · Registro {technical.id}</strong><p>{formatDate(technical.fecha)} {formatTime(technical.fecha)}</p>
        {technical.comentario&&<p>{technical.comentario}</p>}<TechnicalDetail work={eventMetadata(technical).trabajo}/>
        {technical.cambios?.map(c=><p key={c.campo}>{c.campo}: {c.campo==='Estado'?historyState(c.anterior):c.anterior} → {c.campo==='Estado'?historyState(c.actual):c.actual}</p>)}
      </div>)}
      </div>
    </details>
  </article>;
}
export default function AssetTimeline({events,title='Historial del activo'}:{events:TimelineEvent[];title?:string}){
  const days=new Map<string,TimelineEvent[]>();
  for(const e of buildTimeline(events)){const day=formatDate(e.fecha);if(!days.has(day))days.set(day,[]);days.get(day)!.push(e);}
  return <section className="panel trace-timeline"><h2>{title}</h2>
    {!events.length?<EmptyState icon={<ClipboardList size={22}/>} title="Sin eventos registrados" description="Las intervenciones conservan sus fechas de ingreso."/>:
      [...days].map(([day,entries])=><section key={day} className="trace-day" aria-label={day}><h3 className="trace-day-title">{day}</h3><ol className="trace-event-list">{entries.map(e=><li key={e.id}><TimelineEntry event={e}/></li>)}</ol></section>)}
  </section>;
}
