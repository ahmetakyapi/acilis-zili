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
    /* Künyede iki dil de görünür: geçerli olan mürekkep, diğeri soluk.
       Gazete künyesinde seçenek gizlenmez, hangisinde olduğun okunur. */
    <button
      type="button"
      onClick={() => startTransition(() => void setLocalePreference(next))}
      aria-label={`${label}: ${next.toUpperCase()}`}
      title={`${label}: ${next.toUpperCase()}`}
      disabled={pending}
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap text-[12px] uppercase tracking-[0.08em] transition-colors",
        pending && "opacity-50",
      )}
    >
      <span className="font-semibold text-ink">{initial}</span>
      <span aria-hidden className="text-faint">
        / {next}
      </span>
    </button>
  );
}
