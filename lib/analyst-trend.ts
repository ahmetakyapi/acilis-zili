import type { Recommendation } from "@/lib/providers/types";

/**
 * Analist dağılımının aydan aya değişimi.
 *
 * NEDEN DAĞILIM, NEDEN TEK TEK NOT DEĞİL. "X kurumu notunu Al'a çekti,
 * hedefi 250 dolar" satırları okuyucunun en çok aradığı şey ama kaynağımızda
 * yok: Finnhub'ın not değişikliği ve hedef fiyat uçları ücretsiz katmanda 403
 * dönüyor (`/stock/upgrade-downgrade`, `/stock/price-target`, 28 Eylül'de
 * denendi). Elimizde olan, `/stock/recommendation`ın aylık DAĞILIM
 * fotoğrafları (dört ay). Bu, tek tek kararların NET sonucunu veriyor: bir
 * kova bir ayda üç arttıysa üç analistin notu o yöne kaydı ya da yeni
 * analistler o kovadan girdi — hangisi olduğunu dağılım söylemiyor ve ekran
 * da söylememeli. Tek tek notları uydurmak yerine bunu yazıyoruz.
 */

export const ANALYST_BUCKETS = ["strongBuy", "buy", "hold", "sell", "strongSell"] as const;
export type AnalystBucket = (typeof ANALYST_BUCKETS)[number];

/** Kaç aylık fotoğraf — sağlayıcı dört veriyor. */
export const ANALYST_TREND_MONTHS = 4;

export type AnalystTrend = {
  /** Eskiden yeniye dönemler ("2026-06-01"). */
  periods: string[];
  rows: {
    bucket: AnalystBucket;
    /** `periods` ile aynı sırada. */
    values: number[];
    /** En yeni − en eski. */
    delta: number;
  }[];
  totals: number[];
  /** Alım tarafının (Güçlü Al + Al) payı, yüzde, dönem başına. */
  buyShare: (number | null)[];
};

/**
 * En az İKİ dönem gerekiyor — tek fotoğrafın değişimi yok. Dönem boşsa
 * (toplam sıfır) o ay listeden çıkıyor: sıfırdan 41'e bir "artış" yeni bir
 * kapsamı gösterir, analistlerin fikrini değil.
 */
export function analystTrend(
  records: readonly Recommendation[],
  months = ANALYST_TREND_MONTHS,
): AnalystTrend | null {
  const byPeriod = new Map<string, Recommendation>();
  for (const record of records) {
    const total = ANALYST_BUCKETS.reduce((sum, bucket) => sum + (record[bucket] ?? 0), 0);
    if (total > 0 && !byPeriod.has(record.period)) byPeriod.set(record.period, record);
  }
  const periods = [...byPeriod.keys()].sort().slice(-months);
  if (periods.length < 2) return null;
  const list = periods.map((period) => byPeriod.get(period)!);
  const totals = list.map((r) => ANALYST_BUCKETS.reduce((sum, bucket) => sum + r[bucket], 0));
  return {
    periods,
    rows: ANALYST_BUCKETS.map((bucket) => {
      const values = list.map((r) => r[bucket]);
      return { bucket, values, delta: values.at(-1)! - values[0]! };
    }),
    totals,
    buyShare: list.map((r, i) => (totals[i]! > 0 ? ((r.strongBuy + r.buy) / totals[i]!) * 100 : null)),
  };
}
