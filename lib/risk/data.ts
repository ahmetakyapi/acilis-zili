import "server-only";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { SPX_MEMBERS, primaryOnly } from "@/db/seed/indices";
import { addEtDays, etDateTimeToUtc } from "@/lib/market-hours";
import { barDate } from "@/lib/period-returns";
import { getDailyBarsBetween } from "@/lib/providers/alpaca";
import { getDailyMarketSeries } from "@/lib/providers/daily-markets";
import { getSeries, type SeriesRequest } from "@/lib/providers/fred";
import type { Bar, MacroObservation } from "@/lib/providers/types";
import { expectedLastSession } from "@/lib/stock-insights";
import { VIX_SERIES } from "@/lib/vix";
import { runBacktest, type BacktestResult } from "./backtest";
import { ewmaForecast, percentileRank, rollingVol, sma, type DailyBar, type VolForecast } from "./math";
import { measureSymbol, type SymbolMeasures } from "./measures";
import {
  asOfAlign,
  computeRegimes,
  currentStreak,
  forwardStats,
  type DeskDay,
  type ForwardStats,
  type Regime,
  type RegimeDay,
} from "./regime";
import type { MarketFacts } from "./rules";
import { FORWARD_LONG, MAX_OBSERVATION_LAG_DAYS, PERCENTILE_WINDOW, VOL_LONG } from "./thresholds";

/**
 * RİSK MASASI — PİYASA TARAFININ VERİSİ (25 Ekim). Hesaplar saf
 * modüllerde (math, measures, regime, backtest); burada yalnız toplama.
 *
 * KAYNAKLAR
 *  - VIX: Cboe'nin günlük dosyası, FRED VIXCLS yedek — ana sayfa ve
 *    piyasalarla AYNI çağrı (`getDailyMarketSeries`), aynı sayı iki
 *    ekranda iki kaynaktan gelmesin (veri dürüstlüğü 3).
 *  - VXN (VXNCLS), VIX3M (VXVCLS), yüksek getirili kredi farkı
 *    (BAMLH0A0HYM2): FRED, günlük kapanış. FRED bir iş günü gecikebilir;
 *    her gösterge kendi gözlem tarihini taşır.
 *  - Endeks fonları (SPY, QQQ, IWM, DIA): Alpaca gün barları, bölünmeye
 *    göre düzeltilmiş, asıl seans kapanışı (lib/providers/alpaca.ts →
 *    `getDailyBarsBetween`). Pencere altı yıl: beş yıllık rejim geçmişi +
 *    200 günlük ortalamanın ısınması.
 *  - Genişlik: S&P 500 üyelerinin gün barları (tohum listesi,
 *    db/seed/indices.ts), ~400 takvim günü.
 *
 * TAMAMLANMIŞ SEANS. Masa `expectedLastSession()`ı (seans sürerken dün)
 * anlatır; barlar o günün kapanışına kadar istenir. Son bar o güne ait
 * değilse bar ölçüleri BAYAT sayılır ve ekran onları büyük puntoyla basmaz.
 *
 * ÖNBELLEK. Hepsi `unstable_cache`, anahtar seans günü + sürüm; HATA
 * DIŞARIDA: içerideki fonksiyon bir kaynak düşünce fırlatır, dışarıdaki
 * `try` aynı hesabı önbelleksiz (eksik kaynakla) yapar — düşen FRED'in
 * yarım masası altı saat önbellekte kalmasın.
 */

export const INDEX_SYMBOLS = ["SPY", "QQQ", "IWM", "DIA"] as const;
export const BENCHMARK = "SPY";
const SIX_YEARS_DAYS = 6 * 365 + 40;
const BREADTH_LOOKBACK_DAYS = 400;
/** FRED gözlem sayısı — altı yılı kapsar (yılda ~252 gözlem). */
const FRED_LIMIT = 1600;
const REVALIDATE = 6 * 3600;
/** Gösterge şeridinin kıvılcımı: son bu kadar gözlem. */
const SPARK_POINTS = 60;
/** Genişlik: üyelerin en az bu payı ölçülmeli. */
const MIN_BREADTH_COVERAGE = 0.9;
const PERCENT = 100;

