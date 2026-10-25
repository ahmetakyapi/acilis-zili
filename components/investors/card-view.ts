import type { MoveTone } from "./format";

/**
 * Dizin kartlarının saf hesapları (25 Ekim) — sunucu ve test aynı dosyayı
 * okuyor (`"use client"` DEĞİL; gerekçe CLAUDE.md "İstemci/sunucu sınırı").
 * Testi `tests/investor-cards.test.ts`.
 */

export type CapitalInput = {
  slug: string;
  /** Çeyrek sonu hisse portföyü, dolar. */
  value: number;
  /** En son çeyreği bildirmiş ve kapanmamış fon mu — yalnız bunlar toplama girer. */
  current: boolean;
};

export type CapitalSlice = { slug: string; value: number; share: number };

/**
 * Takip edilen sermayede kimin ne payı var. Küme sayfanın kapağındaki
 * toplamla AYNI (`Overview.trackedValue`): en son çeyreği bildirmiş,
 * kapanmamış 13F fonları. Eski dönemi taşıyan fonun payı YOK (`shareOf`ta
 * bulunmuyor): iki ayrı çeyreğin portföyünü aynı pastaya koymak uydurma bir
 * pay olurdu. Dilimler büyükten küçüğe.
 */
export function capitalShares(funds: readonly CapitalInput[]): {
  total: number;
  slices: CapitalSlice[];
  shareOf: Map<string, number>;
} {
  const counted = funds.filter((fund) => fund.current && fund.value > 0);
  const total = counted.reduce((sum, fund) => sum + fund.value, 0);
  const slices =
    total > 0
      ? counted
          .map((fund) => ({ slug: fund.slug, value: fund.value, share: (fund.value / total) * 100 }))
          .sort((a, b) => b.value - a.value)
      : [];
  return { total, slices, shareOf: new Map(slices.map((slice) => [slice.slug, slice.share])) };
}

/** Kartların üstündeki lejantın sayıları: kaç fon net alıcı, net satıcı, dengede. */
export function leanTally(leans: readonly (MoveTone | null)[]): Record<MoveTone, number> {
  const tally: Record<MoveTone, number> = { up: 0, down: 0, flat: 0 };
  for (const lean of leans) if (lean) tally[lean] += 1;
  return tally;
}
