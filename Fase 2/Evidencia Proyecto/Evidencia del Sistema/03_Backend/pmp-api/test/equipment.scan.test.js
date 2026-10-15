import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  SCAN_STATIONS,
  canConfirmAtStation,
  expectedSeriesForAmid,
  isSameRecentPhysicalScan,
  isStateCompatibleWithStation,
  isValidUpcA,
  normalizeScannedCode
} from "../src/services/equipmentScan.js";
import { ROLES } from "../src/constants/roles.js";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const validatorExamples = [
  ["280000062387", "7406238"],
  ["280000208563", "7420856"],
  ["280000223689", "7422368"],
  ["205000045932", "7204593"],
  ["280000026792", "7402679"],
  ["280000065241", "7406524"],
  ["205000046243", "7204624"],
  ["280000046691", "7404669"],
  ["280000029922", "7402992"],
  ["280000075127", "7407512"]
];

test("los AMID de ejemplo poseen checksum UPC-A y resuelven la serie esperada", () => {
  for (const [amid, serie] of validatorExamples) {
    assert.equal(isValidUpcA(amid), true, amid);
    assert.equal(expectedSeriesForAmid(amid), serie, amid);
  }
  assert.equal(isValidUpcA("280000062386"), false);
  assert.equal(expectedSeriesForAmid("280000062386"), null);
});

test("el lector normaliza Enter, espacios y minúsculas sin alterar identificadores", () => {
  assert.equal(normalizeScannedCode(" 7406238\r\n"), "7406238");
  assert.equal(normalizeScannedCode(" 9715a0001\n"), "9715A0001");
  assert.throws(() => normalizeScannedCode("   "), (error) => error.code === "SCAN_CODE_REQUIRED");
  assert.throws(() => normalizeScannedCode("X".repeat(65)), (error) => error.code === "SCAN_CODE_TOO_LONG");
});

test("cada rol operacional confirma únicamente en su estación física", () => {
  assert.equal(canConfirmAtStation(ROLES.LOGISTICA, SCAN_STATIONS.WAREHOUSE), true);
  assert.equal(canConfirmAtStation(ROLES.LOGISTICA, SCAN_STATIONS.LAB), false);
  assert.equal(canConfirmAtStation(ROLES.JEFE_LABORATORIO, SCAN_STATIONS.LAB), true);
  assert.equal(canConfirmAtStation(ROLES.TECNICO_LAB, SCAN_STATIONS.LAB), false);
  assert.equal(canConfirmAtStation(ROLES.QA, SCAN_STATIONS.QA), true);
  assert.equal(canConfirmAtStation(ROLES.GERENTE, SCAN_STATIONS.WAREHOUSE), false);
  assert.equal(canConfirmAtStation(ROLES.ADMIN, SCAN_STATIONS.WAREHOUSE), false);
});

test("la estación valida ubicación física sin ejecutar decisiones operacionales", () => {
  for (const state of [2, 3, 7, 11]) assert.equal(isStateCompatibleWithStation(SCAN_STATIONS.WAREHOUSE, state), true);
  for (const state of [4, 5, 9, 10]) assert.equal(isStateCompatibleWithStation(SCAN_STATIONS.LAB, state), true);
  assert.equal(isStateCompatibleWithStation(SCAN_STATIONS.QA, 6), true);
  assert.equal(isStateCompatibleWithStation(SCAN_STATIONS.QA, 5), false);
  assert.equal(isStateCompatibleWithStation(SCAN_STATIONS.LAB, 6), false);
});

