-- Gravatar fallback for ranking photos.
--
-- Most players never upload an avatar in Settings, so avatar_url is null and the
-- ranking falls back to initials. Login is email/magic-link only (no OAuth), so
-- there is no provider photo either. To still show a real photo, derive a
-- Gravatar identifier from the user's email and expose it on the profile.
--
-- We store md5(lower(trim(email))) — the standard Gravatar identifier — rather
-- than the raw email, so member emails are never exposed through the
-- security_invoker leaderboard view. The UI builds the Gravatar URL with
-- d=404 and falls back to initials when no Gravatar exists.

alter table public.profiles
  add column if not exists gravatar_hash text;

-- Backfill existing profiles from their auth.users email.
update public.profiles p
set gravatar_hash = md5(lower(trim(u.email)))
from auth.users u
where u.id = p.id
  and u.email is not null
  and length(trim(u.email)) > 0
  and p.gravatar_hash is null;

-- Populate gravatar_hash for new signups alongside display_name.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, gravatar_hash)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    case
      when new.email is not null and length(trim(new.email)) > 0
        then md5(lower(trim(new.email)))
      else null
    end
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

-- Recreate leaderboard_entries to expose gravatar_hash. Body is identical to
-- 008_prediction_scores_enrich.sql with profiles.gravatar_hash added to the
-- select list and group by.
drop view if exists public.leaderboard_entries;
create view public.leaderboard_entries
with (security_invoker = true)
as
select
  group_memberships.group_id,
  group_memberships.user_id,
  profiles.display_name,
  profiles.avatar_url,
  profiles.gravatar_hash,
  group_memberships.joined_at,
  coalesce(sum(match_prediction_scores.base_points + match_prediction_scores.bonus_points), 0)::integer as total_points,
  coalesce(sum(match_prediction_scores.base_points), 0)::integer as base_points,
  coalesce(sum(match_prediction_scores.bonus_points), 0)::integer as bonus_points,
  coalesce(sum(match_prediction_scores.exact_score::integer), 0)::integer as exact_score_count,
  coalesce(sum((match_prediction_scores.correct_winner or match_prediction_scores.correct_draw)::integer), 0)::integer as winner_count
from public.group_memberships
join public.profiles on profiles.id = group_memberships.user_id
left join public.match_prediction_scores
  on match_prediction_scores.group_id = group_memberships.group_id
  and match_prediction_scores.user_id = group_memberships.user_id
group by
  group_memberships.group_id,
  group_memberships.user_id,
  profiles.display_name,
  profiles.avatar_url,
  profiles.gravatar_hash,
  group_memberships.joined_at;
