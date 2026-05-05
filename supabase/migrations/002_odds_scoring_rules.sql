alter table public.matches
add column if not exists phase text;

alter table public.match_results
add column if not exists home_penalties integer check (home_penalties >= 0),
add column if not exists away_penalties integer check (away_penalties >= 0),
add column if not exists resolution text not null default 'regular'
  check (resolution in ('regular', 'extra_time', 'penalties'));

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'match_results_penalties_required'
  ) then
    alter table public.match_results
    add constraint match_results_penalties_required
    check (
      resolution <> 'penalties'
      or (home_penalties is not null and away_penalties is not null)
    );
  end if;
end;
$$;

create table if not exists public.match_odds_snapshots (
  match_id uuid primary key references public.matches(id) on delete cascade,
  odds_event_id text not null,
  source text not null default 'the-odds-api',
  bookmaker_count integer not null default 0 check (bookmaker_count >= 0),
  home_win_probability numeric(8, 7) check (home_win_probability between 0 and 1),
  draw_probability numeric(8, 7) check (draw_probability between 0 and 1),
  away_win_probability numeric(8, 7) check (away_win_probability between 0 and 1),
  captured_at timestamptz not null default now()
);

alter table public.scoring_settings
add column if not exists base_min_points integer not null default 5 check (base_min_points >= 0),
add column if not exists base_max_points integer not null default 20 check (base_max_points >= 0),
add column if not exists base_floor_probability numeric(5, 4) not null default 0.15
  check (base_floor_probability between 0 and 1),
add column if not exists base_ceiling_probability numeric(5, 4) not null default 0.90
  check (base_ceiling_probability between 0 and 1),
add column if not exists exact_score_bonus_points integer not null default 5
  check (exact_score_bonus_points >= 0),
add column if not exists winner_goals_bonus_points integer not null default 3
  check (winner_goals_bonus_points >= 0),
add column if not exists goal_difference_bonus_points integer not null default 2
  check (goal_difference_bonus_points >= 0),
add column if not exists loser_goals_bonus_points integer not null default 1
  check (loser_goals_bonus_points >= 0),
add column if not exists rout_bonus_points integer not null default 1
  check (rout_bonus_points >= 0),
add column if not exists extra_time_bonus_points integer not null default 3
  check (extra_time_bonus_points >= 0),
add column if not exists penalties_bonus_points integer not null default 3
  check (penalties_bonus_points >= 0);

alter table public.match_odds_snapshots enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'match_odds_snapshots'
      and policyname = 'match_odds_snapshots_select_authenticated'
  ) then
    create policy match_odds_snapshots_select_authenticated
    on public.match_odds_snapshots for select
    to authenticated
    using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'match_odds_snapshots'
      and policyname = 'match_odds_snapshots_write_admin'
  ) then
    create policy match_odds_snapshots_write_admin
    on public.match_odds_snapshots for all
    to authenticated
    using (public.is_global_admin())
    with check (public.is_global_admin());
  end if;
end;
$$;

drop view if exists public.leaderboard_entries;

