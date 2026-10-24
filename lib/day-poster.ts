import {
  FEED_DELAY_MINUTES,
  addEtDays,
  closeMinutesFor,
  etDateTimeToUtc,
  isTradingDay,
  prevTradingDay,
  type MarketHoliday,
} from "./market-hours";
import { barDate, pctChange } from "./period-returns";
import type { Bar } from "./providers/types";
import { MIN_BREADTH_COVERAGE } from "./sentiment";
import { clockOf } from "./session-clock";

/**
 * GÜNÜN POSTERİ — tamamlanmış bir seansın tek görsellik özeti (24 Ekim).
 *
 * Bu dosya SAF: veritabanına ve sağlayıcıya dokunmuyor, ki her karar test
 * edilebilsin (tests/day-poster.test.ts). Veri tarafı
 * `lib/day-poster-data.ts`, çizim `lib/ink/poster.ts`, sayfa `/gun/[tarih]`.
 *
 * Posterin sözü tek cümle: "bu sahnede gördüğün her şey O GÜNÜN kapanışı".
 * O yüzden kararların hepsi aynı soruya bakıyor — bu sayı gerçekten bu
 * seansa mı ait (CLAUDE.md "Veri dürüstlüğü" 4)?
 *   - Seans TAMAMLANMIŞ olmalı (`posterComplete`): asıl seansın kapanışı +
 *     besleme gecikmesi + pay. Gün barı akşam seansını içermiyor (ölçüm
 *     `lib/providers/alpaca.ts` → `getDailyBarsBetween`), yani akşam
 *     seansının bitmesini beklemek gerekmiyor.
 *   - Her yüzde İKİ BELİRLİ GÜNÜN kapanışından: posterin günü ve ondan
 *     önceki işlem günü. Serideki "son iki bar" değil; bir sembolün o gün
 *     barı yoksa (işlem durdu, veri eksik) yüzdesi YOK, önceki günün
 *     yüzdesi onun yerine geçmiyor (`dayChange`).
 */

/* --------------------------------------------------------------------------
   Tarih ve tamamlanma
   -------------------------------------------------------------------------- */

/**
 * Kapanıştan sonra beklenen PAY (dakika), gecikmenin üstüne. Kapanış
 * müzayedesinin baskısı 16:00'yı birkaç saniye geçiyor ve günlük bar onu
 * 16:00 dakikasında topluyor (ölçüm: SPY 23 Ekim, 20:00Z dakikası 759,99,
 * 20:01Z 759,97 = gün barının kapanışı). Beş dakika bu kuyruğu rahat kapsıyor.
 */
export const POSTER_SETTLE_MINUTES = 5;

/** Kabul edilen en eski gün: bir yıl. Açılış Kartı'nın penceresiyle aynı
 *  gerekçe (`lib/day-card.ts`): sınırsız tarih, sınırsız ayrı istek demek. */
export const POSTER_PAST_DAYS = 365;

/** Paylaşım görselinin ölçüsü — sosyal ağ kartı (`/gun/[tarih]/gorsel`). */
export const POSTER_OG_SIZE = { width: 1200, height: 630 } as const;

