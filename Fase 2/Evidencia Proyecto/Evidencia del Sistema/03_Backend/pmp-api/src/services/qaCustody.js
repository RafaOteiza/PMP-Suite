// Read-only custody projection. A new dispatch invalidates all previous-cycle evidence.
export const qaCycleSql=(o='o')=>`(SELECT max(f.id) FROM pmp.flujo_eventos f WHERE f.codigo_os=${o}.codigo_os AND f.tipo='SALIDA_BODEGA_QA')`;
const legacyReceiptSql=(o='o')=>`(SELECT min(s.fecha) FROM pmp.escaneos_equipos s WHERE s.codigo_os=${o}.codigo_os
 AND s.estacion='QA' AND s.resultado='VALIDADO' AND s.tipo_equipo=${o}.tipo_equipo
 AND s.serie=COALESCE(${o}.validador_serie,${o}.consola_serie)
 AND ((${qaCycleSql(o)} IS NOT NULL AND s.metadata->>'ciclo_qa'=${qaCycleSql(o)}::text)
 OR (${qaCycleSql(o)} IS NULL AND s.fecha>=COALESCE((SELECT max(prev.fecha) FROM pmp.escaneos_equipos prev WHERE prev.codigo_os=${o}.codigo_os AND prev.estacion<>'QA' AND prev.resultado='VALIDADO'),${o}.fecha))))`;
export const qaReceiptSql=(o='o')=>`COALESCE((SELECT min(f.fecha) FROM pmp.flujo_eventos f WHERE f.codigo_os=${o}.codigo_os AND f.tipo='RECEPCION_QA_CONFIRMADA' AND f.metadata->>'version'='3' AND f.metadata->>'ciclo_qa'=COALESCE(${qaCycleSql(o)}::text,'legacy')),${legacyReceiptSql(o)})`;
export const qaReceivedSql=(o='o')=>`(${o}.estado_id=6 AND ${qaReceiptSql(o)} IS NOT NULL AND EXISTS(SELECT 1 FROM pmp.ubicaciones u WHERE u.id=${o}.ubicacion_id AND u.tipo='QA'))`;
// Internal QA stages are persisted in existing append-only events, not new global states.
export const qaSnapshotSql=(o='o')=>`(SELECT f.metadata->'trabajo' FROM pmp.flujo_eventos f WHERE f.codigo_os=${o}.codigo_os AND f.metadata->>'version'='3' AND f.metadata ? 'trabajo' AND f.metadata->>'ciclo_qa'=COALESCE(${qaCycleSql(o)}::text,'legacy') ORDER BY f.id DESC LIMIT 1)`;
export const qaStageSql=(o='o')=>`CASE WHEN ${o}.estado_id<>6 THEN 'HISTORIAL' WHEN ${qaReceivedSql(o)} THEN COALESCE(${qaSnapshotSql(o)}->>'etapa','AMBIENTE') WHEN ${qaCycleSql(o)} IS NOT NULL AND ${qaReceiptSql(o)} IS NULL THEN 'RECEPCION' ELSE 'POR_VERIFICAR' END`;
export const qaStateSql=(o='o')=>`CASE ${qaStageSql(o)} WHEN 'RECEPCION' THEN 'En tránsito hacia QA' WHEN 'AMBIENTE' THEN 'Instalación Ambiente' WHEN 'PRUEBAS' THEN 'Pruebas QA' WHEN 'DESPACHO' THEN 'Pendiente de despacho QA' WHEN 'HISTORIAL' THEN 'Ciclo QA despachado' ELSE 'Por verificar' END`;
