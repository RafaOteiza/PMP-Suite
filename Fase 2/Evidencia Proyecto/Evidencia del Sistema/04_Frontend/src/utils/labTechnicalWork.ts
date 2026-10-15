export const TEST_METHODS=['Manual','Test MK'];
export interface TechnicalWork {
 diagnostico:{resultado:string;falla_real:string;observacion:string};
 acciones:string[];repuestos?:{id:number;cantidad:number}[];justificacion_repuestos?:string; // Historical reading only.
 pruebas:{nombre:string;resultado:string;observacion:string}[];
 resultado:string;observaciones_qa:string;
 pod:{categoria:string;observacion:string;fotografias:{origen:string;base64:string;mime?:string}[]};
}
export const emptyWork=():TechnicalWork=>({diagnostico:{resultado:'',falla_real:'',observacion:''},acciones:[],pruebas:[],resultado:'',observaciones_qa:'',pod:{categoria:'',observacion:'',fotografias:[]}});
export const diagnosisOptions=[['CONFIRMADA','Falla confirmada'],['DIFERENTE','Falla diferente a la reportada'],['NFF','Sin falla encontrada / NFF'],['POD','Posible PoD detectado'],['OTRO','Otro diagnóstico']];
export const resultOptions=[['REPARADO','Reparado'],['NFF','Sin falla encontrada'],['PENDIENTE_REPUESTO','Pendiente por repuesto'],['NO_REPARABLE','No reparable'],['POD','PoD detectado'],['REVISION','Requiere revisión adicional']];
export const podOptions=[['GOLPE','Golpe'],['ROTURA','Rotura'],['VANDALISMO','Vandalismo'],['LIQUIDO','Líquido'],['OTRO','Otro']];
export function closureIssues(w:TechnicalWork,state:number,pendingRequest=false):string[]{
 const errors:string[]=[];
 if(pendingRequest)errors.push('Existe una solicitud bloqueante pendiente de Bodega.');
 if(state!==5)errors.push('Inicia el trabajo y resuelve la espera de repuesto antes de cerrar.');
 if(!w.diagnostico.resultado)errors.push('Selecciona el resultado del diagnóstico.');
 if(['CONFIRMADA','DIFERENTE'].includes(w.diagnostico.resultado)&&!w.diagnostico.falla_real.trim())errors.push('Selecciona la falla real diagnosticada.');
 if(['NFF','OTRO'].includes(w.diagnostico.resultado)&&!w.diagnostico.observacion.trim())errors.push('Este diagnóstico requiere observación técnica.');
 if(!['REPARADO','NFF','POD'].includes(w.resultado))errors.push('Selecciona un resultado apto para cierre; los pendientes se guardan como avance.');
 if((w.resultado==='NFF')!==(w.diagnostico.resultado==='NFF'))errors.push('Diagnóstico y resultado deben coincidir en Sin falla encontrada.');
 if((w.resultado==='POD')!==(w.diagnostico.resultado==='POD'))errors.push('Diagnóstico y resultado deben conservar PoD detectado.');
 if(w.resultado==='REPARADO'&&!w.acciones.length)errors.push('Registra al menos una intervención realizada.');
 if(!w.pruebas.length||w.pruebas.some(t=>!TEST_METHODS.includes(t.nombre)||t.resultado!=='APROBADA'))errors.push('Registra al menos una prueba y completa todas con resultado aprobado.');
 if(w.resultado==='POD'||w.diagnostico.resultado==='POD'){
  if(!w.pod.categoria||!w.pod.observacion.trim()||!w.pod.fotografias.length)errors.push('PoD requiere categoría, observación y al menos una fotografía válida.');
 }
 return errors;
}
