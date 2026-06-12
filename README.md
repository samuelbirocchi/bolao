# Bolao

PWA-first World Cup sweepstakes app for private groups of friends.

## Features

- Private invite-only groups
- Email magic-link authentication
- Match predictions locked at kickoff
- Global admin match/result management
- WC2026 fixture sync
- The Odds API pre-kickoff odds snapshots
- Configurable probability-based scoring
- English, Portuguese, and Spanish UI
- Installable PWA shell

## Stack

- Next.js App Router
- Supabase Auth with email magic links
- Supabase Postgres with RLS
- Installable PWA shell

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy environment variables:

   ```bash
   cp .env.example .env.local
   ```

3. Fill `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

4. Apply Supabase migrations in order.

   With the Supabase CLI:

   ```bash
   supabase link --project-ref '<project-ref>'
   supabase db push
   ```

   Or run the SQL files in `supabase/migrations/` manually in order.

   If `001_initial_schema.sql` was already applied manually before the CLI tracked
   it, mark it as applied before running future pushes:

   ```bash
   supabase migration repair 001 --status applied
   ```

5. Make your first admin after signing in:

   ```sql
   update public.profiles
   set is_global_admin = true
   where id = '<your-user-id>';
   ```

6. Optional fixture sync:

   - Request a key from `https://www.wc2026api.com/`
   - Set `WC2026_API_KEY`
   - Use `/admin/matches` to sync matches, phases, extra-time state, and penalties
   - For automatic post-match sync, also set `SUPABASE_SERVICE_ROLE_KEY` and
     `CRON_SECRET`; the checked-in Vercel Hobby schedule calls
     `/api/cron/sync-matches` daily and sends `CRON_SECRET` as the bearer token.
     On Vercel Pro, change `vercel.json` to `*/30 * * * *` for a 30-minute cadence.

7. Optional odds sync:

   - Request a key from `https://the-odds-api.com/`
   - Set `ODDS_API_KEY`
   - Optionally set `ODDS_API_REGIONS` or `ODDS_API_BOOKMAKERS`
   - Use `/admin/matches` to sync frozen pre-kickoff odds

8. Run the app:

   ```bash
   npm run dev
   ```

## Environment

Required:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Optional:

- `NEXT_PUBLIC_SITE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CRON_SECRET`
- `WC2026_API_KEY`
- `WC2026_API_BASE_URL`
- `ODDS_API_KEY`
- `ODDS_API_BASE_URL`
- `ODDS_API_REGIONS`
- `ODDS_API_BOOKMAKERS`

## Scoring

Global admins configure weights in `/admin/scoring`.

Default scoring:

- Correct winner base score: `5` to `20`, based on frozen pre-kickoff win probability
- Exact score bonus: `5`
- Non-exact score-shape bonuses: winner goals `3`, goal difference `2`, loser goals `1`
- Rout bonus: `1`
- Extra-time or penalties winner bonus: `3`

Exact score does not stack with winner-goals, goal-difference, or loser-goals bonuses. It can still stack with rout and extra-time/penalty bonuses.

Base points use the frozen pre-kickoff probability of the picked winner. If odds
are missing for a match, a correct winner falls back to the minimum base score.
Draw predictions do not pick a winner and cannot earn winner/base/extra-time
points.

## Admin Workflow

1. Sign in and mark your profile as a global admin.
2. Open `/admin/matches`.
3. Sync WC2026 fixtures.
4. Sync odds before matches start.
5. Enter or sync final scores, resolution, and penalty shootout scores.
6. Tune scoring weights in `/admin/scoring`.

## Vercel Deployment

See [`docs/vercel-deployment.md`](docs/vercel-deployment.md) for the production Vercel import settings, required environment variables, deploy flow, and smoke-test checklist.

## Verification

```bash
npm test
npm run typecheck
npm run lint
npm run build
npm run e2e
npm run verify
```

`npm run e2e` runs the Playwright smoke suite against a local Next.js dev
server. Before the first local run, install the browser binary with:

```bash
npx playwright install chromium
```

Automation-created PRs should include `npm run verify` evidence. If browser
installation or local runtime prerequisites are unavailable, do not open the PR
until `npm run e2e` can run successfully.
