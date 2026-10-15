import test from "node:test";

import assert from "node:assert/strict";

import { readFile } from "node:fs/promises";



import { ROLES } from "../src/constants/roles.js";

import { createEnsureUser } from "../src/middleware/ensureUser.js";

import { requireAnyRole } from "../src/middleware/requireAnyRole.js";

import { enforceReadOnlyRole } from "../src/middleware/readOnlyRole.js";

import { installMockFirebaseCredential } from "./helpers/mockFirebaseCredential.js";



const removeMockFirebaseCredential = installMockFirebaseCredential();

test.after(removeMockFirebaseCredential);



function responseRecorder() {

  return {

    statusCode: 200,

    body: undefined,

    status(code) {

      this.statusCode = code;

      return this;

    },

    json(body) {

      this.body = body;

      return this;

    }

  };

}



function fakePoolWith(rows) {

  return {

    async query() {

      return { rowCount: rows.length, rows };

    }

  };

}



function activeUser(role) {

  return {

    id: "00000000-0000-4000-8000-000000000001",

    nombre: "Usuario",

    apellido: "Prueba",

    correo: `${role}@pmp-suite.cl`,

    rol: role,

    activo: true

  };

}



async function source(relativePath) {

  return readFile(new URL(`../${relativePath}`, import.meta.url), "utf8");

}



test("sin token, firebaseAuth responde 401", async () => {

  const { firebaseAuth } = await import("../src/middleware/firebaseAuth.js");

  const res = responseRecorder();

  let nextCalled = false;



  await firebaseAuth({ headers: {} }, res, () => {

    nextCalled = true;

  });



  assert.equal(res.statusCode, 401);

  assert.equal(nextCalled, false);

});



test("usuario ausente en PostgreSQL responde 403", async () => {

  const ensureUser = createEnsureUser(fakePoolWith([]));

  const res = responseRecorder();



  await ensureUser(

    { firebase: { uid: "firebase-uid", email: "ausente@pmp-suite.cl" } },

    res,

    () => assert.fail("no debe continuar")

  );



  assert.equal(res.statusCode, 403);

  assert.equal(res.body.error, "Usuario no habilitado");

});



test("usuario inactivo en PostgreSQL responde 403", async () => {

  const ensureUser = createEnsureUser(fakePoolWith([{ ...activeUser(ROLES.GERENTE), activo: false }]));

  const res = responseRecorder();



  await ensureUser(

    { firebase: { uid: "firebase-uid", email: "gerente@pmp-suite.cl" } },

    res,

    () => assert.fail("no debe continuar")

  );



  assert.equal(res.statusCode, 403);

  assert.equal(res.body.error, "Usuario inactivo");

});



test("gerente ejecutando un GET autorizado obtiene 200", async () => {

  const ensureUser = createEnsureUser(fakePoolWith([activeUser(ROLES.GERENTE)]));

  const req = {

    method: "GET",

    baseUrl: "/api/dashboard",

    path: "/summary",

    firebase: { uid: "firebase-uid", email: "gerente@pmp-suite.cl" }

  };

  const res = responseRecorder();



  await ensureUser(req, res, () => {

    enforceReadOnlyRole(req, res, () => {

      requireAnyRole(ROLES.ADMIN, ROLES.GERENTE)(req, res, () => {

        res.status(200).json({ ok: true });

      });

    });

  });



  assert.equal(res.statusCode, 200);

  assert.deepEqual(res.body, { ok: true });

});



test("gerente recibe READ_ONLY_ROLE para POST, PUT, PATCH y DELETE", () => {

  const originalWarn = console.warn;

  const logs = [];

  console.warn = (...args) => logs.push(args);



  try {

    for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {

      const req = {

        method,

        baseUrl: "/api/operacion",

        path: "/dato-sensible/123",

        headers: { authorization: "Bearer token-que-no-debe-registrarse" },

        body: { secreto: "no-registrar" },

        user: activeUser(ROLES.GERENTE)

      };

      const res = responseRecorder();



      enforceReadOnlyRole(req, res, () => assert.fail(`${method} no debe continuar`));



      assert.equal(res.statusCode, 403, method);

      assert.deepEqual(res.body, {

        error: "READ_ONLY_ROLE",

        message: "El rol gerente posee acceso de solo lectura"

      });

    }

  } finally {

    console.warn = originalWarn;

  }



  assert.equal(logs.length, 4);

  for (const [, metadata] of logs) {

    assert.equal(metadata.role, ROLES.GERENTE);

    assert.equal(metadata.routeGroup, "/api/operacion");

    assert.equal("headers" in metadata, false);

    assert.equal("body" in metadata, false);

  }

});



