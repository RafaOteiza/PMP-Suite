import test from "node:test";
import assert from "node:assert/strict";

import { ROLES, VALID_ROLES } from "../src/constants/roles.js";

test("el catálogo canónico incorpora el rol gerente", () => {
  assert.equal(ROLES.GERENTE, "gerente");
  assert.ok(VALID_ROLES.includes("gerente"));
});

