import "dotenv/config";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { existsSync, mkdtempSync, rmSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { createServer } from "node:net";
import { basename, join, resolve, sep } from "node:path";
import { tmpdir } from "node:os";
import pg from "pg";

const { Pool } = pg;
const PREFIX = "E2E_SCAN_FLOW";
const SERIES = "7405020";
const AMID = "280000050209";
const TEST_BUS = "E2ESF001";
const TEST_PST = "E2E_SCAN_FLOW_PST";
const sourceUrl = process.env.DATABASE_URL;
if (!sourceUrl) throw new Error("DATABASE_URL no está configurada");

const postgresBin = [
  process.env.POSTGRES_BIN,
  "C:\\Program Files\\PostgreSQL\\18\\bin",
  "C:\\Program Files\\PostgreSQL\\17\\bin",
  "C:\\Program Files\\PostgreSQL\\16\\bin"
].filter(Boolean).find((candidate) =>
  existsSync(`${candidate}\\pg_dump.exe`)
  && existsSync(`${candidate}\\psql.exe`)
  && existsSync(`${candidate}\\initdb.exe`)
  && existsSync(`${candidate}\\pg_ctl.exe`)
);
if (!postgresBin) throw new Error("No se encontró una instalación completa de PostgreSQL");

const users = Object.freeze({
  admin: { id: "e2e50000-0000-4000-8000-000000000001", role: "admin" },
  logistica: { id: "e2e50000-0000-4000-8000-000000000002", role: "logistica" },
  terreno: { id: "e2e50000-0000-4000-8000-000000000003", role: "tecnico_terreno" },
  lab: { id: "e2e50000-0000-4000-8000-000000000004", role: "tecnico_laboratorio" },
  qa: { id: "e2e50000-0000-4000-8000-000000000005", role: "qa" }
});
for (const [key, user] of Object.entries(users)) {
  user.email = `${PREFIX.toLowerCase()}_${key}@pmp-suite.test`;
}

const report = {
  ok: false,
  isolation: "clúster PostgreSQL efímero con schema-only y fixtures propias",
  steps: [],
  expectedBlocks: [],
  findings: [],
  cleanup: null
};

let temporaryRoot;
let temporaryData;
let temporaryClusterStarted = false;
let temporaryUrl;
let testPool;
let server;
const sourcePool = new Pool({ connectionString: sourceUrl });

function runProgram(executable, args, options = {}) {
  const result = spawnSync(executable, args, { maxBuffer: 32 * 1024 * 1024, ...options });
  if (result.status !== 0) {
    const stderr = Buffer.isBuffer(result.stderr)
      ? result.stderr.toString("utf8")
      : String(result.stderr || "");
    throw new Error(`${basename(executable)} terminó con código ${result.status}: ${stderr.trim()}`);
  }
  return result;
}

function pgEnvironment(url) {
  const parsed = new URL(url);
  return {
    ...process.env,
    PGHOST: parsed.hostname,
    PGPORT: parsed.port || "5432",
    PGUSER: decodeURIComponent(parsed.username),
    PGPASSWORD: decodeURIComponent(parsed.password),
    PGDATABASE: parsed.pathname.replace(/^\//, "")
  };
}

async function availablePort() {
  return new Promise((resolvePort, reject) => {
    const probe = createServer();
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address();
      probe.close((error) => error ? reject(error) : resolvePort(address.port));
    });
  });
}

async function createIsolatedDatabase() {
  temporaryRoot = mkdtempSync(join(tmpdir(), "pmp-suite-scan-flow-e2e-"));
  temporaryData = join(temporaryRoot, "data");
  const port = await availablePort();
  runProgram(`${postgresBin}\\initdb.exe`, [
    "--pgdata", temporaryData,
    "--auth", "trust",
    "--username", "postgres",
    "--encoding", "UTF8",
    "--no-locale"
  ], { encoding: "utf8" });
  runProgram(`${postgresBin}\\pg_ctl.exe`, [
    "--pgdata", temporaryData,
    "--options", `-h 127.0.0.1 -p ${port}`,
    "--wait", "start"
  ], { encoding: "utf8", stdio: "ignore" });
  temporaryClusterStarted = true;
  temporaryUrl = `postgresql://postgres@127.0.0.1:${port}/postgres`;

  const dump = runProgram(`${postgresBin}\\pg_dump.exe`, [
    "--schema-only", "--no-owner", "--no-privileges"
  ], { env: pgEnvironment(sourceUrl), encoding: null });
  runProgram(`${postgresBin}\\psql.exe`, ["--set", "ON_ERROR_STOP=1", "--quiet"], {
    env: pgEnvironment(temporaryUrl), input: dump.stdout, encoding: null
  });
}

