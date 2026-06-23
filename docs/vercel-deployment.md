# Vercel Deployment

This app is ready to deploy as a standard Next.js project on Vercel. Supabase is
assumed to be configured already; Vercel only needs the repository, environment
variables, a successful build, and production smoke tests.

## Import the project

1. Import this Git repository into Vercel.
2. Keep the default Next.js settings:
   - Framework Preset: `Next.js`
   - Root Directory: repository root
   - Install Command: `npm install`
   - Build Command: `npm run build`
   - Output Directory: Vercel default

## Production environment variables

Local `.env.local` values are not uploaded by Vercel deploys, and `vercel env pull` only copies values from Vercel down to a local file. Add the production values in the dashboard or with `vercel env add <NAME> production`, then redeploy.

Add these variables in Vercel for the **Production** environment:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_SITE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CRON_SECRET`
- `WC2026_API_KEY`
- `WC2026_API_BASE_URL`
- `ODDS_API_KEY`
- `ODDS_API_BASE_URL`
- `ODDS_API_REGIONS`

Do not add `ODDS_API_BOOKMAKERS` unless production should filter odds by specific
bookmakers. If it is omitted, the app requests odds by region.

Set `NEXT_PUBLIC_SITE_URL` to the production Vercel URL or custom domain, not to
`localhost`. Magic-link callbacks prefer this value over the request origin so
production emails do not accidentally inherit a local development origin. Because
`NEXT_PUBLIC_*` values are embedded at build time, redeploy after changing either
public variable.

`SUPABASE_SERVICE_ROLE_KEY` is used by the service-side scheduler and manual
cron route so they can write match fixtures, final results, and odds snapshots
without an interactive admin session. Keep it secret and never expose it with a
`NEXT_PUBLIC_` prefix. `CRON_SECRET` only protects the manual
`/api/cron/sync-matches` endpoint for external invocations. If `ODDS_API_KEY` is
also set, the service-side scheduler automatically syncs pre-kickoff odds.

## Preview environment variables

Review branches use the production Supabase project so feature previews exercise
the same auth, RLS policies, and data shape as production. Add these variables
in Vercel for the **Preview** environment, scoped to all preview branches:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Do not set `NEXT_PUBLIC_SITE_URL` in Preview; magic-link callbacks should use the
current deployment URL from `VERCEL_URL`, not the production domain. Keep
server-only production secrets such as `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`,
and third-party API keys out of Preview unless a review deployment explicitly
needs that capability and the production-data risk is accepted.

## Local pre-deploy verification

Run the same checks before the first production deploy and before major release
redeploys:

```bash
npm test
npm run typecheck
npm run lint
npm run build
npm run e2e
```

Before the first local e2e run, install the Playwright browser binary:

```bash
npx playwright install chromium
```

`npm run verify` runs this full sequence, including the Playwright smoke test.
Automation-created PRs should only be opened after `npm run verify` passes, or
after explicitly documenting why the e2e prerequisite cannot run.

## Deploy flow

1. Verify locally with the commands above.
2. Push the selected branch to the Git provider connected to Vercel.
3. Trigger or promote a Vercel production deployment.
4. Redeploy if any Vercel environment variable changed after the previous build.
5. Add a custom domain only after the first successful deployment, then update
   `NEXT_PUBLIC_SITE_URL` and redeploy.

## Production smoke test

After deployment, open the production URL and verify:

- The landing page loads.
- Magic-link login sends an email.
- The auth callback returns to `/groups`.
- Group list and individual group pages load.
- Admin pages load for the promoted global admin user.
- WC2026 sync runs from `/admin/matches`.
- Post-match WC2026 sync runs every 15 minutes from the service-side scheduler.
- The manual cron endpoint runs from `/api/cron/sync-matches` when called with
  `Authorization: Bearer <CRON_SECRET>`.
- Odds sync runs from `/admin/matches`.

## Supabase assumptions

This deployment guide assumes the Supabase project, migrations, auth settings,
and first global admin user are already configured.
