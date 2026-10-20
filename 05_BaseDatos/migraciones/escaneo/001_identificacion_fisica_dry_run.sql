\set ON_ERROR_STOP on
BEGIN;
\ir 001_identificacion_fisica_schema.sql

SELECT column_name, data_type, is_nullable
  FROM information_schema.columns
 WHERE table_schema = 'pmp'
   AND table_name = 'validadores'
   AND column_name = 'amid';

SELECT to_regclass('pmp.escaneos_equipos') AS tabla_escaneos,
       to_regclass('pmp.uq_validadores_amid') AS indice_amid;

SELECT COUNT(*)::int AS validadores,
       COUNT(amid)::int AS validadores_con_amid
  FROM pmp.validadores;

ROLLBACK;
