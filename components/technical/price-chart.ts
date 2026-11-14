import { rollingAverage } from "@/components/stock/average-paths";
import { barDate } from "@/lib/period-returns";
import type { Bar } from "@/lib/providers/types";
import type { Level } from "@/lib/technical";
import { spreadLabels } from "@/lib/technical-visuals";

/**
 * Teknik analiz kapağındaki fiyat grafiğinin SAF hesabı (14 Kasım 2026).
 * Çizim `PriceChart.tsx`te; burada yalnız pencere, alan ve etiket yerleri.
 * Testi `tests/technical-price-chart.test.ts`.
 *
 * PENCERE ALTI AY, ORTALAMA BİR YIL. Ortalamalar barların TAMAMINDAN
 * hesaplanır (200 günlük, 254 barlık "1Y" serisinin ancak son 55 seansında
 * var), sonra son `CHART_SESSIONS` seans gösterilir. Önce kesip sonra
 * hesaplasaydık 200 günlük hiç çizilmezdi.
 */
export const CHART_SESSIONS = 126;
export const CHART_WINDOWS = [20, 50, 200] as const;
/* Grafiğe yeten en az seans: altında çizgi bir "eğilim" değil birkaç nokta. */
const MIN_SESSIONS = 30;
/* Fiyattan bu orandan uzak seviye eksene GİRMEZ: tek bir uzak direnç bütün
   geçmişi alt üçte bire sıkıştırırdı. Seviye listede yazılı kalır. */
const LEVEL_REACH = 0.45;
/* Alanın üst ve alt payı (alanın oranı): uçtaki seviyenin etiketi kutudan
   taşmasın, çizgi kenara yapışmasın. */
const DOMAIN_PAD = 0.07;

export type ChartLevel = Level & {
  /** Çizgi ve etiket rengi: SAT'ta hedef "satış seviyesi"dir. */
  tone: Level["kind"] | "sellLevel";
  /** Çizginin dikey yeri, 0 (üst) – 1 (alt). Bölgede bandın ortası. */
  y: number;
  /** Yalnız bölgede: bandın üst ve alt kenarı. */
  yTop?: number;
  yBottom?: number;
};

export type PriceChartModel = {
  /** Gösterilen seansların ET tarihi, eskiden yeniye. */
  dates: string[];
  /** Gösterilen kapanışlar; son nokta kotasyon (başlıktaki fiyatla aynı sayı). */
  closes: number[];
  averages: { window: (typeof CHART_WINDOWS)[number]; values: (number | null)[]; last: number | null }[];
  domain: { min: number; max: number };
  levels: ChartLevel[];
  /** Eksene sığmadığı için çizilmeyen seviye sayısı. */
  offScale: number;
  priceY: number | null;
  /** Ay başları: x 0–1, tarih o ayın ilk seansı. */
  months: { x: number; date: string }[];
};

export function buildPriceChart(
  bars: readonly Bar[],
  price: number | null,
  levels: readonly Level[],
  sellSide: boolean,
): PriceChartModel | null {
  const clean = bars.filter((bar) => Number.isFinite(bar.close) && bar.close > 0);
  if (clean.length < MIN_SESSIONS) return null;
  const allCloses = clean.map((bar) => bar.close);
  /* Son nokta KOTASYON: başlıktaki fiyat ile çizginin ucu aynı sayı
     (`veri-ve-onbellek.md` → "aynı sayı iki yerde aynı kaynaktan"; hisse
     sayfasındaki `AveragesChart` ile aynı kural). */
  if (price !== null && Number.isFinite(price) && price > 0) allCloses[allCloses.length - 1] = price;
  const from = Math.max(0, clean.length - CHART_SESSIONS);
  const closes = allCloses.slice(from);
  const dates = clean.slice(from).map((bar) => barDate(bar));
  const averages = CHART_WINDOWS.map((window) => {
    const values = rollingAverage(allCloses, window).slice(from);
    return { window, values, last: values[values.length - 1] ?? null };
  }).filter((average) => average.values.some((value) => value !== null));

  const reference = closes[closes.length - 1]!;
  const inReach = (value: number) => Math.abs(value - reference) / reference <= LEVEL_REACH;
  const kept = levels.filter((level) => inReach(level.price) && (level.high === undefined || inReach(level.high)));

  let min = Infinity;
  let max = -Infinity;
  const take = (value: number | null | undefined) => {
    if (value === null || value === undefined || !Number.isFinite(value)) return;
    if (value < min) min = value;
    if (value > max) max = value;
  };
  closes.forEach(take);
  averages.forEach((average) => average.values.forEach(take));
  kept.forEach((level) => {
    take(level.price);
    take(level.high);
  });
  if (!Number.isFinite(min) || !Number.isFinite(max)) return null;
  const span = max - min || max * 0.02 || 1;
  const domain = { min: min - span * DOMAIN_PAD, max: max + span * DOMAIN_PAD };
  const yOf = (value: number) => 1 - (value - domain.min) / (domain.max - domain.min);

  const months: PriceChartModel["months"] = [];
  dates.forEach((date, index) => {
    if (index === 0) return;
    if (date.slice(0, 7) !== dates[index - 1]!.slice(0, 7)) months.push({ x: index / (dates.length - 1), date });
  });

  return {
    dates,
    closes,
    averages,
    domain,
    levels: kept.map((level) => ({
      ...level,
      tone: level.kind === "target" && sellSide ? "sellLevel" : level.kind,
      y: yOf(level.high !== undefined ? (level.price + level.high) / 2 : level.price),
      ...(level.high !== undefined ? { yTop: yOf(level.high), yBottom: yOf(level.price) } : {}),
    })),
    offScale: levels.length - kept.length,
    priceY: price !== null ? yOf(reference) : null,
    months,
  };
}

/**
 * Sağ sütundaki etiketlerin dikey yeri (0–1). Seviyeler ve fiyat AYNI
 * itmeden geçer: fiyat çoğu gün bir desteğin birkaç sent üstünde durur
 * (NVDA 161,01 / destek 160,71) ve ayrı itilselerdi üst üste binerlerdi.
 * `gap` iki etiket arası en az pay; çizim yüksekliğine göre çağıran verir.
 */
export function chartLabelSlots(ys: readonly number[], gap: number): number[] {
  if (ys.length === 0) return [];
  /* Etiket sayısı sütuna sığmıyorsa pay eşit bölünür; üst üste binmektense
     sıkışık ama ayrık dursun. */
  const fit = Math.min(gap, 1 / Math.max(1, ys.length - 1));
  return spreadLabels(ys, fit, 0, 1);
}
