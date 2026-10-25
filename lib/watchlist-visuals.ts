/**
 * /favoriler görsel katmanının SAF hesapları (25 Ekim, kişisel ekranlar).
 * Test: `tests/watchlist-visuals.test.ts`.
 *
 * 1. `yearRange` — 52 haftalık aralık ve fiyatın oradaki yeri. Bant, günlük
 *    barların en düşük dibi ile en yüksek tepesinden; bugünkü fiyat bandın
 *    dışına çıktıysa (yeni zirve) bant fiyata kadar uzatılır: işaretçi rayın
 *    dışına düşüp "zirvenin üstünde" gibi okunmasın, bant da uydurulmasın.
 * 2. `listPulse` — sayfanın tepesindeki tek cümlenin verisi. Yüzde hangi
 *    seansı anlattığını KANITLAMALI (CLAUDE.md veri dürüstlüğü 4): yalnız
 *    bu seansta işlem görmüş kotasyonlar "bugün" sayılır; hiçbiri değilse
 *    cümle "son seansta" der, karışıksa yalnız bugün işlem görenleri sayar
 *    ve kaç tane olduğunu söyler.
 */

export type YearRange = { low: number; high: number; position: number };

/** 52 haftalık barlardan aralık; en az iki bar ve pozitif fiyat gerekir. */
export function yearRange(
  bars: readonly { high: number; low: number }[],
  price: number | null | undefined,
): YearRange | null {
  if (bars.length < 2 || typeof price !== "number" || !(price > 0)) return null;
  let low = Infinity;
  let high = -Infinity;
  for (const bar of bars) {
    if (Number.isFinite(bar.low) && bar.low > 0 && bar.low < low) low = bar.low;
    if (Number.isFinite(bar.high) && bar.high > high) high = bar.high;
  }
  if (!Number.isFinite(low) || !Number.isFinite(high)) return null;
  low = Math.min(low, price);
  high = Math.max(high, price);
  const span = high - low;
  return { low, high, position: span > 0 ? (price - low) / span : 0.5 };
}

export type PulseQuote = { changePct: number | null; session: boolean };

export type ListPulse = {
  /** Listedeki tekil hisse sayısı (fiyatı gelmeyenler dahil). */
  total: number;
  /** "today": hepsi bu seansta; "partial": bir kısmı; "last": hiçbiri; "none": okunacak yüzde yok. */
  scope: "today" | "partial" | "last" | "none";
  /** Sayıma giren hisse sayısı. */
  counted: number;
  up: number;
  down: number;
  /** Çoğunluğun yönündeki en sert hareket; eşitlikte düşüş öne. */
  lead: { symbol: string; changePct: number; direction: "up" | "down" } | null;
};

export function listPulse(symbols: readonly string[], quotes: Readonly<Record<string, PulseQuote | undefined>>): ListPulse {
  const unique = [...new Set(symbols)];
  const known = unique.filter((s) => {
    const q = quotes[s];
    return q !== undefined && q.changePct !== null && Number.isFinite(q.changePct);
  });
  const inSession = known.filter((s) => quotes[s]!.session);
  const scope: ListPulse["scope"] =
    known.length === 0 ? "none" : inSession.length === known.length ? "today" : inSession.length > 0 ? "partial" : "last";
  const pool = scope === "partial" ? inSession : known;

  let up = 0;
  let down = 0;
  let best: { symbol: string; changePct: number } | null = null;
  let worst: { symbol: string; changePct: number } | null = null;
  for (const symbol of pool) {
    const pct = quotes[symbol]!.changePct as number;
    if (pct > 0) up += 1;
    else if (pct < 0) down += 1;
    if (pct > 0 && (best === null || pct > best.changePct)) best = { symbol, changePct: pct };
    if (pct < 0 && (worst === null || pct < worst.changePct)) worst = { symbol, changePct: pct };
  }
  const lead =
    down >= up && worst
      ? { ...worst, direction: "down" as const }
      : best
        ? { ...best, direction: "up" as const }
        : worst
          ? { ...worst, direction: "down" as const }
          : null;
  return { total: unique.length, scope, counted: pool.length, up, down, lead };
}
