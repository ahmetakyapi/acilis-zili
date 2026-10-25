/**
 * Şeridin taşma kararı — saf hesap, `usePriorityStrip`in çekirdeği. Ayrı ve
 * `"use client"`sız modülde ki testten okunabilsin (tests/strip-overflow.test.ts).
 *
 * `gap` listenin sekme aralığı: toplam N sekme için N − 1 aralık taşıyor ve
 * gizlenen sekme kendi aralığını da götürüyor (gerekçe kancada).
 */
export type StripMeasure = { href: string; rank: number; width: number };

export function overflowingTabs(items: readonly StripMeasure[], available: number, gap: number): Set<string> {
  let total = items.reduce((sum, item) => sum + item.width, 0) + gap * Math.max(items.length - 1, 0);
  const hidden = new Set<string>();
  for (const item of [...items].sort((a, b) => b.rank - a.rank)) {
    if (total <= available) break;
    hidden.add(item.href);
    total -= item.width + gap;
  }
  return hidden;
}
