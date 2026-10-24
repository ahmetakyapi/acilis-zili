/**
 * "Takip Listem Bugün"ün SAF hesapları (24 Ekim) — sunucu modülü
 * `lib/watchlist-today.ts` bunları çağırır, testler doğrudan
 * (tests/watchlist-today.test.ts). Ayrı dosya, çünkü orası `server-only`
 * ve sağlayıcı/veritabanı içe aktarıyor.
 *
 * KURAL (lib/compare-note-core.ts ile aynı): Claude hesap YAPMAZ. Günlük
 * değişim, beş seanslık değişim ve S&P 500'e göre fark burada hesaplanır;
 * modele biçimlenmiş hâlleri gider, çıktıdaki her sayı girdide geçmek
 * zorunda (lib/ai-grounding.ts).
 */

/** Okunacak en çok sembol — her biri bir bar isteği; liste bundan uzunsa ilk 25'i. */
export const WATCH_TODAY_MAX_SYMBOLS = 25;
/** Notun ve şeridin gösterdiği en çok hareket eden. */
export const WATCH_TODAY_MOVERS = 5;
/** Hareketinin nedeni (haber, var olan Claude notu) aranan ilk kaç hareket eden. */
export const WATCH_TODAY_REASONS = 3;
/** Not için en az okunabilen sembol: tek hisse "listenin bugünü" değil, o hissenin notu. */
export const WATCH_TODAY_MIN_COVERED = 2;

export type DayMove = {
  symbol: string;
  /** Son tamamlanmış seansın kapanıştan kapanışa değişimi, yüzde. */
  dayPct: number;
  /** Son beş tamamlanmış seansın değişimi, yüzde; yeterli bar yoksa null. */
  fivePct: number | null;
};

/**
 * Önbellek anahtarının liste parçası: tekrarsız, SIRALI semboller. Liste
 * içinde sıra değiştirmek (sürükle bırak) notu yeniden yazdırmaz; hisse
 * eklemek ya da çıkarmak yazdırır. Özet (hash) değil düz dize: liste en
 * çok 25 sembol, anahtar kısa kalıyor ve modül istemciye de girebiliyor
 * (`formatPoints`, components/watchlist/WatchlistToday.tsx).
 */
export function watchlistFingerprint(symbols: Iterable<string>): string {
  return [...new Set([...symbols].map((symbol) => symbol.toUpperCase()))].sort().join(",");
}

/** Kapanıştan kapanışa değişim; taban sıfır ya da eksikse null. */
export function closeToClose(closes: readonly number[], back: number): number | null {
  if (closes.length <= back) return null;
  const last = closes[closes.length - 1]!;
  const base = closes[closes.length - 1 - back]!;
  return base > 0 && Number.isFinite(last) ? ((last - base) / base) * 100 : null;
}

/** En büyük MUTLAK günlük hareket önce; eşitlikte sembol sırası (deterministik). */
export function rankMovers(moves: readonly DayMove[], limit = WATCH_TODAY_MOVERS): DayMove[] {
  return [...moves]
    .sort((a, b) => Math.abs(b.dayPct) - Math.abs(a.dayPct) || a.symbol.localeCompare(b.symbol))
    .slice(0, limit);
}

/** Not yazılır mı: en az iki sembol ve listenin en az yarısı okunabiliyor. */
export function enoughCoverage(covered: number, total: number): boolean {
  return covered >= WATCH_TODAY_MIN_COVERED && covered * 2 >= total;
}

/**
 * Hissenin günlük değişiminin S&P 500'ünkinden farkı, YÜZDE PUAN. Model bu
 * farkı kendisi hesaplamasın diye kodda; iki seri aynı seansı anlatmıyorsa
 * çağıran null verir.
 */
export function gapToMarket(stockPct: number, marketPct: number | null): number | null {
  if (marketPct === null || !Number.isFinite(stockPct) || !Number.isFinite(marketPct)) return null;
  return stockPct - marketPct;
}

/**
 * Puan farkının metni: "+1,2 puan" / "+1.2 pts". Eksi işareti yüzdelerle
 * aynı tipografik eksi (U+2212); sıfır işaretsiz. Arayüz birimi sözlükten
 * verir ("Puan" — künye Title Case); modele giden metin küçük harfli.
 */
export function formatPoints(value: number, locale: "tr" | "en", unit = locale === "en" ? "pts" : "puan"): string {
  const number = new Intl.NumberFormat(locale === "en" ? "en-US" : "tr-TR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
    signDisplay: "exceptZero",
  })
    .format(Math.round(value * 10) / 10)
    .replace("-", "−");
  return `${number} ${unit}`;
}
