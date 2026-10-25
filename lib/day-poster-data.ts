import "server-only";

import { cache } from "react";
import { unstable_cache } from "next/cache";
import { NDX_MEMBERS, primaryOnly } from "@/db/seed/indices";
import { INDEX_STRIP } from "@/db/seed/symbols";
import { getHolidays, getStatus, getSymbolNames, liveMarketCap } from "@/lib/data";
import {
  archivePosters,
  archiveSessions,
  packArchiveCloses,
  unpackArchiveBars,
  type ArchiveCloses,
  buildPoster,
  latestPosterDate,
  posterComplete,
  posterReadyAt,
  posterRetryable,
  type DayPoster,
} from "@/lib/day-poster";
import { districtsOf, skylineStocks, type District, type SkyStock } from "@/lib/day-skyline";
import { addEtDays, prevTradingDay, todayEt, type MarketStatus } from "@/lib/market-hours";
import { alpaca } from "@/lib/providers";

/**
 * Günün Posteri'nin veri tarafı — kararların kendisi `lib/day-poster.ts`te.
 *
 * TEK KAYNAK, DÖRT YÜZEY. Poster sayfası (`/gun/[tarih]`), paylaşım görseli
 * (`/gun/[tarih]/gorsel`), arşiv minyatürü ve ana sayfanın siluet şeridi
 * (`SkylineStrip`) aynı `getDayPoster` çağrısını yapıyor: şeritteki "38
 * Yükseldi" ile posterdeki aynı sayı (CLAUDE.md "Veri dürüstlüğü" 3).
 *
 * Kaynak Alpaca'nın gün barları — o günün ve önceki işlem gününün
 * kapanışları, Nasdaq 100 üyeleri ve dört endeks fonu (~105 sembol, tek
 * istek; `getDailyBarsBetween`). Kotasyon
 * DEĞİL: kapanıştan sonra kotasyonun yüzdesi akşam seansının işlemini de
 * taşıyabiliyor (`quoteBasis` → "after-hours"), poster ise asıl seansı
 * anlatıyor.
 *
 * GENİŞLİK BUGÜNKÜ ÜYE LİSTESİYLE. Geçmiş bileşim elimizde yok
 * (`db/seed/indices.ts` → `NDX_MEMBERS`, tek liste); bir yıl önceki bir günde o gün endekste
 * olmayan birkaç şirket sayılıyor, çıkmış olanlar sayılmıyor. Künye bunu
 * yazıyor (sözlük `daySignature.poster.breadthNote`).
 */

/* Aynı şirketin ikinci sınıfı (GOOG) düşüyor: siluette Alphabet iki bina
   olmasın, genişlik sayımında iki kez sayılmasın. */
const MEMBERS = primaryOnly(NDX_MEMBERS);
const MEMBER_SYMBOLS = MEMBERS.map((member) => member.symbol);
const POSTER_SYMBOLS = [...new Set([...INDEX_STRIP, ...MEMBER_SYMBOLS])];

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
   yalnız on beş dakika tutuluyor. Anahtar sürümlü: `-v3` (25 Ekim) posterin
   hisse başına değişimi (`stocks`) eklendiğinde; `-v4` poster Nasdaq 100'e
   geçip `sectors` alanı kalktığında (aynı gün); şekil değişirse `-v5`. */
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
  ["day-poster-v4"],
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

/** Arşivin bar aralığı: en eski seansın önceki işlem gününden pay kadar
 *  geri. Önbelleğe posterler değil KAPANIŞLAR giriyor (`ArchiveCloses`,
 *  gerekçesi lib/day-poster.ts): otuz tam poster Next'in 2 MB'lık kayıt
 *  sınırının yarısını geçiyordu. Ölçüm (25 Ekim, 23 Ekim'de biten arşiv,
 *  514 sembol × 31 gün, kaydın `JSON.stringify` uzunluğu): eski kayıt
 *  918.158 bayt, yenisi 107.940; kapanışlardan yeniden kurulan otuz poster
 *  eskisiyle bire bir aynı. Kayıt şekli değişti → `-v3`. Nasdaq 100'e
 *  geçince sembol kümesi değişti (aynı kapanış şekli, başka semboller)
 *  ve kayıt küçüldü → `-v4`. Ölçüm (25 Ekim, aynı yöntem, 23 Ekim'de
 *  biten arşiv, 106 sembol × 31 gün): 23.117 bayt, S&P 500 kaydının
 *  beşte biri. */
