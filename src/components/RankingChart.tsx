import { colorForSeed } from "@/lib/avatar";

export type RankingChartStep = {
  id: string;
  label: string;
};

export type RankingChartLine = {
  userId: string;
  name: string | null;
  ranks: number[];
};

type RankingChartProps = {
  steps: RankingChartStep[];
  lines: RankingChartLine[];
  currentUserId: string;
  maxRank: number;
  title: string;
  emptyLabel: string;
  xAxisLabel: string;
};

// Inline SVG line chart — no client JS, server-rendered. Y axis is rank
// inverted (1 at the top); one polyline per member coloured by the same
// seed -> colour mapping as their avatar, with the current user's line
// emphasised and the rest dimmed.
const WIDTH = 720;
const HEIGHT = 340;
const MARGIN = { top: 18, right: 18, bottom: 40, left: 34 };
const PLOT_W = WIDTH - MARGIN.left - MARGIN.right;
const PLOT_H = HEIGHT - MARGIN.top - MARGIN.bottom;

export function RankingChart({
  steps,
  lines,
  currentUserId,
  maxRank,
  title,
  emptyLabel,
  xAxisLabel,
}: RankingChartProps) {
  if (steps.length === 0) {
    return (
      <section className="card ranking-chart" aria-label={title}>
        <h2>{title}</h2>
        <div className="empty">{emptyLabel}</div>
      </section>
    );
  }

  const xFor = (index: number) =>
    steps.length === 1
      ? MARGIN.left + PLOT_W / 2
      : MARGIN.left + (index / (steps.length - 1)) * PLOT_W;
  const yFor = (rank: number) =>
    maxRank <= 1
      ? MARGIN.top + PLOT_H / 2
      : MARGIN.top + ((rank - 1) / (maxRank - 1)) * PLOT_H;

  const labelEvery = Math.ceil(steps.length / 16);

  return (
    <section className="card ranking-chart" aria-label={title}>
      <h2>{title}</h2>
      <svg
        className="ranking-chart-svg"
        role="img"
        aria-label={title}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        preserveAspectRatio="xMidYMid meet"
      >
        {/* horizontal guide lines for the top and bottom ranks */}
        <line
          className="ranking-chart-grid"
          x1={MARGIN.left}
          x2={WIDTH - MARGIN.right}
          y1={yFor(1)}
          y2={yFor(1)}
        />
        <line
          className="ranking-chart-grid"
          x1={MARGIN.left}
          x2={WIDTH - MARGIN.right}
          y1={yFor(maxRank)}
          y2={yFor(maxRank)}
        />
        <text className="ranking-chart-axis" x={MARGIN.left - 8} y={yFor(1) + 4} textAnchor="end">
          #1
        </text>
        {maxRank > 1 ? (
          <text
            className="ranking-chart-axis"
            x={MARGIN.left - 8}
            y={yFor(maxRank) + 4}
            textAnchor="end"
          >
            #{maxRank}
          </text>
        ) : null}

        {/* x axis labels */}
        {steps.map((step, index) =>
          index % labelEvery === 0 ? (
            <text
              key={step.id}
              className="ranking-chart-axis"
              x={xFor(index)}
              y={HEIGHT - MARGIN.bottom + 18}
              textAnchor="middle"
            >
              {step.label}
            </text>
          ) : null,
        )}
        <text
          className="ranking-chart-axis-title"
          x={MARGIN.left + PLOT_W / 2}
          y={HEIGHT - 4}
          textAnchor="middle"
        >
          {xAxisLabel}
        </text>

        {/* one polyline per member */}
        {lines.map((line) => {
          const isCurrent = line.userId === currentUserId;
          const color = colorForSeed(line.userId);
          const points = line.ranks.map((rank, index) => `${xFor(index)},${yFor(rank)}`).join(" ");
          return (
            <g
              key={line.userId}
              className={isCurrent ? "ranking-chart-line current" : "ranking-chart-line"}
            >
              <polyline
                points={points}
                fill="none"
                stroke={color}
                strokeWidth={isCurrent ? 4 : 2}
                strokeLinejoin="round"
                strokeLinecap="round"
                opacity={isCurrent ? 1 : 0.45}
              >
                <title>{line.name ?? line.userId}</title>
              </polyline>
              {line.ranks.map((rank, index) => (
                <circle
                  key={`${line.userId}-${steps[index]?.id ?? index}`}
                  cx={xFor(index)}
                  cy={yFor(rank)}
                  r={isCurrent ? 4 : 2.5}
                  fill={color}
                  opacity={isCurrent ? 1 : 0.45}
                />
              ))}
            </g>
          );
        })}
      </svg>

      <ul className="ranking-chart-legend">
        {lines.map((line) => (
          <li
            key={line.userId}
            className={line.userId === currentUserId ? "current" : undefined}
          >
            <span
              className="ranking-chart-swatch"
              style={{ background: colorForSeed(line.userId) }}
              aria-hidden="true"
            />
            {line.name ?? line.userId}
          </li>
        ))}
      </ul>
    </section>
  );
}
