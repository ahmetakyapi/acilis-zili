"use client";

import { useTransition } from "react";
import { setLocalePreference } from "@/app/actions/preferences";
import type { Locale } from "@/lib/i18n/config";
import { cn } from "@/lib/utils";

export function LocaleToggle({
  initial,
  label,
}: {
  initial: Locale;
  label: string;
}) {
  const [pending, startTransition] = useTransition();
  const next: Locale = initial === "tr" ? "en" : "tr";

  return (
    <button
      type="button"
      onClick={() => startTransition(() => void setLocalePreference(next))}
      aria-label={`${label}: ${next.toUpperCase()}`}
      title={`${label}: ${next.toUpperCase()}`}
      disabled={pending}
      className={cn(
        "numeral inline-flex size-9 items-center justify-center rounded-(--radius-md) text-[11px] font-semibold uppercase tracking-wider text-soft transition-colors hover:bg-surface-elevated hover:text-strong",
        pending && "opacity-50",
      )}
    >
      {next}
    </button>
  );
}
