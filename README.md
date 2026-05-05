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

7. Optional odds sync:

   - Request a key from `https://the-odds-api.com/`
   - Set `ODDS_API_KEY`
   - Use `/admin/matches` to sync pre-kickoff odds

## Scoring

Global admins configure weights in `/admin/scoring`.

Default scoring:

- Correct winner base score: `5` to `20`, based on frozen pre-kickoff win probability
- Exact score bonus: `5`
- Non-exact score-shape bonuses: winner goals `3`, goal difference `2`, loser goals `1`
- Rout bonus: `1`
- Extra-time or penalties winner bonus: `3`

Exact score does not stack with winner-goals, goal-difference, or loser-goals bonuses. It can still stack with rout and extra-time/penalty bonuses.
