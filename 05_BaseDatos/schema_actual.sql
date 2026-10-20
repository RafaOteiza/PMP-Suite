--
-- PostgreSQL database dump
--

\restrict fgWA3FeSaDwVvlwWXCg6bKBwFCrC75Anyee0ce4w8arYfnOdgRhrHsxebGRNGgp

-- Dumped from database version 18.1
-- Dumped by pg_dump version 18.1

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: pmp; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA pmp;


--
-- Name: categoria_equipo; Type: TYPE; Schema: pmp; Owner: -
--

CREATE TYPE pmp.categoria_equipo AS ENUM (
    'VALIDADOR',
    'CONSOLA',
    'GENERICO'
);


--
-- Name: estado_guia; Type: TYPE; Schema: pmp; Owner: -
--

CREATE TYPE pmp.estado_guia AS ENUM (
    'EMITIDA',
    'RECIBIDA'
);


--
-- Name: estado_solicitud; Type: TYPE; Schema: pmp; Owner: -
--

CREATE TYPE pmp.estado_solicitud AS ENUM (
    'PENDIENTE',
    'APROBADA',
    'RECHAZADA',
    'DESPACHADA'
);


--
-- Name: motivo_stock; Type: TYPE; Schema: pmp; Owner: -
--

CREATE TYPE pmp.motivo_stock AS ENUM (
    'CONSUMO_OS',
    'AJUSTE',
    'RECEPCION_GUIA',
    'AJUSTE_AUTO',
    'UPDATE_MANUAL'
);


--
-- Name: tipo_equipo_os; Type: TYPE; Schema: pmp; Owner: -
--

CREATE TYPE pmp.tipo_equipo_os AS ENUM (
    'VALIDADOR',
    'CONSOLA'
);


--
-- Name: tipo_evento_os; Type: TYPE; Schema: pmp; Owner: -
--

CREATE TYPE pmp.tipo_evento_os AS ENUM (
    'CAMBIO_ESTADO',
    'COMENTARIO',
    'ALERTA_IA'
);


--
-- Name: tipo_ubicacion_enum; Type: TYPE; Schema: pmp; Owner: -
--

CREATE TYPE pmp.tipo_ubicacion_enum AS ENUM (
    'BODEGA',
    'LABORATORIO',
    'QA'
);


--
-- Name: bloquear_bridge_cerrada(); Type: FUNCTION; Schema: pmp; Owner: -
--

CREATE FUNCTION pmp.bloquear_bridge_cerrada() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF OLD.estado IN ('COMPLETADA', 'CANCELADA') THEN
    RAISE EXCEPTION 'La Bridge % está cerrada y sus datos son inmutables.', OLD.codigo_bridge;
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: bloquear_historico_append_only(); Type: FUNCTION; Schema: pmp; Owner: -
--

CREATE FUNCTION pmp.bloquear_historico_append_only() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  RAISE EXCEPTION 'El registro histórico de % es inmutable.', TG_TABLE_NAME;
END;
$$;


--
-- Name: bloquear_update_codigo_os(); Type: FUNCTION; Schema: pmp; Owner: -
--

CREATE FUNCTION pmp.bloquear_update_codigo_os() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF NEW.codigo_os IS DISTINCT FROM OLD.codigo_os THEN
        RAISE EXCEPTION 'El codigo_os es inmutable.';
    END IF;
    RETURN NEW;
END;
$$;


--
-- Name: generar_codigo_bridge(); Type: FUNCTION; Schema: pmp; Owner: -
--

CREATE FUNCTION pmp.generar_codigo_bridge() RETURNS text
    LANGUAGE sql
    AS $$
  SELECT 'BR-' || to_char(CURRENT_DATE, 'YYYY') || '-' || lpad(nextval('pmp.seq_bridge')::text, 6, '0');
$$;


--
-- Name: generar_id_os(); Type: FUNCTION; Schema: pmp; Owner: -
--

CREATE FUNCTION pmp.generar_id_os() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
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


--
-- Name: proteger_identidad_caso(); Type: FUNCTION; Schema: pmp; Owner: -
--

CREATE FUNCTION pmp.proteger_identidad_caso() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF TG_OP='DELETE' OR (to_jsonb(OLD)-'siguiente_instalacion') IS DISTINCT FROM (to_jsonb(NEW)-'siguiente_instalacion') THEN
    RAISE EXCEPTION 'La identidad y el requerimiento del caso son inmutables' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;


--
-- Name: registrar_historial_activo(); Type: FUNCTION; Schema: pmp; Owner: -
--

CREATE FUNCTION pmp.registrar_historial_activo() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
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


--
-- Name: validar_correlacion_activo(); Type: FUNCTION; Schema: pmp; Owner: -
--

CREATE FUNCTION pmp.validar_correlacion_activo() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  PERFORM 1 FROM pmp.ordenes_servicio o WHERE o.codigo_os=NEW.codigo_os AND o.tipo_equipo=NEW.tipo_equipo
    AND COALESCE(o.validador_serie,o.consola_serie)=NEW.serie FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'La OS PMP no corresponde a la serie y tipo indicados' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END $$;


--
-- Name: validar_evento_activo(); Type: FUNCTION; Schema: pmp; Owner: -
--

CREATE FUNCTION pmp.validar_evento_activo() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF NEW.tipo_equipo IS NOT NULL AND NEW.serie IS NOT NULL THEN
    IF (NEW.tipo_equipo='VALIDADOR' AND NOT EXISTS(SELECT 1 FROM pmp.validadores WHERE serie=NEW.serie))
      OR (NEW.tipo_equipo='CONSOLA' AND NOT EXISTS(SELECT 1 FROM pmp.consolas WHERE serie=NEW.serie)) THEN
      RAISE EXCEPTION 'Activo no registrado para la evidencia' USING ERRCODE='23503';
    END IF;
  END IF;
  RETURN NEW;
END $$;


--
-- Name: validar_pst_terminal_os(); Type: FUNCTION; Schema: pmp; Owner: -
--

CREATE FUNCTION pmp.validar_pst_terminal_os() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
      DECLARE
          v_existe BOOLEAN;
          v_nombre_terminal VARCHAR(100);
      BEGIN
          -- Bypass para órdenes de instalación ( placeholders )
          IF NEW.es_instalacion = TRUE THEN
              RETURN NEW;
          END IF;

          SELECT EXISTS (SELECT 1 FROM pmp.terminal_pst WHERE terminal_id = NEW.terminal_id AND pst_codigo = NEW.pst_codigo) INTO v_existe;
          
          IF NOT v_existe THEN
              SELECT nombre INTO v_nombre_terminal FROM pmp.terminales WHERE id = NEW.terminal_id;
              RAISE EXCEPTION 'Operador % no autorizado en terminal %.', NEW.pst_codigo, COALESCE(v_nombre_terminal, 'Desconocido');
          END IF;
          RETURN NEW;
      END;
      $$;


--
-- Name: validar_relaciones_caso(); Type: FUNCTION; Schema: pmp; Owner: -
--

CREATE FUNCTION pmp.validar_relaciones_caso() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
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


--
-- Name: validar_stock_evento(); Type: FUNCTION; Schema: pmp; Owner: -
--

CREATE FUNCTION pmp.validar_stock_evento() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
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


--
-- Name: validar_ubicacion_estado(); Type: FUNCTION; Schema: pmp; Owner: -
--

CREATE FUNCTION pmp.validar_ubicacion_estado() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
      DECLARE
          v_tipo_ubicacion pmp.tipo_ubicacion_enum; 
          v_es_valido BOOLEAN;
      BEGIN
          -- Bypass para órdenes de instalación ( placeholders )
          IF NEW.es_instalacion = TRUE THEN
              RETURN NEW;
          END IF;

          IF NEW.ubicacion_id IS NULL THEN RETURN NEW; END IF;

          SELECT tipo INTO v_tipo_ubicacion 
          FROM pmp.ubicaciones 
          WHERE id = NEW.ubicacion_id;

          SELECT EXISTS (
              SELECT 1 
              FROM pmp.config_estado_ubicacion 
              WHERE estado_id = NEW.estado_id 
              AND tipo_ubicacion = v_tipo_ubicacion
          ) INTO v_es_valido;

          IF NOT v_es_valido THEN 
              RAISE EXCEPTION 'Ubicación (%) inválida para el estado actual.', v_tipo_ubicacion; 
          END IF;

          RETURN NEW;
      END;
      $$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: bridge_mantenimiento; Type: TABLE; Schema: pmp; Owner: -
--

