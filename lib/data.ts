import { and, asc, desc, eq, gte, inArray, isNull, lte, sql } from "drizzle-orm";
import { db } from "./db";
import {
  dailyBriefs,
  earningsCalendar,
  economicEvents,
  macroSeries,
  marketHolidays,
  news,
  quotesCache as quotesCacheTable,
  symbols as symbolsTable,
  watchlistItems,
  watchlists,
  type DailyBriefRow,
  type EconomicEventRow,
  type EarningsRow,
  type MacroSeriesRow,
  type NewsRow,
} from "./schema";
import {
  addEtDays,
  getMarketStatus,
  todayEt,
  type MarketHoliday,
  type MarketStatus,
} from "./market-hours";
import type { BriefPeriod } from "./brief";

/**
 * Sayfaların kullandığı okuma fonksiyonları.
 * Hepsi hata durumunda boş değer döner — sayfa hiçbir zaman DB hatasıyla
 * çökmez, ilgili kart "veri yok" gösterir.
 */

export async function getHolidays(): Promise<MarketHoliday[]> {
  try {
    const rows = await db.select().from(marketHolidays);
    return rows.map((r) => ({
      date: r.date,
      nameTr: r.nameTr,
      nameEn: r.nameEn,
      earlyCloseEt: r.earlyCloseEt,
    }));
  } catch {
    return [];
  }
}

export async function getStatus(): Promise<MarketStatus> {
  const holidays = await getHolidays();
  return getMarketStatus(new Date(), holidays);
}

/* ---- Ekonomik takvim ---- */

export async function getEventsBetween(
  from: string,
  to: string,
): Promise<EconomicEventRow[]> {
  try {
    return await db
      .select()
      .from(economicEvents)
      .where(and(gte(economicEvents.eventDate, from), lte(economicEvents.eventDate, to)))
      .orderBy(asc(economicEvents.eventDate), asc(economicEvents.eventTimeEt));
  } catch {
    return [];
  }
}

export async function getTodayEvents(): Promise<EconomicEventRow[]> {
  const today = todayEt();
  return getEventsBetween(today, today);
}

/** Bugün olay yoksa ileriye bakan ilk N olay. */
export async function getUpcomingEvents(limit = 6): Promise<EconomicEventRow[]> {
  try {
    return await db
      .select()
      .from(economicEvents)
      .where(gte(economicEvents.eventDate, todayEt()))
      .orderBy(asc(economicEvents.eventDate), asc(economicEvents.eventTimeEt))
      .limit(limit);
  } catch {
    return [];
  }
}

/* ---- Bilanço takvimi ---- */

export async function getEarningsBetween(
  from: string,
  to: string,
): Promise<EarningsRow[]> {
  try {
    return await db
      .select()
      .from(earningsCalendar)
      .where(
        and(
          gte(earningsCalendar.reportDate, from),
          lte(earningsCalendar.reportDate, to),
        ),
      )
      .orderBy(asc(earningsCalendar.reportDate));
  } catch {
    return [];
  }
}

export async function getNextEarnings(
  symbol: string,
): Promise<EarningsRow | null> {
  try {
    const [row] = await db
      .select()
      .from(earningsCalendar)
      .where(
        and(
          eq(earningsCalendar.symbol, symbol),
          gte(earningsCalendar.reportDate, todayEt()),
        ),
      )
      .orderBy(asc(earningsCalendar.reportDate))
      .limit(1);
    return row ?? null;
  } catch {
    return null;
  }
}

export async function getEarningsForSymbol(
  symbol: string,
  limit = 8,
): Promise<EarningsRow[]> {
  try {
    return await db
      .select()
      .from(earningsCalendar)
      .where(eq(earningsCalendar.symbol, symbol))
      .orderBy(desc(earningsCalendar.reportDate))
      .limit(limit);
  } catch {
    return [];
  }
}

/* ---- Haberler ---- */

export async function getNewsById(id: string): Promise<NewsRow | null> {
  try {
    const [row] = await db.select().from(news).where(eq(news.id, id)).limit(1);
    return row ?? null;
  } catch {
    return null;
  }
}

/**
 * Görsel gerçekten habere mi ait?
 * Sağlayıcılar makale görseli yoksa kaynağın logosunu yolluyor; o logo
 * onlarca haberde tekrar eder. Aynı adres birden çok haberde geçiyorsa
 * jenerik sayılır ve gösterilmez — okuyucuya bilgi taşımaz.
 */
/**
 * Liste için toplu sürüm — her habere ayrı sorgu atmak yerine tek sorguda
 * "birden çok haberde geçen" görselleri bulur. Sağlayıcılar makale görseli
 * yoksa kaynak logosunu yolluyor; aynı URL onlarca haberde tekrar ediyor ve
 * liste aynı Reuters logosuyla doluyordu.
 */
