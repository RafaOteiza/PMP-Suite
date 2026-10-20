import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = (path) => readFile(resolve(root, path), "utf8");

test("todas las rutas sensibles declaran una capacidad", async () => {
  const app = await source("src/App.tsx");
  const expected = new Map([
    ["/operacion/activos", "ASSET_MANAGE"], ["/operacion/requerimientos", "REQUEST_CREATE"],
    ["/operacion/retiros", "WITHDRAWAL_ASSIGN"],
    ["/mi-jornada", "PERSONAL_DASHBOARD_VIEW"],
    ["/admin/users", "USERS_VIEW"], ["/admin/despacho", "DISPATCH_OPERATIONS_VIEW"],
    ["/operacion/os", "OS_VIEW"], ["/operacion/mis-os", "MY_OS_VIEW"], ["/operacion/ingreso", "OS_CREATE"], ["/operacion/escaneo", "EQUIPMENT_SCAN_VIEW"], ["/bridge", "BRIDGE_FLOW_VIEW"],
    ["/lab/asignacion", "LAB_ASSIGN"], ["/lab/despacho-qa", "LAB_DISPATCH"],
    ["/lab/validadores", "LAB_EQUIPMENT_VIEW"], ["/lab/consolas", "LAB_EQUIPMENT_VIEW"],
    ["/qa", "QA_SUMMARY_VIEW"], ["/bodega", "BODEGA_OPERATIONS_VIEW"],
    ["/bodega/modulos", "BODEGA_OPERATIONS_VIEW"], ["/bodega/repuestos", "BODEGA_OPERATIONS_VIEW"],
    ["/trazabilidad", "TRACE_VIEW"], ["/ia/predicciones", "AI_VIEW"]
  ]);
  for (const [path, permission] of expected) {
    assert.match(app, new RegExp(`path="${path.replaceAll("/", "\\/")}"[^\\n]+PERMISSIONS\\.${permission}`), path);
  }
  assert.doesNotMatch(app, /roles=|jefe_taller|contador/);
});

test("Sidebar deriva navegación de capacidades y oculta menús transaccionales al gerente", async () => {
  const [sidebar, navigation] = await Promise.all([source("src/components/Sidebar.tsx"), source("src/app/navigation.ts")]);
  assert.match(sidebar, /getNavigationForUser\(me\)/);
  assert.match(navigation, /capability: PERMISSIONS\.OS_VIEW/);
  assert.match(navigation, /capability: PERMISSIONS\.LAB_ASSIGN/);
  assert.match(navigation, /capability: PERMISSIONS\.DISPATCH_OPERATIONS_VIEW/);
  assert.match(navigation, /filter\(\(section\) => section\.items\.length > 0\)/);
  assert.doesNotMatch(sidebar, /jefe_taller|contador|rol === ['"]bodega['"]/);
});

test("páginas operacionales separan lectura y escritura", async () => {
  const files = await Promise.all([
    source("src/pages/QaWorkPage.tsx"),
    source("src/pages/LabValidadoresPage.tsx"),
    source("src/pages/LabConsolasPage.tsx"),
    source("src/pages/BodegaPage.tsx"),
    source("src/pages/BodegaModulosPage.tsx"),
    source("src/pages/BodegaRepuestosPage.tsx"),
    source("src/pages/LabDespachoQaPage.tsx")
  ]);
  assert.match(files[0], /PERMISSIONS\.QA_WRITE/);
  assert.match(files[1], /PERMISSIONS\.LAB_WRITE/);
  assert.match(files[2], /PERMISSIONS\.LAB_WRITE/);
  for (const file of files.slice(3, 6)) assert.match(file, /PERMISSIONS\.BODEGA_WRITE/);
  assert.match(files[6], /PERMISSIONS\.LAB_DISPATCH/);
  for (const file of files) assert.match(file, /canWrite|canDispatch/);
});

test("rutas manuales no conceden acceso por caché ni arrays de roles", async () => {
  const [app, protectedRoute] = await Promise.all([
    source("src/App.tsx"), source("src/components/ProtectedRoute.tsx")
  ]);
  assert.match(app, /ProtectedRoute permission=/);
  assert.match(protectedRoute, /Navigate to="\/403"/);
  assert.doesNotMatch(protectedRoute, /roles|localStorage|pmp_me_cache/);
});

test("catálogo administrativo contiene sólo los siete roles oficiales", async () => {
  const adminUsers = await source("src/api/adminUsers.ts");
  assert.match(adminUsers, /\["admin", "gerente", "jefe_laboratorio", "logistica", "qa", "tecnico_laboratorio", "tecnico_terreno"\]/);
  assert.doesNotMatch(adminUsers, /jefe_taller|contador|"bodega"/);
});

test("el formateador central evita fechas epoch o inválidas", async () => {
  const formatterUrl = pathToFileURL(resolve(root, "src/utils/formatters.ts")).href;
  const { formatDate } = await import(formatterUrl);
  for (const value of [null, undefined, 0, "", "   ", "fecha-invalida"]) {
    assert.equal(formatDate(value), "Sin fecha");
  }
  assert.notEqual(formatDate("2026-08-16T12:00:00.000Z"), "Sin fecha");
});

test("Sidebar selecciona una sola ruta específica y distingue active, hover y focus", async () => {
  const [sidebar, navigation, layout] = await Promise.all([
    source("src/components/Sidebar.tsx"), source("src/app/navigation.ts"), source("src/styles/layout.css")
  ]);
  assert.match(sidebar, /getActiveNavigationRoute\(location\.pathname, navigation\)/);
  assert.match(navigation, /sort\(\(a, b\) => b\.route\.length - a\.route\.length\)\[0\]\?\.route/);
  assert.match(layout, /\.sb-link:hover/);
  assert.match(layout, /\.sb-link:focus-visible/);
  assert.match(layout, /\.sb-link\.active/);
});

test("la vista IA no afirma stream, auto-retrain ni métricas sin respaldo", async () => {
  const [page, panel] = await Promise.all([
    source("src/pages/AIPredictionsPage.tsx"), source("src/components/AIRiskPanel.tsx")
  ]);
  const combined = `${page}\n${panel}`;
  assert.doesNotMatch(combined, /Auto-retrain|PostgreSQL Stream|Random Forest Regressor|91,4%|42 días|Auditoría de datos PMP Suite v5\.0|Modelo PMP Suite v5\.0/);
  assert.match(page, /priorización IA es heurística, no una probabilidad validada/);
  assert.match(page, /getOperationalInsights/);
  assert.match(page, /Actualizar análisis/);
  assert.match(panel, /Índice de prioridad/);
});