const archiveLoad = unstable_cache(
  async function archiveLoad(latest: string, readyIso: string, start: string, sessionsJson: string) {
    const sessions = JSON.parse(sessionsJson) as { date: string; prevDate: string }[];
    const result = await alpaca.getDailyBarsBetween(POSTER_SYMBOLS, start, new Date(readyIso), POSTER_RETRY_SECONDS);
    if (!result.ok) throw new PosterFetchError(`${result.reason}: ${result.message}`);
    const closes = packArchiveCloses(sessions, result.data);
    /* En yeni seans eksikse liste önbelleğe girmiyor: `getDayPoster` ile
       aynı gerekçe, o seans birazdan tamamlanacak. */
    const newest = buildArchive(sessions, closes)[0];
    if (newest?.date !== latest) {
      const pending = new Error(`${latest} arşivde henüz eksik`);
      pending.name = POSTER_PENDING;
      throw pending;
    }
    return { closes, fetchedAt: result.fetchedAt.toISOString() };
  },
  ["day-poster-archive-v4"],
  { revalidate: POSTER_REVALIDATE_SECONDS },
);

function buildArchive(sessions: readonly { date: string; prevDate: string }[], closes: ArchiveCloses): DayPoster[] {
  return archivePosters({
    sessions,
    bars: unpackArchiveBars(closes),
    indexSymbols: INDEX_STRIP,
    memberSymbols: MEMBER_SYMBOLS,
  });
}

export type PosterArchiveRead =
  | { state: "ok"; latest: string; posters: DayPoster[]; fetchedAt: string }
  | { state: "error" };

/**
 * Arşiv — son `POSTER_ARCHIVE_SESSIONS` seansın TAM posterleri (gerekçe
 * `archivePosters`, lib/day-poster.ts); önbellekteki kapanışlardan her
 * istekte yeniden kuruluyor (React `cache` ile istek başına bir kez). Bir
 * tur: ~105 sembolün altı haftalık gün barı. En yeni seans henüz eksikse
 * bir önceki seanstan başlıyor (o liste önbelleğe girebilir); sağlayıcı düşerse `error`.
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
    return { state: "ok" as const, latest, posters: buildArchive(sessions, loaded.closes), fetchedAt: loaded.fetchedAt };
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

/**
 * SİLUETİN BİNALARI (25 Ekim) — posterin hisse başına değişimi, adı,
 * mahallesi ve piyasa değeri (`lib/day-skyline.ts` → `skylineStocks`),
 * ve mahalleler güçlüden zayıfa (`districtsOf`).
 *
 * PİYASA DEĞERİ O GÜNÜN KAPANIŞIYLA: hisse sayısı × posterin gününün
 * kapanışı (`liveMarketCap`, aynı mertebe denetimiyle). Bugünkü fiyatla
 * çizilse bir yıl önceki bir günün binaları bugünün enini taşırdı. Hisse
 * sayısı bugünkü (geçmiş sayı elimizde yok); geri alım yılda birkaç yüzde
 * oynatıyor, binanın eninde görünmez.
 *
 * Sembol tablosu okunamazsa (veritabanı düştü) binalar EŞİT genişlikte ve
 * mahallelerin değişimi eşit ağırlıklı: konum, boy ve renk yine doğru;
 * künye bunu söylüyor (`sized: false`). React `cache`: aynı posterin
 * binaları bir istekte bir kez kuruluyor (sayfa, meta ve şerit aynı
 * çağrıyı yapıyor); `getSymbolNames` zaten istek içi önbellekli.
 */
export type PosterSkyline = { stocks: SkyStock[]; districts: District[]; sized: boolean };

export const getPosterSkyline = cache(async function getPosterSkyline(poster: DayPoster): Promise<PosterSkyline> {
  const meta = await getSymbolNames(MEMBER_SYMBOLS);
  const sized = Object.keys(meta).length > 0;
  const stocks = skylineStocks(poster.stocks, MEMBERS, (symbol, close) => (sized ? liveMarketCap(meta[symbol], close) : null));
  return { stocks, districts: districtsOf(stocks), sized };
});
