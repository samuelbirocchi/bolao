import assert from "node:assert/strict";
import { test } from "node:test";
import { assertNotOwner } from "./membership.ts";

test("assertNotOwner throws for an owner", () => {
  assert.throws(() => assertNotOwner("owner"), /Cannot remove a group owner/);
});

test("assertNotOwner passes for a member", () => {
  assert.doesNotThrow(() => assertNotOwner("member"));
});

test("assertNotOwner passes for null/undefined role", () => {
  assert.doesNotThrow(() => assertNotOwner(null));
  assert.doesNotThrow(() => assertNotOwner(undefined));
});
