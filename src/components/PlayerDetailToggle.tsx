"use client";

import { useState } from "react";
import { RankingChart, type RankingChartLine, type RankingChartStep } from "./RankingChart";

export type PlayerMatchEntry = {
  matchId: string;
  label: string;
  matchPoints: number;
  rank: number;
  rankDelta: number;
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
};

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
        (perMatchEntries.length > 0 ? (
          <div className="player-points-scroll">
            <table className="ranking-table">
              <thead>
                <tr>
                  <th>{tableMatchHeader}</th>
                  <th>{tablePointsHeader}</th>
                  <th>{tableRankHeader}</th>
                  <th>{tableChangeHeader}</th>
                </tr>
              </thead>
              <tbody>
                {perMatchEntries.map((entry) => (
                  <tr key={entry.matchId}>
                    <td>{entry.label}</td>
                    <td>{entry.matchPoints}</td>
                    <td>{entry.rank}</td>
                    <td>{rankDelta(entry.rankDelta)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty">{emptyLabel}</div>
        ))}
    </div>
  );
}
