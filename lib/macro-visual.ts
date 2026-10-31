/**
 * Makro ve piyasa görsellerinin SAF mantığı (25 Ekim görsel turu):
 * getiri eğrisi minyatürü, eğrinin biçimi, /makro kapağının dört ölçüsü
 * (31 Ekim'e dek tek cümleydi),
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

/* ------------------------------------------------- /makro ölçüleri */

/** Fed'in uzun dönem enflasyon hedefi (yüzde; FOMC, Ocak 2012 ve sonrası her yıl). */
export const FED_INFLATION_TARGET = 2;
/** Sahm kuralının eşiği — yüzde puanı (Claudia Sahm, 2019). */
export const SAHM_THRESHOLD = 0.5;
/** Bu farkın altındaki değişim "değişmedi" (FRED en çok iki hane yayımlar). */
export const FLAT_DELTA = 0.001;
/** İşsizlik ölçeğinin aralığı: son bu kadar aylık gözlem (önceki ay dahil). */
export const UNEMPLOYMENT_RANGE_MONTHS = 12;

export type GaugeSeries = { id: string; latest: number; prev: number | null; points?: readonly { value: number }[] };

/** Ölçeğin iki ucu; değerin yeri `gaugeRatio` ile. */
export type GaugeDomain = { lo: number; hi: number };

export type MacroGaugeFacts = {
  /** TÜFE, hedefe uzaklığı; ölçek sıfırdan, hedef ve değerin üstünde yuvarlak bir tavana. */
  inflation: { value: number; gap: number; domain: GaugeDomain } | null;
  /** İşsizlik, önceki ay ve son 12 ayın aralığı (ölçeğin uçları). */
  unemployment: { value: number; prev: number | null; delta: number | null; domain: GaugeDomain } | null;
  /** 10 yıl − 3 ay farkı, biçimi ve eğim çiziminin simetrik ölçeği (±span). */
  curve: { spread: number; shape: CurveShape; span: number } | null;
  /** Sahm göstergesi; ölçek sıfırdan, eşiğin iki katına (değer aşarsa daha yukarı). */
  sahm: { value: number; triggered: boolean; domain: GaugeDomain } | null;
};

/**
 * /makro KAPAĞININ DÖRT ÖLÇÜSÜ (31 Ekim, sahibinin isteği: "üstteki
 * açıklama yazısı net okunmuyor; daha görsel, daha anlaşılabilir"). Önceki
 * hâl tek uzun cümleydi (`composeMacroLead`, 25 Ekim): TÜFE'nin hedefe
 * uzaklığı, işsizliğin son ayı ve eğrinin biçimi iki satırlık kalın bir
 * paragrafta, dönemleri altında 12 piksellik künyede. Olgular aynı; artık
 * her biri bir ÇİZİM (hedef ölçeği, önceki aydan bu aya ok, eğim) ve
 * altında kısa bir cümle. Dördüncü ölçü Sahm göstergesi: büyümenin
 * yerleşik tek eşikli resesyon sinyali, sayfada zaten seri olarak var.
 *
 * Ölçeklerin uçları VERİDEN ve yuvarlak: tavan uydurma bir "normal aralık"
 * değil, değerin ve hedefin/eşiğin sığdığı en küçük yuvarlak sayı. Seri
 * yoksa o ölçü düşer; hiçbiri yoksa bant basılmaz.
 */
