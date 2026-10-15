\set ON_ERROR_STOP on
BEGIN;

-- ADVERTENCIA: este rollback elimina el historial de escaneos. Revisar conteos antes de COMMIT.
SELECT COUNT(*)::int AS escaneos_existentes FROM pmp.escaneos_equipos;

DROP VIEW IF EXISTS pmp.v_ubicacion_fisica_equipos;
DROP TABLE IF EXISTS pmp.escaneos_equipos;
DROP INDEX IF EXISTS pmp.uq_validadores_amid;
ALTER TABLE pmp.validadores DROP CONSTRAINT IF EXISTS ck_validadores_amid_formato;
ALTER TABLE pmp.validadores DROP COLUMN IF EXISTS amid;

ROLLBACK;