CREATE TABLE pmp.bridge_mantenimiento (
    bridge_codigo character varying(32) NOT NULL,
    codigo_os character varying(50) NOT NULL,
    creado_en timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: bridge_referencias; Type: TABLE; Schema: pmp; Owner: -
--

CREATE TABLE pmp.bridge_referencias (
    id bigint NOT NULL,
    tipo_equipo character varying(20) NOT NULL,
    serie character varying(50) NOT NULL,
    codigo_os character varying(50) NOT NULL,
    sistema_externo character varying(50) NOT NULL,
    referencia_externa character varying(120) NOT NULL,
    comentario text,
    creado_por uuid NOT NULL,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT bridge_referencias_referencia_externa_check CHECK ((length(btrim((referencia_externa)::text)) > 0)),
    CONSTRAINT bridge_referencias_sistema_externo_check CHECK ((length(btrim((sistema_externo)::text)) > 0)),
    CONSTRAINT bridge_referencias_tipo_equipo_check CHECK (((tipo_equipo)::text = ANY ((ARRAY['VALIDADOR'::character varying, 'CONSOLA'::character varying])::text[])))
);


--
-- Name: bridge_referencias_id_seq; Type: SEQUENCE; Schema: pmp; Owner: -
--

CREATE SEQUENCE pmp.bridge_referencias_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: bridge_referencias_id_seq; Type: SEQUENCE OWNED BY; Schema: pmp; Owner: -
--

ALTER SEQUENCE pmp.bridge_referencias_id_seq OWNED BY pmp.bridge_referencias.id;


--
-- Name: bridges; Type: TABLE; Schema: pmp; Owner: -
--

CREATE TABLE pmp.bridges (
    codigo_bridge character varying(32) DEFAULT pmp.generar_codigo_bridge() NOT NULL,
    estado character varying(32) DEFAULT 'ASIGNADA'::character varying NOT NULL,
    origen character varying(16) DEFAULT 'PMP'::character varying NOT NULL,
    sistema_externo character varying(50),
    referencia_externa character varying(120),
    tipo_equipo character varying(20) NOT NULL,
    equipo_preparado_serie character varying(50) NOT NULL,
    bus_esperado character varying(10),
    terminal_esperado_id integer,
    pst_esperado_codigo character varying(20),
    motivo text NOT NULL,
    observacion_logistica text,
    tecnico_terreno_id uuid NOT NULL,
    creado_por uuid NOT NULL,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    asignado_por uuid NOT NULL,
    asignado_en timestamp with time zone DEFAULT now() NOT NULL,
    iniciado_en timestamp with time zone,
    equipo_retirado_serie character varying(50),
    equipo_instalado_serie character varying(50),
    bus_confirmado character varying(10),
    terminal_confirmada_id integer,
    pst_confirmado_codigo character varying(20),
    intervencion_en timestamp with time zone,
    observacion_terreno text,
    resultado character varying(20),
    evidencia_url text,
    completado_en timestamp with time zone,
    cancelado_por uuid,
    cancelado_en timestamp with time zone,
    motivo_cancelacion text,
    CONSTRAINT bridges_check CHECK (((((origen)::text = 'PMP'::text) AND (sistema_externo IS NULL) AND (referencia_externa IS NULL)) OR ((origen)::text = 'EXTERNO'::text))),
    CONSTRAINT bridges_estado_check CHECK (((estado)::text = ANY ((ARRAY['PENDIENTE_ASIGNACION'::character varying, 'ASIGNADA'::character varying, 'EN_TERRENO'::character varying, 'COMPLETADA'::character varying, 'CANCELADA'::character varying])::text[]))),
    CONSTRAINT bridges_origen_check CHECK (((origen)::text = ANY ((ARRAY['PMP'::character varying, 'EXTERNO'::character varying])::text[]))),
    CONSTRAINT bridges_resultado_check CHECK (((resultado)::text = ANY ((ARRAY['EXITOSA'::character varying, 'FALLIDA'::character varying])::text[]))),
    CONSTRAINT bridges_tipo_equipo_check CHECK (((tipo_equipo)::text = ANY ((ARRAY['VALIDADOR'::character varying, 'CONSOLA'::character varying])::text[])))
);


--
-- Name: buses; Type: TABLE; Schema: pmp; Owner: -
--

CREATE TABLE pmp.buses (
    ppu character varying(10) NOT NULL
);


--
-- Name: casos_operacionales; Type: TABLE; Schema: pmp; Owner: -
--

CREATE TABLE pmp.casos_operacionales (
    id bigint NOT NULL,
    codigo_caso character varying(64) NOT NULL,
    origen character varying(32) NOT NULL,
    referencia_externa character varying(120),
    componente character varying(32) NOT NULL,
    tipo_equipo character varying(20) NOT NULL,
    serie_origen character varying(50) NOT NULL,
    bus_ppu character varying(20) NOT NULL,
    terminal_id integer NOT NULL,
    pst_codigo character varying(30) NOT NULL,
    falla_reportada text NOT NULL,
    observacion text,
    fecha_requerimiento timestamp with time zone NOT NULL,
    creado_por uuid NOT NULL,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    siguiente_instalacion integer DEFAULT 1 NOT NULL,
    CONSTRAINT casos_operacionales_check CHECK ((((origen)::text <> 'ARANDA'::text) OR (((referencia_externa)::text = ('AR-'::text || (componente)::text)) AND ((componente)::text ~ '^[0-9]{1,30}$'::text)))),
    CONSTRAINT casos_operacionales_siguiente_instalacion_check CHECK ((siguiente_instalacion > 0)),
    CONSTRAINT casos_operacionales_tipo_equipo_check CHECK (((tipo_equipo)::text = ANY ((ARRAY['VALIDADOR'::character varying, 'CONSOLA'::character varying])::text[])))
);


--
-- Name: casos_operacionales_id_seq; Type: SEQUENCE; Schema: pmp; Owner: -
--

CREATE SEQUENCE pmp.casos_operacionales_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: casos_operacionales_id_seq; Type: SEQUENCE OWNED BY; Schema: pmp; Owner: -
--

ALTER SEQUENCE pmp.casos_operacionales_id_seq OWNED BY pmp.casos_operacionales.id;


--
-- Name: config_estado_ubicacion; Type: TABLE; Schema: pmp; Owner: -
--

CREATE TABLE pmp.config_estado_ubicacion (
    estado_id integer NOT NULL,
    tipo_ubicacion pmp.tipo_ubicacion_enum NOT NULL
);


--
-- Name: consolas; Type: TABLE; Schema: pmp; Owner: -
--

CREATE TABLE pmp.consolas (
    serie character varying(50) NOT NULL,
    modelo character varying(50),
    marca character varying(50) DEFAULT 'Waysion'::character varying,
    origen_registro character varying(80),
    fecha_ingreso timestamp with time zone,
    observacion_registro text,
    registrado_por uuid
);


--
-- Name: escaneos_equipos; Type: TABLE; Schema: pmp; Owner: -
--

CREATE TABLE pmp.escaneos_equipos (
    id bigint NOT NULL,
    codigo_leido character varying(64) NOT NULL,
    tipo_codigo character varying(16) NOT NULL,
    estacion character varying(20) NOT NULL,
    tipo_equipo character varying(20),
    serie character varying(50),
    amid character varying(32),
    codigo_os character varying(50),
    ubicacion_id integer NOT NULL,
    usuario_id uuid NOT NULL,
    rol character varying(50) NOT NULL,
    resultado character varying(16) NOT NULL,
    motivo character varying(64),
    fecha timestamp with time zone DEFAULT now() NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT escaneos_equipos_check CHECK (((((resultado)::text = 'VALIDADO'::text) AND (tipo_equipo IS NOT NULL) AND (serie IS NOT NULL) AND (motivo IS NULL) AND ((codigo_os IS NOT NULL) OR COALESCE((((estacion)::text = 'BODEGA'::text) AND ((metadata ->> 'circuito'::text) = 'ACTIVO_NUEVO'::text) AND ((metadata ->> 'origen_captura'::text) = 'SCANNER'::text)), false))) OR (((resultado)::text = 'RECHAZADO'::text) AND (motivo IS NOT NULL)))),
    CONSTRAINT escaneos_equipos_estacion_check CHECK (((estacion)::text = ANY ((ARRAY['BODEGA'::character varying, 'LABORATORIO'::character varying, 'QA'::character varying])::text[]))),
    CONSTRAINT escaneos_equipos_resultado_check CHECK (((resultado)::text = ANY ((ARRAY['VALIDADO'::character varying, 'RECHAZADO'::character varying])::text[]))),
    CONSTRAINT escaneos_equipos_tipo_codigo_check CHECK (((tipo_codigo)::text = ANY ((ARRAY['SERIE'::character varying, 'AMID'::character varying])::text[]))),
    CONSTRAINT escaneos_equipos_tipo_equipo_check CHECK (((tipo_equipo IS NULL) OR ((tipo_equipo)::text = ANY ((ARRAY['VALIDADOR'::character varying, 'CONSOLA'::character varying])::text[]))))
);


--
-- Name: escaneos_equipos_id_seq; Type: SEQUENCE; Schema: pmp; Owner: -
--

CREATE SEQUENCE pmp.escaneos_equipos_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: escaneos_equipos_id_seq; Type: SEQUENCE OWNED BY; Schema: pmp; Owner: -
--

ALTER SEQUENCE pmp.escaneos_equipos_id_seq OWNED BY pmp.escaneos_equipos.id;


--
-- Name: estados; Type: TABLE; Schema: pmp; Owner: -
--

CREATE TABLE pmp.estados (
    id integer NOT NULL,
    nombre character varying(50) NOT NULL
);


--
-- Name: estados_id_seq; Type: SEQUENCE; Schema: pmp; Owner: -
--

CREATE SEQUENCE pmp.estados_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: estados_id_seq; Type: SEQUENCE OWNED BY; Schema: pmp; Owner: -
--

ALTER SEQUENCE pmp.estados_id_seq OWNED BY pmp.estados.id;


--
-- Name: flujo_eventos; Type: TABLE; Schema: pmp; Owner: -
--

CREATE TABLE pmp.flujo_eventos (
    id bigint NOT NULL,
    bridge_codigo character varying(32),
    codigo_os character varying(50),
    tipo character varying(64) NOT NULL,
    usuario_id uuid NOT NULL,
    rol character varying(50) NOT NULL,
    fecha timestamp with time zone DEFAULT now() NOT NULL,
    comentario text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    tipo_equipo character varying(20),
    serie character varying(50),
    CONSTRAINT flujo_eventos_check CHECK ((((tipo_equipo IS NULL) AND (serie IS NULL) AND ((bridge_codigo IS NOT NULL) OR (codigo_os IS NOT NULL))) OR ((tipo_equipo IS NOT NULL) AND ((tipo_equipo)::text = ANY ((ARRAY['VALIDADOR'::character varying, 'CONSOLA'::character varying])::text[])) AND (serie IS NOT NULL))))
);


--
-- Name: flujo_eventos_id_seq; Type: SEQUENCE; Schema: pmp; Owner: -
--

CREATE SEQUENCE pmp.flujo_eventos_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: flujo_eventos_id_seq; Type: SEQUENCE OWNED BY; Schema: pmp; Owner: -
--

ALTER SEQUENCE pmp.flujo_eventos_id_seq OWNED BY pmp.flujo_eventos.id;


--
-- Name: guia_detalle; Type: TABLE; Schema: pmp; Owner: -
--

CREATE TABLE pmp.guia_detalle (
    id integer NOT NULL,
    guia_numero character varying(50) NOT NULL,
    tipo_equipo character varying(20) NOT NULL,
    validador_serie character varying(50),
    consola_serie character varying(50),
    bus_ppu character varying(10),
    codigo_os character varying(50),
    nota character varying(255),
    CONSTRAINT check_detalle_equipo CHECK (((((tipo_equipo)::text = 'VALIDADOR'::text) AND (validador_serie IS NOT NULL) AND (consola_serie IS NULL)) OR (((tipo_equipo)::text = 'CONSOLA'::text) AND (consola_serie IS NOT NULL) AND (validador_serie IS NULL)))),
    CONSTRAINT guia_detalle_tipo_equipo_check CHECK (((tipo_equipo)::text = ANY ((ARRAY['VALIDADOR'::character varying, 'CONSOLA'::character varying])::text[])))
);


--
-- Name: guia_detalle_id_seq; Type: SEQUENCE; Schema: pmp; Owner: -
--

CREATE SEQUENCE pmp.guia_detalle_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: guia_detalle_id_seq; Type: SEQUENCE OWNED BY; Schema: pmp; Owner: -
--

ALTER SEQUENCE pmp.guia_detalle_id_seq OWNED BY pmp.guia_detalle.id;


--
-- Name: guias; Type: TABLE; Schema: pmp; Owner: -
--

CREATE TABLE pmp.guias (
    numero character varying(50) NOT NULL,
    fecha date DEFAULT CURRENT_DATE,
    origen_id integer NOT NULL,
    destino_id integer NOT NULL,
    creado_por uuid
);


--
-- Name: instalaciones_equipos; Type: TABLE; Schema: pmp; Owner: -
--

CREATE TABLE pmp.instalaciones_equipos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bridge_codigo character varying(32) NOT NULL,
    tipo_equipo character varying(20) NOT NULL,
    equipo_retirado_serie character varying(50) NOT NULL,
    equipo_instalado_serie character varying(50) NOT NULL,
    bus_ppu character varying(10) NOT NULL,
    terminal_id integer NOT NULL,
    pst_codigo character varying(20) NOT NULL,
    tecnico_terreno_id uuid NOT NULL,
    intervencion_en timestamp with time zone NOT NULL,
    observacion text,
    evidencia_url text,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT instalaciones_equipos_tipo_equipo_check CHECK (((tipo_equipo)::text = ANY ((ARRAY['VALIDADOR'::character varying, 'CONSOLA'::character varying])::text[])))
);


