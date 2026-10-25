/**
 * RİSK MASASI — KURAL TABANLI REJİM (25 Ekim; sınama tests/risk-regime.test.ts).
 *
 * ŞEFFAF SKOR. Yedi girdi, her biri 0 (sakin), 1 (gergin) ya da 2 (stres)
 * puan; eşikler ve gerekçeleri lib/risk/thresholds.ts'te. Rejim, toplanan
 * puanın OKUNABİLEN girdilerin en yüksek puanına oranından gelir. Ekran her
 * girdinin değerini, eşiğini ve katkısını ayrı ayrı yazar; skorun nereden
 * geldiği gizli bir model değil, okunabilen bir toplama.
 *
 * EKSİK GİRDİ PUAN DEĞİL. Okunamayan girdi sıfır puan sayılmaz (sakin
 * sayılırdı); paydan da paydadan da çıkar. `MIN_COMPONENTS`ten azı
 * okunuyorsa rejim hiç basılmaz. Geçmiş şeritte genişlik yalnız son
 * seanslarda var (üye barlarının penceresi kadar); öncesinde skor altı
 * girdiyle kurulur ve ekran bunu künyede söyler.
 *
 * TAHMİN DEĞİL, DURUM. Rejim bugünün ölçülerinin bir özetidir; ileriye dair
 * söylediği tek şey, geçmişte aynı rejimde SPY'ın sonraki 20 gününün nasıl
 * dağıldığıdır (`forwardStats`, gerçek veri, tarihsel istatistik).
 */

import {
  BREADTH_ABOVE_200,
  CREDIT_CHANGE_DAYS,
  CREDIT_CHANGE_PTS,
  HIT_DRAWDOWN_PCT,
  MAX_POINTS,
  MIN_COMPONENTS,
  REGIME_SHARE,
  TERM_RATIO,
  VIX_CHANGE_5D_PCT,
  VIX_CHANGE_DAYS,
  VIX_LEVEL,
  VXN_RATIO_MIN_HISTORY,
  VXN_RATIO_PCTILE,
  VXN_RATIO_WINDOW,
} from "./thresholds";
import { percentileRank } from "./math";

const PERCENT = 100;

/** Bir işlem günü — FRED/Cboe değerleri o güne "en çok N gün eski" kuralıyla oturtulmuş. */
export type DeskDay = {
  date: string;
  spy: number | null;
  sma50: number | null;
  sma100: number | null;
  sma200: number | null;
  vix: number | null;
  vxn: number | null;
  /**
   * VIX / VIX3M ve VXN / VIX — AYNI GÜNÜN iki gözleminden (ortak tarih),
   * sonra işlem gününe oturtulmuş. Ayrı ayrı oturtulan iki seriden oran
   * kurmak, FRED bir gün geride kaldığında bugünün VIX'ini dünün VIX3M'ine
   * bölüyordu; göstergedeki oranla rejimdeki oran ayrı düşüyordu.
   */
  term: number | null;
  vxnVix: number | null;
  /** Yüksek getirili kredi farkı, yüzde puanı. */
  hy: number | null;
  /** S&P 500 üyelerinin 200 GO üstündeki payı, yüzde. */
  breadth: number | null;
};

export const COMPONENT_KEYS = ["vixLevel", "vixChange", "term", "vxnRatio", "trend", "breadth", "credit"] as const;
export type ComponentKey = (typeof COMPONENT_KEYS)[number];
export type Points = 0 | 1 | 2;

export type Component = {
  key: ComponentKey;
  /** Girdinin kendi birimiyle değeri (VIX düzeyi, yüzde değişim, oran, dilim, puan farkı…). */
  value: number;
  points: Points;
};

export const REGIMES = ["riskOn", "cautious", "riskOff"] as const;
export type Regime = (typeof REGIMES)[number];

export type RegimeDay = {
  date: string;
  components: Component[];
  points: number;
  max: number;
  share: number;
  regime: Regime | null;
};

