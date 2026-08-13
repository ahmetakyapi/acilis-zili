import {
  fail,
  ok,
  type CompanyProfile,
  type EarningsEntry,
  type KeyMetrics,
  type NewsItem,
  type ProviderResult,
  type Quote,
  type Recommendation,
  type SymbolSearchResult,
} from "./types";
import { withTimeout } from "./timeout";

/**
 * Finnhub — şirket meta verisi, haberler, bilanço takvimi.
 *
 * Grafik barları buradan alınmaz: ücretsiz katmanda /stock/candle güvenilir
 * değil. Fiyat için de birincil kaynak Alpaca'dır; buradaki /quote yalnızca
 * Alpaca düştüğünde devreye giren yedektir.
 */

const BASE = "https://finnhub.io/api/v1";

function apiKey(): string | null {
  return process.env.FINNHUB_API_KEY ?? null;
}

export function isFinnhubConfigured(): boolean {
  return apiKey() !== null;
}

async function finnhubFetch<T>(
  path: string,
  params: Record<string, string>,
  opts: { revalidate: number; tags?: string[] },
): Promise<ProviderResult<T>> {
  const key = apiKey();
  if (!key) {
    return fail("finnhub", "missing-key", "FINNHUB_API_KEY tanımlı değil");
  }

  const url = `${BASE}${path}?${new URLSearchParams(params).toString()}`;

  try {
    /* Süre sınırı: sağlayıcı yanıt vermeyi bırakırsa sayfa kilitlenmesin.
       Gerekçesi ve iptal edilmemesinin sebebi lib/providers/timeout.ts'te. */
    const res = await withTimeout(
      fetch(url, {
        headers: { "X-Finnhub-Token": key, accept: "application/json" },
        next: { revalidate: opts.revalidate, tags: opts.tags },
      }),
    );

    if (res.status === 429) {
      return fail("finnhub", "rate-limited", "Finnhub istek limiti aşıldı");
    }
    if (res.status === 403) {
      return fail(
        "finnhub",
        "upstream-error",
        "Finnhub bu uç noktaya erişimi reddetti (ücretsiz katman dışı olabilir)",
      );
    }
    if (!res.ok) {
      return fail("finnhub", "upstream-error", `Finnhub ${res.status}`);
    }

    return ok((await res.json()) as T, "finnhub");
  } catch (error) {
    return fail(
      "finnhub",
      "network",
      error instanceof Error ? error.message : "Finnhub'a ulaşılamadı",
    );
  }
}

/* --------------------------------------------------------------------------
   Şirket profili
   -------------------------------------------------------------------------- */

type RawProfile = {
  name?: string;
  ticker?: string;
  exchange?: string;
  finnhubIndustry?: string;
  logo?: string;
  country?: string;
  currency?: string;
  marketCapitalization?: number;
  shareOutstanding?: number;
  ipo?: string;
  weburl?: string;
};

export async function getProfile(
  symbol: string,
): Promise<ProviderResult<CompanyProfile>> {
  const result = await finnhubFetch<RawProfile>(
    "/stock/profile2",
    { symbol },
    { revalidate: 86400, tags: [`profile:${symbol}`] },
  );
  if (!result.ok) return result;

  const raw = result.data;
  if (!raw?.name) {
    return fail("finnhub", "not-found", `${symbol} için profil bulunamadı`);
  }

  return ok(
    {
      symbol,
      name: raw.name,
      exchange: raw.exchange ?? null,
      industry: raw.finnhubIndustry ?? null,
      logoUrl: raw.logo || null,
      country: raw.country ?? null,
      currency: raw.currency ?? null,
      // Finnhub piyasa değerini milyon dolar olarak verir.
      marketCap: raw.marketCapitalization
        ? raw.marketCapitalization * 1_000_000
        : null,
      shareOutstanding: raw.shareOutstanding
        ? raw.shareOutstanding * 1_000_000
        : null,
      ipoDate: raw.ipo ?? null,
      weburl: raw.weburl ?? null,
    },
    "finnhub",
    { fetchedAt: result.fetchedAt },
  );
}

/* --------------------------------------------------------------------------
   Yedek fiyat kaynağı
   -------------------------------------------------------------------------- */

type RawQuote = {
  c: number;
  d: number | null;
  dp: number | null;
  h: number;
  l: number;
  o: number;
  pc: number;
  t: number;
};

export async function getQuote(
  symbol: string,
  revalidate: number,
): Promise<ProviderResult<Quote>> {
  const result = await finnhubFetch<RawQuote>(
    "/quote",
    { symbol },
    { revalidate, tags: ["quotes"] },
  );
  if (!result.ok) return result;

  const raw = result.data;
  if (!raw || typeof raw.c !== "number" || raw.c === 0) {
    return fail("finnhub", "empty", `${symbol} için fiyat dönmedi`);
  }

  return ok(
    {
      symbol,
      price: raw.c,
      change: raw.d ?? 0,
      changePct: raw.dp ?? 0,
      open: raw.o || null,
      high: raw.h || null,
      low: raw.l || null,
      prevClose: raw.pc || null,
      volume: null,
      tradedAt: raw.t ? new Date(raw.t * 1000) : null,
    },
    "finnhub",
    { fetchedAt: result.fetchedAt },
  );
}

