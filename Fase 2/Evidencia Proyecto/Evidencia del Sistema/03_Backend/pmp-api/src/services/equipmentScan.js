import {qaCycleSql,qaReceiptSql,qaReceivedSql,qaStateSql} from './qaCustody.js';
import { labTransitSql, labReceiptSql } from './labArrival.js';
import { ROLES } from "../constants/roles.js";
import { addFlowEvent, withTransaction } from "./bridgeFlow.js";
import { installationReadySql, pendingTerrainSql } from './logisticsPresentation.js';

export const SCAN_STATIONS = Object.freeze({
  WAREHOUSE: "BODEGA",
  LAB: "LABORATORIO",
  QA: "QA"
});

const STATION_STATES = Object.freeze({
  [SCAN_STATIONS.WAREHOUSE]: new Set([2, 3, 7, 11]),
  [SCAN_STATIONS.LAB]: new Set([4, 5, 9, 10]),
  [SCAN_STATIONS.QA]: new Set([6])
});

const ROLE_STATION = Object.freeze({
  [ROLES.JEFE_LABORATORIO]: SCAN_STATIONS.LAB,
  [ROLES.LOGISTICA]: SCAN_STATIONS.WAREHOUSE,
  [ROLES.QA]: SCAN_STATIONS.QA
});

const AMID_SERIES_PREFIX = Object.freeze({
  "280000": "74",
  "205000": "72"
});

export class ScanError extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = "ScanError";
    this.status = status;
    this.code = code;
  }
}

export function normalizeScannedCode(value) {
  if (typeof value !== "string") {
    throw new ScanError(422, "SCAN_CODE_REQUIRED", "Debes escanear o ingresar un identificador");
  }
  const normalized = value.trim().replace(/\s+/g, "").toUpperCase();
  if (!normalized) {
    throw new ScanError(422, "SCAN_CODE_REQUIRED", "Debes escanear o ingresar un identificador");
  }
  if (normalized.length > 64) {
    throw new ScanError(422, "SCAN_CODE_TOO_LONG", "El identificador supera el máximo de 64 caracteres");
  }
  return normalized;
}

export function calculateUpcACheckDigit(payload) {
  if (!/^\d{11}$/.test(payload)) return null;
  const digits = [...payload].map(Number);
  const odd = digits.filter((_, index) => index % 2 === 0).reduce((sum, digit) => sum + digit, 0);
  const even = digits.filter((_, index) => index % 2 === 1).reduce((sum, digit) => sum + digit, 0);
  return String((10 - ((odd * 3 + even) % 10)) % 10);
}

export function isValidUpcA(value) {
  return /^\d{12}$/.test(value)
    && calculateUpcACheckDigit(value.slice(0, 11)) === value.at(-1);
}

export function expectedSeriesForAmid(value) {
  if (!isValidUpcA(value)) return null;
  const seriesPrefix = AMID_SERIES_PREFIX[value.slice(0, 6)];
  return seriesPrefix ? `${seriesPrefix}${value.slice(6, 11)}` : null;
}

export function normalizeStation(value) {
  const station = typeof value === "string" ? value.trim().toUpperCase() : "";
  if (!Object.values(SCAN_STATIONS).includes(station)) {
    throw new ScanError(422, "INVALID_SCAN_STATION", "La estación debe ser BODEGA, LABORATORIO o QA");
  }
  return station;
}

export function canConfirmAtStation(role, station) {
  return ROLE_STATION[role] === station;
}

export function isStateCompatibleWithStation(station, stateId) {
  return STATION_STATES[station]?.has(Number(stateId)) ?? false;
}

function codeKind(code, matchKind = null) {
  if (matchKind?.startsWith("AMID")) return "AMID";
  return isValidUpcA(code) ? "AMID" : "SERIE";
}

