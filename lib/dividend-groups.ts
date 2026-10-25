/**
 * Temettü takviminin sıralaması ve öne çıkanları — saf hesap (25 Ekim).
 *
 * NEDEN: dört haftalık pencerede seksen ödeme alfabetik ve hepsi açık
 * basılıyordu; liste 1440'ta 9.242 piksel, okuyucunun iki sorusu ("benim
 * takip ettiklerim var mı", "en çok getiri hangisinde") listenin içinde
 * gömülüydü. Artık günler katlanır, gün içinde önce takip listesi sonra
 * getiri; listenin üstünde iki kısa öne çıkan listesi.
 *
 * Getiri bir BÜYÜKLÜK, yargı değil (takvimin getiri çubuğu gibi): yüksek
 * getiri "iyi" demek değil; sıralama yalnız "nerede" sorusunu kısaltıyor.
 * Düz modül; `tests/dividend-groups.test.ts` sınıyor.
 */

/** "En Yüksek Getiri" listesinde en çok bu kadar ödeme. */
export const TOP_YIELD_ROWS = 6;
/** "Takip Listendekiler"de en çok bu kadar ödeme. */
export const WATCHED_ROWS = 8;

type Row = { dividend: { symbol: string; exDate: string }; yieldPct: number | null };

/** Gün içi sıra: takip edilenler, sonra getiri (bilinmeyen sonda), sonra sembol. */
export function orderDayRows<T extends Row>(rows: readonly T[], watched: ReadonlySet<string>): T[] {
  return [...rows].sort(
    (a, b) =>
      Number(watched.has(b.dividend.symbol)) - Number(watched.has(a.dividend.symbol)) ||
      (b.yieldPct ?? -1) - (a.yieldPct ?? -1) ||
      a.dividend.symbol.localeCompare(b.dividend.symbol),
  );
}

/**
 * Öne çıkanlar. Takip listesi pencerenin TAMAMINDAN, tarih sırasıyla (ilk
 * hak kesim önce). En yüksek getiri, takip listesinde olmayanlardan; aynı
 * şirket pencerede iki kez ödüyorsa (aylık ödeyenler) yalnız ilki.
 */
export function dividendHighlights<T extends Row>(
  days: readonly { exDate: string; rows: readonly T[] }[],
  watched: ReadonlySet<string>,
  { top = TOP_YIELD_ROWS, watchMax = WATCHED_ROWS }: { top?: number; watchMax?: number } = {},
): { watched: T[]; topYield: T[] } {
  const all = days.flatMap((day) => day.rows);
  const firstOf = (rows: T[]) => {
    const seen = new Set<string>();
    return rows.filter((row) => {
      if (seen.has(row.dividend.symbol)) return false;
      seen.add(row.dividend.symbol);
      return true;
    });
  };
  const byDate = [...all].sort((a, b) => a.dividend.exDate.localeCompare(b.dividend.exDate));
  const mine = firstOf(byDate.filter((row) => watched.has(row.dividend.symbol))).slice(0, watchMax);
  const topYield = firstOf(
    byDate
      .filter((row) => row.yieldPct !== null && !watched.has(row.dividend.symbol))
      .sort(
        (a, b) =>
          (b.yieldPct ?? 0) - (a.yieldPct ?? 0) ||
          a.dividend.exDate.localeCompare(b.dividend.exDate) ||
          a.dividend.symbol.localeCompare(b.dividend.symbol),
      ),
  ).slice(0, top);
  return { watched: mine, topYield };
}

/**
 * Son alım günü geçti mi (25 Ekim, görsel inceleme). Hak kesimi YARIN olan
 * gün listede duruyor ama son alım günü (bir iş günü önce) hafta sonundan
 * önceki cuma olabilir: 25 Ekim pazar günü kahraman "Almak İçin Son Gün:
 * 23 Ekim Cuma" diye geçmiş bir tarihi büyük puntoyla basıyordu. Son alım
 * günü BUGÜNse hâlâ alınabilir (ABD kapanışına kadar). Son alım günü
 * bilinmiyorsa hak kesim günü bugünden sonraysa alınabilir sayılır.
 * `today` ET takvim günü.
 */
export function buyWindowPassed(day: { exDate: string; lastBuy: string | null }, today: string): boolean {
  return day.lastBuy !== null ? day.lastBuy < today : day.exDate <= today;
}

/** Kahramanın göstereceği gün: hâlâ alınabilen ilk hak kesim; yoksa ilk gün. */
export function firstBuyableDay<T extends { exDate: string; lastBuy: string | null }>(
  days: readonly T[],
  today: string,
): T | null {
  return days.find((day) => !buyWindowPassed(day, today)) ?? days[0] ?? null;
}
