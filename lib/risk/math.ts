/**
 * RİSK MASASI — SAF ÖLÇÜLER (25 Ekim; sınama tests/risk-math.test.ts).
 *
 * Girdi tamamlanmış seansların günlük barları; çıktı sayı ya da null.
 * PENCERE DOLMADIYSA NULL (lib/utils.ts'teki ortalama kuralıyla aynı):
 * yarım pencereyle hesaplanmış "200 günlük ortalama" 200 günlük ortalama
 * değildir, kısa geçmişli bir hissede ekran onu hiç basmaz.
 */

import { percentileRank } from "@/lib/sentiment";
import { beta as betaOf } from "@/lib/portfolio-risk";
import { BAND_Z, EWMA_LAMBDA, FORECAST_HORIZON } from "./thresholds";

export const TRADING_DAYS = 252;
const PERCENT = 100;
/** EWMA varyansının tohumu: ilk bu kadar getirinin örnek varyansı. */
const EWMA_SEED = 30;

export type DailyBar = { date: string; open: number; high: number; low: number; close: number };

export { percentileRank };

/** Ardışık kapanışların log getirisi; sonuç bir eksik uzunlukta. */
export function logReturns(closes: readonly number[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < closes.length; i += 1) {
    const a = closes[i - 1]!;
    const b = closes[i]!;
    out.push(a > 0 && b > 0 ? Math.log(b / a) : 0);
  }
  return out;
}

function sampleStd(values: readonly number[]): number {
  const n = values.length;
  if (n < 2) return 0;
  const mean = values.reduce((sum, v) => sum + v, 0) / n;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / (n - 1);
  return Math.sqrt(variance);
}

/** Son `window` log getirisinin yıllıklaştırılmış standart sapması, yüzde. */
export function realizedVol(closes: readonly number[], window: number): number | null {
  if (closes.length < window + 1) return null;
  return sampleStd(logReturns(closes.slice(-(window + 1)))) * Math.sqrt(TRADING_DAYS) * PERCENT;
}

/** Her gün için gerçekleşen oynaklık (pencere dolmadan null). */
export function rollingVol(closes: readonly number[], window: number): (number | null)[] {
  const returns = logReturns(closes);
  const out: (number | null)[] = [null];
  for (let i = 0; i < returns.length; i += 1) {
    out.push(i + 1 >= window ? sampleStd(returns.slice(i + 1 - window, i + 1)) * Math.sqrt(TRADING_DAYS) * PERCENT : null);
  }
  return out;
}

/** Basit kayan ortalama — pencere dolmadan null. */
export function sma(values: readonly number[], window: number): (number | null)[] {
  const out: (number | null)[] = [];
  let sum = 0;
  for (let i = 0; i < values.length; i += 1) {
    sum += values[i]!;
    if (i >= window) sum -= values[i - window]!;
    out.push(i >= window - 1 ? sum / window : null);
  }
  return out;
}

/**
 * Wilder'ın ATR'si: gerçek aralık (TR) = max(yüksek − düşük, |yüksek − önceki
 * kapanış|, |düşük − önceki kapanış|); ilk ATR ilk `period` TR'nin ortalaması,
 * sonrası (önceki × (n − 1) + TR) / n. İlk barın önceki kapanışı yok, TR'si
 * yalnız yüksek − düşük.
 */
export function atrSeries(bars: readonly DailyBar[], period: number): (number | null)[] {
  const out: (number | null)[] = [];
  let atr: number | null = null;
  let seed = 0;
  for (let i = 0; i < bars.length; i += 1) {
    const bar = bars[i]!;
    const prev = i > 0 ? bars[i - 1]!.close : null;
    const tr = prev === null ? bar.high - bar.low : Math.max(bar.high - bar.low, Math.abs(bar.high - prev), Math.abs(bar.low - prev));
    if (i < period) {
      seed += tr;
      if (i === period - 1) atr = seed / period;
    } else if (atr !== null) {
      atr = (atr * (period - 1) + tr) / period;
    }
    out.push(atr);
  }
  return out;
}

/** Fiyatın bir düzeye uzaklığı, yüzde ((fiyat / düzey − 1) × 100). */
export function distancePct(price: number, level: number | null): number | null {
  if (level === null || !(level > 0)) return null;
  return (price / level - 1) * PERCENT;
}

/** Son `lookback` kapanışın tepesinden bugünkü kapanışa düşüş, yüzde (≤ 0). */
export function drawdownFromPeak(closes: readonly number[], lookback: number): number | null {
  if (closes.length === 0) return null;
  const window = closes.slice(-lookback);
  const peak = Math.max(...window);
  return peak > 0 ? (closes[closes.length - 1]! / peak - 1) * PERCENT : null;
}

/** Değerin son `window` gözlem içindeki yüzdelik dilimi (0–100). */
export function percentileOfLast(series: readonly (number | null)[], window: number, minHistory: number): number | null {
  const last = series[series.length - 1];
  if (last === null || last === undefined) return null;
  const history = series.slice(-window).filter((v): v is number => v !== null);
  if (history.length < minHistory) return null;
  return percentileRank(history, last);
}

/**
 * Tarihe göre hizalanmış basit getirilerle beta. Yalnız iki seride de
 * kapanışı olan ardışık günler sayılır; `minObs`tan azsa null.
 */
