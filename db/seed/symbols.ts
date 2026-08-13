/**
 * Başlangıç sembol listesi.
 *
 * Buradaki isimler yalnızca arama ve ilk açılış içindir; sektör, piyasa değeri
 * ve şirket tanımı Finnhub profilinden gelir ve `symbols` tablosunu günceller.
 *
 * ABD endekslerinin kendisi (^GSPC, ^IXIC) çoğu ücretsiz API'de yok. Onları
 * takip eden ETF'ler proxy olarak kullanılır ve ekranda bu açıkça yazılır —
 * QQQ, Nasdaq 100'ün kendisi değil onu izleyen fondur.
 */

export type SymbolSeed = {
  symbol: string;
  name: string;
  isIndexProxy?: boolean;
  /** Endeks kartlarında gösterilecek ad. */
  indexLabelTr?: string;
  indexLabelEn?: string;
};

export const INDEX_PROXIES: SymbolSeed[] = [
  {
    symbol: "QQQ",
    name: "Invesco QQQ Trust",
    isIndexProxy: true,
    indexLabelTr: "Nasdaq 100",
    indexLabelEn: "Nasdaq 100",
  },
  {
    symbol: "SPY",
    name: "SPDR S&P 500 ETF Trust",
    isIndexProxy: true,
    indexLabelTr: "S&P 500",
    indexLabelEn: "S&P 500",
  },
  {
    symbol: "DIA",
    name: "SPDR Dow Jones Industrial Average ETF",
    isIndexProxy: true,
    indexLabelTr: "Dow Jones",
    indexLabelEn: "Dow Jones",
  },
  {
    symbol: "IWM",
    name: "iShares Russell 2000 ETF",
    isIndexProxy: true,
    indexLabelTr: "Russell 2000",
    indexLabelEn: "Russell 2000",
  },
];

export const POPULAR_SYMBOLS: SymbolSeed[] = [
  /* Yeni halka arzlar — henüz endeks üyesi değiller.
     S&P 500 ve Nasdaq-100 üyeliği listelenmeden hemen sonra gelmiyor
     (S&P'de olağan koşul bir yıllık işlem geçmişi, Nasdaq-100'de yıllık
     yeniden yapılandırma). Bu yüzden `indices.ts`'ten türeyen evrene
     düşmüyorlar ve elle buraya yazılıyorlar; endekse girdiklerinde
     indices.ts tazelendiğinde oradan da gelecekler. */
  { symbol: "SPCX", name: "SpaceX" }, // Nasdaq, 12 Haziran 2026
  { symbol: "SKHY", name: "SK hynix Inc. (ADR)" }, // Nasdaq, 10 Temmuz 2026

  /* Adla seçilen evren — `lib/spotlight.ts`. Buradaki kopya arama ve temiz
     kurulum içindir: liste orada tek başına da çalışıyor (cron profilleri
     kendisi çekiyor) ama sıfırdan kurulan bir veritabanında bu şirketlerin
     araması ilk cron koşumuna kadar boş dönüyordu. */
  { symbol: "CRWV", name: "CoreWeave Inc." },
  { symbol: "NBIS", name: "Nebius Group N.V." },
  { symbol: "BE", name: "Bloom Energy Corporation" },
  { symbol: "RKLB", name: "Rocket Lab Corporation" },
  { symbol: "ASTS", name: "AST SpaceMobile Inc." },
  { symbol: "ONDS", name: "Ondas Holdings Inc." },
  { symbol: "SHAZ", name: "SharonAI Holdings Inc." },
  { symbol: "AAOI", name: "Applied Optoelectronics Inc." },

  // Yapay zekâ ve yarı iletken
  { symbol: "NVDA", name: "NVIDIA Corporation" },
  { symbol: "AMD", name: "Advanced Micro Devices" },
  { symbol: "AVGO", name: "Broadcom Inc." },
  { symbol: "TSM", name: "Taiwan Semiconductor Manufacturing" },
  { symbol: "MU", name: "Micron Technology" },
  { symbol: "INTC", name: "Intel Corporation" },
  { symbol: "QCOM", name: "QUALCOMM Incorporated" },
  { symbol: "ARM", name: "Arm Holdings plc" },
  { symbol: "MRVL", name: "Marvell Technology" },
  { symbol: "SMCI", name: "Super Micro Computer" },
  { symbol: "ASML", name: "ASML Holding N.V." },
  { symbol: "LRCX", name: "Lam Research Corporation" },
  { symbol: "AMAT", name: "Applied Materials" },
  { symbol: "KLAC", name: "KLA Corporation" },
  { symbol: "TXN", name: "Texas Instruments" },
  { symbol: "ADI", name: "Analog Devices" },

  // Mega cap teknoloji
  { symbol: "AAPL", name: "Apple Inc." },
  { symbol: "MSFT", name: "Microsoft Corporation" },
  { symbol: "GOOGL", name: "Alphabet Inc. Class A" },
  { symbol: "AMZN", name: "Amazon.com Inc." },
  { symbol: "META", name: "Meta Platforms Inc." },
  { symbol: "TSLA", name: "Tesla Inc." },
  { symbol: "NFLX", name: "Netflix Inc." },

  // Yapay zekâ ve bulut yazılımı
  { symbol: "PLTR", name: "Palantir Technologies" },
  { symbol: "SNOW", name: "Snowflake Inc." },
  { symbol: "CRM", name: "Salesforce Inc." },
  { symbol: "NOW", name: "ServiceNow Inc." },
  { symbol: "ORCL", name: "Oracle Corporation" },
  { symbol: "IBM", name: "International Business Machines" },
  { symbol: "ADBE", name: "Adobe Inc." },
  { symbol: "PANW", name: "Palo Alto Networks" },
  { symbol: "CRWD", name: "CrowdStrike Holdings" },
  { symbol: "DDOG", name: "Datadog Inc." },
  { symbol: "MDB", name: "MongoDB Inc." },
  { symbol: "NET", name: "Cloudflare Inc." },

  // Finans
  { symbol: "JPM", name: "JPMorgan Chase & Co." },
  { symbol: "BAC", name: "Bank of America Corporation" },
  { symbol: "GS", name: "The Goldman Sachs Group" },
  { symbol: "V", name: "Visa Inc." },
  { symbol: "MA", name: "Mastercard Incorporated" },
  { symbol: "BRK.B", name: "Berkshire Hathaway Inc. Class B" },

  // Sağlık
  { symbol: "LLY", name: "Eli Lilly and Company" },
  { symbol: "UNH", name: "UnitedHealth Group" },
  { symbol: "JNJ", name: "Johnson & Johnson" },
  { symbol: "MRK", name: "Merck & Co." },
  { symbol: "ABBV", name: "AbbVie Inc." },

  // Tüketim, enerji, sanayi
  { symbol: "WMT", name: "Walmart Inc." },
  { symbol: "COST", name: "Costco Wholesale Corporation" },
  { symbol: "PG", name: "The Procter & Gamble Company" },
  { symbol: "KO", name: "The Coca-Cola Company" },
  { symbol: "DIS", name: "The Walt Disney Company" },
  { symbol: "XOM", name: "Exxon Mobil Corporation" },
  { symbol: "CVX", name: "Chevron Corporation" },
  { symbol: "CAT", name: "Caterpillar Inc." },
  { symbol: "BA", name: "The Boeing Company" },
  { symbol: "GE", name: "GE Aerospace" },
  { symbol: "UBER", name: "Uber Technologies" },
  { symbol: "COIN", name: "Coinbase Global" },
];

