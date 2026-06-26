"use client";

import { useState } from "react";
import type { LiveMatchCriterion } from "@/lib/liveMatch";
import { RankingChart, type RankingChartLine, type RankingChartStep } from "./RankingChart";

export type PlayerMatchEntry = {
  matchId: string;
  label: string;
  matchPoints: number;
  isKnockout: boolean;
  rank: number;
  rankDelta: number;
  predictionHomeGoals: number | null;
  predictionAwayGoals: number | null;
  resultHomeGoals: number | null;
  resultAwayGoals: number | null;
  exact: boolean;
  correctWinner: boolean;
  correctDraw: boolean;
  winnerGoals: boolean;
  goalDifference: boolean;
  loserGoals: boolean;
  routBonus: boolean;
  extraTime: boolean;
  penalties: boolean;
};

type PlayerDetailToggleProps = {
  userId: string;
  maxRank: number;
  matchSteps: RankingChartStep[];
  matchLine: RankingChartLine | null;
  daySteps: RankingChartStep[];
  dayLine: RankingChartLine | null;
  perMatchEntries: PlayerMatchEntry[];
  matchLabel: string;
  dayLabel: string;
  pointsLabel: string;
  emptyLabel: string;
  matchXAxis: string;
  dayXAxis: string;
  tableMatchHeader: string;
  tablePointsHeader: string;
  tableRankHeader: string;
  tableChangeHeader: string;
  tablePredictionHeader: string;
  tableCriteriaHeader: string;
  criteriaLabels: Record<LiveMatchCriterion, string>;
  versusLabel: string;
  noCriteriaLabel: string;
  knockoutBadgeLabel: string;
};

// Mirrors scoreCriteria order in liveMatch.ts so badges read consistently with
// the per-match detail page. Only criteria that actually fired are returned.
function firedCriteria(entry: PlayerMatchEntry): LiveMatchCriterion[] {
  const criteria: LiveMatchCriterion[] = [];
  if (entry.correctWinner) criteria.push("correctWinner");
  if (entry.correctDraw) criteria.push("correctDraw");
  if (entry.winnerGoals) criteria.push("winnerGoals");
  if (entry.goalDifference) criteria.push("goalDifference");
  if (entry.loserGoals) criteria.push("loserGoals");
  if (entry.exact) criteria.push("exactScore");
  if (entry.routBonus) criteria.push("rout");
  if (entry.extraTime) criteria.push("extraTime");
  if (entry.penalties) criteria.push("penalties");
  return criteria;
}

function scoreline(home: number | null, away: number | null, versus: string) {
  if (home === null || away === null) {
    return null;
  }
  return `${home} ${versus} ${away}`;
}

function rankDelta(delta: number) {
  if (delta > 0) {
    return <span className="rank-delta up">▲ {delta}</span>;
  }
  if (delta < 0) {
    return <span className="rank-delta down">▼ {Math.abs(delta)}</span>;
  }
  return <span className="rank-delta flat">–</span>;
}

