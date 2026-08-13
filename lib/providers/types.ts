/**
 * Sağlayıcı sözleşmesi.
 *
 * Kural: sağlayıcı fonksiyonları asla throw etmez. Hata bir değer olarak
 * döner, çağıran taraf onu ekranda "veri alınamadı" olarak gösterir ve
 * sayfanın geri kalanı çalışmaya devam eder. Uydurma veri üretilmez.
 */

export type ProviderOk<T> = {
  ok: true;
  data: T;
  source: DataSource;
  fetchedAt: Date;
  /** Neon önbelleğinden gelen bayat veri mi? */
  stale?: boolean;
};

export type ProviderFail = {
  ok: false;
  source: DataSource;
  reason: FailReason;
  message: string;
};

export type ProviderResult<T> = ProviderOk<T> | ProviderFail;

export type DataSource =
  | "alpaca"
  | "finnhub"
  | "fred"
  | "tcmb"
  | "cache"
  | "seed";

export type FailReason =
  | "missing-key"
  | "rate-limited"
  | "not-found"
  | "upstream-error"
  | "network"
  | "empty";

export function ok<T>(
  data: T,
  source: DataSource,
  extra: { stale?: boolean; fetchedAt?: Date } = {},
): ProviderOk<T> {
  return {
    ok: true,
    data,
    source,
    fetchedAt: extra.fetchedAt ?? new Date(),
    stale: extra.stale,
  };
}

export function fail(
  source: DataSource,
  reason: FailReason,
  message: string,
): ProviderFail {
  return { ok: false, source, reason, message };
}

/* --------------------------------------------------------------------------
   Alan modelleri — sağlayıcıdan bağımsız, uygulamanın kendi tipleri
   -------------------------------------------------------------------------- */

export type Quote = {
  symbol: string;
  price: number;
  /**
   * Önceki kapanışa göre değişim — VERİ YOKSA NULL, sıfır değil.
   *
   * Sağlayıcı `prevDailyBar` göndermediğinde bu alanlar 0'a çekiliyordu ve
   * ekranda "bugün fiyat hiç değişmedi" diye okunuyordu: hisse yatay renkte,
   * "+0,00" ve "%0,00" basılı. Oysa doğru cümle "önceki kapanışı
   * bilmiyoruz". Aynı sıfırlama üç yerdeydi — Alpaca anlık görüntüsü,
   * Finnhub yedeği ve Neon önbelleği.
   *
   * Sıfır artık gerçekten "değişmedi" demek.
   */
  change: number | null;
  changePct: number | null;
  open: number | null;
  high: number | null;
  low: number | null;
  prevClose: number | null;
  volume: number | null;
  tradedAt: Date | null;
};

export type Bar = {
  /** Unix saniye — lightweight-charts bu formatı bekler. */
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export const CHART_RANGES = [
  "1D",
  "1W",
  "1M",
  "3M",
  "6M",
  "YTD",
  "1Y",
  "5Y",
] as const;

export type ChartRange = (typeof CHART_RANGES)[number];

export function isChartRange(value: unknown): value is ChartRange {
  return (
    typeof value === "string" &&
    (CHART_RANGES as readonly string[]).includes(value)
  );
}

export type CompanyProfile = {
  symbol: string;
  name: string;
  exchange: string | null;
  industry: string | null;
  logoUrl: string | null;
  country: string | null;
  currency: string | null;
  marketCap: number | null;
  shareOutstanding: number | null;
  ipoDate: string | null;
  weburl: string | null;
};

export type NewsItem = {
  providerId: string;
  headline: string;
  summary: string | null;
  url: string;
  imageUrl: string | null;
  source: string | null;
  category: string | null;
  symbols: string[];
  publishedAt: Date;
};

export type EarningsEntry = {
  symbol: string;
  reportDate: string;
  /** bmo | amc | dmh | null */
  hour: string | null;
  epsEstimate: number | null;
  epsActual: number | null;
  revenueEstimate: number | null;
  revenueActual: number | null;
  quarter: number | null;
  year: number | null;
};

export type Recommendation = {
  period: string;
  strongBuy: number;
  buy: number;
  hold: number;
  sell: number;
  strongSell: number;
};

export type KeyMetrics = {
  /**
   * Sağlayıcının hazır F/K'si — EKRANDA KULLANMA, geriden gelen bir fiyattan
   * hesaplanıyor. Ölçüsü ve doğrusu `peRatioOf` (lib/utils.ts) yorumunda;
   * oran `eps` ile gösterilen fiyattan kurulur.
   */
  peRatio: number | null;
  /** Hisse başı kâr, TTM. F/K'nin böleni. */
  eps: number | null;
  dividendYield: number | null;
  beta: number | null;
  high52: number | null;
  low52: number | null;
  /** Katılım taraması için bilanço oranları — hisse başına. */
  bookValuePerShare: number | null;
  debtToEquity: number | null;
  cashPerShare: number | null;
  /** Gelirin yüzde kaçı net kâra dönüyor — TTM, yüzde olarak (56.46). */
  netMarginPct: number | null;
};

export type MacroObservation = {
  /** "YYYY-MM-DD" */
  date: string;
  value: number;
};

export type MacroSeriesData = {
  seriesId: string;
  observations: MacroObservation[];
  latestValue: number | null;
  prevValue: number | null;
  periodLabel: string | null;
};

export type SymbolSearchResult = {
  symbol: string;
  description: string;
  type: string | null;
};
