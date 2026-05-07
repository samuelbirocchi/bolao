import assert from "node:assert/strict";
import { test } from "node:test";
import { flagForTeamName, normalizeTeamName } from "./teamFlags.ts";

test("flagForTeamName returns flags for known teams", () => {
  assert.equal(flagForTeamName("Brazil"), "🇧🇷");
  assert.equal(flagForTeamName("United States"), "🇺🇸");
});

test("flagForTeamName normalizes casing, spacing, accents, and aliases", () => {
  assert.equal(flagForTeamName("  bRaZiL  "), "🇧🇷");
  assert.equal(flagForTeamName("Côte   d’Ivoire"), "🇨🇮");
  assert.equal(flagForTeamName("USA"), "🇺🇸");
  assert.equal(flagForTeamName("Korea Republic"), "🇰🇷");
});

test("flagForTeamName returns null for unknown, empty, and placeholder names", () => {
  assert.equal(flagForTeamName(""), null);
  assert.equal(flagForTeamName(null), null);
  assert.equal(flagForTeamName("TBD"), null);
  assert.equal(flagForTeamName("A definir"), null);
  assert.equal(flagForTeamName("Winner Group A"), null);
});

test("normalizeTeamName compacts punctuation and whitespace", () => {
  assert.equal(normalizeTeamName("  United   States   of America  "), "united states of america");
  assert.equal(normalizeTeamName("Bosnia & Herzegovina"), "bosnia and herzegovina");
});
