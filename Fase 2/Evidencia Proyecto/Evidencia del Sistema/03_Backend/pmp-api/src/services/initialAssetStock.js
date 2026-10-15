// Initial availability is backed by physical asset events, never a maintenance OS.
export const initialAssetStockSql = `SELECT f.id AS stock_origen_evento,f.tipo_equipo,f.serie,f.fecha,
  COALESCE(v.modelo,c.modelo) AS modelo,COALESCE(v.marca,c.marca) AS marca,
  NULL::varchar AS codigo_os,NULL::varchar AS bus_ppu,NULL::integer AS estado_id,
  'DISPONIBLE_INSTALACION'::text AS estado_nombre,'Recepción inicial conforme'::text AS falla,
  false AS es_instalacion,NULL::boolean AS es_aprobado_qa,true AS validacion_inicial_conforme,
  u.id AS ubicacion_id,u.nombre AS ubicacion,false AS escaneado_bodega,true AS elegible
  FROM pmp.flujo_eventos f
  LEFT JOIN pmp.validadores v ON v.serie=f.serie AND f.tipo_equipo='VALIDADOR'
  LEFT JOIN pmp.consolas c ON c.serie=f.serie AND f.tipo_equipo='CONSOLA'
  LEFT JOIN pmp.escaneos_equipos evidence ON evidence.id::text=f.metadata->>'escaneo_id'
    AND evidence.tipo_equipo=f.tipo_equipo AND evidence.serie=f.serie
    AND evidence.resultado='VALIDADO' AND evidence.estacion='BODEGA' AND evidence.codigo_os IS NULL
    AND evidence.metadata->>'circuito'='ACTIVO_NUEVO' AND evidence.metadata->>'origen_captura'='SCANNER'
  LEFT JOIN pmp.flujo_eventos manual ON manual.id::text=f.metadata->>'validacion_id'
    AND manual.tipo='VALIDACION_BODEGA' AND manual.codigo_os IS NULL
    AND manual.tipo_equipo=f.tipo_equipo AND manual.serie=f.serie
    AND manual.usuario_id=f.usuario_id AND manual.rol IN ('admin','logistica')
    AND manual.metadata->>'circuito'='ACTIVO_NUEVO'
    AND manual.metadata->>'contexto'='RECEPCION_INICIAL'
    AND manual.metadata->>'origen_captura'='MANUAL_AUTORIZADO'
    AND manual.metadata->>'presencia_fisica_confirmada'='true'
    AND manual.metadata->>'codigo_leido'=f.serie
    AND f.metadata->>'origen_captura'='MANUAL_AUTORIZADO'
  JOIN pmp.ubicaciones u ON u.id::text=COALESCE(evidence.ubicacion_id::text,manual.metadata->>'ubicacion_id') AND u.tipo='BODEGA'
  WHERE f.tipo='HABILITADO_INSTALACION' AND f.codigo_os IS NULL
    AND (evidence.id IS NOT NULL OR manual.id IS NOT NULL)
    AND f.metadata->>'validacion_inicial_conforme'='true'
    AND NOT EXISTS(SELECT 1 FROM pmp.ordenes_servicio o WHERE o.tipo_equipo=f.tipo_equipo
      AND COALESCE(o.validador_serie,o.consola_serie)=f.serie)
    AND COALESCE((SELECT s.estacion FROM pmp.escaneos_equipos s WHERE s.tipo_equipo=f.tipo_equipo AND s.serie=f.serie
      AND s.resultado='VALIDADO' AND s.fecha>=COALESCE(evidence.fecha,manual.fecha)
      ORDER BY s.fecha DESC,s.id DESC LIMIT 1),'BODEGA')='BODEGA'`;
