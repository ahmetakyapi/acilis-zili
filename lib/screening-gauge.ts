import { THRESHOLDS as T, type Check, type CheckId } from "@/lib/screening";

/**
 * "Kural Kural" satırlarının EŞİK KULVARI (25 Ekim, görsel zirve turu).
 *
 * Yirmi iki satır sayı + rozetti: "%42,8 · Geçti" eşiğin ne kadar üstünde
 * olduğunu söylemiyordu; %31 ile %420 aynı rozeti alıyordu. Kulvar eşiği
 * çentik, değeri nokta olarak çiziyor ve aradaki farkı UZUNLUK yapıyor —
 * kıl payı geçen ile rahat geçen tek bakışta ayrılıyor.
 *
 * EŞİKLER MOTORUN KENDİSİNDEN (`THRESHOLDS`); burada yeni sayı yok. Tek yeni
 * bilgi her kuralın ÖLÇEĞİ (kulvarın iki ucu): ölçünün doğal aralığı ve
 * eşiği okunur bir yere koyan pencere. Uçların dışına düşen değer uca
 * oturur ve `clipped` taşır (ekranda açık nokta) — sayı satırda yazılı.
 *
 * TABANI BÜYÜKLÜK OLAN ÜÇ KURAL LOGARİTMİK. Piyasa değeri 300 milyon
 * tabanına karşı 4 trilyon olabiliyor; doğrusal ölçekte eşik sol uca
 * yapışır ve her geçen hisse aynı yerde dururdu. Orada uzunluk FARK değil
 * KAT (on kat = bir aralık); kulvarın künyesi bunu yazıyor.
 *
 * KULVAR ALMAYAN KURALLAR — bilerek:
 *  - `profitable`: ölçü dolar cinsinden EPS, kural yalnız işaret (> 0).
 *    Şirketler arası ortak bir ölçek yok; uydurulan pencere yalan söylerdi.
 *  - `funds`: satırdaki sayı fon ADEDİ, kural ise artıran/azaltan
 *    karşılaştırması — eşiğe konacak bir ölçü yok.
 *  - Değeri olmayan satır (Veri Yok, banka sağlık kuralları).
 */

export type GaugeScale = "linear" | "log";

export type GaugeSpec = {
  /** Geçme eşiği. `min`: değer ≥ eşik geçer; `max`: değer ≤ eşik geçer. */
  pass: number;
  side: "min" | "max";
  /** Dikkat sınırı — varsa ikinci, ince çentik. */
  warn?: number;
  lo: number;
  hi: number;
  scale: GaugeScale;
};

/** Kural → kulvar. Eşikler `THRESHOLDS`ten; yalnız uçlar burada. */
export const GAUGES: Partial<Record<CheckId, GaugeSpec>> = {
  marketCap: { pass: T.minMarketCap, side: "min", lo: 1e8, hi: 1e13, scale: "log" },
  price: { pass: T.minPrice, side: "min", lo: 1, hi: 1e3, scale: "log" },
  liquidity: { pass: T.minAvgVolume, side: "min", lo: 1e5, hi: 1e8, scale: "log" },
  epsGrowthQ: { pass: T.minGrowth, side: "min", warn: 0, lo: -30, hi: 60, scale: "linear" },
  salesGrowthQ: { pass: T.minGrowth, side: "min", warn: 0, lo: -30, hi: 60, scale: "linear" },
  epsGrowth3Y: { pass: T.minGrowth, side: "min", warn: 0, lo: -30, hi: 60, scale: "linear" },
  growthSource: { pass: T.supportGrowth, side: "min", lo: -30, hi: 60, scale: "linear" },
  margins: { pass: 0, side: "min", lo: -40, hi: 60, scale: "linear" },
  currentRatio: { pass: T.minCurrentRatio, side: "min", warn: 0.8, lo: 0, hi: 3, scale: "linear" },
  debt: { pass: T.maxDebtToEquity, side: "max", warn: T.maxDebtToEquity * 2, lo: 0, hi: 3, scale: "linear" },
  /* Pist yalnız serbest nakit akışı eksiyken ölçülüyor ve o zaman en iyi hâl
     "dikkat" (bkz. lib/screening.ts): çentik iki yıl, eleme bir yıl. */
  runway: { pass: T.minRunwayYears, side: "min", warn: 1, lo: 0, hi: 5, scale: "linear" },
  vsMarket: { pass: 0, side: "min", warn: -T.laggardTolerance, lo: -40, hi: 40, scale: "linear" },
  vsSector: { pass: 0, side: "min", warn: -T.laggardTolerance, lo: -40, hi: 40, scale: "linear" },
  aboveLow: { pass: T.minAboveLow, side: "min", warn: 10, lo: 0, hi: 150, scale: "linear" },
  nearHigh: { pass: T.maxBelowHigh, side: "max", warn: T.maxBelowHigh * 2, lo: 0, hi: 75, scale: "linear" },
  dilution: { pass: T.maxDilution, side: "max", warn: 5, lo: -10, hi: 10, scale: "linear" },
  /* MSPR −100…100 doğal aralığında; artı net alım geçer, −50 ve altı dikkat. */
  insiders: { pass: 0, side: "min", warn: -50, lo: -100, hi: 100, scale: "linear" },
  analystTrend: { pass: T.analystShift, side: "min", warn: -T.analystShift, lo: -15, hi: 15, scale: "linear" },
  upside: { pass: T.minUpside, side: "min", warn: 0, lo: -30, hi: 50, scale: "linear" },
  earningsQuality: { pass: T.minAnalysisScore, side: "min", warn: 40, lo: 0, hi: 100, scale: "linear" },
};