async function sourceSnapshot() {
  const result = await sourcePool.query(
    `SELECT
       (SELECT COUNT(*)::int FROM pmp.usuarios WHERE correo LIKE $1) AS users,
       (SELECT COUNT(*)::int FROM pmp.validadores WHERE serie=$2 OR amid=$3) AS equipment,
       (SELECT COUNT(*)::int FROM pmp.ordenes_servicio WHERE falla LIKE $4) AS orders,
       (SELECT COUNT(*)::int FROM pmp.escaneos_equipos WHERE codigo_leido IN ($2,$3)) AS scans`,
    [`${PREFIX.toLowerCase()}_%`, SERIES, AMID, `${PREFIX}%`]
  );
  return result.rows[0];
}

async function seedFixtures(pool) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`INSERT INTO pmp.estados (id,nombre) VALUES
      (1,'EN_RUTA'),(2,'EN_TRANSITO'),(3,'EN_BODEGA'),(4,'EN_DIAGNOSTICO'),
      (5,'EN_REPARACION'),(6,'EN_QA'),(7,'DISPONIBLE'),(8,'RECHAZADO'),
      (9,'ESPERA_REPUESTO'),(10,'FINALIZADO_TALLER'),
      (11,'EN_TRAYECTO_BODEGA'),(12,'INSTALADO'),(13,'CERRADO')`);
    await client.query(
      `INSERT INTO pmp.usuarios (id,nombre,apellido,correo,rol,activo,firebase_uid)
       SELECT x.id::uuid,$1,x.apellido,x.correo,x.rol,TRUE,NULL
       FROM jsonb_to_recordset($2::jsonb) AS x(id text,apellido text,correo text,rol text)`,
      [PREFIX, JSON.stringify(Object.entries(users).map(([key, user]) => ({
        id: user.id, apellido: key, correo: user.email, rol: user.role
      })))]
    );
    await client.query("INSERT INTO pmp.buses (ppu) VALUES ($1),('STOCK')", [TEST_BUS]);
    await client.query("INSERT INTO pmp.pst (codigo,nombre) VALUES ($1,$2)", [TEST_PST, `${PREFIX} PST`]);
    const terminal = await client.query(
      "INSERT INTO pmp.terminales (nombre) VALUES ($1) RETURNING id",
      [`${PREFIX} TERMINAL`]
    );
    await client.query(
      "INSERT INTO pmp.terminal_pst (terminal_id,pst_codigo) VALUES ($1,$2)",
      [terminal.rows[0].id, TEST_PST]
    );
    const locations = await client.query(`INSERT INTO pmp.ubicaciones (nombre,tipo) VALUES
      ($1,'BODEGA'),($2,'LABORATORIO'),($3,'QA') RETURNING id,tipo`,
      [`${PREFIX} BODEGA`, `${PREFIX} LABORATORIO`, `${PREFIX} QA`]
    );
    const byType = Object.fromEntries(locations.rows.map((row) => [row.tipo, row.id]));
    assert.deepEqual(byType, { BODEGA: 1, LABORATORIO: 2, QA: 3 });
    await client.query(`INSERT INTO pmp.config_estado_ubicacion (estado_id,tipo_ubicacion) VALUES
      (1,'BODEGA'),(2,'BODEGA'),(3,'BODEGA'),(4,'LABORATORIO'),
      (5,'LABORATORIO'),(6,'QA'),(7,'BODEGA'),(9,'LABORATORIO'),
      (10,'LABORATORIO'),(11,'BODEGA'),(12,'BODEGA'),
      (13,'BODEGA'),(13,'LABORATORIO'),(13,'QA')`);
    await client.query("COMMIT");
    return { terminalId: terminal.rows[0].id, locations: byType };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

function replaceFirebaseAuth(router) {
  const layer = router.stack.find((candidate) => candidate.handle?.name === "firebaseAuthMiddleware");
  assert.ok(layer, "No se encontró firebaseAuthMiddleware en un router E2E");
  layer.handle = function e2eFirebaseAuth(req, res, next) {
    const actor = users[req.get("x-e2e-actor")];
    if (!actor) return res.status(401).json({ error: "E2E_AUTH_REQUIRED" });
    req.firebase = { uid: `fixture-${actor.id}`, email: actor.email, name: PREFIX };
    return next();
  };
}

