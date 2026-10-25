/**
 * Makro ve piyasa görsellerinin SAF mantığı (25 Ekim görsel turu):
 * getiri eğrisi minyatürü, eğrinin biçimi, /makro tepesindeki tek cümle,
 * sektör ısı matrisinin yoğunluğu ve üstündeki cümle.
 *
 * "use client" DEĞİL ve React'siz: sunucu bileşenleri (MarketPulse,
 * YieldCard, EtfBoards) de istemci sahnesi de buradan okuyor; testi
 * `tests/macro-visual.test.ts`. Cümleler ŞABLON + VERİ: her sayı girdide
 * geçiyor, girdide olmayan bir yargı (iyi/kötü, "güçlü", "zayıf") yok.
 */

export type Observation = { date: string; value: number };

/* ------------------------------------------------------------ Eğri */

/**
 * Eğri bu farkın altında "düz" sayılıyor (yüzde puanı, uzun vade eksi kısa
 * vade). Piyasada yerleşik tek bir eşik yok; çeyrek puan bu sitenin
 * seçimi ve bu yüzden künyede eşiğin kendisi yazıyor: okuyucu "düz"
 * sözcüğünün neye göre söylendiğini görüyor.
 */
export const FLAT_CURVE_SPREAD = 0.25;

/** Hayalet eğri bu kadar takvim günü öncesinin son ortak gözlemi. */
export const CURVE_LOOKBACK_DAYS = 30;

/** Vade başına istenen gözlem: 30 işlem günü ≈ altı hafta; bir ay geriye
    bakışa tatil ve eksik gün payı bırakıyor. */
export const CURVE_OBSERVATIONS = 30;

export type CurveShape = "normal" | "flat" | "inverted";

export function curveShape(spread: number): CurveShape {
  if (spread < 0) return "inverted";
  if (spread < FLAT_CURVE_SPREAD) return "flat";
  return "normal";
}

export type CurveInput = { key: string; observations: readonly Observation[] };

export type CurvePoint = {
  key: string;
  /** Eğri gününde bu vadenin getirisi; o gün gözlemi yoksa null (nokta basılmaz). */
  value: number | null;
  /** Bir ay önceki ortak günde; ortak gün yoksa null. */
  ghost: number | null;
};

export type YieldCurve = {
  points: CurvePoint[];
  /** Eğrinin günü: vadelerin en yeni ORTAK gözlemi. */
  date: string;
  ghostDate: string | null;
  /** Dikey ölçek: iki eğrinin bütün noktaları, pay eklenmiş. */
  lo: number;
  hi: number;
};

const DAY_MS = 86_400_000;
/** Ölçeğin iki ucundaki pay (aralığın oranı) — minyatürde nokta kenara yapışmasın. */
const CURVE_PAD = 0.18;
/** Bütün değerler eşitse ölçek bu kadar açılıyor (puan). */
const CURVE_MIN_RANGE = 0.1;

function minusDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) - days * DAY_MS).toISOString().slice(0, 10);
}

/**
 * Vadelerden eğri. AYNI GÜN ŞART: 2 yıllık bugünün, 30 yıllık dünün
 * kapanışıyla bir eğri çizmek iki ayrı günü tek çizgide birleştirmek olurdu
 * (veri dürüstlüğü 3). Eğrinin günü, vadelerin hepsinin gözlemi olan en yeni
 * gün; bir vadenin o gün gözlemi yoksa noktası basılmıyor. Hayalet eğri de
 * aynı kuralla: `CURVE_LOOKBACK_DAYS` öncesinden geriye, bütün vadelerin
 * ortak olduğu ilk gün. İki noktadan az kalırsa eğri yok.
 */
