/**
 * Piyasa Nabzı — şeffaf bileşik duyarlılık ölçüsü, 0–100. SAF FONKSİYONLAR.
 *
 * NEDEN KENDİMİZ HESAPLIYORUZ: piyasa dilinde yaygın "korku/açgözlülük"
 * endeksleri lisanslı ve bileşenleri, ağırlıkları kapalı. Sitenin kuralı
 * ekranda uydurma sayı olmaması; bir kutudan gelen "62" sayısının nasıl
 * kurulduğunu söyleyemiyorsak onu basamayız. Burada her bileşen elimizdeki
 * bir veriden, yazılı bir kuralla çıkıyor ve ekranda ham değeri ve tarihiyle
 * duruyor.
 *
 * YÖNTEM, TEK CÜMLEYLE: her bileşenin bugünkü okuması, kendi son ~6 aylık
 * (126 işlem günü) geçmişi içinde yüzdelik sıraya çevrilir; korku yönlü
 * ölçülerde (VIX, yüksek getirili tahvil farkı) sıra ters çevrilir; genel
 * puan mevcut bileşenlerin düz ortalamasıdır.
 *
 * NEDEN YÜZDELİK SIRA, SABİT EŞİK DEĞİL: VIX'te "20" yıllara göre farklı
 * anlamlar taşıyor, tahvil farkında "3,5 puan" da öyle. Sıra, ölçüyü kendi
 * yakın geçmişine göre okuyor: "son altı ayın en gergin günlerinden biri".
 * Karşılığında puan GÖRELİ: sakin bir yılın "aşırı korku"su tarihsel bir
 * krizle aynı şey değil. Panel künyesi bunu söylüyor.
 *
 * AĞIRLIK YOK. Ağırlık seçmek bir yargı ve gerekçesini yazamayacağımız bir
 * sayı olurdu; düz ortalama, eksik bileşen olduğunda da aynı kuralla
 * çalışıyor. Genel puan yalnızca en az `MIN_COMPONENTS` bileşen varsa
 * basılır: iki ölçünün ortalamasına "piyasanın nabzı" demek fazla iddialı.
 *
 * 52 HAFTA ZİRVE/DİP SAYISI BİLİNÇLİ OLARAK YOK. Her bileşen hissesi için
 * bir yıllık bar gerekiyor (500 sembol × 250 bar) ve kotasyon paketinde
 * 52 hafta bandı gelmiyor; bu ekran için ucuza türetilemiyor.
 */

/** Yüzdelik sıranın bakıldığı pencere — ~6 ay işlem günü. */
export const SENTIMENT_LOOKBACK = 126;
/** Sıranın anlamlı sayıldığı en az gözlem; altında bileşen "eksik". */
export const MIN_HISTORY = 60;
/** VIX ve tahvil farkının karşılaştırıldığı ortalama. */
export const FEAR_MA_DAYS = 50;
/** S&P 500 momentumunun ortalaması (yaygın kullanım: 125 gün). */
export const MOMENTUM_MA_DAYS = 125;
/** Güvenli liman: hisse ile uzun vadeli tahvilin 20 günlük getiri farkı. */
export const SAFE_HAVEN_DAYS = 20;
/** Genel puanın basılması için gereken en az bileşen. */
export const MIN_COMPONENTS = 3;
/**
 * Genişlik bileşeninin geçerli sayılması için gereken kapsam: endeks
 * üyelerinin en az bu kadarında değişim bilinmeli. Sağlayıcı yarım paket
 * döndürdüğünde 120 hissenin payı "S&P 500'ün genişliği" diye okunmasın.
 */
export const MIN_BREADTH_COVERAGE = 0.9;

const PERCENT = 100;
const HALF = 0.5;

export const SENTIMENT_KEYS = ["vix", "momentum", "breadth", "credit", "safeHaven"] as const;
export type SentimentKey = (typeof SENTIMENT_KEYS)[number];

export type SentimentReading = {
  key: SentimentKey;
  /** 0 korku … 100 iştah. */
  score: number;
  /** Ekranda yazılan ham okuma (VIX seviyesi, fark yüzdesi …). */
  value: number;
  /** Karşılaştırma ölçüsü — ortalama ya da ikinci seri; yoksa null. */
  reference: number | null;
  /** Okumanın ait olduğu gün (ET, "YYYY-MM-DD"). */
  date: string;
};

export type DatedValue = { date: string; value: number };

/**
 * Yüzdelik sıra — orta sıra yöntemiyle, 0–100.
 *
 * Eşit değerler yarım sayılıyor: tamamı aynı olan bir geçmişte sonuç 50,
 * 0 ya da 100 değil. Aksi hâlde yatay giden bir seri "aşırı" okunurdu.
 */
export function percentileRank(history: readonly number[], value: number): number {
  if (history.length === 0) return PERCENT * HALF;
  let below = 0;
  let equal = 0;
  for (const item of history) {
    if (item < value) below += 1;
    else if (item === value) equal += 1;
  }
  return ((below + equal * HALF) / history.length) * PERCENT;
}

/** Kayan ortalama — pencere dolmadan önceki noktalar null. */
export function movingAverage(values: readonly number[], window: number): (number | null)[] {
  const out: (number | null)[] = [];
  let sum = 0;
  for (let index = 0; index < values.length; index++) {
    sum += values[index];
    if (index >= window) sum -= values[index - window];
    out.push(index >= window - 1 ? sum / window : null);
  }
  return out;
}