/** Yükselen eşik: değer `tense`e ulaştıysa 1, `stress`e ulaştıysa 2. */
function rising(value: number, band: { tense: number; stress: number }): Points {
  return value >= band.stress ? 2 : value >= band.tense ? 1 : 0;
}

/** Düşen eşik (genişlik): değer `tense`in altındaysa 1, `stress`in altındaysa 2. */
function falling(value: number, band: { tense: number; stress: number }): Points {
  return value < band.stress ? 2 : value < band.tense ? 1 : 0;
}

/** Trend girdisinin değeri: SPY'ın 200 GO'ya uzaklığı (yüzde); puan 100 ve 200 GO'dan. */
function trendComponent(day: DeskDay): Component | null {
  if (day.spy === null || day.sma200 === null) return null;
  const below200 = day.spy < day.sma200;
  const below100 = day.sma100 !== null && day.spy < day.sma100;
  return {
    key: "trend",
    value: (day.spy / day.sma200 - 1) * PERCENT,
    points: below200 ? 2 : below100 ? 1 : 0,
  };
}

export function regimeOf(share: number): Regime {
  return share >= REGIME_SHARE.riskOff ? "riskOff" : share >= REGIME_SHARE.cautious ? "cautious" : "riskOn";
}

/** Bütün günlerin rejimi — `days` tarih sırasıyla, işlem günleri. */
export function computeRegimes(days: readonly DeskDay[]): RegimeDay[] {
  const ratios: (number | null)[] = days.map((d) => d.vxnVix);
  return days.map((day, i) => {
    const components: Component[] = [];
    if (day.vix !== null) components.push({ key: "vixLevel", value: day.vix, points: rising(day.vix, VIX_LEVEL) });
    const before = days[i - VIX_CHANGE_DAYS];
    if (day.vix !== null && before?.vix) {
      const change = (day.vix / before.vix - 1) * PERCENT;
      components.push({ key: "vixChange", value: change, points: rising(change, VIX_CHANGE_5D_PCT) });
    }
    if (day.term !== null) components.push({ key: "term", value: day.term, points: rising(day.term, TERM_RATIO) });
    const ratio = ratios[i];
    if (ratio !== null && ratio !== undefined) {
      const history = ratios.slice(Math.max(0, i + 1 - VXN_RATIO_WINDOW), i + 1).filter((r): r is number => r !== null);
      if (history.length >= VXN_RATIO_MIN_HISTORY) {
        const pctile = percentileRank(history, ratio);
        components.push({ key: "vxnRatio", value: pctile, points: rising(pctile, VXN_RATIO_PCTILE) });
      }
    }
    const trend = trendComponent(day);
    if (trend) components.push(trend);
    if (day.breadth !== null) components.push({ key: "breadth", value: day.breadth, points: falling(day.breadth, BREADTH_ABOVE_200) });
    const earlier = days[i - CREDIT_CHANGE_DAYS];
    if (day.hy !== null && earlier?.hy != null) {
      const change = day.hy - earlier.hy;
      components.push({ key: "credit", value: change, points: rising(change, CREDIT_CHANGE_PTS) });
    }
    const points = components.reduce((sum, c) => sum + c.points, 0);
    const max = components.length * MAX_POINTS;
    const share = max > 0 ? points / max : 0;
    return {
      date: day.date,
      components,
      points,
      max,
      share,
      regime: components.length >= MIN_COMPONENTS ? regimeOf(share) : null,
    };
  });
}

/* --------------------------------------------------------------------------
   Rejimlere göre SPY'ın sonraki getirisi
   -------------------------------------------------------------------------- */

export type ForwardStats = {
  regime: Regime;
  /** Rejimin geçtiği ve ufku tamamlanmış gün sayısı. */
  days: number;
  mean: number;
  median: number;
  p10: number;
  p90: number;
  /** Getirinin eksi kaldığı günlerin payı, yüzde. */
  negativeShare: number;
  /** Ufuk içinde kapanışlardan birinin ≥ HIT_DRAWDOWN_PCT aşağıda olduğu günlerin payı, yüzde. */
  drawdownShare: number;
};

