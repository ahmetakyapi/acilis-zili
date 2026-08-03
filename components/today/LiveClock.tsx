"use client";

import { useDualClock } from "@/components/layout/useDualClock";
import type { Locale } from "@/lib/i18n/config";

/**
 * Ana sayfa canlı saati — New York ve İstanbul'un şu anki duvar saati.
 * Oturum rozeti ile aynı hizada durur; sayı mono, etiketler sessiz.
 *
 * Sıra dile bağlı: Türkçe okuyanın duvar saati önce gelir, seansın kendi
 * saati arkasından. İngilizcede tersi — kaynağın saati başta durur.
 */
export function LiveClock({ locale }: { locale: Locale }) {
  const { ny, ist } = useDualClock();

  const [first, second] =
    locale === "tr"
      ? ([
          { time: ist, tag: "TR" },
          { time: ny, tag: "NY" },
        ] as const)
      : ([
          { time: ny, tag: "NY" },
          { time: ist, tag: "TR" },
        ] as const);

  return (
    <p className="numeral flex items-center gap-1.5 text-xs text-muted">
      <span className="font-semibold text-strong">{first.time}</span>
      <span className="text-[10px]">{first.tag}</span>
      <span aria-hidden>·</span>
      <span className="font-semibold text-soft">{second.time}</span>
      <span className="text-[10px]">{second.tag}</span>
    </p>
  );
}
