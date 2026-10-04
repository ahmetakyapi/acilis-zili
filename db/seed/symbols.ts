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
  /**
   * Fonun türü — künye notu buna göre. "sector": S&P 500'ün bir GICS
   * sektörü (SPDR). "thematic": aktif yönetilen, bir temaya odaklı fon
   * (DRAM, NASA, CHAT); endeks izlemiyor. "theme-index": bir temayı
   * kurallı bir endeksle izleyen fon (SMH, AIQ, BOTZ, SPUS).
   */
  kind: "us-index" | "country" | "sector" | "thematic" | "theme-index";
};

/**
 * SPDR sektör fonları — S&P 500'ün on bir GICS sektörü. TEK LİSTE:
 * Piyasalar'ın sektör panosu (lib/market-boards.ts → `SECTOR_ETFS`) ve
 * fon künyesi buradan okuyor. 4 Ekim'e kadar liste yalnızca panodaydı;
 * sektör kartına basan okuyucu /hisse/XLK'da künyesiz, boş bir şirket
 * sayfasına düşüyordu ("detayında bilgi yazmıyor").
 * Adlar /sirketler şeridinin Türkçesiyle aynı (lib/sectors.ts).
 */
export const SECTOR_FUNDS: readonly { symbol: string; nameTr: string; nameEn: string; fundName: string }[] = [
  { symbol: "XLK", nameTr: "Teknoloji", nameEn: "Technology", fundName: "Technology Select Sector SPDR Fund" },
  { symbol: "XLF", nameTr: "Finans", nameEn: "Financials", fundName: "Financial Select Sector SPDR Fund" },
  { symbol: "XLV", nameTr: "Sağlık", nameEn: "Health Care", fundName: "Health Care Select Sector SPDR Fund" },
  /* "Tüketim" hemen yanındaki "Temel Tüketim"le karışıyordu (28 Eylül
     denetimi); şirket sayfası aynı GICS sektörüne zaten bu adı veriyor
     (lib/sectors.ts → SECTOR_TR). */
  { symbol: "XLY", nameTr: "İsteğe Bağlı Tüketim", nameEn: "Consumer Discretionary", fundName: "Consumer Discretionary Select Sector SPDR Fund" },
  { symbol: "XLP", nameTr: "Temel Tüketim", nameEn: "Consumer Staples", fundName: "Consumer Staples Select Sector SPDR Fund" },
  { symbol: "XLE", nameTr: "Enerji", nameEn: "Energy", fundName: "Energy Select Sector SPDR Fund" },
  { symbol: "XLI", nameTr: "Sanayi", nameEn: "Industrials", fundName: "Industrial Select Sector SPDR Fund" },
  { symbol: "XLB", nameTr: "Hammadde", nameEn: "Materials", fundName: "Materials Select Sector SPDR Fund" },
  { symbol: "XLU", nameTr: "Kamu Hizmetleri", nameEn: "Utilities", fundName: "Utilities Select Sector SPDR Fund" },
  { symbol: "XLRE", nameTr: "Gayrimenkul", nameEn: "Real Estate", fundName: "Real Estate Select Sector SPDR Fund" },
  { symbol: "XLC", nameTr: "İletişim Hizmetleri", nameEn: "Communication Services", fundName: "Communication Services Select Sector SPDR Fund" },
];

/** Aktif, temaya odaklı fonlar (4 Ekim 2026, sahibinin isteği). */
const THEMATIC_FUNDS: FundMeta[] = [
  {
    symbol: "DRAM",
    name: "Roundhill Memory ETF",
    labelTr: "Bellek Çipleri",
    labelEn: "Memory Chips",
    tracksTr: "Küresel bellek üreticileri (DRAM, HBM, NAND) · aktif yönetim",
    tracksEn: "Global memory makers (DRAM, HBM, NAND) · actively managed",
    flag: "🌐",
    issuer: "Roundhill Investments",
    kind: "thematic",
  },
  {
    symbol: "NASA",
    name: "Tema Space Innovators ETF",
    labelTr: "Uzay Ekonomisi",
    labelEn: "Space Economy",
    tracksTr: "Uzay ve uydu şirketleri, SpaceX payı dahil · aktif yönetim",
    tracksEn: "Space and satellite companies, including a SpaceX stake · actively managed",
    flag: "🌐",
    issuer: "Tema ETFs",
    kind: "thematic",
  },
  {
    symbol: "CHAT",
    name: "Roundhill Generative AI & Technology ETF",
    labelTr: "Üretken Yapay Zekâ",
    labelEn: "Generative AI",
    tracksTr: "Üretken yapay zekâ ve onu taşıyan teknoloji şirketleri · aktif yönetim",
    tracksEn: "Generative AI and the technology companies behind it · actively managed",
    flag: "🌐",
    issuer: "Roundhill Investments",
    kind: "thematic",
  },
  /* Endeks izleyen tema fonları (4 Ekim 2026, sahibinin isteği). */
  {
    symbol: "SMH",
    name: "VanEck Semiconductor ETF",
    labelTr: "Yarı İletken",
    labelEn: "Semiconductors",
    tracksTr: "MVIS US Listed Semiconductor 25 · ABD'de işlem gören en büyük 25 çip şirketi",
    tracksEn: "MVIS US Listed Semiconductor 25 · the 25 largest US-listed chip companies",
    flag: "🌐",
    issuer: "VanEck",
    kind: "theme-index",
  },
  {
    symbol: "AIQ",
    name: "Global X Artificial Intelligence & Technology ETF",
    labelTr: "Yapay Zekâ ve Teknoloji",
    labelEn: "AI & Technology",
    tracksTr: "Indxx Artificial Intelligence & Big Data · küresel",
    tracksEn: "Indxx Artificial Intelligence & Big Data · global",
    flag: "🌐",
    issuer: "Global X",
    kind: "theme-index",
  },
  {
    symbol: "BOTZ",
    name: "Global X Robotics & Artificial Intelligence ETF",
    labelTr: "Robotik ve Yapay Zekâ",
    labelEn: "Robotics & AI",
    tracksTr: "Indxx Global Robotics & Artificial Intelligence Thematic · küresel",
    tracksEn: "Indxx Global Robotics & Artificial Intelligence Thematic · global",
    flag: "🌐",
    issuer: "Global X",
    kind: "theme-index",
  },
  {
    symbol: "SPUS",
    name: "SP Funds S&P 500 Sharia Industry Exclusions ETF",
    labelTr: "S&P 500 Katılım",
    labelEn: "S&P 500 Sharia",
    tracksTr: "S&P 500 Shariah Industry Exclusions · ABD",
    tracksEn: "S&P 500 Shariah Industry Exclusions · US",
    flag: "🇺🇸",
    issuer: "SP Funds",
    kind: "theme-index",
  },
];

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
    ...SECTOR_FUNDS.map<FundMeta>((fund) => ({
      symbol: fund.symbol,
      name: fund.fundName,
      labelTr: fund.nameTr,
      labelEn: fund.nameEn,
      tracksTr: `S&P 500 ${fund.nameTr} sektörü · ABD`,
      tracksEn: `S&P 500 ${fund.nameEn} sector · US`,
      flag: "🇺🇸",
      issuer: "State Street",
      kind: "sector",
    })),
    ...THEMATIC_FUNDS,
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

/** Bütün fon künyeleri — arama paleti bunlarda da arıyor. */
export function allFunds(): FundMeta[] {
  return Object.values(FUND_META);
}

/** Sembol bir fon mu — öyleyse künyesi, değilse null. */
export function fundMetaOf(symbol: string): FundMeta | null {
  return FUND_META[symbol] ?? null;
}
