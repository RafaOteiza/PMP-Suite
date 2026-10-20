BEGIN;
-- Additive: no UPDATE of historical OS, codes, references or events.
CREATE SEQUENCE IF NOT EXISTS pmp.seq_caso_interno;
CREATE TABLE IF NOT EXISTS pmp.casos_operacionales (
  id bigserial PRIMARY KEY,
  codigo_caso varchar(64) NOT NULL UNIQUE,
  origen varchar(32) NOT NULL,
  referencia_externa varchar(120),
  componente varchar(32) NOT NULL,
  tipo_equipo varchar(20) NOT NULL CHECK (tipo_equipo IN ('VALIDADOR','CONSOLA')),
  serie_origen varchar(50) NOT NULL,
  bus_ppu varchar(20) NOT NULL REFERENCES pmp.buses(ppu),
  terminal_id integer NOT NULL REFERENCES pmp.terminales(id),
  pst_codigo varchar(30) NOT NULL REFERENCES pmp.pst(codigo),
  falla_reportada text NOT NULL,
  observacion text,
  fecha_requerimiento timestamptz NOT NULL,
  creado_por uuid NOT NULL REFERENCES pmp.usuarios(id),
  creado_en timestamptz NOT NULL DEFAULT now(),
  siguiente_instalacion integer NOT NULL DEFAULT 1 CHECK (siguiente_instalacion > 0),
  CHECK (origen <> 'ARANDA' OR (referencia_externa = 'AR-' || componente AND componente ~ '^[0-9]{1,30}$'))
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_caso_origen_referencia
  ON pmp.casos_operacionales(origen,referencia_externa) WHERE referencia_externa IS NOT NULL;
CREATE OR REPLACE FUNCTION pmp.proteger_identidad_caso() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='DELETE' OR (to_jsonb(OLD)-'siguiente_instalacion') IS DISTINCT FROM (to_jsonb(NEW)-'siguiente_instalacion') THEN
    RAISE EXCEPTION 'La identidad y el requerimiento del caso son inmutables' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_proteger_identidad_caso ON pmp.casos_operacionales;
CREATE TRIGGER trg_proteger_identidad_caso BEFORE UPDATE OR DELETE ON pmp.casos_operacionales
  FOR EACH ROW EXECUTE FUNCTION pmp.proteger_identidad_caso();
ALTER TABLE pmp.ordenes_servicio
  ADD COLUMN IF NOT EXISTS caso_id bigint REFERENCES pmp.casos_operacionales(id),
  ADD COLUMN IF NOT EXISTS os_origen varchar(50) REFERENCES pmp.ordenes_servicio(codigo_os),
  ADD COLUMN IF NOT EXISTS stock_origen_os varchar(50) REFERENCES pmp.ordenes_servicio(codigo_os),
  ADD COLUMN IF NOT EXISTS instalacion_numero integer;
CREATE INDEX IF NOT EXISTS idx_os_caso ON pmp.ordenes_servicio(caso_id);
CREATE INDEX IF NOT EXISTS idx_os_stock_origen ON pmp.ordenes_servicio(stock_origen_os);
CREATE UNIQUE INDEX IF NOT EXISTS uq_caso_instalacion ON pmp.ordenes_servicio(caso_id,instalacion_numero)
  WHERE caso_id IS NOT NULL AND instalacion_numero IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_caso_intervencion_activo
  ON pmp.ordenes_servicio(caso_id,tipo_equipo,COALESCE(validador_serie,consola_serie),COALESCE(es_pod,false))
  WHERE caso_id IS NOT NULL AND es_instalacion IS NOT TRUE;

CREATE OR REPLACE FUNCTION pmp.generar_id_os() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  prefijo text; secuencia text; candidato text; caso pmp.casos_operacionales%ROWTYPE; numero integer;
BEGIN
  IF NEW.codigo_os IS NOT NULL THEN
    RAISE EXCEPTION 'El codigo_os se genera automáticamente. No enviar en INSERT.';
  END IF;
  IF NEW.es_instalacion IS TRUE THEN prefijo := 'IN'; secuencia := 'pmp.seq_in';
  ELSIF NEW.tipo_equipo='VALIDADOR' THEN
    IF NEW.es_pod IS TRUE THEN prefijo := 'PDV'; secuencia := 'pmp.seq_pdv';
    ELSE prefijo := 'MV'; secuencia := 'pmp.seq_mv'; END IF;
  ELSIF NEW.tipo_equipo='CONSOLA' THEN
    IF NEW.es_pod IS TRUE THEN prefijo := 'PDC'; secuencia := 'pmp.seq_pdc';
    ELSE prefijo := 'MC'; secuencia := 'pmp.seq_mc'; END IF;
  ELSE RAISE EXCEPTION 'Tipo de equipo no soportado'; END IF;
  IF NEW.caso_id IS NOT NULL THEN
    SELECT * INTO STRICT caso FROM pmp.casos_operacionales WHERE id=NEW.caso_id FOR UPDATE;
    IF NEW.es_instalacion IS TRUE THEN
      numero := caso.siguiente_instalacion;
      LOOP
        candidato := 'IN-' || caso.componente || '-' || lpad(numero::text,greatest(2,length(numero::text)),'0');
        EXIT WHEN NOT EXISTS (SELECT 1 FROM pmp.ordenes_servicio WHERE codigo_os=candidato);
        numero := numero+1;
      END LOOP;
      NEW.instalacion_numero := numero;
      UPDATE pmp.casos_operacionales SET siguiente_instalacion=numero+1 WHERE id=caso.id;
      NEW.codigo_os := candidato;
      RETURN NEW;
    ELSIF caso.origen='ARANDA' THEN
      NEW.codigo_os := prefijo || '-' || caso.componente;
      RETURN NEW;
    END IF;
  END IF;
  -- Preserve internal correlatives and skip any code already occupied by an external case.
  LOOP
    candidato := nextval(secuencia::regclass)::text;
    candidato := prefijo || '-' || lpad(candidato,greatest(6,length(candidato)),'0');
    EXIT WHEN NOT EXISTS (SELECT 1 FROM pmp.ordenes_servicio WHERE codigo_os=candidato);
  END LOOP;
  NEW.codigo_os := candidato;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION pmp.validar_relaciones_caso() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE origen pmp.ordenes_servicio%ROWTYPE; caso pmp.casos_operacionales%ROWTYPE;
BEGIN
  IF TG_OP='UPDATE' THEN
    IF (OLD.caso_id,OLD.os_origen,OLD.stock_origen_os,OLD.instalacion_numero) IS DISTINCT FROM
       (NEW.caso_id,NEW.os_origen,NEW.stock_origen_os,NEW.instalacion_numero) THEN
      RAISE EXCEPTION 'Las relaciones de una OS son inmutables' USING ERRCODE='23514';
    END IF;
  END IF;
  IF NEW.caso_id IS NULL THEN RETURN NEW; END IF;
  SELECT * INTO STRICT caso FROM pmp.casos_operacionales WHERE id=NEW.caso_id;
  IF NEW.tipo_equipo <> caso.tipo_equipo OR (NEW.es_instalacion IS NOT TRUE AND
      COALESCE(NEW.validador_serie,NEW.consola_serie) <> caso.serie_origen) THEN
    RAISE EXCEPTION 'El activo no corresponde al requerimiento' USING ERRCODE='23514';
  END IF;
  IF NEW.os_origen IS NOT NULL THEN
    SELECT * INTO STRICT origen FROM pmp.ordenes_servicio WHERE codigo_os=NEW.os_origen;
    IF origen.caso_id IS DISTINCT FROM NEW.caso_id OR origen.tipo_equipo <> NEW.tipo_equipo THEN
      RAISE EXCEPTION 'La OS origen no pertenece al caso y tipo indicados' USING ERRCODE='23514';
    END IF;
  END IF;
  IF NEW.stock_origen_os IS NOT NULL THEN
    SELECT * INTO STRICT origen FROM pmp.ordenes_servicio WHERE codigo_os=NEW.stock_origen_os;
    IF origen.tipo_equipo<>NEW.tipo_equipo OR COALESCE(origen.validador_serie,origen.consola_serie)
       <>COALESCE(NEW.validador_serie,NEW.consola_serie) THEN
      RAISE EXCEPTION 'El activo no corresponde a la evidencia de stock' USING ERRCODE='23514';
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_validar_relaciones_caso ON pmp.ordenes_servicio;
CREATE TRIGGER trg_validar_relaciones_caso BEFORE INSERT OR UPDATE ON pmp.ordenes_servicio
  FOR EACH ROW EXECUTE FUNCTION pmp.validar_relaciones_caso();
COMMIT;
