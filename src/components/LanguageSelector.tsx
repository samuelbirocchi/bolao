"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useRef } from "react";
import { setLocaleAction } from "@/lib/actions";
import { localeOptions, type Locale } from "@/lib/i18n";

type LanguageSelectorProps = {
  currentLocale: Locale;
  label: string;
};

export function LanguageSelector({ currentLocale, label }: LanguageSelectorProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = searchParams.toString();
  const redirectTo = query ? `${pathname}?${query}` : pathname;

  return (
    <form action={setLocaleAction} className="language-form" ref={formRef}>
      <label>
        <span className="sr-only">{label}</span>
        <select
          aria-label={label}
          defaultValue={currentLocale}
          name="locale"
          onChange={() => formRef.current?.requestSubmit()}
        >
          {localeOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <input name="redirectTo" type="hidden" value={redirectTo} />
    </form>
  );
}