create view public.leaderboard_entries
with (security_invoker = true)
as
with prediction_inputs as (
  select
    predictions.group_id,
    predictions.user_id,
    predictions.match_id,
    predictions.home_goals as prediction_home_goals,
    predictions.away_goals as prediction_away_goals,
    match_results.home_goals as result_home_goals,
    match_results.away_goals as result_away_goals,
    match_results.home_penalties,
    match_results.away_penalties,
    match_results.resolution,
    scoring_settings.*,
    case
      when predictions.home_goals > predictions.away_goals then 'home'
      when predictions.away_goals > predictions.home_goals then 'away'
      else null
    end as predicted_winner,
    case
      when match_results.resolution = 'penalties'
        and match_results.home_penalties > match_results.away_penalties
        then 'home'
      when match_results.resolution = 'penalties'
        and match_results.away_penalties > match_results.home_penalties
        then 'away'
      when match_results.home_goals > match_results.away_goals then 'home'
      when match_results.away_goals > match_results.home_goals then 'away'
      else null
    end as result_winner,
    match_odds_snapshots.home_win_probability,
    match_odds_snapshots.away_win_probability
  from public.predictions
  join public.match_results on match_results.match_id = predictions.match_id
  cross join public.scoring_settings
  left join public.match_odds_snapshots on match_odds_snapshots.match_id = predictions.match_id
  where scoring_settings.id = true
),
prediction_features as (
  select
    prediction_inputs.*,
    (
      prediction_home_goals = result_home_goals
      and prediction_away_goals = result_away_goals
    ) as exact_score,
    (
      predicted_winner is not null
      and result_winner is not null
      and predicted_winner = result_winner
    ) as correct_winner,
    case
      when predicted_winner = 'home' then home_win_probability
      when predicted_winner = 'away' then away_win_probability
      else null
    end as picked_probability,
    case
      when predicted_winner = 'home' then prediction_home_goals
      when predicted_winner = 'away' then prediction_away_goals
      else null
    end as prediction_winner_goals,
    case
      when predicted_winner = 'home' then prediction_away_goals
      when predicted_winner = 'away' then prediction_home_goals
      else null
    end as prediction_loser_goals,
    case
      when predicted_winner = 'home' then result_home_goals
      when predicted_winner = 'away' then result_away_goals
      else null
    end as result_winner_goals,
    case
      when predicted_winner = 'home' then result_away_goals
      when predicted_winner = 'away' then result_home_goals
      else null
    end as result_loser_goals
  from prediction_inputs
),
prediction_scores as (
  select
    group_id,
    user_id,
    match_id,
    exact_score,
    correct_winner,
    case
      when not correct_winner then 0
      when picked_probability is null then base_min_points
      else round(
        (
          base_max_points
          - (
            (
              least(
                greatest(
                  picked_probability,
                  least(base_floor_probability, base_ceiling_probability)
                ),
                greatest(base_floor_probability, base_ceiling_probability)
              )
              - least(base_floor_probability, base_ceiling_probability)
            )
            / nullif(abs(base_ceiling_probability - base_floor_probability), 0)
          )
          * (base_max_points - base_min_points)
        )::numeric
      )::integer
    end as base_points,
    (
      case when exact_score then exact_score_bonus_points else 0 end
      + case
        when not exact_score and correct_winner and prediction_winner_goals = result_winner_goals
        then winner_goals_bonus_points
        else 0
      end
      + case
        when not exact_score
          and correct_winner
          and abs(prediction_home_goals - prediction_away_goals)
            = abs(result_home_goals - result_away_goals)
        then goal_difference_bonus_points
        else 0
      end
      + case
        when not exact_score and correct_winner and prediction_loser_goals = result_loser_goals
        then loser_goals_bonus_points
        else 0
      end
      + case
        when correct_winner and prediction_winner_goals >= 4 and result_winner_goals >= 4
        then rout_bonus_points
        else 0
      end
      + case
        when correct_winner and resolution = 'extra_time' then extra_time_bonus_points
        else 0
      end
      + case
        when correct_winner and resolution = 'penalties' then penalties_bonus_points
        else 0
      end
    ) as bonus_points
  from prediction_features
)
select
  group_memberships.group_id,
  group_memberships.user_id,
  profiles.display_name,
  group_memberships.joined_at,
  coalesce(sum(prediction_scores.base_points + prediction_scores.bonus_points), 0)::integer as total_points,
  coalesce(sum(prediction_scores.base_points), 0)::integer as base_points,
  coalesce(sum(prediction_scores.bonus_points), 0)::integer as bonus_points,
  coalesce(sum(prediction_scores.exact_score::integer), 0)::integer as exact_score_count,
  coalesce(sum(prediction_scores.correct_winner::integer), 0)::integer as winner_count
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
