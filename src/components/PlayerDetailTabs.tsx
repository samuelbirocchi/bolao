"use client";

import { useState } from "react";

type PlayerDetailTabsProps = {
  rankingEvolutionLabel: string;
  pointsByGameLabel: string;
  rankingEvolution: React.ReactNode;
  pointsByGame: React.ReactNode;
};

export function PlayerDetailTabs({
  rankingEvolutionLabel,
  pointsByGameLabel,
  rankingEvolution,
  pointsByGame,
}: PlayerDetailTabsProps) {
  const [activeTab, setActiveTab] = useState<"evolution" | "points">("evolution");

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

      {activeTab === "evolution" && rankingEvolution}
      {activeTab === "points" && pointsByGame}
    </>
  );
}
