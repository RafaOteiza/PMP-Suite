import {qaStateSql} from './qaCustody.js';
import { labTransitSql } from './labArrival.js';
// Read-model predicates only. State IDs and operational transitions stay unchanged.
export function pendingTerrainSql(order = 'o') {
  // Compatibility for requirements created in transit before a physical withdrawal existed.
  return `(${order}.es_instalacion IS NOT TRUE AND ${order}.estado_id IN (1,2) AND ${order}.ubicacion_id IS NULL
    AND EXISTS(SELECT 1 FROM pmp.flujo_eventos req WHERE req.codigo_os IN (${order}.codigo_os,${order}.os_origen) AND req.tipo='REQUERIMIENTO_INGRESADO')
    AND NOT EXISTS(SELECT 1 FROM pmp.flujo_eventos r WHERE r.codigo_os IN (${order}.codigo_os,${order}.os_origen) AND r.tipo IN ('RETIRO_TERRENO_CONFIRMADO','SALIDA_BODEGA_TERRENO'))
    AND NOT EXISTS(SELECT 1 FROM pmp.escaneos_equipos s WHERE s.codigo_os IN (${order}.codigo_os,${order}.os_origen) AND s.resultado='VALIDADO')
  )`;
}
export function terrainDispatchSql(order = 'o') {
  const scanner = `(${order}.estado_id = 1 AND ${order}.ubicacion_id IS NULL AND EXISTS (
    SELECT 1 FROM pmp.flujo_eventos salida
      JOIN pmp.escaneos_equipos evidencia ON evidencia.id::text=salida.metadata->>'escaneo_id'
    WHERE salida.codigo_os = ${order}.codigo_os AND salida.tipo = 'SALIDA_BODEGA_TERRENO'
      AND evidencia.estacion='BODEGA' AND evidencia.resultado='VALIDADO'
      AND evidencia.tipo_equipo=${order}.tipo_equipo
      AND evidencia.serie=COALESCE(${order}.validador_serie,${order}.consola_serie)
      AND salida.metadata->>'escaneo_id' = (
        SELECT s.id::text FROM pmp.escaneos_equipos s
        WHERE ((s.codigo_os = COALESCE(${order}.stock_origen_os,${order}.codigo_os) AND ${order}.stock_origen_evento IS NULL)
          OR (${order}.stock_origen_evento IS NOT NULL AND s.codigo_os IS NULL
            AND s.tipo_equipo=${order}.tipo_equipo AND s.serie=COALESCE(${order}.validador_serie,${order}.consola_serie))) AND s.resultado = 'VALIDADO'
        ORDER BY s.fecha DESC,s.id DESC LIMIT 1
      )
      AND (${order}.stock_origen_os IS NULL OR salida.metadata->>'stock_os'=${order}.stock_origen_os)
      AND (${order}.stock_origen_evento IS NULL OR salida.metadata->>'stock_evento'=${order}.stock_origen_evento::text)
  ))`;
  return `(${scanner} OR (${order}.estado_id=1 AND ${order}.ubicacion_id IS NULL AND ${order}.es_instalacion IS TRUE AND EXISTS (
    SELECT 1 FROM pmp.flujo_eventos salida JOIN pmp.flujo_eventos manual ON manual.id::text=salida.metadata->>'validacion_id'
    WHERE salida.codigo_os=${order}.codigo_os AND salida.tipo='SALIDA_BODEGA_TERRENO'
      AND salida.metadata->>'origen_captura'='MANUAL_AUTORIZADO' AND manual.tipo='VALIDACION_BODEGA'
      AND manual.metadata->>'origen_captura'='MANUAL_AUTORIZADO' AND manual.metadata->>'contexto'='DESPACHO_TERRENO'
      AND manual.metadata->>'presencia_fisica_confirmada'='true' AND manual.metadata->>'codigo_leido'=manual.serie
      AND manual.usuario_id=salida.usuario_id AND manual.rol IN ('admin','logistica')
      AND manual.tipo_equipo=${order}.tipo_equipo AND manual.serie=COALESCE(${order}.validador_serie,${order}.consola_serie)
      AND manual.codigo_os IS NOT DISTINCT FROM ${order}.stock_origen_os
      AND (manual.metadata->>'caso_id') IS NOT DISTINCT FROM ${order}.caso_id::text AND (manual.metadata->>'os_origen') IS NOT DISTINCT FROM ${order}.os_origen
      AND (${order}.stock_origen_evento IS NULL OR manual.metadata->>'stock_evento'=${order}.stock_origen_evento::text)
      AND EXISTS(SELECT 1 FROM pmp.ubicaciones b WHERE b.id::text=manual.metadata->>'ubicacion_id' AND b.tipo='BODEGA')
      AND NOT EXISTS(SELECT 1 FROM pmp.escaneos_equipos s WHERE s.tipo_equipo=manual.tipo_equipo AND s.serie=manual.serie AND s.resultado='VALIDADO' AND s.fecha>manual.fecha)
  )))`;
}

