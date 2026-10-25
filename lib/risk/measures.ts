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
import {
  ATR_PERIOD,
  BETA_WINDOW,
  MA_WINDOWS,
  PERCENTILE_WINDOW,
  POSITION_VOL_PCTILE,
  TRAIL_POINTS,
  VOL_LONG,
  VOL_SHORT,
  type MaWindow,
} from "./thresholds";
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

/* --------------------------------------------------------------------------
   Pozisyon kartı (25 Ekim, kart düzeni)
   -------------------------------------------------------------------------- */

/** Kart minyatürü: son `points` kapanış ve aynı günlerin 50/100/200 GO'su. */
export type PriceTrail = { closes: number[]; ma: Record<MaWindow, (number | null)[]> };

/**
 * Ortalamalar BÜTÜN seriden hesaplanıp sonra kesilir: son üç ayın 200
 * GO'su, üç aylık pencerenin içinden değil geriye 200 seanstan gelir.
 * Pencere dolmamış gün null (çizgi orada başlamaz).
 */
export function priceTrail(bars: readonly DailyBar[], points = TRAIL_POINTS): PriceTrail {
  const closes = bars.map((b) => b.close);
  const ma = Object.fromEntries(MA_WINDOWS.map((w) => [w, sma(closes, w).slice(-points)])) as Record<MaWindow, (number | null)[]>;
  return { closes: closes.slice(-points), ma };
}

export type Tone = 0 | 1 | 2;

/** Pozisyonun tonu — eşiklerin gerekçesi thresholds.ts → POSITION_VOL_PCTILE. */
export function positionTone(m: { below: MaFlags; vol20Pctile: number | null }): Tone {
  const trend: Tone = m.below[200] === true ? 2 : m.below[100] === true ? 1 : 0;
  const p = m.vol20Pctile;
  const vol: Tone = p === null ? 0 : p >= POSITION_VOL_PCTILE.stress ? 2 : p >= POSITION_VOL_PCTILE.tense ? 1 : 0;
  return Math.max(trend, vol) as Tone;
}

/**
 * Ortalamanın altındaki ağırlık — KAPSAMIYLA. Ortalaması hesaplanamayan
 * (geçmişi pencereden kısa) pozisyon ne "altında" ne "üstünde" sayılır:
 * payda dışında kalır ve `covered` onu söyler. 25 Ekim'de ekranda "200 GO
 * Altındaki Ağırlık %0,0" yanında "100 GO %100,0" görüldü; hesap doğruydu
 * (dört pozisyon 100 GO'nun altında ama 200 GO'nun üstünde, SHAZ'ın 173
 * seanslık geçmişi 200 GO'ya yetmiyor), eksik olan bu kapsamın söylenmesiydi.
 */
export function belowShares(rows: readonly { weight: number; below: MaFlags }[]): Record<MaWindow, { weight: number; covered: number }> {
  return Object.fromEntries(
    MA_WINDOWS.map((w) => {
      let weight = 0;
      let covered = 0;
      for (const row of rows) {
        if (row.below[w] === null) continue;
        covered += row.weight;
        if (row.below[w]) weight += row.weight;
      }
      return [w, { weight, covered }];
    }),
  ) as Record<MaWindow, { weight: number; covered: number }>;
}
