CREATE SEQUENCE IF NOT EXISTS pmp.seq_bridge START WITH 1 INCREMENT BY 1;

CREATE OR REPLACE FUNCTION pmp.generar_codigo_bridge()
RETURNS text
LANGUAGE sql
AS $$
  SELECT 'BR-' || to_char(CURRENT_DATE, 'YYYY') || '-' || lpad(nextval('pmp.seq_bridge')::text, 6, '0');
$$;

CREATE TABLE IF NOT EXISTS pmp.bridges (
  codigo_bridge varchar(32) PRIMARY KEY DEFAULT pmp.generar_codigo_bridge(),
  estado varchar(32) NOT NULL DEFAULT 'ASIGNADA'
    CHECK (estado IN ('PENDIENTE_ASIGNACION', 'ASIGNADA', 'EN_TERRENO', 'COMPLETADA', 'CANCELADA')),
  origen varchar(16) NOT NULL DEFAULT 'PMP'
    CHECK (origen IN ('PMP', 'EXTERNO')),
  sistema_externo varchar(50),
  referencia_externa varchar(120),
  tipo_equipo varchar(20) NOT NULL
    CHECK (tipo_equipo IN ('VALIDADOR', 'CONSOLA')),
  equipo_preparado_serie varchar(50) NOT NULL,
  bus_esperado varchar(10) REFERENCES pmp.buses(ppu),
  terminal_esperado_id integer REFERENCES pmp.terminales(id),
  pst_esperado_codigo varchar(20) REFERENCES pmp.pst(codigo),
  motivo text NOT NULL,
  observacion_logistica text,
  tecnico_terreno_id uuid NOT NULL REFERENCES pmp.usuarios(id),
  creado_por uuid NOT NULL REFERENCES pmp.usuarios(id),
  creado_en timestamptz NOT NULL DEFAULT now(),
  asignado_por uuid NOT NULL REFERENCES pmp.usuarios(id),
  asignado_en timestamptz NOT NULL DEFAULT now(),
  iniciado_en timestamptz,
  equipo_retirado_serie varchar(50),
  equipo_instalado_serie varchar(50),
  bus_confirmado varchar(10) REFERENCES pmp.buses(ppu),
  terminal_confirmada_id integer REFERENCES pmp.terminales(id),
  pst_confirmado_codigo varchar(20) REFERENCES pmp.pst(codigo),
  intervencion_en timestamptz,
  observacion_terreno text,
  resultado varchar(20) CHECK (resultado IN ('EXITOSA', 'FALLIDA')),
  evidencia_url text,
  completado_en timestamptz,
  cancelado_por uuid REFERENCES pmp.usuarios(id),
  cancelado_en timestamptz,
  motivo_cancelacion text,
  CHECK (
    (origen = 'PMP' AND sistema_externo IS NULL AND referencia_externa IS NULL)
    OR origen = 'EXTERNO'
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_bridge_equipo_preparado_activo
  ON pmp.bridges (tipo_equipo, equipo_preparado_serie)
  WHERE estado IN ('PENDIENTE_ASIGNACION', 'ASIGNADA', 'EN_TERRENO');

CREATE TABLE IF NOT EXISTS pmp.bridge_mantenimiento (
  bridge_codigo varchar(32) PRIMARY KEY REFERENCES pmp.bridges(codigo_bridge),
  codigo_os varchar(50) NOT NULL UNIQUE REFERENCES pmp.ordenes_servicio(codigo_os),
  creado_en timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pmp.instalaciones_equipos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bridge_codigo varchar(32) NOT NULL UNIQUE REFERENCES pmp.bridges(codigo_bridge),
  tipo_equipo varchar(20) NOT NULL CHECK (tipo_equipo IN ('VALIDADOR', 'CONSOLA')),
  equipo_retirado_serie varchar(50) NOT NULL,
  equipo_instalado_serie varchar(50) NOT NULL,
  bus_ppu varchar(10) NOT NULL REFERENCES pmp.buses(ppu),
  terminal_id integer NOT NULL REFERENCES pmp.terminales(id),
  pst_codigo varchar(20) NOT NULL REFERENCES pmp.pst(codigo),
  tecnico_terreno_id uuid NOT NULL REFERENCES pmp.usuarios(id),
  intervencion_en timestamptz NOT NULL,
  observacion text,
  evidencia_url text,
  creado_en timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE pmp.ordenes_servicio
  ADD COLUMN IF NOT EXISTS qa_usuario_id uuid REFERENCES pmp.usuarios(id),
  ADD COLUMN IF NOT EXISTS qa_asignado_por uuid REFERENCES pmp.usuarios(id),
  ADD COLUMN IF NOT EXISTS qa_asignado_en timestamptz;

ALTER TABLE pmp.registro_reparaciones
  ADD COLUMN IF NOT EXISTS prueba_realizada text,
  ADD COLUMN IF NOT EXISTS resultado_prueba text;

CREATE TABLE IF NOT EXISTS pmp.qa_inspecciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo_os varchar(50) NOT NULL REFERENCES pmp.ordenes_servicio(codigo_os),
  qa_usuario_id uuid NOT NULL REFERENCES pmp.usuarios(id),
  resultado varchar(16) NOT NULL CHECK (resultado IN ('APROBADO', 'RECHAZADO')),
  comentario text,
  certificacion text,
  fecha timestamptz NOT NULL DEFAULT now(),
  CHECK (resultado = 'APROBADO' OR length(btrim(coalesce(comentario, ''))) >= 3)
);

CREATE INDEX IF NOT EXISTS idx_qa_inspecciones_os_fecha
  ON pmp.qa_inspecciones (codigo_os, fecha DESC);

CREATE TABLE IF NOT EXISTS pmp.flujo_eventos (
  id bigserial PRIMARY KEY,
  bridge_codigo varchar(32) REFERENCES pmp.bridges(codigo_bridge),
  codigo_os varchar(50) REFERENCES pmp.ordenes_servicio(codigo_os),
  tipo varchar(64) NOT NULL,
  usuario_id uuid NOT NULL REFERENCES pmp.usuarios(id),
  rol varchar(50) NOT NULL,
  fecha timestamptz NOT NULL DEFAULT now(),
  comentario text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CHECK (bridge_codigo IS NOT NULL OR codigo_os IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_flujo_eventos_bridge
  ON pmp.flujo_eventos (bridge_codigo, fecha, id);
CREATE INDEX IF NOT EXISTS idx_flujo_eventos_os
  ON pmp.flujo_eventos (codigo_os, fecha, id);

CREATE OR REPLACE FUNCTION pmp.bloquear_historico_append_only()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'El registro histórico de % es inmutable.', TG_TABLE_NAME;
END;
$$;

CREATE OR REPLACE FUNCTION pmp.bloquear_bridge_cerrada()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.estado IN ('COMPLETADA', 'CANCELADA') THEN
    RAISE EXCEPTION 'La Bridge % está cerrada y sus datos son inmutables.', OLD.codigo_bridge;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bridge_cerrada_inmutable ON pmp.bridges;
CREATE TRIGGER trg_bridge_cerrada_inmutable
  BEFORE UPDATE OR DELETE ON pmp.bridges
  FOR EACH ROW EXECUTE FUNCTION pmp.bloquear_bridge_cerrada();

DROP TRIGGER IF EXISTS trg_instalaciones_append_only ON pmp.instalaciones_equipos;
CREATE TRIGGER trg_instalaciones_append_only
  BEFORE UPDATE OR DELETE ON pmp.instalaciones_equipos
  FOR EACH ROW EXECUTE FUNCTION pmp.bloquear_historico_append_only();

DROP TRIGGER IF EXISTS trg_qa_append_only ON pmp.qa_inspecciones;
CREATE TRIGGER trg_qa_append_only
  BEFORE UPDATE OR DELETE ON pmp.qa_inspecciones
  FOR EACH ROW EXECUTE FUNCTION pmp.bloquear_historico_append_only();

DROP TRIGGER IF EXISTS trg_flujo_eventos_append_only ON pmp.flujo_eventos;
CREATE TRIGGER trg_flujo_eventos_append_only
  BEFORE UPDATE OR DELETE ON pmp.flujo_eventos
  FOR EACH ROW EXECUTE FUNCTION pmp.bloquear_historico_append_only();