export async function findEquipment(client, code) {
  const derivedSeries = expectedSeriesForAmid(code);
  const result = await client.query(
    `SELECT 'VALIDADOR'::text AS tipo_equipo, v.serie, v.amid, v.modelo, v.marca,
            CASE
              WHEN upper(v.serie) = upper($1) THEN 'SERIE'
              WHEN v.amid = $1 THEN 'AMID'
              ELSE 'AMID_DERIVADO'
            END AS coincidencia
       FROM pmp.validadores v
      WHERE upper(v.serie) = upper($1)
         OR v.amid = $1
         OR ($2::text IS NOT NULL AND v.serie = $2)
      UNION ALL
     SELECT 'CONSOLA'::text AS tipo_equipo, c.serie, NULL::varchar AS amid, c.modelo, c.marca,
            'SERIE'::text AS coincidencia
       FROM pmp.consolas c
      WHERE upper(c.serie) = upper($1)`,
    [code, derivedSeries]
  );

  const unique = new Map();
  for (const row of result.rows) {
    const key = `${row.tipo_equipo}|${row.serie}`;
    const current = unique.get(key);
    if (!current || current.coincidencia === "AMID_DERIVADO") unique.set(key, row);
  }
  const matches = [...unique.values()];

  if (matches.length === 0) {
    if (/^\d{12}$/.test(code) && !isValidUpcA(code)) {
      throw new ScanError(422, "INVALID_AMID_CHECK_DIGIT", "El AMID leído posee un dígito verificador inválido");
    }
    throw new ScanError(404, "EQUIPMENT_NOT_FOUND", "El identificador no corresponde a un equipo registrado");
  }
  if (matches.length > 1) {
    throw new ScanError(409, "AMBIGUOUS_EQUIPMENT_IDENTIFIER", "El identificador está asociado a más de un equipo");
  }

  const equipment = matches[0];
  if (equipment.coincidencia === "AMID_DERIVADO" && equipment.amid && equipment.amid !== code) {
    throw new ScanError(409, "IDENTIFIER_INCONSISTENCY", "El AMID leído no coincide con el AMID registrado para la serie");
  }
  if (equipment.coincidencia === "AMID") {
    const expectedSeries = expectedSeriesForAmid(code);
    if (expectedSeries && expectedSeries !== equipment.serie) {
      throw new ScanError(409, "IDENTIFIER_INCONSISTENCY", "El AMID registrado no es consistente con la serie del validador");
    }
  }

  return {
    tipo_equipo: equipment.tipo_equipo,
    serie: equipment.serie,
    amid: equipment.amid || (equipment.coincidencia === "AMID_DERIVADO" ? code : null),
    modelo: equipment.modelo,
    marca: equipment.marca,
    coincidencia: equipment.coincidencia,
    tipo_codigo: codeKind(code, equipment.coincidencia)
  };
}

async function findActiveOrders(client, equipment) {
  const seriesColumn = equipment.tipo_equipo === "VALIDADOR" ? "o.validador_serie" : "o.consola_serie";
  const result = await client.query(
    `SELECT o.codigo_os, o.tipo_equipo, o.falla, o.estado_id, CASE WHEN o.estado_id=6 THEN ${qaStateSql()} WHEN ${labTransitSql()} THEN 'En tránsito hacia Laboratorio' WHEN ${pendingTerrainSql()} THEN 'PENDIENTE_RETIRO' ELSE e.nombre END AS estado,
            ${labTransitSql()} AS transito_laboratorio, ${labReceiptSql()} AS recepcion_laboratorio, ${qaCycleSql()} AS ciclo_qa,${qaReceiptSql()} AS recepcion_qa,
            o.bus_ppu, o.terminal_id, t.nombre AS terminal, o.pst_codigo,
            o.ubicacion_id, CASE WHEN ${labTransitSql()} THEN 'En tránsito hacia Laboratorio' ELSE u.nombre END AS ubicacion,
            o.tecnico_laboratorio_id, o.qa_usuario_id,
            o.es_aprobado_qa, o.es_instalacion,
            ${installationReadySql()} AS disponible_instalacion,${pendingTerrainSql()} AS retiro_pendiente,
            EXISTS (
              SELECT 1
                FROM pmp.registro_reparaciones rr
               WHERE rr.codigo_os = o.codigo_os
            ) AS fue_laboratorio,
            bm.bridge_codigo
       FROM pmp.ordenes_servicio o
       JOIN pmp.estados e ON e.id = o.estado_id
       JOIN pmp.terminales t ON t.id = o.terminal_id
       LEFT JOIN pmp.ubicaciones u ON u.id = o.ubicacion_id
       LEFT JOIN pmp.bridge_mantenimiento bm ON bm.codigo_os = o.codigo_os
      WHERE ${seriesColumn} = $1
        AND (o.estado_id NOT IN (8, 12, 13) OR ${installationReadySql()})
      ORDER BY o.actualizado_en DESC NULLS LAST, o.fecha DESC`,
    [equipment.serie]
  );
  return result.rows;
}

