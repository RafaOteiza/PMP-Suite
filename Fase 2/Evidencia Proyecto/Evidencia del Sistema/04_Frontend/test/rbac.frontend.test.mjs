import test from "node:test";
import assert from "node:assert/strict";
import {
  PERMISSIONS,
  ROLES,
  can,
  getPermissionsForRole,
  isOfficialRole,
  isReadOnlyRole
} from "../src/app/rbac.ts";

const user = (rol) => ({ rol, roles: [rol] });

test("gestión del maestro e ingreso de requerimientos son exclusivos de Admin y Logística", () => {
  for (const role of Object.values(ROLES)) {
    const allowed = role === ROLES.LOGISTICA;
    assert.equal(can(user(role), PERMISSIONS.ASSET_MANAGE), allowed, role);
    assert.equal(can(user(role), PERMISSIONS.REQUEST_CREATE), allowed, role);
  }
});

test("catálogo oficial y rol desconocido fallan de forma cerrada", () => {
  assert.deepEqual(Object.values(ROLES), [
    "jefe_laboratorio", "admin", "gerente", "logistica", "qa", "tecnico_laboratorio", "tecnico_terreno"
  ]);
  assert.equal(isOfficialRole("jefe_taller"), false);
  assert.equal(isOfficialRole("bodega"), false);
  assert.equal(can(user("rol_desconocido"), PERMISSIONS.DASHBOARD_VIEW), false);
  assert.deepEqual(getPermissionsForRole("rol_desconocido"), []);
});

test("admin supervisa, asigna y controla la recepción y despacho físico de laboratorio", () => {
  for (const permission of [
    PERMISSIONS.DASHBOARD_VIEW, PERMISSIONS.OS_VIEW, PERMISSIONS.LAB_VIEW,
    PERMISSIONS.QA_VIEW, PERMISSIONS.BODEGA_VIEW,
    PERMISSIONS.USERS_VIEW, PERMISSIONS.BRIDGE_FLOW_VIEW
  ]) assert.equal(can(user(ROLES.ADMIN), permission), true, permission);
  for (const permission of [
    PERMISSIONS.LAB_ASSIGN, PERMISSIONS.LAB_DISPATCH, PERMISSIONS.EQUIPMENT_SCAN_WRITE,
    PERMISSIONS.OS_CREATE, PERMISSIONS.OS_UPDATE, PERMISSIONS.LAB_WRITE,
    PERMISSIONS.QA_WRITE
  ]) assert.equal(can(user(ROLES.ADMIN), permission), false, permission);
});

test("gerente posee consultas globales y sólo contraseña propia como escritura", () => {
  for (const permission of [
    PERMISSIONS.DASHBOARD_VIEW, PERMISSIONS.OS_VIEW, PERMISSIONS.EQUIPOS_VIEW,
    PERMISSIONS.LAB_VIEW, PERMISSIONS.QA_VIEW, PERMISSIONS.BODEGA_VIEW,
    PERMISSIONS.REPORTS_VIEW, PERMISSIONS.TRACE_VIEW, PERMISSIONS.AI_VIEW,
    PERMISSIONS.DISPATCH_VIEW, PERMISSIONS.BRIDGE_FLOW_VIEW,
  ]) assert.equal(can(user(ROLES.GERENTE), permission), true, permission);

  for (const permission of [
    PERMISSIONS.OS_CREATE, PERMISSIONS.OS_UPDATE, PERMISSIONS.LAB_WRITE,
    PERMISSIONS.LAB_ASSIGN, PERMISSIONS.LAB_DISPATCH, PERMISSIONS.QA_WRITE,
    PERMISSIONS.BODEGA_WRITE, PERMISSIONS.USERS_VIEW, PERMISSIONS.USERS_WRITE,
    PERMISSIONS.DISPATCH_WRITE, PERMISSIONS.SETTINGS_VIEW, PERMISSIONS.OWN_PASSWORD_UPDATE
  ]) assert.equal(can(user(ROLES.GERENTE), permission), false, permission);

  assert.equal(isReadOnlyRole(user(ROLES.GERENTE)), true);
  assert.equal(isReadOnlyRole(user(ROLES.ADMIN)), false);
});

test("roles operativos conservan sus áreas", () => {
  assert.equal(can(user(ROLES.LOGISTICA), PERMISSIONS.BODEGA_WRITE), true);
  assert.equal(can(user(ROLES.LOGISTICA), PERMISSIONS.BRIDGE_FLOW_VIEW), true);
  assert.equal(can(user(ROLES.LOGISTICA), PERMISSIONS.QA_WRITE), false);
  assert.equal(can(user(ROLES.QA), PERMISSIONS.QA_WRITE), true);
  assert.equal(can(user(ROLES.QA), PERMISSIONS.BRIDGE_FLOW_VIEW), true);
  assert.equal(can(user(ROLES.QA), PERMISSIONS.BODEGA_WRITE), false);
  assert.equal(can(user(ROLES.TECNICO_LABORATORIO), PERMISSIONS.LAB_WRITE), true);
  assert.equal(can(user(ROLES.TECNICO_LABORATORIO), PERMISSIONS.EQUIPMENT_SCAN_WRITE), false);
  assert.equal(can(user(ROLES.TECNICO_LABORATORIO), PERMISSIONS.LAB_DISPATCH), false);
  assert.equal(can(user(ROLES.TECNICO_LABORATORIO), PERMISSIONS.BRIDGE_FLOW_VIEW), true);
  assert.equal(can(user(ROLES.TECNICO_LABORATORIO), PERMISSIONS.LAB_ASSIGN), false);
  assert.equal(can(user(ROLES.TECNICO_TERRENO), PERMISSIONS.OS_CREATE), true);
  assert.equal(can(user(ROLES.TECNICO_TERRENO), PERMISSIONS.BRIDGE_FLOW_VIEW), true);
  assert.equal(can(user(ROLES.TECNICO_TERRENO), PERMISSIONS.LAB_WRITE), false);
});
