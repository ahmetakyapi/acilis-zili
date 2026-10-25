/**
 * RİSK MASASI — GERİYE DÖNÜK TEST (25 Ekim; sınama tests/risk-backtest.test.ts).
 *
 * Her hazır sinyal için: geçmişte kaç kez tetiklendi, tetiklemeden sonraki
 * 5 ve 20 işlem gününde SPY'ın ortalama ve medyan getirisi, ve isabet oranı.
 *
 * "DOĞRU ALARM" TANIMI: tetiklemeden sonraki 20 işlem günü içinde SPY
 * kapanışlarından biri, tetikleme günü kapanışının en az %5 altında
 * (`HIT_DRAWDOWN_PCT`). Bu tanım bir "satış uyarısı"nın işe yarayıp
 * yaramadığını ölçer; altın kesişim gibi olumlu okunan sinyallerde de aynı
 * ölçü basılır — yorum okurundur, tablo yalnız ne olduğunu söyler.
 *
 * TABAN ORAN ŞART. "%30 isabet" tek başına anlamsız: rastgele bir günde de
 * sonraki 20 günde %5 düşüş görülme olasılığı sıfır değil. Her sinyalin
 * yanında aynı dönemde BÜTÜN günlerin oranı (`base`) durur.
 *
 * KENAR TETİKLEME + BEKLEME. Sinyal koşulun yanlıştan doğruya döndüğü gün
 * sayılır; aynı sinyal `SIGNAL_COOLDOWN` gün içinde yeniden sayılmaz —
 * eşiğin çevresinde gidip gelen VIX tek olayı on olaya çevirmesin.
 * Ufku henüz dolmamış tetiklemeler sayılır ama getiri ve isabete girmez
 * ("sonucu bekleniyor").
 */

import {
  FORWARD_LONG,
  FORWARD_SHORT,
  HIT_DRAWDOWN_PCT,
  SIGNAL_COOLDOWN,
  SIGNAL_CREDIT_WIDENING_PTS,
  SIGNAL_VIX_ABOVE,
  SIGNAL_VOL_PCTILE,
  TERM_RATIO,
  VIX_CHANGE_5D_PCT,
  VIX_CHANGE_DAYS,
  CREDIT_CHANGE_DAYS,
} from "./thresholds";
import { drawdownWithin, forwardReturn, quantile, type DeskDay, type RegimeDay } from "./regime";

const PERCENT = 100;

export const SIGNAL_KEYS = [
  "regimeRiskOff",
  "vixAbove",
  "vixSpike",
  "termInverted",
  "creditWidening",
  "spyBelow100",
  "spyBelow200",
  "deathCross",
  "goldenCross",
  "volPctile",
] as const;
export type SignalKey = (typeof SIGNAL_KEYS)[number];

export type SignalContext = {
  days: readonly DeskDay[];
  regimes: readonly RegimeDay[];
  /** SPY'ın 20 günlük oynaklığının son bir yıldaki dilimi, gün gün. */
  volPctile: readonly (number | null)[];
};

/** Sinyalin DURUMU o gün (tetikleme bu durumun yanlıştan doğruya dönüşü). */
export function signalState(key: SignalKey, ctx: SignalContext, i: number): boolean | null {
  const d = ctx.days[i];
  if (!d) return null;
  switch (key) {
    case "regimeRiskOff": {
      const r = ctx.regimes[i]?.regime;
      return r ? r === "riskOff" : null;
    }
    case "vixAbove":
      return d.vix === null ? null : d.vix > SIGNAL_VIX_ABOVE;
    case "vixSpike": {
      const before = ctx.days[i - VIX_CHANGE_DAYS]?.vix;
      return d.vix === null || !before ? null : (d.vix / before - 1) * PERCENT >= VIX_CHANGE_5D_PCT.stress;
    }
    case "termInverted":
      return d.term === null ? null : d.term >= TERM_RATIO.stress;
    case "creditWidening": {
      const earlier = ctx.days[i - CREDIT_CHANGE_DAYS]?.hy;
      return d.hy === null || earlier == null ? null : d.hy - earlier >= SIGNAL_CREDIT_WIDENING_PTS;
    }
    case "spyBelow100":
      return d.spy === null || d.sma100 === null ? null : d.spy < d.sma100;
    case "spyBelow200":
      return d.spy === null || d.sma200 === null ? null : d.spy < d.sma200;
    case "deathCross":
      return d.sma50 === null || d.sma200 === null ? null : d.sma50 < d.sma200;
    case "goldenCross":
      return d.sma50 === null || d.sma200 === null ? null : d.sma50 > d.sma200;
    case "volPctile": {
      const p = ctx.volPctile[i];
      return p == null ? null : p > SIGNAL_VOL_PCTILE;
    }
  }
}

