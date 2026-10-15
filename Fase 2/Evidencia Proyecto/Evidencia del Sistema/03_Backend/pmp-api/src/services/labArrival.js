// Custody read model: dispatch is never evidence of laboratory receipt.
export const lastLabExitSql=(o='o')=>`(SELECT MAX(f.fecha) FROM pmp.flujo_eventos f WHERE f.codigo_os=${o}.codigo_os AND f.tipo='SALIDA_BODEGA_LABORATORIO')`;
export const labCycleSql=(o='o')=>`COALESCE((SELECT max(f.id)::text FROM pmp.flujo_eventos f WHERE f.codigo_os=${o}.codigo_os AND f.tipo='SALIDA_BODEGA_LABORATORIO'),'legacy')`;
// Confirmed custody, never a preliminary validation or a scan at the origin.
// Old explicit receipt events remain valid history; records without any dispatch use the labelled legacy fallback.
export const labReceiptSql=(o='o')=>`(SELECT MAX(f.fecha) FROM pmp.flujo_eventos f
 WHERE f.codigo_os=${o}.codigo_os AND f.tipo='RECEPCION_LABORATORIO_CONFIRMADA'
 AND f.fecha>COALESCE(${lastLabExitSql(o)},'-infinity'::timestamptz)
 AND (f.metadata->>'ciclo' IS NULL OR f.metadata->>'ciclo'=${labCycleSql(o)}))`;
export const labTransitSql=(o='o')=>`(${o}.estado_id IN (2,4,5,9,10) AND ${lastLabExitSql(o)} IS NOT NULL AND ${labReceiptSql(o)} IS NULL)`;
export const labAvailableSql=(o='o')=>`(${o}.estado_id IN (4,5,9,10) AND NOT ${labTransitSql(o)}
 AND EXISTS(SELECT 1 FROM pmp.ubicaciones l WHERE l.id=${o}.ubicacion_id AND l.tipo='LABORATORIO'))`;
export const labArrivalJoin=`LEFT JOIN LATERAL (
 SELECT ${labReceiptSql()} AS fecha,
 CASE WHEN ${labReceiptSql()} IS NOT NULL THEN 'RECEPCION_FISICA' ELSE NULL END AS fuente,
 (SELECT COUNT(*)>1 FROM pmp.flujo_eventos f WHERE f.codigo_os=o.codigo_os AND f.tipo='SALIDA_BODEGA_LABORATORIO') AS reingreso,
 (${lastLabExitSql()} IS NULL AND ${labReceiptSql()} IS NULL) AS legacy,
 ${labTransitSql()} AS en_transito
) ingreso ON TRUE`;