async function findStationLocation(client, station) {
  const result = await client.query(
    `SELECT id, nombre, tipo
       FROM pmp.ubicaciones
      WHERE tipo::text = $1
      ORDER BY id
      LIMIT 1`,
    [station]
  );
  if (result.rowCount !== 1) {
    throw new ScanError(409, "SCAN_LOCATION_NOT_CONFIGURED", `No existe una ubicación configurada para ${station}`);
  }
  return result.rows[0];
}

async function findLastPhysicalLocation(client, equipment) {
  const result = await client.query(
    `SELECT s.id, s.estacion, s.fecha, u.nombre AS ubicacion, s.codigo_os
       FROM pmp.escaneos_equipos s
       JOIN pmp.ubicaciones u ON u.id = s.ubicacion_id
      WHERE s.resultado = 'VALIDADO'
        AND s.tipo_equipo = $1
        AND s.serie = $2
      ORDER BY s.fecha DESC, s.id DESC
      LIMIT 1`,
    [equipment.tipo_equipo, equipment.serie]
  );
  return result.rows[0] ?? null;
}

function validationFor({ user, station, orders }) {
  if (!canConfirmAtStation(user.rol, station)) {
    return {
      estado: "SOLO_CONSULTA",
      puede_confirmar: false,
      mensaje: "Tu rol puede consultar el activo, pero no confirmar movimientos en esta estación"
    };
  }
  if (orders.length === 0) {
    return { estado: "SIN_OS_ACTIVA", puede_confirmar: false, mensaje: "El equipo no posee una OS operacional activa" };
  }
  if (orders.length > 1) {
    return { estado: "MULTIPLES_OS_ACTIVAS", puede_confirmar: false, mensaje: "El equipo posee más de una OS activa y requiere revisión" };
  }

  const order = orders[0];
  if(order.retiro_pendiente)return {estado:'RETIRO_PENDIENTE',puede_confirmar:false,mensaje:'El técnico debe confirmar el retiro físico antes de recepcionar en Bodega'};
  if(order.transito_laboratorio && station!==SCAN_STATIONS.LAB)return {estado:'UBICACION_NO_ESPERADA',puede_confirmar:false,mensaje:'El equipo está en tránsito hacia Laboratorio y requiere recepción allí'};
  const incomingLab=order.transito_laboratorio&&station===SCAN_STATIONS.LAB;
  const closedWarehouseStock = station === SCAN_STATIONS.WAREHOUSE
    && order.estado_id === 13 && order.disponible_instalacion === true;
  if (!incomingLab && !closedWarehouseStock && !isStateCompatibleWithStation(station, order.estado_id)) {
    return {
      estado: "UBICACION_NO_ESPERADA",
      puede_confirmar: false,
      mensaje: `La OS ${order.codigo_os} no espera el equipo en ${station}`
    };
  }
  if (user.rol === ROLES.TECNICO_LAB && String(order.tecnico_laboratorio_id || "") !== String(user.id)) {
    return { estado: "OS_NO_ASIGNADA", puede_confirmar: false, mensaje: "La OS no está asignada a este técnico de laboratorio" };
  }
  return {
    estado: "LISTO",
    puede_confirmar: true,
    mensaje: "El equipo, la OS, el estado y la estación son consistentes"
  };
}