export const ALL_SYMBOL_SEEDS: SymbolSeed[] = [
  ...INDEX_PROXIES,
  ...POPULAR_SYMBOLS,
];

/** Ana sayfadaki endeks şeridinin sırası. */
export const INDEX_STRIP = ["QQQ", "SPY", "DIA", "IWM"] as const;

/**
 * Dünya piyasaları — ABD'de işlem gören ülke fonları üzerinden izlenir.
 *
 * KOSPI, Nikkei veya BIST 100'ün kendisi ücretsiz sağlayıcılarda yok; bunun
 * yerine o piyasanın hisselerini tutan MSCI ülke ETF'leri kullanılır. Bu
 * fonlar DOLAR bazlıdır ve ABD seansında işlem görür: yerel endeksle aynı
 * yönü gösterir ama birebir aynı yüzdeyi vermez (kur etkisi + seans farkı).
 * Ekranda bu açıkça yazılır — vekil olduğu gizlenmez.
 */
export type WorldMarket = {
  symbol: string;
  /** Fonun resmî adı — sağlayıcı ETF profili döndürmediği için elle tutulur. */
  fundName: string;
  nameTr: string;
  nameEn: string;
  /** Vekil ettiği yerel endeks — kart altında künye olarak görünür. */
  tracksTr: string;
  tracksEn: string;
  flag: string;
};

/* Sıra bilinçli: Türkiye başta — okuyucunun kendi piyasası ilk satırda
   duruyor, kalanlar seans sırasına göre (Asya → Avrupa) diziliyor. */
