import test from "node:test";
import assert from "node:assert/strict";

import { installMockFirebaseCredential } from "./helpers/mockFirebaseCredential.js";

const removeMockFirebaseCredential = installMockFirebaseCredential();
test.after(removeMockFirebaseCredential);

const { createFirebaseAuth } = await import("../src/middleware/firebaseAuth.js");
const { createEnsureUser } = await import("../src/middleware/ensureUser.js");
const { enforceReadOnlyRole } = await import("../src/middleware/readOnlyRole.js");
const { requireAnyRole } = await import("../src/middleware/requireAnyRole.js");
const { ROLES } = await import("../src/constants/roles.js");

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

function request(method = "GET", token = "valid-token") {
  return {
    method,
    originalUrl: "/api/auth/me",
    headers: token ? { authorization: `Bearer ${token}`, "x-request-id": "request-test" } : {}
  };
}

function firebaseAdminReturning(result) {
  const calls = [];
  return {
    calls,
    admin: {
      auth() {
        return {
          async verifyIdToken(...args) {
            calls.push(args);
            if (result instanceof Error) throw result;
            return result;
          }
        };
      }
    }
  };
}

function firebaseError(code) {
  return Object.assign(new Error("detalle interno que no debe exponerse"), { code });
}

function silentLogger() {
  const entries = [];
  return {
    entries,
    logger: {
      warn(event, metadata) {
        entries.push({ event, metadata });
      }
    }
  };
}

function activeUser(role, activo = true) {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    nombre: "Usuario",
    apellido: "Prueba",
    correo: `${role}@pmp-suite.cl`,
    rol: role,
    activo
  };
}

function fakePool(rows) {
  return {
    async query() {
      return { rowCount: rows.length, rows };
    }
  };
}

async function runFirebase(result, { method = "GET", token = "valid-token" } = {}) {
  const fake = firebaseAdminReturning(result);
  const log = silentLogger();
  const middleware = createFirebaseAuth(fake.admin, {
    logger: log.logger,
    now: () => new Date("2026-08-06T12:00:00.000Z")
  });
  const req = request(method, token);
  const res = responseRecorder();
  let nextCalled = false;

  await middleware(req, res, () => {
    nextCalled = true;
  });

  return { fake, log, req, res, nextCalled };
}

test("token válido se verifica con checkRevoked=true y adjunta identidad Firebase", async () => {
  const result = await runFirebase({ uid: "firebase-uid", email: "admin@pmp-suite.cl", name: "Admin", rol: "gerente" });

  assert.equal(result.nextCalled, true);
  assert.deepEqual(result.fake.calls, [["valid-token", true]]);
  assert.deepEqual(result.req.firebase, {
    uid: "firebase-uid",
    email: "admin@pmp-suite.cl",
    name: "Admin"
  });
  assert.equal("rol" in result.req.firebase, false, "el claim rol no se convierte en autoridad");
});

test("token ausente responde AUTH_REQUIRED y no consulta Firebase", async () => {
  const result = await runFirebase({ uid: "no-importa" }, { token: null });

  assert.equal(result.nextCalled, false);
  assert.equal(result.res.statusCode, 401);
  assert.deepEqual(result.res.body, {
    code: "AUTH_REQUIRED",
    message: "Se requiere autenticación."
  });
  assert.equal(result.fake.calls.length, 0);
});