export function buildYieldCurve(inputs: readonly CurveInput[]): YieldCurve | null {
  const maps = inputs.map((input) => new Map(input.observations.map((point) => [point.date, point.value])));
  const withData = maps.filter((map) => map.size > 0);
  if (withData.length < 2) return null;
  const dates = [...new Set(withData.flatMap((map) => [...map.keys()]))].sort().reverse();
  const shared = (date: string) => withData.every((map) => map.has(date));
  const date = dates.find(shared) ?? null;
  if (!date) return null;
  const target = minusDays(date, CURVE_LOOKBACK_DAYS);
  const ghostDate = dates.find((candidate) => candidate <= target && shared(candidate)) ?? null;
  const points = inputs.map((input, index) => ({
    key: input.key,
    value: maps[index].get(date) ?? null,
    ghost: ghostDate ? (maps[index].get(ghostDate) ?? null) : null,
  }));
  const values = points.flatMap((point) => [point.value, point.ghost]).filter((value): value is number => value !== null);
  let lo = Math.min(...values);
  let hi = Math.max(...values);
  if (hi - lo < CURVE_MIN_RANGE) {
    const mid = (hi + lo) / 2;
    lo = mid - CURVE_MIN_RANGE / 2;
    hi = mid + CURVE_MIN_RANGE / 2;
  }
  const pad = (hi - lo) * CURVE_PAD;
  return { points, date, ghostDate, lo: lo - pad, hi: hi + pad };
}

/** Değerin ölçekteki yeri: 0 dip, 1 tepe (SVG'de y = 1 − bu). */
export function curveRatio(value: number, curve: Pick<YieldCurve, "lo" | "hi">): number {
  return (value - curve.lo) / (curve.hi - curve.lo);
}

/* ------------------------------------------------------- /makro cümlesi */

/** Fed'in uzun dönem enflasyon hedefi (yüzde; FOMC, Ocak 2012 ve sonrası her yıl). */
export const FED_INFLATION_TARGET = 2;
/** Bu farkın altındaki değişim "değişmedi" (FRED en çok iki hane yayımlar). */
const FLAT_DELTA = 0.001;

export type LeadSeries = { id: string; latest: number; prev: number | null };

export type MacroLeadFacts = {
  inflation: { value: number; gap: number } | null;
  unemployment: { value: number; delta: number | null } | null;
  curve: { spread: number; shape: CurveShape } | null;
};

/**
 * Cümlenin olguları: TÜFE ve hedefe uzaklığı, işsizlik ve bir önceki aya
 * göre değişimi, 10 yıl − 3 ay farkı ve eğrinin biçimi. Seri yoksa o parça
 * düşer; üçü de yoksa cümle yok.
 */
export function macroLeadFacts(series: readonly LeadSeries[]): MacroLeadFacts | null {
  const find = (id: string) => series.find((item) => item.id === id);
  const cpi = find("CPIAUCSL");
  const unrate = find("UNRATE");
  const spread = find("T10Y3M");
  const facts: MacroLeadFacts = {
    inflation: cpi ? { value: cpi.latest, gap: cpi.latest - FED_INFLATION_TARGET } : null,
    unemployment: unrate ? { value: unrate.latest, delta: unrate.prev === null ? null : unrate.latest - unrate.prev } : null,
    curve: spread ? { spread: spread.latest, shape: curveShape(spread.latest) } : null,
  };
  return facts.inflation || facts.unemployment || facts.curve ? facts : null;
}

export type MacroLeadText = {
  /** "{value}", "{gap}" yer tutucuları. */
  inflationAbove: string;
  inflationBelow: string;
  inflationAt: string;
  /** "{value}", "{delta}". */
  unemploymentUp: string;
  unemploymentDown: string;
  unemploymentFlat: string;
  /** "{spread}". */
  curve: Record<CurveShape, string>;
  /** Son parçanın bağlacı (" ve ", " and "): öncekiler virgülle. Fonksiyon
      değil dize — sözlük istemciye de gidiyor. */
  and: string;
};

export type LeadFormat = {
  /** Büyük harf için: `toLocaleUpperCase` dilsiz çağrılırsa "i" → "I" olur, "İ" değil. */
  locale: string;
  percent: (value: number) => string;
  /** İşaretsiz puan ("1,72"). */
  points: (value: number) => string;
  /** İşaretli puan ("+0,88" / "−0,12"). */
  signedPoints: (value: number) => string;
};

