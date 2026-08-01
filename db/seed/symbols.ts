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
  nameTr: string;
  nameEn: string;
  /** Vekil ettiği yerel endeks — kart altında künye olarak görünür. */
  tracksTr: string;
  tracksEn: string;
  flag: string;
};

export const WORLD_MARKETS: WorldMarket[] = [
  {
    symbol: "EWJ",
    nameTr: "Japonya",
    nameEn: "Japan",
    tracksTr: "MSCI Japonya · Nikkei ile aynı piyasa",
    tracksEn: "MSCI Japan · same market as the Nikkei",
    flag: "🇯🇵",
  },
  {
    symbol: "EWY",
    nameTr: "Güney Kore",
    nameEn: "South Korea",
    tracksTr: "MSCI Güney Kore · KOSPI ile aynı piyasa",
    tracksEn: "MSCI South Korea · same market as the KOSPI",
    flag: "🇰🇷",
  },
  {
    symbol: "TUR",
    nameTr: "Türkiye",
    nameEn: "Türkiye",
    tracksTr: "MSCI Türkiye · BIST ile aynı piyasa",
    tracksEn: "MSCI Türkiye · same market as the BIST",
    flag: "🇹🇷",
  },
  {
    symbol: "MCHI",
    nameTr: "Çin",
    nameEn: "China",
    tracksTr: "MSCI Çin · Şanghay ve Hong Kong",
    tracksEn: "MSCI China · Shanghai and Hong Kong",
    flag: "🇨🇳",
  },
  {
    symbol: "EWG",
    nameTr: "Almanya",
    nameEn: "Germany",
    tracksTr: "MSCI Almanya · DAX ile aynı piyasa",
    tracksEn: "MSCI Germany · same market as the DAX",
    flag: "🇩🇪",
  },
  {
    symbol: "INDA",
    nameTr: "Hindistan",
    nameEn: "India",
    tracksTr: "MSCI Hindistan · Sensex ve Nifty",
    tracksEn: "MSCI India · Sensex and Nifty",
    flag: "🇮🇳",
  },
];
