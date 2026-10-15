import "dotenv/config";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { createServer } from "node:net";
import { basename, join, resolve, sep } from "node:path";
import { tmpdir } from "node:os";
import { performance } from "node:perf_hooks";
import pg from "pg";

const { Pool } = pg;
const PREFIX = "PERF_ISOLATED";
const REQUESTS_PER_SCENARIO = 40;
const BURST_REQUESTS = 100;
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
  admin: { id: "beef0000-0000-4000-8000-000000000001", role: "admin" },
  gerente: { id: "beef0000-0000-4000-8000-000000000002", role: "gerente" },
  logistica: { id: "beef0000-0000-4000-8000-000000000003", role: "logistica" },
  lab: { id: "beef0000-0000-4000-8000-000000000004", role: "tecnico_laboratorio" },
  qa: { id: "beef0000-0000-4000-8000-000000000005", role: "qa" },
  terreno: { id: "beef0000-0000-4000-8000-000000000006", role: "tecnico_terreno" }
});
for (const [key, user] of Object.entries(users)) {
  user.email = `${PREFIX.toLowerCase()}_${key}@pmp-suite.test`;
}

const report = {
  ok: false,
  isolation: "clúster PostgreSQL efímero, schema-only y 400 OS sintéticas",
  configuration: {
    requestsPerScenario: REQUESTS_PER_SCENARIO,
    burstRequests: BURST_REQUESTS,
    timeoutMs: 10_000,
    thresholdsMs: { p95: 2_500, p99: 4_000 }
  },
  scenarios: [],
  errorControls: [],
  poolWarnings: [],
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

async function sourceSnapshot() {
  const result = await sourcePool.query(`SELECT
    (SELECT COUNT(*)::int FROM pmp.usuarios) AS users,
    (SELECT COUNT(*)::int FROM pmp.validadores) AS validators,
    (SELECT COUNT(*)::int FROM pmp.consolas) AS consoles,
    (SELECT COUNT(*)::int FROM pmp.ordenes_servicio) AS orders,
    (SELECT COUNT(*)::int FROM pmp.escaneos_equipos) AS scans`);
  return result.rows[0];
}

async function createIsolatedDatabase() {
  temporaryRoot = mkdtempSync(join(tmpdir(), "pmp-suite-performance-"));
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
    await client.query("INSERT INTO pmp.buses (ppu) VALUES ('PF0001')");
    await client.query("INSERT INTO pmp.pst (codigo,nombre) VALUES ('PERF-PST',$1)", [`${PREFIX} PST`]);
    const terminal = await client.query(
      "INSERT INTO pmp.terminales (nombre) VALUES ($1) RETURNING id",
      [`${PREFIX} TERMINAL`]
    );
    await client.query(
      "INSERT INTO pmp.terminal_pst (terminal_id,pst_codigo) VALUES ($1,'PERF-PST')",
      [terminal.rows[0].id]
    );
    const locations = await client.query(`INSERT INTO pmp.ubicaciones (nombre,tipo) VALUES
      ($1,'BODEGA'),($2,'LABORATORIO'),($3,'QA') RETURNING id,tipo`,
      [`${PREFIX} BODEGA`, `${PREFIX} LAB`, `${PREFIX} QA`]
    );
    const byType = Object.fromEntries(locations.rows.map((row) => [row.tipo, row.id]));
    await client.query(`INSERT INTO pmp.config_estado_ubicacion (estado_id,tipo_ubicacion) VALUES
      (1,'BODEGA'),(2,'BODEGA'),(3,'BODEGA'),(4,'LABORATORIO'),
      (5,'LABORATORIO'),(6,'QA'),(7,'BODEGA'),(9,'LABORATORIO'),
      (10,'LABORATORIO'),(11,'BODEGA'),(12,'BODEGA'),
      (13,'BODEGA'),(13,'LABORATORIO'),(13,'QA')`);
    await client.query(`INSERT INTO pmp.validadores (serie,modelo,marca,amid)
      SELECT 'PERF-V-' || lpad(n::text,4,'0'),'CVB45','PMP',NULL
      FROM generate_series(1,200) AS n`);
    await client.query(`INSERT INTO pmp.consolas (serie,modelo,marca)
      SELECT 'PERF-C-' || lpad(n::text,4,'0'),'N9715','PMP'
      FROM generate_series(1,200) AS n`);
    await client.query(
      `WITH synthetic AS (
         SELECT n,
                (ARRAY[2,3,4,5,6,7,10,11])[((n-1)%8)+1] AS state_id
         FROM generate_series(1,400) AS n
       )
       INSERT INTO pmp.ordenes_servicio (
         fecha,tipo_equipo,es_pod,validador_serie,consola_serie,falla,
         estado_id,bus_ppu,terminal_id,pst_codigo,ubicacion_id,
         tecnico_laboratorio_id,qa_usuario_id,qa_asignado_por,qa_asignado_en,
         actualizado_en,es_instalacion
       )
       SELECT
         now() - (n * interval '1 minute'),
         CASE WHEN n%2=1 THEN 'VALIDADOR' ELSE 'CONSOLA' END,
         FALSE,
         CASE WHEN n%2=1 THEN 'PERF-V-' || lpad(((n+1)/2)::text,4,'0') END,
         CASE WHEN n%2=0 THEN 'PERF-C-' || lpad((n/2)::text,4,'0') END,
         $1 || ' falla sintética ' || n,
         state_id,'PF0001',$2,'PERF-PST',
         CASE WHEN state_id IN (2,3,7,11) THEN $3
              WHEN state_id IN (4,5,10) THEN $4
              WHEN state_id=6 THEN $5 END,
         CASE WHEN state_id IN (4,5,6,10) THEN $6::uuid END,
         CASE WHEN state_id=6 THEN $7::uuid END,
         CASE WHEN state_id=6 THEN $8::uuid END,
         CASE WHEN state_id=6 THEN now() END,
         now() - (n * interval '30 seconds'),FALSE
       FROM synthetic`,
      [PREFIX, terminal.rows[0].id, byType.BODEGA, byType.LABORATORIO, byType.QA,
        users.lab.id, users.qa.id, users.admin.id]
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

function mockFirebaseAuth(req, res, next) {
  const actor = users[req.get("x-perf-actor")];
  if (!actor) return res.status(401).json({ error: "PERF_AUTH_REQUIRED" });
  req.firebase = { uid: `fixture-${actor.id}`, email: actor.email, name: PREFIX };
  return next();
}

function replaceFirebaseAuth(stack) {
  for (const layer of stack || []) {
    if (layer.handle?.name === "firebaseAuthMiddleware") layer.handle = mockFirebaseAuth;
    if (layer.handle?.stack) replaceFirebaseAuth(layer.handle.stack);
    if (layer.route?.stack) replaceFirebaseAuth(layer.route.stack);
  }
}

async function startHarness() {
  process.env.DATABASE_URL = temporaryUrl;
  const [
    { default: express }, { pool }, { default: osRouter },
    { default: dashboardRouter }, { default: bodegaRouter },
    { default: labRouter }, { default: qaRouter }
  ] = await Promise.all([
    import("express"), import("../src/db.js"), import("../src/routes/os.routes.js"),
    import("../src/routes/dashboard.routes.js"), import("../src/routes/bodega.routes.js"),
    import("../src/routes/lab.routes.js"), import("../src/routes/qa.routes.js")
  ]);
  testPool = pool;
  testPool.on("error", (error) => {
    report.poolWarnings.push({ code: error.code || null, message: error.message });
  });
  const routers = [osRouter, dashboardRouter, bodegaRouter, labRouter, qaRouter];
  for (const router of routers) replaceFirebaseAuth(router.stack);
  const app = express();
  app.use(express.json());
  app.use("/api/os", osRouter);
  app.use("/api/dashboard", dashboardRouter);
  app.use("/api/bodega", bodegaRouter);
  app.use("/api/lab", labRouter);
  app.use("/api/qa", qaRouter);
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    const status = Number.isInteger(error.status) && error.status < 500 ? error.status : 500;
    return res.status(status).json({
      error: status === 500 ? "INTERNAL_ERROR" : (error.code || "REQUEST_ERROR"),
      message: status === 500 ? "No fue posible procesar la solicitud" : error.message
    });
  });
  server = await new Promise((resolveServer, reject) => {
    const instance = app.listen(0, "127.0.0.1", () => resolveServer(instance));
    instance.once("error", reject);
  });
  return `http://127.0.0.1:${server.address().port}`;
}

async function request(baseUrl, actor, method, path, body) {
  const start = performance.now();
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    signal: AbortSignal.timeout(10_000),
    headers: {
      "content-type": "application/json",
      ...(actor ? { "x-perf-actor": actor } : {})
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const text = await response.text();
  let data = null;
  if (text) {
    try { data = JSON.parse(text); } catch { data = { raw: text }; }
  }
  return { status: response.status, data, latencyMs: performance.now() - start };
}

function percentile(sorted, ratio) {
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * ratio))] || 0;
}

