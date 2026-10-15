import test from "node:test";
import assert from "node:assert/strict";
import {
  AUTH_INVALIDATION_MESSAGES,
  createAuthInvalidationHandler,
  getLoginRedirectTarget,
  getSafeReturnPath
} from "../src/api/errors.ts";

function apiError(code, status = 401) {
  return { response: { status, data: { code } } };
}

function recorder(options = {}) {
  const calls = { signOut: 0, cache: 0, memory: 0, redirect: 0, details: [] };
  const handler = createAuthInvalidationHandler({
    async signOutUser() {
      calls.signOut += 1;
      if (options.signOutPromise) await options.signOutPromise;
    },
    removeMeCache() {
      calls.cache += 1;
    },
    clearSessionMemory(code, message) {
      calls.memory += 1;
      calls.details.push({ code, message });
    },
    redirectToLogin(code, message) {
      calls.redirect += 1;
      calls.details.push({ code, message });
    }
  });
  return { calls, handler };
}

for (const code of ["TOKEN_REVOKED", "TOKEN_EXPIRED", "INVALID_TOKEN", "USER_DISABLED"]) {
  test(`${code} cierra Firebase y limpia solamente la sesión una vez`, async () => {
    const { calls, handler } = recorder();
    assert.equal(await handler(apiError(code, code === "USER_DISABLED" ? 403 : 401)), true);
    assert.equal(calls.signOut, 1);
    assert.equal(calls.cache, 1);
    assert.equal(calls.memory, 1);
    assert.equal(calls.redirect, 1);
    assert.deepEqual(calls.details[0], { code, message: AUTH_INVALIDATION_MESSAGES[code] });
  });
}

test("READ_ONLY_ROLE y un 403 normal no cierran sesión ni eliminan caché", async () => {
  const { calls, handler } = recorder();
  const readOnly = { response: { status: 403, data: { error: "READ_ONLY_ROLE" } } };
  const forbidden = { response: { status: 403, data: { error: "FORBIDDEN" } } };

  assert.equal(await handler(readOnly), false);
  assert.equal(await handler(forbidden), false);
  assert.deepEqual(calls, { signOut: 0, cache: 0, memory: 0, redirect: 0, details: [] });
});

test("404, 409, validación, negocio y 500 no invalidan la sesión", async () => {
  const { calls, handler } = recorder();
  for (const status of [400, 404, 409, 500, 503]) {
    assert.equal(await handler({ response: { status, data: { code: "BUSINESS_ERROR" } } }), false);
  }
  assert.equal(calls.signOut, 0);
  assert.equal(calls.cache, 0);
});

test("solicitudes concurrentes producen un solo signOut, mensaje y redirección", async () => {
  let releaseSignOut;
  const signOutPromise = new Promise((resolve) => {
    releaseSignOut = resolve;
  });
  const { calls, handler } = recorder({ signOutPromise });

  const pending = [
    handler(apiError("TOKEN_REVOKED")),
    handler(apiError("TOKEN_REVOKED")),
    handler(apiError("TOKEN_EXPIRED"))
  ];
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(calls.signOut, 1);
  releaseSignOut();
  await Promise.all(pending);

  assert.equal(calls.signOut, 1);
  assert.equal(calls.cache, 1);
  assert.equal(calls.memory, 1);
  assert.equal(calls.redirect, 1);
});

test("la redirección al mismo login se omite para evitar bucles", () => {
  assert.equal(getLoginRedirectTarget("/", "TOKEN_REVOKED"), "/login?auth=TOKEN_REVOKED");
  assert.equal(getLoginRedirectTarget("/login?auth=TOKEN_REVOKED", "TOKEN_REVOKED"), null);
});

test("sólo se preservan rutas explícitas de lectura", () => {
  assert.equal(getSafeReturnPath("/operacion/os", "?page=2"), "/operacion/os?page=2");
  assert.equal(getSafeReturnPath("/lab/reportes"), "/lab/reportes");
  assert.equal(getSafeReturnPath("/operacion/ingreso"), null);
  assert.equal(getSafeReturnPath("/admin/users"), null);
  assert.equal(getSafeReturnPath("/login"), null);
});
