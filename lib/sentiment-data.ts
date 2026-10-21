import "server-only";

import { cache } from "react";
import { ALL_MEMBERS, SPX_MEMBERS, primaryOnly } from "@/db/seed/indices";
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
  breadthCounts,
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
 * S&P 500 genişliği — ana sayfanın endeks evreniyle AYNI anahtar.
 *
 * Kotasyonlar `primaryOnly(ALL_MEMBERS)` ile soruluyor, SAYIM yalnız S&P
 * üyeleri üzerinden (20 Ekim). Liste eskiden `primaryOnly(SPX_MEMBERS)`ti,
 * gerekçe /piyasalar'ın S&P 500 sekmesiyle anahtar paylaşmaktı; 17 Ekim'den
 * beri o sayfanın açılış sekmesi Nasdaq, paylaşım yalnız `?endeks=sp500`te
 * kalıyordu. Nabız ise misafirin ana sayfasında (PortfolioSlot) her
 * görüntülemede çiziliyor ve orada Günün Hareketleri ile teknik panel
 * ALL'ı soruyor (`components/today/home/index-snapshot.ts`): ikinci ~500
 * sembollük paket, ikinci sağlayıcı turu demekti. ALL, S&P'yi kapsıyor;
 * getQuotes sıralı anahtarla tekilleştirdiği için tur artık istek içinde
 * tek. Bedel yalnız S&P sekmesinde bir paket fazlası. Sayım sekmenin
 * kuralıyla: değişimi bilinmeyen satır "yatay" sayılmıyor, hiç sayılmıyor.
 *
 * BAYAT PAKET SAYILMIYOR. Sağlayıcı düşünce kotasyonlar Neon önbelleğinden
 * geliyor ve orada önceki seansın yüzdeleri duruyor (CLAUDE.md "Veri
 * dürüstlüğü" 4); nabız bir "bugün" iddiası taşıyor.
 *
 * SEANSI KANITLAMAYAN SEMBOL DE SAYILMIYOR (20 Ekim). Paketin taze olması
 * sembolün taze olması değil: açılış öncesinde (04:00–09:30 ET) üyelerin
 * çoğu henüz işlem görmemiş ve yüzdesi DÜNÜN tam günü, yalnız işlem görmüş
 * birkaçınınki bu sabahın. Hepsinin yüzdesi var, kapsam eşiği geçiyordu ve
 * dünün genişliği bugünün tarihiyle nabza giriyordu. Ölçü `isSessionTrade`
 * (DayMovers ve alarmlarla aynı; sayım `breadthCounts`, lib/sentiment.ts);
 * kapsam eşiğin altına inerse bileşen düşer ve "Hesaplanamayan bileşenler"
 * notunda yazılır. /piyasalar'ın sekmesi değişmiyor: orada her satır kendi
 * künyesiyle görünüyor (`extendedNote`), burada tek bir tarihli toplam var.
 */
async function breadth(): Promise<{ reading: SentimentReading | null; session: SentimentSnapshot["breadthSession"] }> {
  const status = await getStatus();
  const members = primaryOnly(SPX_MEMBERS);
  const result = await getQuotes(primaryOnly(ALL_MEMBERS).map((member) => member.symbol), status);
  if (!result.ok || result.stale) return { reading: null, session: null };
  const { advancing, known } = breadthCounts(members.map((member) => member.symbol), result.data, status);
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
