import {api} from './http';
import type {TechnicalWork} from '../utils/labTechnicalWork';
export type QaStage='RECEPCION'|'AMBIENTE'|'PRUEBAS'|'DESPACHO'|'POR_VERIFICAR'|'HISTORIAL';
export const qaStages:Record<QaStage,string>={RECEPCION:'Recepción',AMBIENTE:'Instalación Ambiente',PRUEBAS:'Pruebas',DESPACHO:'Despacho',POR_VERIFICAR:'Por verificar',HISTORIAL:'Historial'};
export const qaPaths:Record<QaStage,string>={RECEPCION:'recepcion',AMBIENTE:'ambiente',PRUEBAS:'pruebas',DESPACHO:'despacho',POR_VERIFICAR:'detalle',HISTORIAL:'detalle'};
export type QaActor={id:string;nombre:string;fecha:string};
export type QaTest={id:string;metodo:''|'Manual'|'Test MK';resultado:'PENDIENTE'|'APROBADA'|'RECHAZADA';observacion:string;autor:QaActor;fecha:string};
export type QaWork={etapa:QaStage;responsable:QaActor|null;receptor?:QaActor;despachador?:QaActor;ambiente:{estado:'PENDIENTE'|'EN_CURSO'|'COMPLETADO';observacion:string;inicio:string|null;fin:string|null};pruebas:QaTest[];dictamen:{resultado:'OPERATIVO'|'RECHAZADO';motivo:string;autor:QaActor;fecha:string}|null};
export interface QaTicket {codigo_os:string;tipo_equipo:string;serie:string;fecha:string;falla:string;bus_ppu:string;modelo?:string;marca?:string;terminal?:string;operador?:string;referencia_ar?:string;tecnico_reparador?:string;tecnico_qa?:string;qa_usuario_id?:string;estado_operacional:string;etapa:QaStage;fecha_recepcion_qa?:string;fecha_envio_qa?:string;fecha_etapa?:string;dictamen?:string;ciclo_qa?:string;}
export type QaDetail=QaTicket&{revision:string|null;trabajo:QaWork;antecedentes_laboratorio:{fecha:string;autor:string;metadata:{trabajo?:TechnicalWork}}|null;historial:{id:string;tipo:string;fecha:string;autor:string;metadata:{ciclo_qa?:string;trabajo?:QaWork;origen_captura?:string;codigo_leido?:string;motivo?:string}}[]};
export type QaDashboard={items:QaTicket[];counts:Partial<Record<QaStage,number>>;total:number;page:number;page_size:number};
export const getQaDashboard=async(params:{etapa:QaStage;q:string;page:number})=>(await api.get<QaDashboard>('/api/qa/dashboard',{params})).data;
export const getQaWork=async(code:string,cycle?:string|null)=>(await api.get<QaDetail>(`/api/qa/${encodeURIComponent(code)}/work`,{params:cycle?{ciclo:cycle}:undefined})).data;
export const qaCommand=async(code:string,action:string,body:Record<string,unknown>)=>(await api.post(`/api/qa/${encodeURIComponent(code)}/actions/${action}`,body)).data;
export const validateQaPhysical=async(code:string,purpose:string,body:Record<string,unknown>)=>(await api.post<{coincide:boolean;validacion_id:string|null;encontrado:{serie:string}}>(`/api/qa/${encodeURIComponent(code)}/${purpose}/validar`,body)).data;
export const getQaQueue=async()=>(await api.get<QaTicket[]>('/api/qa/queue')).data;