const VXN: SeriesRequest = { seriesId: "VXNCLS", slug: "vxn", units: "lin" };
const VIX3M: SeriesRequest = { seriesId: "VXVCLS", slug: "vix3m", units: "lin" };
const HY: SeriesRequest = { seriesId: "BAMLH0A0HYM2", slug: "hy-spread", units: "lin" };

export function toDaily(bars: readonly Bar[] | undefined, session: string): DailyBar[] {
  return (bars ?? [])
    .map((b) => ({ date: barDate(b), open: b.open, high: b.high, low: b.low, close: b.close }))
    .filter((b) => b.date <= session && b.close > 0);
}

/** Barların istendiği son an: seans gününün akşamı (sağlayıcı kendi gecikmesiyle kırpar). */
const sessionEnd = (session: string) => etDateTimeToUtc(session, "20:00");

/* --------------------------------------------------------------------------
   Genişlik
   -------------------------------------------------------------------------- */

export type Breadth = {
  date: string;
  /** 200 GO üstündeki üyelerin payı, yüzde. */
  above200: number;
  advancing: number;
  declining: number;
  unchanged: number;
  counted: number;
  total: number;
  /** Son seansların genişliği (rejim geçmişine girer). */
  history: { date: string; value: number }[];
};

export function breadthFrom(barsBySymbol: Record<string, DailyBar[]>, symbols: readonly string[], session: string): Breadth | null {
  const total = symbols.length;
  const aboveByDate = new Map<string, { above: number; n: number }>();
  let advancing = 0;
  let declining = 0;
  let unchanged = 0;
  let counted = 0;
  for (const symbol of symbols) {
    const bars = barsBySymbol[symbol];
    if (!bars || bars.length < 201 || bars[bars.length - 1]!.date !== session) continue;
    counted += 1;
    const closes = bars.map((b) => b.close);
    const avg = sma(closes, 200);
    for (let i = 0; i < bars.length; i += 1) {
      const a = avg[i];
      if (a == null) continue;
      const slot = aboveByDate.get(bars[i]!.date) ?? { above: 0, n: 0 };
      slot.n += 1;
      if (closes[i]! > a) slot.above += 1;
      aboveByDate.set(bars[i]!.date, slot);
    }
    const prev = closes[closes.length - 2]!;
    const now = closes[closes.length - 1]!;
    if (now > prev) advancing += 1;
    else if (now < prev) declining += 1;
    else unchanged += 1;
  }
  if (total === 0 || counted / total < MIN_BREADTH_COVERAGE) return null;
  const history = [...aboveByDate]
    .filter(([, slot]) => slot.n / total >= MIN_BREADTH_COVERAGE)
    .map(([date, slot]) => ({ date, value: (slot.above / slot.n) * PERCENT }))
    .sort((a, b) => a.date.localeCompare(b.date));
  const today = history[history.length - 1];
  if (!today || today.date !== session) return null;
  return { date: session, above200: today.value, advancing, declining, unchanged, counted, total, history };
}

const BREADTH_SYMBOLS = primaryOnly(SPX_MEMBERS).map((m) => m.symbol);

const loadBreadth = unstable_cache(
  async function loadBreadth(session: string): Promise<Breadth | null> {
    const result = await getDailyBarsBetween(BREADTH_SYMBOLS, addEtDays(session, -BREADTH_LOOKBACK_DAYS), sessionEnd(session), REVALIDATE);
    if (!result.ok) throw new Error(`genişlik: ${result.message}`);
    const bars: Record<string, DailyBar[]> = {};
    for (const symbol of BREADTH_SYMBOLS) bars[symbol] = toDaily(result.data[symbol], session);
    const breadth = breadthFrom(bars, BREADTH_SYMBOLS, session);
    /* Kapsam düşükse (bar paketi yarım geldiyse) önbelleğe girmesin. */
    if (!breadth) throw new Error("genişlik: kapsam yetersiz");
    return breadth;
  },
  ["risk-breadth-v1"],
  { revalidate: REVALIDATE, tags: ["risk-desk"] },
);