/** Olgulardan tek cümle; büyük harf ve nokta burada. */
export function composeMacroLead(facts: MacroLeadFacts, text: MacroLeadText, format: LeadFormat): string {
  const parts: string[] = [];
  if (facts.inflation) {
    const { value, gap } = facts.inflation;
    const template = Math.abs(gap) < FLAT_DELTA ? text.inflationAt : gap > 0 ? text.inflationAbove : text.inflationBelow;
    parts.push(template.replace("{value}", format.percent(value)).replace("{gap}", format.points(Math.abs(gap))));
  }
  if (facts.unemployment) {
    const { value, delta } = facts.unemployment;
    const template = delta === null || Math.abs(delta) < FLAT_DELTA ? text.unemploymentFlat : delta > 0 ? text.unemploymentUp : text.unemploymentDown;
    parts.push(template.replace("{value}", format.percent(value)).replace("{delta}", format.points(Math.abs(delta ?? 0))));
  }
  if (facts.curve) {
    parts.push(text.curve[facts.curve.shape].replace("{spread}", format.signedPoints(facts.curve.spread)));
  }
  const sentence = parts.length < 2 ? (parts[0] ?? "") : `${parts.slice(0, -1).join(", ")}${text.and}${parts.at(-1)}`;
  return `${sentence.charAt(0).toLocaleUpperCase(format.locale)}${sentence.slice(1)}.`;
}

/* ------------------------------------------------ Sektör ısı matrisi */

/**
 * Hücrenin yoğunluğu: değerin SÜTUNUN en büyük mutlak değerine oranı, 0–1.
 * Ölçek sütun başına: bir yılın getirisi bir günün kırk katı ve tek ölçekte
 * 1G sütunu bütünüyle soluk kalırdı. Doğrusal (karekök değil): yarı
 * yoğunluk yarı büyüklük demek; göz farkı abartılmış okumasın.
 */
export function heatShare(value: number | null, peak: number): number {
  if (value === null || !Number.isFinite(value) || !(peak > 0)) return 0;
  return Math.min(1, Math.abs(value) / peak);
}

/**
 * Isı ölçeği tavanının basamakları (her onluk içinde). Yalnız TAM SAYI
 * yüzdeler: lejant tavanı ondalıksız yazıyor, %1,5 "%2" diye okunmasın
 * (1,5 ve 2,5 yalnız 15 ve 25 olarak, onluk 10 ve üstündeyse giriyor).
 */
const HEAT_STEPS = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10] as const;
/** En küçük tavan, yüzde puanı: düz bir günde %0,2'lik hareket tam ton olmasın. */
const HEAT_MIN_CEILING = 1;

/**
 * Sütunun YAZILI ölçeği (25 Ekim son düzeltme). Ölçek sütun başına kalıyor
 * (gerekçe `heatShare`) ama okura yazılmıyordu: 1G'de +%2,60 ile 1A'da
 * +%10,75 aynı koyulukta görünüyor ve neden olduğu hiçbir yerde
 * okunmuyordu. Artık sütunun en büyük hareketi yuvarlak bir tavana
 * (tam sayı yüzde, `HEAT_STEPS`) çıkıyor ve tam ton o tavan; lejant "1G ±%3 · 1A ±%15"
 * diye yazıyor. Tek ölçek denendi ve seçilmedi: bir yılın getirisi bir
 * günün onlarca katı, 1G sütunu bütünüyle soluk kalıyor ve sütunun asıl
 * sorusu (bugün hangi sektör öne çıktı) okunmuyordu.
 */
export function heatCeiling(peak: number): number {
  if (!Number.isFinite(peak) || peak <= HEAT_MIN_CEILING) return HEAT_MIN_CEILING;
  const power = 10 ** Math.floor(Math.log10(peak));
  for (const step of HEAT_STEPS) {
    const ceiling = step * power;
    if (Number.isInteger(ceiling) && ceiling >= peak - 1e-9) return ceiling;
  }
  return 10 * power;
}

export type SectorLeaders<T> = { best: T; worst: T; up: number; total: number };

/**
 * Matrisin üstündeki cümlenin olguları: dönemin en iyisi, en kötüsü ve
 * artıda kapatan sektör sayısı. İki değerden azsa cümle yok; en iyi ile en
 * kötü aynı satırsa (hepsi eşit) yine yok.
 */
export function sectorLeaders<T extends { value: number | null }>(rows: readonly T[]): SectorLeaders<T> | null {
  const valued = rows.filter((row): row is T & { value: number } => row.value !== null && Number.isFinite(row.value));
  if (valued.length < 2) return null;
  const sorted = [...valued].sort((a, b) => b.value - a.value);
  const best = sorted[0];
  const worst = sorted[sorted.length - 1];
  if (best.value === worst.value) return null;
  return { best, worst, up: valued.filter((row) => row.value > 0).length, total: valued.length };
}