function summarize(name, responses) {
  const latencies = responses.map((item) => item.latencyMs).sort((a, b) => a - b);
  const success = responses.filter((item) => item.status === 200).length;
  const serverErrors = responses.filter((item) => item.status >= 500).length;
  return {
    name,
    requests: responses.length,
    http200: success,
    http5xx: serverErrors,
    averageMs: Number((latencies.reduce((sum, value) => sum + value, 0) / latencies.length).toFixed(2)),
    p50Ms: Number(percentile(latencies, 0.50).toFixed(2)),
    p95Ms: Number(percentile(latencies, 0.95).toFixed(2)),
    p99Ms: Number(percentile(latencies, 0.99).toFixed(2)),
    maxMs: Number(latencies.at(-1).toFixed(2))
  };
}

async function runScenario(baseUrl, name, actor, path, count = REQUESTS_PER_SCENARIO) {
  for (let i = 0; i < 3; i += 1) {
    const warmup = await request(baseUrl, actor, "GET", path);
    assert.equal(warmup.status, 200, `${name}: warm-up no devolvió 200`);
  }
  const responses = await Promise.all(
    Array.from({ length: count }, () => request(baseUrl, actor, "GET", path))
  );
  const summary = summarize(name, responses);
  assert.equal(summary.http200, count, `${name}: no todas las respuestas fueron 200`);
  assert.equal(summary.http5xx, 0, `${name}: se detectaron respuestas 5xx`);
  report.scenarios.push(summary);
}

