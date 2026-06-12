type SiteOriginEnv = Partial<
  Record<"NEXT_PUBLIC_SITE_URL" | "VERCEL_ENV" | "VERCEL_PROJECT_PRODUCTION_URL" | "VERCEL_URL", string>
>;

export function normalizeOrigin(origin: string) {
  return origin.trim().replace(/\/+$/, "");
}

export function configuredSiteOriginFromEnv(env: SiteOriginEnv) {
  const configured = env.NEXT_PUBLIC_SITE_URL?.trim();

  if (configured) {
    return normalizeOrigin(configured);
  }

  const vercelDeploymentUrl = env.VERCEL_URL?.trim();

  if (env.VERCEL_ENV !== "production" && vercelDeploymentUrl) {
    return normalizeOrigin(`https://${vercelDeploymentUrl}`);
  }

  const vercelProductionUrl = env.VERCEL_PROJECT_PRODUCTION_URL?.trim();

  if (vercelProductionUrl) {
    return normalizeOrigin(`https://${vercelProductionUrl}`);
  }

  if (vercelDeploymentUrl) {
    return normalizeOrigin(`https://${vercelDeploymentUrl}`);
  }

  return null;
}
