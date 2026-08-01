"use client";

import { useTransition } from "react";
import { setLocalePreference } from "@/app/actions/preferences";
import { LOCALES, type Locale } from "@/lib/i18n/config";
import { cn } from "@/lib/utils";

/**
 * Masaüstünde TR/EN segmenti (seçili olan `--srf2` dolgulu), mobilde tek
 * kare — mockup 4a ve 4b'deki iki ayrı biçim.
 */
export function LocaleToggle({
  initial,
  label,
}: {
  initial: Locale;
  label: string;
}) {
  const [pending, startTransition] = useTransition();
  const next: Locale = initial === "tr" ? "en" : "tr";

  const select = (locale: Locale) => {
    if (locale === initial) return;
    startTransition(() => void setLocalePreference(locale));
  };

  return (
    <>
      <span
        className={cn(
          "hidden overflow-hidden rounded-lg border border-line text-xs lg:flex",
          pending && "opacity-50",
        )}
      >
        {LOCALES.map((locale) => (
          <button
            key={locale}
            type="button"
            onClick={() => select(locale)}
            aria-label={`${label}: ${locale.toUpperCase()}`}
            aria-pressed={locale === initial}
            disabled={pending}
            className={cn(
              "px-[9px] py-1.5 uppercase transition-colors",
              locale === initial
                ? "bg-surface-elevated font-semibold text-strong"
                : "text-body hover:text-strong",
            )}
          >
            {locale}
          </button>
        ))}
      </span>

      <button
        type="button"
        onClick={() => select(next)}
        aria-label={`${label}: ${next.toUpperCase()}`}
        title={`${label}: ${next.toUpperCase()}`}
        disabled={pending}
        className={cn(
          "inline-flex size-[30px] items-center justify-center rounded-lg border border-line bg-surface text-[11px] font-semibold uppercase text-body transition-colors hover:text-strong lg:hidden",
          pending && "opacity-50",
        )}
      >
        {initial}
      </button>
    </>
  );
}
