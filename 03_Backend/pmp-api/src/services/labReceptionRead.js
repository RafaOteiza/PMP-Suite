import { FlowError } from './bridgeFlow.js';
import { labAvailableSql, labTransitSql, labCycleSql, labReceiptSql, lastLabExitSql } from './labArrival.js';

// Read model only: the custody service remains the sole authority for physical operations.
export const labReceptionFactsSql = `SELECT o.codigo_os,o.tipo_equipo,
 COALESCE(o.validador_serie,o.consola_serie) serie,COALESCE(v.modelo,c.modelo) modelo,
 COALESCE(v.marca,c.marca) marca,o.falla,o.bus_ppu,o.fecha,o.estado_id,o.tecnico_laboratorio_id,
 concat_ws(' ',tech.nombre,tech.apellido) tecnico_laboratorio,t.nombre terminal,p.nombre operador,
 co.codigo_caso,co.referencia_externa referencia_ar,
 ${labCycleSql()} ciclo,${lastLabExitSql()} fecha_salida,${labReceiptSql()} fecha_recepcion,
 ${labTransitSql()} en_camino,${labAvailableSql()} recibido,
 (SELECT count(*) FROM pmp.flujo_eventos f WHERE f.codigo_os=o.codigo_os AND f.tipo='RECEPCION_LABORATORIO_CONFIRMADA') ingresos,
 (SELECT f.fecha FROM pmp.flujo_eventos f WHERE f.codigo_os=o.codigo_os
  AND f.tipo IN ('VALIDACION_CUSTODIA_LABORATORIO','DISCREPANCIA_CUSTODIA_LABORATORIO')
  AND f.metadata->>'proposito'='RECEPCION' AND f.metadata->>'ciclo'=${labCycleSql()}
  ORDER BY f.id DESC LIMIT 1) fecha_validacion,
 (SELECT f.tipo='DISCREPANCIA_CUSTODIA_LABORATORIO' FROM pmp.flujo_eventos f WHERE f.codigo_os=o.codigo_os
  AND f.tipo IN ('VALIDACION_CUSTODIA_LABORATORIO','DISCREPANCIA_CUSTODIA_LABORATORIO')
  AND f.metadata->>'proposito'='RECEPCION' AND f.metadata->>'ciclo'=${labCycleSql()}
  ORDER BY f.id DESC LIMIT 1) discrepancia
 FROM pmp.ordenes_servicio o
 LEFT JOIN pmp.validadores v ON v.serie=o.validador_serie
 LEFT JOIN pmp.consolas c ON c.serie=o.consola_serie
 LEFT JOIN pmp.usuarios tech ON tech.id=o.tecnico_laboratorio_id
 LEFT JOIN pmp.terminales t ON t.id=o.terminal_id LEFT JOIN pmp.pst p ON p.codigo=o.pst_codigo
 LEFT JOIN pmp.casos_operacionales co ON co.id=o.caso_id`;

export function receptionQuery(query={}) {
 const text=(key,max=120)=>{const v=query[key]??'';if(typeof v!=='string'||v.length>max)throw new FlowError(422,'INVALID_QUERY','Filtro de recepción inválido');return v.trim();};
 const tab=text('tab')||'camino',tipo=text('tipo'),q=text('q');
 if(!['camino','recibidos','incidencias','historial'].includes(tab)||!['','VALIDADOR','CONSOLA'].includes(tipo))throw new FlowError(422,'INVALID_QUERY','Filtro de recepción inválido');
 const integer=(key,fallback,max)=>{const v=query[key]??String(fallback);if(!/^\d+$/.test(String(v))||Number(v)>max)throw new FlowError(422,'INVALID_QUERY','Paginación inválida');return Number(v);};
 const limit=integer('limit',20,50),offset=integer('offset',0,1000000),hoy=text('hoy');
 if(!['','1'].includes(hoy))throw new FlowError(422,'INVALID_QUERY','Filtro de fecha inválido');
 if(!limit)throw new FlowError(422,'INVALID_QUERY','Límite inválido');
 return {tab,tipo,q,limit,offset,hoy};
}

export async function readLabReception(client,query={}) {
 const f=receptionQuery(query);
 const {rows}=await client.query(`WITH lab AS (${labReceptionFactsSql}),
 entries AS (
  SELECT l.*,NULL::text evento_id,CASE WHEN $1='camino' THEN fecha_salida WHEN $1='incidencias' THEN fecha_validacion ELSE fecha_recepcion END fecha_evento
  FROM lab l WHERE ($1='camino' AND en_camino) OR ($1='recibidos' AND recibido)
    OR ($1='incidencias' AND en_camino AND discrepancia IS TRUE)
  UNION ALL
  SELECT l.codigo_os,l.tipo_equipo,l.serie,l.modelo,l.marca,l.falla,l.bus_ppu,l.fecha,l.estado_id,l.tecnico_laboratorio_id,
   l.tecnico_laboratorio,l.terminal,l.operador,l.codigo_caso,l.referencia_ar,l.ciclo,l.fecha_salida,f.fecha,
   l.en_camino,l.recibido,l.ingresos,l.fecha_validacion,l.discrepancia,f.id::text,f.fecha
  FROM lab l JOIN pmp.flujo_eventos f ON f.codigo_os=l.codigo_os AND f.tipo='RECEPCION_LABORATORIO_CONFIRMADA' WHERE $1='historial'
 ), filtered AS (SELECT * FROM entries WHERE ($2='' OR tipo_equipo=$2)
  AND ($3='' OR concat_ws(' ',codigo_os,serie,codigo_caso,referencia_ar) ILIKE $4)
  AND ($7='' OR (fecha_evento AT TIME ZONE 'America/Santiago')::date=(now() AT TIME ZONE 'America/Santiago')::date))
 SELECT jsonb_build_object('updatedAt',now(),'counts',jsonb_build_object(
  'camino',(SELECT count(*) FROM lab WHERE en_camino),
  'recibidos',(SELECT count(*) FROM lab WHERE recibido),
  'hoy',(SELECT count(*) FROM pmp.flujo_eventos WHERE tipo='RECEPCION_LABORATORIO_CONFIRMADA'
    AND (fecha AT TIME ZONE 'America/Santiago')::date=(now() AT TIME ZONE 'America/Santiago')::date),
  'pendientes',(SELECT count(*) FROM lab WHERE recibido AND estado_id IN (4,5,9) AND tecnico_laboratorio_id IS NULL),
  'incidencias',(SELECT count(*) FROM lab WHERE en_camino AND discrepancia IS TRUE),
  'historial',(SELECT count(*) FROM pmp.flujo_eventos WHERE tipo='RECEPCION_LABORATORIO_CONFIRMADA')),
  'total',(SELECT count(*) FROM filtered),
  'items',(SELECT COALESCE(jsonb_agg(r),'[]') FROM (SELECT * FROM filtered ORDER BY fecha_evento DESC NULLS LAST,codigo_os,evento_id LIMIT $5 OFFSET $6) r)) data`,
  [f.tab,f.tipo,f.q,'%'+f.q.replace(/[\\%_]/g,'\\$&')+'%',f.limit,f.offset,f.hoy]);
 return {...rows[0].data,limit:f.limit,offset:f.offset};
}
