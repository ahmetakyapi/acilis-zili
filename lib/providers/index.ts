import { inArray, eq, and } from "drizzle-orm";
import { db } from "../db";
import { candlesCache, quotesCache, symbols as symbolsTable } from "../schema";
import { candleTtlSeconds, quoteTtlSeconds, type MarketStatus } from "../market-hours";
import * as alpaca from "./alpaca";
import * as finnhub from "./finnhub";
import * as fred from "./fred";
import {
  fail,
  ok,
  type Bar,
  type ChartRange,
  type CompanyProfile,
  type ProviderResult,
  type Quote,
} from "./types";

export * as alpaca from "./alpaca";
export * as finnhub from "./finnhub";
export * as fred from "./fred";
export * from "./types";

/**
 * Sağlayıcı orkestrasyonu.
 *
 * Sıra her zaman aynı: canlı kaynak → yedek kaynak → Neon'daki son bilinen
 * değer. Üçü de başarısız olursa hata döner ve ekranda "veri alınamadı"
 * görünür. Hiçbir aşamada tahmini/uydurma değer üretilmez.
 */

export function providerStatus() {
  return {
    alpaca: alpaca.isAlpacaConfigured(),
    finnhub: finnhub.isFinnhubConfigured(),
    fred: fred.isFredConfigured(),
  };
}

export function isFullyConfigured(): boolean {
  const status = providerStatus();
  return status.alpaca && status.finnhub && status.fred;
}

/* --------------------------------------------------------------------------
   Fiyatlar
   -------------------------------------------------------------------------- */

/** Taze fiyatları arka planda önbelleğe yazar; hata sessizce yutulur. */
async function persistQuotes(quotes: Quote[]): Promise<void> {
  if (quotes.length === 0) return;
  try {
    await Promise.all(
      quotes.map((q) =>
        db
          .insert(quotesCache)
          .values({
            symbol: q.symbol,
            price: q.price,
            change: q.change,
            changePct: q.changePct,
            open: q.open,
            high: q.high,
            low: q.low,
            prevClose: q.prevClose,
            volume: q.volume,
            tradedAt: q.tradedAt,
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: quotesCache.symbol,
            set: {
              price: q.price,
              change: q.change,
              changePct: q.changePct,
              open: q.open,
              high: q.high,
              low: q.low,
              prevClose: q.prevClose,
              volume: q.volume,
              tradedAt: q.tradedAt,
              updatedAt: new Date(),
            },
          }),
      ),
    );
  } catch {
    // Önbellek yazımı ürünün çalışması için zorunlu değil.
  }
}

async function quotesFromCache(
  symbolList: string[],
): Promise<Record<string, Quote>> {
  try {
    const rows = await db
      .select()
      .from(quotesCache)
      .where(inArray(quotesCache.symbol, symbolList));

    const result: Record<string, Quote> = {};
    for (const row of rows) {
      if (row.price === null) continue;
      result[row.symbol] = {
        symbol: row.symbol,
        price: row.price,
        change: row.change ?? 0,
        changePct: row.changePct ?? 0,
        open: row.open,
        high: row.high,
        low: row.low,
        prevClose: row.prevClose,
        volume: row.volume,
        tradedAt: row.tradedAt,
      };
    }
    return result;
  } catch {
    return {};
  }
}

export async function getQuotes(
  symbolList: string[],
  status: MarketStatus,
): Promise<ProviderResult<Record<string, Quote>>> {
  if (symbolList.length === 0) return ok({}, "alpaca");

  const unique = [...new Set(symbolList)];
  const ttl = quoteTtlSeconds(status);

  const primary = await alpaca.getSnapshots(unique, ttl);
  if (primary.ok) {
    void persistQuotes(Object.values(primary.data));
    return primary;
  }

  // Yedek: Finnhub tek tek sorgular. Sadece küçük listelerde denenir,
  // 60 istek/dk sınırını bir sayfa yüklemesiyle tüketmemek için.
  if (unique.length <= 8 && finnhub.isFinnhubConfigured()) {
    const results = await Promise.all(
      unique.map((symbol) => finnhub.getQuote(symbol, ttl)),
    );
    const quotes: Record<string, Quote> = {};
    for (const result of results) {
      if (result.ok) quotes[result.data.symbol] = result.data;
    }
    if (Object.keys(quotes).length > 0) {
      void persistQuotes(Object.values(quotes));
      return ok(quotes, "finnhub");
    }
  }

  // Son çare: en son bilinen değer, "güncel değil" damgasıyla.
  const cached = await quotesFromCache(unique);
  if (Object.keys(cached).length > 0) {
    return ok(cached, "cache", { stale: true });
  }

  return primary;
}

