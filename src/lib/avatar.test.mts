import assert from "node:assert/strict";
import { test } from "node:test";
import {
  AVATAR_URL_MAX_LENGTH,
  avatarExtensionForContentType,
  avatarObjectPath,
  avatarStoragePathFromPublicUrl,
  colorForSeed,
  gravatarUrl,
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


test("gravatarUrl builds a 2x url with a 404 default", () => {
  assert.equal(
    gravatarUrl("abc123", 36),
    "https://www.gravatar.com/avatar/abc123?s=72&d=404",
  );
  assert.equal(
    gravatarUrl("  abc123  ", 48),
    "https://www.gravatar.com/avatar/abc123?s=96&d=404",
  );
});

test("gravatarUrl returns null for a blank hash", () => {
  assert.equal(gravatarUrl(null), null);
  assert.equal(gravatarUrl(undefined), null);
  assert.equal(gravatarUrl(""), null);
  assert.equal(gravatarUrl("   "), null);
});

test("avatarObjectPath gives each upload a unique object path", () => {
  assert.equal(avatarObjectPath("user-id", "image/png", "one"), "user-id/avatar-one.png");
  assert.equal(avatarObjectPath("user-id", "image/jpeg", "two"), "user-id/avatar-two.jpg");
  assert.notEqual(
    avatarObjectPath("user-id", "image/png", "one"),
    avatarObjectPath("user-id", "image/png", "two"),
  );
});

test("avatarObjectPath strips path separators from userId", () => {
  assert.equal(
    avatarObjectPath("../../etc/passwd", "image/png", "one"),
    "..-..-etc-passwd/avatar-one.png",
  );
  assert.throws(() => avatarObjectPath("", "image/png", "one"));
});

test("avatarExtensionForContentType maps common image types", () => {
  assert.equal(avatarExtensionForContentType("image/jpeg"), "jpg");
  assert.equal(avatarExtensionForContentType("image/png; charset=utf-8"), "png");
  assert.equal(avatarExtensionForContentType("image/webp"), "webp");
  assert.equal(avatarExtensionForContentType("image/svg+xml"), "image");
  assert.equal(avatarExtensionForContentType(""), "image");
});

test("avatarStoragePathFromPublicUrl extracts Supabase public object paths", () => {
  assert.equal(
    avatarStoragePathFromPublicUrl(
      "https://example.supabase.co/storage/v1/object/public/avatars/user-id/avatar-one.png?v=1",
    ),
    "user-id/avatar-one.png",
  );
  assert.equal(
    avatarStoragePathFromPublicUrl(
      "https://example.supabase.co/storage/v1/render/image/public/avatars/user-id/avatar-two.jpg",
    ),
    "user-id/avatar-two.jpg",
  );
  assert.equal(avatarStoragePathFromPublicUrl("https://example.com/avatar.png"), null);
  assert.equal(avatarStoragePathFromPublicUrl("not a url"), null);
});