/* --------------------------------------------------------------------------
   Haberler
   -------------------------------------------------------------------------- */

type RawNews = {
  category?: string;
  datetime: number;
  headline: string;
  id: number;
  image?: string;
  related?: string;
  source?: string;
  summary?: string;
  url: string;
};

function toNewsItems(raw: RawNews[], fallbackSymbol?: string): NewsItem[] {
  return raw
    .filter((n) => n.headline && n.url && n.datetime)
    .map((n) => ({
      providerId: `finnhub:${n.id}`,
      headline: n.headline,
      summary: n.summary?.trim() || null,
      url: n.url,
      imageUrl: n.image || null,
      source: n.source ?? null,
      category: n.category ?? null,
      symbols: n.related
        ? n.related.split(",").filter(Boolean)
        : fallbackSymbol
          ? [fallbackSymbol]
          : [],
      publishedAt: new Date(n.datetime * 1000),
    }));
}

export async function getMarketNews(
  category = "general",
): Promise<ProviderResult<NewsItem[]>> {
  const result = await finnhubFetch<RawNews[]>(
    "/news",
    { category },
    { revalidate: 900, tags: ["news"] },
  );
  if (!result.ok) return result;

  const items = toNewsItems(result.data ?? []);
  if (items.length === 0) {
    return fail("finnhub", "empty", "Haber dönmedi");
  }
  return ok(items, "finnhub", { fetchedAt: result.fetchedAt });
}

export async function getCompanyNews(
  symbol: string,
  from: string,
  to: string,
): Promise<ProviderResult<NewsItem[]>> {
  const result = await finnhubFetch<RawNews[]>(
    "/company-news",
    { symbol, from, to },
    { revalidate: 1800, tags: [`news:${symbol}`] },
  );
  if (!result.ok) return result;

  const items = toNewsItems(result.data ?? [], symbol);
  return ok(items, "finnhub", { fetchedAt: result.fetchedAt });
}

/* --------------------------------------------------------------------------
   Bilanço takvimi
   -------------------------------------------------------------------------- */

type RawEarnings = {
  earningsCalendar?: {
    date: string;
    epsActual: number | null;
    epsEstimate: number | null;
    hour: string | null;
    quarter: number | null;
    revenueActual: number | null;
    revenueEstimate: number | null;
    symbol: string;
    year: number | null;
  }[];
};

export async function getEarningsCalendar(
  from: string,
  to: string,
  symbol?: string,
): Promise<ProviderResult<EarningsEntry[]>> {
  const params: Record<string, string> = { from, to };
  if (symbol) params.symbol = symbol;

  const result = await finnhubFetch<RawEarnings>(
    "/calendar/earnings",
    params,
    { revalidate: 21600, tags: ["earnings"] },
  );
  if (!result.ok) return result;

  const list = result.data?.earningsCalendar ?? [];
  const entries: EarningsEntry[] = list.map((e) => ({
    symbol: e.symbol,
    reportDate: e.date,
    hour: e.hour || null,
    epsEstimate: e.epsEstimate,
    epsActual: e.epsActual,
    revenueEstimate: e.revenueEstimate,
    revenueActual: e.revenueActual,
    quarter: e.quarter,
    year: e.year,
  }));

  return ok(entries, "finnhub", { fetchedAt: result.fetchedAt });
}

/* --------------------------------------------------------------------------
   Halka arz takvimi

   Ücretsiz katmanda açık olan uçlardan biri. Bilanço takvimiyle aynı desen:
   tarih aralığı sorulur, liste döner. Kayıtların bir kısmı henüz fiyat
   aralığı belirlenmemiş "expected" durumundadır; ekranda o alanlar boş
   gösterilir, uydurulmaz.
   -------------------------------------------------------------------------- */

type RawIpo = {
  ipoCalendar?: {
    date: string;
    exchange: string | null;
    name: string;
    numberOfShares: number | null;
    price: string | null;
    status: string | null;
    symbol: string;
    totalSharesValue: number | null;
  }[];
};

export type IpoEntry = {
  date: string;
  symbol: string;
  name: string;
  exchange: string | null;
  /** "15.00-17.00" ya da "10.00" — sağlayıcı serbest metin veriyor. */
  priceRange: string | null;
  shares: number | null;
  /** Toplam arz büyüklüğü (dolar). */
  totalValue: number | null;
  /** expected | priced | filed | withdrawn */
  status: string | null;
};

