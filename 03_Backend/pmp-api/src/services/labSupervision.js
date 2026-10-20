import {readExecutiveDashboard} from './executiveDashboard.js';
import {labReceptionFactsSql} from './labReceptionRead.js';

export async function readLabSupervision(client){
 const {updatedAt,lab,labWorkload,labTechnicians}=await readExecutiveDashboard(client);
 const {rows}=await client.query(`WITH lab AS (${labReceptionFactsSql}), history AS (
 SELECT * FROM lab WHERE ingresos>0 OR recibido)
 SELECT jsonb_build_object(
 'recurrentAssets',(SELECT count(*) FROM (SELECT tipo_equipo,serie FROM history GROUP BY 1,2 HAVING count(*)>1) x),
 'frequentFaults',(SELECT COALESCE(jsonb_agg(x),'[]') FROM (SELECT falla,count(*) total FROM history WHERE NULLIF(trim(falla),'') IS NOT NULL GROUP BY falla ORDER BY count(*) DESC,falla LIMIT 5) x),
 'finished30Days',(SELECT count(*) FROM (SELECT DISTINCT f.codigo_os,COALESCE(f.metadata->>'ciclo','legacy') FROM pmp.flujo_eventos f JOIN history h ON h.codigo_os=f.codigo_os WHERE f.tipo='LAB_REPARACION_FINALIZADA' AND f.fecha>=now()-interval '30 days') x)) insights`);
 // Explicit projection: no global stock, users, QA, warehouse or executive totals.
 return {updatedAt,lab,labWorkload,labTechnicians,labInsights:rows[0].insights};
}
