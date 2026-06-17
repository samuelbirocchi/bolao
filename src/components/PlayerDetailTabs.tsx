"use client";

import { useState } from "react";

type MatchCard = {
  type: "match";
  id: string;
  matchNumber: number;
  homeTeam: string;
  awayTeam: string;
  matchPoints: number;
  cumulativePoints: number;
  rank: number;
  rankDelta: number;
};

type DayDivider = {
  type: "divider";
  date: string;
  dateLabel: string;
  matchCount: number;
  dayPoints: number;
};

type PlayerDetailContentProps = {
  rankingEvolutionLabel: string;
  pointsByGameLabel: string;
  byMatchLabel: string;
  byDayLabel: string;
  byMatchChart: React.ReactNode;
  byDayChart: React.ReactNode;
  matchCards: (MatchCard | DayDivider)[];
  showAllLabel: string;
  showLessLabel: string;
  noDataLabel: string;
  matchTitle: (matchNumber: number, home: string, away: string) => string;
};

const INITIAL_VISIBLE = 5;

function isDayDivider(item: MatchCard | DayDivider): item is DayDivider {
  return item.type === "divider";
}

function MatchRow({
  card,
  pointsLabel,
  matchTitle,
}: {
  card: MatchCard;
  pointsLabel: string;
  matchTitle: (matchNumber: number, home: string, away: string) => string;
}) {
  const deltaClass =
    card.rankDelta > 0 ? "up" : card.rankDelta < 0 ? "down" : "flat";
  const deltaSymbol =
    card.rankDelta > 0
      ? `\u25B2${card.rankDelta}`
      : card.rankDelta < 0
        ? `\u25BC${Math.abs(card.rankDelta)}`
        : "\u2013";

  return (
    <div className="player-match-card">
      <span className="player-match-num">#{card.matchNumber}</span>
      <span className="player-match-teams">
        {matchTitle(card.matchNumber, card.homeTeam, card.awayTeam)}
      </span>
      <span className="player-match-pts">
        {card.matchPoints} {pointsLabel}
      </span>
      <span className="player-match-rank">
        #{card.rank} <span className={`rank-delta ${deltaClass}`}>{deltaSymbol}</span>
      </span>
    </div>
  );
}

export function PlayerDetailContent({
  rankingEvolutionLabel,
  pointsByGameLabel,
  byMatchLabel,
  byDayLabel,
  byMatchChart,
  byDayChart,
  matchCards,
  showAllLabel,
  showLessLabel,
  noDataLabel,
  matchTitle,
}: PlayerDetailContentProps) {
  const [chartMode, setChartMode] = useState<"match" | "day">("match");
  const [showAll, setShowAll] = useState(false);

  const visibleCards = showAll ? matchCards : matchCards.slice(0, INITIAL_VISIBLE);
  const hiddenCount = matchCards.length - INITIAL_VISIBLE;

  return (
    <>
      <section className="card player-chart-section">
        <div className="player-chart-header">
          <h2>{rankingEvolutionLabel}</h2>
          <div className="ranking-chart-toggle" role="group" aria-label="Chart view mode">
            <button
              type="button"
              className={chartMode === "match" ? "active" : undefined}
              onClick={() => setChartMode("match")}
              aria-pressed={chartMode === "match"}
            >
              {byMatchLabel}
            </button>
            <button
              type="button"
              className={chartMode === "day" ? "active" : undefined}
              onClick={() => setChartMode("day")}
              aria-pressed={chartMode === "day"}
            >
              {byDayLabel}
            </button>
          </div>
        </div>
        <div className="player-chart-container">
          {chartMode === "match" ? byMatchChart : byDayChart}
        </div>
      </section>

      <section className="card player-match-feed" aria-label={pointsByGameLabel}>
        <h2>{pointsByGameLabel}</h2>
        {matchCards.length === 0 ? (
          <div className="empty">{noDataLabel}</div>
        ) : (
          <div className="player-match-list">
            {visibleCards.map((item) => {
              if (isDayDivider(item)) {
                return (
                  <div key={`div-${item.date}`} className="player-day-divider">
                    <span className="player-day-divider-label">
                      {item.dateLabel}
                    </span>
                    <span className="player-day-divider-meta">
                      {item.matchCount} &middot; {item.dayPoints} pts
                    </span>
                  </div>
                );
              }
              return (
                <MatchRow
                  key={item.id}
                  card={item}
                  pointsLabel="pts"
                  matchTitle={matchTitle}
                />
              );
            })}
          </div>
        )}
        {!showAll && hiddenCount > 0 && (
          <button
            type="button"
            className="player-show-more"
            onClick={() => setShowAll(true)}
          >
            {showAllLabel} ({hiddenCount})
          </button>
        )}
        {showAll && hiddenCount > 0 && (
          <button
            type="button"
            className="player-show-more"
            onClick={() => setShowAll(false)}
          >
            {showLessLabel}
          </button>
        )}
      </section>
    </>
  );
}