export async function getGenericImageUrls(
  urls: (string | null)[],
): Promise<Set<string>> {
  const candidates = [...new Set(urls.filter((u): u is string => Boolean(u)))];
  if (candidates.length === 0) return new Set();

  const generic = new Set(candidates.filter((u) => /\blogo\b/i.test(u)));

  try {
    const rows = await db
      .select({
        imageUrl: news.imageUrl,
        uses: sql<number>`count(*)::int`,
      })
      .from(news)
      .where(inArray(news.imageUrl, candidates))
      .groupBy(news.imageUrl);

    for (const row of rows) {
      if (row.imageUrl && row.uses > 1) generic.add(row.imageUrl);
    }
  } catch {
    // Sorgu düşerse yalnızca ad kalıbıyla elenenler gizlenir.
  }

  return generic;
}

export async function isGenericNewsImage(imageUrl: string): Promise<boolean> {
  if (/\blogo\b/i.test(imageUrl)) return true;
  try {
    const [row] = await db
      .select({ uses: sql<number>`count(*)::int` })
      .from(news)
      .where(eq(news.imageUrl, imageUrl));
    return (row?.uses ?? 0) > 1;
  } catch {
    return false;
  }
}

export async function getLatestNews(limit = 20): Promise<NewsRow[]> {
  try {
    return await db
      .select()
      .from(news)
      .orderBy(desc(news.publishedAt))
      .limit(limit);
  } catch {
    return [];
  }
}

/* ---- Günlük özet ---- */

export async function getDailyBrief(
  locale: string,
): Promise<DailyBriefRow | null> {
  return getBriefByDate(todayEt(), locale);
}

/**
 * Belirli bir günün bülteni. Tablo (tarih, dil) benzersiz olduğu için her gün
 * kendi kaydını tutar — arşiv zaten birikmiş durumda, tek yaptığımız onu
 * okunabilir hale getirmek.
 */
export async function getBriefByDate(
  date: string,
  locale: string,
  period: BriefPeriod = "daily",
): Promise<DailyBriefRow | null> {
  try {
    const [row] = await db
      .select()
      .from(dailyBriefs)
      .where(
        and(
          eq(dailyBriefs.briefDate, date),
          eq(dailyBriefs.locale, locale),
          eq(dailyBriefs.period, period),
        ),
      )
      .limit(1);
    return row ?? null;
  } catch {
    return null;
  }
}

export type BriefIndexRow = {
  briefDate: string;
  headline: string;
  generatedBy: string;
  period: string;
};

/** Arşiv listesi — yeniden eskiye, gövde metni taşınmaz. */
export async function getBriefArchive(
  locale: string,
  period: BriefPeriod,
  limit = 60,
): Promise<BriefIndexRow[]> {
  try {
    return await db
      .select({
        briefDate: dailyBriefs.briefDate,
        headline: dailyBriefs.headline,
        generatedBy: dailyBriefs.generatedBy,
        period: dailyBriefs.period,
      })
      .from(dailyBriefs)
      .where(and(eq(dailyBriefs.locale, locale), eq(dailyBriefs.period, period)))
      .orderBy(desc(dailyBriefs.briefDate))
      .limit(limit);
  } catch {
    return [];
  }
}

/** Verilen günü kapsayan haftanın pazartesisi — haftalık kaydın çapası. */
export function weekAnchor(dateEt: string): string {
  const d = new Date(`${dateEt}T00:00:00Z`);
  // getUTCDay: 0 pazar … 6 cumartesi. Pazar, biten haftaya sayılır.
  const shift = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - shift);
  return d.toISOString().slice(0, 10);
}

/* ---- Makro ---- */

export async function getMacroRows(): Promise<MacroSeriesRow[]> {
  try {
    return await db.select().from(macroSeries).orderBy(asc(macroSeries.slug));
  } catch {
    return [];
  }
}

/* ---- Kullanıcı listeleri ---- */

export type WatchlistWithItems = {
  id: string;
  name: string;
  color: string;
  sortOrder: number;
  items: { id: string; symbol: string; note: string | null }[];
};

export async function getUserWatchlists(
  userId: string,
): Promise<WatchlistWithItems[]> {
  try {
    const lists = await db
      .select()
      .from(watchlists)
      .where(eq(watchlists.userId, userId))
      .orderBy(asc(watchlists.sortOrder), asc(watchlists.createdAt));

    if (lists.length === 0) return [];

    const items = await db
      .select()
      .from(watchlistItems)
      .where(
        inArray(
          watchlistItems.watchlistId,
          lists.map((l) => l.id),
        ),
      )
      .orderBy(asc(watchlistItems.sortOrder), asc(watchlistItems.addedAt));

    return lists.map((list) => ({
      id: list.id,
      name: list.name,
      color: list.color,
      sortOrder: list.sortOrder,
      items: items
        .filter((item) => item.watchlistId === list.id)
        .map((item) => ({ id: item.id, symbol: item.symbol, note: item.note })),
    }));
  } catch {
    return [];
  }
}

export async function getUserSymbols(userId: string): Promise<string[]> {
  const lists = await getUserWatchlists(userId);
  return [...new Set(lists.flatMap((l) => l.items.map((i) => i.symbol)))];
}

/* ---- Sembol adları (kartlarda isim göstermek için) ---- */

