import { getAssetHistory } from './assetHistory.js';
import { inventoryProjectionSql } from './logisticsInventory.js';
import { historyStateLabel } from './withdrawalTimeline.js';

const text=value=>typeof value==='string'&&value.trim()?value.trim():null;
const time=value=>Date.parse(value)||0;
const metadata=event=>event?.detalle?.metadata||{};
const results={REPARADO:'Reparado',NFF:'NFF confirmado',RECHAZADO:'Rechazado',NO_REPARABLE:'No reparable',POD:'Daño atribuible a tercero confirmado',OPERATIVO:'Operativo',INSTALACION_FALLIDA:'Falla persistente'};

// Explicit allowlist. Never spread stored rows/metadata into the field technician response.
// Only confirmed technical records contribute results, never drafts or custody evidence.
export function projectTechnicalHistory(history,current={}) {
 const interventions=history.ordenes.map(order=>{
  const events=history.eventos.filter(e=>e.codigo_os===order.codigo_os).sort((a,b)=>time(b.fecha)-time(a.fecha));
  const finished=events.find(e=>e.tipo==='LAB_REPARACION_FINALIZADA');
  const repair=events.find(e=>e.tipo==='REPARACION');
  const diagnosis=events.find(e=>e.tipo==='LAB_DIAGNOSTICO_CONFIRMADO');
  const qa=events.find(e=>e.tipo==='QA_DICTAMEN_CONFIRMADO'||['QA_RECHAZADO','QA_REJECTED'].includes(e.tipo));
  const installation=events.find(e=>['INSTALACION_COMPLETADA','INSTALACION_FALLIDA'].includes(e.tipo));
  // Successful installation without a fault is operational context, not a repair.
  if(order.es_instalacion&&!finished&&!repair&&installation?.tipo!=='INSTALACION_FALLIDA')return null;
  const work=metadata(finished).trabajo||{},legacy=repair?.detalle||{};
  const diag=work.diagnostico||metadata(diagnosis).diagnostico||{};
  const verdict=metadata(qa).trabajo?.dictamen;
  let result=results[work.resultado]||results[legacy.resultado_prueba]||null;
  if(!result&&legacy.falla_detectada==='NFF')result=results.NFF;
  if(qa&&time(qa.fecha)>=time(finished?.fecha||repair?.fecha)) {
   if(verdict?.resultado==='RECHAZADO'||['QA_RECHAZADO','QA_REJECTED'].includes(qa.tipo))result=results.RECHAZADO;
   else if(verdict?.resultado==='OPERATIVO'&&!result)result=results.OPERATIVO;
  }
  if(installation?.tipo==='INSTALACION_FALLIDA')result=results.INSTALACION_FALLIDA;
  const closed=[8,12,13].includes(order.estado_id);
  const pending=!closed&&!finished&&!repair&&!verdict&&!installation;
  const observations=[text(diag.observacion),text(work.observaciones_qa),text(legacy.comentario),text(verdict?.motivo),text(qa?.comentario)];
  const actions=Array.isArray(work.acciones)?work.acciones.map(text).filter(Boolean).join(', '):null;
  return {
   codigo_os:order.codigo_os,fecha:[finished,repair,diagnosis,qa,installation].filter(Boolean).sort((a,b)=>time(b.fecha)-time(a.fecha))[0]?.fecha||order.fecha||null,
   falla_reportada:text(order.falla),diagnostico:text(diag.falla_real)||(diag.resultado==='NFF'?'Sin falla encontrada':text(legacy.falla_detectada)),
   trabajo_realizado:actions||text(legacy.accion_realizada),resultado:result,
   pendiente:pending,observaciones:[...new Set(observations.filter(Boolean))]
  };
 }).filter(Boolean).sort((a,b)=>time(b.fecha)-time(a.fecha)||b.codigo_os.localeCompare(a.codigo_os));
 return {tipo_equipo:history.tipo_equipo,serie:history.serie,modelo:text(history.modelo),marca:text(history.marca),
  estado_actual:current.estado_actual?historyStateLabel(current.estado_actual).replace(/_/g,' ').replace(/^[A-ZÁÉÍÓÚ ]+$/,value=>value.toLocaleLowerCase('es').replace(/^./,c=>c.toUpperCase())):'Sin estado registrado',
  intervenciones:interventions};
}

export async function getTechnicalAssetHistory(pool,type,series) {
 const history=await getAssetHistory(pool,type,series);
 // Reuse the canonical current-asset read model; never infer operational state from a closed OS.
 const current=(await pool.query(`${inventoryProjectionSql} SELECT estado_actual FROM assets WHERE tipo_equipo=$1 AND serie=$2`,[history.tipo_equipo,history.serie])).rows[0];
 return projectTechnicalHistory(history,current);
}
