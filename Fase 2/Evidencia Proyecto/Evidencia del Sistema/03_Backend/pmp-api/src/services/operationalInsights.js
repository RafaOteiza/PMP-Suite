import {buildMaintenanceAnalysis} from './maintenanceAnalysis.js';
// Read-only aggregates. One closure per OS/cycle; installations are never failures.
export const technicalClosuresSql = `technical_closures AS (
 SELECT DISTINCT ON (codigo_os,COALESCE(metadata->>'ciclo','legacy')) codigo_os,fecha,metadata
 FROM pmp.flujo_eventos WHERE tipo='LAB_REPARACION_FINALIZADA'
 ORDER BY codigo_os,COALESCE(metadata->>'ciclo','legacy'),fecha DESC,id DESC
)`;
export const closureWeeksSql = `(SELECT COALESCE(jsonb_agg(x ORDER BY semana),'[]') FROM (
 SELECT to_char(w.semana,'YYYY-MM-DD') semana,count(c.codigo_os) total
 FROM generate_series(date_trunc('week',now()-interval '30 days'),date_trunc('week',now()),interval '1 week') w(semana)
 LEFT JOIN technical_closures c ON c.fecha>=now()-interval '30 days' AND c.fecha<=now()
 AND date_trunc('week',c.fecha)=w.semana GROUP BY w.semana) x)`;
export const closureResultsSql = `(SELECT COALESCE(jsonb_agg(x ORDER BY total DESC,resultado),'[]') FROM (
 SELECT COALESCE(NULLIF(metadata#>>'{trabajo,resultado}',''),'SIN_REGISTRO') resultado,count(*) total
 FROM technical_closures WHERE fecha>=now()-interval '30 days' AND fecha<=now() GROUP BY 1) x)`;

export async function readOperationalInsights(client) {
 const {rows}=await client.query(`WITH failures AS (
 SELECT codigo_os,tipo_equipo,COALESCE(validador_serie,consola_serie) serie,bus_ppu,falla,fecha
 FROM pmp.ordenes_servicio WHERE es_instalacion IS NOT TRUE AND codigo_os !~ '^IN-'
 AND tipo_equipo IN ('VALIDADOR','CONSOLA') AND COALESCE(validador_serie,consola_serie) IS NOT NULL
 ), ${technicalClosuresSql}, deliveries AS (
 SELECT DISTINCT ON (e.codigo_os,e.metadata->>'solicitud_id') e.codigo_os,e.metadata,e.fecha,f.falla
 FROM pmp.flujo_eventos e JOIN failures f ON f.codigo_os=e.codigo_os
 WHERE e.tipo='LOGISTICA_ENTREGA_REPUESTO' AND e.metadata->>'solicitud_id' IS NOT NULL
 ORDER BY e.codigo_os,e.metadata->>'solicitud_id',e.fecha DESC,e.id DESC
 ) SELECT jsonb_build_object('updatedAt',now(),
 'summary',(SELECT jsonb_build_object('orders',count(*),'assets',count(DISTINCT (tipo_equipo,serie)),
 'buses',count(DISTINCT NULLIF(trim(bus_ppu),'')),
 'withoutBus',count(*) FILTER(WHERE NULLIF(trim(bus_ppu),'') IS NULL),
 'simulationOrders',count(*) FILTER(WHERE falla ILIKE '%SIMULACION%' OR falla ILIKE '%SIMULACIÓN%'),
 'from',min(fecha),'to',max(fecha)) FROM failures),
 'faults',(SELECT COALESCE(jsonb_agg(x ORDER BY total DESC,falla),'[]') FROM (
 SELECT falla,count(*) total FROM failures WHERE NULLIF(trim(falla),'') IS NOT NULL GROUP BY falla ORDER BY total DESC,falla) x),
 'buses',(SELECT COALESCE(jsonb_agg(x ORDER BY total DESC,ppu),'[]') FROM (
 SELECT bus_ppu ppu,count(*) FILTER(WHERE tipo_equipo='VALIDADOR') validadores,
 count(*) FILTER(WHERE tipo_equipo='CONSOLA') consolas,count(*) total,count(DISTINCT (tipo_equipo,serie)) activos
 FROM failures WHERE NULLIF(trim(bus_ppu),'') IS NOT NULL GROUP BY bus_ppu ORDER BY total DESC,ppu) x),
 'components',(SELECT COALESCE(jsonb_agg(x ORDER BY ordenes DESC,nombre),'[]') FROM (
 SELECT metadata->>'repuesto_id' referencia,COALESCE(NULLIF(metadata->>'nombre',''),'Componente sin nombre') nombre,
 count(DISTINCT codigo_os) ordenes,
 sum(CASE WHEN metadata->>'cantidad' ~ '^[0-9]+$' THEN (metadata->>'cantidad')::numeric ELSE 0 END) unidades
 FROM deliveries GROUP BY 1,2 ORDER BY ordenes DESC,nombre) x),
 'diagnoses',(SELECT COALESCE(jsonb_agg(x ORDER BY total DESC,falla),'[]') FROM (
 SELECT metadata#>>'{trabajo,diagnostico,falla_real}' falla,count(*) total FROM technical_closures
 WHERE NULLIF(trim(metadata#>>'{trabajo,diagnostico,falla_real}'),'') IS NOT NULL
 GROUP BY 1 ORDER BY total DESC,falla) x),
 '_evidence',jsonb_build_object(
 'orders',(SELECT COALESCE(jsonb_agg(f),'[]') FROM failures f),
 'closures',(SELECT COALESCE(jsonb_agg(x),'[]') FROM (SELECT c.codigo_os,c.fecha,c.metadata#>>'{trabajo,resultado}' resultado,
 c.metadata#>>'{trabajo,diagnostico,falla_real}' diagnostico FROM technical_closures c JOIN failures f USING(codigo_os)) x),
 'deliveries',(SELECT COALESCE(jsonb_agg(x),'[]') FROM (SELECT fecha,falla,metadata->>'repuesto_id' repuesto_id,metadata->>'cantidad' cantidad FROM deliveries) x),
 'stock',(SELECT COALESCE(jsonb_agg(x),'[]') FROM (SELECT id,nombre,categoria,stock,stock_critico FROM pmp.repuestos) x)
 )) data`);
 const {_evidence,...data}=rows[0].data;
 return _evidence?{...data,analysis:buildMaintenanceAnalysis(_evidence,data.updatedAt)}:data;
}