async function startHarness() {
  process.env.DATABASE_URL = temporaryUrl;
  const [
    { default: express }, { pool }, { default: osRouter }, { default: scanRouter },
    { default: bodegaRouter }, { default: labRouter }, { default: qaRouter }
  ] = await Promise.all([
    import("express"), import("../src/db.js"), import("../src/routes/os.routes.js"),
    import("../src/routes/equipmentScan.routes.js"), import("../src/routes/bodega.routes.js"),
    import("../src/routes/lab.routes.js"), import("../src/routes/qa.routes.js")
  ]);
  testPool = pool;
  for (const router of [osRouter, scanRouter, bodegaRouter, labRouter, qaRouter]) {
    replaceFirebaseAuth(router);
  }
  const app = express();
  app.use(express.json());
  app.use("/api/os", osRouter);
  app.use("/api/equipment-scan", scanRouter);
  app.use("/api/bodega", bodegaRouter);
  app.use("/api/lab", labRouter);
  app.use("/api/qa", qaRouter);
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    return res.status(error.status || 500).json({ error: error.code || "INTERNAL_ERROR", message: error.message });
  });
  server = await new Promise((resolveServer, reject) => {
    const instance = app.listen(0, "127.0.0.1", () => resolveServer(instance));
    instance.once("error", reject);
  });
  return { pool, baseUrl: `http://127.0.0.1:${server.address().port}` };
}

async function request(baseUrl, actor, method, path, body) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    signal: AbortSignal.timeout(10_000),
    headers: { "content-type": "application/json", "x-e2e-actor": actor },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const text = await response.text();
  let data = null;
  if (text) {
    try { data = JSON.parse(text); } catch { data = { raw: text }; }
  }
  return { status: response.status, data };
}

function expect(response, status, label) {
  assert.equal(response.status, status,
    `${label}: esperado ${status}, recibido ${response.status} ${JSON.stringify(response.data)}`);
  return response.data;
}

async function state(pool, code) {
  const result = await pool.query(
    `SELECT codigo_os,estado_id,ubicacion_id,tecnico_terreno_id,
            tecnico_laboratorio_id,qa_usuario_id,es_aprobado_qa,
            COALESCE(validador_serie,consola_serie) AS serie
       FROM pmp.ordenes_servicio WHERE codigo_os=$1`, [code]
  );
  assert.equal(result.rowCount, 1, `OS ${code} no encontrada`);
  return result.rows[0];
}

async function scan(baseUrl, actor, code, station, expectedStatus = 201) {
  const response = await request(baseUrl, actor, "POST", "/api/equipment-scan/confirm", {
    codigo: code, estacion: station
  });
  return expect(response, expectedStatus, `${actor} escanea ${code} en ${station}`);
}

