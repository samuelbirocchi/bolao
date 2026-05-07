import assert from "node:assert/strict";
import { test } from "node:test";
import {
  AVATAR_URL_MAX_LENGTH,
  colorForSeed,
  initialsFor,
  validateAvatarUrl,
} from "./avatar.ts";

test("validateAvatarUrl returns null for empty or whitespace input", () => {
  assert.equal(validateAvatarUrl(""), null);
  assert.equal(validateAvatarUrl("   "), null);
});

test("validateAvatarUrl trims and accepts http/https URLs", () => {
  assert.equal(validateAvatarUrl("  https://example.com/a.png  "), "https://example.com/a.png");
  assert.equal(validateAvatarUrl("http://example.com/a.png"), "http://example.com/a.png");
});

test("validateAvatarUrl rejects non-http schemes and bare strings", () => {
  assert.throws(() => validateAvatarUrl("javascript:alert(1)"));
  assert.throws(() => validateAvatarUrl("ftp://example.com/a.png"));
  assert.throws(() => validateAvatarUrl("not a url"));
});

test("validateAvatarUrl rejects URLs longer than the max length", () => {
  const tooLong = "https://example.com/" + "a".repeat(AVATAR_URL_MAX_LENGTH);
  assert.throws(() => validateAvatarUrl(tooLong));
});

test("initialsFor handles common name shapes", () => {
  assert.equal(initialsFor("Ada Lovelace"), "AL");
  assert.equal(initialsFor("ada lovelace turing"), "AT");
  assert.equal(initialsFor("Ada"), "A");
  assert.equal(initialsFor("  "), "?");
  assert.equal(initialsFor(null), "?");
  assert.equal(initialsFor(undefined), "?");
  assert.equal(initialsFor(""), "?");
});

test("colorForSeed is deterministic and spreads across the palette", () => {
  assert.equal(colorForSeed("abc"), colorForSeed("abc"));
  const seeds = ["alpha", "beta", "gamma", "delta", "epsilon", "zeta", "eta", "theta"];
  const colors = new Set(seeds.map(colorForSeed));
  assert.ok(colors.size >= 3, `expected color variety, got ${colors.size} unique colors`);
  for (const color of colors) {
    assert.match(color, /^#[0-9a-f]{6}$/i);
  }
});
