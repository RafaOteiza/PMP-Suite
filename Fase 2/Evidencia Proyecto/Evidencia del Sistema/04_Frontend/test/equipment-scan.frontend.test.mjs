import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = (path) => readFile(resolve(root, path), "utf8");

test("la estación de escaneo posee ruta y permisos explícitos", async () => {
  const [app, rbac, navigation] = await Promise.all([
    source("src/App.tsx"),
    source("src/app/rbac.ts"),
    source("src/app/navigation.ts")
  ]);
  assert.match(app, /path="\/operacion\/escaneo"[^\n]+PERMISSIONS\.EQUIPMENT_SCAN_VIEW/);
  assert.match(rbac, /EQUIPMENT_SCAN_VIEW/);
  assert.match(rbac, /EQUIPMENT_SCAN_WRITE/);
  assert.match(navigation, /Estación de escaneo/);
});

test("el lector acepta pistola USB por Enter y mantiene alternativa manual accesible", async () => {
  const page = await source("src/pages/EquipmentScanPage.tsx");
  assert.match(page, /autoFocus/);
  assert.match(page, /onSubmit/);
  assert.match(page, /Escanea el QR, código de barras o ingresa el identificador/);
  assert.match(page, /aria-live="polite"/);
  assert.match(page, /serie/);
  assert.match(page, /amid/);
  assert.doesNotMatch(page, /setTimeout\([^,]+,\s*[5-9]\d{3}/);
});

test("la API separa resolución de lectura y confirmación física", async () => {
  const api = await source("src/api/equipmentScan.ts");
  assert.match(api, /api\.get<ScanResolution>\("\/api\/equipment-scan\/resolve"/);
  assert.doesNotMatch(api, /api\.post/);
});

test("Bodega prepara QA sin selector de certificador", async () => {
 const page=await source('src/pages/BodegaPage.tsx'),api=await source('src/api/bodega.ts');
 assert.match(page,/Preparar envío a QA/);assert.match(page,/envios-qa/);
 assert.doesNotMatch(page,/qaAssignments|Asignar responsable QA|getQaUsers/);
 assert.doesNotMatch(api,/dispatchToQa\(codigo_os: string, qa_usuario_id/);
});

test("la estación conserva acciones y deriva custodia a su validación específica", async () => {
  const [page, actions, scanApi] = await Promise.all([
    source("src/pages/EquipmentScanPage.tsx"),
    source("src/components/ScanOperationalActions.tsx"),
    source("src/api/equipmentScan.ts")
  ]);
  assert.match(page, /lab\/custodia/);
  assert.match(page, /bodega\/recepciones/);
  assert.match(page, /qa\//);
  assert.doesNotMatch(page, /confirmEquipmentScan|api\.post|api\.put/);
  assert.match(page, /Equipo identificado · sin movimiento/);
  assert.match(actions, /Preparar recepción en Bodega/);
  assert.match(actions, /Preparar envío a Laboratorio/);
  assert.match(actions, /to="\/bodega\?tab=para-lab"/);
  assert.doesNotMatch(actions, /dispatchWarehouseToLab/);
  assert.doesNotMatch(actions, /Asignar responsable QA/);
  assert.match(actions, /Preparar envío a QA/);
  assert.match(actions, /Gestionar reparación/);
  assert.match(actions, /Ir a Control QA/);
  assert.match(actions, /Preparar siguiente lectura/);
  assert.match(scanApi, /fue_laboratorio/);
  assert.match(scanApi, /es_aprobado_qa/);
  assert.doesNotMatch(actions, /window\.location|navigate\(/);
});

test("jefatura recepciona y despacha laboratorio mientras el técnico solamente repara", async () => {
  const [labView, repairModal, scanPage, actions, labApi] = await Promise.all([
    source("src/components/LabEquipmentView.tsx"),
    source("src/components/RepairWorkForm.tsx"),
    source("src/pages/EquipmentScanPage.tsx"),
    source("src/components/ScanOperationalActions.tsx"),
    source("src/api/lab.ts")
  ]);
  assert.match(labView, /Pendiente recepción del jefe/);
  assert.match(labView, /recepcion_laboratorio_confirmada/);
  assert.match(repairModal, /getApiErrorMessage/);
  assert.doesNotMatch(repairModal, /Revisa la conexión e inténtalo nuevamente/);
  assert.match(scanPage, /\[ROLES\.JEFE_LABORATORIO\]: "LABORATORIO"/);
  assert.match(actions, /role === ROLES\.JEFE_LABORATORIO/);
  assert.match(actions, /Despachar equipo reparado/);
  assert.doesNotMatch(labApi, /dispatchToWarehouse/);assert.match(actions, /lab\/custodia/);
});
