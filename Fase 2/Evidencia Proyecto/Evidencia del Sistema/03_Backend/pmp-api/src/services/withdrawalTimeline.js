// Shared, read-only presentation for asset and case timelines.
const labLabels={QA_TRABAJO_TOMADO:'Trabajo QA tomado',QA_AMBIENTE_INICIADO:'Instalación Ambiente iniciada',QA_AMBIENTE_GUARDADO:'Avance de Instalación Ambiente guardado',QA_AMBIENTE_COMPLETADO:'Instalación Ambiente completada',QA_PRUEBA_GUARDADA:'Prueba QA registrada',QA_DICTAMEN_CONFIRMADO:'Dictamen QA confirmado',SALIDA_QA_BODEGA:'Salida de QA hacia Bodega confirmada',QA_IDENTIDAD_VALIDADA:'Identidad QA validada · sin movimiento',QA_IDENTIDAD_DISCREPANCIA:'Validación de identidad QA no coincidente',SALIDA_BODEGA_QA:'Envío a QA confirmado',RECEPCION_QA_CONFIRMADA:'Recepción física en QA confirmada',QA_TECNICO_ASIGNADO:'Técnico QA asignado',QA_CONTROL_INICIADO:'Control QA iniciado',QA_APPROVED:'Control QA aprobado',QA_REJECTED:'Control QA rechazado',SALIDA_LABORATORIO_BODEGA:'Envío a Bodega confirmado desde Laboratorio',RECEPCION_LABORATORIO_BODEGA:'Recepción desde Laboratorio confirmada',LAB_TRABAJO_INICIADO:'Trabajo técnico iniciado',LAB_DIAGNOSTICO_CONFIRMADO:'Diagnóstico confirmado',LAB_REPUESTO_UTILIZADO:'Repuesto utilizado',LAB_SOLICITUD_REPUESTO:'Solicitud de repuesto',LAB_AVANCE_GUARDADO:'Avance guardado',LAB_REPARACION_FINALIZADA:'Trabajo técnico finalizado',LAB_LISTO_QA:'Trabajo listo para QA',POD_DETECTADO_LABORATORIO:'PoD detectado en Laboratorio',LOGISTICA_ENTREGA_REPUESTO:'Repuesto entregado'};
const labels={VALIDACION_IDENTIDAD_RETIRO:'Identidad del retiro verificada',DISCREPANCIA_RETIRO_TERRENO:'Discrepancia de equipo en terreno',RETIRO_TERRENO_CONFIRMADO:'Retiro físico confirmado',POD_DETECTADO_TERRENO:'PoD detectado en terreno'};
export function presentWithdrawalEvent(event){
  if(labLabels[event.tipo])return {...event,titulo:labLabels[event.tipo]};
  if(!labels[event.tipo])return event;
  const m=event.detalle?.metadata||event.detalle||{};
  const parts=[m.tipo_equipo&&`${m.tipo_equipo} · Serie ${m.serie}`,m.bus_ppu&&`Bus ${m.bus_ppu}`,m.terminal,m.operador,
    m.tecnico&&`Técnico: ${m.tecnico}`,m.codigo_caso&&`Caso: ${m.codigo_caso}`,m.referencia_ar&&`Referencia: ${m.referencia_ar}`,
    m.metodo_validacion&&(m.metodo_validacion==='SCAN'?'Validación: escaneo con cámara':'Validación: contingencia manual, sin escaneo'),
    m.codigo_leido&&`Código leído: ${m.codigo_leido}`,m.motivo_manual&&`Motivo: ${m.motivo_manual.replaceAll('_',' ').toLowerCase()}`,m.observacion_manual,
    typeof m.pod==='boolean'&&`PoD: ${m.pod?'Sí · '+(m.categoria_pod||'Sin categoría').toLowerCase():'No'}`,
    m.estado_nuevo&&'Bus → Bodega · Pendiente de retiro → En tránsito hacia Bodega',
    m.esperado&&`Esperado: ${m.esperado.tipo_equipo} ${m.esperado.serie}`,
    m.encontrado&&`Encontrado: ${m.encontrado.tipo_equipo} ${m.encontrado.serie}`,
    m.coincide===false&&'No coincide; no confirma retiro'];
  return {...event,titulo:event.tipo==='VALIDACION_IDENTIDAD_RETIRO'&&m.coincide!==true?'Validación de identidad no coincidente':labels[event.tipo],descripcion:parts.filter(Boolean).join(' · ')};
}

// Read projection only: keep the audit records, expose one relevant successful validation per OS.
export function presentWithdrawalTimeline(events){
  const groups=new Map();
  const groupKey=event=>{
    const m=event.detalle?.metadata||event.detalle||{};
    return event.tipo==='VALIDACION_IDENTIDAD_RETIRO'&&m.coincide===true
      ?JSON.stringify([event.codigo_os,m.esperado?.tipo_equipo||m.tipo_equipo,m.esperado?.serie||m.serie,m.codigo_leido,m.metodo_validacion]):null;
  };
  for(const event of events){
    const key=groupKey(event);
    if(key){if(!groups.has(key))groups.set(key,[]);groups.get(key).push(event);}
  }
  return events.filter(event=>{
    const group=groups.get(groupKey(event));
    return !group||group.at(-1)===event;
  }).map(event=>{
    const group=groups.get(groupKey(event));
    if(group)event={...event,detalle:{...event.detalle,intentos:group.map(presentWithdrawalEvent)}};
    const m=event.detalle?.metadata||event.detalle||{};
    if(event.tipo==='RETIRO_TERRENO_CONFIRMADO'&&!m.esperado){
      const source=events.find(e=>e.tipo==='VALIDACION_IDENTIDAD_RETIRO'&&e.id==='flujo:'+m.validacion_id);
      const evidence=source?.detalle?.metadata||source?.detalle;
      if(evidence){
        const metadata={...m,esperado:evidence.esperado,encontrado:evidence.encontrado,coincide:evidence.coincide};
        event={...event,detalle:event.detalle?.metadata?{...event.detalle,metadata}:metadata};
      }
    }
    return presentWithdrawalEvent(event);
  });
}
export function historyStateLabel(value){
  return ({EN_RUTA:'En ruta',EN_TRANSITO:'En tránsito hacia Bodega',PENDIENTE_RETIRO:'Pendiente de retiro'})[value]||value;
}
export function withdrawalInTransitSql(order='o'){
  return `(${order}.estado_id=2 AND ${order}.ubicacion_id IS NULL
    AND EXISTS(SELECT 1 FROM pmp.flujo_eventos r WHERE r.codigo_os=${order}.codigo_os AND r.tipo='RETIRO_TERRENO_CONFIRMADO'))`;
}
