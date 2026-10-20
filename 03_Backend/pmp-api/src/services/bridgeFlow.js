export const BRIDGE_STATES = Object.freeze({
  PENDING_ASSIGNMENT: "PENDIENTE_ASIGNACION",
  ASSIGNED: "ASIGNADA",
  IN_FIELD: "EN_TERRENO",
  COMPLETED: "COMPLETADA",
  CANCELLED: "CANCELADA"
});

export const MAINTENANCE_STATES = Object.freeze({
  PENDING_LOGISTICS_RECEIPT: 2,
  PENDING_LAB_ASSIGNMENT: 3,
  IN_DIAGNOSIS: 4,
  IN_REPAIR: 5,
  PENDING_QA_ASSIGNMENT: 6,
  AVAILABLE: 7,
  WAITING_PART: 9,
  QA_APPROVED_PENDING_LOGISTICS: 11,
  INSTALLED: 12
});

export class FlowError extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = "FlowError";
    this.status = status;
    this.code = code;
  }
}

export function requireText(value, field, { max = 1000, min = 1 } = {}) {
  if (typeof value !== "string") {
    throw new FlowError(422, "VALIDATION_ERROR", `${field} es obligatorio`);
  }
  const normalized = value.trim();
  if (normalized.length < min || normalized.length > max) {
    throw new FlowError(422, "VALIDATION_ERROR", `${field} debe contener entre ${min} y ${max} caracteres`);
  }
  return normalized;
}

export function optionalText(value, field, { max = 1000 } = {}) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") {
    throw new FlowError(422, "VALIDATION_ERROR", `${field} debe ser texto`);
  }
  const normalized = value.trim();
  if (!normalized) return null;
  if (normalized.length > max) {
    throw new FlowError(422, "VALIDATION_ERROR", `${field} excede ${max} caracteres`);
  }
  return normalized;
}

export function requireEquipmentType(value) {
  const type = requireText(value, "tipo_equipo", { max: 20 }).toUpperCase();
  if (!new Set(["VALIDADOR", "CONSOLA"]).has(type)) {
    throw new FlowError(422, "VALIDATION_ERROR", "tipo_equipo debe ser VALIDADOR o CONSOLA");
  }
  return type;
}

export function requirePositiveInteger(value, field) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new FlowError(422, "VALIDATION_ERROR", `${field} debe ser un entero positivo`);
  }
  return parsed;
}

export function requireIsoDate(value, field) {
  const text = requireText(value, field, { max: 64 });
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) {
    throw new FlowError(422, "VALIDATION_ERROR", `${field} no contiene una fecha válida`);
  }
  if (date.getTime() > Date.now() + 5 * 60 * 1000) {
    throw new FlowError(422, "VALIDATION_ERROR", `${field} no puede estar en el futuro`);
  }
  return date.toISOString();
}

export function assertBridgeAssignedTo(bridge, userId) {
  if (String(bridge.tecnico_terreno_id) !== String(userId)) {
    throw new FlowError(403, "BRIDGE_NOT_ASSIGNED", "La Bridge pertenece a otro técnico de terreno");
  }
}

export function assertMaintenanceAssignedTo(os, field, userId, code) {
  if (!os[field] || String(os[field]) !== String(userId)) {
    throw new FlowError(403, code, "La OS de mantenimiento no está asignada al usuario autenticado");
  }
}

export function assertState(actual, allowed, code = "INVALID_FLOW_STATE") {
  const accepted = Array.isArray(allowed) ? allowed : [allowed];
  if (!accepted.includes(actual)) {
    throw new FlowError(409, code, `La operación no es válida en el estado actual (${actual})`);
  }
}

export function equipmentColumns(type, series) {
  return type === "CONSOLA"
    ? { validador: null, consola: series, table: "consolas" }
    : { validador: series, consola: null, table: "validadores" };
}

export async function withTransaction(pool, work) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    try { await client.query("ROLLBACK"); } catch { /* Preserve the original error. */ }
    throw error;
  } finally {
    client.release();
  }
}

export async function requireActiveUserRole(client, id, role, label) {
  const result = await client.query(
    `SELECT id, nombre, apellido, rol
     FROM pmp.usuarios
     WHERE id = $1::uuid AND activo = TRUE AND rol = $2
     LIMIT 1`,
    [id, role]
  );
  if (result.rowCount !== 1) {
    throw new FlowError(422, "INVALID_ASSIGNEE", `${label} no corresponde a un usuario ${role} activo`);
  }
  return result.rows[0];
}

export async function requireEquipment(client, type, series, label = "equipo") {
  const { table } = equipmentColumns(type, series);
  const result = await client.query(`SELECT serie FROM pmp.${table} WHERE serie = $1 LIMIT 1`, [series]);
  if (result.rowCount !== 1) {
    throw new FlowError(422, "UNKNOWN_EQUIPMENT", `${label} no está registrado en el maestro de ${table}`);
  }
}

export async function requireTerminalPst(client, terminalId, pstCode) {
  const result = await client.query(
    `SELECT 1
     FROM pmp.terminal_pst
     WHERE terminal_id = $1 AND pst_codigo = $2
     LIMIT 1`,
    [terminalId, pstCode]
  );
  if (result.rowCount !== 1) {
    throw new FlowError(422, "INVALID_TERMINAL_PST", "El PST no está autorizado para la terminal informada");
  }
}

export async function requireLocationType(client, locationId, type) {
  const result = await client.query(
    `SELECT id, nombre FROM pmp.ubicaciones WHERE id = $1 AND tipo = $2 LIMIT 1`,
    [locationId, type]
  );
  if (result.rowCount !== 1) {
    throw new FlowError(422, "INVALID_LOCATION", `La ubicación debe pertenecer al dominio ${type}`);
  }
  return result.rows[0];
}

export async function addFlowEvent(client, { bridge = null, os = null, type, user, comment = null, metadata = {}, asset = null }) {
  const result = await client.query(
    `INSERT INTO pmp.flujo_eventos
       (bridge_codigo, codigo_os, tipo, usuario_id, rol, comentario, metadata, tipo_equipo, serie)
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9) RETURNING *`,
    [bridge, os, type, user.id, user.rol, comment, JSON.stringify(metadata), asset?.tipo_equipo ?? null, asset?.serie ?? null]
  );
  return result.rows[0];
}

export function sendFlowError(res, error, next) {
  if (error instanceof FlowError) {
    return res.status(error.status).json({ error: error.code, message: error.message });
  }
  if (error?.code === "23505") {
    return res.status(409).json({ error: "FLOW_CONFLICT", message: "La operación duplicaría un registro del flujo" });
  }
  return next(error);
}