--
-- Name: ordenes_servicio; Type: TABLE; Schema: pmp; Owner: -
--

CREATE TABLE pmp.ordenes_servicio (
    codigo_os character varying(50) NOT NULL,
    fecha timestamp without time zone DEFAULT now() NOT NULL,
    tipo_equipo character varying(20) NOT NULL,
    es_pod boolean DEFAULT false,
    validador_serie character varying(50),
    consola_serie character varying(50),
    falla text NOT NULL,
    estado_id integer NOT NULL,
    bus_ppu character varying(10) NOT NULL,
    terminal_id integer NOT NULL,
    pst_codigo character varying(20) NOT NULL,
    ubicacion_id integer,
    tecnico_terreno_id uuid,
    tecnico_laboratorio_id uuid,
    actualizado_en timestamp without time zone DEFAULT now(),
    es_aprobado_qa boolean,
    es_instalacion boolean DEFAULT false,
    ticket_aranda character varying(100),
    qa_usuario_id uuid,
    qa_asignado_por uuid,
    qa_asignado_en timestamp with time zone,
    caso_id bigint,
    os_origen character varying(50),
    stock_origen_os character varying(50),
    instalacion_numero integer,
    stock_origen_evento bigint,
    CONSTRAINT check_equipo_correcto CHECK (((((tipo_equipo)::text = 'VALIDADOR'::text) AND (validador_serie IS NOT NULL) AND (consola_serie IS NULL)) OR (((tipo_equipo)::text = 'CONSOLA'::text) AND (consola_serie IS NOT NULL) AND (validador_serie IS NULL)))),
    CONSTRAINT ordenes_servicio_tipo_equipo_check CHECK (((tipo_equipo)::text = ANY ((ARRAY['VALIDADOR'::character varying, 'CONSOLA'::character varying])::text[])))
);


--
-- Name: os_historial_activo; Type: TABLE; Schema: pmp; Owner: -
--

CREATE TABLE pmp.os_historial_activo (
    id bigint NOT NULL,
    codigo_os character varying(50) NOT NULL,
    tipo_equipo character varying(20) NOT NULL,
    serie character varying(50) NOT NULL,
    fecha timestamp with time zone DEFAULT now() NOT NULL,
    evento character varying(32) NOT NULL,
    anterior jsonb,
    actual jsonb NOT NULL
);


--
-- Name: os_historial_activo_id_seq; Type: SEQUENCE; Schema: pmp; Owner: -
--

CREATE SEQUENCE pmp.os_historial_activo_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: os_historial_activo_id_seq; Type: SEQUENCE OWNED BY; Schema: pmp; Owner: -
--

ALTER SEQUENCE pmp.os_historial_activo_id_seq OWNED BY pmp.os_historial_activo.id;


--
-- Name: pst; Type: TABLE; Schema: pmp; Owner: -
--

CREATE TABLE pmp.pst (
    codigo character varying(20) NOT NULL,
    nombre character varying(120) NOT NULL
);


--
-- Name: qa_inspecciones; Type: TABLE; Schema: pmp; Owner: -
--

CREATE TABLE pmp.qa_inspecciones (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    codigo_os character varying(50) NOT NULL,
    qa_usuario_id uuid NOT NULL,
    resultado character varying(16) NOT NULL,
    comentario text,
    certificacion text,
    fecha timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT qa_inspecciones_check CHECK ((((resultado)::text = 'APROBADO'::text) OR (length(btrim(COALESCE(comentario, ''::text))) >= 3))),
    CONSTRAINT qa_inspecciones_resultado_check CHECK (((resultado)::text = ANY ((ARRAY['APROBADO'::character varying, 'RECHAZADO'::character varying])::text[])))
);


--
-- Name: registro_reparaciones; Type: TABLE; Schema: pmp; Owner: -
--

CREATE TABLE pmp.registro_reparaciones (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    codigo_os character varying(50),
    tecnico_id uuid,
    falla_detectada text,
    accion_realizada text NOT NULL,
    repuestos_usados text,
    comentario text,
    fecha_registro timestamp without time zone DEFAULT now(),
    prueba_realizada text,
    resultado_prueba text
);


--
-- Name: repuestos; Type: TABLE; Schema: pmp; Owner: -
--

CREATE TABLE pmp.repuestos (
    id integer NOT NULL,
    nombre character varying(150) NOT NULL,
    categoria pmp.categoria_equipo NOT NULL,
    stock integer DEFAULT 0,
    stock_critico integer DEFAULT 5,
    CONSTRAINT repuestos_stock_check CHECK ((stock >= 0))
);


--
-- Name: repuestos_id_seq; Type: SEQUENCE; Schema: pmp; Owner: -
--

CREATE SEQUENCE pmp.repuestos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: repuestos_id_seq; Type: SEQUENCE OWNED BY; Schema: pmp; Owner: -
--

ALTER SEQUENCE pmp.repuestos_id_seq OWNED BY pmp.repuestos.id;


--
-- Name: seq_bridge; Type: SEQUENCE; Schema: pmp; Owner: -
--

CREATE SEQUENCE pmp.seq_bridge
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: seq_caso_interno; Type: SEQUENCE; Schema: pmp; Owner: -
--

CREATE SEQUENCE pmp.seq_caso_interno
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: seq_in; Type: SEQUENCE; Schema: pmp; Owner: -
--

CREATE SEQUENCE pmp.seq_in
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: seq_mc; Type: SEQUENCE; Schema: pmp; Owner: -
--

CREATE SEQUENCE pmp.seq_mc
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: seq_mv; Type: SEQUENCE; Schema: pmp; Owner: -
--

CREATE SEQUENCE pmp.seq_mv
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: seq_pdc; Type: SEQUENCE; Schema: pmp; Owner: -
--

CREATE SEQUENCE pmp.seq_pdc
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: seq_pdv; Type: SEQUENCE; Schema: pmp; Owner: -
--

CREATE SEQUENCE pmp.seq_pdv
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: solicitud_items; Type: TABLE; Schema: pmp; Owner: -
--

CREATE TABLE pmp.solicitud_items (
    id integer NOT NULL,
    solicitud_id integer NOT NULL,
    repuesto_id integer NOT NULL,
    cantidad integer NOT NULL,
    CONSTRAINT solicitud_items_cantidad_check CHECK ((cantidad > 0))
);


--
-- Name: solicitud_items_id_seq; Type: SEQUENCE; Schema: pmp; Owner: -
--

CREATE SEQUENCE pmp.solicitud_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: solicitud_items_id_seq; Type: SEQUENCE OWNED BY; Schema: pmp; Owner: -
--

ALTER SEQUENCE pmp.solicitud_items_id_seq OWNED BY pmp.solicitud_items.id;


--
-- Name: solicitudes_repuestos; Type: TABLE; Schema: pmp; Owner: -
--

CREATE TABLE pmp.solicitudes_repuestos (
    id integer NOT NULL,
    codigo_os character varying(50) NOT NULL,
    solicitado_por uuid NOT NULL,
    estado pmp.estado_solicitud DEFAULT 'PENDIENTE'::pmp.estado_solicitud,
    fecha_solicitud timestamp without time zone DEFAULT now(),
    fecha_despacho timestamp without time zone,
    repuesto_solicitado character varying(255),
    comentario text
);


--
-- Name: solicitudes_repuestos_id_seq; Type: SEQUENCE; Schema: pmp; Owner: -
--

CREATE SEQUENCE pmp.solicitudes_repuestos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: solicitudes_repuestos_id_seq; Type: SEQUENCE OWNED BY; Schema: pmp; Owner: -
--

ALTER SEQUENCE pmp.solicitudes_repuestos_id_seq OWNED BY pmp.solicitudes_repuestos.id;


--
-- Name: terminal_pst; Type: TABLE; Schema: pmp; Owner: -
--

CREATE TABLE pmp.terminal_pst (
    terminal_id integer NOT NULL,
    pst_codigo character varying(20) NOT NULL
);


--
-- Name: terminales; Type: TABLE; Schema: pmp; Owner: -
--

CREATE TABLE pmp.terminales (
    id integer NOT NULL,
    nombre character varying(100) NOT NULL
);


--
-- Name: terminales_id_seq; Type: SEQUENCE; Schema: pmp; Owner: -
--

CREATE SEQUENCE pmp.terminales_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: terminales_id_seq; Type: SEQUENCE OWNED BY; Schema: pmp; Owner: -
--

ALTER SEQUENCE pmp.terminales_id_seq OWNED BY pmp.terminales.id;


--
-- Name: ubicaciones; Type: TABLE; Schema: pmp; Owner: -
--

CREATE TABLE pmp.ubicaciones (
    id integer NOT NULL,
    nombre character varying(100) NOT NULL,
    tipo pmp.tipo_ubicacion_enum NOT NULL
);


--
-- Name: ubicaciones_id_seq; Type: SEQUENCE; Schema: pmp; Owner: -
--

CREATE SEQUENCE pmp.ubicaciones_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ubicaciones_id_seq; Type: SEQUENCE OWNED BY; Schema: pmp; Owner: -
--

ALTER SEQUENCE pmp.ubicaciones_id_seq OWNED BY pmp.ubicaciones.id;


--
-- Name: usuarios; Type: TABLE; Schema: pmp; Owner: -
--