export async function resolveEquipmentScan(client, { code, station, user }) {
  const normalizedCode = normalizeScannedCode(code);
  const normalizedStation = normalizeStation(station);
  const equipment = await findEquipment(client, normalizedCode);
  const [orders, location, lastLocation] = await Promise.all([
    findActiveOrders(client, equipment),
    findStationLocation(client, normalizedStation),
    findLastPhysicalLocation(client, equipment)
  ]);
  const validation = validationFor({ user, station: normalizedStation, orders });

  return {
    lectura: { codigo: normalizedCode, tipo_codigo: equipment.tipo_codigo },
    estacion: { codigo: normalizedStation, ubicacion_id: location.id, ubicacion: location.nombre },
    equipo: equipment,
    orden: orders.length === 1 ? orders[0] : null,
    ordenes_activas: orders.length,
    ultima_ubicacion: lastLocation,
    validacion: validation
  };
}

export async function requireLatestPhysicalScan(client, { codigoOs, station }) {
  const normalizedStation = normalizeStation(station);
  const result = await client.query(
    `SELECT o.codigo_os,
            o.tipo_equipo,
            COALESCE(o.validador_serie, o.consola_serie) AS serie_esperada,
            ${labTransitSql()} AS transito_laboratorio,
            s.id AS escaneo_id,
            s.estacion,
            s.tipo_equipo AS tipo_equipo_escaneado,
            s.serie AS serie_escaneada,
            s.fecha
       FROM pmp.ordenes_servicio o
       LEFT JOIN LATERAL (
         SELECT id, estacion, tipo_equipo, serie, fecha
           FROM pmp.escaneos_equipos
          WHERE codigo_os = o.codigo_os
            AND resultado = 'VALIDADO'
          ORDER BY fecha DESC, id DESC
          LIMIT 1
       ) s ON TRUE
      WHERE o.codigo_os = $1
      FOR UPDATE OF o`,
    [codigoOs]
  );
  if (result.rowCount !== 1) {
    throw new ScanError(404, "ORDER_NOT_FOUND", "La orden de servicio no existe");
  }

  const evidence = result.rows[0];
  const isExpectedScan = evidence.escaneo_id
    && evidence.estacion === normalizedStation
    && evidence.tipo_equipo_escaneado === evidence.tipo_equipo
    && evidence.serie_escaneada === evidence.serie_esperada;
  if (!isExpectedScan || (normalizedStation===SCAN_STATIONS.LAB && evidence.transito_laboratorio)) {
    throw new ScanError(
      409,
      "PHYSICAL_SCAN_REQUIRED",
      `Escanea físicamente el equipo en ${normalizedStation} antes de continuar`
    );
  }
  return evidence;
}

const VALIDATION_ERROR_CODES = Object.freeze({
  SIN_OS_ACTIVA: "ACTIVE_ORDER_REQUIRED",
  MULTIPLES_OS_ACTIVAS: "MULTIPLE_ACTIVE_ORDERS",
  UBICACION_NO_ESPERADA: "UNEXPECTED_SCAN_STATION",
  OS_NO_ASIGNADA: "ORDER_NOT_ASSIGNED",
  SOLO_CONSULTA: "SCAN_STATION_FORBIDDEN"
});

export function isSameRecentPhysicalScan(latest, { userId, station, locationId }) {
  return Boolean(
    latest
    && latest.dentro_ventana === true
    && latest.estacion === station
    && String(latest.usuario_id) === String(userId)
    && Number(latest.ubicacion_id) === Number(locationId)
  );
}

