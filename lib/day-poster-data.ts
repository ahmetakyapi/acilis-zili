import "server-only";

import { cache } from "react";
import { unstable_cache } from "next/cache";
import { SPX_MEMBERS, primaryOnly } from "@/db/seed/indices";
import { INDEX_STRIP, SECTOR_FUNDS } from "@/db/seed/symbols";
import { getHolidays, getStatus } from "@/lib/data";
import {
  archivePosters,
  archiveSessions,
  buildPoster,
  latestPosterDate,
  posterComplete,
  posterReadyAt,
  posterRetryable,
  type DayPoster,
} from "@/lib/day-poster";
import { addEtDays, prevTradingDay, todayEt, type MarketStatus } from "@/lib/market-hours";
import { alpaca } from "@/lib/providers";

/**
 * Günün Posteri'nin veri tarafı — kararların kendisi `lib/day-poster.ts`te.
 *
 * TEK KAYNAK, ÜÇ YÜZEY. Poster sayfası (`/gun/[tarih]`), paylaşım görseli
 * (`/gun/[tarih]/gorsel`) ve ana sayfanın kapanış künyesi (`DaySeal`) aynı
 * `getDayPoster` çağrısını yapıyor: kahramandaki "312 Yükseldi" ile
 * posterdeki aynı sayı (CLAUDE.md "Veri dürüstlüğü" 3).
 *
 * Kaynak Alpaca'nın gün barları — o günün ve önceki işlem gününün
 * kapanışları, ~530 sembol için üç istek (`getDailyBarsBetween`). Kotasyon
 * DEĞİL: kapanıştan sonra kotasyonun yüzdesi akşam seansının işlemini de
 * taşıyabiliyor (`quoteBasis` → "after-hours"), poster ise asıl seansı
 * anlatıyor.
 *
 * GENİŞLİK BUGÜNKÜ ÜYE LİSTESİYLE. Geçmiş bileşim elimizde yok
 * (`db/seed/indices.ts` tek liste); bir yıl önceki bir günde o gün endekste
 * olmayan birkaç şirket sayılıyor, çıkmış olanlar sayılmıyor. Künye bunu
 * yazıyor (sözlük `daySignature.poster.breadthNote`).
 */

const SECTOR_SYMBOLS = SECTOR_FUNDS.map((fund) => fund.symbol);
const MEMBER_SYMBOLS = primaryOnly(SPX_MEMBERS).map((member) => member.symbol);
const POSTER_SYMBOLS = [...new Set([...SECTOR_SYMBOLS, ...INDEX_STRIP, ...MEMBER_SYMBOLS])];

/** Önceki işlem gününden bu kadar takvim günü geri başlanıyor: barın
 *  tarihi sağlayıcıda bir gün kaysa da aralığın içinde kalsın. */
const START_PAD_DAYS = 3;

/** Tamamlanmış bir seansın barları değişmiyor; bir gün tutmak bol. */
const POSTER_REVALIDATE_SECONDS = 86_400;
/** Son günlerin HAM bar isteği bu kadar tutuluyor: eksik çıkan yeni bir
 *  seans (`posterRetryable`) en geç on beş dakikada yeniden soruluyor.
 *  Kurulan poster yine bir gün önbellekte; bu yalnız önbellek kaçtığında
 *  sağlayıcıya giden isteğin ömrü. */
const POSTER_RETRY_SECONDS = 900;

export type PosterRead =
  | { state: "ok"; poster: DayPoster; fetchedAt: string }
  | { state: "missing" }
  | { state: "error" };

class PosterFetchError extends Error {}

/** Yeni seansın eksiği: önbelleğe girmesin diye fırlatılıyor, dışarıda
 *  `missing`e dönüyor. Ad üstünden tanınıyor (sınıf kimliği önbellek
 *  katmanından geçerken korunmayabilir). */
const POSTER_PENDING = "PosterPending";

/* Önbelleğe YALNIZCA SONUÇ girer: sağlayıcı hatası fırlatılıyor ve
   önbelleğin dışında yakalanıyor (CLAUDE.md "İstekler arası önbellek").
   Eksik veri (`null`) eski bir gün için bir sonuç — o gün veri yok, bir
   gün sonra yeniden sorulur. YENİ bir seans için değil (`posterRetryable`):
   o pencerede `null` fırlatılıyor ve önbelleğe girmiyor, ham istek de
   yalnız on beş dakika tutuluyor. Anahtar sürümlü: şekil değişirse `-v3`. */
