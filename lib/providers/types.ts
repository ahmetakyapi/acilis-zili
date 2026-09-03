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
  /** Neon önbelleğinden gelen eski veri mi? */
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
  "alpaca" | "finnhub" | "fred" | "tcmb" | "cache" | "seed";

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

/**
 * Yanıtın gerçekten ne zaman üretildiği — `Date` başlığından.
 *
 * NEDEN GEREKLİ: `ok()` çağrıldığı anı damgalıyor ve sağlayıcı sarmalayıcıları
 * onu her istekte yeniden çağırıyor. Ama aradaki `fetch` Next'in veri
 * önbelleğinden dönebilir: şirket profili 24 saat, makro serileri saatlerce
 * önbellekli. Sonuç, ekranda "Finnhub · 20:56 Güncellendi" yazan bir künyenin
 * altında bir gün önce çekilmiş bir kaydın durmasıydı — projenin kendi
 * kuralının ("eski veriyi güncelmiş gibi gösterme") tam ihlali. Damga
 * yalanmıyordu bile: hiç kimsenin bakmadığı bir saati, RENDER anını basıyordu.
 *
 * Next önbellek isabetinde yanıtı BAŞLIKLARIYLA birlikte yeniden kuruyor,
 * yani `Date` başlığı ilk çekimin saatini taşımaya devam ediyor. Aranan sayı
 * tam olarak bu. Sağlayıcının saati kendi sunucusunun saati ama fark
 * saniyeler mertebesinde; önemli olan gün ve saattir.
 *
 * Başlık yoksa `undefined` döner ve `ok()` eski davranışına düşer — bir
 * gerileme değil, bugünkü durumun aynısı.
 */
export function responseDate(res: Response): Date | undefined {
  const raw = res.headers.get("date");
  if (!raw) return undefined;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
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
  /**
   * Tavsiyelerin toplandığı kotasyon — sorulan sembolle aynı olmayabilir.
   * Finnhub ADR'lerde şirketin ANA borsasının sembolünü döndürüyor
   * (TSM → "2330.TW"). Ekranda bunu söylemek şart: 419 dolarlık ADR
   * fiyatının yanında duran dağılım Tayvan kotasyonu için toplanmış.
   */
  symbol: string;
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
  /**
   * İleriye dönük F/K — sağlayıcının analist beklentilerinden kurduğu oran.
   *
   * TTM F/K'nin aksine BU ALAN OLDUĞU GİBİ GÖSTERİLİYOR ve sebebi şu:
   * ileri EPS elimizde yok. Kendi takvimimiz yalnızca otuz gün ileri gidiyor
   * (cron penceresi), yani dört çeyreklik bir beklenti toplayamıyoruz;
   * `peRatioOf` gibi canlı fiyattan yeniden kurmanın yolu kapalı.
   *
   * Oranın kendisi PARA BİRİMİNDEN BAĞIMSIZ: pay da payda da ana borsanın
   * parasında, bölümde sadeleşiyor. Bu yüzden `eps` ve 52 hafta bandının
   * aksine ADR'lerde de doğru okunuyor — onlar mutlak tutar, bu bir oran.
   *
   * ETF'lerde ve fonlarda gelmiyor (ölçüldü: SPY ve QQQ boş), gerçek
   * şirketlerde geniş kapsamlı. Gelmezse satır hiç yazılmaz.
   */
  forwardPe: number | null;
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