export async function confirmEquipmentScanWithClient(client, payload) {
  if (payload.assetOnly === true) return confirmNewAssetScanWithClient(client, payload);
  const code = normalizeScannedCode(payload.code);
  const station = normalizeStation(payload.station);
  const lockKey = [payload.user.id, station, code].join("|");
  await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [lockKey]);

    let resolution = await resolveEquipmentScan(client, { code, station, user: payload.user });
    if(resolution.orden){
      await client.query('SELECT codigo_os FROM pmp.ordenes_servicio WHERE codigo_os=$1 FOR UPDATE',[resolution.orden.codigo_os]);
      resolution=await resolveEquipmentScan(client,{code,station,user:payload.user});
    }
    if (!resolution.validacion.puede_confirmar) {
      throw new ScanError(
        resolution.validacion.estado === "OS_NO_ASIGNADA" || resolution.validacion.estado === "SOLO_CONSULTA" ? 403 : 409,
        VALIDATION_ERROR_CODES[resolution.validacion.estado] || "SCAN_REJECTED",
        resolution.validacion.mensaje
      );
    }

    if(station===SCAN_STATIONS.WAREHOUSE&&[2,11].includes(resolution.orden.estado_id))payload={...payload,deferLocationUpdate:true};
    // Receipt is an area custody action, independent of the certifier. Lock above serializes rescans.
    if(station===SCAN_STATIONS.QA && resolution.orden.recepcion_qa && !payload.deferLocationUpdate){
      const existing=(await client.query("SELECT id,fecha FROM pmp.escaneos_equipos WHERE codigo_os=$1 AND estacion='QA' AND resultado='VALIDADO' ORDER BY fecha DESC,id DESC LIMIT 1",[resolution.orden.codigo_os])).rows[0];
      return {...resolution,escaneo:existing,duplicado:true};
    }
    const latestScan = await client.query(
      `SELECT id, fecha, estacion, usuario_id, ubicacion_id, metadata,
              fecha >= now() - interval '3 seconds' AS dentro_ventana
         FROM pmp.escaneos_equipos
        WHERE resultado = 'VALIDADO'
          AND tipo_equipo = $1
          AND serie = $2
          AND codigo_os = $3
        ORDER BY fecha DESC, id DESC
        LIMIT 1`,
      [resolution.equipo.tipo_equipo, resolution.equipo.serie, resolution.orden.codigo_os]
    );
    const latest = latestScan.rows[0] ?? null;
    const sameContext = !payload.metadata || Object.entries(payload.metadata)
      .every(([key, value]) => String(latest?.metadata?.[key] ?? '') === String(value ?? ''));
    if (!resolution.orden.transito_laboratorio && !payload.deferLocationUpdate && sameContext && isSameRecentPhysicalScan(latest, {
      userId: payload.user.id,
      station,
      locationId: resolution.estacion.ubicacion_id
    })) {
      return { ...resolution, escaneo: { id: latest.id, fecha: latest.fecha }, duplicado: true };
    }

    if(!payload.deferLocationUpdate)await client.query(
      `UPDATE pmp.ordenes_servicio
          SET ubicacion_id = $2, estado_id=CASE WHEN $3 THEN 4 ELSE estado_id END, actualizado_en = now()
        WHERE codigo_os = $1`,
      [resolution.orden.codigo_os, resolution.estacion.ubicacion_id, station===SCAN_STATIONS.LAB&&resolution.orden.transito_laboratorio===true]
    );

    const inserted = await client.query(
      `INSERT INTO pmp.escaneos_equipos
         (codigo_leido, tipo_codigo, estacion, tipo_equipo, serie, amid,
          codigo_os, ubicacion_id, usuario_id, rol, resultado, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'VALIDADO',$11::jsonb)
       RETURNING id, fecha`,
      [resolution.lectura.codigo, resolution.lectura.tipo_codigo, station,
        resolution.equipo.tipo_equipo, resolution.equipo.serie, resolution.equipo.amid,
        resolution.orden.codigo_os, resolution.estacion.ubicacion_id,
        payload.user.id, payload.user.rol,
        JSON.stringify({ coincidencia: resolution.equipo.coincidencia, ...payload.metadata,...(station===SCAN_STATIONS.QA?{ciclo_qa:resolution.orden.ciclo_qa||'legacy',origen_captura:'SCANNER'}:{}) })]
    );

    if(station===SCAN_STATIONS.QA&&!resolution.orden.recepcion_qa){
      await addFlowEvent(client,{os:resolution.orden.codigo_os,asset:resolution.equipo,user:payload.user,type:'RECEPCION_QA_CONFIRMADA',
       comment:'Recepción física en QA confirmada.',
       metadata:{ciclo_qa:resolution.orden.ciclo_qa||'legacy',escaneo_id:inserted.rows[0].id,fecha_recepcion:inserted.rows[0].fecha,ubicacion:resolution.estacion.ubicacion,metodo_validacion:'SCANNER'}});
      resolution.orden={...resolution.orden,recepcion_qa:inserted.rows[0].fecha,estado:'Recibido en QA / pendiente de asignación'};
    }
    if(station===SCAN_STATIONS.LAB&&!resolution.orden.recepcion_laboratorio){
      await addFlowEvent(client,{os:resolution.orden.codigo_os,asset:resolution.equipo,user:payload.user,
       type:'RECEPCION_LABORATORIO_CONFIRMADA',comment:'Recepción física en Laboratorio confirmada.',
       metadata:{escaneo_id:inserted.rows[0].id,fecha_recepcion:inserted.rows[0].fecha,ubicacion:resolution.estacion.ubicacion,
       serie:resolution.equipo.serie,metodo_validacion:'SCANNER'}});
    }
    await addFlowEvent(client, {
      bridge: resolution.orden.bridge_codigo,
      os: resolution.orden.codigo_os,
      type: payload.deferLocationUpdate ? (payload.metadata?.contexto==='DESPACHO_TERRENO'?"VALIDACION_DESPACHO_BODEGA":"VALIDACION_RECEPCION_BODEGA") : "UBICACION_FISICA_CONFIRMADA",
      user: payload.user,
      metadata: {
        escaneo_id: inserted.rows[0].id,
        estacion: station,
        ubicacion_id: resolution.estacion.ubicacion_id,
        tipo_codigo: resolution.lectura.tipo_codigo,
        equipo_serie: resolution.equipo.serie
      }
    });

  if(station===SCAN_STATIONS.LAB&&resolution.orden.transito_laboratorio){
    resolution.orden={...resolution.orden,estado_id:4,estado:'EN_DIAGNOSTICO',ubicacion_id:resolution.estacion.ubicacion_id,ubicacion:resolution.estacion.ubicacion,transito_laboratorio:false};
  }
  if(station===SCAN_STATIONS.QA)resolution=await resolveEquipmentScan(client,{code,station,user:payload.user});
  return { ...resolution, escaneo: inserted.rows[0], duplicado: false };
}

