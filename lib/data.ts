import { and, asc, desc, eq, gte, inArray, lte } from "drizzle-orm";
import { db } from "./db";
import {
  dailyBriefs,
  earningsCalendar,
  economicEvents,
  macroSeries,
  marketHolidays,
  news,
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
  try {
    const [row] = await db
      .select()
      .from(dailyBriefs)
      .where(
        and(eq(dailyBriefs.briefDate, todayEt()), eq(dailyBriefs.locale, locale)),
      )
      .limit(1);
    return row ?? null;
  } catch {
    return null;
  }
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

export async function getSymbolNames(
  list: string[],
): Promise<Record<string, { name: string; indexProxy: boolean }>> {
  if (list.length === 0) return {};
  try {
    const rows = await db
      .select({
        symbol: symbolsTable.symbol,
        name: symbolsTable.name,
        isIndexProxy: symbolsTable.isIndexProxy,
      })
      .from(symbolsTable)
      .where(inArray(symbolsTable.symbol, list));
    return Object.fromEntries(
      rows.map((r) => [r.symbol, { name: r.name, indexProxy: r.isIndexProxy }]),
    );
  } catch {
    return {};
  }
}

/** Takvim görünümü için hafta aralığı ("YYYY-MM-DD"). */
export function weekRange(anchor: string): { from: string; to: string } {
  return { from: anchor, to: addEtDays(anchor, 6) };
}
