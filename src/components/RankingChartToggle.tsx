"use client";

import { useState } from "react";
import { RankingChart, type RankingChartLine, type RankingChartStep } from "./RankingChart";

type RankingChartToggleProps = {
  matchSteps: RankingChartStep[];
  matchLines: RankingChartLine[];
  daySteps: RankingChartStep[];
  dayLines: RankingChartLine[];
  userId: string;
  maxRank: number;
  matchLabel: string;
  dayLabel: string;
  emptyLabel: string;
  matchXAxis: string;
  dayXAxis: string;
};

export function RankingChartToggle({
  matchSteps,
  matchLines,
  daySteps,
  dayLines,
  userId,
  maxRank,
  matchLabel,
  dayLabel,
  emptyLabel,
  matchXAxis,
  dayXAxis,
}: RankingChartToggleProps) {
  const [mode, setMode] = useState<"match" | "day">("match");

  const steps = mode === "match" ? matchSteps : daySteps;
  const lines = mode === "match" ? matchLines : dayLines;

  return (
    <div className="ranking-chart-toggle-wrapper">
      <div className="ranking-chart-toggle" role="group" aria-label="Chart view mode">
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
      </div>
      <RankingChart
        steps={steps}
        lines={lines}
        currentUserId={userId}
        maxRank={maxRank}
        title={mode === "match" ? matchLabel : dayLabel}
        emptyLabel={emptyLabel}
        xAxisLabel={mode === "match" ? matchXAxis : dayXAxis}
        singleLine
      />
    </div>
  );
}