CREATE TABLE pmp.usuarios (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nombre character varying(100) NOT NULL,
    apellido character varying(100) NOT NULL,
    correo character varying(150) NOT NULL,
    rol character varying(50) NOT NULL,
    activo boolean DEFAULT true,
    firebase_uid character varying(128)
);


--
-- Name: v_referencias_activo; Type: VIEW; Schema: pmp; Owner: -
--

CREATE VIEW pmp.v_referencias_activo AS
 SELECT ('bridge:'::text || r.id) AS id,
    r.tipo_equipo,
    r.serie,
    r.codigo_os,
    r.sistema_externo,
    r.referencia_externa,
    r.creado_en AS fecha,
    r.comentario
   FROM pmp.bridge_referencias r
UNION ALL
 SELECT ('aranda:'::text || (o.codigo_os)::text) AS id,
    o.tipo_equipo,
    COALESCE(o.validador_serie, o.consola_serie) AS serie,
    o.codigo_os,
    'ARANDA'::character varying AS sistema_externo,
    o.ticket_aranda AS referencia_externa,
    o.fecha,
    'Referencia histórica de la OS'::text AS comentario
   FROM pmp.ordenes_servicio o
  WHERE (NULLIF(btrim((o.ticket_aranda)::text), ''::text) IS NOT NULL)
UNION ALL
 SELECT ('legacy:'::text || (b.codigo_bridge)::text) AS id,
    COALESCE(o.tipo_equipo, b.tipo_equipo) AS tipo_equipo,
    COALESCE(o.validador_serie, o.consola_serie, b.equipo_retirado_serie, b.equipo_preparado_serie) AS serie,
    o.codigo_os,
    b.sistema_externo,
    b.referencia_externa,
    b.creado_en AS fecha,
    b.observacion_logistica AS comentario
   FROM ((pmp.bridges b
     LEFT JOIN pmp.bridge_mantenimiento bm ON (((bm.bridge_codigo)::text = (b.codigo_bridge)::text)))
     LEFT JOIN pmp.ordenes_servicio o ON (((o.codigo_os)::text = (bm.codigo_os)::text)))
  WHERE (NULLIF(btrim((b.referencia_externa)::text), ''::text) IS NOT NULL);


--
-- Name: v_ubicacion_fisica_equipos; Type: VIEW; Schema: pmp; Owner: -
--

CREATE VIEW pmp.v_ubicacion_fisica_equipos AS
 SELECT DISTINCT ON (tipo_equipo, serie) tipo_equipo,
    serie,
    amid,
    codigo_os,
    ubicacion_id,
    estacion,
    fecha AS confirmada_en,
    usuario_id,
    id AS escaneo_id
   FROM pmp.escaneos_equipos
  WHERE ((resultado)::text = 'VALIDADO'::text)
  ORDER BY tipo_equipo, serie, fecha DESC, id DESC;


--
-- Name: validadores; Type: TABLE; Schema: pmp; Owner: -
--

CREATE TABLE pmp.validadores (
    serie character varying(50) NOT NULL,
    modelo character varying(50),
    marca character varying(50) DEFAULT 'Mikroelektronika'::character varying,
    amid character varying(32),
    origen_registro character varying(80),
    fecha_ingreso timestamp with time zone,
    observacion_registro text,
    registrado_por uuid,
    CONSTRAINT ck_validadores_amid_formato CHECK (((amid IS NULL) OR ((amid)::text ~ '^[0-9]{12}$'::text)))
);


--
-- Name: bridge_referencias id; Type: DEFAULT; Schema: pmp; Owner: -
--

ALTER TABLE ONLY pmp.bridge_referencias ALTER COLUMN id SET DEFAULT nextval('pmp.bridge_referencias_id_seq'::regclass);


--
-- Name: casos_operacionales id; Type: DEFAULT; Schema: pmp; Owner: -
--

ALTER TABLE ONLY pmp.casos_operacionales ALTER COLUMN id SET DEFAULT nextval('pmp.casos_operacionales_id_seq'::regclass);


--
-- Name: escaneos_equipos id; Type: DEFAULT; Schema: pmp; Owner: -
--

ALTER TABLE ONLY pmp.escaneos_equipos ALTER COLUMN id SET DEFAULT nextval('pmp.escaneos_equipos_id_seq'::regclass);


--
-- Name: estados id; Type: DEFAULT; Schema: pmp; Owner: -
--

ALTER TABLE ONLY pmp.estados ALTER COLUMN id SET DEFAULT nextval('pmp.estados_id_seq'::regclass);


--
-- Name: flujo_eventos id; Type: DEFAULT; Schema: pmp; Owner: -
--

ALTER TABLE ONLY pmp.flujo_eventos ALTER COLUMN id SET DEFAULT nextval('pmp.flujo_eventos_id_seq'::regclass);


--
-- Name: guia_detalle id; Type: DEFAULT; Schema: pmp; Owner: -
--

ALTER TABLE ONLY pmp.guia_detalle ALTER COLUMN id SET DEFAULT nextval('pmp.guia_detalle_id_seq'::regclass);


--
-- Name: os_historial_activo id; Type: DEFAULT; Schema: pmp; Owner: -
--

ALTER TABLE ONLY pmp.os_historial_activo ALTER COLUMN id SET DEFAULT nextval('pmp.os_historial_activo_id_seq'::regclass);


--
-- Name: repuestos id; Type: DEFAULT; Schema: pmp; Owner: -
--

ALTER TABLE ONLY pmp.repuestos ALTER COLUMN id SET DEFAULT nextval('pmp.repuestos_id_seq'::regclass);


--
-- Name: solicitud_items id; Type: DEFAULT; Schema: pmp; Owner: -
--

ALTER TABLE ONLY pmp.solicitud_items ALTER COLUMN id SET DEFAULT nextval('pmp.solicitud_items_id_seq'::regclass);


--
-- Name: solicitudes_repuestos id; Type: DEFAULT; Schema: pmp; Owner: -
--

ALTER TABLE ONLY pmp.solicitudes_repuestos ALTER COLUMN id SET DEFAULT nextval('pmp.solicitudes_repuestos_id_seq'::regclass);


--
-- Name: terminales id; Type: DEFAULT; Schema: pmp; Owner: -
--

ALTER TABLE ONLY pmp.terminales ALTER COLUMN id SET DEFAULT nextval('pmp.terminales_id_seq'::regclass);


--
-- Name: ubicaciones id; Type: DEFAULT; Schema: pmp; Owner: -
--

ALTER TABLE ONLY pmp.ubicaciones ALTER COLUMN id SET DEFAULT nextval('pmp.ubicaciones_id_seq'::regclass);


--
-- Name: bridge_mantenimiento bridge_mantenimiento_codigo_os_key; Type: CONSTRAINT; Schema: pmp; Owner: -
--

ALTER TABLE ONLY pmp.bridge_mantenimiento
    ADD CONSTRAINT bridge_mantenimiento_codigo_os_key UNIQUE (codigo_os);


--
-- Name: bridge_mantenimiento bridge_mantenimiento_pkey; Type: CONSTRAINT; Schema: pmp; Owner: -
--

ALTER TABLE ONLY pmp.bridge_mantenimiento
    ADD CONSTRAINT bridge_mantenimiento_pkey PRIMARY KEY (bridge_codigo);


--
-- Name: bridge_referencias bridge_referencias_pkey; Type: CONSTRAINT; Schema: pmp; Owner: -
--

ALTER TABLE ONLY pmp.bridge_referencias
    ADD CONSTRAINT bridge_referencias_pkey PRIMARY KEY (id);


--
-- Name: bridges bridges_pkey; Type: CONSTRAINT; Schema: pmp; Owner: -
--

ALTER TABLE ONLY pmp.bridges
    ADD CONSTRAINT bridges_pkey PRIMARY KEY (codigo_bridge);


--
-- Name: buses buses_pkey; Type: CONSTRAINT; Schema: pmp; Owner: -
--

ALTER TABLE ONLY pmp.buses
    ADD CONSTRAINT buses_pkey PRIMARY KEY (ppu);


--
-- Name: casos_operacionales casos_operacionales_codigo_caso_key; Type: CONSTRAINT; Schema: pmp; Owner: -
--

ALTER TABLE ONLY pmp.casos_operacionales
    ADD CONSTRAINT casos_operacionales_codigo_caso_key UNIQUE (codigo_caso);


--
-- Name: casos_operacionales casos_operacionales_pkey; Type: CONSTRAINT; Schema: pmp; Owner: -
--

ALTER TABLE ONLY pmp.casos_operacionales
    ADD CONSTRAINT casos_operacionales_pkey PRIMARY KEY (id);


--
-- Name: config_estado_ubicacion config_estado_ubicacion_pkey; Type: CONSTRAINT; Schema: pmp; Owner: -
--

ALTER TABLE ONLY pmp.config_estado_ubicacion
    ADD CONSTRAINT config_estado_ubicacion_pkey PRIMARY KEY (estado_id, tipo_ubicacion);


--
-- Name: consolas consolas_pkey; Type: CONSTRAINT; Schema: pmp; Owner: -
--

ALTER TABLE ONLY pmp.consolas
    ADD CONSTRAINT consolas_pkey PRIMARY KEY (serie);


--
-- Name: escaneos_equipos escaneos_equipos_pkey; Type: CONSTRAINT; Schema: pmp; Owner: -
--

ALTER TABLE ONLY pmp.escaneos_equipos
    ADD CONSTRAINT escaneos_equipos_pkey PRIMARY KEY (id);


--
-- Name: estados estados_nombre_key; Type: CONSTRAINT; Schema: pmp; Owner: -
--

ALTER TABLE ONLY pmp.estados
    ADD CONSTRAINT estados_nombre_key UNIQUE (nombre);


--
-- Name: estados estados_pkey; Type: CONSTRAINT; Schema: pmp; Owner: -
--

ALTER TABLE ONLY pmp.estados
    ADD CONSTRAINT estados_pkey PRIMARY KEY (id);


--
-- Name: flujo_eventos flujo_eventos_pkey; Type: CONSTRAINT; Schema: pmp; Owner: -
--

ALTER TABLE ONLY pmp.flujo_eventos
    ADD CONSTRAINT flujo_eventos_pkey PRIMARY KEY (id);


--
-- Name: guia_detalle guia_detalle_pkey; Type: CONSTRAINT; Schema: pmp; Owner: -
--

ALTER TABLE ONLY pmp.guia_detalle
    ADD CONSTRAINT guia_detalle_pkey PRIMARY KEY (id);


--
-- Name: guias guias_pkey; Type: CONSTRAINT; Schema: pmp; Owner: -
--

ALTER TABLE ONLY pmp.guias
    ADD CONSTRAINT guias_pkey PRIMARY KEY (numero);