export function macroGaugeFacts(series: readonly GaugeSeries[]): MacroGaugeFacts | null {
  const find = (id: string) => series.find((item) => item.id === id);
  const cpi = find("CPIAUCSL");
  const unrate = find("UNRATE");
  const spread = find("T10Y3M");
  const sahm = find("SAHMREALTIME");
  const facts: MacroGaugeFacts = {
    inflation: cpi ? {
      value: cpi.latest,
      gap: cpi.latest - FED_INFLATION_TARGET,
      domain: { lo: Math.min(0, Math.floor(cpi.latest)), hi: Math.ceil(Math.max(cpi.latest, FED_INFLATION_TARGET) + 0.5) },
    } : null,
    unemployment: unrate ? {
      value: unrate.latest,
      prev: unrate.prev,
      delta: unrate.prev === null ? null : unrate.latest - unrate.prev,
      domain: unemploymentDomain(unrate),
    } : null,
    curve: spread ? { spread: spread.latest, shape: curveShape(spread.latest), span: Math.max(1, Math.ceil(Math.abs(spread.latest) * 2) / 2) } : null,
    sahm: sahm ? {
      value: sahm.latest,
      triggered: sahm.latest >= SAHM_THRESHOLD,
      domain: {
        lo: Math.min(0, Math.floor(sahm.latest * 4) / 4),
        hi: Math.max(SAHM_THRESHOLD * 2, Math.ceil((sahm.latest + 0.25) * 4) / 4),
      },
    } : null,
  };
  return facts.inflation || facts.unemployment || facts.curve || facts.sahm ? facts : null;
}

/** Son 12 ayın en düşüğü ile en yükseği, onda bire yuvarlanıp birer onda bir açılmış. */
function unemploymentDomain(series: GaugeSeries): GaugeDomain {
  const recent = (series.points ?? []).slice(-UNEMPLOYMENT_RANGE_MONTHS).map((point) => point.value);
  const values = [series.latest, ...(series.prev === null ? [] : [series.prev]), ...recent];
  const lo = Math.floor(Math.min(...values) * 10) / 10 - 0.1;
  const hi = Math.ceil(Math.max(...values) * 10) / 10 + 0.1;
  return { lo: Number(lo.toFixed(1)), hi: Number(hi.toFixed(1)) };
}

/** Değerin ölçekteki yeri, 0 (sol) – 1 (sağ); uçların dışı uca kırpılır. */
export function gaugeRatio(value: number, domain: GaugeDomain): number {
  if (!(domain.hi > domain.lo)) return 0;
  return Math.min(1, Math.max(0, (value - domain.lo) / (domain.hi - domain.lo)));
}

/** Satır içi şablon: "{gap}" gibi yer tutucuları değerlerle doldurur. */
export function fillTemplate(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match);
}

/**
 * Izgaranın kolon birimi: 1–6 kartlık her satırı tam bölen en küçük sayı.
 * Kart `span` ile bu birimden pay alıyor (`balancedSpans`).
 */
export const TILE_GRID_UNITS = 60;

/**
 * DENGELİ SATIRLAR (31 Ekim). On bir kart altı kolonda 6 + 5 diziliyor ve
 * son kart boşluğu doldursun diye iki hücre alıyordu: ikinci satırın sonunda
 * tek geniş kart, "yetim" gibi okunuyordu (sahibinin itirazı). Artık satır
 * sayısı kolon tavanından, kartlar satırlara olabildiğince eşit bölünüyor
 * (11 → 6 + 5) ve her satır kendi kartlarını tam genişliğe yayıyor: ikinci
 * satırın beş kartı ilkinin altı kartından biraz geniş ama hepsi aynı
 * boyda; boş hücre ve tek geniş kart yok. Fazla kart ÜST satırlara gider.
 * Dönen dizi kart başına `TILE_GRID_UNITS` içinden pay.
 */
export function balancedSpans(count: number, maxPerRow: number): number[] {
  if (count <= 0 || maxPerRow <= 0) return [];
  const rows = Math.ceil(count / maxPerRow);
  const base = Math.floor(count / rows);
  const extra = count % rows;
  const spans: number[] = [];
  for (let row = 0; row < rows; row++) {
    const inRow = base + (row < extra ? 1 : 0);
    for (let i = 0; i < inRow; i++) spans.push(TILE_GRID_UNITS / inRow);
  }
  return spans;
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
