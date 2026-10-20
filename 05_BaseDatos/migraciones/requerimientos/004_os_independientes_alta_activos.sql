BEGIN;
-- Unknown technical attributes are NULL, never invented placeholder models.
-- Existing rows, case relations and historical codes remain untouched.
ALTER TABLE pmp.validadores ALTER COLUMN modelo DROP NOT NULL;
ALTER TABLE pmp.consolas ALTER COLUMN modelo DROP NOT NULL;

-- Synchronize only forward, including imported historical IN codes.
-- ALTER SEQUENCE RESTART is transactional; a dry run cannot consume numbers.
LOCK TABLE pmp.ordenes_servicio IN ACCESS EXCLUSIVE MODE;
DO $$
DECLARE ultimo bigint; usado boolean; historico bigint;
BEGIN
  SELECT last_value,is_called INTO ultimo,usado FROM pmp.seq_in;
  SELECT max(substring(codigo_os FROM '^IN-([0-9]+)$')::bigint) INTO historico
    FROM pmp.ordenes_servicio WHERE codigo_os ~ '^IN-[0-9]{1,18}$';
  IF historico IS NOT NULL AND (historico > ultimo OR (historico=ultimo AND NOT usado)) THEN
    EXECUTE format('ALTER SEQUENCE pmp.seq_in RESTART WITH %s',historico+1);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION pmp.generar_id_os() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE prefijo text; secuencia text; candidato text; caso pmp.casos_operacionales%ROWTYPE;
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
  IF NEW.es_instalacion IS TRUE THEN
    -- Retain legacy columns for compatibility; new IN identity is independent.
    NEW.instalacion_numero := NULL;
  ELSIF NEW.caso_id IS NOT NULL THEN
    SELECT * INTO STRICT caso FROM pmp.casos_operacionales WHERE id=NEW.caso_id;
    IF caso.origen='ARANDA' THEN
      NEW.codigo_os := prefijo || '-' || caso.componente;
      RETURN NEW;
    END IF;
  END IF;
  LOOP
    candidato := nextval(secuencia::regclass)::text;
    candidato := prefijo || '-' || lpad(candidato,greatest(6,length(candidato)),'0');
    EXIT WHEN NOT EXISTS (SELECT 1 FROM pmp.ordenes_servicio WHERE codigo_os=candidato);
  END LOOP;
  NEW.codigo_os := candidato;
  RETURN NEW;
END $$;
COMMIT;