--
-- Name: instalaciones_equipos instalaciones_equipos_bridge_codigo_key; Type: CONSTRAINT; Schema: pmp; Owner: -
--

ALTER TABLE ONLY pmp.instalaciones_equipos
    ADD CONSTRAINT instalaciones_equipos_bridge_codigo_key UNIQUE (bridge_codigo);


--
-- Name: instalaciones_equipos instalaciones_equipos_pkey; Type: CONSTRAINT; Schema: pmp; Owner: -
--

ALTER TABLE ONLY pmp.instalaciones_equipos
    ADD CONSTRAINT instalaciones_equipos_pkey PRIMARY KEY (id);


--
-- Name: ordenes_servicio ordenes_servicio_pkey; Type: CONSTRAINT; Schema: pmp; Owner: -
--

ALTER TABLE ONLY pmp.ordenes_servicio
    ADD CONSTRAINT ordenes_servicio_pkey PRIMARY KEY (codigo_os);


--
-- Name: os_historial_activo os_historial_activo_pkey; Type: CONSTRAINT; Schema: pmp; Owner: -
--

ALTER TABLE ONLY pmp.os_historial_activo
    ADD CONSTRAINT os_historial_activo_pkey PRIMARY KEY (id);


--
-- Name: pst pst_pkey; Type: CONSTRAINT; Schema: pmp; Owner: -
--

ALTER TABLE ONLY pmp.pst
    ADD CONSTRAINT pst_pkey PRIMARY KEY (codigo);


--
-- Name: qa_inspecciones qa_inspecciones_pkey; Type: CONSTRAINT; Schema: pmp; Owner: -
--

ALTER TABLE ONLY pmp.qa_inspecciones
    ADD CONSTRAINT qa_inspecciones_pkey PRIMARY KEY (id);


--
-- Name: registro_reparaciones registro_reparaciones_pkey; Type: CONSTRAINT; Schema: pmp; Owner: -
--

ALTER TABLE ONLY pmp.registro_reparaciones
    ADD CONSTRAINT registro_reparaciones_pkey PRIMARY KEY (id);


--
-- Name: repuestos repuestos_pkey; Type: CONSTRAINT; Schema: pmp; Owner: -
--

ALTER TABLE ONLY pmp.repuestos
    ADD CONSTRAINT repuestos_pkey PRIMARY KEY (id);


--
-- Name: solicitud_items solicitud_items_pkey; Type: CONSTRAINT; Schema: pmp; Owner: -
--

ALTER TABLE ONLY pmp.solicitud_items
    ADD CONSTRAINT solicitud_items_pkey PRIMARY KEY (id);


--
-- Name: solicitudes_repuestos solicitudes_repuestos_pkey; Type: CONSTRAINT; Schema: pmp; Owner: -
--

ALTER TABLE ONLY pmp.solicitudes_repuestos
    ADD CONSTRAINT solicitudes_repuestos_pkey PRIMARY KEY (id);


--
-- Name: terminal_pst terminal_pst_pkey; Type: CONSTRAINT; Schema: pmp; Owner: -
--

ALTER TABLE ONLY pmp.terminal_pst
    ADD CONSTRAINT terminal_pst_pkey PRIMARY KEY (terminal_id, pst_codigo);


--
-- Name: terminales terminales_nombre_key; Type: CONSTRAINT; Schema: pmp; Owner: -
--

ALTER TABLE ONLY pmp.terminales
    ADD CONSTRAINT terminales_nombre_key UNIQUE (nombre);


--
-- Name: terminales terminales_pkey; Type: CONSTRAINT; Schema: pmp; Owner: -
--

ALTER TABLE ONLY pmp.terminales
    ADD CONSTRAINT terminales_pkey PRIMARY KEY (id);


--
-- Name: ubicaciones ubicaciones_pkey; Type: CONSTRAINT; Schema: pmp; Owner: -
--

ALTER TABLE ONLY pmp.ubicaciones
    ADD CONSTRAINT ubicaciones_pkey PRIMARY KEY (id);


--
-- Name: usuarios usuarios_correo_key; Type: CONSTRAINT; Schema: pmp; Owner: -
--

ALTER TABLE ONLY pmp.usuarios
    ADD CONSTRAINT usuarios_correo_key UNIQUE (correo);


--
-- Name: usuarios usuarios_pkey; Type: CONSTRAINT; Schema: pmp; Owner: -
--

ALTER TABLE ONLY pmp.usuarios
    ADD CONSTRAINT usuarios_pkey PRIMARY KEY (id);


--
-- Name: solicitud_items ux_solicitud_repuesto; Type: CONSTRAINT; Schema: pmp; Owner: -
--

ALTER TABLE ONLY pmp.solicitud_items
    ADD CONSTRAINT ux_solicitud_repuesto UNIQUE (solicitud_id, repuesto_id);


--
-- Name: validadores validadores_pkey; Type: CONSTRAINT; Schema: pmp; Owner: -
--

ALTER TABLE ONLY pmp.validadores
    ADD CONSTRAINT validadores_pkey PRIMARY KEY (serie);


--
-- Name: idx_bridge_referencia_externa; Type: INDEX; Schema: pmp; Owner: -
--

CREATE INDEX idx_bridge_referencia_externa ON pmp.bridge_referencias USING btree (lower((referencia_externa)::text));


--
-- Name: idx_escaneos_equipo_fecha; Type: INDEX; Schema: pmp; Owner: -
--

CREATE INDEX idx_escaneos_equipo_fecha ON pmp.escaneos_equipos USING btree (tipo_equipo, serie, fecha DESC, id DESC) WHERE ((resultado)::text = 'VALIDADO'::text);


--
-- Name: idx_escaneos_estacion_fecha; Type: INDEX; Schema: pmp; Owner: -
--

CREATE INDEX idx_escaneos_estacion_fecha ON pmp.escaneos_equipos USING btree (estacion, fecha DESC, id DESC);


--
-- Name: idx_escaneos_os_fecha; Type: INDEX; Schema: pmp; Owner: -
--

CREATE INDEX idx_escaneos_os_fecha ON pmp.escaneos_equipos USING btree (codigo_os, fecha DESC, id DESC);


--
-- Name: idx_flujo_activo; Type: INDEX; Schema: pmp; Owner: -
--

CREATE INDEX idx_flujo_activo ON pmp.flujo_eventos USING btree (tipo_equipo, serie, fecha);


--
-- Name: idx_flujo_eventos_bridge; Type: INDEX; Schema: pmp; Owner: -
--

CREATE INDEX idx_flujo_eventos_bridge ON pmp.flujo_eventos USING btree (bridge_codigo, fecha, id);


--
-- Name: idx_flujo_eventos_os; Type: INDEX; Schema: pmp; Owner: -
--

CREATE INDEX idx_flujo_eventos_os ON pmp.flujo_eventos USING btree (codigo_os, fecha, id);


--
-- Name: idx_os_caso; Type: INDEX; Schema: pmp; Owner: -
--

CREATE INDEX idx_os_caso ON pmp.ordenes_servicio USING btree (caso_id);


--
-- Name: idx_os_historial_activo; Type: INDEX; Schema: pmp; Owner: -
--

CREATE INDEX idx_os_historial_activo ON pmp.os_historial_activo USING btree (tipo_equipo, serie, fecha, id);


--
-- Name: idx_os_stock_origen; Type: INDEX; Schema: pmp; Owner: -
--

CREATE INDEX idx_os_stock_origen ON pmp.ordenes_servicio USING btree (stock_origen_os);


--
-- Name: idx_qa_inspecciones_os_fecha; Type: INDEX; Schema: pmp; Owner: -
--

CREATE INDEX idx_qa_inspecciones_os_fecha ON pmp.qa_inspecciones USING btree (codigo_os, fecha DESC);


--
-- Name: idx_usuarios_firebase_uid; Type: INDEX; Schema: pmp; Owner: -
--

CREATE INDEX idx_usuarios_firebase_uid ON pmp.usuarios USING btree (firebase_uid);


--
-- Name: uq_bridge_equipo_preparado_activo; Type: INDEX; Schema: pmp; Owner: -
--

CREATE UNIQUE INDEX uq_bridge_equipo_preparado_activo ON pmp.bridges USING btree (tipo_equipo, equipo_preparado_serie) WHERE ((estado)::text = ANY ((ARRAY['PENDIENTE_ASIGNACION'::character varying, 'ASIGNADA'::character varying, 'EN_TERRENO'::character varying])::text[]));


--
-- Name: uq_bridge_referencia; Type: INDEX; Schema: pmp; Owner: -
--

CREATE UNIQUE INDEX uq_bridge_referencia ON pmp.bridge_referencias USING btree (tipo_equipo, serie, codigo_os, lower((sistema_externo)::text), lower((referencia_externa)::text));


--
-- Name: uq_caso_instalacion; Type: INDEX; Schema: pmp; Owner: -
--

CREATE UNIQUE INDEX uq_caso_instalacion ON pmp.ordenes_servicio USING btree (caso_id, instalacion_numero) WHERE ((caso_id IS NOT NULL) AND (instalacion_numero IS NOT NULL));


--
-- Name: uq_caso_intervencion_activo; Type: INDEX; Schema: pmp; Owner: -
--

CREATE UNIQUE INDEX uq_caso_intervencion_activo ON pmp.ordenes_servicio USING btree (caso_id, tipo_equipo, COALESCE(validador_serie, consola_serie), COALESCE(es_pod, false)) WHERE ((caso_id IS NOT NULL) AND (es_instalacion IS NOT TRUE));


--
-- Name: uq_caso_origen_referencia; Type: INDEX; Schema: pmp; Owner: -
--

CREATE UNIQUE INDEX uq_caso_origen_referencia ON pmp.casos_operacionales USING btree (origen, referencia_externa) WHERE (referencia_externa IS NOT NULL);


--
-- Name: uq_habilitacion_inicial; Type: INDEX; Schema: pmp; Owner: -
--

CREATE UNIQUE INDEX uq_habilitacion_inicial ON pmp.flujo_eventos USING btree (tipo_equipo, serie) WHERE (((tipo)::text = 'HABILITADO_INSTALACION'::text) AND (tipo_equipo IS NOT NULL) AND (codigo_os IS NULL));


--
-- Name: uq_stock_evento_consumido; Type: INDEX; Schema: pmp; Owner: -
--

CREATE UNIQUE INDEX uq_stock_evento_consumido ON pmp.ordenes_servicio USING btree (stock_origen_evento) WHERE (stock_origen_evento IS NOT NULL);