export function alignedBeta(
  asset: readonly { date: string; close: number }[],
  bench: readonly { date: string; close: number }[],
  window: number,
  minObs: number,
): number | null {
  const benchOf = new Map(bench.map((p) => [p.date, p.close]));
  const pairs = asset.filter((p) => benchOf.has(p.date)).slice(-(window + 1));
  const a: number[] = [];
  const b: number[] = [];
  for (let i = 1; i < pairs.length; i += 1) {
    const pa = pairs[i - 1]!;
    const pb = pairs[i]!;
    const ba = benchOf.get(pa.date)!;
    const bb = benchOf.get(pb.date)!;
    if (!(pa.close > 0 && ba > 0)) continue;
    a.push(pb.close / pa.close - 1);
    b.push(bb / ba - 1);
  }
  if (a.length < minObs) return null;
  return betaOf(a, b);
}

export type CrossKind = "golden" | "death";

/** Son barda 50/200 kesişimi oldu mu (dünkü sıra ile bugünkü sıra farklı). */
export function crossOnLast(fast: readonly (number | null)[], slow: readonly (number | null)[]): CrossKind | null {
  const n = fast.length;
  if (n < 2) return null;
  const f0 = fast[n - 2];
  const s0 = slow[n - 2];
  const f1 = fast[n - 1];
  const s1 = slow[n - 1];
  if (f0 == null || s0 == null || f1 == null || s1 == null) return null;
  if (f0 <= s0 && f1 > s1) return "golden";
  if (f0 >= s0 && f1 < s1) return "death";
  return null;
}

/** Son barda kapanış ortalamayı aşağı kesti mi (dün üstünde ya da üzerinde, bugün altında). */
export function crossedBelowOnLast(closes: readonly number[], average: readonly (number | null)[]): boolean {
  const n = closes.length;
  if (n < 2) return false;
  const a0 = average[n - 2];
  const a1 = average[n - 1];
  if (a0 == null || a1 == null) return false;
  return closes[n - 2]! >= a0 && closes[n - 1]! < a1;
}

/* --------------------------------------------------------------------------
   Oynaklık tahmini — EWMA (RiskMetrics, λ = 0,94)
   -------------------------------------------------------------------------- */

/**
 * NEDEN EWMA, GARCH DEĞİL. GARCH(1,1) üç parametreyi en çok olabilirlikle
 * kestirmek ister; birkaç yüz gözlemde kestirim kararsız (ω, α, β sınıra
 * yapışıyor) ve sunucuda her sembol için sayısal en iyileme demek. EWMA
 * tek parametreli, kapalı biçimli ve RiskMetrics'in (J.P. Morgan, 1996)
 * günlük veri için yayımladığı λ = 0,94 ile standart. Bedeli: EWMA'nın
 * vade yapısı düz — on günlük tahmin, bugünkü günlük varyansın on katı;
 * GARCH gibi uzun dönem ortalamaya dönüş varsaymaz. Ekran bunu "tahmin"
 * olarak ve geçmişteki tutma oranıyla birlikte yazar.
 */
export function ewmaVariance(returns: readonly number[], lambda = EWMA_LAMBDA): number[] {
  if (returns.length < EWMA_SEED) return [];
  const seed = sampleStd(returns.slice(0, EWMA_SEED)) ** 2;
  const out: number[] = [];
  let variance = seed;
  for (let i = 0; i < returns.length; i += 1) {
    variance = lambda * variance + (1 - lambda) * returns[i]! ** 2;
    out.push(variance);
  }
  return out;
}

export type VolForecast = {
  /** Önümüzdeki gün(ler) için yıllıklaştırılmış oynaklık tahmini, yüzde. */
  annualized: number;
  horizon: number;
  /** Ufuk boyunca getirinin %90'lık bandı, yüzde (alt eksi, üst artı). */
  bandLow: number;
  bandHigh: number;
  /**
   * Bandın geçmişte tuttuğu pay (0–100): örtüşmeyen on günlük pencerelerde
   * gerçekleşen getirinin bandın içinde kaldığı oran. Normal dağılım
   * varsayımı doğru olsaydı ~90 olurdu; altında kalması kalın kuyruğu söyler.
   */
  coverage: number | null;
  coverageSamples: number;
};

export function ewmaForecast(closes: readonly number[], horizon = FORECAST_HORIZON, lambda = EWMA_LAMBDA): VolForecast | null {
  const returns = logReturns(closes);
  const variances = ewmaVariance(returns, lambda);
  if (variances.length === 0) return null;
  const daily = Math.sqrt(variances[variances.length - 1]!);
  const horizonSigma = daily * Math.sqrt(horizon);
  const toPct = (logReturn: number) => (Math.exp(logReturn) - 1) * PERCENT;

  /* Tutma oranı: t günü bilinen varyansla (t dahil) t+1..t+h getirisini
     tahmin et; pencereler örtüşmesin diye h adım atla. */
  let inside = 0;
  let samples = 0;
  for (let t = EWMA_SEED; t + horizon < returns.length; t += horizon) {
    const sigma = Math.sqrt(variances[t]!) * Math.sqrt(horizon);
    let realized = 0;
    for (let k = 1; k <= horizon; k += 1) realized += returns[t + k]!;
    samples += 1;
    if (Math.abs(realized) <= BAND_Z * sigma) inside += 1;
  }
  return {
    annualized: daily * Math.sqrt(TRADING_DAYS) * PERCENT,
    horizon,
    bandLow: toPct(-BAND_Z * horizonSigma),
    bandHigh: toPct(BAND_Z * horizonSigma),
    coverage: samples > 0 ? (inside / samples) * PERCENT : null,
    coverageSamples: samples,
  };
}