async function breadthFor(session: string): Promise<Breadth | null> {
  try {
    return await loadBreadth(session);
  } catch (error) {
    console.error(`[risk masası] ${error instanceof Error ? error.message : "genişlik okunamadı"}`);
    return null;
  }
}

/* --------------------------------------------------------------------------
   Masa
   -------------------------------------------------------------------------- */

export type GaugeKey = "vix" | "vxn" | "term" | "credit" | "breadth" | "spy200";

export type Gauge = {
  key: GaugeKey;
  /** Güncel değer; gözlem bayatsa null (büyük puntoyla eski veri yok). */
  value: number | null;
  /** Önceki gözleme göre değişim; kredide rejimin 20 işlem günlük değişimi. */
  change: number | null;
  date: string | null;
  stale: boolean;
  spark: number[];
};

export type IndexRow = SymbolMeasures & { forecast: VolForecast | null };

export type HistoryPoint = { date: string; regime: Regime | null; share: number };

export type MarketDesk = {
  session: string;
  /** Endeks barlarının son günü seans günü değilse true — bar ölçüleri basılmaz. */
  barsStale: boolean;
  gauges: Gauge[];
  indices: IndexRow[];
  breadth: Breadth | null;
  today: RegimeDay | null;
  streak: { regime: Regime; since: string; sessions: number } | null;
  history: HistoryPoint[];
  /** Genişliğin geçmiş şeride girdiği ilk gün. */
  breadthSince: string | null;
  forward: ForwardStats[];
  backtest: BacktestResult | null;
  market: MarketFacts;
  /** SPY'ın son bir yılı — beta ve pozisyon ölçülerinin göstergesi. */
  spyBars: DailyBar[];
  sources: { vix: string | null; fredAt: string | null; barsAt: string | null };
};

type Obs = { date: string; value: number }[];

function obsOf(result: { ok: true; data: { observations: MacroObservation[] } } | { ok: false }): Obs {
  return result.ok ? result.data.observations.map((o) => ({ date: o.date, value: o.value })) : [];
}

