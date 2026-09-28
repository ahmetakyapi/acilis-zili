import { bandFiyatiKapsiyorMu } from "@/lib/utils";

/**
 * Hisse skor kartı — beş eksen, her biri bir SEKTÖR YÜZDELİĞİ.
 *
 * NOT DEĞİL, KONUM. Site hüküm vermiyor (analist kartındaki yorum: "bizim
 * uydurduğumuz bir ağırlıklandırma taşır"). "B+" ya da "82/100" bir yargı;
 * "sektörünün %80'inden ucuz" ise ölçülebilir bir büyüklük ve kimin
 * hesaplasa aynı sayıyı bulacağı bir cümle. Renk de bu yüzden yön
 * taşımıyor: yüksek yüzdelik "iyi" demek değil, ucuz bir hisse ucuzluğunu
 * hak ediyor olabilir.
 *
 * SEKTÖR = GICS ANA SEKTÖRÜ, ENDEKS TOHUMUNDAN. Sağlayıcının serbest metinli
 * `industry` alanı ("Semiconductors", "Technology") sınıflandırma değil, bir
 * etiket; iki şirketi aynı kovaya koyup koymadığı tutarsız. GICS'i yalnızca
 * endeks üyeleri için biliyoruz, yani skor kartı da yalnızca onlarda.
 */

export const SCORE_AXES = ["valuation", "growth", "profitability", "health", "momentum"] as const;
export type ScoreAxis = (typeof SCORE_AXES)[number];

/**
 * Bir yüzdeliğin anlamlı olması için gereken en az SEKTÖR KOMŞUSU (kendisi
 * hariç). Sekizden az şirketle "%80'inden ucuz" dört şirketin üçünden ucuz
 * demek ve her komşu yüzdeliği 12 puan oynatıyor. Eksen bu sayıya
 * ulaşmadıysa gösterilmiyor; hiçbir eksen ulaşmadıysa panel "Hazırlanıyor".
 */
export const SCORECARD_MIN_PEERS = 8;

/** Momentum penceresi — işlem günü (~6 ay). */
export const MOMENTUM_SESSIONS = 126;

/**
 * Tabloya yazılan ölçüler — `/stock/metric?metric=all` alanlarından seçildi.
 *
 * Hepsi ORAN ya da yüzde: para birimi bölümde sadeleşiyor, ADR'de de aynı
 * ölçekte (MetricsCard'daki net marj gerekçesinin aynısı). İki istisna hisse
 * başı tutarlar (`epsTTM`, `revenuePerShareTTM`): onlar değerleme ekseninde
 * CANLI fiyata bölünüyor ve yalnızca dolar cinsinden raporlayan şirkette
 * kullanılıyor.
 *
 * KULLANILMAYANLAR ve sebebi:
 *  - `peTTM`, `psTTM`, `pb`: sağlayıcının kendi fiyatından kurulu ve o fiyat
 *    geriden geliyor (README → Finnhub tuzakları; ölçüm lib/utils.ts →
 *    `peRatioOf`). Değerleme canlı fiyatla yeniden kuruluyor.
 *  - `marketCapitalization`: milyon cinsinden ve ana borsanın parasında.
 *  - `*5Y` alanları: beş yıllık ortalama bugünkü şirketi anlatmıyor ve
 *    yeni halka arzlarda boş; eksen yarı dolu kalırdı.
 */
export type StoredMetrics = {
  epsTTM: number | null;
  revenuePerShareTTM: number | null;
  revenueGrowthTTMYoy: number | null;
  epsGrowthTTMYoy: number | null;
  operatingMarginTTM: number | null;
  netProfitMarginTTM: number | null;
  roeTTM: number | null;
  debtToEquity: number | null;
  currentRatio: number | null;
  /** Hisse sınıfı denetimi için (BRK.B) — gösterilmiyor. */
  high52: number | null;
  low52: number | null;
};

const num = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

export function storedMetricsFrom(raw: Record<string, unknown>): StoredMetrics {
  return {
    epsTTM: num(raw.epsTTM) ?? num(raw.epsBasicExclExtraItemsTTM),
    revenuePerShareTTM: num(raw.revenuePerShareTTM),
    revenueGrowthTTMYoy: num(raw.revenueGrowthTTMYoy),
    epsGrowthTTMYoy: num(raw.epsGrowthTTMYoy),
    operatingMarginTTM: num(raw.operatingMarginTTM),
    netProfitMarginTTM: num(raw.netProfitMarginTTM),
    roeTTM: num(raw.roeTTM),
    debtToEquity: num(raw["totalDebt/totalEquityQuarterly"]) ?? num(raw["totalDebt/totalEquityAnnual"]),
    currentRatio: num(raw.currentRatioQuarterly) ?? num(raw.currentRatioAnnual),
    high52: num(raw["52WeekHigh"]),
    low52: num(raw["52WeekLow"]),
  };
}

