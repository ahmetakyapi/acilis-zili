"use client";

import { useDualClock } from "@/components/layout/useDualClock";

/**
 * Ana sayfa canlı saati — New York ve İstanbul'un şu anki duvar saati.
 * Oturum rozeti ile aynı hizada durur; sayı mono, etiketler sessiz.
 */
export function LiveClock() {
  const { ny, ist } = useDualClock();

  return (
    <p className="numeral flex items-center gap-1.5 text-xs text-muted">
      <span className="font-semibold text-strong">{ny}</span>
      <span className="text-[10px]">ET</span>
      <span aria-hidden>·</span>
      <span className="font-semibold text-soft">{ist}</span>
      <span className="text-[10px]">TR</span>
    </p>
  );
}