/** Kenar tetiklemeli olay günleri (dizinler). Önceki gün okunamıyorsa tetikleme sayılmaz. */
export function triggerIndexes(key: SignalKey, ctx: SignalContext, cooldown = SIGNAL_COOLDOWN): number[] {
  const out: number[] = [];
  let lastAt = -Infinity;
  for (let i = 1; i < ctx.days.length; i += 1) {
    const now = signalState(key, ctx, i);
    const before = signalState(key, ctx, i - 1);
    if (now !== true || before !== false) continue;
    if (i - lastAt <= cooldown) continue;
    out.push(i);
    lastAt = i;
  }
  return out;
}

export type ForwardSummary = {
  /** Getirisi ölçülebilen olay sayısı. */
  scored: number;
  shortMean: number | null;
  shortMedian: number | null;
  longMean: number | null;
  longMedian: number | null;
  /** Sonraki 20 günde ≥ %5 düşüş görülen olayların payı, yüzde. */
  hitRate: number | null;
};

function summarize(indexes: readonly number[], closes: readonly (number | null)[]): ForwardSummary {
  const short: number[] = [];
  const long: number[] = [];
  let hits = 0;
  let scored = 0;
  for (const i of indexes) {
    const rLong = forwardReturn(closes, i, FORWARD_LONG);
    const hit = drawdownWithin(closes, i, FORWARD_LONG, HIT_DRAWDOWN_PCT);
    const rShort = forwardReturn(closes, i, FORWARD_SHORT);
    if (rShort !== null) short.push(rShort);
    if (rLong === null || hit === null) continue;
    scored += 1;
    long.push(rLong);
    if (hit) hits += 1;
  }
  const mean = (v: number[]) => (v.length ? v.reduce((s, x) => s + x, 0) / v.length : null);
  const median = (v: number[]) => (v.length ? quantile([...v].sort((a, b) => a - b), 0.5) : null);
  return {
    scored,
    shortMean: mean(short),
    shortMedian: median(short),
    longMean: mean(long),
    longMedian: median(long),
    hitRate: scored > 0 ? (hits / scored) * PERCENT : null,
  };
}

export type SignalResult = ForwardSummary & {
  key: SignalKey;
  triggers: number;
  /** Ufku dolmamış (sonucu beklenen) tetikleme sayısı. */
  pending: number;
  lastTrigger: string | null;
  /** Koşul bugün doğru mu. */
  activeNow: boolean;
};

export type BacktestResult = {
  from: string;
  to: string;
  signals: SignalResult[];
  /** Aynı dönemde bütün günler — karşılaştırma tabanı. */
  base: ForwardSummary;
};

export function runBacktest(ctx: SignalContext): BacktestResult | null {
  const closes = ctx.days.map((d) => d.spy);
  const firstSpy = ctx.days.findIndex((d) => d.spy !== null);
  if (firstSpy < 0) return null;
  const signals = SIGNAL_KEYS.map((key): SignalResult => {
    const indexes = triggerIndexes(key, ctx);
    const summary = summarize(indexes, closes);
    const last = indexes[indexes.length - 1];
    return {
      key,
      ...summary,
      triggers: indexes.length,
      pending: indexes.length - summary.scored,
      lastTrigger: last !== undefined ? ctx.days[last]!.date : null,
      activeNow: signalState(key, ctx, ctx.days.length - 1) === true,
    };
  });
  const all = ctx.days.map((_, i) => i).filter((i) => i >= firstSpy);
  return {
    from: ctx.days[firstSpy]!.date,
    to: ctx.days[ctx.days.length - 1]!.date,
    signals,
    base: summarize(all, closes),
  };
}
