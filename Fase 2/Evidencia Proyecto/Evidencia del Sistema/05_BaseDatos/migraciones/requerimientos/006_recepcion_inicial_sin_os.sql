BEGIN;
ALTER TABLE pmp.flujo_eventos
  ADD COLUMN IF NOT EXISTS tipo_equipo varchar(20),
  ADD COLUMN IF NOT EXISTS serie varchar(50);
ALTER TABLE pmp.flujo_eventos DROP CONSTRAINT IF EXISTS flujo_eventos_check;
ALTER TABLE pmp.flujo_eventos ADD CONSTRAINT flujo_eventos_check CHECK (
  (tipo_equipo IS NULL AND serie IS NULL AND (bridge_codigo IS NOT NULL OR codigo_os IS NOT NULL))
  OR (tipo_equipo IS NOT NULL AND tipo_equipo IN ('VALIDADOR','CONSOLA') AND serie IS NOT NULL));
CREATE INDEX IF NOT EXISTS idx_flujo_activo ON pmp.flujo_eventos(tipo_equipo,serie,fecha);
CREATE UNIQUE INDEX IF NOT EXISTS uq_habilitacion_inicial ON pmp.flujo_eventos(tipo_equipo,serie)
  WHERE tipo='HABILITADO_INSTALACION' AND tipo_equipo IS NOT NULL AND codigo_os IS NULL;
ALTER TABLE pmp.escaneos_equipos DROP CONSTRAINT IF EXISTS escaneos_equipos_check;
ALTER TABLE pmp.escaneos_equipos ADD CONSTRAINT escaneos_equipos_check CHECK (
  (resultado='VALIDADO' AND tipo_equipo IS NOT NULL AND serie IS NOT NULL AND motivo IS NULL
    AND (codigo_os IS NOT NULL OR COALESCE((estacion='BODEGA' AND metadata->>'circuito'='ACTIVO_NUEVO'
      AND metadata->>'origen_captura'='SCANNER'),false)))
  OR (resultado='RECHAZADO' AND motivo IS NOT NULL));
CREATE OR REPLACE FUNCTION pmp.validar_evento_activo() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.tipo_equipo IS NOT NULL AND NEW.serie IS NOT NULL THEN
    IF (NEW.tipo_equipo='VALIDADOR' AND NOT EXISTS(SELECT 1 FROM pmp.validadores WHERE serie=NEW.serie))
      OR (NEW.tipo_equipo='CONSOLA' AND NOT EXISTS(SELECT 1 FROM pmp.consolas WHERE serie=NEW.serie)) THEN
      RAISE EXCEPTION 'Activo no registrado para la evidencia' USING ERRCODE='23503';
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_validar_evento_activo ON pmp.flujo_eventos;
CREATE TRIGGER trg_validar_evento_activo BEFORE INSERT OR UPDATE ON pmp.flujo_eventos
  FOR EACH ROW EXECUTE FUNCTION pmp.validar_evento_activo();
DROP TRIGGER IF EXISTS trg_validar_escaneo_activo ON pmp.escaneos_equipos;
CREATE TRIGGER trg_validar_escaneo_activo BEFORE INSERT OR UPDATE ON pmp.escaneos_equipos
  FOR EACH ROW EXECUTE FUNCTION pmp.validar_evento_activo();
ALTER TABLE pmp.ordenes_servicio ADD COLUMN IF NOT EXISTS stock_origen_evento bigint REFERENCES pmp.flujo_eventos(id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_stock_evento_consumido ON pmp.ordenes_servicio(stock_origen_evento) WHERE stock_origen_evento IS NOT NULL;
CREATE OR REPLACE FUNCTION pmp.validar_stock_evento() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE ev pmp.flujo_eventos%ROWTYPE;
BEGIN
  IF TG_OP='UPDATE' AND OLD.stock_origen_evento IS DISTINCT FROM NEW.stock_origen_evento THEN
    RAISE EXCEPTION 'El origen físico de stock es inmutable' USING ERRCODE='23514';
  END IF;
  IF NEW.stock_origen_evento IS NOT NULL THEN
    SELECT * INTO STRICT ev FROM pmp.flujo_eventos WHERE id=NEW.stock_origen_evento;
    IF NEW.es_instalacion IS NOT TRUE OR NEW.stock_origen_os IS NOT NULL OR ev.tipo<>'HABILITADO_INSTALACION'
      OR ev.tipo_equipo IS DISTINCT FROM NEW.tipo_equipo
      OR ev.serie IS DISTINCT FROM COALESCE(NEW.validador_serie,NEW.consola_serie) THEN
      RAISE EXCEPTION 'El evento de stock no corresponde a la instalación y al activo' USING ERRCODE='23514';
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_validar_stock_evento ON pmp.ordenes_servicio;
CREATE TRIGGER trg_validar_stock_evento BEFORE INSERT OR UPDATE ON pmp.ordenes_servicio
  FOR EACH ROW EXECUTE FUNCTION pmp.validar_stock_evento();
COMMIT;