async function runErrorControls(baseUrl) {
  const controls = [
    {
      name: "Consulta sin autenticación",
      response: await request(baseUrl, null, "GET", "/api/os"),
      expected: 401
    },
    {
      name: "Gerente intenta escritura operacional",
      response: await request(baseUrl, "gerente", "POST", "/api/os/crear", {}),
      expected: 403,
      error: "READ_ONLY_ROLE"
    },
    {
      name: "Técnico de terreno consulta dashboard global",
      response: await request(baseUrl, "terreno", "GET", "/api/dashboard/summary"),
      expected: 403
    },
    {
      name: "Paginación inválida",
      response: await request(baseUrl, "gerente", "GET", "/api/os?offset=-1"),
      expected: 400
    }
  ];

  for (const control of controls) {
    assert.equal(control.response.status, control.expected, control.name);
    if (control.error) assert.equal(control.response.data?.error, control.error, control.name);
    const serialized = JSON.stringify(control.response.data);
    assert.ok(!/postgresql:\/\/|password|node_modules|\\bsrc\\| at /i.test(serialized),
      `${control.name}: la respuesta expone información interna`);
    report.errorControls.push({
      name: control.name,
      expectedStatus: control.expected,
      actualStatus: control.response.status,
      safeResponse: true
    });
  }
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
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 100));
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
    assert.ok(basename(root).startsWith("pmp-suite-performance-"));
    rmSync(root, { recursive: true, force: true });
    temporaryRoot = null;
  }
}

const sourceBefore = await sourceSnapshot();
const memoryBefore = process.memoryUsage().rss;
const cpuBefore = process.cpuUsage();
try {
  await createIsolatedDatabase();
  process.env.DATABASE_URL = temporaryUrl;
  const baseUrl = await startHarness();
  await seedFixtures(testPool);

  await runScenario(baseUrl, "Listado global OS — admin", "admin", "/api/os?limit=100&offset=0");
  await runScenario(baseUrl, "Listado global OS — gerente", "gerente", "/api/os?limit=100&offset=0");
  await runScenario(baseUrl, "Dashboard global — gerente", "gerente", "/api/dashboard/summary");
  await runScenario(baseUrl, "Cola de bodega — logística", "logistica", "/api/bodega/queue");
  await runScenario(baseUrl, "Cola de laboratorio — técnico", "lab", "/api/lab/queue/VALIDADOR");
  await runScenario(baseUrl, "Cola QA — responsable QA", "qa", "/api/qa/queue");
  await runScenario(baseUrl, "Ráfaga dashboard — gerente", "gerente", "/api/dashboard/summary", BURST_REQUESTS);
  await runErrorControls(baseUrl);

  const allP95 = Math.max(...report.scenarios.map((item) => item.p95Ms));
  const allP99 = Math.max(...report.scenarios.map((item) => item.p99Ms));
  assert.ok(allP95 <= report.configuration.thresholdsMs.p95,
    `p95 ${allP95} ms excede ${report.configuration.thresholdsMs.p95} ms`);
  assert.ok(allP99 <= report.configuration.thresholdsMs.p99,
    `p99 ${allP99} ms excede ${report.configuration.thresholdsMs.p99} ms`);
  report.ok = true;
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
    report.ok = false;
    process.exitCode = 1;
  }
  const cpu = process.cpuUsage(cpuBefore);
  report.resources = {
    rssBeforeMiB: Number((memoryBefore / 1024 / 1024).toFixed(2)),
    rssAfterMiB: Number((process.memoryUsage().rss / 1024 / 1024).toFixed(2)),
    cpuUserMs: Number((cpu.user / 1000).toFixed(2)),
    cpuSystemMs: Number((cpu.system / 1000).toFixed(2))
  };
  await sourcePool.end();
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}