/** Değerin kendi ortalamasından sapması (oran − 1), pencere dolan günlerde. */
export function deviationFromAverage(points: readonly DatedValue[], window: number): DatedValue[] {
  const averages = movingAverage(points.map((point) => point.value), window);
  const out: DatedValue[] = [];
  points.forEach((point, index) => {
    const average = averages[index];
    if (average !== null && average > 0) {
      out.push({ date: point.date, value: point.value / average - 1 });
    }
  });
  return out;
}

/**
 * Serinin son noktasını son `SENTIMENT_LOOKBACK` nokta içinde sıraya koyar.
 * Pencere bugünü de içeriyor: "bugün, son altı ayın neresinde".
 */
export function scoreLatest(series: readonly DatedValue[], invert: boolean): { score: number; date: string } | null {
  if (series.length < MIN_HISTORY) return null;
  const window = series.slice(-SENTIMENT_LOOKBACK);
  const latest = window[window.length - 1];
  const rank = percentileRank(window.map((point) => point.value), latest.value);
  return { score: invert ? PERCENT - rank : rank, date: latest.date };
}

/**
 * Korku yönlü seviye (VIX, tahvil farkı): ortalamasının ne kadar üstünde.
 * Yüksek sapma = gerginlik, puan ters çevrilir.
 */
export function fearLevelReading(
  key: "vix" | "credit",
  points: readonly DatedValue[],
): SentimentReading | null {
  const deviation = deviationFromAverage(points, FEAR_MA_DAYS);
  const scored = scoreLatest(deviation, true);
  const latest = points.at(-1);
  if (!scored || !latest || latest.date !== scored.date) return null;
  const average = movingAverage(points.map((point) => point.value), FEAR_MA_DAYS).at(-1) ?? null;
  return { key, score: scored.score, value: latest.value, reference: average, date: latest.date };
}

/** S&P 500 (SPY) kapanışının 125 günlük ortalamasına uzaklığı. */
export function momentumReading(closes: readonly DatedValue[]): SentimentReading | null {
  const deviation = deviationFromAverage(closes, MOMENTUM_MA_DAYS);
  const scored = scoreLatest(deviation, false);
  const latest = closes.at(-1);
  if (!scored || !latest) return null;
  const average = movingAverage(closes.map((point) => point.value), MOMENTUM_MA_DAYS).at(-1) ?? null;
  return { key: "momentum", score: scored.score, value: latest.value, reference: average, date: latest.date };
}

/**
 * Güvenli liman talebi: hisse (SPY) ile uzun vadeli tahvilin (TLT) 20
 * günlük getiri farkı. Tahvil hisseden iyi gidiyorsa para kaçıyor.
 *
 * İki seri TARİHE GÖRE eşleniyor, dizideki sıraya göre değil: biri bir
 * günü eksik taşırsa (işlem durması, sağlayıcı boşluğu) sıra kayar ve
 * farklı günlerin getirileri çıkarılırdı.
 */
export function safeHavenReading(
  stocks: readonly DatedValue[],
  bonds: readonly DatedValue[],
): SentimentReading | null {
  const bondByDate = new Map(bonds.map((point) => [point.date, point.value]));
  const paired = stocks
    .filter((point) => bondByDate.has(point.date))
    .map((point) => ({ date: point.date, stock: point.value, bond: bondByDate.get(point.date)! }));
  const series: DatedValue[] = [];
  const stockReturns: number[] = [];
  const bondReturns: number[] = [];
  for (let index = SAFE_HAVEN_DAYS; index < paired.length; index++) {
    const base = paired[index - SAFE_HAVEN_DAYS];
    const point = paired[index];
    if (base.stock <= 0 || base.bond <= 0) continue;
    const stockReturn = (point.stock / base.stock - 1) * PERCENT;
    const bondReturn = (point.bond / base.bond - 1) * PERCENT;
    stockReturns.push(stockReturn);
    bondReturns.push(bondReturn);
    series.push({ date: point.date, value: stockReturn - bondReturn });
  }
  const scored = scoreLatest(series, false);
  if (!scored) return null;
  return {
    key: "safeHaven",
    score: scored.score,
    value: stockReturns.at(-1)!,
    reference: bondReturns.at(-1)!,
    date: scored.date,
  };
}

/**
 * Genişlik: endeks üyelerinin yüzde kaçı artıda. YÜZDELİK SIRA DEĞİL,
 * doğrudan pay — zaten 0–100 ve geçmişi elimizde yok (tek bir günün
 * kotasyonları). Kapsam yetersizse bileşen yok.
 */
export function breadthReading(
  advancing: number,
  known: number,
  members: number,
  date: string,
): SentimentReading | null {
  if (members <= 0 || known <= 0 || known / members < MIN_BREADTH_COVERAGE) return null;
  const share = (advancing / known) * PERCENT;
  return { key: "breadth", score: share, value: share, reference: null, date };
}

export const SENTIMENT_BANDS = [
  { max: 25, key: "extremeFear", tone: "down" },
  { max: 45, key: "fear", tone: "down" },
  { max: 55, key: "neutral", tone: "flat" },
  { max: 75, key: "greed", tone: "up" },
  { max: Infinity, key: "extremeGreed", tone: "up" },
] as const;

export type SentimentBand = (typeof SENTIMENT_BANDS)[number];

export function sentimentBand(score: number): SentimentBand {
  return SENTIMENT_BANDS.find((band) => score < band.max) ?? SENTIMENT_BANDS[SENTIMENT_BANDS.length - 1];
}

/** Genel puan — mevcut bileşenlerin düz ortalaması; yetersizse null. */
export function overallScore(readings: readonly SentimentReading[]): number | null {
  if (readings.length < MIN_COMPONENTS) return null;
  return readings.reduce((sum, reading) => sum + reading.score, 0) / readings.length;
}
