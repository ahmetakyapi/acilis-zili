import "server-only";

import { cache } from "react";
import { SPX_MEMBERS, primaryOnly } from "@/db/seed/indices";
import { getStatus } from "@/lib/data";
import { loadBoardBars } from "@/lib/market-boards";
import { barDate } from "@/lib/period-returns";
import { getQuotes } from "@/lib/providers";
import { getDailyMarketSeries } from "@/lib/providers/daily-markets";
import { getSeries } from "@/lib/providers/fred";
import type { Bar, MacroObservation } from "@/lib/providers/types";
import {
  FEAR_MA_DAYS,
  SENTIMENT_KEYS,
  SENTIMENT_LOOKBACK,
  breadthReading,
  fearLevelReading,
  momentumReading,
  overallScore,
  safeHavenReading,
  type SentimentKey,
  type SentimentReading,
} from "@/lib/sentiment";
import { VIX_SERIES } from "@/lib/vix";

/**
 * Piyasa Nabzı'nın veri tarafı — kuralların kendisi `lib/sentiment.ts`te.
 *
 * Gözlem sayısı: ortalama penceresi + sıra penceresi + tatil payı. VIX'i
 * Cboe'nin günlük dosyası veriyor (tam geçmiş), FRED yedek; tahvil farkı
 * yalnızca FRED'de.
 */
const FEAR_HISTORY = FEAR_MA_DAYS + SENTIMENT_LOOKBACK + 40;

/** ICE BofA ABD yüksek getirili tahvil opsiyon düzeltmeli farkı (puan). */
const HY_SPREAD = { seriesId: "BAMLH0A0HYM2", slug: "hy-spread", units: "lin" };

export type SentimentSnapshot = {
  readings: SentimentReading[];
  missing: SentimentKey[];
  overall: number | null;
  /** Genişlik hangi seansı sayıyor — künyede yazılır. */
  breadthSession: "regular" | "extended" | null;
};

function toDated(observations: readonly MacroObservation[]) {
  return observations.map((point) => ({ date: point.date, value: point.value }));
}

function closesOf(bars: readonly Bar[] | undefined) {
  return (bars ?? []).map((bar) => ({ date: barDate(bar), value: bar.close }));
}

/**
 * S&P 500 genişliği — /piyasalar'ın S&P 500 sekmesiyle AYNI anahtar.
 *
 * Liste `primaryOnly(SPX_MEMBERS)`: sekme de onu soruyor, yani o sekme
 * açıkken kotasyon turu istek içinde tek (getQuotes sıralı anahtarla
 * tekilleştiriyor). Sayım da sekmenin kuralıyla: değişimi bilinmeyen
 * satır "yatay" sayılmıyor, hiç sayılmıyor.
 *
 * BAYAT PAKET SAYILMIYOR. Sağlayıcı düşünce kotasyonlar Neon önbelleğinden
 * geliyor ve orada önceki seansın yüzdeleri duruyor (CLAUDE.md "Veri
 * dürüstlüğü" 4); nabız bir "bugün" iddiası taşıyor.
 */
async function breadth(): Promise<{ reading: SentimentReading | null; session: SentimentSnapshot["breadthSession"] }> {
  const status = await getStatus();
  const members = primaryOnly(SPX_MEMBERS);
  const result = await getQuotes(members.map((member) => member.symbol), status);
  if (!result.ok || result.stale) return { reading: null, session: null };
  let known = 0;
  let advancing = 0;
  for (const member of members) {
    const change = result.data[member.symbol]?.changePct;
    if (change === null || change === undefined) continue;
    known += 1;
    if (change > 0) advancing += 1;
  }
  const reading = breadthReading(advancing, known, members.length, status.sessionDate);
  const extended = status.session === "pre-market" || status.session === "after-hours";
  return { reading, session: reading ? (extended ? "extended" : "regular") : null };
}

export const getSentiment = cache(async function getSentiment(): Promise<SentimentSnapshot> {
  const status = await getStatus();
  const [vix, credit, bars, breadthResult] = await Promise.all([
    getDailyMarketSeries(VIX_SERIES, FEAR_HISTORY),
    getSeries(HY_SPREAD, FEAR_HISTORY),
    loadBoardBars(status),
    breadth(),
  ]);

  const candidates: Record<SentimentKey, SentimentReading | null> = {
    vix: vix.ok ? fearLevelReading("vix", toDated(vix.data.observations)) : null,
    momentum: momentumReading(closesOf(bars.SPY)),
    breadth: breadthResult.reading,
    credit: credit.ok ? fearLevelReading("credit", toDated(credit.data.observations)) : null,
    safeHaven: safeHavenReading(closesOf(bars.SPY), closesOf(bars.TLT)),
  };

  const readings = SENTIMENT_KEYS.flatMap((key) => (candidates[key] ? [candidates[key]] : []));
  const missing = SENTIMENT_KEYS.filter((key) => !candidates[key]);
  return {
    readings,
    missing,
    overall: overallScore(readings),
    breadthSession: breadthResult.session,
  };
});
