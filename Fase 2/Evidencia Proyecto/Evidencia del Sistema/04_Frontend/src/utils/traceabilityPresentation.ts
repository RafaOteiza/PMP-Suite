import type {QaWork} from '../api/qa';
import type {TechnicalWork} from './labTechnicalWork';
import { formatOperationalStatus } from './formatters';

export type TimelineEvent = {
  id:string; tipo:string; titulo?:string; codigo_os?:string; fecha:string;
  comentario?:string; descripcion?:string; detalle?:Record<string,unknown>;
  cambios?:Array<{campo:string;anterior:string;actual:string}>;
  attempts?:TimelineEvent[]; technical?:TimelineEvent[];
};
export type EventMetadata = {
  ubicacion?:string; estacion?:string;
  ciclo?:string; trabajo?:TechnicalWork|QaWork;origen_captura?:string;destino?:string;disposicion?:string; repuestos?:{id:number;nombre:string;cantidad:number}[];
  serie?:string; tipo_equipo?:string; modelo?:string|null; marca?:string|null; bus_ppu?:string;
  tecnico?:string; usuario?:string; usuario_nombre?:string; pod?:boolean;
  metodo_validacion?:string; codigo_leido?:string; terminal?:string; operador?:string;
  referencia_ar?:string; codigo_caso?:string; falla?:string; falla_reportada?:string;
  categoria_pod?:string; motivo_manual?:string; observacion_manual?:string;
  esperado?:{tipo_equipo?:string;serie?:string}; encontrado?:{tipo_equipo?:string;serie?:string};
  coincide?:boolean; tecnico_terreno_id?:string; validacion_id?:string|number;
};
export const eventMetadata=(e:TimelineEvent)=>(e.detalle?.metadata||e.detalle||{}) as EventMetadata;
export const historyState=(state?:string|null)=>state==='PENDIENTE_RETIRO'?'Pendiente de retiro':state==='EN_TRANSITO'?'En tránsito hacia Bodega':formatOperationalStatus(state);
export const captureLabel=(method?:string)=>({SCAN:'Escaneo con cámara',SCANNER:'Escáner físico',MANUAL:'Contingencia manual, sin escaneo',MANUAL_AUTORIZADO:'Ingreso manual autorizado'})[method||'']||formatOperationalStatus(method,'Sin registro');
type HistoryOrder={codigo_os:string;estado?:string;estado_nombre?:string;ubicacion?:string|null;bus_ppu?:string;fecha?:string;modelo?:string|null;marca?:string|null;codigo_caso?:string};
export function historyLocation(order:HistoryOrder){
  const state=historyState(order.estado_nombre||order.estado);
  if(state==='En tránsito hacia Bodega'||state==='En tránsito')return 'En tránsito hacia Bodega';
  return order.ubicacion?(/^(BODEGA|BUS|LABORATORIO|BODEGA_MERSAN)$/.test(order.ubicacion)?formatOperationalStatus(order.ubicacion):order.ubicacion):'Sin ubicación registrada';
}
export function latestOrder(orders:readonly HistoryOrder[]){
  return [...orders].sort((a,b)=>new Date(b.fecha||0).getTime()-new Date(a.fecha||0).getTime())[0];
}
export function buildTimeline(events:TimelineEvent[]){
  const groups=new Map<string,TimelineEvent>();
  const result:TimelineEvent[]=[];
  for(const source of events){
    const e={...source},m=eventMetadata(e);
    if(e.tipo==='VALIDACION_IDENTIDAD_RETIRO'&&m.coincide===true){
      const key=JSON.stringify([e.codigo_os,m.esperado?.tipo_equipo||m.tipo_equipo,m.esperado?.serie||m.serie,m.codigo_leido,m.metodo_validacion]);
      const attempts=(Array.isArray(e.detalle?.intentos)?e.detalle.intentos:[source]) as TimelineEvent[];
      const previous=groups.get(key);
      if(previous){
        previous.attempts=[...new Map([...(previous.attempts||[]),...attempts].map(a=>[a.id,a])).values()];
        if(new Date(e.fecha)>new Date(previous.fecha))Object.assign(previous,{id:e.id,fecha:e.fecha,detalle:e.detalle,titulo:e.titulo,descripcion:e.descripcion,comentario:e.comentario});
      }else{
        e.attempts=[...attempts];groups.set(key,e);result.push(e);
      }
    }else result.push(e);
  }
  // Fold only proven same-operation technical updates. Additional changes remain visible.
  const merged=new Set<string>();
  for(const e of result.filter(e=>e.tipo==='OS_ACTUALIZADA')){
    const before=e.detalle?.anterior as Record<string,unknown>|undefined;
    const after=e.detalle?.actual as Record<string,unknown>|undefined;
    if(!before||!after)continue;
    const changed=Object.keys({...before,...after}).filter(key=>JSON.stringify(before[key])!==JSON.stringify(after[key])&&key!=='actualizado_en');
    if(!changed.length)continue;
    const main=result.find(other=>{
      if(other.codigo_os!==e.codigo_os||Math.abs(new Date(other.fecha).getTime()-new Date(e.fecha).getTime())>1000)return false;
      if(other.tipo==='RETIRO_TERRENO_CONFIRMADO')
        return before.estado_id===1&&after.estado_id===2&&changed.every(k=>['estado_id','ubicacion_id'].includes(k));
      if(other.tipo==='RETIRO_ASIGNADO')
        return after.tecnico_terreno_id===eventMetadata(other).tecnico_terreno_id&&changed.every(k=>['tecnico_terreno_id','estado_id'].includes(k));
      return false;
    });
    if(main){main.technical=[...(main.technical||[]),e];merged.add(e.id);}
  }
  // Present a single technical closure per cycle; retain supporting records in its details.
  for(const main of result.filter(e=>e.tipo==='LAB_REPARACION_FINALIZADA')){
    const cycle=eventMetadata(main).ciclo;
    const related=result.filter(e=>e.codigo_os===main.codigo_os&&e.id!==main.id&&
      ((['LAB_DIAGNOSTICO_CONFIRMADO','LAB_REPUESTO_UTILIZADO','LAB_LISTO_QA'].includes(e.tipo)&&eventMetadata(e).ciclo===cycle)||
       (e.tipo==='REPARACION'&&Math.abs(new Date(e.fecha).getTime()-new Date(main.fecha).getTime())<1000)));
    main.technical=[...(main.technical||[]),...related];related.forEach(e=>merged.add(e.id));
  }
  const advances=new Map<string,TimelineEvent[]>();
  for(const e of result.filter(e=>e.tipo==='LAB_AVANCE_GUARDADO')){
    const key=JSON.stringify([e.codigo_os,eventMetadata(e).ciclo]);advances.set(key,[...(advances.get(key)||[]),e]);
  }
  for(const group of advances.values()){
    group.sort((a,b)=>new Date(b.fecha).getTime()-new Date(a.fecha).getTime()||Number(b.id.split(':').at(-1))-Number(a.id.split(':').at(-1)));
    group[0].technical=[...(group[0].technical||[]),...group.slice(1)];group.slice(1).forEach(e=>merged.add(e.id));
  }
  return result.filter(e=>!merged.has(e.id)).sort((a,b)=>new Date(b.fecha).getTime()-new Date(a.fecha).getTime()||(a.tipo==='RETIRO_TERRENO_CONFIRMADO'?-1:b.tipo==='RETIRO_TERRENO_CONFIRMADO'?1:0));
}
export function eventTitle(e:TimelineEvent){
  const labLabels:Record<string,string>={QA_TRABAJO_TOMADO:'Trabajo QA tomado',QA_AMBIENTE_INICIADO:'Instalación Ambiente iniciada',QA_AMBIENTE_GUARDADO:'Avance de Instalación Ambiente guardado',QA_AMBIENTE_COMPLETADO:'Instalación Ambiente completada',QA_PRUEBA_GUARDADA:'Prueba QA registrada',QA_DICTAMEN_CONFIRMADO:'Dictamen QA confirmado',SALIDA_QA_BODEGA:'Salida de QA hacia Bodega confirmada',QA_IDENTIDAD_VALIDADA:'Identidad QA validada · sin movimiento',QA_IDENTIDAD_DISCREPANCIA:'Validación de identidad QA no coincidente',SALIDA_BODEGA_QA:'Envío a QA confirmado',VALIDACION_SALIDA_QA:'Lectura validada para salida a QA',DISCREPANCIA_SALIDA_QA:'Validación de salida no coincidente',RECEPCION_QA_CONFIRMADA:'Recepción física en QA confirmada',QA_TECNICO_ASIGNADO:'Técnico QA asignado',QA_CONTROL_INICIADO:'Control QA iniciado',QA_APPROVED:'Control QA aprobado',QA_REJECTED:'Control QA rechazado',SALIDA_LABORATORIO_BODEGA:'Envío a Bodega confirmado desde Laboratorio',RECEPCION_LABORATORIO_BODEGA:'Recepción desde Laboratorio confirmada',LAB_TRABAJO_INICIADO:'Trabajo técnico iniciado',LAB_DIAGNOSTICO_CONFIRMADO:'Diagnóstico confirmado',LAB_REPUESTO_UTILIZADO:'Repuesto utilizado',LAB_SOLICITUD_REPUESTO:'Solicitud de repuesto',LAB_AVANCE_GUARDADO:'Avance guardado',LAB_REPARACION_FINALIZADA:'Trabajo técnico finalizado · Listo para QA',LAB_LISTO_QA:'Trabajo listo para QA',POD_DETECTADO_LABORATORIO:'PoD detectado en Laboratorio',LOGISTICA_ENTREGA_REPUESTO:'Repuesto entregado'};
  if(e.tipo==='VALIDACION_CUSTODIA_LABORATORIO')return 'Identidad de Laboratorio validada · sin movimiento';
  if(e.tipo==='DISCREPANCIA_CUSTODIA_LABORATORIO')return 'Validación de identidad no coincidente';
  if(e.tipo==='VALIDACION_DESPACHO_BODEGA')return 'Identidad validada para despacho · sin movimiento';
  if(labLabels[e.tipo])return labLabels[e.tipo];
  if(e.tipo==='UBICACION_FISICA_CONFIRMADA'&&eventMetadata(e).estacion==='LABORATORIO')return 'Recepción física en Laboratorio confirmada';
  if(e.tipo==='RECEPCION_LABORATORIO_CONFIRMADA')return 'Recepción física en Laboratorio confirmada';
  if(e.tipo==='TECNICO_LABORATORIO_ASIGNADO')return 'Técnico de Laboratorio asignado';
  if(e.tipo==='SALIDA_BODEGA_LABORATORIO')return 'Envío a Laboratorio confirmado';
  if(e.tipo==='VALIDACION_SALIDA_LAB')return 'Identidad validada para salida a Laboratorio';
  if(e.tipo==='DISCREPANCIA_SALIDA_LAB')return 'Validación de salida no coincidente';
  if(e.tipo==='VALIDACION_IDENTIDAD_RETIRO')return eventMetadata(e).coincide===true?'Identidad del equipo validada':'Validación de identidad no coincidente';
  return e.titulo||formatOperationalStatus(e.tipo);
}