/** Tablodan okunan jsonb'yi tipe oturtur; bilinmeyen alan null. */
export function parseStoredMetrics(value: unknown): StoredMetrics | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const keys: (keyof StoredMetrics)[] = [
    "epsTTM", "revenuePerShareTTM", "revenueGrowthTTMYoy", "epsGrowthTTMYoy",
    "operatingMarginTTM", "netProfitMarginTTM", "roeTTM", "debtToEquity",
    "currentRatio", "high52", "low52",
  ];
  return Object.fromEntries(keys.map((key) => [key, num(raw[key])])) as StoredMetrics;
}

export type ScoreSubject = {
  symbol: string;
  /** Raporlama para birimi; bilinmiyorsa null. */
  currency: string | null;
  metrics: StoredMetrics;
  /** Canlı fiyat (dolar). */
  price: number | null;
  /** Son `MOMENTUM_SESSIONS` işlem günü getirisi, yüzde. */
  momentum: number | null;
};

type Direction = "higher" | "lower";

export type MetricKey =
  | "earningsYield"
  | "salesYield"
  | "revenueGrowth"
  | "epsGrowth"
  | "operatingMargin"
  | "netMargin"
  | "roe"
  | "debtToEquity"
  | "currentRatio"
  | "momentum";

/**
 * Ölçü → eksen, yön ve değer.
 *
 * DEĞERLEME TERS ORANLA: F/K yerine kâr getirisi (EPS / fiyat), F/S yerine
 * satış getirisi. Zarar eden şirkette F/K tanımsız ve sıralamanın dışına
 * düşerdi; kâr getirisi eksiye iner ve "en pahalı" tarafta doğru yerini
 * alıyor. Yüksek getiri = ucuz.
 *
 * ÖZSERMAYESİ EKSİ ŞİRKET: borç/özsermaye eksi çıkıyor ve "lower is better"
 * ile en sağlam bilanço gibi okunurdu — tam tersi. Eksi oran en kötü sıraya
 * konuyor. Aynı şirkette ROE de iki eksinin bölümü (artı ve büyük), o yüzden
 * ROE hiç kullanılmıyor.
 */
export const METRICS: { key: MetricKey; axis: ScoreAxis; better: Direction }[] = [
  { key: "earningsYield", axis: "valuation", better: "higher" },
  { key: "salesYield", axis: "valuation", better: "higher" },
  { key: "revenueGrowth", axis: "growth", better: "higher" },
  { key: "epsGrowth", axis: "growth", better: "higher" },
  { key: "operatingMargin", axis: "profitability", better: "higher" },
  { key: "netMargin", axis: "profitability", better: "higher" },
  { key: "roe", axis: "profitability", better: "higher" },
  { key: "debtToEquity", axis: "health", better: "lower" },
  { key: "currentRatio", axis: "health", better: "higher" },
  { key: "momentum", axis: "momentum", better: "higher" },
];

export function metricValue(subject: ScoreSubject, key: MetricKey): number | null {
  const m = subject.metrics;
  const negativeEquity = m.debtToEquity !== null && m.debtToEquity < 0;
  switch (key) {
    case "earningsYield":
    case "salesYield": {
      /* Hisse başı tutar ancak dolar cinsindeyse ve ölçüler bu hisse
         sınıfına aitse canlı fiyata bölünür (BRK.B'de band A sınıfının). */
      if (subject.currency !== "USD" || subject.price === null || !(subject.price > 0)) return null;
      if (!bandFiyatiKapsiyorMu(subject.price, m.low52, m.high52)) return null;
      const perShare = key === "earningsYield" ? m.epsTTM : m.revenuePerShareTTM;
      return perShare === null ? null : perShare / subject.price;
    }
    case "revenueGrowth":
      return m.revenueGrowthTTMYoy;
    case "epsGrowth":
      return m.epsGrowthTTMYoy;
    case "operatingMargin":
      return m.operatingMarginTTM;
    case "netMargin":
      return m.netProfitMarginTTM;
    case "roe":
      return negativeEquity ? null : m.roeTTM;
    case "debtToEquity":
      return m.debtToEquity === null ? null : negativeEquity ? Number.POSITIVE_INFINITY : m.debtToEquity;
    case "currentRatio":
      return m.currentRatio;
    case "momentum":
      return subject.momentum;
  }
}

/**
 * Konu, komşuların yüzde kaçından "daha iyi" tarafta. Eşitlik yarım sayılır
 * (orta sıra), yani herkes aynı değerdeyse %50.
 */
export function percentileOf(value: number, peers: readonly number[], better: Direction): number {
  if (peers.length === 0) return 50;
  let score = 0;
  for (const peer of peers) {
    if (peer === value) score += 0.5;
    else if (better === "higher" ? value > peer : value < peer) score += 1;
  }
  return (score / peers.length) * 100;
}

export type AxisScore = {
  axis: ScoreAxis;
  /** 0–100, tam sayıya yuvarlanmış. */
  percentile: number;
  /** Ölçüye giren komşu sayısı (eksendeki ölçülerin en genişi). */
  peers: number;
  metrics: MetricKey[];
};