/** Arşiv listesinde kaç seans — altı haftaya yakın. */
export const POSTER_ARCHIVE_SESSIONS = 30;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Adresteki tarih: biçim, gerçek bir gün ve pencere. Geçersizse `null` → 404. */
export function parsePosterDate(raw: string, today: string): string | null {
  if (!ISO_DATE.test(raw)) return null;
  const parsed = new Date(`${raw}T12:00:00Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== raw) return null;
  if (raw < addEtDays(today, -POSTER_PAST_DAYS) || raw > today) return null;
  return raw;
}

/** Seansın posterinin basılabildiği an: o günün kendi kapanışı (yarım gün
 *  dahil) + besleme gecikmesi + pay. */
export function posterReadyAt(date: string, holidays: MarketHoliday[]): Date {
  const minutes = closeMinutesFor(date, holidays) + FEED_DELAY_MINUTES + POSTER_SETTLE_MINUTES;
  return etDateTimeToUtc(date, clockOf(minutes));
}

/** O gün bir seans mıydı ve verisi tamamlandı mı? */
export function posterComplete(date: string, holidays: MarketHoliday[], now: Date): boolean {
  return isTradingDay(date, holidays) && now.getTime() >= posterReadyAt(date, holidays).getTime();
}

/**
 * En yeni tamamlanmış seans. `etDate` (takvim günü) bir işlem günüyse ve
 * tamamlandıysa o; değilse geriye doğru ilk tamamlanmış işlem günü.
 * Cumartesi → cuma, salı 10:00 → pazartesi, salı 16:25 ET → salı.
 */
export function latestPosterDate(etDate: string, holidays: MarketHoliday[], now: Date): string {
  if (posterComplete(etDate, holidays, now)) return etDate;
  return prevTradingDay(etDate, holidays);
}

/* --------------------------------------------------------------------------
   Yüzdeler
   -------------------------------------------------------------------------- */

/**
 * Bir sembolün `date` günündeki değişimi: o günün kapanışı / `prevDate`
 * kapanışı. İki günden biri seride yoksa `null`.
 */
export function dayChange(bars: readonly Bar[] | undefined, date: string, prevDate: string): number | null {
  if (!bars) return null;
  let close: number | null = null;
  let prev: number | null = null;
  for (const bar of bars) {
    const day = barDate(bar);
    if (day === date) close = bar.close;
    else if (day === prevDate) prev = bar.close;
  }
  if (close === null || prev === null) return null;
  return pctChange(prev, close);
}

export type PosterMove = { symbol: string; change: number };

export type PosterBreadth = {
  advancing: number;
  declining: number;
  unchanged: number;
  /** Değişimi hesaplanabilen üye sayısı. */
  known: number;
  /** Listedeki üye sayısı (bugünkü S&P 500 bileşimi). */
  members: number;
};

/**
 * Genişlik: değişimi bilinen üyelerden kaçı yükseldi, kaçı düştü.
 * Kapsam Piyasa Nabzı'nınkiyle aynı eşiğin (`MIN_BREADTH_COVERAGE`)
 * altındaysa genişlik YOK: üyelerin üçte biriyle "piyasanın yarısı
 * yükseldi" demek uydurma kesinlik olurdu.
 */
export function breadthOf(changes: ReadonlyMap<string, number | null>, members: readonly string[]): PosterBreadth | null {
  let advancing = 0;
  let declining = 0;
  let unchanged = 0;
  for (const symbol of members) {
    const change = changes.get(symbol);
    if (change === null || change === undefined) continue;
    if (change > 0) advancing += 1;
    else if (change < 0) declining += 1;
    else unchanged += 1;
  }
  const known = advancing + declining + unchanged;
  if (members.length === 0 || known / members.length < MIN_BREADTH_COVERAGE) return null;
  return { advancing, declining, unchanged, known, members: members.length };
}

/* --------------------------------------------------------------------------
   Poster
   -------------------------------------------------------------------------- */

export type DayPoster = {
  /** ET seans günü. */
  date: string;
  /** Yüzdelerin tabanı olan önceki işlem günü. */
  prevDate: string;
  /** On bir sektör fonu, günün değişimine göre GÜÇLÜDEN ZAYIFA. */
  sectors: PosterMove[];
  /** Endeks fonları, `INDEX_STRIP` sırasında; değişimi olmayan düşer. */
  indices: PosterMove[];
  breadth: PosterBreadth | null;
};

/**
 * Posteri kurar ya da `null` döner (sayfa 404). Şartlar: on bir sektörün
 * TAMAMI ve S&P 500 fonu. Eksik sektörlü bir poster sıralamada boşluk
 * bırakırdı ve okuyucu eksik kulvarı "yatay" sanardı.
 */
export function buildPoster({
  date,
  prevDate,
  bars,
  sectorSymbols,
  indexSymbols,
  memberSymbols,
  anchor = "SPY",
}: {
  date: string;
  prevDate: string;
  bars: Readonly<Record<string, Bar[]>>;
  sectorSymbols: readonly string[];
  indexSymbols: readonly string[];
  memberSymbols: readonly string[];
  anchor?: string;
}): DayPoster | null {
  const change = (symbol: string) => dayChange(bars[symbol], date, prevDate);
  const sectors: PosterMove[] = [];
  for (const symbol of sectorSymbols) {
    const value = change(symbol);
    if (value === null) return null;
    sectors.push({ symbol, change: value });
  }
  sectors.sort((a, b) => b.change - a.change || a.symbol.localeCompare(b.symbol, "en"));
  const indices = indexSymbols.flatMap((symbol) => {
    const value = change(symbol);
    return value === null ? [] : [{ symbol, change: value }];
  });
  if (!indices.some((move) => move.symbol === anchor)) return null;
  const memberChanges = new Map(memberSymbols.map((symbol) => [symbol, change(symbol)] as const));
  return { date, prevDate, sectors, indices, breadth: breadthOf(memberChanges, memberSymbols) };
}

/* --------------------------------------------------------------------------
   Ölçek ve zilin şiddeti
   -------------------------------------------------------------------------- */

/**
 * ÖLÇEĞİN TABANI (yüzde puan) — sektör siluetiyle aynı (MarketTexture.tsx →
 * `SECTOR_SCALE_FLOOR`): ±%0,2'lik sakin bir günün en uzun şeridi %3'lük
 * bir günün şeridiyle aynı boyda durmasın. Şekil sakinliği kendisi söylüyor.
 */
export const POSTER_SCALE_FLOOR = 1;

/** Kulvar şeritlerinin ortak ölçeği: günün en büyük mutlak hareketi, tabanlı. */
export function posterScale(poster: Pick<DayPoster, "sectors" | "indices">): number {
  const moves = [...poster.sectors, ...poster.indices].map((move) => Math.abs(move.change));
  return Math.max(POSTER_SCALE_FLOOR, ...moves);
}

/** Yükselenlerin payı (0…1), yatay kalanlar dışarıda. Karşı taraf yoksa `null`. */
export function advanceShare(breadth: PosterBreadth): number | null {
  const moved = breadth.advancing + breadth.declining;
  return moved > 0 ? breadth.advancing / moved : null;
}

/**
 * ZİLİN ŞİDDETİ (0…1) — günün TEK YÖNLÜLÜĞÜ, büyüklüğü değil.
 *
 * Ölçü genişlik: yükselenlerin payı yarıdan ne kadar uzak. %70/%30'a kadar
 * sıradan bir gün (0); oradan %95/%5'e doğrusal olarak tam şiddete çıkıyor.
 * Eşikler bir piyasa kuralı DEĞİL, bu sitenin seçimi: amaç her gün değil,
 * yalnız belirgin biçimde tek yöne gitmiş günlerde zilin fark edilir
 * biçimde daha sert çalması. Abartısız kalsın diye sahne bu sayıyla
 * yalnızca salınımın genliğini ve çınlamanın yayını büyütüyor
 * (lib/ink/scenes.ts → `makeHeroTap`).
 */
const ENERGY_FROM = 0.4;
const ENERGY_SPAN = 0.5;

export function bellEnergy(breadth: PosterBreadth | null): number {
  if (!breadth) return 0;
  const share = advanceShare(breadth);
  if (share === null) return 0;
  const lean = Math.abs(share - 0.5) * 2;
  return Math.min(1, Math.max(0, (lean - ENERGY_FROM) / ENERGY_SPAN));
}

/** Sahnenin tohumu tarihten: aynı gün her yerde aynı fırça dokusu. */
export function posterSeed(date: string): number {
  let hash = 2166136261;
  for (const char of date) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % 100_000;
}

/* --------------------------------------------------------------------------
   Arşiv
   -------------------------------------------------------------------------- */

/**
 * Arşivin seansları — en yeniden geriye, `limit` işlem günü. Her biri
 * kendi önceki işlem günüyle (posterin kuralı: iki BELİRLİ kapanış).
 * Takvim saf: tatil listesinden; barı olmayan gün `archivePosters`ta düşer.
 */
export function archiveSessions(
  latest: string,
  holidays: MarketHoliday[],
  limit = POSTER_ARCHIVE_SESSIONS,
): { date: string; prevDate: string }[] {
  const out: { date: string; prevDate: string }[] = [];
  let date = isTradingDay(latest, holidays) ? latest : prevTradingDay(latest, holidays);
  while (out.length < limit) {
    const prevDate = prevTradingDay(date, holidays);
    out.push({ date, prevDate });
    date = prevDate;
  }
  return out;
}

/**
 * ARŞİVİN POSTERLERİ (25 Ekim) — her seans için TAM poster: sektörler,
 * endeksler VE genişlik. İlk sürüm arşivde /piyasalar'ın bir yıllık fon
 * barlarını okuyordu ve genişlik yoktu ("30 ayrı tur" gerekçesiyle); oysa
 * ~530 sembolün altı haftalık gün barı da posterin kendisi gibi ÜÇ istek
 * (200'lük paket × ~35 bar = 7.000 < 10.000 sayfa sınırı). Böylece arşiv
 * kartı posterin küçük hâlini taşıyabiliyor: genişlik şeridi ve on bir
 * kulvar, posterle AYNI `buildPoster`dan. Kurulamayan gün (sektörü eksik)
 * listeden düşüyor, boşluk bırakmıyor.
 */
export function archivePosters({
  sessions,
  bars,
  sectorSymbols,
  indexSymbols,
  memberSymbols,
}: {
  sessions: readonly { date: string; prevDate: string }[];
  bars: Readonly<Record<string, Bar[]>>;
  sectorSymbols: readonly string[];
  indexSymbols: readonly string[];
  memberSymbols: readonly string[];
}): DayPoster[] {
  return sessions.flatMap(({ date, prevDate }) => {
    const poster = buildPoster({ date, prevDate, bars, sectorSymbols, indexSymbols, memberSymbols });
    return poster ? [poster] : [];
  });
}

/**
 * YENİ SEANSIN EKSİĞİ GEÇİCİDİR (25 Ekim). Kapanıştan hemen sonra bir
 * sektör fonunun gün barı sağlayıcıda birkaç dakika geç belirebiliyor;
 * `buildPoster`ın `null`u o an "veri yok" değil "henüz yok" demek. Bu
 * pencerede `null` ÖNBELLEĞE GİRMEZ (bkz. `lib/day-poster-data.ts`): ilk
 * sürüm onu 86.400 sn tutuyordu ve o akşam künye, poster ve görsel 24 saat
 * 404 veriyordu. Beş takvim günü bir uzun hafta sonunu da kapsıyor.
 */
export const POSTER_RETRY_DAYS = 5;

export function posterRetryable(date: string, today: string): boolean {
  return date >= addEtDays(today, -POSTER_RETRY_DAYS);
}
