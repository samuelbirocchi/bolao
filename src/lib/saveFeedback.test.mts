import assert from "node:assert/strict";
import test from "node:test";

import { hasSaveFeedback, pathWithSaveFeedback } from "./saveFeedback.ts";

test("pathWithSaveFeedback adds the saved feedback marker", () => {
  assert.equal(
    pathWithSaveFeedback("/groups/group-1/matches", "predictions"),
    "/groups/group-1/matches?saved=predictions",
  );
});

test("pathWithSaveFeedback preserves existing query parameters", () => {
  assert.equal(
    pathWithSaveFeedback("/settings?setupPassword=1&next=%2Fgroups", "profile"),
    "/settings?setupPassword=1&next=%2Fgroups&saved=profile",
  );
});

test("hasSaveFeedback only matches the requested feedback target", () => {
  assert.equal(hasSaveFeedback("profile", "profile"), true);
  assert.equal(hasSaveFeedback("predictions", "profile"), false);
  assert.equal(hasSaveFeedback(undefined, "profile"), false);
});
