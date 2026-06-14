"use client";

import { useState } from "react";

type RankingEvolutionTabsProps = {
  byMatchLabel: string;
  byDayLabel: string;
  byMatchContent: React.ReactNode;
  byDayContent: React.ReactNode;
};

export function RankingEvolutionTabs({
  byMatchLabel,
  byDayLabel,
  byMatchContent,
  byDayContent,
}: RankingEvolutionTabsProps) {
  const [activeTab, setActiveTab] = useState<"match" | "day">("match");

  return (
    <div className="ranking-evolution-tabs">
      <div className="tab-buttons" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "match"}
          className={activeTab === "match" ? "tab-btn active" : "tab-btn"}
          onClick={() => setActiveTab("match")}
        >
          {byMatchLabel}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "day"}
          className={activeTab === "day" ? "tab-btn active" : "tab-btn"}
          onClick={() => setActiveTab("day")}
        >
          {byDayLabel}
        </button>
      </div>
      <div role="tabpanel">
        {activeTab === "match" ? byMatchContent : byDayContent}
      </div>
    </div>
  );
}