test("gerente conserva las excepciones de contraseña propia", () => {

  const paths = [

    "/password",

    "/reset-password-link",

    "/my/reset-password-link"

  ];



  for (const path of paths) {

    const req = {

      method: "POST",

      baseUrl: "/api/auth",

      path,

      user: activeUser(ROLES.GERENTE)

    };

    const res = responseRecorder();

    let nextCalled = false;



    enforceReadOnlyRole(req, res, () => {

      nextCalled = true;

    });



    assert.equal(nextCalled, false, path);

    assert.equal(res.statusCode, 403, path);

  }

});



test("un claim Firebase admin no prevalece sobre PostgreSQL gerente", async () => {

  const ensureUser = createEnsureUser(fakePoolWith([activeUser(ROLES.GERENTE)]));

  const req = {

    method: "POST",

    baseUrl: "/api/admin",

    path: "/dispatch",

    firebase: {

      uid: "firebase-uid",

      email: "gerente@pmp-suite.cl",

      rol: ROLES.ADMIN

    }

  };

  const res = responseRecorder();

  const originalWarn = console.warn;

  console.warn = () => {};



  try {

    await ensureUser(req, res, () => {

      enforceReadOnlyRole(req, res, () => assert.fail("el claim no debe elevar permisos"));

    });

  } finally {

    console.warn = originalWarn;

  }



  assert.equal(req.user.rol, ROLES.GERENTE);

  assert.equal(res.statusCode, 403);

  assert.equal(res.body.error, "READ_ONLY_ROLE");

});



test("los roles operativos conservan escritura solo en su dominio", () => {

  const permissionCases = [

    ["jefatura en laboratorio", ROLES.JEFE_LABORATORIO, [ROLES.JEFE_LABORATORIO]],

    ["logistica en bodega", ROLES.LOGISTICA, [ROLES.LOGISTICA]],

    ["qa en QA", ROLES.QA, [ROLES.QA]],

    ["tecnico_laboratorio en laboratorio", ROLES.TECNICO_LAB, [ROLES.TECNICO_LAB]],

    ["tecnico_terreno en OS", ROLES.TECNICO_TERRENO, [ROLES.TECNICO_TERRENO]]

  ];



  for (const [name, role, allowed] of permissionCases) {

    const req = { user: activeUser(role) };

    const res = responseRecorder();

    let nextCalled = false;



    requireAnyRole(...allowed)(req, res, () => {

      nextCalled = true;

    });



    assert.equal(nextCalled, true, name);

    assert.equal(res.statusCode, 200, name);

  }

});



test("las matrices de rutas separan administración de ejecución operacional", async () => {

  const os = await source("src/routes/os.routes.js");

  const lab = await source("src/routes/lab.routes.js");

  const qa = await source("src/routes/qa.routes.js");

  const bodega = await source("src/routes/bodega.routes.js");



  assert.match(os, /authorize\('terrain.work'\)/);

  assert.match(lab, /authorize\('lab.work'\)/);

  assert.match(qa, /authorize\('qa.work'\)/);

  assert.match(bodega, /authorize\('warehouse.move'\)/);

});



test("laboratorio usa el usuario PostgreSQL autorizado para el trabajo propio", async () => {

  const text = await source("src/routes/lab.routes.js");

  assert.match(text, /finishWork\(pool,req\.body,req\.user\)/);

  const service=await source("src/services/labWork.js");

  assert.match(service,/String\(row\.tecnico_laboratorio_id\)!==String\(user\.id\)/);

  assert.doesNotMatch(text, /WHERE firebase_uid = \$1/);

});



