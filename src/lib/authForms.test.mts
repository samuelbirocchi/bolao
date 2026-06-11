import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  normalizeInviteCode,
  safeInternalRedirectPath,
  validatePasswordSetup,
} from "./authForms.ts";

describe("normalizeInviteCode", () => {
  it("normalizes valid invite codes", () => {
    assert.equal(normalizeInviteCode(" ab12cd "), "AB12CD");
  });

  it("rejects invalid invite codes", () => {
    assert.equal(normalizeInviteCode("abc-123"), "");
    assert.equal(normalizeInviteCode("A".repeat(33)), "");
  });
});

describe("safeInternalRedirectPath", () => {
  it("allows internal paths", () => {
    assert.equal(safeInternalRedirectPath("/groups/123?tab=matches"), "/groups/123?tab=matches");
  });

  it("rejects external or protocol-relative paths", () => {
    assert.equal(safeInternalRedirectPath("https://example.com"), "/groups");
    assert.equal(safeInternalRedirectPath("//example.com"), "/groups");
  });
});

describe("validatePasswordSetup", () => {
  it("accepts matching passwords with at least eight characters", () => {
    assert.deepEqual(validatePasswordSetup("password1", "password1"), { ok: true });
  });

  it("rejects short or mismatched passwords", () => {
    assert.deepEqual(validatePasswordSetup("short", "short"), {
      ok: false,
      message: "Password must be at least 8 characters.",
    });
    assert.deepEqual(validatePasswordSetup("password1", "password2"), {
      ok: false,
      message: "Passwords do not match.",
    });
  });
});
