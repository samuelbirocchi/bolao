"use client";

import { useState } from "react";

type PlayerDetailTabsProps = {
  rankingEvolutionLabel: string;
  pointsByGameLabel: string;
  byMatchLabel: string;
  byDayLabel: string;
  byMatchChart: React.ReactNode;
  byDayChart: React.ReactNode;
  pointsByGame: React.ReactNode;
};

export function PlayerDetailTabs({
  rankingEvolutionLabel,
  pointsByGameLabel,
  byMatchLabel,
  byDayLabel,
  byMatchChart,
  byDayChart,
  pointsByGame,
}: PlayerDetailTabsProps) {
  const [activeTab, setActiveTab] = useState<"evolution" | "points">("evolution");
  const [evolutionSubTab, setEvolutionSubTab] = useState<"match" | "day">("match");

  return (
    <>
      <div className="player-detail-sticky">
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
        )}
      </div>

      {activeTab === "evolution" && (
        <div className="player-chart-scroll">
          {evolutionSubTab === "match" && byMatchChart}
          {evolutionSubTab === "day" && byDayChart}
        </div>
      )}

      {activeTab === "points" && pointsByGame}
    </>
  );
}
