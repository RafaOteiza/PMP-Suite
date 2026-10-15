\set ON_ERROR_STOP on
BEGIN;
\ir 001_bridge_mantenimiento_schema.sql

SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'pmp'
  AND table_name IN (
    'bridges',
    'bridge_mantenimiento',
    'instalaciones_equipos',
    'qa_inspecciones',
    'flujo_eventos'
  )
ORDER BY table_name;

SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'pmp'
  AND table_name = 'ordenes_servicio'
  AND column_name IN ('qa_usuario_id', 'qa_asignado_por', 'qa_asignado_en')
ORDER BY column_name;

SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'pmp'
  AND table_name = 'registro_reparaciones'
  AND column_name IN ('prueba_realizada', 'resultado_prueba')
ORDER BY column_name;

ROLLBACK;
