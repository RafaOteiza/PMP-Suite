import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const transpile = (source) => ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
}).outputText;
const dataUrl = (source) => `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;

const rbacSource = await readFile(new URL("../src/app/rbac.ts", import.meta.url), "utf8");
const rbacUrl = dataUrl(transpile(rbacSource));
const navigationSource = await readFile(new URL("../src/app/navigation.ts", import.meta.url), "utf8");
const navigationJs = transpile(navigationSource).replace('from "./rbac"', `from "${rbacUrl}"`);
const [{ getNavigationForUser }, { can, PERMISSIONS, ROLES }] = await Promise.all([
  import(dataUrl(navigationJs)), import(rbacUrl)
]);

const user = (rol) => ({ rol, roles: [rol] });
const entries = (role) => getNavigationForUser(user(role)).flatMap((section) => section.items);
const routes = (role) => new Set(entries(role).map((item) => item.route));
const labels = (role) => new Set(entries(role).map((item) => item.label));

test("retiros tiene capacidad propia y navegación solo para logística después de requerimientos", () => {
  for (const role of [...Object.values(ROLES), 'desconocido']) {
    const allowed = role === ROLES.LOGISTICA;
    assert.equal(can(user(role), PERMISSIONS.WITHDRAWAL_ASSIGN), allowed);
    const navigation = entries(role), index = navigation.findIndex(item => item.route === '/operacion/retiros');
    assert.equal(index >= 0, allowed);
    if (allowed) {
      assert.equal(navigation[index].label, 'Retiros de terreno');
      if(role===ROLES.LOGISTICA)assert.equal(navigation[index - 1].route, '/operacion/requerimientos');
      else assert.ok(getNavigationForUser(user(role)).find(s=>s.id==='supervision').items.some(i=>i.route==='/operacion/retiros'));
    }
  }
});

test("gerente recibe consola ejecutiva sin navegación operacional", () => {
  const visible = routes(ROLES.GERENTE);
  for (const route of ["/", "/operacion/os", "/lab/recepcion", "/trazabilidad", "/equipos-operativos", "/lab/dashboard", "/lab/reportes", "/qa", "/bodega/dashboard", "/ia/predicciones"]) assert.equal(visible.has(route), true, route);
  for (const route of ["/admin/users", "/admin/despacho", "/bridge", "/operacion/ingreso", "/bodega", "/bodega/modulos", "/bodega/repuestos", "/lab/asignacion"]) assert.equal(visible.has(route), false, route);
  assert.equal(labels(ROLES.GERENTE).has("Dashboard ejecutivo"), true);
});

test("admin supervisa sin operaciones y jefatura controla sólo Laboratorio", () => {
 const admin=routes(ROLES.ADMIN), chief=routes(ROLES.JEFE_LABORATORIO);
 for(const path of ['/admin/users','/bridge','/lab/recepcion','/qa','/bodega/dashboard'])assert.equal(admin.has(path),true,path);
 for(const path of ['/lab/asignacion','/lab/despacho-qa','/bodega','/operacion/requerimientos'])assert.equal(admin.has(path),false,path);
 for(const path of ['/lab/dashboard','/lab/recepcion','/lab/asignacion','/lab/validadores','/lab/consolas','/lab/despacho-qa','/lab/reportes','/trazabilidad'])assert.equal(chief.has(path),true,path);
 for(const path of ['/admin/users','/qa','/bodega','/bridge','/operacion/ingreso'])assert.equal(chief.has(path),false,path);
 for(const p of [PERMISSIONS.LAB_ASSIGN,PERMISSIONS.LAB_DISPATCH,PERMISSIONS.EQUIPMENT_SCAN_WRITE]){assert.equal(can(user(ROLES.ADMIN),p),false);assert.equal(can(user(ROLES.JEFE_LABORATORIO),p),true);}
});

test("terreno recibe una experiencia propia y acotada", () => {
  const visible = routes(ROLES.TECNICO_TERRENO);
  assert.deepEqual([...visible], ["/mi-jornada", "/operacion/mis-os", "/operacion/ingreso", "/trazabilidad", "/bridge"]);
  assert.equal(labels(ROLES.TECNICO_TERRENO).has("Bridge · Referencias externas"), true);
});

test("laboratorio recibe su carga y herramientas técnicas", () => {
  const visible = routes(ROLES.TECNICO_LABORATORIO);
  for (const route of ["/mi-jornada", "/bridge", "/lab/validadores", "/lab/consolas"]) assert.equal(visible.has(route), true, route);
  for (const route of ["/admin/users", "/lab/recepcion", "/qa", "/bodega", "/lab/dashboard", "/lab/asignacion", "/lab/despacho-qa"]) assert.equal(visible.has(route), false, route);
});

test("QA recibe solamente su jornada y certificaciones asignadas", () => {
  const visible = routes(ROLES.QA);
  assert.deepEqual([...visible], ["/qa", "/trazabilidad", "/operacion/escaneo", "/bridge"]);
  assert.equal(labels(ROLES.QA).has("Bridge · Referencias externas"), true);
  assert.equal(can(user(ROLES.QA), PERMISSIONS.LAB_WRITE), false);
});

test("logística conserva Bridge, bodega, inventario y repuestos sin dominios ajenos", () => {
  const visible = routes(ROLES.LOGISTICA);
  for (const route of ["/bodega/dashboard", "/bridge", "/operacion/escaneo", "/bodega", "/bodega/modulos", "/bodega/repuestos", "/equipos-operativos", "/ia/predicciones"]) assert.equal(visible.has(route), true, route);
  for (const route of ["/admin/users", "/lab/dashboard", "/qa"]) assert.equal(visible.has(route), false, route);
  assert.equal(can(user(ROLES.LOGISTICA), PERMISSIONS.BODEGA_WRITE), true);
  assert.equal(can(user(ROLES.LOGISTICA), PERMISSIONS.QA_WRITE), false);
  assert.equal(entries(ROLES.LOGISTICA).find(item=>item.route==='/equipos-operativos').label,'Equipos en operación');
  assert.equal(entries(ROLES.LOGISTICA).find(item=>item.route==='/bodega/modulos').label,'Inventario de equipos');
});