const loadPoster = unstable_cache(
  async function loadPoster(date: string, prevDate: string, readyIso: string, retryable: boolean) {
    const result = await alpaca.getDailyBarsBetween(
      POSTER_SYMBOLS,
      addEtDays(prevDate, -START_PAD_DAYS),
      new Date(readyIso),
      retryable ? POSTER_RETRY_SECONDS : POSTER_REVALIDATE_SECONDS,
    );
    if (!result.ok) throw new PosterFetchError(`${result.reason}: ${result.message}`);
    const poster = buildPoster({
      date,
      prevDate,
      bars: result.data,
      sectorSymbols: SECTOR_SYMBOLS,
      indexSymbols: INDEX_STRIP,
      memberSymbols: MEMBER_SYMBOLS,
    });
    if (!poster && retryable) {
      const pending = new Error(`${date} henüz eksik`);
      pending.name = POSTER_PENDING;
      throw pending;
    }
    return poster ? { poster, fetchedAt: result.fetchedAt.toISOString() } : null;
  },
  ["day-poster-v2"],
  { revalidate: POSTER_REVALIDATE_SECONDS },
);

/**
 * Bir seansın posteri. Tamamlanmamış ya da işlem günü olmayan tarih
 * `missing`; sağlayıcı düştüyse `error` (sayfa hata sınırına gider, 404
 * vermez: "okunamadı" ile "yok" ayrı şeyler — bkz. `lib/data.ts`).
 */
export const getDayPoster = cache(async function getDayPoster(date: string): Promise<PosterRead> {
  const holidays = await getHolidays();
  if (!posterComplete(date, holidays, new Date())) return { state: "missing" };
  const prevDate = prevTradingDay(date, holidays);
  try {
    const loaded = await loadPoster(
      date,
      prevDate,
      posterReadyAt(date, holidays).toISOString(),
      posterRetryable(date, todayEt()),
    );
    return loaded ? { state: "ok", ...loaded } : { state: "missing" };
  } catch (error) {
    if (error instanceof Error && error.name === POSTER_PENDING) return { state: "missing" };
    console.error(`[poster] ${date} okunamadı: ${error instanceof Error ? error.message : String(error)}`);
    return { state: "error" };
  }
});

/** En yeni tamamlanmış seansın tarihi (ET). */
export async function getLatestPosterDate(status?: MarketStatus): Promise<string> {
  const [holidays, current] = await Promise.all([getHolidays(), status ?? getStatus()]);
  return latestPosterDate(current.etDate, holidays, new Date());
}

/** Arşivin bar aralığı: en eski seansın önceki işlem gününden pay kadar geri. */
const archiveLoad = unstable_cache(
  async function archiveLoad(latest: string, readyIso: string, start: string, sessionsJson: string) {
    const sessions = JSON.parse(sessionsJson) as { date: string; prevDate: string }[];
    const result = await alpaca.getDailyBarsBetween(POSTER_SYMBOLS, start, new Date(readyIso), POSTER_RETRY_SECONDS);
    if (!result.ok) throw new PosterFetchError(`${result.reason}: ${result.message}`);
    const posters = archivePosters({
      sessions,
      bars: result.data,
      sectorSymbols: SECTOR_SYMBOLS,
      indexSymbols: INDEX_STRIP,
      memberSymbols: MEMBER_SYMBOLS,
    });
    /* En yeni seans eksikse liste önbelleğe girmiyor: `getDayPoster` ile
       aynı gerekçe, o seans birazdan tamamlanacak. */
    if (posters[0]?.date !== latest) {
      const pending = new Error(`${latest} arşivde henüz eksik`);
      pending.name = POSTER_PENDING;
      throw pending;
    }
    return { posters, fetchedAt: result.fetchedAt.toISOString() };
  },
  ["day-poster-archive-v1"],
  { revalidate: POSTER_REVALIDATE_SECONDS },
);

export type PosterArchiveRead =
  | { state: "ok"; latest: string; posters: DayPoster[]; fetchedAt: string }
  | { state: "error" };

/**
 * Arşiv — son `POSTER_ARCHIVE_SESSIONS` seansın TAM posterleri (gerekçe
 * `archivePosters`, lib/day-poster.ts). Bir tur: ~530 sembolün altı
 * haftalık gün barı. En yeni seans henüz eksikse bir önceki seanstan
 * başlıyor (o liste önbelleğe girebilir); sağlayıcı düşerse `error`.
 */
export const getPosterArchive = cache(async function getPosterArchive(): Promise<PosterArchiveRead> {
  const status = await getStatus();
  const holidays = await getHolidays();
  const newest = latestPosterDate(status.etDate, holidays, new Date());
  const attempt = async (latest: string) => {
    const sessions = archiveSessions(latest, holidays);
    const oldest = sessions[sessions.length - 1];
    const start = addEtDays(oldest.prevDate, -START_PAD_DAYS);
    const loaded = await archiveLoad(latest, posterReadyAt(latest, holidays).toISOString(), start, JSON.stringify(sessions));
    return { state: "ok" as const, latest, ...loaded };
  };
  try {
    try {
      return await attempt(newest);
    } catch (error) {
      if (!(error instanceof Error && error.name === POSTER_PENDING)) throw error;
      return await attempt(prevTradingDay(newest, holidays));
    }
  } catch (error) {
    if (error instanceof Error && error.name === POSTER_PENDING) return { state: "error" };
    console.error(`[poster] arşiv okunamadı: ${error instanceof Error ? error.message : String(error)}`);
    return { state: "error" };
  }
});
