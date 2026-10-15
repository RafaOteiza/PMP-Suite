import {api} from './http';
import type {LabTicket} from './lab';
export interface ExecutiveDashboard {
 updatedAt:string;
 assets:{total:number;validadores:number;consolas:number;operacion:number;disponibles:number;bodega:number;laboratorio:number;qa:number;transito:number;noDisponibles:number};
 distribution:{etapa:string;label:string;validadores:number;consolas:number;total:number}[];
 transit:{destino:string;total:number}[];
 orders:{activas:number;cerradas:number;fallas:number;instalaciones:number;enRuta:number;retiros:number;recepciones:number;despachos:number};
 podCases:number;stockAlerts:number;qa:Record<string,number>;
 labInsights:{recurrentAssets:number;frequentFaults:{falla:string;total:number}[];finished30Days:number;
 closuresByWeek?:{semana:string;total:number}[];closureResults?:{resultado:string;total:number}[]};
 lab:{camino:number;recibidos:number;pendientes:number;diagnostico:number;reparacion:number;repuestos:number;salida:number;reingresos:number};
 labWorkload:LabTicket[];labTechnicians:{tecnico_laboratorio_id:string;tecnico_laboratorio:string;total:number;listos:number}[];
}
export const getExecutiveDashboard=async(signal?:AbortSignal):Promise<ExecutiveDashboard>=>(await api.get('/api/dashboard/executive',{signal})).data;

export type LabSupervision=Pick<ExecutiveDashboard,'updatedAt'|'lab'|'labInsights'|'labWorkload'|'labTechnicians'>;
export const getLabSupervision=async():Promise<LabSupervision>=>(await api.get('/api/lab/supervision')).data;
