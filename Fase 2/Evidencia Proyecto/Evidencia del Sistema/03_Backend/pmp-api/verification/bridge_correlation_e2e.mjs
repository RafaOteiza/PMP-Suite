import "dotenv/config";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { appendFileSync, existsSync, mkdtempSync, rmSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { basename, join, resolve, sep } from "node:path";
import pg from "pg";

const { Pool } = pg;
const PREFIX = "E2E_BRIDGE_TEST";
const sourceUrl = process.env.DATABASE_URL;
if (!sourceUrl) throw new Error("DATABASE_URL no está configurada");

const source = new URL(sourceUrl);
const suffix = `${process.pid}_${randomBytes(3).toString("hex")}`;
const temporaryDatabase = `pmp_suite_e2e_bridge_${suffix}`.toLowerCase();
assert.match(temporaryDatabase, /^pmp_suite_e2e_bridge_[a-z0-9_]+$/);

const postgresBinCandidates = [
  process.env.POSTGRES_BIN,
  "C:\\Program Files\\PostgreSQL\\18\\bin",
  "C:\\Program Files\\PostgreSQL\\17\\bin",
  "C:\\Program Files\\PostgreSQL\\16\\bin"
].filter(Boolean);
const postgresBin = postgresBinCandidates.find((candidate) =>
  existsSync(`${candidate}\\pg_dump.exe`) && existsSync(`${candidate}\\psql.exe`)
);
if (!postgresBin) throw new Error("No se encontraron pg_dump.exe y psql.exe");

const pgEnvironment = (url) => {
  const parsed = new URL(url);
  return {
    ...process.env,
    PGHOST: parsed.hostname,
    PGPORT: parsed.port || "5432",
    PGUSER: decodeURIComponent(parsed.username),
    PGPASSWORD: decodeURIComponent(parsed.password),
    PGDATABASE: parsed.pathname.replace(/^\//, "")
  };
};

const sourcePool = new Pool({ connectionString: sourceUrl });
let testPool;
let server;
let temporaryUrl;
let temporaryRoot;
let temporaryData;
let temporaryClusterStarted = false;
const report = {
  ok: false,
  isolation: {
    method: "clúster PostgreSQL efímero con schema-only y fixtures propios",
    database: "postgres en servidor local efímero",
    firebaseUsersCreated: false,
    sourceDatabaseWritten: false
  },
  steps: [],
  positive: [],
  negative: [],
  cleanup: null
};

function markProgress(message) {
  console.error(`[bridge-e2e] ${message}`);
  if (temporaryRoot && existsSync(temporaryRoot)) {
    appendFileSync(join(temporaryRoot, "progress.log"), `${new Date().toISOString()} ${message}\n`);
  }
}

const users = Object.freeze({
  admin: {
    id: "e2e00000-0000-4000-8000-000000000001",
    email: "e2e_bridge_test_admin@pmp-suite.test",
    role: "admin"
  },
  gerente: {
    id: "e2e00000-0000-4000-8000-000000000002",
    email: "e2e_bridge_test_gerente@pmp-suite.test",
    role: "gerente"
  },
  logistica: {
    id: "e2e00000-0000-4000-8000-000000000003",
    email: "e2e_bridge_test_logistica@pmp-suite.test",
    role: "logistica"
  },
  terrenoA: {
    id: "e2e00000-0000-4000-8000-000000000004",
    email: "e2e_bridge_test_terreno_a@pmp-suite.test",
    role: "tecnico_terreno"
  },
  terrenoB: {
    id: "e2e00000-0000-4000-8000-000000000005",
    email: "e2e_bridge_test_terreno_b@pmp-suite.test",
    role: "tecnico_terreno"
  },
  labA: {
    id: "e2e00000-0000-4000-8000-000000000006",
    email: "e2e_bridge_test_lab_a@pmp-suite.test",
    role: "tecnico_laboratorio"
  },
  labB: {
    id: "e2e00000-0000-4000-8000-000000000007",
    email: "e2e_bridge_test_lab_b@pmp-suite.test",
    role: "tecnico_laboratorio"
  },
  qaA: {
    id: "e2e00000-0000-4000-8000-000000000008",
    email: "e2e_bridge_test_qa_a@pmp-suite.test",
    role: "qa"
  },
  qaB: {
    id: "e2e00000-0000-4000-8000-000000000009",
    email: "e2e_bridge_test_qa_b@pmp-suite.test",
    role: "qa"
  }
});

const GOOD_EQUIPMENT = `${PREFIX}_GOOD`;
const BAD_EQUIPMENT = `${PREFIX}_BAD`;
const TEST_BUS = "E2EBT001";
const TEST_PST = "E2E_BRIDGE_TEST_PST";

function runProgram(executable, args, options = {}) {
  const result = spawnSync(executable, args, {
    maxBuffer: 25 * 1024 * 1024,
    ...options
  });
  if (result.status !== 0) {
    const stderr = Buffer.isBuffer(result.stderr)
      ? result.stderr.toString("utf8")
      : String(result.stderr || "");
    throw new Error(`${executable} terminó con código ${result.status}: ${stderr.trim()}`);
  }
  return result;
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
  temporaryRoot = mkdtempSync(join(tmpdir(), "pmp-suite-bridge-e2e-"));
  temporaryData = join(temporaryRoot, "data");
  const port = await availablePort();
  runProgram(
    `${postgresBin}\\initdb.exe`,
    ["--pgdata", temporaryData, "--auth", "trust", "--username", "postgres", "--encoding", "UTF8", "--no-locale"],
    { encoding: "utf8" }
  );
  runProgram(
    `${postgresBin}\\pg_ctl.exe`,
    ["--pgdata", temporaryData, "--options", `-h 127.0.0.1 -p ${port}`, "--wait", "start"],
    { encoding: "utf8", stdio: "ignore" }
  );
  temporaryClusterStarted = true;
  temporaryUrl = `postgresql://postgres@127.0.0.1:${port}/postgres`;

  const dump = runProgram(
    `${postgresBin}\\pg_dump.exe`,
    ["--schema-only", "--no-owner", "--no-privileges"],
    { env: pgEnvironment(sourceUrl), encoding: null }
  );
  runProgram(
    `${postgresBin}\\psql.exe`,
    ["--set", "ON_ERROR_STOP=1", "--quiet"],
    { env: pgEnvironment(temporaryUrl), input: dump.stdout, encoding: null }
  );
}

async function seedFixtures() {
  const client = await testPool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`
      INSERT INTO pmp.estados (id, nombre) VALUES
        (1,'EN_RUTA'), (2,'EN_TRANSITO'), (3,'EN_BODEGA'),
        (4,'EN_DIAGNOSTICO'), (5,'EN_REPARACION'), (6,'EN_QA'),
        (7,'DISPONIBLE'), (8,'RECHAZADO'), (9,'ESPERA_REPUESTO'),
        (10,'FINALIZADO_TALLER'), (11,'EN_TRAYECTO_BODEGA'),
        (12,'INSTALADO'), (13,'CERRADO')
    `);
    await client.query(
      `INSERT INTO pmp.usuarios (id,nombre,apellido,correo,rol,activo,firebase_uid)
       SELECT x.id::uuid, $1, x.apellido, x.correo, x.rol, TRUE, NULL
       FROM jsonb_to_recordset($2::jsonb)
         AS x(id text, apellido text, correo text, rol text)`,
      [PREFIX, JSON.stringify(Object.entries(users).map(([key, user]) => ({
        id: user.id,
        apellido: key,
        correo: user.email,
        rol: user.role
      })))]
    );
    await client.query(
      "INSERT INTO pmp.validadores (serie,modelo,marca) VALUES ($1,$3,'E2E'),($2,$3,'E2E')",
      [GOOD_EQUIPMENT, BAD_EQUIPMENT, PREFIX]
    );
    await client.query("INSERT INTO pmp.buses (ppu) VALUES ($1)", [TEST_BUS]);
    await client.query("INSERT INTO pmp.pst (codigo,nombre) VALUES ($1,$2)", [TEST_PST, `${PREFIX} PST`]);
    const terminal = await client.query(
      "INSERT INTO pmp.terminales (nombre) VALUES ($1) RETURNING id",
      [`${PREFIX} TERMINAL`]
    );
    await client.query(
      "INSERT INTO pmp.terminal_pst (terminal_id,pst_codigo) VALUES ($1,$2)",
      [terminal.rows[0].id, TEST_PST]
    );
    const locations = await client.query(
      `INSERT INTO pmp.ubicaciones (nombre,tipo) VALUES
         ($1,'BODEGA'),($2,'LABORATORIO'),($3,'QA')
       RETURNING id,tipo`,
      [`${PREFIX} BODEGA`, `${PREFIX} LABORATORIO`, `${PREFIX} QA`]
    );
    const byType = Object.fromEntries(locations.rows.map((row) => [row.tipo, row.id]));
    await client.query(`
      INSERT INTO pmp.config_estado_ubicacion (estado_id,tipo_ubicacion) VALUES
        (3,'BODEGA'),(4,'LABORATORIO'),(5,'LABORATORIO'),
        (7,'BODEGA'),(9,'LABORATORIO')
    `);
    const stock = await client.query(
      `INSERT INTO pmp.ordenes_servicio (
         tipo_equipo,es_pod,validador_serie,consola_serie,falla,estado_id,
         bus_ppu,terminal_id,pst_codigo,ubicacion_id,es_instalacion
       ) VALUES ('VALIDADOR',FALSE,$1,NULL,$2,7,$3,$4,$5,$6,TRUE)
       RETURNING codigo_os`,
      [GOOD_EQUIPMENT, `${PREFIX} EQUIPO PREPARADO`, TEST_BUS,
        terminal.rows[0].id, TEST_PST, byType.BODEGA]
    );
    await client.query("COMMIT");
    return {
      terminalId: terminal.rows[0].id,
      bodegaId: byType.BODEGA,
      laboratorioId: byType.LABORATORIO,
      qaId: byType.QA,
      preparedOs: stock.rows[0].codigo_os
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

function replaceFirebaseAuth(router) {
  const layer = router.stack.find((candidate) => candidate.handle?.name === "firebaseAuthMiddleware");
  assert.ok(layer, "No se encontró firebaseAuthMiddleware en el router de prueba");
  layer.handle = function e2eFirebaseAuth(req, res, next) {
    const actor = req.get("x-e2e-actor");
    const identity = users[actor];
    if (!identity) return res.status(401).json({ error: "E2E_AUTH_REQUIRED" });
    req.firebase = {
      uid: `fixture-${actor}`,
      email: identity.email,
      name: `${PREFIX} ${actor}`
    };
    return next();
  };
}

async function startHarness() {
  process.env.DATABASE_URL = temporaryUrl;
  const [{ default: express }, { pool }, { default: bridgeRouter }, { default: bodegaRouter }] = await Promise.all([
    import("express"),
    import("../src/db.js"),
    import("../src/routes/bridge.routes.js"),
    import("../src/routes/bodega.routes.js")
  ]);
  testPool = pool;
  replaceFirebaseAuth(bridgeRouter);
  replaceFirebaseAuth(bodegaRouter);
  const { default: labRouter } = await import('../src/routes/lab.routes.js');
  const { default: dashboardRouter } = await import('../src/routes/dashboard.routes.js');
  replaceFirebaseAuth(labRouter);
  replaceFirebaseAuth(dashboardRouter);

  const app = express();
  app.use(express.json());
  app.use("/api/bridge", bridgeRouter);
  app.use("/api/bodega", bodegaRouter);
  app.use('/api/lab',labRouter);
  app.use('/api/dashboard',dashboardRouter);
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    return res.status(error.status || 500).json({ error: error.message });
  });
  server = await new Promise((resolve, reject) => {
    const instance = app.listen(0, "127.0.0.1", () => resolve(instance));
    instance.once("error", reject);
  });
  const address = server.address();
  return {
    pool,
    baseUrl: `http://127.0.0.1:${address.port}`
  };
}

async function request(baseUrl, actor, method, path, body) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    signal: AbortSignal.timeout(10_000),
    headers: {
      "content-type": "application/json",
      "x-e2e-actor": actor
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const text = await response.text();
  let data = null;
  if (text) {
    try { data = JSON.parse(text); } catch { data = { raw: text }; }
  }
  return { status: response.status, data };
}

async function endPoolWithin(pool, milliseconds, label) {
  let timeout;
  const ended = await Promise.race([
    pool.end().then(() => true),
    new Promise((resolveTimeout) => {
      timeout = setTimeout(() => resolveTimeout(false), milliseconds);
    })
  ]);
  if (timeout) clearTimeout(timeout);
  if (!ended) {
    report.cleanupWarnings ??= [];
    report.cleanupWarnings.push(`${label} no confirmó cierre dentro de ${milliseconds} ms`);
  }
}

function expectStatus(response, expected, label) {
  assert.equal(
    response.status,
    expected,
    `${label}: se esperaba HTTP ${expected}, se recibió ${response.status} (${JSON.stringify(response.data)})`
  );
  return response.data;
}

async function databaseSnapshot(pool, bridgeCode, maintenanceCode) {
  const result = await pool.query(
    `SELECT
       (SELECT COUNT(*)::int FROM pmp.bridges WHERE codigo_bridge=$1) bridges,
       (SELECT COUNT(*)::int FROM pmp.bridge_mantenimiento WHERE bridge_codigo=$1) relaciones,
       (SELECT COUNT(*)::int FROM pmp.ordenes_servicio WHERE codigo_os=$2) mantenimientos,
       (SELECT COUNT(*)::int FROM pmp.instalaciones_equipos WHERE bridge_codigo=$1) instalaciones,
       (SELECT COUNT(*)::int FROM pmp.flujo_eventos WHERE bridge_codigo=$1) eventos,
       (SELECT COUNT(*)::int FROM pmp.qa_inspecciones WHERE codigo_os=$2) qa,
       (SELECT COUNT(*)::int FROM pmp.registro_reparaciones WHERE codigo_os=$2) reparaciones,
       (SELECT COUNT(*)::int FROM pmp.solicitudes_repuestos WHERE codigo_os=$2) solicitudes`,
    [bridgeCode, maintenanceCode]
  );
  return result.rows[0];
}

async function executeFlow(pool, baseUrl, fixture) {
  const post = (body,actor='logistica') => request(baseUrl,actor,'POST','/api/bridge',body);
  const get = path => request(baseUrl,'terrenoA','GET',path);
  const body = {tipo_equipo:'VALIDADOR',serie:GOOD_EQUIPMENT,codigo_os:fixture.preparedOs,
    sistema_externo:'ARANDA',referencia_externa:'AR-100',comentario:'Correlación de prueba'};
  await pool.query('UPDATE pmp.ordenes_servicio SET tecnico_terreno_id=$1 WHERE codigo_os=$2',[users.terrenoA.id,fixture.preparedOs]);
  const created = await pool.query(`INSERT INTO pmp.ordenes_servicio
    (tipo_equipo,es_pod,validador_serie,falla,estado_id,bus_ppu,terminal_id,pst_codigo,ticket_aranda)
    SELECT 'VALIDADOR',FALSE,$1,'Intervención histórica '||i,13,$2,$3,$4,
      CASE WHEN i=1 THEN 'AR-LEGACY' ELSE NULL END FROM generate_series(1,12) i RETURNING codigo_os`,
    [GOOD_EQUIPMENT,TEST_BUS,fixture.terminalId,TEST_PST]);
  await pool.query(`INSERT INTO pmp.consolas(serie,modelo,marca) VALUES($1,'TEST','TEST'),('SIN-OS','TEST','TEST')`,[GOOD_EQUIPMENT]);
  const consoleOrder=(await pool.query(`INSERT INTO pmp.ordenes_servicio
    (tipo_equipo,es_pod,consola_serie,falla,estado_id,bus_ppu,terminal_id,pst_codigo)
    VALUES('CONSOLA',FALSE,$1,'Consola',13,$2,$3,$4) RETURNING codigo_os`,
    [GOOD_EQUIPMENT,TEST_BUS,fixture.terminalId,TEST_PST])).rows[0].codigo_os;
  const snapshot = async () => (await pool.query(`SELECT
    (SELECT jsonb_agg(to_jsonb(o) ORDER BY codigo_os) FROM pmp.ordenes_servicio o) AS os,
    (SELECT jsonb_agg(to_jsonb(v) ORDER BY serie) FROM pmp.validadores v) AS validadores,
    (SELECT jsonb_agg(to_jsonb(c) ORDER BY serie) FROM pmp.consolas c) AS consolas,
    (SELECT jsonb_agg(to_jsonb(b) ORDER BY codigo_bridge) FROM pmp.bridges b) AS bridges,
    (SELECT count(*) FROM pmp.instalaciones_equipos) AS instalaciones,
    (SELECT count(*) FROM pmp.os_historial_activo) AS eventos_os,
    (SELECT jsonb_agg(to_jsonb(r)) FROM pmp.repuestos r) AS repuestos`)).rows[0];
  const before=await snapshot();
  expectStatus(await post(body),201,'Vínculo válido');
  expectStatus(await post({...body,referencia_externa:'AR-101'},'admin'),201,'Segunda referencia');
  expectStatus(await post({...body,codigo_os:created.rows[0].codigo_os}),201,'Misma referencia en otra intervención');
  expectStatus(await post({...body,tipo_equipo:'CONSOLA',codigo_os:consoleOrder,referencia_externa:'AR-CONSOLE'}),201,'Consola con misma serie');
  expectStatus(await post({...body,sistema_externo:' aranda ',referencia_externa:'ar-100'}),409,'Duplicado normalizado');
  expectStatus(await post({...body,codigo_os:created.rows[0].codigo_os,referencia_externa:'AR-LEGACY'}),409,'Referencia heredada duplicada');
  expectStatus(await post({...body,serie:BAD_EQUIPMENT}),422,'Serie de otro activo');
  expectStatus(await post({...body,tipo_equipo:'CONSOLA'}),422,'Tipo incorrecto');
  expectStatus(await post({...body,codigo_os:'NO-EXISTE'}),422,'OS inexistente');
  expectStatus(await post({...body,serie:'NO-EXISTE'}),422,'Serie inexistente');
  for (const field of ['tecnico_terreno_id','estado_id','equipo_preparado_serie','ubicacion_id'])
    expectStatus(await post({...body,[field]:'prohibido'}),422,field);
  for (const role of ['gerente','terrenoA','labA','qaA']) expectStatus(await post(body,role),403,role);
  for (const path of ['/BR-1/completar','/BR-1/iniciar','/mantenimiento/MC-1/recibir-qa'])
    expectStatus(await request(baseUrl,'logistica','POST','/api/bridge'+path,{}),410,'Acción retirada');
  expectStatus(await request(baseUrl,'admin','PATCH','/api/bridge/BR-1/asignar-terreno',{}),410,'Asignación retirada');
  const concurrent=await Promise.all([post({...body,referencia_externa:'AR-RACE'}),post({...body,referencia_externa:'AR-RACE'})]);
  assert.deepEqual(concurrent.map(r=>r.status).sort(),[201,409]);
  assert.deepEqual(await snapshot(),before,'Bridge no cambia órdenes, asignaciones, ubicaciones, stock ni eventos OS');
  report.positive.push('Snapshot operacional idéntico tras vínculos y errores','Duplicados concurrentes protegidos');
  for(const query of ['AR-100',fixture.preparedOs,'AR-LEGACY']) {
    const matches=expectStatus(await get('/api/bridge/buscar?q='+encodeURIComponent(query)),200,query);
    assert.deepEqual(matches,[{tipo_equipo:'VALIDADOR',serie:GOOD_EQUIPMENT}]);
    assert.deepEqual(expectStatus(await get('/api/dashboard/global-search?q='+encodeURIComponent(query)),200,'Búsqueda global'),matches);
  }
  const ambiguous=expectStatus(await get('/api/bridge/buscar?q='+GOOD_EQUIPMENT),200,'Serie ambigua');
  assert.equal(ambiguous.length,2);
  const history=expectStatus(await get('/api/bridge/activos/VALIDADOR/'+GOOD_EQUIPMENT+'/historial'),200,'Historial');
  assert.equal(history.ordenes.length,13);assert.equal(history.referencias.length,5);
  assert.ok(history.eventos.some(e=>e.tipo==='REFERENCIA_VINCULADA'));
  assert.ok(history.eventos.some(e=>e.tipo==='OS_CREADA'));
  assert.ok(history.ordenes.some(o=>o.ubicacion===null));
  const consoleHistory=expectStatus(await get('/api/bridge/activos/CONSOLA/'+GOOD_EQUIPMENT+'/historial'),200,'Historial consola');
  assert.equal(consoleHistory.ordenes.length,1);assert.equal(consoleHistory.referencias.length,1);
  const empty=expectStatus(await get('/api/bridge/activos/CONSOLA/SIN-OS/historial'),200,'Sin OS');
  assert.equal(empty.ordenes.length,0);
  expectStatus(await request(baseUrl,'admin','PUT','/api/lab/assign',{
    codigo_os:fixture.preparedOs,tecnico_id:users.labA.id}),200,'Asignación normal de OS con referencias');
  const assigned=(await pool.query('SELECT tecnico_laboratorio_id FROM pmp.ordenes_servicio WHERE codigo_os=$1',[fixture.preparedOs])).rows[0];
  assert.equal(assigned.tecnico_laboratorio_id,users.labA.id);
  report.positive.push('Búsqueda global resuelve serie/OS/Aranda al activo','Asignación HTTP normal de OS vinculada funciona');
  await pool.query('UPDATE pmp.ordenes_servicio SET tecnico_terreno_id=$1 WHERE codigo_os=$2',[users.terrenoB.id,fixture.preparedOs]);
  const updated=expectStatus(await get('/api/bridge/activos/VALIDADOR/'+GOOD_EQUIPMENT+'/historial'),200,'Historial actualizado');
  assert.ok(updated.eventos.some(e=>e.tipo==='OS_ACTUALIZADA'&&e.detalle.actual.tecnico_terreno_id===users.terrenoB.id));
  assert.ok(updated.eventos.some(e=>e.cambios.some(c=>c.campo==='Técnico de terreno'&&c.actual.includes('terrenoB'))));
  await assert.rejects(pool.query('UPDATE pmp.ordenes_servicio SET validador_serie=$1 WHERE codigo_os=$2',[BAD_EQUIPMENT,fixture.preparedOs]));
  report.positive.push('13 OS por serie, referencias múltiples y heredadas','Consolas y validadores aislados por tipo','Equipo sin OS y sin ubicación visible','Eventos de asignación normal conservados');
  report.negative.push('Roles sin escritura: 403','Acciones operacionales Bridge: 410','Serie/OS/tipo inconsistentes: 422','Campos de operación: 422','Duplicados: 409','Identidad histórica inmutable');
}

async function verifySourceUntouched() {
  const result = await sourcePool.query(
    `SELECT
       (SELECT COUNT(*)::int FROM pmp.usuarios WHERE correo LIKE 'e2e_bridge_test_%') users,
       (SELECT COUNT(*)::int FROM pmp.validadores WHERE serie LIKE 'E2E_BRIDGE_TEST%') equipment,
       (SELECT COUNT(*)::int FROM pmp.buses WHERE ppu='E2EBT001') buses,
       (SELECT COUNT(*)::int FROM pmp.terminales WHERE nombre LIKE 'E2E_BRIDGE_TEST%') terminals,
       (SELECT COUNT(*)::int FROM pmp.pst WHERE codigo LIKE 'E2E_BRIDGE_TEST%') pst,
       (SELECT COUNT(*)::int FROM pmp.bridges WHERE motivo LIKE 'E2E_BRIDGE_TEST%') bridges,
       (SELECT COUNT(*)::int FROM pmp.ordenes_servicio WHERE COALESCE(validador_serie,consola_serie) LIKE 'E2E_BRIDGE_TEST%') service_orders,
       (SELECT COUNT(*)::int FROM pg_database WHERE datname=$1) temporary_databases`,
    [temporaryDatabase]
  );
  const expected = {
    users: 0,
    equipment: 0,
    buses: 0,
    terminals: 0,
    pst: 0,
    bridges: 0,
    service_orders: 0,
    temporary_databases: 0
  };
  assert.deepEqual(result.rows[0], expected);
  return result.rows[0];
}

async function cleanup() {
  markProgress("cleanup:http");
  if (server) {
    const currentServer = server;
    server = null;
    currentServer.closeAllConnections?.();
    currentServer.close();
  }
  markProgress("cleanup:test-pool");
  if (testPool) {
    await endPoolWithin(testPool, 5_000, "testPool");
    testPool = null;
  }
  markProgress("cleanup:postgres");
  if (temporaryClusterStarted) {
    runProgram(
      `${postgresBin}\\pg_ctl.exe`,
      ["--pgdata", temporaryData, "--mode", "fast", "--wait", "stop"],
      { encoding: "utf8", stdio: "ignore" }
    );
    temporaryClusterStarted = false;
  }
  markProgress("cleanup:files");
  if (temporaryRoot) {
    const root = resolve(temporaryRoot);
    const systemTemp = `${resolve(tmpdir())}${sep}`;
    assert.ok(root.startsWith(systemTemp));
    assert.ok(basename(root).startsWith("pmp-suite-bridge-e2e-"));
    rmSync(root, { recursive: true, force: true });
    temporaryRoot = null;
  }
  markProgress("cleanup:source-verification");
  report.cleanup = await verifySourceUntouched();
  report.cleanup.temporaryFiles = 0;
  markProgress("cleanup:done");
}

try {
  markProgress("isolated-database:start");
  await createIsolatedDatabase();
  markProgress("isolated-database:ready");
  const harness = await startHarness();
  markProgress("http-harness:ready");
  await harness.pool.query(readFileSync(new URL('../../../05_BaseDatos/migraciones/bridge/002_bridge_correlacion.sql',import.meta.url),'utf8'));
  const fixture = await seedFixtures();
  markProgress("fixtures:ready");
  report.isolation.fixture = {
    prefix: PREFIX,
    busAlias: TEST_BUS,
    users: Object.keys(users).length,
    usesOperationalRows: false
  };
  await executeFlow(harness.pool, harness.baseUrl, fixture);
  markProgress("flow:done");
  report.ok = true;
} catch (error) {
  report.error = {
    name: error.name,
    message: error.message,
    code: error.code || null
  };
  process.exitCode = 1;
} finally {
  try {
    await cleanup();
  } catch (cleanupError) {
    report.cleanupError = {
      message: cleanupError.message,
      code: cleanupError.code || null
    };
    process.exitCode = 1;
  }
  await endPoolWithin(sourcePool, 5_000, "sourcePool");
  const exitCode = process.exitCode || 0;
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`, () => process.exit(exitCode));
}
