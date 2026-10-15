import { initialAssetStockSql } from './initialAssetStock.js';
import { installationReadySql, operatingAssetsSql, logisticsStateSql, terrainDispatchSql, pendingTerrainSql } from './logisticsPresentation.js';
import { labAvailableSql, labTransitSql } from './labArrival.js';
import { qaReceivedSql, qaStageSql } from './qaCustody.js';
import { warehouseQueueSql } from './warehouseQueue.js';
import { FlowError } from './bridgeFlow.js';

// Read-only projection. These buckets are presentation, never new FSM states.
export const inventoryStages = [
  ['OPERACION', 'En operación'], ['DISPONIBLE', 'Bodega · disponibles'],
  ['BODEGA', 'Bodega · no disponibles'], ['LABORATORIO', 'Laboratorio'],
  ['QA', 'Control QA'], ['TRANSITO', 'En tránsito'],
  ['VALIDACION', 'Pendientes de validación'], ['OTROS', 'Ubicación por verificar']
];

export const inventoryProjectionSql = `WITH hardware AS (
 SELECT 'VALIDADOR'::text tipo_equipo,serie,modelo,marca,origen_registro,fecha_ingreso FROM pmp.validadores
 UNION ALL SELECT 'CONSOLA',serie,modelo,marca,origen_registro,fecha_ingreso FROM pmp.consolas
), initial_stock AS (${initialAssetStockSql}), operating AS (${operatingAssetsSql}),
 facts AS (
 SELECT h.*,o.codigo_os,o.estado_id,o.es_instalacion,o.bus_ppu,
   COALESCE(i.fecha,h.fecha_ingreso) AS fecha,
   COALESCE(i.ubicacion,u.nombre) AS ubicacion,
   COALESCE(u.tipo::text,CASE WHEN i.serie IS NOT NULL THEN 'BODEGA' END) AS ubicacion_tipo,
   (i.serie IS NOT NULL OR COALESCE(${installationReadySql()},false)) AS disponible,
   EXISTS(SELECT 1 FROM operating a WHERE a.tipo=h.tipo_equipo AND a.serie=h.serie) AS operativo,
   COALESCE(${labAvailableSql()},false) AS laboratorio,
   COALESCE(${qaReceivedSql()},false) AS qa,
   CASE WHEN ${labTransitSql()} THEN 'En tránsito hacia Laboratorio'
     WHEN o.estado_id=6 AND (${qaStageSql()})='RECEPCION' THEN 'En tránsito hacia QA'
     WHEN ${terrainDispatchSql()} THEN 'En ruta hacia terreno'
     WHEN o.estado_id IN (2,11) AND NOT ${pendingTerrainSql()} THEN 'En tránsito hacia Bodega'
     ELSE NULL END AS transito,
   CASE WHEN i.serie IS NOT NULL THEN 'Recepción inicial conforme'
     WHEN o.codigo_os IS NULL THEN 'Recepción inicial pendiente'
     ELSE ${logisticsStateSql()} END AS estado,
   CASE WHEN i.serie IS NOT NULL THEN 'Inicial'
     WHEN ${installationReadySql()} THEN 'Reparado'
     ELSE COALESCE(NULLIF(h.origen_registro,''),'No registrado') END AS procedencia,
   CASE WHEN i.serie IS NOT NULL THEN false ELSE COALESCE((SELECT s.estacion='BODEGA'
     AND s.metadata->>'contexto'='DESPACHO_TERRENO' FROM pmp.escaneos_equipos s
     WHERE s.codigo_os=o.codigo_os AND s.resultado='VALIDADO'
     ORDER BY s.fecha DESC,s.id DESC LIMIT 1),false) END AS escaneado_bodega
 FROM hardware h
 LEFT JOIN LATERAL (SELECT os.* FROM pmp.ordenes_servicio os
   WHERE os.tipo_equipo=h.tipo_equipo AND COALESCE(os.validador_serie,os.consola_serie)=h.serie
   ORDER BY os.fecha DESC,os.codigo_os DESC LIMIT 1) o ON true
 LEFT JOIN pmp.estados e ON e.id=o.estado_id
 LEFT JOIN pmp.ubicaciones u ON u.id=o.ubicacion_id
 LEFT JOIN LATERAL (SELECT s.* FROM initial_stock s WHERE s.tipo_equipo=h.tipo_equipo AND s.serie=h.serie
   ORDER BY s.fecha DESC,s.stock_origen_evento DESC LIMIT 1) i ON true
), classified AS (
 SELECT *,CASE WHEN disponible THEN 'DISPONIBLE' WHEN transito IS NOT NULL THEN 'TRANSITO'
   WHEN operativo THEN 'OPERACION' WHEN laboratorio THEN 'LABORATORIO' WHEN qa THEN 'QA'
   WHEN ubicacion_tipo='BODEGA' THEN 'BODEGA'
   WHEN codigo_os IS NULL THEN 'VALIDACION' ELSE 'OTROS' END AS etapa FROM facts
), assets AS (
 SELECT *,etapa IN ('DISPONIBLE','BODEGA') AS en_bodega,
   CASE WHEN etapa='TRANSITO' THEN transito WHEN etapa='OPERACION' THEN 'En operación'
     WHEN etapa='DISPONIBLE' THEN 'Disponible para instalación' ELSE estado END AS estado_actual,
   CASE WHEN etapa='TRANSITO' THEN transito WHEN etapa='OPERACION' THEN 'Bus '||bus_ppu
     ELSE COALESCE(ubicacion,'Ubicación por verificar') END AS ubicacion_actual
 FROM classified
)`;

