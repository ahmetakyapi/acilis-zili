import type { Bar } from "@/lib/providers/types";
import { barDate } from "@/lib/period-returns";
import { MAX_COMPARE_SYMBOLS, parseCompareSymbols, type CompareRange } from "@/lib/compare";

/**
 * "Claude Karşılaştırma Notu"nun SAF hesapları (18 Ekim) — sunucu modülü
 * `lib/compare-note.ts` bunları çağırır, testler doğrudan
 * (tests/compare-note.test.ts). Ayrı dosya, çünkü orası `server-only` ve
 * veritabanı/sağlayıcı içe aktarıyor.
 *
 * KURAL: Claude hesap YAPMAZ. Getiri, en derin düşüş, oynaklık ve iki
 * getirinin farkı burada, kodda hesaplanır; modele iki dilde biçimlenmiş
 * hâlleri gider ve çıktıdaki her sayı girdide geçmek zorunda
 * (lib/ai-grounding.ts).
 */

/** Notun sembol listesi: geçerli, tekrarsız, SIRALI, 2–4 tane; değilse null.
 *  Sıralı, çünkü "NVDA,AMD" ile "AMD,NVDA" aynı not — anahtar da aynı olmalı. */
export function noteSymbols(raw: string | null | undefined): string[] | null {
  const { kept, dropped } = parseCompareSymbols(raw ?? undefined);
  if (dropped.length > 0 || kept.length < 2 || kept.length > MAX_COMPARE_SYMBOLS) return null;
  return [...kept].sort();
}

/** Önbellek anahtarı: sıralı semboller + aralık + son TAMAMLANMIŞ seans.
 *  Yeni seans kapanınca anahtar değişir, not bir kez daha yazılır. */
export function compareNoteKey(symbols: readonly string[], range: CompareRange, lastSession: string): string {
  return `${[...new Set(symbols)].sort().join(",")}:${range}:${lastSession}`;
}

export type ClosePoint = { date: string; close: number };

/** Tarihin haftasının pazartesisi (YYYY-AA-GG, takvim aritmetiği UTC'de). */
export function mondayOf(date: string): string {
  const d = new Date(`${date}T12:00:00Z`);
  const back = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - back);
  return d.toISOString().slice(0, 10);
}

/**
 * Seçili aralığın YALNIZ tamamlanmış seans kapanışları.
 *
 * Günlük aralıklar (1A…1Y): `expected`ten (son tamamlanmış seans) sonraki
 * bar atılır; kalan serinin son barı `expected` DEĞİLSE seri bayattır ve
 * null döner — not o zaman hiç yazılmaz (yazma katmanı bayat veri
 * kullanmaz, CLAUDE.md "Veri dürüstlüğü" 4).
 *
 * 5Y haftalık barlarla geliyor ve haftanın barı hafta sürerken o anki fiyatı
 * taşıyor: bitmiş olduğu bilinemez. Bu yüzden `expected`in haftası ve
 * sonrası atılır, yerine `daily` serisinden `expected` günün kapanışı
 * eklenir. Her nokta böylece tamamlanmış bir seansın kapanışı.
 */
export function completedCloses(
  bars: readonly Bar[] | undefined,
  expected: string,
  options: { weekly?: boolean; daily?: readonly Bar[] } = {},
): ClosePoint[] | null {
  if (!bars || bars.length === 0) return null;
  if (options.weekly) {
    const week = mondayOf(expected);
    const full = bars.filter((bar) => barDate(bar) < week).map((bar) => ({ date: barDate(bar), close: bar.close }));
    const tail = (options.daily ?? []).filter((bar) => barDate(bar) <= expected);
    const last = tail[tail.length - 1];
    if (!last || barDate(last) !== expected) return null;
    const points = [...full, { date: expected, close: last.close }];
    return points.length >= 2 && points.every((p) => p.close > 0) ? points : null;
  }
  const points = bars.filter((bar) => barDate(bar) <= expected).map((bar) => ({ date: barDate(bar), close: bar.close }));
  if (points.length < 2 || points[points.length - 1]!.date !== expected) return null;
  return points.every((p) => p.close > 0) ? points : null;
}

/** İlk kapanıştan son kapanışa yüzde — grafiğin `periodChangePct`iyle aynı tanım. */
export function periodReturn(closes: readonly number[]): number | null {
  if (closes.length < 2 || !(closes[0]! > 0)) return null;
  return ((closes[closes.length - 1]! - closes[0]!) / closes[0]!) * 100;
}

/**
 * En derin düşüş: dönem içinde görülen bir zirveden sonraki en düşük
 * kapanışa yüzde (≤ 0). Zirve ve dip dizinleri de döner — dibin tarihi
 * modele verilir, "en sert düşüş Mart'ta" diyebilsin diye.
 */
export function maxDrawdown(closes: readonly number[]): { pct: number; peak: number; trough: number } | null {
  if (closes.length < 2) return null;
  let peak = 0;
  let best = { pct: 0, peak: 0, trough: 0 };
  for (let i = 1; i < closes.length; i++) {
    if (closes[i]! > closes[peak]!) peak = i;
    const dd = ((closes[i]! - closes[peak]!) / closes[peak]!) * 100;
    if (dd < best.pct) best = { pct: dd, peak, trough: i };
  }
  return best;
}

/**
 * Yıllıklandırılmış oynaklık (%): ardışık kapanış getirilerinin örneklem
 * standart sapması × √(yıldaki dönem). Günlükte 252, haftalıkta 52. Beş
 * getiriden azında anlamlı değil, null.
 */
export function annualizedVolatility(closes: readonly number[], periodsPerYear: number): number | null {
  const returns: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    if (!(closes[i - 1]! > 0)) return null;
    returns.push(closes[i]! / closes[i - 1]! - 1);
  }
  if (returns.length < 5) return null;
  const mean = returns.reduce((s, r) => s + r, 0) / returns.length;
  const variance = returns.reduce((s, r) => s + (r - mean) ** 2, 0) / (returns.length - 1);
  return Math.sqrt(variance) * Math.sqrt(periodsPerYear) * 100;
}

export type SeriesStats = {
  symbol: string;
  from: string;
  to: string;
  returnPct: number;
  drawdownPct: number;
  troughDate: string;
  volatilityPct: number | null;
};

/** Bir serinin bütün ölçüleri. Haftalık seride son parça (yarım hafta)
 *  oynaklığa girmez: haftalık getirilerin arasına bir günlük adım karışırdı. */
export function seriesStats(symbol: string, points: readonly ClosePoint[], weekly: boolean): SeriesStats | null {
  const closes = points.map((p) => p.close);
  const ret = periodReturn(closes);
  const dd = maxDrawdown(closes);
  if (ret === null || !dd) return null;
  return {
    symbol,
    from: points[0]!.date,
    to: points[points.length - 1]!.date,
    returnPct: ret,
    drawdownPct: dd.pct,
    troughDate: points[dd.trough]!.date,
    volatilityPct: weekly ? annualizedVolatility(closes.slice(0, -1), 52) : annualizedVolatility(closes, 252),
  };
}

/** Getiriye göre büyükten küçüğe semboller — sıralamayı da model yapmasın. */
export function rankByReturn(stats: readonly Pick<SeriesStats, "symbol" | "returnPct">[]): string[] {
  return [...stats].sort((a, b) => b.returnPct - a.returnPct || a.symbol.localeCompare(b.symbol)).map((s) => s.symbol);
}