export const WORLD_MARKETS: WorldMarket[] = [
  {
    symbol: "TUR",
    fundName: "iShares MSCI Turkey ETF",
    nameTr: "Türkiye",
    nameEn: "Türkiye",
    tracksTr: "MSCI Türkiye · BIST'i izleyen ABD fonu",
    tracksEn: "MSCI Türkiye · US-listed fund tracking the BIST",
    flag: "🇹🇷",
  },
  {
    symbol: "EWJ",
    fundName: "iShares MSCI Japan ETF",
    nameTr: "Japonya",
    nameEn: "Japan",
    tracksTr: "MSCI Japonya · Nikkei'yi izleyen ABD fonu",
    tracksEn: "MSCI Japan · US-listed fund tracking the Nikkei",
    flag: "🇯🇵",
  },
  {
    symbol: "EWY",
    fundName: "iShares MSCI South Korea ETF",
    nameTr: "Güney Kore",
    nameEn: "South Korea",
    tracksTr: "MSCI Güney Kore · KOSPI'yi izleyen ABD fonu",
    tracksEn: "MSCI South Korea · US-listed fund tracking the KOSPI",
    flag: "🇰🇷",
  },
  {
    symbol: "MCHI",
    fundName: "iShares MSCI China ETF",
    nameTr: "Çin",
    nameEn: "China",
    tracksTr: "MSCI Çin · Şanghay ve Hong Kong'u izleyen ABD fonu",
    tracksEn: "MSCI China · US-listed fund, Shanghai and Hong Kong",
    flag: "🇨🇳",
  },
  {
    symbol: "EWG",
    fundName: "iShares MSCI Germany ETF",
    nameTr: "Almanya",
    nameEn: "Germany",
    tracksTr: "MSCI Almanya · DAX'ı izleyen ABD fonu",
    tracksEn: "MSCI Germany · US-listed fund tracking the DAX",
    flag: "🇩🇪",
  },
];

/* ==========================================================================
   Fon künyeleri
   ========================================================================== */

/**
 * Takip ettiğimiz ETF'lerin kimliği.
 *
 * Finnhub'ın `/stock/profile2` ucu fonlar için BOŞ nesne döner — QQQ, SPY,
 * EWJ hepsi `{}`. Bu yüzden ad, ülke ve izlenen endeks bilgisi burada elle
 * tutulur; hisse detayında şirket profili yerine bu künye gösterilir.
 */
export type FundMeta = {
  symbol: string;
  /** Fonun resmî adı. */
  name: string;
  /** Kısa ad — "Nasdaq 100", "Japonya". */
  labelTr: string;
  labelEn: string;
  /** İzlediği endeks ve piyasa. */
  tracksTr: string;
  tracksEn: string;
  flag: string;
  /** Fonu çıkaran kurum. */
  issuer: string;
  /** ABD endeks fonu mu, yabancı piyasa fonu mu — künye notu buna göre. */
  kind: "us-index" | "country";
};

const US_INDEX_FUNDS: FundMeta[] = [
  {
    symbol: "QQQ",
    name: "Invesco QQQ Trust",
    labelTr: "Nasdaq 100",
    labelEn: "Nasdaq 100",
    tracksTr: "Nasdaq 100 endeksi · ABD",
    tracksEn: "Nasdaq 100 index · US",
    flag: "🇺🇸",
    issuer: "Invesco",
    kind: "us-index",
  },
  {
    symbol: "SPY",
    name: "SPDR S&P 500 ETF Trust",
    labelTr: "S&P 500",
    labelEn: "S&P 500",
    tracksTr: "S&P 500 endeksi · ABD",
    tracksEn: "S&P 500 index · US",
    flag: "🇺🇸",
    issuer: "State Street",
    kind: "us-index",
  },
  {
    symbol: "DIA",
    name: "SPDR Dow Jones Industrial Average ETF Trust",
    labelTr: "Dow Jones",
    labelEn: "Dow Jones",
    tracksTr: "Dow Jones Industrial Average · ABD",
    tracksEn: "Dow Jones Industrial Average · US",
    flag: "🇺🇸",
    issuer: "State Street",
    kind: "us-index",
  },
  {
    symbol: "IWM",
    name: "iShares Russell 2000 ETF",
    labelTr: "Russell 2000",
    labelEn: "Russell 2000",
    tracksTr: "Russell 2000 endeksi · ABD küçük ölçekli",
    tracksEn: "Russell 2000 index · US small caps",
    flag: "🇺🇸",
    issuer: "BlackRock",
    kind: "us-index",
  },
];

const FUND_META: Record<string, FundMeta> = Object.fromEntries(
  [
    ...US_INDEX_FUNDS,
    ...WORLD_MARKETS.map<FundMeta>((market) => ({
      symbol: market.symbol,
      name: market.fundName,
      labelTr: market.nameTr,
      labelEn: market.nameEn,
      tracksTr: market.tracksTr,
      tracksEn: market.tracksEn,
      flag: market.flag,
      issuer: "BlackRock",
      kind: "country",
    })),
  ].map((fund) => [fund.symbol, fund]),
);

/** Sembol bir fon mu — öyleyse künyesi, değilse null. */
export function fundMetaOf(symbol: string): FundMeta | null {
  return FUND_META[symbol] ?? null;
}
