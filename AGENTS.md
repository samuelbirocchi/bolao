# Repository Guidelines

## Project Structure & Module Organization

This is a Next.js App Router project for a World Cup pool app. Route handlers and pages live in `app/`, including auth, groups, and admin pages. Shared application code lives in `src/lib/` (`actions`, `auth`, `data`, `odds`, `scoring`, Supabase helpers, and WC2026 sync). Reusable UI components live in `src/components/`. Static assets and the service worker are in `public/`. Database migrations are in `supabase/migrations/`. Unit tests currently live beside library code as `src/lib/*.test.mts`.

## Build, Test, and Development Commands

- `npm install` — install dependencies from `package-lock.json`.
- `npm run dev` — start the local Next.js dev server.
- `npm test` — run Node test runner tests in `src/lib/*.test.mts`.
- `npm run typecheck` — run TypeScript with `tsc --noEmit`.
- `npm run lint` — run ESLint with zero warnings allowed.
- `npm run build` — create a production Next.js build.
- `npm run verify` — run tests, typecheck, lint, and build in sequence before release/deploy.

## Coding Style & Naming Conventions

Use TypeScript and React server components by default unless client-side behavior is required. Keep modules small and domain-focused. Follow existing two-space indentation and double-quote string style. Use `PascalCase` for components, `camelCase` for functions and variables, and descriptive action names ending in `Action` for server actions. Prefer existing utilities in `src/lib/` before adding new abstractions or dependencies.

## Testing Guidelines

Use Node’s built-in test runner with `.test.mts` files. Keep tests close to the library code they verify, especially scoring, odds mapping, and data transformation rules. Add or update targeted tests for behavioral changes. Run `npm run verify` before considering a change complete.

## Commit & Pull Request Guidelines

Recent history uses concise, imperative commit subjects such as `Fix scoring thresholds and odds event matching`. Keep commits focused and explain why the change exists. Pull requests should include a clear summary, verification evidence, linked issues when relevant, and screenshots for visible UI changes. Call out migrations, environment-variable changes, or deployment follow-ups explicitly.

## Security & Configuration Tips

Never commit `.env.local`, `.env.vercel`, `.vercel/`, or local orchestration state. Production deployment requires Vercel environment variables listed in `docs/vercel-deployment.md`. Supabase Auth URLs and SMTP settings are configured in the Supabase dashboard; local env files are not uploaded automatically.
