import {inventoryProjectionSql,inventoryStages} from './logisticsInventory.js';
import {labReceptionFactsSql} from './labReceptionRead.js';
import {pendingTerrainSql,terrainDispatchSql} from './logisticsPresentation.js';
import {warehouseQueueSql} from './warehouseQueue.js';
import {qaStageSql} from './qaCustody.js';
import {technicalClosuresSql,closureWeeksSql,closureResultsSql} from './operationalInsights.js';

// All counts share one PostgreSQL statement/snapshot. No writes or alternative FSM.
export async function readExecutiveDashboard(client) {
 const {rows}=await client.query(`${inventoryProjectionSql}, lab AS (${labReceptionFactsSql}), ${technicalClosuresSql},
 orders AS (SELECT o.*,${pendingTerrainSql()} retiro_pendiente,${terrainDispatchSql()} despacho_terreno,
  ${warehouseQueueSql()} bodega_pendiente,${qaStageSql()} etapa_qa FROM pmp.ordenes_servicio o)
 SELECT jsonb_build_object('updatedAt',now(),
 'assets',(SELECT jsonb_build_object('total',count(*),'validadores',count(*) FILTER(WHERE tipo_equipo='VALIDADOR'),
 'consolas',count(*) FILTER(WHERE tipo_equipo='CONSOLA'),'operacion',count(*) FILTER(WHERE etapa='OPERACION'),
 'disponibles',count(*) FILTER(WHERE disponible),'bodega',count(*) FILTER(WHERE en_bodega),
 'laboratorio',count(*) FILTER(WHERE etapa='LABORATORIO'),'qa',count(*) FILTER(WHERE etapa='QA'),
 'transito',count(*) FILTER(WHERE etapa='TRANSITO'),'noDisponibles',count(*) FILTER(WHERE NOT disponible)) FROM assets),
 'distribution',(SELECT COALESCE(jsonb_agg(x),'[]') FROM (SELECT etapa,count(*) FILTER(WHERE tipo_equipo='VALIDADOR') validadores,
 count(*) FILTER(WHERE tipo_equipo='CONSOLA') consolas,count(*) total FROM assets GROUP BY etapa) x),
 'transit',(SELECT COALESCE(jsonb_agg(x),'[]') FROM (SELECT transito destino,count(*) total FROM assets WHERE etapa='TRANSITO' GROUP BY transito) x),
 'orders',(SELECT jsonb_build_object('activas',count(*) FILTER(WHERE estado_id NOT IN (8,12,13)),
 'cerradas',count(*) FILTER(WHERE estado_id IN (8,12,13)),
 'fallas',count(*) FILTER(WHERE es_instalacion IS NOT TRUE),
 'instalaciones',count(*) FILTER(WHERE es_instalacion AND estado_id NOT IN (8,12,13)),
 'enRuta',count(*) FILTER(WHERE despacho_terreno),
 'retiros',count(*) FILTER(WHERE retiro_pendiente),
 'recepciones',count(*) FILTER(WHERE bodega_pendiente AND estado_id IN (2,11)),
 'despachos',count(*) FILTER(WHERE bodega_pendiente AND estado_id=3)) FROM orders),
 'podCases',(SELECT count(*) FROM pmp.casos_operacionales c WHERE EXISTS(SELECT 1 FROM orders o WHERE o.caso_id=c.id AND o.es_pod IS TRUE)),
 'stockAlerts',(SELECT count(*) FROM pmp.repuestos WHERE stock<=COALESCE(stock_critico,0)),
 'qa',(SELECT COALESCE(jsonb_object_agg(etapa_qa,n),'{}') FROM (SELECT etapa_qa,count(*) n FROM orders WHERE estado_id=6 GROUP BY etapa_qa) x),
 'lab',(SELECT jsonb_build_object('camino',count(*) FILTER(WHERE en_camino),'recibidos',count(*) FILTER(WHERE recibido),
 'pendientes',count(*) FILTER(WHERE recibido AND estado_id IN (4,5,9) AND tecnico_laboratorio_id IS NULL),
 'diagnostico',count(*) FILTER(WHERE recibido AND estado_id=4),'reparacion',count(*) FILTER(WHERE recibido AND estado_id=5),
 'repuestos',count(*) FILTER(WHERE recibido AND estado_id=9),'salida',count(*) FILTER(WHERE recibido AND estado_id=10),
 'reingresos',count(*) FILTER(WHERE recibido AND ingresos>1)) FROM lab),
 'labWorkload',(SELECT COALESCE(jsonb_agg(x),'[]') FROM (SELECT codigo_os,tipo_equipo,serie,falla,estado_id,tecnico_laboratorio_id,tecnico_laboratorio,
 fecha,fecha_recepcion fecha_ingreso_laboratorio,(fecha_salida IS NULL AND fecha_recepcion IS NULL) ingreso_legacy,
 ingresos>1 reingreso_laboratorio FROM lab WHERE recibido AND estado_id IN (4,5,9)) x),
 'labInsights',jsonb_build_object(
  'recurrentAssets',(SELECT count(*) FROM (SELECT tipo_equipo,COALESCE(validador_serie,consola_serie) FROM orders WHERE es_instalacion IS NOT TRUE GROUP BY 1,2 HAVING count(*)>1) x),
  'frequentFaults',(SELECT COALESCE(jsonb_agg(x),'[]') FROM (SELECT falla,count(*) total FROM orders WHERE es_instalacion IS NOT TRUE AND NULLIF(trim(falla),'') IS NOT NULL GROUP BY falla ORDER BY count(*) DESC,falla LIMIT 5) x),
  'finished30Days',(SELECT count(*) FROM technical_closures WHERE fecha>=now()-interval '30 days' AND fecha<=now()),
  'closuresByWeek',${closureWeeksSql},'closureResults',${closureResultsSql}),
 'labTechnicians',(SELECT COALESCE(jsonb_agg(x),'[]') FROM (SELECT tecnico_laboratorio_id,tecnico_laboratorio,count(*) total,
 count(*) FILTER(WHERE estado_id=10) listos FROM lab WHERE recibido AND tecnico_laboratorio_id IS NOT NULL GROUP BY tecnico_laboratorio_id,tecnico_laboratorio) x)
 ) data`);
 const data=rows[0].data;
 data.distribution=inventoryStages.map(([etapa,label])=>({etapa,label,validadores:0,consolas:0,total:0,...data.distribution.find(d=>d.etapa===etapa)}));
 return data;
}