/**
 * Haftalık (5 işlem günü) yüzde değişim — toplu.
 *
 * Şirketler dizininde günlük değişimin yanında duruyor: tek bir günün
 * hareketi çoğu zaman gürültü, hafta ise yönü gösteriyor. Günlük barlardan
 * hesaplandığı için gün içi fiyattan bağımsız ve uzun TTL ile önbellekli;
 * seans içinde saat başı tazelenmesi yeterli.
 *
 * Sağlayıcı düşerse boş sözlük döner ve kolon "—" gösterir; sayfanın geri
 * kalanı etkilenmez.
 */
export async function getWeeklyChanges(
  symbolList: string[],
  status: MarketStatus,
): Promise<Record<string, number>> {
  const ttl = Math.max(candleTtlSeconds("1M", status), 900);
  const result = await alpaca.getPeriodChanges(symbolList, 5, ttl);
  return result.ok ? result.data : {};
}

export async function getQuote(
  symbol: string,
  status: MarketStatus,
): Promise<ProviderResult<Quote>> {
  const result = await getQuotes([symbol], status);
  if (!result.ok) return result;

  const quote = result.data[symbol];
  if (!quote) {
    return fail("alpaca", "not-found", `${symbol} için fiyat bulunamadı`);
  }
  return ok(quote, result.source, {
    stale: result.stale,
    fetchedAt: result.fetchedAt,
  });
}

/* --------------------------------------------------------------------------
   Grafik barları
   -------------------------------------------------------------------------- */

async function persistBars(
  symbol: string,
  range: ChartRange,
  bars: Bar[],
): Promise<void> {
  try {
    await db
      .insert(candlesCache)
      .values({ symbol, timeframe: range, bars, fetchedAt: new Date() })
      .onConflictDoUpdate({
        target: [candlesCache.symbol, candlesCache.timeframe],
        set: { bars, fetchedAt: new Date() },
      });
  } catch {
    // yoksay
  }
}

export async function getChartBars(
  symbol: string,
  range: ChartRange,
  status: MarketStatus,
): Promise<ProviderResult<Bar[]>> {
  const ttl = candleTtlSeconds(range, status);
  const primary = await alpaca.getBars(symbol, range, ttl);

  if (primary.ok) {
    void persistBars(symbol, range, primary.data);
    return primary;
  }

  try {
    const [row] = await db
      .select()
      .from(candlesCache)
      .where(
        and(
          eq(candlesCache.symbol, symbol),
          eq(candlesCache.timeframe, range),
        ),
      )
      .limit(1);

    if (row?.bars) {
      return ok(row.bars as Bar[], "cache", {
        stale: true,
        fetchedAt: row.fetchedAt,
      });
    }
  } catch {
    // yoksay
  }

  return primary;
}

/* --------------------------------------------------------------------------
   Şirket profili — Finnhub'dan gelir, symbols tablosunda kalıcılaşır
   -------------------------------------------------------------------------- */

export async function getCompanyProfile(
  symbol: string,
): Promise<ProviderResult<CompanyProfile>> {
  const live = await finnhub.getProfile(symbol);

  if (live.ok) {
    try {
      const profile = live.data;
      await db
        .insert(symbolsTable)
        .values({
          symbol: profile.symbol,
          name: profile.name,
          exchange: profile.exchange,
          industry: profile.industry,
          logoUrl: profile.logoUrl,
          country: profile.country,
          currency: profile.currency,
          marketCap: profile.marketCap,
          shareOutstanding: profile.shareOutstanding,
          ipoDate: profile.ipoDate,
          weburl: profile.weburl,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: symbolsTable.symbol,
          set: {
            name: profile.name,
            exchange: profile.exchange,
            industry: profile.industry,
            logoUrl: profile.logoUrl,
            marketCap: profile.marketCap,
            shareOutstanding: profile.shareOutstanding,
            weburl: profile.weburl,
            updatedAt: new Date(),
          },
        });
    } catch {
      // yoksay
    }
    return live;
  }

  try {
    const [row] = await db
      .select()
      .from(symbolsTable)
      .where(eq(symbolsTable.symbol, symbol))
      .limit(1);

    if (row) {
      return ok(
        {
          symbol: row.symbol,
          name: row.name,
          exchange: row.exchange,
          industry: row.industry,
          logoUrl: row.logoUrl,
          country: row.country,
          currency: row.currency,
          marketCap: row.marketCap,
          shareOutstanding: row.shareOutstanding,
          ipoDate: row.ipoDate,
          weburl: row.weburl,
        },
        "cache",
        { stale: true, fetchedAt: row.updatedAt },
      );
    }
  } catch {
    // yoksay
  }

  return live;
}
