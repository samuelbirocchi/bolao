create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  is_global_admin boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 80),
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.group_memberships (
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create table public.invite_codes (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  code text not null unique,
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  fifa_code text unique,
  name text not null unique,
  group_name text,
  created_at timestamptz not null default now()
);

create table public.matches (
  id uuid primary key default gen_random_uuid(),
  match_number integer not null unique check (match_number > 0),
  round text not null,
  group_name text,
  home_team_id uuid references public.teams(id),
  away_team_id uuid references public.teams(id),
  home_team_name text not null,
  away_team_name text not null,
  home_team_placeholder text,
  away_team_placeholder text,
  stadium text,
  kickoff_utc timestamptz not null,
  status text not null default 'scheduled' check (status in ('scheduled', 'live', 'completed', 'postponed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.predictions (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  match_id uuid not null references public.matches(id) on delete cascade,
  home_goals integer not null check (home_goals >= 0),
  away_goals integer not null check (away_goals >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (group_id, user_id, match_id)
);

create table public.match_results (
  match_id uuid primary key references public.matches(id) on delete cascade,
  home_goals integer not null check (home_goals >= 0),
  away_goals integer not null check (away_goals >= 0),
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);

create table public.scoring_settings (
  id boolean primary key default true check (id),
  exact_score_points integer not null default 5 check (exact_score_points >= 0),
  team_goal_points integer not null default 1 check (team_goal_points >= 0),
  outcome_points integer not null default 2 check (outcome_points >= 0),
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);

insert into public.scoring_settings (id, exact_score_points, team_goal_points, outcome_points)
values (true, 5, 1, 2)
on conflict (id) do nothing;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger matches_set_updated_at
before update on public.matches
for each row execute function public.set_updated_at();

create trigger predictions_set_updated_at
before update on public.predictions
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.is_global_admin(user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = user_id
      and is_global_admin = true
  );
$$;

create or replace function public.is_group_member(target_group_id uuid, target_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.group_memberships
    where group_id = target_group_id
      and user_id = target_user_id
  );
$$;

create or replace function public.is_group_owner(target_group_id uuid, target_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.group_memberships
    where group_id = target_group_id
      and user_id = target_user_id
      and role = 'owner'
  );
$$;

create or replace function public.match_accepts_predictions(target_match_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.matches
    where id = target_match_id
      and kickoff_utc > now()
  );
$$;

alter table public.profiles enable row level security;
alter table public.groups enable row level security;
alter table public.group_memberships enable row level security;
alter table public.invite_codes enable row level security;
alter table public.teams enable row level security;
alter table public.matches enable row level security;
alter table public.predictions enable row level security;
alter table public.match_results enable row level security;
alter table public.scoring_settings enable row level security;

create policy profiles_select_authenticated
on public.profiles for select
to authenticated
using (true);

create policy profiles_update_own
on public.profiles for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

create policy groups_select_member
on public.groups for select
to authenticated
using (public.is_group_member(id) or public.is_global_admin());

create policy groups_insert_authenticated
on public.groups for insert
to authenticated
with check (created_by = auth.uid());

create policy groups_update_owner
on public.groups for update
to authenticated
using (public.is_group_owner(id) or public.is_global_admin())
with check (public.is_group_owner(id) or public.is_global_admin());

create policy group_memberships_select_member
on public.group_memberships for select
to authenticated
using (public.is_group_member(group_id) or user_id = auth.uid() or public.is_global_admin());

create policy group_memberships_insert_self
on public.group_memberships for insert
to authenticated
with check (
  user_id = auth.uid()
  and (
    (
      role = 'owner'
      and exists (
        select 1
        from public.groups
        where groups.id = group_memberships.group_id
          and groups.created_by = auth.uid()
      )
    )
    or (
      role = 'member'
      and exists (
        select 1
        from public.invite_codes
        where invite_codes.group_id = group_memberships.group_id
          and invite_codes.revoked_at is null
      )
    )
  )
);

create policy group_memberships_update_owner
on public.group_memberships for update
to authenticated
using (public.is_group_owner(group_id) or public.is_global_admin())
with check (public.is_group_owner(group_id) or public.is_global_admin());

create policy invite_codes_select_active
on public.invite_codes for select
to authenticated
using (revoked_at is null or public.is_group_owner(group_id) or public.is_global_admin());

create policy invite_codes_insert_owner
on public.invite_codes for insert
to authenticated
with check (
  created_by = auth.uid()
  and (public.is_group_owner(group_id) or public.is_global_admin())
);

create policy invite_codes_update_owner
on public.invite_codes for update
to authenticated
using (public.is_group_owner(group_id) or public.is_global_admin())
with check (public.is_group_owner(group_id) or public.is_global_admin());

create policy teams_select_authenticated
on public.teams for select
to authenticated
using (true);

create policy teams_write_admin
on public.teams for all
to authenticated
using (public.is_global_admin())
with check (public.is_global_admin());

create policy matches_select_authenticated
on public.matches for select
to authenticated
using (true);

create policy matches_write_admin
on public.matches for all
to authenticated
using (public.is_global_admin())
with check (public.is_global_admin());

create policy predictions_select_member
on public.predictions for select
to authenticated
using (public.is_group_member(group_id) or public.is_global_admin());

create policy predictions_insert_own_before_kickoff
on public.predictions for insert
to authenticated
with check (
  user_id = auth.uid()
  and public.is_group_member(group_id)
  and public.match_accepts_predictions(match_id)
);

create policy predictions_update_own_before_kickoff
on public.predictions for update
to authenticated
using (
  user_id = auth.uid()
  and public.is_group_member(group_id)
  and public.match_accepts_predictions(match_id)
)
with check (
  user_id = auth.uid()
  and public.is_group_member(group_id)
  and public.match_accepts_predictions(match_id)
);

create policy match_results_select_authenticated
on public.match_results for select
to authenticated
using (true);

create policy match_results_write_admin
on public.match_results for all
to authenticated
using (public.is_global_admin())
with check (public.is_global_admin());

create policy scoring_settings_select_authenticated
on public.scoring_settings for select
to authenticated
using (true);

create policy scoring_settings_write_admin
on public.scoring_settings for all
to authenticated
using (public.is_global_admin())
with check (public.is_global_admin());

create or replace view public.leaderboard_entries
with (security_invoker = true)
as
with prediction_scores as (
  select
    predictions.group_id,
    predictions.user_id,
    predictions.match_id,
    (
      predictions.home_goals = match_results.home_goals
      and predictions.away_goals = match_results.away_goals
    ) as exact_score,
    (
      sign(predictions.home_goals - predictions.away_goals)
      = sign(match_results.home_goals - match_results.away_goals)
    ) as correct_outcome,
    (
      (predictions.home_goals = match_results.home_goals)::integer
      + (predictions.away_goals = match_results.away_goals)::integer
    ) as team_goal_count,
    case
      when (
        predictions.home_goals = match_results.home_goals
        and predictions.away_goals = match_results.away_goals
      )
      then scoring_settings.exact_score_points
      else
        (
          (
            (predictions.home_goals = match_results.home_goals)::integer
            + (predictions.away_goals = match_results.away_goals)::integer
          ) * scoring_settings.team_goal_points
        )
        + (
          case
            when sign(predictions.home_goals - predictions.away_goals)
              = sign(match_results.home_goals - match_results.away_goals)
            then scoring_settings.outcome_points
            else 0
          end
        )
    end as points
  from public.predictions
  join public.match_results on match_results.match_id = predictions.match_id
  cross join public.scoring_settings
  where scoring_settings.id = true
)
select
  group_memberships.group_id,
  group_memberships.user_id,
  profiles.display_name,
  group_memberships.joined_at,
  coalesce(sum(prediction_scores.points), 0)::integer as total_points,
  coalesce(sum(prediction_scores.exact_score::integer), 0)::integer as exact_score_count,
  coalesce(sum(prediction_scores.correct_outcome::integer), 0)::integer as outcome_count,
  coalesce(sum(prediction_scores.team_goal_count), 0)::integer as team_goal_count
from public.group_memberships
join public.profiles on profiles.id = group_memberships.user_id
left join prediction_scores
  on prediction_scores.group_id = group_memberships.group_id
  and prediction_scores.user_id = group_memberships.user_id
group by
  group_memberships.group_id,
  group_memberships.user_id,
  profiles.display_name,
  group_memberships.joined_at;
