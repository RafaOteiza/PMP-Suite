\set ON_ERROR_STOP on
BEGIN;
\ir 001_identificacion_fisica_schema.sql

DO $$
BEGIN
  IF to_regclass('pmp.escaneos_equipos') IS NULL
     OR to_regclass('pmp.uq_validadores_amid') IS NULL THEN
    RAISE EXCEPTION 'La migración de identificación física no creó la estructura requerida.';
  END IF;
END;
$$;

COMMIT;
