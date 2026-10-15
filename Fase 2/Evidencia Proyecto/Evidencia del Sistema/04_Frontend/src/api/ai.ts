
import { api } from "./http";

export interface AIRiskItem {
    serie_equipo: string;
    tipo_equipo: string;
    falla: string;
    fallas_previas: number;
    riesgo_score: number;
}

export const getAIRiskReport = async (): Promise<AIRiskItem[]> => {
    const response = await api.get("/api/ai/predictive-report");
    return response.data;
};

export interface OperationalInsights {
 analysis?:MaintenanceAnalysis;
 updatedAt:string;
 summary:{orders:number;assets:number;buses:number;withoutBus:number;simulationOrders:number;from:string|null;to:string|null};
 faults:{falla:string;total:number}[];
 diagnoses:{falla:string;total:number}[];
 buses:{ppu:string;validadores:number;consolas:number;total:number;activos:number}[];
 components:{referencia:string;nombre:string;ordenes:number;unidades:number}[];
}
export interface MaintenanceAnalysis {
 updatedAt:string;
 assets:{tipo:string;serie:string;failures:number;simulationFailures:number;firstFailure:string;lastFailure:string;medianDays:number|null;intervals:number;reportedFault:string;diagnosis:string|null;result:string|null;incidents:{os:string;fecha:string;falla:string;bus:string}[];estimate:{intervals:number;medianDays:number;minDays:number;maxDays:number}|null}[];
 parts:{nombre:string;tipo:string;stock:number;critical:number;units90:number;realUnits90:number;simulationUnits90:number;deliveries90:number;dailyRate:number|null;coverageDays:number|null;depletionDate:string|null;suggestedUnits30:number|null;minimumGap:number;leadTimeDays:number|null}[];
 outcomes:{label:string;total:number}[];incidents:{label:string;total:number}[];diagnostics:{label:string;total:number}[];
 alerts:{tone:'info'|'warning'|'danger';subject:string;evidence:string;action:string}[];
 method:{prediction:string;partsWindowDays:number;minimumIntervals:number;minimumHistoryDays:number;intervalDefinition:string;partDefinition:string;outcomeDefinition:string;purchaseDefinition:string};
}
export async function getOperationalInsights():Promise<OperationalInsights>{
 return (await api.get('/api/ai/operational-insights')).data;
}
