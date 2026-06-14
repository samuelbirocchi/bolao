import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { configuredSiteOriginFromEnv, normalizeOrigin } from "./siteOrigin.ts";

describe("normalizeOrigin", () => {
  it("trims whitespace and trailing slashes", () => {
    assert.equal(normalizeOrigin(" https://example.com/// "), "https://example.com");
  });
});

describe("configuredSiteOriginFromEnv", () => {
  it("uses the explicitly configured site URL first", () => {
    assert.equal(
      configuredSiteOriginFromEnv({
        NEXT_PUBLIC_SITE_URL: "https://custom.example.com/",
        VERCEL_ENV: "preview",
        VERCEL_PROJECT_PRODUCTION_URL: "bolao.example.com",
        VERCEL_URL: "bolao-preview.vercel.app",
      }),
      "https://custom.example.com",
    );
  });

  it("uses the deployment URL for preview deployments", () => {
    assert.equal(
      configuredSiteOriginFromEnv({
        VERCEL_ENV: "preview",
        VERCEL_PROJECT_PRODUCTION_URL: "bolao.example.com",
        VERCEL_URL: "bolao-preview.vercel.app",
      }),
      "https://bolao-preview.vercel.app",
    );
  });

  it("uses the production URL for production deployments", () => {
    assert.equal(
      configuredSiteOriginFromEnv({
        VERCEL_ENV: "production",
        VERCEL_PROJECT_PRODUCTION_URL: "bolao.example.com",
        VERCEL_URL: "bolao-production-hash.vercel.app",
      }),
      "https://bolao.example.com",
    );
  });
});