--
-- Name: uq_validadores_amid; Type: INDEX; Schema: pmp; Owner: -
--

CREATE UNIQUE INDEX uq_validadores_amid ON pmp.validadores USING btree (amid) WHERE (amid IS NOT NULL);


--
-- Name: ux_guia_detalle_consola; Type: INDEX; Schema: pmp; Owner: -
--

CREATE UNIQUE INDEX ux_guia_detalle_consola ON pmp.guia_detalle USING btree (guia_numero, consola_serie) WHERE (consola_serie IS NOT NULL);


--
-- Name: ux_guia_detalle_validador; Type: INDEX; Schema: pmp; Owner: -
--

CREATE UNIQUE INDEX ux_guia_detalle_validador ON pmp.guia_detalle USING btree (guia_numero, validador_serie) WHERE (validador_serie IS NOT NULL);


--
-- Name: ordenes_servicio trg_bloquear_update_codigo_os; Type: TRIGGER; Schema: pmp; Owner: -
--

CREATE TRIGGER trg_bloquear_update_codigo_os BEFORE UPDATE ON pmp.ordenes_servicio FOR EACH ROW EXECUTE FUNCTION pmp.bloquear_update_codigo_os();


--
-- Name: bridges trg_bridge_cerrada_inmutable; Type: TRIGGER; Schema: pmp; Owner: -
--

CREATE TRIGGER trg_bridge_cerrada_inmutable BEFORE DELETE OR UPDATE ON pmp.bridges FOR EACH ROW EXECUTE FUNCTION pmp.bloquear_bridge_cerrada();


--
-- Name: escaneos_equipos trg_escaneos_equipos_append_only; Type: TRIGGER; Schema: pmp; Owner: -
--

CREATE TRIGGER trg_escaneos_equipos_append_only BEFORE DELETE OR UPDATE ON pmp.escaneos_equipos FOR EACH ROW EXECUTE FUNCTION pmp.bloquear_historico_append_only();


--
-- Name: flujo_eventos trg_flujo_eventos_append_only; Type: TRIGGER; Schema: pmp; Owner: -
--

CREATE TRIGGER trg_flujo_eventos_append_only BEFORE DELETE OR UPDATE ON pmp.flujo_eventos FOR EACH ROW EXECUTE FUNCTION pmp.bloquear_historico_append_only();


--
-- Name: ordenes_servicio trg_generar_id_os; Type: TRIGGER; Schema: pmp; Owner: -
--

CREATE TRIGGER trg_generar_id_os BEFORE INSERT ON pmp.ordenes_servicio FOR EACH ROW EXECUTE FUNCTION pmp.generar_id_os();


--
-- Name: instalaciones_equipos trg_instalaciones_append_only; Type: TRIGGER; Schema: pmp; Owner: -
--

CREATE TRIGGER trg_instalaciones_append_only BEFORE DELETE OR UPDATE ON pmp.instalaciones_equipos FOR EACH ROW EXECUTE FUNCTION pmp.bloquear_historico_append_only();


--
-- Name: ordenes_servicio trg_os_historial_activo; Type: TRIGGER; Schema: pmp; Owner: -
--

CREATE TRIGGER trg_os_historial_activo AFTER INSERT OR UPDATE ON pmp.ordenes_servicio FOR EACH ROW EXECUTE FUNCTION pmp.registrar_historial_activo();


--
-- Name: os_historial_activo trg_os_historial_inmutable; Type: TRIGGER; Schema: pmp; Owner: -
--

CREATE TRIGGER trg_os_historial_inmutable BEFORE DELETE OR UPDATE ON pmp.os_historial_activo FOR EACH ROW EXECUTE FUNCTION pmp.bloquear_historico_append_only();


--
-- Name: casos_operacionales trg_proteger_identidad_caso; Type: TRIGGER; Schema: pmp; Owner: -
--

CREATE TRIGGER trg_proteger_identidad_caso BEFORE DELETE OR UPDATE ON pmp.casos_operacionales FOR EACH ROW EXECUTE FUNCTION pmp.proteger_identidad_caso();


--
-- Name: qa_inspecciones trg_qa_append_only; Type: TRIGGER; Schema: pmp; Owner: -
--

CREATE TRIGGER trg_qa_append_only BEFORE DELETE OR UPDATE ON pmp.qa_inspecciones FOR EACH ROW EXECUTE FUNCTION pmp.bloquear_historico_append_only();


--
-- Name: bridge_referencias trg_referencia_inmutable; Type: TRIGGER; Schema: pmp; Owner: -
--

CREATE TRIGGER trg_referencia_inmutable BEFORE DELETE OR UPDATE ON pmp.bridge_referencias FOR EACH ROW EXECUTE FUNCTION pmp.bloquear_historico_append_only();


--
-- Name: bridge_referencias trg_validar_correlacion; Type: TRIGGER; Schema: pmp; Owner: -
--

CREATE TRIGGER trg_validar_correlacion BEFORE INSERT ON pmp.bridge_referencias FOR EACH ROW EXECUTE FUNCTION pmp.validar_correlacion_activo();


--
-- Name: escaneos_equipos trg_validar_escaneo_activo; Type: TRIGGER; Schema: pmp; Owner: -
--

CREATE TRIGGER trg_validar_escaneo_activo BEFORE INSERT OR UPDATE ON pmp.escaneos_equipos FOR EACH ROW EXECUTE FUNCTION pmp.validar_evento_activo();


--
-- Name: flujo_eventos trg_validar_evento_activo; Type: TRIGGER; Schema: pmp; Owner: -
--

CREATE TRIGGER trg_validar_evento_activo BEFORE INSERT OR UPDATE ON pmp.flujo_eventos FOR EACH ROW EXECUTE FUNCTION pmp.validar_evento_activo();


--
-- Name: ordenes_servicio trg_validar_pst_terminal_os; Type: TRIGGER; Schema: pmp; Owner: -
--

CREATE TRIGGER trg_validar_pst_terminal_os BEFORE INSERT OR UPDATE ON pmp.ordenes_servicio FOR EACH ROW EXECUTE FUNCTION pmp.validar_pst_terminal_os();


--
-- Name: ordenes_servicio trg_validar_relaciones_caso; Type: TRIGGER; Schema: pmp; Owner: -
--

CREATE TRIGGER trg_validar_relaciones_caso BEFORE INSERT OR UPDATE ON pmp.ordenes_servicio FOR EACH ROW EXECUTE FUNCTION pmp.validar_relaciones_caso();


--
-- Name: ordenes_servicio trg_validar_stock_evento; Type: TRIGGER; Schema: pmp; Owner: -
--

CREATE TRIGGER trg_validar_stock_evento BEFORE INSERT OR UPDATE ON pmp.ordenes_servicio FOR EACH ROW EXECUTE FUNCTION pmp.validar_stock_evento();


--
-- Name: ordenes_servicio trg_validar_ubicacion_estado; Type: TRIGGER; Schema: pmp; Owner: -
--

CREATE TRIGGER trg_validar_ubicacion_estado BEFORE INSERT OR UPDATE ON pmp.ordenes_servicio FOR EACH ROW EXECUTE FUNCTION pmp.validar_ubicacion_estado();


--
-- Name: bridge_mantenimiento bridge_mantenimiento_bridge_codigo_fkey; Type: FK CONSTRAINT; Schema: pmp; Owner: -
--

ALTER TABLE ONLY pmp.bridge_mantenimiento
    ADD CONSTRAINT bridge_mantenimiento_bridge_codigo_fkey FOREIGN KEY (bridge_codigo) REFERENCES pmp.bridges(codigo_bridge);


--
-- Name: bridge_mantenimiento bridge_mantenimiento_codigo_os_fkey; Type: FK CONSTRAINT; Schema: pmp; Owner: -
--

ALTER TABLE ONLY pmp.bridge_mantenimiento
    ADD CONSTRAINT bridge_mantenimiento_codigo_os_fkey FOREIGN KEY (codigo_os) REFERENCES pmp.ordenes_servicio(codigo_os);


--
-- Name: bridge_referencias bridge_referencias_codigo_os_fkey; Type: FK CONSTRAINT; Schema: pmp; Owner: -
--

ALTER TABLE ONLY pmp.bridge_referencias
    ADD CONSTRAINT bridge_referencias_codigo_os_fkey FOREIGN KEY (codigo_os) REFERENCES pmp.ordenes_servicio(codigo_os);


--
-- Name: bridge_referencias bridge_referencias_creado_por_fkey; Type: FK CONSTRAINT; Schema: pmp; Owner: -
--

ALTER TABLE ONLY pmp.bridge_referencias
    ADD CONSTRAINT bridge_referencias_creado_por_fkey FOREIGN KEY (creado_por) REFERENCES pmp.usuarios(id);


--
-- Name: bridges bridges_asignado_por_fkey; Type: FK CONSTRAINT; Schema: pmp; Owner: -
--

ALTER TABLE ONLY pmp.bridges
    ADD CONSTRAINT bridges_asignado_por_fkey FOREIGN KEY (asignado_por) REFERENCES pmp.usuarios(id);


--
-- Name: bridges bridges_bus_confirmado_fkey; Type: FK CONSTRAINT; Schema: pmp; Owner: -
--

ALTER TABLE ONLY pmp.bridges
    ADD CONSTRAINT bridges_bus_confirmado_fkey FOREIGN KEY (bus_confirmado) REFERENCES pmp.buses(ppu);


--
-- Name: bridges bridges_bus_esperado_fkey; Type: FK CONSTRAINT; Schema: pmp; Owner: -
--

ALTER TABLE ONLY pmp.bridges
    ADD CONSTRAINT bridges_bus_esperado_fkey FOREIGN KEY (bus_esperado) REFERENCES pmp.buses(ppu);


--
-- Name: bridges bridges_cancelado_por_fkey; Type: FK CONSTRAINT; Schema: pmp; Owner: -
--

ALTER TABLE ONLY pmp.bridges
    ADD CONSTRAINT bridges_cancelado_por_fkey FOREIGN KEY (cancelado_por) REFERENCES pmp.usuarios(id);


--
-- Name: bridges bridges_creado_por_fkey; Type: FK CONSTRAINT; Schema: pmp; Owner: -
--

ALTER TABLE ONLY pmp.bridges
    ADD CONSTRAINT bridges_creado_por_fkey FOREIGN KEY (creado_por) REFERENCES pmp.usuarios(id);


--
-- Name: bridges bridges_pst_confirmado_codigo_fkey; Type: FK CONSTRAINT; Schema: pmp; Owner: -
--

