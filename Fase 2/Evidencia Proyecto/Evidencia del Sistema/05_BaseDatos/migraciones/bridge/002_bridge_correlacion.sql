BEGIN;
-- Additive migration: preserve all legacy Bridge records and identifiers.
CREATE TABLE IF NOT EXISTS pmp.bridge_referencias (
  id bigserial PRIMARY KEY,
  tipo_equipo varchar(20) NOT NULL CHECK (tipo_equipo IN ('VALIDADOR','CONSOLA')),
  serie varchar(50) NOT NULL,
  codigo_os varchar(50) NOT NULL REFERENCES pmp.ordenes_servicio(codigo_os),
  sistema_externo varchar(50) NOT NULL CHECK (length(btrim(sistema_externo)) > 0),
  referencia_externa varchar(120) NOT NULL CHECK (length(btrim(referencia_externa)) > 0),
  comentario text,
  creado_por uuid NOT NULL REFERENCES pmp.usuarios(id),
  creado_en timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_bridge_referencia
  ON pmp.bridge_referencias(tipo_equipo,serie,codigo_os,lower(sistema_externo),lower(referencia_externa));
CREATE INDEX IF NOT EXISTS idx_bridge_referencia_externa ON pmp.bridge_referencias(lower(referencia_externa));
CREATE OR REPLACE FUNCTION pmp.validar_correlacion_activo() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM 1 FROM pmp.ordenes_servicio o WHERE o.codigo_os=NEW.codigo_os AND o.tipo_equipo=NEW.tipo_equipo
    AND COALESCE(o.validador_serie,o.consola_serie)=NEW.serie FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'La OS PMP no corresponde a la serie y tipo indicados' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_validar_correlacion ON pmp.bridge_referencias;
CREATE TRIGGER trg_validar_correlacion BEFORE INSERT ON pmp.bridge_referencias
  FOR EACH ROW EXECUTE FUNCTION pmp.validar_correlacion_activo();
DROP TRIGGER IF EXISTS trg_referencia_inmutable ON pmp.bridge_referencias;
CREATE TRIGGER trg_referencia_inmutable BEFORE UPDATE OR DELETE ON pmp.bridge_referencias
  FOR EACH ROW EXECUTE FUNCTION pmp.bloquear_historico_append_only();
CREATE OR REPLACE VIEW pmp.v_referencias_activo AS
  SELECT 'bridge:'||r.id AS id,r.tipo_equipo,r.serie,r.codigo_os,r.sistema_externo,
    r.referencia_externa,r.creado_en AS fecha,r.comentario FROM pmp.bridge_referencias r
  UNION ALL
  SELECT 'aranda:'||o.codigo_os,o.tipo_equipo,COALESCE(o.validador_serie,o.consola_serie),
    o.codigo_os,'ARANDA',o.ticket_aranda,o.fecha,'Referencia histórica de la OS'
    FROM pmp.ordenes_servicio o WHERE nullif(btrim(o.ticket_aranda),'') IS NOT NULL
  UNION ALL
  SELECT 'legacy:'||b.codigo_bridge,COALESCE(o.tipo_equipo,b.tipo_equipo),
    COALESCE(o.validador_serie,o.consola_serie,b.equipo_retirado_serie,b.equipo_preparado_serie),
    o.codigo_os,b.sistema_externo,b.referencia_externa,b.creado_en,b.observacion_logistica
    FROM pmp.bridges b LEFT JOIN pmp.bridge_mantenimiento bm ON bm.bridge_codigo=b.codigo_bridge
    LEFT JOIN pmp.ordenes_servicio o ON o.codigo_os=bm.codigo_os
    WHERE nullif(btrim(b.referencia_externa),'') IS NOT NULL;
CREATE TABLE IF NOT EXISTS pmp.os_historial_activo (
  id bigserial PRIMARY KEY,codigo_os varchar(50) NOT NULL,
  tipo_equipo varchar(20) NOT NULL,serie varchar(50) NOT NULL,
  fecha timestamptz NOT NULL DEFAULT now(),evento varchar(32) NOT NULL,
  anterior jsonb,actual jsonb NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_os_historial_activo ON pmp.os_historial_activo(tipo_equipo,serie,fecha,id);
CREATE OR REPLACE FUNCTION pmp.registrar_historial_activo() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='UPDATE' THEN
    IF (OLD.tipo_equipo,OLD.validador_serie,OLD.consola_serie) IS DISTINCT FROM
       (NEW.tipo_equipo,NEW.validador_serie,NEW.consola_serie) THEN
      RAISE EXCEPTION 'La identidad del activo de una OS es inmutable' USING ERRCODE='23514';
    END IF;
    IF to_jsonb(OLD)=to_jsonb(NEW) THEN RETURN NEW; END IF;
  END IF;
  INSERT INTO pmp.os_historial_activo(codigo_os,tipo_equipo,serie,evento,anterior,actual)
    VALUES(NEW.codigo_os,NEW.tipo_equipo,COALESCE(NEW.validador_serie,NEW.consola_serie),
      CASE WHEN TG_OP='INSERT' THEN 'OS_CREADA' ELSE 'OS_ACTUALIZADA' END,
      CASE WHEN TG_OP='UPDATE' THEN to_jsonb(OLD) ELSE NULL END,to_jsonb(NEW));
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_os_historial_activo ON pmp.ordenes_servicio;
CREATE TRIGGER trg_os_historial_activo AFTER INSERT OR UPDATE ON pmp.ordenes_servicio
  FOR EACH ROW EXECUTE FUNCTION pmp.registrar_historial_activo();
DROP TRIGGER IF EXISTS trg_os_historial_inmutable ON pmp.os_historial_activo;
CREATE TRIGGER trg_os_historial_inmutable BEFORE UPDATE OR DELETE ON pmp.os_historial_activo
  FOR EACH ROW EXECUTE FUNCTION pmp.bloquear_historico_append_only();
COMMIT;
