import { labTransitSql } from './labArrival.js';
import { pendingTerrainSql } from './logisticsPresentation.js';
// Exact union of the three visible warehouse lanes; each OS contributes once.
export function warehouseQueueSql(o='o'){
 return `(NOT ${labTransitSql(o)} AND NOT ${pendingTerrainSql(o)} AND (
   ${o}.estado_id IN (2,11) OR (${o}.estado_id=3 AND (
     ${o}.es_aprobado_qa IS FALSE OR ${warehouseQaReadySql(o)} OR
     NOT EXISTS(SELECT 1 FROM pmp.registro_reparaciones r WHERE r.codigo_os=${o}.codigo_os)
   ))))`;
}

// Physical receipt of the repaired asset. Legacy rows may use a real warehouse scan,
// but a scan is not a replacement for explicit receipt after a newly audited lab exit.
export function warehouseQaReadySql(o='o'){
 const exit=`(SELECT max(f.fecha) FROM pmp.flujo_eventos f WHERE f.codigo_os=${o}.codigo_os AND f.tipo='SALIDA_LABORATORIO_BODEGA')`;
 return `(${o}.estado_id=3 AND ${o}.es_aprobado_qa IS NULL
 AND EXISTS(SELECT 1 FROM pmp.ubicaciones u WHERE u.id=${o}.ubicacion_id AND u.tipo='BODEGA')
 AND EXISTS(SELECT 1 FROM pmp.registro_reparaciones r WHERE r.codigo_os=${o}.codigo_os)
 AND (EXISTS(SELECT 1 FROM pmp.flujo_eventos f WHERE f.codigo_os=${o}.codigo_os AND f.tipo='RECEPCION_LABORATORIO_BODEGA'
     AND f.fecha>=COALESCE(${exit},'-infinity'::timestamptz))
 OR (${exit} IS NULL AND EXISTS(SELECT 1 FROM pmp.escaneos_equipos s WHERE s.codigo_os=${o}.codigo_os AND s.estacion='BODEGA' AND s.resultado='VALIDADO'
     AND s.tipo_equipo=${o}.tipo_equipo AND s.serie=COALESCE(${o}.validador_serie,${o}.consola_serie)
     AND s.fecha>=COALESCE((SELECT max(r.fecha_registro) FROM pmp.registro_reparaciones r WHERE r.codigo_os=${o}.codigo_os),'-infinity'::timestamptz)))))`;
}