ALTER TABLE ONLY pmp.bridges
    ADD CONSTRAINT bridges_pst_confirmado_codigo_fkey FOREIGN KEY (pst_confirmado_codigo) REFERENCES pmp.pst(codigo);


--
-- Name: bridges bridges_pst_esperado_codigo_fkey; Type: FK CONSTRAINT; Schema: pmp; Owner: -
--

ALTER TABLE ONLY pmp.bridges
    ADD CONSTRAINT bridges_pst_esperado_codigo_fkey FOREIGN KEY (pst_esperado_codigo) REFERENCES pmp.pst(codigo);


--
-- Name: bridges bridges_tecnico_terreno_id_fkey; Type: FK CONSTRAINT; Schema: pmp; Owner: -
--

ALTER TABLE ONLY pmp.bridges
    ADD CONSTRAINT bridges_tecnico_terreno_id_fkey FOREIGN KEY (tecnico_terreno_id) REFERENCES pmp.usuarios(id);


--
-- Name: bridges bridges_terminal_confirmada_id_fkey; Type: FK CONSTRAINT; Schema: pmp; Owner: -
--

ALTER TABLE ONLY pmp.bridges
    ADD CONSTRAINT bridges_terminal_confirmada_id_fkey FOREIGN KEY (terminal_confirmada_id) REFERENCES pmp.terminales(id);


--
-- Name: bridges bridges_terminal_esperado_id_fkey; Type: FK CONSTRAINT; Schema: pmp; Owner: -
--

ALTER TABLE ONLY pmp.bridges
    ADD CONSTRAINT bridges_terminal_esperado_id_fkey FOREIGN KEY (terminal_esperado_id) REFERENCES pmp.terminales(id);


--
-- Name: casos_operacionales casos_operacionales_bus_ppu_fkey; Type: FK CONSTRAINT; Schema: pmp; Owner: -
--

ALTER TABLE ONLY pmp.casos_operacionales
    ADD CONSTRAINT casos_operacionales_bus_ppu_fkey FOREIGN KEY (bus_ppu) REFERENCES pmp.buses(ppu);


--
-- Name: casos_operacionales casos_operacionales_creado_por_fkey; Type: FK CONSTRAINT; Schema: pmp; Owner: -
--

ALTER TABLE ONLY pmp.casos_operacionales
    ADD CONSTRAINT casos_operacionales_creado_por_fkey FOREIGN KEY (creado_por) REFERENCES pmp.usuarios(id);


--
-- Name: casos_operacionales casos_operacionales_pst_codigo_fkey; Type: FK CONSTRAINT; Schema: pmp; Owner: -
--

ALTER TABLE ONLY pmp.casos_operacionales
    ADD CONSTRAINT casos_operacionales_pst_codigo_fkey FOREIGN KEY (pst_codigo) REFERENCES pmp.pst(codigo);


--
-- Name: casos_operacionales casos_operacionales_terminal_id_fkey; Type: FK CONSTRAINT; Schema: pmp; Owner: -
--

ALTER TABLE ONLY pmp.casos_operacionales
    ADD CONSTRAINT casos_operacionales_terminal_id_fkey FOREIGN KEY (terminal_id) REFERENCES pmp.terminales(id);


--
-- Name: config_estado_ubicacion config_estado_ubicacion_estado_id_fkey; Type: FK CONSTRAINT; Schema: pmp; Owner: -
--

ALTER TABLE ONLY pmp.config_estado_ubicacion
    ADD CONSTRAINT config_estado_ubicacion_estado_id_fkey FOREIGN KEY (estado_id) REFERENCES pmp.estados(id);


--
-- Name: consolas consolas_registrado_por_fkey; Type: FK CONSTRAINT; Schema: pmp; Owner: -
--

ALTER TABLE ONLY pmp.consolas
    ADD CONSTRAINT consolas_registrado_por_fkey FOREIGN KEY (registrado_por) REFERENCES pmp.usuarios(id);


--
-- Name: escaneos_equipos escaneos_equipos_codigo_os_fkey; Type: FK CONSTRAINT; Schema: pmp; Owner: -
--

ALTER TABLE ONLY pmp.escaneos_equipos
    ADD CONSTRAINT escaneos_equipos_codigo_os_fkey FOREIGN KEY (codigo_os) REFERENCES pmp.ordenes_servicio(codigo_os);


--
-- Name: escaneos_equipos escaneos_equipos_ubicacion_id_fkey; Type: FK CONSTRAINT; Schema: pmp; Owner: -
--

ALTER TABLE ONLY pmp.escaneos_equipos
    ADD CONSTRAINT escaneos_equipos_ubicacion_id_fkey FOREIGN KEY (ubicacion_id) REFERENCES pmp.ubicaciones(id);


--
-- Name: escaneos_equipos escaneos_equipos_usuario_id_fkey; Type: FK CONSTRAINT; Schema: pmp; Owner: -
--

ALTER TABLE ONLY pmp.escaneos_equipos
    ADD CONSTRAINT escaneos_equipos_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES pmp.usuarios(id);


--
-- Name: flujo_eventos flujo_eventos_bridge_codigo_fkey; Type: FK CONSTRAINT; Schema: pmp; Owner: -
--

ALTER TABLE ONLY pmp.flujo_eventos
    ADD CONSTRAINT flujo_eventos_bridge_codigo_fkey FOREIGN KEY (bridge_codigo) REFERENCES pmp.bridges(codigo_bridge);


--
-- Name: flujo_eventos flujo_eventos_codigo_os_fkey; Type: FK CONSTRAINT; Schema: pmp; Owner: -
--

ALTER TABLE ONLY pmp.flujo_eventos
    ADD CONSTRAINT flujo_eventos_codigo_os_fkey FOREIGN KEY (codigo_os) REFERENCES pmp.ordenes_servicio(codigo_os);


--
-- Name: flujo_eventos flujo_eventos_usuario_id_fkey; Type: FK CONSTRAINT; Schema: pmp; Owner: -
--

ALTER TABLE ONLY pmp.flujo_eventos
    ADD CONSTRAINT flujo_eventos_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES pmp.usuarios(id);


--
-- Name: guia_detalle guia_detalle_bus_ppu_fkey; Type: FK CONSTRAINT; Schema: pmp; Owner: -
--

ALTER TABLE ONLY pmp.guia_detalle
    ADD CONSTRAINT guia_detalle_bus_ppu_fkey FOREIGN KEY (bus_ppu) REFERENCES pmp.buses(ppu);


--
-- Name: guia_detalle guia_detalle_codigo_os_fkey; Type: FK CONSTRAINT; Schema: pmp; Owner: -
--

ALTER TABLE ONLY pmp.guia_detalle
    ADD CONSTRAINT guia_detalle_codigo_os_fkey FOREIGN KEY (codigo_os) REFERENCES pmp.ordenes_servicio(codigo_os) ON DELETE SET NULL;


--
-- Name: guia_detalle guia_detalle_consola_serie_fkey; Type: FK CONSTRAINT; Schema: pmp; Owner: -
--

ALTER TABLE ONLY pmp.guia_detalle
    ADD CONSTRAINT guia_detalle_consola_serie_fkey FOREIGN KEY (consola_serie) REFERENCES pmp.consolas(serie);


--
-- Name: guia_detalle guia_detalle_guia_numero_fkey; Type: FK CONSTRAINT; Schema: pmp; Owner: -
--

ALTER TABLE ONLY pmp.guia_detalle
    ADD CONSTRAINT guia_detalle_guia_numero_fkey FOREIGN KEY (guia_numero) REFERENCES pmp.guias(numero) ON DELETE CASCADE;


--
-- Name: guia_detalle guia_detalle_validador_serie_fkey; Type: FK CONSTRAINT; Schema: pmp; Owner: -
--

ALTER TABLE ONLY pmp.guia_detalle
    ADD CONSTRAINT guia_detalle_validador_serie_fkey FOREIGN KEY (validador_serie) REFERENCES pmp.validadores(serie);


--
-- Name: guias guias_creado_por_fkey; Type: FK CONSTRAINT; Schema: pmp; Owner: -
--

ALTER TABLE ONLY pmp.guias
    ADD CONSTRAINT guias_creado_por_fkey FOREIGN KEY (creado_por) REFERENCES pmp.usuarios(id);


--
-- Name: guias guias_destino_id_fkey; Type: FK CONSTRAINT; Schema: pmp; Owner: -
--

ALTER TABLE ONLY pmp.guias
    ADD CONSTRAINT guias_destino_id_fkey FOREIGN KEY (destino_id) REFERENCES pmp.ubicaciones(id);


--
-- Name: guias guias_origen_id_fkey; Type: FK CONSTRAINT; Schema: pmp; Owner: -
--

ALTER TABLE ONLY pmp.guias
    ADD CONSTRAINT guias_origen_id_fkey FOREIGN KEY (origen_id) REFERENCES pmp.ubicaciones(id);


--
-- Name: instalaciones_equipos instalaciones_equipos_bridge_codigo_fkey; Type: FK CONSTRAINT; Schema: pmp; Owner: -
--

ALTER TABLE ONLY pmp.instalaciones_equipos
    ADD CONSTRAINT instalaciones_equipos_bridge_codigo_fkey FOREIGN KEY (bridge_codigo) REFERENCES pmp.bridges(codigo_bridge);


--
-- Name: instalaciones_equipos instalaciones_equipos_bus_ppu_fkey; Type: FK CONSTRAINT; Schema: pmp; Owner: -
--

ALTER TABLE ONLY pmp.instalaciones_equipos
    ADD CONSTRAINT instalaciones_equipos_bus_ppu_fkey FOREIGN KEY (bus_ppu) REFERENCES pmp.buses(ppu);


--
-- Name: instalaciones_equipos instalaciones_equipos_pst_codigo_fkey; Type: FK CONSTRAINT; Schema: pmp; Owner: -
--

ALTER TABLE ONLY pmp.instalaciones_equipos
    ADD CONSTRAINT instalaciones_equipos_pst_codigo_fkey FOREIGN KEY (pst_codigo) REFERENCES pmp.pst(codigo);


--
-- Name: instalaciones_equipos instalaciones_equipos_tecnico_terreno_id_fkey; Type: FK CONSTRAINT; Schema: pmp; Owner: -
--

ALTER TABLE ONLY pmp.instalaciones_equipos
    ADD CONSTRAINT instalaciones_equipos_tecnico_terreno_id_fkey FOREIGN KEY (tecnico_terreno_id) REFERENCES pmp.usuarios(id);


--
-- Name: instalaciones_equipos instalaciones_equipos_terminal_id_fkey; Type: FK CONSTRAINT; Schema: pmp; Owner: -
--

