-- Fix the draw-scoring divergence (closes #46 and #47).
--
-- The per-match detail page scores draws correctly via TS (src/lib/scoring.ts),
-- but the general standings read match_prediction_scores (defined in 004). That
-- view had NO concept of a correct draw: predicted_winner is null for a draw
-- pick and result_winner is null for a draw result, so correct_winner was always
-- false for draws, base_points short-circuited to 0, draw_probability was never
-- used, and correct_draw was never emitted. leaderboard_entries and the ranking
-- timeline therefore dropped every correct-draw point.
--
-- This migration drops and recreates both views in dependency order
-- (leaderboard_entries depends on match_prediction_scores), porting scoring.ts
-- byte-for-byte for draws:
--   * correct_draw = (predicted_winner is null AND result_winner is null)
--   * picked_probability uses draw_probability when the pick is a draw
--   * base_points is awarded when (correct_winner OR correct_draw), with the
--     missing-odds fallback to base_min_points (mirrors calculateBasePoints)
--   * goal_difference/extra_time/penalties bonuses fire on (correct_winner OR
--     correct_draw); winner_goals/loser_goals/rout stay winner-only
--   * correct_draw is emitted in the final SELECT
-- leaderboard_entries' output columns stay BYTE-IDENTICAL; correct draws are
-- aggregated into base_points (already summed from the view) and winner_count.

drop view if exists public.leaderboard_entries;
drop view if exists public.match_prediction_scores;

create view public.match_prediction_scores
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
    match_odds_snapshots.draw_probability,
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
    (
      predicted_winner is null
      and result_winner is null
    ) as correct_draw,
    case
      when predicted_winner = 'home' then home_win_probability
      when predicted_winner = 'away' then away_win_probability
      else draw_probability
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
    correct_draw,
    case
      when not (correct_winner or correct_draw) then 0
      when picked_probability is null then base_min_points
      -- Mirrors calculateBasePoints (scoring.ts): a zero-width probability
      -- band has no gradient, so fall back to base_min_points instead of
      -- dividing by zero (the nullif below would otherwise yield null).
      when base_floor_probability = base_ceiling_probability then base_min_points
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
          and (correct_winner or correct_draw)
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
        when (correct_winner or correct_draw) and resolution = 'extra_time' then extra_time_bonus_points
        else 0
      end
      + case
        when (correct_winner or correct_draw) and resolution = 'penalties' then penalties_bonus_points
        else 0
      end
    ) as bonus_points
  from prediction_features
)
select
  group_id,
  user_id,
  match_id,
  base_points,
  bonus_points,
  exact_score,
  correct_winner,
  correct_draw
from prediction_scores;

create view public.leaderboard_entries
with (security_invoker = true)
as
select
  group_memberships.group_id,
  group_memberships.user_id,
  profiles.display_name,
  profiles.avatar_url,
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
  group_memberships.joined_at;
