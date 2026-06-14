"use client";

import { useState } from "react";

const POINTS_COLLAPSE_HEIGHT = 320;

type PlayerDetailTabsProps = {
  rankingEvolutionLabel: string;
  pointsByGameLabel: string;
  byMatchLabel: string;
  byDayLabel: string;
  showAllLabel: string;
  showLessLabel: string;
  byMatchChart: React.ReactNode;
  byDayChart: React.ReactNode;
  pointsByGame: React.ReactNode;
};

export function PlayerDetailTabs({
  rankingEvolutionLabel,
  pointsByGameLabel,
  byMatchLabel,
  byDayLabel,
  showAllLabel,
  showLessLabel,
  byMatchChart,
  byDayChart,
  pointsByGame,
}: PlayerDetailTabsProps) {
  const [activeTab, setActiveTab] = useState<"evolution" | "points">("evolution");
  const [evolutionSubTab, setEvolutionSubTab] = useState<"match" | "day">("match");
  const [pointsExpanded, setPointsExpanded] = useState(false);

  return (
    <>
      <div className="tabs" role="tablist">
        <button
          role="tab"
          aria-selected={activeTab === "evolution"}
          onClick={() => setActiveTab("evolution")}
          className={activeTab === "evolution" ? "active" : ""}
        >
          {rankingEvolutionLabel}
        </button>
        <button
          role="tab"
          aria-selected={activeTab === "points"}
          onClick={() => setActiveTab("points")}
          className={activeTab === "points" ? "active" : ""}
        >
          {pointsByGameLabel}
        </button>
      </div>

      {activeTab === "evolution" && (
        <>
          <div className="tabs sub-tabs" role="tablist">
            <button
              role="tab"
              aria-selected={evolutionSubTab === "match"}
              onClick={() => setEvolutionSubTab("match")}
              className={evolutionSubTab === "match" ? "active" : ""}
            >
              {byMatchLabel}
            </button>
            <button
              role="tab"
              aria-selected={evolutionSubTab === "day"}
              onClick={() => setEvolutionSubTab("day")}
              className={evolutionSubTab === "day" ? "active" : ""}
            >
              {byDayLabel}
            </button>
          </div>
          {evolutionSubTab === "match" && byMatchChart}
          {evolutionSubTab === "day" && byDayChart}
        </>
      )}

      {activeTab === "points" && (
        <div className="player-points-wrap">
          <div
            className="player-points-scroll"
            style={pointsExpanded ? undefined : { maxHeight: POINTS_COLLAPSE_HEIGHT, overflow: "hidden" }}
          >
            {pointsByGame}
          </div>
          {!pointsExpanded && (
            <button
              type="button"
              className="show-more-btn"
              onClick={() => setPointsExpanded(true)}
            >
              {showAllLabel}
            </button>
          )}
          {pointsExpanded && (
            <button
              type="button"
              className="show-more-btn"
              onClick={() => setPointsExpanded(false)}
            >
              {showLessLabel}
            </button>
          )}
        </div>
      )}
    </>
  );
}
