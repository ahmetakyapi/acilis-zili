/**
 * RİSK MASASI — SEMBOL ÖLÇÜLERİ (25 Ekim; sınama tests/risk-math.test.ts).
 *
 * Endeks fonu ya da pozisyon, aynı ölçü kümesi: ATR(14) ve ATR yüzdesi,
 * 10 ve 20 günlük gerçekleşen oynaklık, 20 günlüğün son bir yıldaki
 * dilimi, 50/100/200 günlük ortalamaya uzaklık ve hangilerinin altında
 * olduğu, 50/200 kesişimi, son seansta 100/200'ün aşağı kesilmesi, 52
 * haftalık tepeden düşüş ve SPY'a bir yıllık beta. Saf: girdi barlar.
 */

import {
  alignedBeta,
  atrSeries,
  crossOnLast,
  crossedBelowOnLast,
  distancePct,
  drawdownFromPeak,
  percentileOfLast,
  realizedVol,
  rollingVol,
  sma,
  type CrossKind,
  type DailyBar,
} from "./math";
import { ATR_PERIOD, BETA_WINDOW, MA_WINDOWS, PERCENTILE_WINDOW, VOL_LONG, VOL_SHORT, type MaWindow } from "./thresholds";
import type { MaFlags } from "./rules";

const PERCENT = 100;
/** Dilim için en az gözlem — yarım yıl. */
const MIN_PCTILE_HISTORY = 126;
/** Beta için en az ortak getiri. */
const MIN_BETA_OBS = 120;

export type MaReading = { value: number | null; distance: number | null };

export type SymbolMeasures = {
  symbol: string;
  date: string;
  close: number;
  atr: number | null;
  atrPct: number | null;
  vol10: number | null;
  vol20: number | null;
  vol20Pctile: number | null;
  ma: Record<MaWindow, MaReading>;
  below: MaFlags;
  cross: CrossKind | null;
  crossedBelow: { 100: boolean; 200: boolean };
  drawdown: number | null;
  beta: number | null;
};

export function measureSymbol(symbol: string, bars: readonly DailyBar[], bench: readonly DailyBar[] | null): SymbolMeasures | null {
  const last = bars[bars.length - 1];
  if (!last) return null;
  const closes = bars.map((b) => b.close);
  const atr = atrSeries(bars, ATR_PERIOD).at(-1) ?? null;
  const averages = Object.fromEntries(MA_WINDOWS.map((w) => [w, sma(closes, w)])) as Record<MaWindow, (number | null)[]>;
  const ma = Object.fromEntries(
    MA_WINDOWS.map((w) => {
      const value = averages[w].at(-1) ?? null;
      return [w, { value, distance: distancePct(last.close, value) }];
    }),
  ) as Record<MaWindow, MaReading>;
  const below = Object.fromEntries(MA_WINDOWS.map((w) => [w, ma[w].value === null ? null : last.close < ma[w].value!])) as MaFlags;
  return {
    symbol,
    date: last.date,
    close: last.close,
    atr,
    atrPct: atr !== null && last.close > 0 ? (atr / last.close) * PERCENT : null,
    vol10: realizedVol(closes, VOL_SHORT),
    vol20: realizedVol(closes, VOL_LONG),
    vol20Pctile: percentileOfLast(rollingVol(closes, VOL_LONG), PERCENTILE_WINDOW, MIN_PCTILE_HISTORY),
    ma,
    below,
    cross: crossOnLast(averages[50], averages[200]),
    crossedBelow: { 100: crossedBelowOnLast(closes, averages[100]), 200: crossedBelowOnLast(closes, averages[200]) },
    drawdown: drawdownFromPeak(closes, PERCENTILE_WINDOW),
    beta: bench ? alignedBeta(bars, bench, BETA_WINDOW, MIN_BETA_OBS) : null,
  };
}

/** Ağırlıklı ortalama — değeri bilinmeyen satır paydadan da çıkar. */
export function weightedMean(rows: readonly { weight: number; value: number | null }[]): { value: number; coveredWeight: number } | null {
  let sum = 0;
  let weight = 0;
  for (const row of rows) {
    if (row.value === null) continue;
    sum += row.value * row.weight;
    weight += row.weight;
  }
  return weight > 0 ? { value: sum / weight, coveredWeight: weight } : null;
}
