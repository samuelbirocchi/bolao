"use client";

import { useEffect, useState } from "react";
import { formatKickoffForLocale, type Locale } from "@/lib/i18n";

type LocalKickoffProps = {
  iso: string;
  locale: Locale;
};

// Server renders the UTC-based fallback (deterministic for SSR); after mount
// we reformat with the browser's timezone so each user sees kickoff times in
// their own zone. suppressHydrationWarning avoids a mismatch warning when the
// server (UTC) string differs from the client (local) one.
export function LocalKickoff({ iso, locale }: LocalKickoffProps) {
  const [value, setValue] = useState(() => formatKickoffForLocale(iso, locale));

  useEffect(() => {
    setValue(
      new Intl.DateTimeFormat(locale, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(iso)),
    );
  }, [iso, locale]);

  return (
    <time dateTime={iso} suppressHydrationWarning>
      {value}
    </time>
  );
}
