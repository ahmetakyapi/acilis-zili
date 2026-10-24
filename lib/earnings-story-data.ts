import "server-only";

import { cache } from "react";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { getAnalysis, getStatus } from "@/lib/data";
import { getAnalysisExtras } from "@/lib/earnings-extras";
import { buildStoryCards, completedCloses, storyReaction, type StoryCard } from "@/lib/earnings-story";
import { normalizeTiming } from "@/lib/expected-move";
import { HISTORY_LOOKBACK_DAYS, pastReportEvents } from "@/lib/expected-move-data";
import { addEtDays } from "@/lib/market-hours";
import { getDailyCloses } from "@/lib/providers/alpaca-options";
import { getEarningsCalendar } from "@/lib/providers/finnhub";
import { earningsCalendar, type EarningsAnalysisRow } from "@/lib/schema";

/**
 * Hikâye kartlarının veri katmanı — sayfa ve paylaşım görseli AYNI
 * okumadan çiziliyor (CLAUDE.md "Veri dürüstlüğü" 3: görseldeki sayı
 * sayfadakiyle aynı kaynaktan). Kart seçimi `lib/earnings-story.ts`.
 *
 * DÖRT KAYNAK, TEK TUR: analiz kaydı (skor, rehberlik, manşet, kayıtlı
 * EPS sapması), ekler ("30 Saniyede"), takvim satırı (beklenti ve
 * gerçekleşen) ve günlük barlar (tepki). Barların başlangıcı hisse
 * sayfasının beklenen hareket paneliyle AYNI (`HISTORY_LOOKBACK_DAYS`),
 * yani aynı istek adresi — sağlayıcının `revalidate` önbelleği iki ekranda
 * tek tur.
 */

/** Analizle aynı günün takvim satırı — beklenti ve gerçekleşen orada. */
async function calendarRowOn(symbol: string, reportDate: string) {
  try {
    const [row] = await db
      .select({
        epsEstimate: earningsCalendar.epsEstimate,
        epsActual: earningsCalendar.epsActual,
        revenueEstimate: earningsCalendar.revenueEstimate,
        revenueActual: earningsCalendar.revenueActual,
        hour: earningsCalendar.hour,
      })
      .from(earningsCalendar)
      .where(and(eq(earningsCalendar.symbol, symbol), eq(earningsCalendar.reportDate, reportDate)))
      .limit(1);
    return row ?? null;
  } catch {
    return null;
  }
}

/** Sağlayıcı takvimi aralığı — hisse sayfasının `symbolEarnings`iyle AYNI (önbellek ortak). */
const PROVIDER_PAST_DAYS = 400;
const PROVIDER_AHEAD_DAYS = 120;

export type Story = {
  row: EarningsAnalysisRow;
  cards: StoryCard[];
};

export const getStory = cache(async function getStory(
  symbol: string,
  period: string,
  locale: string,
): Promise<Story | null> {
  /* Okunamayan analiz 404 değil hata (gerekçe `lib/data.ts` → `ReadOptions`). */
  const row = await getAnalysis(symbol, period, locale, { throwOnError: true });
  if (!row) return null;
  const status = await getStatus();
  const today = status.etDate;
  /* ÖNCEKİ RAPORLAR İKİ KAYNAKTAN (24 Ekim). Yerel takvim geçmiş tarafında
     sembol başına TEK satır tutuyor (hisse sayfasının Geçmiş Bilançolar
     künyesi, `_panels/PastEarnings.tsx`); yalnız ona bakan tepki kartı
     ACN'de hiç önceki rapor bulamıyordu. Sağlayıcının sembol takvimi aynı
     aralık ve aynı parametrelerle hisse sayfasından da çağrılıyor
     (`_panels/shared.ts` → `symbolEarnings`), yani `finnhubFetch`in altı
     saatlik önbelleğinde ortak tur. Aynı gün iki kaynakta varsa saati
     bilinen kazanıyor (`historicalMoves`). */
  const [calendar, extras, events, provider, bars] = await Promise.all([
    calendarRowOn(row.symbol, row.reportDate),
    getAnalysisExtras(row.id),
    pastReportEvents(row.symbol, today).catch(() => []),
    getEarningsCalendar(addEtDays(today, -PROVIDER_PAST_DAYS), addEtDays(today, PROVIDER_AHEAD_DAYS), row.symbol).catch(
      () => null,
    ),
    getDailyCloses(row.symbol, addEtDays(today, -HISTORY_LOOKBACK_DAYS)),
  ]);
  const providerEvents = provider?.ok
    ? provider.data
        .filter((entry) => entry.reportDate < today)
        .map((entry) => ({ date: entry.reportDate, timing: normalizeTiming(entry.hour) }))
    : [];
  const timing = normalizeTiming(row.timing) ?? normalizeTiming(calendar?.hour);
  const reaction = bars.ok
    ? storyReaction({ date: row.reportDate, timing }, [...events, ...providerEvents], completedCloses(bars.data, status))
    : null;
  const cards = buildStoryCards({
    calendar,
    recorded: { eps: row.eps, epsSurprisePct: row.epsSurprisePct },
    guidance: row.guidance ?? null,
    reaction,
    takeaways: extras?.takeaways ?? null,
    headline: row.headline,
    score: row.score,
    verdict: row.verdict,
  });
  return { row, cards };
});