export type Gauge = {
  spec: GaugeSpec;
  /** 0–100: kulvardaki yerler. */
  valueAt: number;
  passAt: number;
  warnAt: number | null;
  clipped: -1 | 0 | 1;
};

function placeOn(spec: GaugeSpec, v: number): number {
  if (spec.scale === "log") {
    const lo = Math.log10(spec.lo);
    const hi = Math.log10(spec.hi);
    const x = v > 0 ? Math.log10(v) : lo;
    return Math.min(100, Math.max(0, ((x - lo) / (hi - lo)) * 100));
  }
  return Math.min(100, Math.max(0, ((v - spec.lo) / (spec.hi - spec.lo)) * 100));
}

/** Satırın kulvarı; ölçek ya da değer yoksa null (satır yalnız sayı + rozet). */
export function gaugeOf(check: Pick<Check, "id" | "value" | "status">): Gauge | null {
  const spec = GAUGES[check.id];
  if (!spec || check.value === null || !Number.isFinite(check.value)) return null;
  const v = check.value;
  return {
    spec,
    valueAt: placeOn(spec, v),
    passAt: placeOn(spec, spec.pass),
    warnAt: spec.warn === undefined ? null : placeOn(spec, spec.warn),
    clipped: v < spec.lo || (spec.scale === "log" && v <= 0) ? -1 : v > spec.hi ? 1 : 0,
  };
}

/* --------------------------------------------------------------------------
   Puan halkasının kategori dilimleri
   -------------------------------------------------------------------------- */

export type DialSlice = {
  category: string;
  /** Halkadaki başlangıç ve uzunluk, 0–1 (ağırlık payı). */
  start: number;
  length: number;
  /** Dilimin dolu kısmı, 0–1 (kategori puanı / 100). */
  fill: number;
};

/**
 * Halka kategori dilimlerine ayrılıyor: her dilimin boyu kategorinin
 * AĞIRLIĞI (ölçülen kategoriler arasında payı), dolu kısmı kategori PUANI.
 * Dolu kısımların toplamı motorun ağırlıklı ortalamasının ta kendisi
 * (lib/screening.ts → `raw`), yani halka yanında yazan puanla aynı sayıyı
 * çiziyor. Elenen hissede puan tavana (`ELIMINATED_CAP`) kırpılıyor ve
 * dilimler o sayıyı vermez: orada dilim yok, tek halka kalır (null).
 */
export function dialSlices(
  categories: readonly { category: string; score: number | null; weight: number }[],
  eliminated: boolean,
): DialSlice[] | null {
  if (eliminated) return null;
  const scored = categories.filter((c) => c.score !== null);
  const total = scored.reduce((sum, c) => sum + c.weight, 0);
  if (total <= 0) return null;
  let start = 0;
  return scored.map((c) => {
    const slice = { category: c.category, start, length: c.weight / total, fill: Math.max(0, Math.min(1, c.score! / 100)) };
    start += slice.length;
    return slice;
  });
}
