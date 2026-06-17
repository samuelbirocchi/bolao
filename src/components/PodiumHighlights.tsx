import { UserAvatar } from "@/components/UserAvatar";
import type { LeaderboardEntry } from "@/lib/data";

type PodiumZone = { entry: LeaderboardEntry; rank: number }[];

type PodiumHighlightsProps = {
  topZone: PodiumZone;
  bottomZone: PodiumZone;
  topLabel: string;
  bottomLabel: string;
  playerFallback: string;
};

function PodiumBand({
  label,
  zone,
  variant,
  playerFallback,
}: {
  label: string;
  zone: PodiumZone;
  variant: "top" | "bottom";
  playerFallback: string;
}) {
  if (zone.length === 0) {
    return null;
  }
  return (
    <div className={`podium-band podium-band--${variant}`}>
      <span className="podium-band-label">{label}</span>
      <div className="podium-slots">
        {zone.map(({ entry, rank }) => (
          <div className="podium-slot" key={entry.user_id}>
            <span className="rank">{rank}</span>
            <UserAvatar
              name={entry.display_name}
              seed={entry.user_id}
              size={48}
              url={entry.avatar_url}
            />
            <strong className="podium-slot-name">
              {entry.display_name ?? playerFallback}
            </strong>
            <span className="podium-slot-points">{entry.total_points}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PodiumHighlights({
  topZone,
  bottomZone,
  topLabel,
  bottomLabel,
  playerFallback,
}: PodiumHighlightsProps) {
  if (topZone.length === 0 && bottomZone.length === 0) {
    return null;
  }
  return (
    <section className="podium-highlights">
      <PodiumBand label={topLabel} playerFallback={playerFallback} variant="top" zone={topZone} />
      <PodiumBand
        label={bottomLabel}
        playerFallback={playerFallback}
        variant="bottom"
        zone={bottomZone}
      />
    </section>
  );
}
