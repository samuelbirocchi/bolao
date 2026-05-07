import { flagForTeamName } from "@/lib/teamFlags";

type TeamNameProps = {
  name: string;
  canonicalName?: string | null;
  className?: string;
};

export function TeamName({ name, canonicalName = name, className }: TeamNameProps) {
  const flag = flagForTeamName(canonicalName);
  const combinedClassName = ["team-name", className].filter(Boolean).join(" ");

  return (
    <span className={combinedClassName}>
      {flag ? (
        <span aria-hidden="true" className="team-name-flag">
          {flag}
        </span>
      ) : null}
      <span>{name}</span>
    </span>
  );
}
