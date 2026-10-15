\set ON_ERROR_STOP on
BEGIN;
\ir 001_bridge_mantenimiento_schema.sql

DO $$
BEGIN
  IF to_regclass('pmp.bridges') IS NULL
     OR to_regclass('pmp.bridge_mantenimiento') IS NULL
     OR to_regclass('pmp.instalaciones_equipos') IS NULL
     OR to_regclass('pmp.qa_inspecciones') IS NULL
     OR to_regclass('pmp.flujo_eventos') IS NULL THEN
    RAISE EXCEPTION 'La migración Bridge no creó toda la estructura requerida.';
  END IF;
END;
$$;

COMMIT;