async function executeFlow(pool, baseUrl, fixture) {
  // Existing installed park; reporting a fault must never bootstrap the master.
  await pool.query('INSERT INTO pmp.validadores(serie,modelo,marca,amid) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING',[SERIES,'CVB45','Mikroelektronika',AMID]);
  await pool.query(`INSERT INTO pmp.ordenes_servicio(tipo_equipo,validador_serie,falla,estado_id,bus_ppu,terminal_id,pst_codigo)
    VALUES('VALIDADOR',$1,'Parque instalado inicial',12,$2,$3,$4)`,[SERIES,TEST_BUS,fixture.terminalId,TEST_PST]);

  const created = expect(await request(baseUrl, "terreno", "POST", "/api/os/crear", {
    tipo: "VALIDADOR", es_pod: false, falla: `${PREFIX} FALLA EN TERRENO`,
    bus_ppu: TEST_BUS, serie_equipo: SERIES, amid: AMID,
    modelo: "CVB45", marca: "Mikroelektronika",
    terminal_id: fixture.terminalId, pst_codigo: TEST_PST
  }), 201, "Terreno escanea identificadores y crea OS");
  const maintenanceCode = created.os.codigo_os;
  assert.equal(created.os.estado_id, 1);
  const identity=expect(await request(baseUrl,'terreno','POST','/api/os/validar-identidad-retiro',{codigo_os:maintenanceCode,metodo_validacion:'SCAN',codigo_leido:AMID}),200,'Validar identidad por AMID');
  expect(await request(baseUrl, 'terreno', 'POST', '/api/os/confirmar-retiro', {
    validacion_id:identity.validacion_id,pod:false,
    codigo_os: maintenanceCode, tipo_equipo:'VALIDADOR',serie:SERIES,bus_ppu:TEST_BUS,
    retiro_confirmado:true,evidencia:'Retiro f?sico confirmado en prueba aislada'
  }),200,'Retiro f?sico previo al tr?nsito');
  report.steps.push({ step: 1, action: "Terreno crea OS pendiente y confirma retiro f?sico", status: 201, state: 2 });

  const noWarehouseScan = await request(baseUrl, "logistica", "PUT", "/api/bodega/receive", { codigo_os: maintenanceCode });
  expect(noWarehouseScan, 409, "Bodega no recibe sin escaneo");
  assert.equal(noWarehouseScan.data.error, "PHYSICAL_SCAN_REQUIRED");
  report.expectedBlocks.push({ action: "Bodega recibe sin escaneo", ...noWarehouseScan });
  expect(await request(baseUrl,'logistica','POST','/api/bodega/recepcion-terreno/validar',{codigo_os:maintenanceCode,tipo_equipo:'VALIDADOR',codigo:AMID,origen_captura:'SCANNER',lectura_scanner:{tipo:'KEYBOARD_WEDGE',intervalos_ms:Array(AMID.length).fill(10)}}),200,'Lectura específica de recepción');
  expect(await request(baseUrl, "logistica", "PUT", "/api/bodega/receive", { codigo_os: maintenanceCode }), 200, "Bodega recibe desde terreno");
  assert.equal((await state(pool, maintenanceCode)).estado_id, 3);
  report.steps.push({ step: 2, action: "Bodega recibe equipo validado físicamente", status: 200, state: 3 });

  expect(await request(baseUrl, "admin", "PUT", "/api/lab/assign", {
    codigo_os: maintenanceCode, tecnico_id: users.lab.id
  }), 200, "Admin asigna laboratorio");
  expect(await request(baseUrl, "logistica", "PUT", "/api/bodega/dispatch-lab", {
    codigo_os: maintenanceCode
  }), 200, "Bodega despacha a laboratorio");
  assert.equal((await state(pool, maintenanceCode)).estado_id, 4);
  report.steps.push({ step: 3, action: "Bodega envía a laboratorio", status: 200, state: 4 });

  const noLabScan = await request(baseUrl, "lab", "PUT", "/api/lab/move", {
    codigo_os: maintenanceCode, nuevo_estado_id: 5
  });
  expect(noLabScan, 409, "Laboratorio no inicia sin escaneo");
  assert.equal(noLabScan.data.error, "PHYSICAL_SCAN_REQUIRED");
  report.expectedBlocks.push({ action: "Laboratorio repara sin escaneo", ...noLabScan });
  await scan(baseUrl, "admin", SERIES, "LABORATORIO");
  expect(await request(baseUrl, "lab", "PUT", "/api/lab/move", {
    codigo_os: maintenanceCode, nuevo_estado_id: 5
  }), 200, "Laboratorio inicia reparación");
  expect(await request(baseUrl, "lab", "POST", "/api/lab/finish", {
    codigo_os: maintenanceCode,
    falla: `${PREFIX} SENSOR`, acciones: ["REEMPLAZO SENSOR"],
    repuestos: ["SENSOR"], comentario: `${PREFIX} REPARACIÓN COMPLETADA`
  }), 200, "Laboratorio termina reparación");
  assert.equal((await state(pool, maintenanceCode)).estado_id, 10);
  report.steps.push({ step: 4, action: "Admin recibe físicamente; técnico de laboratorio diagnostica y repara", status: 200, state: 10 });

  expect(await request(baseUrl, "admin", "POST", "/api/lab/dispatch-qa", {
    codigos: [maintenanceCode]
  }), 200, "Admin, como jefe de laboratorio, despacha a bodega");
  assert.equal((await state(pool, maintenanceCode)).estado_id, 11);
  report.steps.push({ step: 5, action: "Admin, como jefe de laboratorio, envía a bodega", status: 200, state: 11 });

  await scan(baseUrl, "logistica", AMID, "BODEGA");
  expect(await request(baseUrl, "logistica", "PUT", "/api/bodega/receive", {
    codigo_os: maintenanceCode
  }), 200, "Bodega recibe desde laboratorio");

  const prematureQaScan = await request(baseUrl, "qa", "POST", "/api/equipment-scan/confirm", {
    codigo: SERIES, estacion: "QA"
  });
  expect(prematureQaScan, 409, "QA no confirma un equipo aún ubicado en Bodega");
  assert.equal(prematureQaScan.data.error, "UNEXPECTED_SCAN_STATION");
  report.expectedBlocks.push({ action: "QA escanea antes del despacho físico", ...prematureQaScan });

  const missingQa = await request(baseUrl, "logistica", "PUT", "/api/bodega/dispatch-qa", {
    codigo_os: maintenanceCode
  });
  expect(missingQa, 422, "Bodega no despacha a QA sin responsable");
  assert.equal(missingQa.data.error, "QA_ASSIGNEE_REQUIRED");
  report.expectedBlocks.push({ action: "Bodega despacha a QA sin asignación", ...missingQa });

  const qaCatalog = expect(await request(baseUrl, "logistica", "GET", "/api/bodega/qa-users"), 200, "Bodega consulta usuarios QA activos");
  assert.deepEqual(qaCatalog.map((user) => user.id), [users.qa.id]);

  expect(await request(baseUrl, "logistica", "PUT", "/api/bodega/dispatch-qa", {
    codigo_os: maintenanceCode,
    qa_usuario_id: users.qa.id
  }), 200, "Bodega asigna responsable y despacha a QA");
  const assignedQaState = await state(pool, maintenanceCode);
  assert.equal(assignedQaState.estado_id, 6);
  assert.equal(assignedQaState.qa_usuario_id, users.qa.id);
  assert.equal((await state(pool, maintenanceCode)).estado_id, 6);
  report.steps.push({ step: 6, action: "Bodega recibe, asigna responsable y envía a QA", status: 200, state: 6 });

  await scan(baseUrl, "qa", SERIES, "QA");
  expect(await request(baseUrl, "qa", "POST", "/api/qa/process", {
    codigo_os: maintenanceCode, accion: "APROBAR", comentario: `${PREFIX} QA CONFORME`
  }), 200, "QA aprueba equipo");
  assert.equal((await state(pool, maintenanceCode)).estado_id, 11);
  report.steps.push({ step: 7, action: "QA asignado escanea, prueba y aprueba", status: 200, state: 11 });

  const noFinalWarehouseScan = await request(baseUrl, "logistica", "PUT", "/api/bodega/receive", {
    codigo_os: maintenanceCode
  });
  expect(noFinalWarehouseScan, 409, "Bodega no recibe desde QA sin escaneo");
  assert.equal(noFinalWarehouseScan.data.error, "PHYSICAL_SCAN_REQUIRED");
  await scan(baseUrl, "logistica", AMID, "BODEGA");
  expect(await request(baseUrl, "logistica", "PUT", "/api/bodega/receive", {
    codigo_os: maintenanceCode
  }), 200, "Bodega recibe equipo aprobado");
  assert.equal((await state(pool, maintenanceCode)).estado_id, 13);
  const pendingInstallation=await pool.query('SELECT codigo_os FROM pmp.ordenes_servicio WHERE es_instalacion=TRUE');
  assert.equal(pendingInstallation.rowCount,0,'QA receipt must not create installation orders');
  const context={caso_id:created.os.caso_id,os_origen:maintenanceCode,tipo_equipo:'VALIDADOR'};
  const destination={...context,tecnico_terreno_id:users.terreno.id,bus_ppu:TEST_BUS,terminal_id:fixture.terminalId,pst_codigo:TEST_PST};
  const stock=expect(await request(baseUrl,'logistica','GET','/api/bodega/stock'),200,'QA approved stock');
  assert.equal(stock.listos.length,1);assert.equal(stock.listos[0].codigo_os,maintenanceCode);
  assert.equal(stock.listos[0].escaneado_bodega,true,'Physical receipt is visible without an IN placeholder');
  const genericScan=(await pool.query("SELECT id FROM pmp.escaneos_equipos WHERE codigo_os=$1 AND resultado='VALIDADO' ORDER BY fecha DESC,id DESC LIMIT 1",[maintenanceCode])).rows[0].id;
  const noInstallationScan=await request(baseUrl,'logistica','POST','/api/bodega/despacho/confirmar',{...destination,escaneo_id:genericScan});
  expect(noInstallationScan,409,'Contextual physical scan required');
  assert.equal(noInstallationScan.data.error,'PHYSICAL_SCAN_REQUIRED');
  const validation=expect(await request(baseUrl,'logistica','POST','/api/bodega/despacho/validar',{
    ...context,codigo:AMID,origen_captura:'SCANNER'}),200,'Physical-first scan');
  assert.equal((await pool.query('SELECT 1 FROM pmp.ordenes_servicio WHERE es_instalacion=TRUE')).rowCount,0,'Scan does not create IN');
  const dispatched=expect(await request(baseUrl,'logistica','POST','/api/bodega/despacho/confirmar',{
    ...destination,escaneo_id:validation.escaneo.id}),201,'Confirm creates and dispatches IN');
  const installationCode=dispatched.os.codigo_os;
  const installation=await state(pool,installationCode);
  assert.equal(installation.estado_id,1);assert.equal(installation.tecnico_terreno_id,users.terreno.id);
  report.steps.push({step:8,action:'QA stock without IN placeholder',state:13});
  report.steps.push({step:9,action:'Confirm physical dispatch creates installation order',state:1,installationCode});
  const audit = await pool.query(
    `SELECT
       COUNT(*) FILTER (WHERE resultado='VALIDADO')::int AS scans_validated,
       COUNT(*) FILTER (WHERE resultado='RECHAZADO')::int AS scans_rejected,
       COUNT(DISTINCT estacion) FILTER (WHERE resultado='VALIDADO')::int AS stations,
       (SELECT COUNT(*)::int FROM pmp.registro_reparaciones WHERE codigo_os=$1) AS repairs
       FROM pmp.escaneos_equipos`, [maintenanceCode]
  );
  assert.equal(audit.rows[0].scans_validated, 6);
  assert.equal(audit.rows[0].scans_rejected, 1);
  assert.equal(audit.rows[0].stations, 3);
  assert.equal(audit.rows[0].repairs, 1);
  report.audit = audit.rows[0];
  report.flow = { maintenanceCode, installationCode, originalFinalState: 13, installationFinalState: 1 };
}

