BEGIN;
-- Registration metadata only. No backfill, state changes or historical renumbering.
ALTER TABLE pmp.validadores
  ADD COLUMN IF NOT EXISTS origen_registro varchar(80),
  ADD COLUMN IF NOT EXISTS fecha_ingreso timestamptz,
  ADD COLUMN IF NOT EXISTS observacion_registro text,
  ADD COLUMN IF NOT EXISTS registrado_por uuid REFERENCES pmp.usuarios(id);
ALTER TABLE pmp.consolas
  ADD COLUMN IF NOT EXISTS origen_registro varchar(80),
  ADD COLUMN IF NOT EXISTS fecha_ingreso timestamptz,
  ADD COLUMN IF NOT EXISTS observacion_registro text,
  ADD COLUMN IF NOT EXISTS registrado_por uuid REFERENCES pmp.usuarios(id);
COMMIT;