ALTER TABLE ONLY pmp.instalaciones_equipos
    ADD CONSTRAINT instalaciones_equipos_terminal_id_fkey FOREIGN KEY (terminal_id) REFERENCES pmp.terminales(id);


--
-- Name: ordenes_servicio ordenes_servicio_bus_ppu_fkey; Type: FK CONSTRAINT; Schema: pmp; Owner: -
--

ALTER TABLE ONLY pmp.ordenes_servicio
    ADD CONSTRAINT ordenes_servicio_bus_ppu_fkey FOREIGN KEY (bus_ppu) REFERENCES pmp.buses(ppu);


--
-- Name: ordenes_servicio ordenes_servicio_caso_id_fkey; Type: FK CONSTRAINT; Schema: pmp; Owner: -
--

ALTER TABLE ONLY pmp.ordenes_servicio
    ADD CONSTRAINT ordenes_servicio_caso_id_fkey FOREIGN KEY (caso_id) REFERENCES pmp.casos_operacionales(id);


--
-- Name: ordenes_servicio ordenes_servicio_consola_serie_fkey; Type: FK CONSTRAINT; Schema: pmp; Owner: -
--

ALTER TABLE ONLY pmp.ordenes_servicio
    ADD CONSTRAINT ordenes_servicio_consola_serie_fkey FOREIGN KEY (consola_serie) REFERENCES pmp.consolas(serie);


--
-- Name: ordenes_servicio ordenes_servicio_estado_id_fkey; Type: FK CONSTRAINT; Schema: pmp; Owner: -
--

ALTER TABLE ONLY pmp.ordenes_servicio
    ADD CONSTRAINT ordenes_servicio_estado_id_fkey FOREIGN KEY (estado_id) REFERENCES pmp.estados(id);


--
-- Name: ordenes_servicio ordenes_servicio_os_origen_fkey; Type: FK CONSTRAINT; Schema: pmp; Owner: -
--

ALTER TABLE ONLY pmp.ordenes_servicio
    ADD CONSTRAINT ordenes_servicio_os_origen_fkey FOREIGN KEY (os_origen) REFERENCES pmp.ordenes_servicio(codigo_os);


--
-- Name: ordenes_servicio ordenes_servicio_pst_codigo_fkey; Type: FK CONSTRAINT; Schema: pmp; Owner: -
--

ALTER TABLE ONLY pmp.ordenes_servicio
    ADD CONSTRAINT ordenes_servicio_pst_codigo_fkey FOREIGN KEY (pst_codigo) REFERENCES pmp.pst(codigo);


--
-- Name: ordenes_servicio ordenes_servicio_qa_asignado_por_fkey; Type: FK CONSTRAINT; Schema: pmp; Owner: -
--

ALTER TABLE ONLY pmp.ordenes_servicio
    ADD CONSTRAINT ordenes_servicio_qa_asignado_por_fkey FOREIGN KEY (qa_asignado_por) REFERENCES pmp.usuarios(id);


--
-- Name: ordenes_servicio ordenes_servicio_qa_usuario_id_fkey; Type: FK CONSTRAINT; Schema: pmp; Owner: -
--

ALTER TABLE ONLY pmp.ordenes_servicio
    ADD CONSTRAINT ordenes_servicio_qa_usuario_id_fkey FOREIGN KEY (qa_usuario_id) REFERENCES pmp.usuarios(id);


--
-- Name: ordenes_servicio ordenes_servicio_stock_origen_evento_fkey; Type: FK CONSTRAINT; Schema: pmp; Owner: -
--

ALTER TABLE ONLY pmp.ordenes_servicio
    ADD CONSTRAINT ordenes_servicio_stock_origen_evento_fkey FOREIGN KEY (stock_origen_evento) REFERENCES pmp.flujo_eventos(id);


--
-- Name: ordenes_servicio ordenes_servicio_stock_origen_os_fkey; Type: FK CONSTRAINT; Schema: pmp; Owner: -
--

ALTER TABLE ONLY pmp.ordenes_servicio
    ADD CONSTRAINT ordenes_servicio_stock_origen_os_fkey FOREIGN KEY (stock_origen_os) REFERENCES pmp.ordenes_servicio(codigo_os);


--
-- Name: ordenes_servicio ordenes_servicio_tecnico_laboratorio_id_fkey; Type: FK CONSTRAINT; Schema: pmp; Owner: -
--

ALTER TABLE ONLY pmp.ordenes_servicio
    ADD CONSTRAINT ordenes_servicio_tecnico_laboratorio_id_fkey FOREIGN KEY (tecnico_laboratorio_id) REFERENCES pmp.usuarios(id);


--
-- Name: ordenes_servicio ordenes_servicio_tecnico_terreno_id_fkey; Type: FK CONSTRAINT; Schema: pmp; Owner: -
--

ALTER TABLE ONLY pmp.ordenes_servicio
    ADD CONSTRAINT ordenes_servicio_tecnico_terreno_id_fkey FOREIGN KEY (tecnico_terreno_id) REFERENCES pmp.usuarios(id);


--
-- Name: ordenes_servicio ordenes_servicio_terminal_id_fkey; Type: FK CONSTRAINT; Schema: pmp; Owner: -
--

ALTER TABLE ONLY pmp.ordenes_servicio
    ADD CONSTRAINT ordenes_servicio_terminal_id_fkey FOREIGN KEY (terminal_id) REFERENCES pmp.terminales(id);


--
-- Name: ordenes_servicio ordenes_servicio_ubicacion_id_fkey; Type: FK CONSTRAINT; Schema: pmp; Owner: -
--

ALTER TABLE ONLY pmp.ordenes_servicio
    ADD CONSTRAINT ordenes_servicio_ubicacion_id_fkey FOREIGN KEY (ubicacion_id) REFERENCES pmp.ubicaciones(id);


--
-- Name: ordenes_servicio ordenes_servicio_validador_serie_fkey; Type: FK CONSTRAINT; Schema: pmp; Owner: -
--

ALTER TABLE ONLY pmp.ordenes_servicio
    ADD CONSTRAINT ordenes_servicio_validador_serie_fkey FOREIGN KEY (validador_serie) REFERENCES pmp.validadores(serie);


--
-- Name: qa_inspecciones qa_inspecciones_codigo_os_fkey; Type: FK CONSTRAINT; Schema: pmp; Owner: -
--

ALTER TABLE ONLY pmp.qa_inspecciones
    ADD CONSTRAINT qa_inspecciones_codigo_os_fkey FOREIGN KEY (codigo_os) REFERENCES pmp.ordenes_servicio(codigo_os);


--
-- Name: qa_inspecciones qa_inspecciones_qa_usuario_id_fkey; Type: FK CONSTRAINT; Schema: pmp; Owner: -
--

ALTER TABLE ONLY pmp.qa_inspecciones
    ADD CONSTRAINT qa_inspecciones_qa_usuario_id_fkey FOREIGN KEY (qa_usuario_id) REFERENCES pmp.usuarios(id);


--
-- Name: registro_reparaciones registro_reparaciones_codigo_os_fkey; Type: FK CONSTRAINT; Schema: pmp; Owner: -
--

ALTER TABLE ONLY pmp.registro_reparaciones
    ADD CONSTRAINT registro_reparaciones_codigo_os_fkey FOREIGN KEY (codigo_os) REFERENCES pmp.ordenes_servicio(codigo_os);


--
-- Name: registro_reparaciones registro_reparaciones_tecnico_id_fkey; Type: FK CONSTRAINT; Schema: pmp; Owner: -
--

ALTER TABLE ONLY pmp.registro_reparaciones
    ADD CONSTRAINT registro_reparaciones_tecnico_id_fkey FOREIGN KEY (tecnico_id) REFERENCES pmp.usuarios(id);


--
-- Name: solicitud_items solicitud_items_repuesto_id_fkey; Type: FK CONSTRAINT; Schema: pmp; Owner: -
--

ALTER TABLE ONLY pmp.solicitud_items
    ADD CONSTRAINT solicitud_items_repuesto_id_fkey FOREIGN KEY (repuesto_id) REFERENCES pmp.repuestos(id);


--
-- Name: solicitud_items solicitud_items_solicitud_id_fkey; Type: FK CONSTRAINT; Schema: pmp; Owner: -
--

ALTER TABLE ONLY pmp.solicitud_items
    ADD CONSTRAINT solicitud_items_solicitud_id_fkey FOREIGN KEY (solicitud_id) REFERENCES pmp.solicitudes_repuestos(id) ON DELETE CASCADE;


--
-- Name: solicitudes_repuestos solicitudes_repuestos_codigo_os_fkey; Type: FK CONSTRAINT; Schema: pmp; Owner: -
--

ALTER TABLE ONLY pmp.solicitudes_repuestos
    ADD CONSTRAINT solicitudes_repuestos_codigo_os_fkey FOREIGN KEY (codigo_os) REFERENCES pmp.ordenes_servicio(codigo_os);


--
-- Name: solicitudes_repuestos solicitudes_repuestos_solicitado_por_fkey; Type: FK CONSTRAINT; Schema: pmp; Owner: -
--

ALTER TABLE ONLY pmp.solicitudes_repuestos
    ADD CONSTRAINT solicitudes_repuestos_solicitado_por_fkey FOREIGN KEY (solicitado_por) REFERENCES pmp.usuarios(id);


--
-- Name: terminal_pst terminal_pst_pst_codigo_fkey; Type: FK CONSTRAINT; Schema: pmp; Owner: -
--

ALTER TABLE ONLY pmp.terminal_pst
    ADD CONSTRAINT terminal_pst_pst_codigo_fkey FOREIGN KEY (pst_codigo) REFERENCES pmp.pst(codigo) ON DELETE RESTRICT;


--
-- Name: terminal_pst terminal_pst_terminal_id_fkey; Type: FK CONSTRAINT; Schema: pmp; Owner: -
--

ALTER TABLE ONLY pmp.terminal_pst
    ADD CONSTRAINT terminal_pst_terminal_id_fkey FOREIGN KEY (terminal_id) REFERENCES pmp.terminales(id) ON DELETE CASCADE;


--
-- Name: validadores validadores_registrado_por_fkey; Type: FK CONSTRAINT; Schema: pmp; Owner: -
--

ALTER TABLE ONLY pmp.validadores
    ADD CONSTRAINT validadores_registrado_por_fkey FOREIGN KEY (registrado_por) REFERENCES pmp.usuarios(id);


--
-- PostgreSQL database dump complete
--

\unrestrict fgWA3FeSaDwVvlwWXCg6bKBwFCrC75Anyee0ce4w8arYfnOdgRhrHsxebGRNGgp