async function cleanup() {
  if (server) {
    server.closeAllConnections?.();
    await new Promise((resolveClose) => server.close(resolveClose));
    server = null;
  }
  if (testPool) {
    await testPool.end();
    testPool = null;
  }
  if (temporaryClusterStarted) {
    runProgram(`${postgresBin}\\pg_ctl.exe`, [
      "--pgdata", temporaryData, "--mode", "fast", "--wait", "stop"
    ], { encoding: "utf8", stdio: "ignore" });
    temporaryClusterStarted = false;
  }
  if (temporaryRoot) {
    const root = resolve(temporaryRoot);
    assert.ok(root.startsWith(`${resolve(tmpdir())}${sep}`));
    assert.ok(basename(root).startsWith("pmp-suite-scan-flow-e2e-"));
    rmSync(root, { recursive: true, force: true });
    temporaryRoot = null;
  }
}

const sourceBefore = await sourceSnapshot();
try {
  await createIsolatedDatabase();
  const isolatedPool=new Pool({connectionString:temporaryUrl});
  try { await isolatedPool.query(readFileSync(new URL('../../../05_BaseDatos/migraciones/requerimientos/003_casos_operacionales.sql',import.meta.url),'utf8')); await isolatedPool.query(readFileSync(new URL('../../../05_BaseDatos/migraciones/requerimientos/004_os_independientes_alta_activos.sql',import.meta.url),'utf8')); await isolatedPool.query(readFileSync(new URL('../../../05_BaseDatos/migraciones/requerimientos/005_gestion_activos.sql',import.meta.url),'utf8')); await isolatedPool.query(readFileSync(new URL('../../../05_BaseDatos/migraciones/requerimientos/006_recepcion_inicial_sin_os.sql',import.meta.url),'utf8')); }
  finally { await isolatedPool.end(); }
  const harness = await startHarness();
  const fixture = await seedFixtures(harness.pool);
  await executeFlow(harness.pool, harness.baseUrl, fixture);
  report.ok = report.findings.length === 0;
} catch (error) {
  report.error = { name: error.name, code: error.code || null, message: error.message };
  process.exitCode = 1;
} finally {
  try {
    await cleanup();
    const sourceAfter = await sourceSnapshot();
    assert.deepEqual(sourceAfter, sourceBefore);
    report.cleanup = { sourceDatabaseUnchanged: true, temporaryClusterRemoved: true };
  } catch (error) {
    report.cleanup = { sourceDatabaseUnchanged: false, error: error.message };
    process.exitCode = 1;
  }
  await sourcePool.end();
  if (report.findings.length > 0) process.exitCode = 2;
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}
