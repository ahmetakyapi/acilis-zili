import "server-only";

import { and, eq, lt } from "drizzle-orm";
import { db } from "@/lib/db";
import { earningsAnalyses, earningsCalendar } from "@/lib/schema";
import { addEtDays, type MarketStatus } from "@/lib/market-hours";
import { getQuote } from "@/lib/providers";
import { getDailyCloses, getOptionQuotes } from "@/lib/providers/alpaca-options";
import {
  ATM_MAX_DISTANCE,
  averageAbsMove,
  historicalMoves,
  impliedMove,
  normalizeTiming,
  type HistoricalMove,
  type ImpliedMove,
  type ReportEvent,
  type ReportTiming,
} from "@/lib/expected-move";

/**
 * Beklenen hareket panelinin veri katmanı — hesaplar `lib/expected-move.ts`.
 */

/**
 * Geçmiş rapor tarihleri İKİ yerel kaynaktan.
 *
 * Finnhub'ın sembol bazlı takvimi geçmişi ücretsiz katmanda döndürmüyor
 * (28 Eylül: NVDA için 2023–2026 aralığı yalnızca GELECEK raporu verdi) ve
 * sürpriz ucunun `period`ı çeyreğin bittiği gün, açıklandığı gün değil. Rapor
 * günü + saati elimizde yalnızca şuralarda var: cron'un yazdığı takvim
 * tablosu (Temmuz 2026'dan beri birikiyor) ve bilanço analizlerinin kaydı.
 * İkisi birleşiyor, aynı gün tek satır (saati bilinen kazanır). Tablo
 * zamanla doldukça panel sekiz rapora kendiliğinden ulaşıyor; bugün çoğu
 * sembolde bir iki satır var ve ekran bunu olduğu gibi söylüyor.
 */
async function pastReportEvents(symbol: string, today: string): Promise<ReportEvent[]> {
  const [calendar, analyses] = await Promise.all([
    db
      .select({ date: earningsCalendar.reportDate, hour: earningsCalendar.hour })
      .from(earningsCalendar)
      .where(and(eq(earningsCalendar.symbol, symbol), lt(earningsCalendar.reportDate, today)))
      .catch(() => []),
    db
      .selectDistinct({ date: earningsAnalyses.reportDate, timing: earningsAnalyses.timing })
      .from(earningsAnalyses)
      .where(and(eq(earningsAnalyses.symbol, symbol), lt(earningsAnalyses.reportDate, today)))
      .catch(() => []),
  ]);
  return [
    ...calendar.map((row) => ({ date: row.date, timing: normalizeTiming(row.hour) })),
    ...analyses.map((row) => ({ date: row.date, timing: normalizeTiming(row.timing) })),
  ];
}

/** Vade penceresi: raporu kapsayan ilk vade genellikle aynı haftanın cuması. */
const EXPIRY_WINDOW_DAYS = 14;
/** Geçmiş hareket için kaç gün geri — sekiz çeyrek + pay. */
const HISTORY_LOOKBACK_DAYS = 800;

export type ExpectedMoveData = {
  next: { date: string; timing: ReportTiming };
  history: HistoricalMove[];
  average: { avg: number; count: number } | null;
  /** Opsiyon kotasyonu hiç gelmediyse null; geldiyse sonuç ya da sebep. */
  implied: ImpliedMove | null;
  spot: number | null;
  optionsFetchedAt: Date | null;
  barsFetchedAt: Date | null;
};

export async function getExpectedMove(
  symbol: string,
  next: { date: string; timing: ReportTiming },
  status: MarketStatus,
): Promise<ExpectedMoveData> {
  const today = status.etDate;
  const [events, closes, quote] = await Promise.all([
    pastReportEvents(symbol, today),
    getDailyCloses(symbol, addEtDays(today, -HISTORY_LOOKBACK_DAYS)),
    getQuote(symbol, status),
  ]);
  const series = closes.ok ? closes.data : [];
  const history = historicalMoves(events, series, today);

  /* SPOT, OPSİYONLA AYNI ANIN FİYATI. Opsiyonlar yalnızca ana seansta
     kotasyon alıyor: seans dışında elimizdeki kotasyon son kapanışın, o
     yüzden bölen de son ANA SEANS kapanışı — ön seans fiyatı değil. Ana
     seans açıkken canlı (15 dakika gecikmeli) kotasyon; bayatsa hiç. */
  const lastClosed = series.filter((bar) => (status.session === "after-hours" || status.session === "closed" ? true : bar.date < today)).at(-1);
  const spot =
    status.session === "regular"
      ? quote.ok && !quote.stale
        ? quote.data.price
        : null
      : (lastClosed?.close ?? null);

  let implied: ImpliedMove | null = null;
  let optionsFetchedAt: Date | null = null;
  if (spot !== null) {
    const options = await getOptionQuotes(
      symbol,
      next.date,
      addEtDays(next.date, EXPIRY_WINDOW_DAYS),
      spot * (1 - ATM_MAX_DISTANCE * 2),
      spot * (1 + ATM_MAX_DISTANCE * 2),
    );
    if (options.ok) {
      optionsFetchedAt = options.fetchedAt;
      implied = impliedMove({ quotes: options.data, spot, reportDate: next.date, timing: next.timing, now: new Date() });
    }
  }

  return {
    next,
    history,
    average: averageAbsMove(history),
    implied,
    spot,
    optionsFetchedAt,
    barsFetchedAt: closes.ok ? closes.fetchedAt : null,
  };
}
