\set ON_ERROR_STOP on
BEGIN;

DROP TRIGGER IF EXISTS trg_flujo_eventos_append_only ON pmp.flujo_eventos;
DROP TRIGGER IF EXISTS trg_qa_append_only ON pmp.qa_inspecciones;
DROP TRIGGER IF EXISTS trg_instalaciones_append_only ON pmp.instalaciones_equipos;
DROP TRIGGER IF EXISTS trg_bridge_cerrada_inmutable ON pmp.bridges;

DROP TABLE IF EXISTS pmp.flujo_eventos;
DROP TABLE IF EXISTS pmp.qa_inspecciones;
DROP TABLE IF EXISTS pmp.instalaciones_equipos;
DROP TABLE IF EXISTS pmp.bridge_mantenimiento;
DROP TABLE IF EXISTS pmp.bridges;

ALTER TABLE pmp.registro_reparaciones
  DROP COLUMN IF EXISTS prueba_realizada,
  DROP COLUMN IF EXISTS resultado_prueba;

ALTER TABLE pmp.ordenes_servicio
  DROP COLUMN IF EXISTS qa_usuario_id,
  DROP COLUMN IF EXISTS qa_asignado_por,
  DROP COLUMN IF EXISTS qa_asignado_en;

DROP FUNCTION IF EXISTS pmp.bloquear_bridge_cerrada();
DROP FUNCTION IF EXISTS pmp.bloquear_historico_append_only();
DROP FUNCTION IF EXISTS pmp.generar_codigo_bridge();
DROP SEQUENCE IF EXISTS pmp.seq_bridge;

COMMIT;