export function quantile(sorted: readonly number[], q: number): number {
  if (sorted.length === 0) return 0;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (pos - lo);
}

/** Ufuk içinde kapanışlardan biri başlangıcın ≥ `pct` altına indi mi. */
export function drawdownWithin(closes: readonly (number | null)[], i: number, horizon: number, pct: number): boolean | null {
  const start = closes[i];
  if (start == null || i + horizon >= closes.length) return null;
  for (let k = 1; k <= horizon; k += 1) {
    const c = closes[i + k];
    if (c != null && c <= start * (1 - pct / PERCENT)) return true;
  }
  return false;
}

export function forwardReturn(closes: readonly (number | null)[], i: number, horizon: number): number | null {
  const a = closes[i];
  const b = closes[i + horizon];
  return a != null && b != null && a > 0 ? (b / a - 1) * PERCENT : null;
}

/**
 * Her rejim için SPY'ın sonraki `horizon` işlem günündeki getirisi.
 * ÖRTÜŞEN PENCERELER: ardışık günlerin 20 günlük pencereleri büyük ölçüde
 * aynı; gün sayısı bağımsız gözlem sayısı değil. Ekran bunu künyede yazar.
 */
export function forwardStats(days: readonly DeskDay[], regimes: readonly RegimeDay[], horizon: number): ForwardStats[] {
  const closes = days.map((d) => d.spy);
  const buckets = new Map<Regime, { returns: number[]; hits: number }>();
  for (let i = 0; i < days.length; i += 1) {
    const regime = regimes[i]?.regime;
    if (!regime) continue;
    const r = forwardReturn(closes, i, horizon);
    const hit = drawdownWithin(closes, i, horizon, HIT_DRAWDOWN_PCT);
    if (r === null || hit === null) continue;
    const bucket = buckets.get(regime) ?? { returns: [], hits: 0 };
    bucket.returns.push(r);
    if (hit) bucket.hits += 1;
    buckets.set(regime, bucket);
  }
  return REGIMES.flatMap((regime) => {
    const bucket = buckets.get(regime);
    if (!bucket || bucket.returns.length === 0) return [];
    const sorted = [...bucket.returns].sort((a, b) => a - b);
    const n = sorted.length;
    return [{
      regime,
      days: n,
      mean: sorted.reduce((s, v) => s + v, 0) / n,
      median: quantile(sorted, 0.5),
      p10: quantile(sorted, 0.1),
      p90: quantile(sorted, 0.9),
      negativeShare: (sorted.filter((v) => v < 0).length / n) * PERCENT,
      drawdownShare: (bucket.hits / n) * PERCENT,
    }];
  });
}

/** Bugünkü rejimin kaç işlem günüdür sürdüğü ve başladığı gün. */
export function currentStreak(regimes: readonly RegimeDay[]): { regime: Regime; since: string; sessions: number } | null {
  const last = regimes[regimes.length - 1];
  if (!last?.regime) return null;
  let i = regimes.length - 1;
  while (i > 0 && regimes[i - 1]!.regime === last.regime) i -= 1;
  return { regime: last.regime, since: regimes[i]!.date, sessions: regimes.length - i };
}

/** Değerleri işlem günlerine oturtur: her gün için `maxLagDays` içindeki en son gözlem. */
export function asOfAlign(
  dates: readonly string[],
  observations: readonly { date: string; value: number }[],
  maxLagDays: number,
): (number | null)[] {
  const sorted = [...observations].sort((a, b) => a.date.localeCompare(b.date));
  const out: (number | null)[] = [];
  let j = -1;
  for (const date of dates) {
    while (j + 1 < sorted.length && sorted[j + 1]!.date <= date) j += 1;
    const obs = j >= 0 ? sorted[j]! : null;
    out.push(obs && daysBetween(obs.date, date) <= maxLagDays ? obs.value : null);
  }
  return out;
}

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}