export function PlayerDetailToggle({
  userId,
  maxRank,
  matchSteps,
  matchLine,
  daySteps,
  dayLine,
  perMatchEntries,
  matchLabel,
  dayLabel,
  pointsLabel,
  emptyLabel,
  matchXAxis,
  dayXAxis,
  tableMatchHeader,
  tablePointsHeader,
  tableRankHeader,
  tableChangeHeader,
  tablePredictionHeader,
  tableCriteriaHeader,
  criteriaLabels,
  versusLabel,
  noCriteriaLabel,
  knockoutBadgeLabel,
}: PlayerDetailToggleProps) {
  const [mode, setMode] = useState<"match" | "day" | "points">("match");

  return (
    <div className="ranking-chart-toggle-wrapper">
      <div className="ranking-chart-toggle" role="group" aria-label="Detail view mode">
        <button
          type="button"
          className={mode === "match" ? "active" : undefined}
          onClick={() => setMode("match")}
          aria-pressed={mode === "match"}
        >
          {matchLabel}
        </button>
        <button
          type="button"
          className={mode === "day" ? "active" : undefined}
          onClick={() => setMode("day")}
          aria-pressed={mode === "day"}
        >
          {dayLabel}
        </button>
        <button
          type="button"
          className={mode === "points" ? "active" : undefined}
          onClick={() => setMode("points")}
          aria-pressed={mode === "points"}
        >
          {pointsLabel}
        </button>
      </div>

      {mode === "match" && (
        <RankingChart
          steps={matchSteps}
          lines={matchLine ? [matchLine] : []}
          currentUserId={userId}
          maxRank={maxRank}
          title={matchLabel}
          emptyLabel={emptyLabel}
          xAxisLabel={matchXAxis}
          singleLine
        />
      )}

      {mode === "day" && (
        <RankingChart
          steps={daySteps}
          lines={dayLine ? [dayLine] : []}
          currentUserId={userId}
          maxRank={maxRank}
          title={dayLabel}
          emptyLabel={emptyLabel}
          xAxisLabel={dayXAxis}
          singleLine
        />
      )}

      {mode === "points" &&
        (perMatchEntries.length > 0
          ? (() => {
              const rows = perMatchEntries.map((entry) => ({
                entry,
                result: scoreline(entry.resultHomeGoals, entry.resultAwayGoals, versusLabel),
                pick: scoreline(entry.predictionHomeGoals, entry.predictionAwayGoals, versusLabel),
                criteria: firedCriteria(entry),
              }));

              const knockoutBadge = (entry: PlayerMatchEntry) =>
                entry.isKnockout ? (
                  <span className="criterion-pill knockout-pill">{knockoutBadgeLabel}</span>
                ) : null;

              const criteriaCell = (criteria: LiveMatchCriterion[]) =>
                criteria.length > 0 ? (
                  <span className="criteria-list">
                    {criteria.map((criterion) => (
                      <span className="criterion-pill" key={criterion}>
                        {criteriaLabels[criterion]}
                      </span>
                    ))}
                  </span>
                ) : (
                  <span className="muted">{noCriteriaLabel}</span>
                );

              return (
                <>
                  {/* Mobile: stacked cards (the 6-column table overflows on phones). */}
                  <ul className="player-points-cards">
                    {rows.map(({ entry, result, pick, criteria }) => (
                      <li className="player-points-card" key={entry.matchId}>
                        <div className="ppc-head">
                          <span className="player-points-match">{entry.label}</span>
                          {knockoutBadge(entry)}
                        </div>
                        {result ? (
                          <span className="player-points-result">{result}</span>
                        ) : null}
                        <dl className="ppc-stats">
                          <div>
                            <dt>{tablePredictionHeader}</dt>
                            <dd>{pick ?? "–"}</dd>
                          </div>
                          <div>
                            <dt>{tablePointsHeader}</dt>
                            <dd>{entry.matchPoints}</dd>
                          </div>
                          <div>
                            <dt>{tableRankHeader}</dt>
                            <dd>{entry.rank}</dd>
                          </div>
                          <div>
                            <dt>{tableChangeHeader}</dt>
                            <dd>{rankDelta(entry.rankDelta)}</dd>
                          </div>
                        </dl>
                        <div className="ppc-criteria">{criteriaCell(criteria)}</div>
                      </li>
                    ))}
                  </ul>

                  {/* Wider viewports: the original table. */}
                  <div className="player-points-scroll">
                    <table className="ranking-table">
                      <thead>
                        <tr>
                          <th>{tableMatchHeader}</th>
                          <th>{tablePredictionHeader}</th>
                          <th>{tablePointsHeader}</th>
                          <th>{tableCriteriaHeader}</th>
                          <th>{tableRankHeader}</th>
                          <th>{tableChangeHeader}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map(({ entry, result, pick, criteria }) => (
                          <tr key={entry.matchId}>
                            <td>
                              <span className="player-points-match">{entry.label}</span>
                              {knockoutBadge(entry)}
                              {result ? (
                                <span className="player-points-result">{result}</span>
                              ) : null}
                            </td>
                            <td>{pick ?? "–"}</td>
                            <td>{entry.matchPoints}</td>
                            <td>{criteriaCell(criteria)}</td>
                            <td>{entry.rank}</td>
                            <td>{rankDelta(entry.rankDelta)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              );
            })()
          : (
            <div className="empty">{emptyLabel}</div>
          ))}
    </div>
  );
}
