import type { LabTicket } from '../api/lab';
import { calculateSLA } from './sla';

// One temporal source for laboratory dates, SLA and priorities.
export const labArrival = (ticket: LabTicket) => ticket.en_transito_laboratorio ? '' : ticket.fecha_ingreso_laboratorio || (ticket.ingreso_legacy===false?'':ticket.fecha);
export const labSLA = (ticket: LabTicket) => calculateSLA(labArrival(ticket));
export const labArrivalLabel = (ticket: LabTicket) => (ticket.en_transito_laboratorio||(!ticket.fecha_ingreso_laboratorio&&ticket.ingreso_legacy===false))?'Pendiente de recepción física en Laboratorio':!ticket.fecha_ingreso_laboratorio
 ? 'Fecha OS · ingreso no registrado'
 : ticket.reingreso_laboratorio ? 'Reingreso a Laboratorio'
 : 'Recepción física en Laboratorio confirmada';
export function compareLabWorkload(a: LabTicket, b: LabTicket) {
 const assignment = Number(Boolean(a.tecnico_laboratorio_id)) - Number(Boolean(b.tecnico_laboratorio_id));
 if (assignment) return assignment;
 const rank = (ticket: LabTicket) => { const sla=labSLA(ticket); return sla.vencido?0:sla.critico?1:2; };
 const timestamp = (ticket: LabTicket) => Date.parse(labArrival(ticket)) || 0;
 return rank(a)-rank(b) || timestamp(b)-timestamp(a) || a.codigo_os.localeCompare(b.codigo_os);
}