export async function getIpoCalendar(
  from: string,
  to: string,
): Promise<ProviderResult<IpoEntry[]>> {
  const result = await finnhubFetch<RawIpo>(
    "/calendar/ipo",
    { from, to },
    { revalidate: 21600, tags: ["ipo"] },
  );
  if (!result.ok) return result;

  const list = result.data?.ipoCalendar ?? [];
  const entries: IpoEntry[] = list
    // Geri çekilmiş arzlar takvimde yer tutmasın.
    .filter((e) => (e.status ?? "").toLowerCase() !== "withdrawn")
    .map((e) => ({
      date: e.date,
      symbol: e.symbol,
      name: e.name,
      exchange: e.exchange,
      priceRange: e.price || null,
      shares: e.numberOfShares,
      totalValue: e.totalSharesValue,
      status: e.status,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return ok(entries, "finnhub", { fetchedAt: result.fetchedAt });
}

/* --------------------------------------------------------------------------
   Bilanço geçmişi — earnings surprises
   Ücretsiz katman son 4 çeyreğin EPS beklenti/gerçekleşen çiftini verir;
   takvim tablosunun kapsamadığı geçmiş için tek güvenilir kaynak.
   -------------------------------------------------------------------------- */

type RawSurprise = {
  actual: number | null;
  estimate: number | null;
  period: string;
  quarter: number | null;
  symbol: string;
  year: number | null;
};

export type EarningsSurprise = {
  /** Çeyreğin bittiği tarih (YYYY-MM-DD). */
  period: string;
  epsEstimate: number | null;
  epsActual: number | null;
  quarter: number | null;
  year: number | null;
};

export async function getEarningsSurprises(
  symbol: string,
): Promise<ProviderResult<EarningsSurprise[]>> {
  const result = await finnhubFetch<RawSurprise[]>(
    "/stock/earnings",
    { symbol },
    { revalidate: 21600, tags: [`surprises:${symbol}`] },
  );
  if (!result.ok) return result;

  const list = (result.data ?? [])
    .filter((row) => row.period)
    .map((row) => ({
      period: row.period,
      epsEstimate: row.estimate,
      epsActual: row.actual,
      quarter: row.quarter,
      year: row.year,
    }));

  if (list.length === 0) {
    return fail("finnhub", "empty", `${symbol} için bilanço geçmişi yok`);
  }
  return ok(list, "finnhub", { fetchedAt: result.fetchedAt });
}

/* --------------------------------------------------------------------------
   Analist tavsiyeleri ve metrikler
   -------------------------------------------------------------------------- */

type RawRecommendation = {
  period: string;
  strongBuy: number;
  buy: number;
  hold: number;
  sell: number;
  strongSell: number;
};

export async function getRecommendations(
  symbol: string,
): Promise<ProviderResult<Recommendation[]>> {
  const result = await finnhubFetch<RawRecommendation[]>(
    "/stock/recommendation",
    { symbol },
    { revalidate: 86400, tags: [`reco:${symbol}`] },
  );
  if (!result.ok) return result;

  const list = result.data ?? [];
  if (list.length === 0) {
    return fail("finnhub", "empty", "Analist verisi yok");
  }
  return ok(list, "finnhub", { fetchedAt: result.fetchedAt });
}

type RawMetrics = {
  metric?: Record<string, number | null>;
};

export async function getKeyMetrics(
  symbol: string,
): Promise<ProviderResult<KeyMetrics>> {
  const result = await finnhubFetch<RawMetrics>(
    "/stock/metric",
    { symbol, metric: "all" },
    { revalidate: 86400, tags: [`metrics:${symbol}`] },
  );
  if (!result.ok) return result;

  const m = result.data?.metric;
  if (!m) return fail("finnhub", "empty", "Metrik verisi yok");

  return ok(
    {
      peRatio: m.peTTM ?? m.peBasicExclExtraTTM ?? null,
      eps: m.epsTTM ?? m.epsBasicExclExtraItemsTTM ?? null,
      dividendYield: m.dividendYieldIndicatedAnnual ?? null,
      beta: m.beta ?? null,
      high52: m["52WeekHigh"] ?? null,
      low52: m["52WeekLow"] ?? null,
      bookValuePerShare:
        m.bookValuePerShareQuarterly ?? m.bookValuePerShareAnnual ?? null,
      debtToEquity:
        m["totalDebt/totalEquityQuarterly"] ??
        m["totalDebt/totalEquityAnnual"] ??
        null,
      cashPerShare:
        m.cashPerSharePerShareQuarterly ?? m.cashPerSharePerShareAnnual ?? null,
      netMarginPct: m.netProfitMarginTTM ?? null,
    },
    "finnhub",
    { fetchedAt: result.fetchedAt },
  );
}

/* --------------------------------------------------------------------------
   Sembol arama
   -------------------------------------------------------------------------- */

type RawSearch = {
  count?: number;
  result?: {
    description: string;
    displaySymbol: string;
    symbol: string;
    type: string;
  }[];
};

export async function searchSymbols(
  query: string,
): Promise<ProviderResult<SymbolSearchResult[]>> {
  const result = await finnhubFetch<RawSearch>(
    "/search",
    { q: query, exchange: "US" },
    { revalidate: 3600, tags: ["search"] },
  );
  if (!result.ok) return result;

  const list = (result.data?.result ?? [])
    // Nokta içeren semboller çoğunlukla ABD dışı listelemeler.
    .filter((r) => r.symbol && !r.symbol.includes("."))
    .slice(0, 12)
    .map((r) => ({
      symbol: r.displaySymbol || r.symbol,
      description: r.description,
      type: r.type ?? null,
    }));

  return ok(list, "finnhub", { fetchedAt: result.fetchedAt });
}
