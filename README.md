# Bolao

PWA-first World Cup sweepstakes app for private groups of friends.

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

4. Run `supabase/migrations/001_initial_schema.sql` in Supabase.

5. Make your first admin after signing in:

   ```sql
   update public.profiles
   set is_global_admin = true
   where id = '<your-user-id>';
   ```

6. Optional fixture sync:

   - Request a key from `https://www.wc2026api.com/`
   - Set `WC2026_API_KEY`
   - Use `/admin/matches` to sync matches

## Scoring

Global admins configure weights in `/admin/scoring`.

Default scoring:

- Exact score: `5`
- Correct team goals: `1` per team
- Correct outcome: `2`

Exact score uses the exact-score weight as the full match score. Non-exact predictions can earn team-goal and outcome points.
