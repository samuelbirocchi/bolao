import { colorForSeed, initialsFor } from "@/lib/avatar";

type UserAvatarProps = {
  name: string | null;
  url: string | null;
  size?: number;
  seed?: string | null;
};

export function UserAvatar({ name, url, size = 36, seed }: UserAvatarProps) {
  const dimension = `${size}px`;
  const fontSize = `${Math.max(11, Math.round(size * 0.4))}px`;
  const style = { width: dimension, height: dimension, fontSize };

  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        alt={name ?? ""}
        className="avatar avatar-img"
        height={size}
        loading="lazy"
        referrerPolicy="no-referrer"
        src={url}
        style={style}
        width={size}
      />
    );
  }

  const palette = colorForSeed(seed ?? name ?? "?");
  return (
    <span
      aria-hidden={name ? undefined : true}
      className="avatar avatar-initials"
      style={{ ...style, background: palette }}
    >
      {initialsFor(name)}
    </span>
  );
}
