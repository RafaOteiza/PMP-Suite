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
  qa2: { id: "e2e50000-0000-4000-8000-000000000006", role: "qa" },
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
  const tables=(await sourcePool.query("SELECT tablename FROM pg_tables WHERE schemaname='pmp' ORDER BY tablename")).rows;
  const snapshot={};
  for(const {tablename} of tables) {
    assert.match(tablename,/^[a-z_]+$/);
    snapshot[tablename]=(await sourcePool.query(`SELECT count(*)::int n,md5(COALESCE(string_agg(to_jsonb(t)::text,'' ORDER BY to_jsonb(t)::text),'')) hash FROM pmp.${tablename} t`)).rows[0];
  }
  return snapshot;
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
  const {default: requirementsRouter}=await import('../src/routes/requirements.routes.js');
  const {default: bridgeRouter}=await import('../src/routes/bridge.routes.js');
  const {default: dashboardRouter}=await import('../src/routes/dashboard.routes.js');
  const {default: badgesRouter}=await import('../src/routes/badges.routes.js');replaceFirebaseAuth(badgesRouter);
  const {default: assetsRouter}=await import('../src/routes/assets.routes.js');replaceFirebaseAuth(assetsRouter);
  replaceFirebaseAuth(requirementsRouter); replaceFirebaseAuth(bridgeRouter); replaceFirebaseAuth(dashboardRouter);
  for (const router of [osRouter, scanRouter, bodegaRouter, labRouter, qaRouter]) {
    replaceFirebaseAuth(router);
  }
  const app = express();
  app.use(express.json());
  app.use('/api/activos', assetsRouter);
  app.use('/api/requerimientos', requirementsRouter);
  app.use('/api/bridge', bridgeRouter);
  app.use('/api/dashboard', dashboardRouter);
  app.use('/api/dashboard', badgesRouter);
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
    codigo: code, estacion: station,...(station==='QA'?{lectura_scanner:{tipo:'KEYBOARD_WEDGE',intervalos_ms:Array(code.length).fill(10)}}:{})
  });
  return expect(response, expectedStatus, `${actor} escanea ${code} en ${station}`);
}

async function executeFlow(pool, baseUrl, fixture) {
  const { runRequirementsScenarios } = await import('./requirements_scenarios.mjs');
  await runRequirementsScenarios({ pool, baseUrl, fixture, users, request, expect, scan, report, pst:TEST_PST, bus:TEST_BUS });
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
  const migration=readFileSync(new URL('../../../05_BaseDatos/migraciones/requerimientos/003_casos_operacionales.sql',import.meta.url),'utf8');
  const correction=readFileSync(new URL('../../../05_BaseDatos/migraciones/requerimientos/004_os_independientes_alta_activos.sql',import.meta.url),'utf8');
  const isolatedPool=new Pool({connectionString:temporaryUrl});
  try { await isolatedPool.query(migration); await isolatedPool.query(correction); await isolatedPool.query(correction);
    const master=readFileSync(new URL('../../../05_BaseDatos/migraciones/requerimientos/005_gestion_activos.sql',import.meta.url),'utf8');await isolatedPool.query(master);await isolatedPool.query(master);
    const initial=readFileSync(new URL('../../../05_BaseDatos/migraciones/requerimientos/006_recepcion_inicial_sin_os.sql',import.meta.url),'utf8');await isolatedPool.query(initial);await isolatedPool.query(initial); } finally { await isolatedPool.end(); }
  report.migration={ additive:true, idempotent:true };
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