export type SymbolMeta = {
  name: string;
  indexProxy: boolean;
  /** Yalnızca USD cinsinden bilinen piyasa değeri — yabancı para birimleri
      (ör. TSM/TWD) karşılaştırılamaz olduğundan null sayılır. */
  marketCap: number | null;
  /** Ödenmiş hisse sayısı — canlı piyasa değeri hesabı bunu kullanır. */
  shareOutstanding: number | null;
  logoUrl: string | null;
  industry: string | null;
};

/**
 * Güncel piyasa değeri = son fiyat × hisse sayısı.
 *
 * Sağlayıcının yazdığı `marketCap` alanı profil çekildiği anın fotoğrafıdır;
 * hisse sayısı ise ancak geri alım/ihraçla, yani çeyreklerde değişir. Bu
 * yüzden değer canlı fiyattan hesaplanır ve gün içinde doğru kalır. Hisse
 * sayısı bilinmiyorsa kayıtlı değere düşülür.
 */
export function liveMarketCap(
  meta: SymbolMeta | undefined,
  price: number | null | undefined,
): number | null {
  if (!meta) return null;
  if (meta.shareOutstanding && typeof price === "number" && price > 0) {
    return meta.shareOutstanding * price;
  }
  return meta.marketCap;
}

export async function getSymbolNames(
  list: string[],
): Promise<Record<string, SymbolMeta>> {
  if (list.length === 0) return {};
  try {
    const rows = await db
      .select({
        symbol: symbolsTable.symbol,
        name: symbolsTable.name,
        isIndexProxy: symbolsTable.isIndexProxy,
        marketCap: symbolsTable.marketCap,
        currency: symbolsTable.currency,
        shareOutstanding: symbolsTable.shareOutstanding,
        logoUrl: symbolsTable.logoUrl,
        industry: symbolsTable.industry,
      })
      .from(symbolsTable)
      .where(inArray(symbolsTable.symbol, list));
    return Object.fromEntries(
      rows.map((r) => [
        r.symbol,
        {
          name: r.name,
          indexProxy: r.isIndexProxy,
          marketCap: r.currency === "USD" ? r.marketCap : null,
          shareOutstanding: r.currency === "USD" ? r.shareOutstanding : null,
          logoUrl: r.logoUrl,
          industry: r.industry,
        },
      ]),
    );
  } catch {
    return {};
  }
}

/* ---- Şirketler sayfası ---- */

export type CompanyRow = {
  symbol: string;
  name: string;
  industry: string | null;
  logoUrl: string | null;
  marketCap: number | null;
  volume: number | null;
};

/** Endeks ETF'leri hariç, profili bilinen şirketler. */
export async function getCompanies(): Promise<CompanyRow[]> {
  try {
    const rows = await db
      .select({
        symbol: symbolsTable.symbol,
        name: symbolsTable.name,
        industry: symbolsTable.industry,
        logoUrl: symbolsTable.logoUrl,
        marketCap: symbolsTable.marketCap,
        currency: symbolsTable.currency,
        volume: quotesCacheTable.volume,
      })
      .from(symbolsTable)
      .leftJoin(
        quotesCacheTable,
        eq(quotesCacheTable.symbol, symbolsTable.symbol),
      )
      .where(eq(symbolsTable.isIndexProxy, false));
    // USD dışı piyasa değeri (ör. TWD) USD ile sıralanamaz — yok sayılır.
    return rows.map((r) => ({
      ...r,
      marketCap: r.currency === "USD" ? r.marketCap : null,
    }));
  } catch {
    return [];
  }
}

/**
 * Önümüzdeki günlerin bilanço sembollerinden profili (piyasa değeri) henüz
 * bilinmeyenler — cron bunlara öncelik verir ki Bilançolar sayfasının
 * "Öne Çıkanlar" kartları dolabilsin.
 */
export async function getEarningsSymbolsMissingProfile(
  days: number,
  limit: number,
): Promise<string[]> {
  try {
    const today = todayEt();
    const rows = await db
      .select({ symbol: earningsCalendar.symbol })
      .from(earningsCalendar)
      .leftJoin(
        symbolsTable,
        eq(symbolsTable.symbol, earningsCalendar.symbol),
      )
      .where(
        and(
          gte(earningsCalendar.reportDate, today),
          lte(earningsCalendar.reportDate, addEtDays(today, days)),
          isNull(symbolsTable.marketCap),
        ),
      )
      .limit(limit * 3);
    return [...new Set(rows.map((r) => r.symbol))].slice(0, limit);
  } catch {
    return [];
  }
}

/** Profili en bayat semboller — cron her gün bir dilimini tazeler. */
export async function getStalestSymbols(limit: number): Promise<string[]> {
  try {
    const rows = await db
      .select({ symbol: symbolsTable.symbol })
      .from(symbolsTable)
      .orderBy(asc(symbolsTable.updatedAt))
      .limit(limit);
    return rows.map((r) => r.symbol);
  } catch {
    return [];
  }
}

/** Takvim görünümü için hafta aralığı ("YYYY-MM-DD"). */
export function weekRange(anchor: string): { from: string; to: string } {
  return { from: anchor, to: addEtDays(anchor, 6) };
}
