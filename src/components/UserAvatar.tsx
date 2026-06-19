"use client";

import { useEffect, useState } from "react";
import { colorForSeed, gravatarUrl, initialsFor } from "@/lib/avatar";

type UserAvatarProps = {
  name: string | null;
  url: string | null;
  size?: number;
  seed?: string | null;
  gravatarHash?: string | null;
};

export function UserAvatar({ name, url, size = 36, seed, gravatarHash }: UserAvatarProps) {
  const dimension = `${size}px`;
  const fontSize = `${Math.max(11, Math.round(size * 0.4))}px`;
  const style = { width: dimension, height: dimension, fontSize };

  // Fallback chain: uploaded avatar -> Gravatar (by email hash) -> initials.
  const candidates = [url, gravatarUrl(gravatarHash, size)].filter(
    (candidate): candidate is string => Boolean(candidate),
  );
  const candidateKey = candidates.join("|");

  const [failed, setFailed] = useState<Record<string, true>>({});
  // Reset the chain when the sources change (e.g. a list row reused for another user).
  useEffect(() => {
    setFailed({});
  }, [candidateKey]);

  const markFailed = (badSrc: string) =>
    setFailed((prev) => (prev[badSrc] ? prev : { ...prev, [badSrc]: true }));

  const src = candidates.find((candidate) => !failed[candidate]);

  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        alt={name ?? ""}
        className="avatar avatar-img"
        height={size}
        loading="lazy"
        onError={() => markFailed(src)}
        // Catch images that already errored before hydration attached onError.
        ref={(node) => {
          if (node && node.complete && node.naturalWidth === 0) {
            markFailed(src);
          }
        }}
        referrerPolicy="no-referrer"
        src={src}
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
