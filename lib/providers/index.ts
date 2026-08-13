import { cache } from "react";
import { inArray, eq, and, sql } from "drizzle-orm";
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
import { logoSrc } from "@/lib/logos";

export * as alpaca from "./alpaca";
export * as finnhub from "./finnhub";
export * as fred from "./fred";
export * as tcmb from "./tcmb";
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

/**
 * Tek yazmada kaç satır — Postgres'in 65535 parametre sınırının çok altında
 * (11 kolon × 500 = 5500) ve tek bir HTTP gövdesine rahat sığıyor.
 */
const QUOTE_WRITE_BATCH = 500;

/**
 * Taze fiyatları önbelleğe yazar; hata sessizce yutulur.
 *
 * TEK SORGU olması şart. Eskiden her kotasyon ayrı bir `db.insert()` idi ve
 * `Promise.all` ile paralel atılıyordu; neon-http'de her sorgu ayrı bir HTTP
 * gidiş-dönüşü olduğu için Şirketler dizini (513 sembol) TEK sayfa
 * görüntülemede 513 istek üretiyordu. Üstelik Alpaca yanıtı Data Cache'ten
 * gelse bile bu yazma çalıştığı için önbellek isabeti de aynı bedeli
 * ödüyordu.
 *
 * Artık çok satırlı tek upsert: 513 istek → 2 istek. `excluded.*` ile her
 * satır kendi yeni değerini alır.
 *
 * Beklenerek çağrılır. Eskiden `void` ile bırakılıyordu ve sunucusuz
 * fonksiyon yanıtı döndükten sonra donduğunda yazma yarıda kesilebiliyordu;
 * tek gidiş-dönüşün maliyeti (~20ms) bu belirsizliğe değmez.
 */
async function persistQuotes(quotes: Quote[]): Promise<void> {
  if (quotes.length === 0) return;

  const now = new Date();
  const rows = quotes.map((q) => ({
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
    updatedAt: now,
  }));

  try {
    for (let i = 0; i < rows.length; i += QUOTE_WRITE_BATCH) {
      await db
        .insert(quotesCache)
        .values(rows.slice(i, i + QUOTE_WRITE_BATCH))
        .onConflictDoUpdate({
          target: quotesCache.symbol,
          set: {
            price: sql`excluded.price`,
            change: sql`excluded.change`,
            changePct: sql`excluded.change_pct`,
            open: sql`excluded.open`,
            high: sql`excluded.high`,
            low: sql`excluded.low`,
            prevClose: sql`excluded.prev_close`,
            volume: sql`excluded.volume`,
            tradedAt: sql`excluded.traded_at`,
            updatedAt: sql`excluded.updated_at`,
          },
        });
    }
  } catch {
    // Önbellek yazımı ürünün çalışması için zorunlu değil.
  }
}

/**
 * Son çare: Neon önbelleğindeki son bilinen fiyat.
 *
 * KAYITLARIN YAŞI DA DÖNER. Eskiden yalnızca değerler dönüyordu ve çağıran
 * `ok(cached, "cache", { stale: true })` yazıyordu; `ok()` damga verilmediğinde
 * `new Date()` koyuyor, yani ekranda "önbellek · 14:32 güncellendi" görünüyordu
 * — 14:32 verinin yazıldığı an değil, SAYFANIN ÇİZİLDİĞİ an. Fiyat dünden
 * kalmış olabilirken damga onu az önce alınmış gösteriyordu; projenin
 * "bayat veriyi taze gibi gösterme" kuralının doğrudan ihlali.
 */
async function quotesFromCache(
  symbolList: string[],
): Promise<{ quotes: Record<string, Quote>; oldest: Date | null }> {
  try {
    const rows = await db
      .select()
      .from(quotesCache)
      .where(inArray(quotesCache.symbol, symbolList));

    const result: Record<string, Quote> = {};
    let oldest: Date | null = null;
    for (const row of rows) {
      if (row.price === null) continue;
      /* En ESKİ damga alınıyor, en yenisi değil: kartta tek bir tarih
         yazılıyor ve o tarih "bu ekrandaki en bayat sayı ne kadar eski"
         sorusunu cevaplamalı. */
      if (row.updatedAt && (!oldest || row.updatedAt < oldest)) {
        oldest = row.updatedAt;
      }
      result[row.symbol] = {
        symbol: row.symbol,
        price: row.price,
        change: row.change,
        changePct: row.changePct,
        open: row.open,
        high: row.high,
        low: row.low,
        prevClose: row.prevClose,
        volume: row.volume,
        tradedAt: row.tradedAt,
      };
    }
    return { quotes: result, oldest };
  } catch {
    return { quotes: {}, oldest: null };
  }
}

/**
 * Kotasyon çekmenin gerçek gövdesi — sarmalayıcı aşağıda.
 *
 * AYNI İSTEKTE İKİ KEZ ÇALIŞMAMALI. Alpaca çağrısı Next'in `fetch`
 * belleklemesiyle zaten tekilleşiyordu ama ardından gelen `persistQuotes`
 * tekilleşmiyordu: hisse sayfası aynı sembolün kotasyonunu dört ayrı
 * bileşende soruyor (başlık, grafik, metrikler, uygunluk kartı) ve tek
 * satırlık aynı upsert dört kez Neon'a gidiyordu. Ana sayfada da benzeri
 * vardı — endeks şeridi ile layout'taki şerit aynı satırları iki kez
 * yazıyordu.
 */