function daysApart(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

function gaugeFrom(key: GaugeKey, obs: Obs, session: string): Gauge {
  const last = obs[obs.length - 1];
  if (!last) return { key, value: null, change: null, date: null, stale: true, spark: [] };
  const stale = daysApart(last.date, session) > MAX_OBSERVATION_LAG_DAYS;
  const before = obs[obs.length - 2];
  return {
    key,
    value: stale ? null : last.value,
    change: stale || !before ? null : last.value - before.value,
    date: last.date,
    stale,
    spark: obs.slice(-SPARK_POINTS).map((o) => o.value),
  };
}

/** İki serinin ortak günlerindeki oranı (VIX / VIX3M). */
function ratioSeries(a: Obs, b: Obs): Obs {
  const of = new Map(b.map((o) => [o.date, o.value]));
  return a.flatMap((o) => {
    const d = of.get(o.date);
    return d && d > 0 ? [{ date: o.date, value: o.value / d }] : [];
  });
}

type Sources = {
  vix: Obs;
  vixSource: string | null;
  vxn: Obs;
  vix3m: Obs;
  hy: Obs;
  bars: Record<string, DailyBar[]>;
  fredAt: string | null;
  barsAt: string | null;
  breadth: Breadth | null;
  complete: boolean;
};

async function loadSources(session: string): Promise<Sources> {
  const [vix, vxn, vix3m, hy, bars, breadth] = await Promise.all([
    getDailyMarketSeries(VIX_SERIES, FRED_LIMIT),
    getSeries(VXN, FRED_LIMIT),
    getSeries(VIX3M, FRED_LIMIT),
    getSeries(HY, FRED_LIMIT),
    getDailyBarsBetween([...INDEX_SYMBOLS], addEtDays(session, -SIX_YEARS_DAYS), sessionEnd(session), REVALIDATE),
    breadthFor(session),
  ]);
  const daily: Record<string, DailyBar[]> = {};
  if (bars.ok) for (const symbol of INDEX_SYMBOLS) daily[symbol] = toDaily(bars.data[symbol], session);
  const fred = [vxn, vix3m, hy].find((r) => r.ok);
  return {
    vix: obsOf(vix),
    vixSource: vix.ok ? vix.source : null,
    vxn: obsOf(vxn),
    vix3m: obsOf(vix3m),
    hy: obsOf(hy),
    bars: daily,
    fredAt: fred?.ok && fred.fetchedAt ? new Date(fred.fetchedAt).toISOString() : null,
    barsAt: bars.ok && bars.fetchedAt ? new Date(bars.fetchedAt).toISOString() : null,
    breadth,
    complete: vix.ok && vxn.ok && vix3m.ok && hy.ok && bars.ok && breadth !== null,
  };
}

/** Saf birleştirme: kaynaklardan masa. Sınanabilir olsun diye ayrı. */
export function assembleDesk(session: string, src: Omit<Sources, "complete">): MarketDesk {
  const spy = src.bars[BENCHMARK] ?? [];
  const barsStale = spy.length === 0 || spy[spy.length - 1]!.date !== session;
  const dates = spy.map((b) => b.date);
  const closes = spy.map((b) => b.close);
  const [s50, s100, s200] = [sma(closes, 50), sma(closes, 100), sma(closes, 200)];
  const lag = MAX_OBSERVATION_LAG_DAYS;
  const vix = asOfAlign(dates, src.vix, lag);
  const vxn = asOfAlign(dates, src.vxn, lag);
  const hy = asOfAlign(dates, src.hy, lag);
  const term = ratioSeries(src.vix, src.vix3m);
  const termAligned = asOfAlign(dates, term, lag);
  const vxnVix = asOfAlign(dates, ratioSeries(src.vxn, src.vix), lag);
  const breadthOf = new Map((src.breadth?.history ?? []).map((p) => [p.date, p.value]));
  const days: DeskDay[] = dates.map((date, i) => ({
    date,
    spy: closes[i]!,
    sma50: s50[i] ?? null,
    sma100: s100[i] ?? null,
    sma200: s200[i] ?? null,
    vix: vix[i] ?? null,
    vxn: vxn[i] ?? null,
    term: termAligned[i] ?? null,
    vxnVix: vxnVix[i] ?? null,
    hy: hy[i] ?? null,
    breadth: breadthOf.get(date) ?? null,
  }));
  const regimes = computeRegimes(days);
  const vol = rollingVol(closes, VOL_LONG);
  const volPctile = vol.map((v, i) => {
    if (v === null) return null;
    const window = vol.slice(Math.max(0, i + 1 - PERCENTILE_WINDOW), i + 1).filter((x): x is number => x !== null);
    return window.length >= PERCENTILE_WINDOW / 2 ? percentileRank(window, v) : null;
  });
  /* Rejim ilk basıldığı günden itibaren: ısınma dönemi şeride girmez. */
  const firstRegime = regimes.findIndex((r) => r.regime !== null);
  const history = firstRegime < 0 ? [] : regimes.slice(firstRegime).map((r) => ({ date: r.date, regime: r.regime, share: r.share }));
  const scoredDays = firstRegime < 0 ? [] : days.slice(firstRegime);
  const scoredRegimes = firstRegime < 0 ? [] : regimes.slice(firstRegime);
  const backtest = scoredDays.length > FORWARD_LONG
    ? runBacktest({ days: scoredDays, regimes: scoredRegimes, volPctile: volPctile.slice(firstRegime) })
    : null;

  const today = barsStale ? null : (regimes[regimes.length - 1] ?? null);
  const indices: IndexRow[] = barsStale
    ? []
    : INDEX_SYMBOLS.flatMap((symbol) => {
        const bars = src.bars[symbol] ?? [];
        if (bars[bars.length - 1]?.date !== session) return [];
        const m = measureSymbol(symbol, bars, symbol === BENCHMARK ? null : spy);
        return m ? [{ ...m, beta: symbol === BENCHMARK ? 1 : m.beta, forecast: ewmaForecast(bars.map((b) => b.close)) }] : [];
      });
  const spyRow = indices.find((row) => row.symbol === BENCHMARK) ?? null;

  const creditToday = barsStale ? null : (regimes[regimes.length - 1]?.components.find((c) => c.key === "credit")?.value ?? null);
  const gauges: Gauge[] = [
    gaugeFrom("vix", src.vix, session),
    gaugeFrom("vxn", src.vxn, session),
    gaugeFrom("term", term, session),
    /* Değişim REJİMDEKİ değişimin kendisi (aynı sayı iki yerde aynı
       kaynaktan): FRED gözlem sırasında 20 adım geri gitmek ile işlem
       günü ızgarasında 20 gün geri gitmek tatillerde ayrı düşüyordu
       (ölçüldü: gösterge +0,60, rejim +0,47). */
    { ...gaugeFrom("credit", src.hy, session), change: creditToday },
    src.breadth
      ? {
          key: "breadth",
          value: src.breadth.above200,
          change: null,
          date: src.breadth.date,
          stale: false,
          spark: src.breadth.history.slice(-SPARK_POINTS).map((p) => p.value),
        }
      : { key: "breadth", value: null, change: null, date: null, stale: true, spark: [] },
    {
      key: "spy200",
      value: spyRow?.ma[200].distance ?? null,
      change: null,
      date: spyRow?.date ?? null,
      stale: !spyRow,
      spark: days
        .slice(-SPARK_POINTS)
        .flatMap((d) => (d.spy !== null && d.sma200 !== null ? [(d.spy / d.sma200 - 1) * PERCENT] : [])),
    },
  ];
  const g = (key: GaugeKey) => gauges.find((x) => x.key === key)!;
  const creditGauge = g("credit");

  return {
    session,
    barsStale,
    gauges,
    indices,
    breadth: src.breadth,
    today,
    streak: barsStale ? null : currentStreak(regimes),
    history,
    breadthSince: src.breadth?.history[0]?.date ?? null,
    forward: forwardStats(scoredDays, scoredRegimes, FORWARD_LONG),
    backtest,
    market: {
      regime: today?.regime ?? null,
      vix: g("vix").value,
      vxn: g("vxn").value,
      termRatio: g("term").value,
      breadth: g("breadth").value,
      creditChange: creditGauge.value === null ? null : creditGauge.change,
      spyBelow: spyRow ? spyRow.below : { 50: null, 100: null, 200: null },
      spyCrossedBelow: spyRow ? spyRow.crossedBelow : { 100: false, 200: false },
      spyCross: spyRow?.cross ?? null,
    },
    spyBars: spy.slice(-(PERCENTILE_WINDOW + 30)),
    sources: { vix: src.vixSource, fredAt: src.fredAt, barsAt: src.barsAt },
  };
}

/** Eksik kaynakla kurulan masa: önbelleğe girmesin diye fırlatılır, dışarıda yakalanıp kullanılır. */
class IncompleteDesk extends Error {
  constructor(readonly desk: MarketDesk) {
    super("kaynaklardan biri okunamadı");
  }
}

const loadDesk = unstable_cache(
  async function loadDesk(session: string): Promise<MarketDesk> {
    const src = await loadSources(session);
    const desk = assembleDesk(session, src);
    if (!src.complete) throw new IncompleteDesk(desk);
    return desk;
  },
  ["risk-desk-v3"],
  { revalidate: REVALIDATE, tags: ["risk-desk"] },
);

/** İstek içinde bir kez; önbellek düşerse eksik kaynakla önbelleksiz kurulur. */
export const getMarketDesk = cache(async function getMarketDesk(): Promise<MarketDesk> {
  const session = await expectedLastSession();
  try {
    return await loadDesk(session);
  } catch (error) {
    console.error(`[risk masası] ${error instanceof Error ? error.message : "masa"}; önbelleksiz`);
    return error instanceof IncompleteDesk ? error.desk : assembleDesk(session, await loadSources(session));
  }
});