test("las rutas de escaneo conservan la cadena RBAC y usan consultas parametrizadas", async () => {
  const [app, routes, service] = await Promise.all([
    source("src/app.js"),
    source("src/routes/equipmentScan.routes.js"),
    source("src/services/equipmentScan.js")
  ]);
  assert.match(app, /app\.use\("\/api\/equipment-scan", equipmentScanRoutes\)/);
  assert.match(routes, /router\.use\(firebaseAuth, ensureUser, enforceReadOnlyRole\)/);
  assert.match(routes, /router\.get\("\/resolve", authorize\('scan.read'\)/);
  assert.match(routes, /router\.post\("\/confirm", authorize\('scan.validate'\)/);
  assert.match(routes, /authorize\('scan.validate'\)/);
  assert.doesNotMatch(routes, /setCustomUserClaims|revokeRefreshTokens/);
  assert.match(service, /\$1/);
  assert.match(service, /\[code, derivedSeries\]/);
  assert.match(service, /\[station\]/);
  assert.match(service, /\[equipment\.tipo_equipo, equipment\.serie\]/);
  assert.match(service, /\[lockKey\]/);
});

test("la migración agrega AMID único y un historial de escaneos append-only", async () => {
  const migration = await source("../../05_BaseDatos/migraciones/escaneo/001_identificacion_fisica_schema.sql");
  assert.match(migration, /ADD COLUMN IF NOT EXISTS amid varchar\(32\)/);
  assert.match(migration, /CREATE UNIQUE INDEX IF NOT EXISTS uq_validadores_amid/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS pmp\.escaneos_equipos/);
  assert.match(migration, /trg_escaneos_equipos_append_only/);
  assert.match(migration, /REFERENCES pmp\.ordenes_servicio\(codigo_os\)/);
});

test("las operaciones físicas de bodega, laboratorio y QA exigen el último escaneo de su estación", async () => {
  const [service, bodega, lab, qa] = await Promise.all([
    source("src/services/equipmentScan.js"),
    source("src/routes/bodega.routes.js"),
    source("src/routes/lab.routes.js"),
    source("src/routes/qa.routes.js")
  ]);
  assert.match(service, /export async function requireLatestPhysicalScan/);
  assert.match(service, /PHYSICAL_SCAN_REQUIRED/);
  assert.match(service, /ORDER BY s\.fecha DESC, s\.id DESC/);
  assert.match(bodega, /requireLatestPhysicalScan\(client, \{ codigoOs: codigo_os, station: "BODEGA" \}\)/);
  assert.match(lab, /requireLatestPhysicalScan\(client,\s*\{codigoOs:codigo_os,station:\x27LABORATORIO\x27\}\)/);
  assert.match(qa, /qaCommand/);
  assert.match(await source('src/services/qaWork.js'), /QA_RECEIPT_REQUIRED/);
  assert.match(lab, /router\.post\("\/dispatch-qa", authorize\('lab.custody'\)/);
  assert.match(lab, /status\(410\)/);
  assert.match(lab, /confirmLabCustody/);
  assert.match(await source('src/services/labCustody.js'), /CUSTODY_EVIDENCE_REQUIRED/);
});

test("la deduplicación solo reutiliza la última lectura de la misma estación y usuario", async () => {
  const context = { userId: "user-bodega", station: "BODEGA", locationId: 1 };
  assert.equal(isSameRecentPhysicalScan({ dentro_ventana: true, estacion: "BODEGA", usuario_id: "user-bodega", ubicacion_id: 1 }, context), true);
  assert.equal(isSameRecentPhysicalScan({ dentro_ventana: true, estacion: "LABORATORIO", usuario_id: "user-bodega", ubicacion_id: 2 }, context), false);
  assert.equal(isSameRecentPhysicalScan({ dentro_ventana: true, estacion: "BODEGA", usuario_id: "otro-usuario", ubicacion_id: 1 }, context), false);
  assert.equal(isSameRecentPhysicalScan({ dentro_ventana: false, estacion: "BODEGA", usuario_id: "user-bodega", ubicacion_id: 1 }, context), false);

  const service = await source("src/services/equipmentScan.js");
  assert.match(service, /export function isSameRecentPhysicalScan/);
  assert.match(service, /latest\.estacion === station/);
  assert.match(service, /String\(latest\.usuario_id\) === String\(userId\)/);
  assert.match(service, /ORDER BY fecha DESC, id DESC/);
});

test("los escaneos rechazados fijan tipos SQL y el despacho QA no asigna técnicos", async () => {
  const [service, bodega] = await Promise.all([
    source("src/services/equipmentScan.js"),
    source("src/routes/bodega.routes.js")
  ]);
  assert.match(service, /\$1::varchar\(64\)/);
  assert.match(service, /\$3::text/);
  assert.match(service, /\$4::uuid/);
  assert.match(bodega, /router\.get\("\/qa-users"/);
  assert.match(bodega, /confirmLabDispatch\(pool,req.body,req.user,'QA'\)/);
  assert.match(bodega, /rol = 'qa' AND activo = TRUE/);
  assert.doesNotMatch(bodega, /qa_usuario_id = \$2/);
  const dispatch=await source('src/services/warehouseLabDispatch.js');
  assert.match(dispatch,/QA_ASSIGNMENT_SEPARATE/);
});

test("la resolución del escaneo entrega contexto para decidir la siguiente acción", async () => {
  const service = await source("src/services/equipmentScan.js");
  assert.match(service, /o\.es_aprobado_qa/);
  assert.match(service, /o\.es_instalacion/);
  assert.match(service, /AS fue_laboratorio/);
  assert.match(service, /o\.tecnico_laboratorio_id, o\.qa_usuario_id/);
});