for (const [firebaseCode, status, code, message] of [
  ["auth/argument-error", 401, "INVALID_TOKEN", "La sesión no es válida."],
  ["auth/invalid-id-token", 401, "INVALID_TOKEN", "La sesión no es válida."],
  ["auth/id-token-expired", 401, "TOKEN_EXPIRED", "La sesión expiró. Inicia sesión nuevamente."],
  ["auth/id-token-revoked", 401, "TOKEN_REVOKED", "La sesión fue revocada. Inicia sesión nuevamente."],
  ["auth/user-disabled", 403, "USER_DISABLED", "La cuenta está deshabilitada."],
  ["auth/invalid-credential", 503, "AUTH_SERVICE_UNAVAILABLE", "No fue posible validar la sesión."],
  ["app/network-error", 503, "AUTH_SERVICE_UNAVAILABLE", "No fue posible validar la sesión."]
]) {
  test(`${firebaseCode} se normaliza como ${code}`, async () => {
    const result = await runFirebase(firebaseError(firebaseCode));

    assert.equal(result.nextCalled, false);
    assert.equal(result.res.statusCode, status);
    assert.deepEqual(result.res.body, { code, message });
    assert.deepEqual(result.fake.calls, [["valid-token", true]]);
    assert.equal(result.log.entries.length, 1);
    assert.deepEqual(Object.keys(result.log.entries[0].metadata).sort(), [
      "code", "date", "method", "requestId", "route"
    ]);
    assert.equal(JSON.stringify(result.log.entries).includes("valid-token"), false);
    assert.equal(JSON.stringify(result.res.body).includes("detalle interno"), false);
  });
}

test("Firebase válido continúa a PostgreSQL, que rechaza usuario ausente o inactivo", async () => {
  for (const rows of [[], [activeUser(ROLES.QA, false)]]) {
    const firebaseResult = await runFirebase({ uid: "firebase-uid", email: "qa@pmp-suite.cl" });
    const ensureUser = createEnsureUser(fakePool(rows));
    await ensureUser(firebaseResult.req, firebaseResult.res, () => assert.fail("no debe continuar"));

    assert.equal(firebaseResult.res.statusCode, 403);
    assert.equal(
      firebaseResult.res.body.error,
      rows.length === 0 ? "Usuario no habilitado" : "Usuario inactivo"
    );
  }
});

test("el rol efectivo proviene de PostgreSQL: gerente lee pero no escribe", async () => {
  const ensureUser = createEnsureUser(fakePool([activeUser(ROLES.GERENTE)]));

  for (const method of ["GET", "POST"]) {
    const firebaseResult = await runFirebase({
      uid: "manager-uid",
      email: "gerente@pmp-suite.cl",
      rol: ROLES.ADMIN
    }, { method });
    firebaseResult.req.baseUrl = "/api/dashboard";
    firebaseResult.req.path = "/summary";

    const originalWarn = console.warn;
    console.warn = () => {};
    try {
      await ensureUser(firebaseResult.req, firebaseResult.res, () => {
        enforceReadOnlyRole(firebaseResult.req, firebaseResult.res, () => {
          requireAnyRole(ROLES.ADMIN, ROLES.GERENTE)(firebaseResult.req, firebaseResult.res, () => {
            firebaseResult.res.status(200).json({ ok: true });
          });
        });
      });
    } finally {
      console.warn = originalWarn;
    }

    assert.equal(firebaseResult.req.user.rol, ROLES.GERENTE);
    assert.equal(firebaseResult.res.statusCode, method === "GET" ? 200 : 403);
    assert.equal(
      firebaseResult.res.body.error,
      method === "GET" ? undefined : "READ_ONLY_ROLE"
    );
  }
});

test("admin activo conserva escritura", async () => {
  const firebaseResult = await runFirebase({ uid: "admin-uid", email: "admin@pmp-suite.cl" }, { method: "POST" });
  firebaseResult.req.baseUrl = "/api/admin";
  firebaseResult.req.path = "/dispatch";
  const ensureUser = createEnsureUser(fakePool([activeUser(ROLES.ADMIN)]));

  await ensureUser(firebaseResult.req, firebaseResult.res, () => {
    enforceReadOnlyRole(firebaseResult.req, firebaseResult.res, () => {
      requireAnyRole(ROLES.ADMIN)(firebaseResult.req, firebaseResult.res, () => {
        firebaseResult.res.status(200).json({ ok: true });
      });
    });
  });

  assert.equal(firebaseResult.res.statusCode, 200);
  assert.deepEqual(firebaseResult.res.body, { ok: true });
});