async function fetchQuotes(
  symbolList: string[],
  status: MarketStatus,
): Promise<ProviderResult<Record<string, Quote>>> {
  if (symbolList.length === 0) return ok({}, "alpaca");

  const unique = [...new Set(symbolList)];
  const ttl = quoteTtlSeconds(status);

  const primary = await alpaca.getSnapshots(unique, ttl);
  if (primary.ok) {
    await persistQuotes(Object.values(primary.data));
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
      await persistQuotes(Object.values(quotes));
      return ok(quotes, "finnhub");
    }
  }

  // Son çare: en son bilinen değer, "güncel değil" damgasıyla.
  const cached = await quotesFromCache(unique);
  if (Object.keys(cached.quotes).length > 0) {
    return ok(cached.quotes, "cache", {
      stale: true,
      fetchedAt: cached.oldest ?? undefined,
    });
  }

  return primary;
}

/* React `cache()` argümanları KİMLİĞE göre eşliyor: her çağıran kendi
   dizisini yazdığı için `["NVDA"]` hiçbir zaman aynı dizi olmuyordu ve
   önbellek hiç tutmuyordu. Anahtar bu yüzden sıralı ve birleştirilmiş bir
   dize. `status` ise `getStatus()`ten geliyor ve o da `cache()`li, yani
   istek boyunca aynı nesne referansı. */
const quotesForKey = cache(async function quotesForKey(
  key: string,
  status: MarketStatus,
): Promise<ProviderResult<Record<string, Quote>>> {
  return fetchQuotes(key ? key.split(",") : [], status);
});

export async function getQuotes(
  symbolList: string[],
  status: MarketStatus,
): Promise<ProviderResult<Record<string, Quote>>> {
  const unique = [...new Set(symbolList)].sort();
  return quotesForKey(unique.join(","), status);
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

/** Çoklu bar yazması — tek upsert. */
async function persistBarsMulti(
  range: ChartRange,
  bySymbol: Record<string, Bar[]>,
): Promise<void> {
  const entries = Object.entries(bySymbol);
  if (entries.length === 0) return;
  try {
    const now = new Date();
    await db
      .insert(candlesCache)
      .values(
        entries.map(([symbol, bars]) => ({
          symbol,
          timeframe: range,
          bars,
          fetchedAt: now,
        })),
      )
      .onConflictDoUpdate({
        target: [candlesCache.symbol, candlesCache.timeframe],
        set: {
          bars: sql`excluded.bars`,
          fetchedAt: sql`excluded.fetched_at`,
        },
      });
  } catch {
    // yoksay
  }
}

/**
 * Birden çok sembolün grafik barları.
 *
 * `getChartBars` tek sembolle çalışıyor ve çağıranlar döngüde çağırıyordu:
 * giriş yapmış bir kullanıcının ana sayfası tek çizimde 12 Alpaca isteği +
 * 12 Neon yazması üretiyordu. Sağlayıcı çoklu sembolü zaten destekliyor,
 * yazma da tek upsert'e sığıyor.
 *
 * Sağlayıcı düşerse önbellekteki son barlara düşülür — tek sembollük
 * yoldaki davranışın aynısı, tek sorguda.
 */
export async function getChartBarsMulti(
  symbolList: string[],
  range: ChartRange,
  status: MarketStatus,
): Promise<Record<string, Bar[]>> {
  const unique = [...new Set(symbolList)];
  if (unique.length === 0) return {};

  const ttl = candleTtlSeconds(range, status);
  const primary = await alpaca.getBarsMulti(unique, range, ttl);
  const out: Record<string, Bar[]> = primary.ok ? { ...primary.data } : {};

  if (primary.ok && Object.keys(primary.data).length > 0) {
    await persistBarsMulti(range, primary.data);
  }

  const missing = unique.filter((symbol) => !out[symbol]);
  if (missing.length === 0) return out;

  try {
    const rows = await db
      .select()
      .from(candlesCache)
      .where(
        and(
          inArray(candlesCache.symbol, missing),
          eq(candlesCache.timeframe, range),
        ),
      );
    for (const row of rows) {
      if (row.bars) out[row.symbol] = row.bars as Bar[];
    }
  } catch {
    // yoksay
  }

  return out;
}

export async function getChartBars(
  symbol: string,
  range: ChartRange,
  status: MarketStatus,
): Promise<ProviderResult<Bar[]>> {
  const ttl = candleTtlSeconds(range, status);
  const primary = await alpaca.getBars(symbol, range, ttl);

  if (primary.ok) {
    // Beklenerek çağrılır: tek gidiş-dönüş, ve `void` bırakıldığında
    // sunucusuz fonksiyon donunca yazma yarıda kesilebiliyordu.
    await persistBars(symbol, range, primary.data);
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
    /* Veritabanına KAYNAK adresi yazılıyor (indirme betiği onu okuyor),
       ekrana dönen ise yerel dosya. İkisi ayrı: biri kaynak kaydı, öteki
       sunum. Gerekçe `lib/logos.ts`'te. */
    return ok(
      { ...live.data, logoUrl: logoSrc(live.data.symbol, live.data.logoUrl) },
      live.source,
      { fetchedAt: live.fetchedAt, stale: live.stale },
    );
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
          logoUrl: logoSrc(row.symbol, row.logoUrl),
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