test("las rutas protegidas instalan autenticación, usuario PostgreSQL y solo lectura en ese orden", async () => {

  const routeFiles = [

    "src/routes/auth.routes.js",

    "src/routes/admin.routes.js",

    "src/routes/admin.users.routes.js",

    "src/routes/users.routes.js",

    "src/routes/os.routes.js",

    "src/routes/lab.routes.js",

    "src/routes/qa.routes.js",

    "src/routes/bodega.routes.js",

    "src/routes/dashboard.routes.js",

    "src/routes/ai.routes.js",

    "src/routes/master.routes.js",

    "src/routes/badges.routes.js",

    "src/routes/bridge.routes.js",

    "src/routes/equipmentScan.routes.js"

  ];



  for (const routeFile of routeFiles) {

    const text = await source(routeFile);

    assert.match(

      text,

      /router\.use\(firebaseAuth, ensureUser, enforceReadOnlyRole\)/,

      routeFile

    );

  }

});



test("dispatch legado exige jefatura y sus GET permiten supervisión", async () => {

  const text = await source("src/routes/admin.routes.js");




  assert.match(text, /router\.get\("\/stats", authorize\('supervision.read'\)/);

  assert.match(text, /router\.get\("\/dispatch-queue", authorize\('supervision.read'\)/);

  assert.match(text, /router\.post\("\/dispatch", authorize\('lab.custody'\)/);

  assert.doesNotMatch(text, /router\.post\("\/dispatch", firebaseAuth/);

});



test("GET /api/os usa permiso específico de consulta global", async () => {

  const text = await source("src/routes/os.routes.js");

  assert.match(

    text,

    /router\.get\("\/", authorize\('orders.list'\)/

  );

  assert.match(text, /pagination: \{ total, limit, offset \}/);

});



test("dashboard global y búsqueda respetan el alcance de experiencia por rol", async () => {

  const text = await source("src/routes/dashboard.routes.js");

  assert.match(text, /router\.get\("\/summary", authorize\('supervision.read'\)/);

  assert.match(text, /router\.get\("\/global-search", requireAnyRole\(\.\.\.Object.values\(ROLES\)\)/);

  assert.doesNotMatch(text, /requireAnyRole\(\.\.\.VALID_ROLES\)/);

});



test("QA autónomo exige recepción y responsabilidad; Admin no opera", async () => {

  const routes=await source('src/routes/qa.routes.js'), service=await source('src/services/qaWork.js');

  assert.match(routes,/authorize\('qa.work'\)/);

  assert.match(service,/QA_ROLE_REQUIRED/);assert.match(service,/QA_NOT_OWNER/);

  assert.match(service,/QA_RECEIPT_REQUIRED/);assert.match(service,/FOR UPDATE/);

  assert.match(routes,/status\(410\)/);

});



test("IA usa autorización específica de lectura colaborativa", async () => {

  const text = await source("src/routes/ai.routes.js");

  assert.match(text, /router\.get\("\/predictive-report", authorize\('ai.read'\)/);

  assert.doesNotMatch(text, /requireAnyRole\(\.\.\.VALID_ROLES\)/);

  assert.match(text, /\.venv", "Scripts", "python\.exe"/);

  assert.match(text, /execFile\(pythonExecutable/);

  assert.doesNotMatch(text, /details:\s*stderr|output:\s*stdout/);

});



test("requireAnyRole posee una sola implementación canónica", async () => {

  const canonical = await source("src/middleware/requireAnyRole.js");

  const requireRole = await source("src/middleware/requireRole.js");



  assert.match(canonical, /export function requireAnyRole/);

  assert.doesNotMatch(requireRole, /export function requireAnyRole/);

});


// Nullable/unknown account status must not become an implicitly active identity.
test("estado de cuenta no confirmado se deniega", async () => {
 for(const activo of [null,undefined]){
  const ensureUser=createEnsureUser(fakePoolWith([{...activeUser(ROLES.ADMIN),activo}]));
  const res=responseRecorder();await ensureUser({firebase:{uid:'firebase-uid',email:'admin@pmp-suite.cl'}},res,()=>assert.fail('Cuenta no activa'));
  assert.equal(res.statusCode,403);
 }
});