export function inventoryQuery(query={}) {
  const text=(name,max=120)=>{const value=query[name]??'';if(typeof value!=='string'||value.length>max)throw new FlowError(422,'INVALID_QUERY','Filtro de inventario inválido');return value.trim();};
  const enumValue=(name,values)=>{const value=text(name);if(value&&!values.includes(value))throw new FlowError(422,'INVALID_QUERY','Filtro de inventario inválido');return value;};
  const integer=(name,fallback,max)=>{const v=query[name]??String(fallback);if(!/^\d+$/.test(String(v))||Number(v)>max)throw new FlowError(422,'INVALID_QUERY','Paginación inválida');return Number(v);};
  const limit=integer('limit',20,50);if(!limit)throw new FlowError(422,'INVALID_QUERY','Límite inválido');
  return {q:text('q'),tipo:enumValue('tipo',['VALIDADOR','CONSOLA']),etapa:enumValue('etapa',inventoryStages.map(s=>s[0])),
    alcance:enumValue('alcance',['BODEGA']),disponibilidad:enumValue('disponibilidad',['SI','NO']),
    pendiente:enumValue('pendiente',['IN']),modelo:text('modelo'),origen:text('origen'),estado:text('estado'),limit,offset:integer('offset',0,1000000)};
}

// One statement/snapshot: the global totals, matrix, facets and paginated rows agree.
export async function readLogisticsInventory(client,query={}) {
  const f=inventoryQuery(query),pattern='%'+f.q.replace(/[\\%_]/g,'\\$&')+'%';
  const {rows}=await client.query(`${inventoryProjectionSql}, filtered AS (
    SELECT * FROM assets WHERE ($1='' OR concat_ws(' ',serie,modelo,marca,bus_ppu,codigo_os) ILIKE $2)
    AND ($3='' OR tipo_equipo=$3) AND ($4='' OR etapa=$4) AND ($5='' OR en_bodega)
    AND ($6='' OR disponible=($6='SI')) AND ($7='' OR modelo=$7)
    AND ($8='' OR procedencia=$8) AND ($9='' OR estado_actual=$9)
    AND ($12='' OR EXISTS(SELECT 1 FROM pmp.ordenes_servicio pending
      WHERE pending.tipo_equipo=assets.tipo_equipo AND COALESCE(pending.validador_serie,pending.consola_serie)=assets.serie
      AND pending.es_instalacion IS TRUE AND pending.estado_id NOT IN (8,12,13)))
  ) SELECT jsonb_build_object(
    'resumen',(SELECT jsonb_build_object('total',count(*),'validadores',count(*) FILTER(WHERE tipo_equipo='VALIDADOR'),
      'consolas',count(*) FILTER(WHERE tipo_equipo='CONSOLA'),'bodega',count(*) FILTER(WHERE en_bodega),
      'disponibles',count(*) FILTER(WHERE disponible),'noDisponibles',count(*) FILTER(WHERE en_bodega AND NOT disponible)) FROM assets),
    'distribucion',(SELECT COALESCE(jsonb_agg(d),'[]') FROM (SELECT etapa,
      count(*) FILTER(WHERE tipo_equipo='VALIDADOR') validadores,count(*) FILTER(WHERE tipo_equipo='CONSOLA') consolas,count(*) total
      FROM assets GROUP BY etapa) d),
    'filtros',jsonb_build_object(
      'modelos',(SELECT COALESCE(jsonb_agg(v ORDER BY v),'[]') FROM (SELECT DISTINCT modelo v FROM assets WHERE NULLIF(modelo,'') IS NOT NULL) x),
      'origenes',(SELECT COALESCE(jsonb_agg(v ORDER BY v),'[]') FROM (SELECT DISTINCT procedencia v FROM assets) x),
      'estados',(SELECT COALESCE(jsonb_agg(v ORDER BY v),'[]') FROM (SELECT DISTINCT estado_actual v FROM assets WHERE estado_actual IS NOT NULL) x)),
    'secundarios',jsonb_build_object(
      'instalaciones',(SELECT count(*) FROM pmp.ordenes_servicio WHERE es_instalacion IS TRUE AND estado_id NOT IN (8,12,13)),
      'recepciones',(SELECT count(*) FROM pmp.ordenes_servicio o WHERE ${warehouseQueueSql()} AND o.estado_id IN (2,11)),
      'despachos',(SELECT count(*) FROM pmp.ordenes_servicio o WHERE ${warehouseQueueSql()} AND o.estado_id=3),
      'alertasStock',(SELECT count(*) FROM pmp.repuestos WHERE stock<=COALESCE(stock_critico,0))),
    'totalFiltrado',(SELECT count(*) FROM filtered),
    'recientes',(SELECT COALESCE(jsonb_agg(recent),'[]') FROM (
      SELECT f.id,f.fecha,f.codigo_os,COALESCE(f.tipo_equipo,fo.tipo_equipo) AS tipo_equipo,
        COALESCE(f.serie,fo.validador_serie,fo.consola_serie) AS serie,
        CASE f.tipo WHEN 'RECEPCION_INICIAL' THEN 'Recepción inicial confirmada'
          WHEN 'RECEPCION_TERRENO_BODEGA' THEN 'Recepción desde terreno'
          WHEN 'RECEPCION_LABORATORIO_BODEGA' THEN 'Recepción desde Laboratorio'
          WHEN 'RECEPCION_QA_BODEGA' THEN 'Recepción desde QA'
          WHEN 'SALIDA_BODEGA_TERRENO' THEN 'Despacho a terreno confirmado'
          WHEN 'SALIDA_BODEGA_LABORATORIO' THEN 'Envío a Laboratorio confirmado'
          WHEN 'SALIDA_BODEGA_QA' THEN 'Envío a QA confirmado' END AS titulo
      FROM pmp.flujo_eventos f LEFT JOIN pmp.ordenes_servicio fo ON fo.codigo_os=f.codigo_os
      WHERE f.tipo IN ('RECEPCION_INICIAL','RECEPCION_TERRENO_BODEGA','RECEPCION_LABORATORIO_BODEGA',
        'RECEPCION_QA_BODEGA','SALIDA_BODEGA_TERRENO','SALIDA_BODEGA_LABORATORIO','SALIDA_BODEGA_QA')
      AND EXISTS(SELECT 1 FROM filtered a WHERE a.tipo_equipo=COALESCE(f.tipo_equipo,fo.tipo_equipo)
        AND a.serie=COALESCE(f.serie,fo.validador_serie,fo.consola_serie))
      ORDER BY f.fecha DESC,f.id DESC LIMIT 6) recent),
    'items',(SELECT COALESCE(jsonb_agg(row),'[]') FROM (SELECT tipo_equipo,serie,modelo,marca,origen_registro,procedencia,fecha,
      codigo_os,bus_ppu,etapa,estado_actual,ubicacion_actual,disponible,en_bodega,escaneado_bodega FROM filtered
      ORDER BY tipo_equipo,serie LIMIT $10 OFFSET $11) row)) AS data`,
    [f.q,pattern,f.tipo,f.etapa,f.alcance,f.disponibilidad,f.modelo,f.origen,f.estado,f.limit,f.offset,f.pendiente]);
  const data=rows[0].data;
  data.distribucion=inventoryStages.map(([etapa,label])=>({etapa,label,validadores:0,consolas:0,total:0,...data.distribucion.find(d=>d.etapa===etapa)}));
  return {...data,limit:f.limit,offset:f.offset};
}