export async function confirmEquipmentScan(pool, payload) {
  return withTransaction(pool, (client) => confirmEquipmentScanWithClient(client, payload));
}

// Same identifier, station, role and audit rules; an explicit initial-asset context
// permits physical evidence before the first operational OS exists.
async function confirmNewAssetScanWithClient(client, payload) {
  const code=normalizeScannedCode(payload.code),station=normalizeStation(payload.station);
  if(station!=='BODEGA'||!canConfirmAtStation(payload.user.rol,station))
    throw new ScanError(403,'SCAN_STATION_FORBIDDEN','Tu rol no confirma escaneos físicos en Bodega');
  if(payload.metadata?.origen_captura!=='SCANNER')
    throw new ScanError(409,'PHYSICAL_SCAN_REQUIRED','Escanea físicamente el activo nuevo en Bodega');
  const equipment=await findEquipment(client,code);
  if(payload.expectedAsset && (equipment.tipo_equipo!==payload.expectedAsset.tipo_equipo||equipment.serie!==payload.expectedAsset.serie))
    throw new ScanError(409,'SCANNED_ASSET_MISMATCH','La lectura no corresponde al tipo y serie seleccionados');
  await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',[`${equipment.tipo_equipo}|${equipment.serie}`]);
  if((await client.query('SELECT 1 FROM pmp.ordenes_servicio WHERE tipo_equipo=$1 AND COALESCE(validador_serie,consola_serie)=$2',[equipment.tipo_equipo,equipment.serie])).rowCount)
    throw new ScanError(409,'ASSET_ALREADY_HAS_WORKFLOW','El activo tiene intervenciones. Usa su circuito existente');
  const location=await findStationLocation(client,station);
  const metadata={...payload.metadata,circuito:'ACTIVO_NUEVO',coincidencia:equipment.coincidencia};
  const inserted=(await client.query(`INSERT INTO pmp.escaneos_equipos
    (codigo_leido,tipo_codigo,estacion,tipo_equipo,serie,amid,codigo_os,ubicacion_id,usuario_id,rol,resultado,metadata)
    VALUES($1,$2,$3,$4,$5,$6,NULL,$7,$8,$9,'VALIDADO',$10) RETURNING id,fecha`,
  [code,equipment.tipo_codigo,station,equipment.tipo_equipo,equipment.serie,equipment.amid,location.id,payload.user.id,payload.user.rol,JSON.stringify(metadata)])).rows[0];
  await addFlowEvent(client,{asset:equipment,type:'ESCANEO_BODEGA',user:payload.user,
    metadata:{...metadata,escaneo_id:inserted.id,ubicacion_id:location.id}});
  return {equipo:equipment,orden:null,estacion:{codigo:station,ubicacion_id:location.id,ubicacion:location.nombre},escaneo:inserted};
}