export function installationReadySql(order = 'o') {
  // Closed QA repair is the stock evidence. Legacy installation placeholders
  // remain eligible; no placeholder is created for new warehouse receipts.
  return `(((${order}.estado_id=13 AND ${order}.es_aprobado_qa IS TRUE)
      OR (${order}.estado_id=7 AND ${order}.tecnico_terreno_id IS NULL
        AND (${order}.es_aprobado_qa IS TRUE OR (${order}.es_aprobado_qa IS NULL AND ${order}.es_instalacion IS TRUE))))
    AND EXISTS (SELECT 1 FROM pmp.ubicaciones b WHERE b.id=${order}.ubicacion_id AND b.tipo='BODEGA')
    AND NOT EXISTS (SELECT 1 FROM pmp.ordenes_servicio incompatible
      WHERE incompatible.tipo_equipo=${order}.tipo_equipo
        AND COALESCE(incompatible.validador_serie,incompatible.consola_serie)=COALESCE(${order}.validador_serie,${order}.consola_serie)
        AND incompatible.codigo_os<>${order}.codigo_os AND incompatible.estado_id NOT IN (8,12,13))
    AND NOT EXISTS (SELECT 1 FROM pmp.ordenes_servicio consumed
      WHERE consumed.stock_origen_os=${order}.codigo_os)
    AND NOT EXISTS (SELECT 1 FROM pmp.ordenes_servicio newer
      WHERE newer.tipo_equipo=${order}.tipo_equipo
        AND COALESCE(newer.validador_serie,newer.consola_serie)=COALESCE(${order}.validador_serie,${order}.consola_serie)
        AND (newer.fecha,newer.codigo_os)>(${order}.fecha,${order}.codigo_os)))`;
}

export function assignedWithoutDispatchSql(order = 'o') {
  return `(${order}.estado_id IN (1,7) AND ${order}.tecnico_terreno_id IS NOT NULL AND NOT ${terrainDispatchSql(order)})`;
}

export function logisticsStateSql(order = 'o', state = 'e.nombre') {
  return `CASE
    WHEN ${order}.estado_id=6 THEN ${qaStateSql(order)}
    WHEN ${labTransitSql(order)} THEN 'En tránsito hacia Laboratorio'
    WHEN ${pendingTerrainSql(order)} THEN 'PENDIENTE_RETIRO'
    WHEN ${terrainDispatchSql(order)} THEN 'EN_RUTA'
    WHEN ${assignedWithoutDispatchSql(order)} THEN 'ASIGNADO_TECNICO'
    WHEN ${order}.estado_id = 1 THEN 'PENDIENTE_SALIDA'
    WHEN ${installationReadySql(order)} THEN 'DISPONIBLE_INSTALACION'
    WHEN ${order}.estado_id = 7 THEN 'PENDIENTE_VERIFICACION_BODEGA'
    ELSE ${state} END`;
}

// Same definition for the operating-equipment list and the executive KPI:
// Preserve the installed bus association until the pending field withdrawal.
export const operatingAssetsSql = `WITH hardware AS (
  SELECT 'VALIDADOR'::text AS tipo,serie,modelo,marca FROM pmp.validadores
  UNION ALL SELECT 'CONSOLA',serie,modelo,marca FROM pmp.consolas
), ultima_ppu AS (
  SELECT DISTINCT ON (tipo_equipo,COALESCE(validador_serie,consola_serie))
    tipo_equipo,COALESCE(validador_serie,consola_serie) AS serie,bus_ppu,fecha
    FROM pmp.ordenes_servicio WHERE nullif(btrim(bus_ppu),'') IS NOT NULL AND bus_ppu <> 'STOCK'
    ORDER BY tipo_equipo,COALESCE(validador_serie,consola_serie),fecha DESC,codigo_os DESC
) SELECT h.*,p.bus_ppu,p.fecha AS ultima_operacion FROM hardware h
  JOIN ultima_ppu p ON p.tipo_equipo=h.tipo AND p.serie=h.serie
  WHERE NOT EXISTS (SELECT 1 FROM pmp.ordenes_servicio a WHERE a.tipo_equipo=h.tipo
    AND COALESCE(a.validador_serie,a.consola_serie)=h.serie AND a.estado_id NOT IN (8,12,13) AND NOT ${pendingTerrainSql('a')})
  AND NOT EXISTS (SELECT 1 FROM pmp.ordenes_servicio stock WHERE stock.tipo_equipo=h.tipo
    AND COALESCE(stock.validador_serie,stock.consola_serie)=h.serie AND ${installationReadySql('stock')})`;
