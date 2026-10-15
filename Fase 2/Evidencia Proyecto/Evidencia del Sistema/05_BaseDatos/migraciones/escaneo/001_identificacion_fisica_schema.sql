ALTER TABLE pmp.validadores
  ADD COLUMN IF NOT EXISTS amid varchar(32);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conname = 'ck_validadores_amid_formato'
       AND conrelid = 'pmp.validadores'::regclass
  ) THEN
    ALTER TABLE pmp.validadores
      ADD CONSTRAINT ck_validadores_amid_formato
      CHECK (amid IS NULL OR amid ~ '^[0-9]{12}$');
  END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_validadores_amid
  ON pmp.validadores (amid)
  WHERE amid IS NOT NULL;

CREATE TABLE IF NOT EXISTS pmp.escaneos_equipos (
  id bigserial PRIMARY KEY,
  codigo_leido varchar(64) NOT NULL,
  tipo_codigo varchar(16) NOT NULL
    CHECK (tipo_codigo IN ('SERIE', 'AMID')),
  estacion varchar(20) NOT NULL
    CHECK (estacion IN ('BODEGA', 'LABORATORIO', 'QA')),
  tipo_equipo varchar(20)
    CHECK (tipo_equipo IS NULL OR tipo_equipo IN ('VALIDADOR', 'CONSOLA')),
  serie varchar(50),
  amid varchar(32),
  codigo_os varchar(50) REFERENCES pmp.ordenes_servicio(codigo_os),
  ubicacion_id integer NOT NULL REFERENCES pmp.ubicaciones(id),
  usuario_id uuid NOT NULL REFERENCES pmp.usuarios(id),
  rol varchar(50) NOT NULL,
  resultado varchar(16) NOT NULL
    CHECK (resultado IN ('VALIDADO', 'RECHAZADO')),
  motivo varchar(64),
  fecha timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CHECK (
    (resultado = 'VALIDADO' AND tipo_equipo IS NOT NULL AND serie IS NOT NULL AND codigo_os IS NOT NULL AND motivo IS NULL)
    OR
    (resultado = 'RECHAZADO' AND motivo IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_escaneos_equipo_fecha
  ON pmp.escaneos_equipos (tipo_equipo, serie, fecha DESC, id DESC)
  WHERE resultado = 'VALIDADO';

CREATE INDEX IF NOT EXISTS idx_escaneos_os_fecha
  ON pmp.escaneos_equipos (codigo_os, fecha DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_escaneos_estacion_fecha
  ON pmp.escaneos_equipos (estacion, fecha DESC, id DESC);

CREATE OR REPLACE VIEW pmp.v_ubicacion_fisica_equipos AS
SELECT DISTINCT ON (tipo_equipo, serie)
       tipo_equipo,
       serie,
       amid,
       codigo_os,
       ubicacion_id,
       estacion,
       fecha AS confirmada_en,
       usuario_id,
       id AS escaneo_id
  FROM pmp.escaneos_equipos
 WHERE resultado = 'VALIDADO'
 ORDER BY tipo_equipo, serie, fecha DESC, id DESC;

CREATE OR REPLACE FUNCTION pmp.bloquear_historico_append_only()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'El registro histórico de % es inmutable.', TG_TABLE_NAME;
END;
$$;

DROP TRIGGER IF EXISTS trg_escaneos_equipos_append_only ON pmp.escaneos_equipos;
CREATE TRIGGER trg_escaneos_equipos_append_only
  BEFORE UPDATE OR DELETE ON pmp.escaneos_equipos
  FOR EACH ROW EXECUTE FUNCTION pmp.bloquear_historico_append_only();