export async function requireLatestAssetScan(client,{asset,scanId,user,context}) {
  const latest=(await client.query(`SELECT * FROM pmp.escaneos_equipos
    WHERE tipo_equipo=$1 AND serie=$2 AND resultado='VALIDADO' ORDER BY fecha DESC,id DESC LIMIT 1`,
  [asset.tipo_equipo,asset.serie])).rows[0];
  if(!latest || String(latest.id)!==String(scanId) || latest.codigo_os!==null || latest.estacion!=='BODEGA'
    || latest.metadata.circuito!=='ACTIVO_NUEVO' || latest.metadata.origen_captura!=='SCANNER'
    || String(latest.usuario_id)!==String(user.id) || (context&&latest.metadata.contexto!==context))
    throw new ScanError(409,'PHYSICAL_SCAN_REQUIRED','Escanea físicamente este activo en Bodega para la operación actual');
  return latest;
}

export async function recordRejectedScan(pool, { code, station, user, error }) {
  let normalizedCode;
  let normalizedStation;
  try {
    normalizedCode = normalizeScannedCode(code);
    normalizedStation = normalizeStation(station);
  } catch {
    return;
  }
  try {
    await pool.query(
      `INSERT INTO pmp.escaneos_equipos
         (codigo_leido, tipo_codigo, estacion, ubicacion_id, usuario_id, rol,
          resultado, motivo, metadata)
       SELECT $1::varchar(64), $2::varchar(16), $3::varchar(20),
              u.id, $4::uuid, $5::varchar(50), 'RECHAZADO'::varchar(16),
              $6::varchar(64), $7::jsonb
         FROM pmp.ubicaciones u
        WHERE u.tipo::text = $3::text
        ORDER BY u.id
        LIMIT 1`,
      [normalizedCode, isValidUpcA(normalizedCode) ? "AMID" : "SERIE", normalizedStation,
        user.id, user.rol, error.code || "SCAN_REJECTED", JSON.stringify({ status: error.status || 409 })]
    );
  } catch (auditError) {
    console.warn("No fue posible auditar un escaneo rechazado", {
      error: auditError.code || auditError.name,
      role: user.rol,
      station: normalizedStation
    });
  }
}
