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

  /* Saat İKİ BÖLMELİ bir künye. Eskiden beş ayrı düğüm ("11:15", "TR", "·",
     "04:15", "NY") aynı boşlukla diziliyordu ve hangi etiketin hangi saate
     ait olduğu ancak okunarak çıkarılıyordu — ayraç, sayı ile etiket
     arasındaki bağdan daha güçlü duruyordu.

     Şimdi her saat kendi bölmesinde: sayı ve künyesi bitişik, bölmeler
     arasında hairline. Birincil saat tam mürekkep, ikincil sessiz — hangisi
     okuyucunun kendi saati olduğu tondan anlaşılıyor. */
  return (
    <p className="numeral flex items-stretch divide-x divide-line rounded-lg border border-line bg-surface-solid text-xs">
      <span className="flex items-baseline gap-1.5 px-2.5 py-1">
        <span className="font-semibold text-strong">{first.time}</span>
        <span className="text-[10px] text-muted">{first.tag}</span>
      </span>
      <span className="flex items-baseline gap-1.5 px-2.5 py-1">
        <span className="font-semibold text-soft">{second.time}</span>
        <span className="text-[10px] text-muted">{second.tag}</span>
      </span>
    </p>
  );
}