/** Konu hariç komşular; eksen başına yüzdelik. Eşiği geçemeyen eksen yok. */
export function scoreCard(
  subject: ScoreSubject,
  peers: readonly ScoreSubject[],
  minPeers = SCORECARD_MIN_PEERS,
): AxisScore[] {
  const others = peers.filter((peer) => peer.symbol !== subject.symbol);
  const out: AxisScore[] = [];
  for (const axis of SCORE_AXES) {
    const used: { key: MetricKey; pct: number; n: number }[] = [];
    for (const def of METRICS.filter((m) => m.axis === axis)) {
      const own = metricValue(subject, def.key);
      if (own === null) continue;
      const values = others.map((peer) => metricValue(peer, def.key)).filter((v): v is number => v !== null);
      if (values.length < minPeers) continue;
      used.push({ key: def.key, pct: percentileOf(own, values, def.better), n: values.length });
    }
    if (used.length === 0) continue;
    out.push({
      axis,
      percentile: Math.round(used.reduce((sum, u) => sum + u.pct, 0) / used.length),
      peers: Math.max(...used.map((u) => u.n)),
      metrics: used.map((u) => u.key),
    });
  }
  return out;
}

/**
 * Eksen başına SEKTÖRÜN TAMAMININ yüzdelikleri — skor kartındaki dağılım
 * şeridinin çentikleri (28 Eylül).
 *
 * Tek bir yüzdelik "%80" diyor ama sektörün nasıl yayıldığını söylemiyor:
 * şirketlerin çoğu ortada mı toplanıyor, yoksa iki uca mı dağılıyor. Şerit
 * her şirketi AYNI YÖNTEMLE (kendisi hariç herkese karşı, `scoreCard`)
 * yerleştiriyor; konunun çentiği `scoreCard`ın kendi sonucuyla birebir aynı
 * sayı, yani şeritteki yer ile yanındaki yüzde ayrışamaz. Eşiği geçemeyen
 * şirket o eksende hiç çentik almıyor — olmayan bir konumu uydurmaz.
 *
 * Yüzdelik uzayında çizildiği için tek ölçülü eksende çentikler neredeyse
 * eşit aralıklı durur (sıralamanın tanımı); ölçüleri birleşen eksende
 * (kârlılık, bilanço) şirketler ortada kümelenir ve şerit bunu gösterir.
 */
export function axisDistribution(
  subject: ScoreSubject,
  peers: readonly ScoreSubject[],
  minPeers = SCORECARD_MIN_PEERS,
): Partial<Record<ScoreAxis, number[]>> {
  const everyone = [subject, ...peers.filter((peer) => peer.symbol !== subject.symbol)];
  const out: Partial<Record<ScoreAxis, number[]>> = {};
  for (const company of everyone) {
    const others = everyone.filter((other) => other.symbol !== company.symbol);
    for (const axis of scoreCard(company, others, minPeers)) {
      (out[axis.axis] ??= []).push(axis.percentile);
    }
  }
  for (const values of Object.values(out)) values.sort((a, b) => a - b);
  return out;
}

/** Sıralı dizinin medyanı; boşsa null. */
export function medianOf(sorted: readonly number[]): number | null {
  if (sorted.length === 0) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/* --------------------------------------------------------------------------
   Türkçe ek — "%80'inden", "%50'sinden", "%30'undan"
   -------------------------------------------------------------------------- */

/* Sayının OKUNUŞUNUN son kelimesi eki belirliyor: 80 "seksen" → -inden,
   50 "elli" → -sinden, 6 "altı" → -sından. `[son ünlü, ünlüyle mi bitiyor]`. */
const ONES: Record<number, [string, boolean]> = {
  1: ["i", false], 2: ["i", true], 3: ["ü", false], 4: ["ö", false], 5: ["e", false],
  6: ["ı", true], 7: ["i", true], 8: ["i", false], 9: ["u", false],
};
const TENS: Record<number, [string, boolean]> = {
  0: ["ı", false], 1: ["o", false], 2: ["i", true], 3: ["u", false], 4: ["ı", false],
  5: ["i", true], 6: ["ı", false], 7: ["i", false], 8: ["e", false], 9: ["a", false],
};

/**
 * 0–100 arası bir tam sayının iyelik + ayrılma eki, kesme işaretiyle:
 * `trAblative(80)` → "'inden". Sözlükte "%{p}{ek}" diye kullanılıyor.
 */
export function trAblative(n: number): string {
  const value = Math.max(0, Math.min(100, Math.round(n)));
  const [vowel, endsWithVowel] =
    value === 100 ? (["ü", false] as [string, boolean]) : value % 10 !== 0 ? ONES[value % 10]! : TENS[value / 10]!;
  const possessive = { a: "ı", ı: "ı", o: "u", u: "u", e: "i", i: "i", ö: "ü", ü: "ü" }[vowel] ?? "i";
  const back = possessive === "ı" || possessive === "u";
  return `'${endsWithVowel ? "s" : ""}${possessive}${back ? "ndan" : "nden"}`;
}
