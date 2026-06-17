# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Verification

Run `npm run verify` (test → typecheck → lint → build) before claiming a change is done. ESLint is set to `--max-warnings=0`; warnings break the build.

## Tests

Tests are `.test.mts` files using Node's built-in test runner with `--experimental-strip-types`. Do not introduce Jest, Vitest, or any other runner. Tests live next to the code they cover (e.g. `src/lib/scoring.test.mts`).

## Server actions

All mutations live in `src/lib/actions.ts` with the `*Action` suffix. Every action must call `requireUser()` or `requireGlobalAdmin()` from `src/lib/auth.ts` before doing work, and `revalidatePath()` after writes. Reuse the FormData helpers already in `actions.ts` (`readString`, `readInteger`, `readProbability`) — don't roll new ones.

## Scoring rules (don't break these)

`src/lib/scoring.ts`, configurable via `/admin/scoring`:

- Base score (5–20) comes from the frozen pre-kickoff win probability. Missing odds → minimum base score.
- Exact-score bonus does **NOT** stack with winner-goals, goal-difference, or loser-goals bonuses. It still stacks with rout and extra-time/penalty bonuses.
- Draw predictions earn base points from the frozen draw probability (migration 006). A correct draw can also earn the goal-difference and extra-time/penalty bonuses, but not the winner-goals, loser-goals, or rout bonuses (no winner picked).

## Odds

Odds are **frozen** at kickoff. `src/lib/odds.ts` snapshots The Odds API once per match; scoring reads the snapshot, never live odds.

## i18n

Translation strings live in `src/lib/i18n.ts`. Every key must have `en`, `pt-BR`, and `es` entries. Locale is read from a cookie by helpers in `src/lib/i18n/`.

## Database

Supabase Postgres with RLS. Migrations in `supabase/migrations/` are applied in numeric prefix order — add a new file, never edit an existing one.

## Build-time env gotcha

`NEXT_PUBLIC_SITE_URL` (and any `NEXT_PUBLIC_*` var) is baked into the bundle at build time. Changing it in Vercel without redeploying leaves the old value live. Production env list and smoke tests are in `docs/vercel-deployment.md`.

## Path alias

`@/*` → `src/*` (see `tsconfig.json`).
