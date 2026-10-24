/**
 * PORTFÖY ANALİZİ — SAF HESAP (24 Ekim; sınama tests/portfolio-risk.test.ts).
 *
 * /portfoy/analiz'in bütün ölçüleri burada, Claude'suz ve deterministik:
 * sektör dağılımı ile S&P 500 farkı, yoğunlaşma (HHI ve etkin pozisyon
 * sayısı), son bir yılın günlük getirilerinden oynaklık, beta, korelasyon ve
 * en büyük düşüş, kur etkisi, bilanço yoğunlaşması, temettü tahmini ve
 * "şu sektör fonunu eklersem" senaryosu. Veri toplama
 * `lib/portfolio-analysis.ts`te (sunucu), metin `lib/portfolio-analysis-note.ts`te.
 *
 * HUKUKİ ÇİZGİ: bu modül ÖLÇER ve KARŞILAŞTIRIR; hiçbir çıktısı bir hisseyi
 * öne çıkarmaz. Eksik sektörün "inceleyebileceğin örnekleri" sıralanmadan
 * (sembolün alfabe sırasıyla) döner, puan taşımaz (`sectorGaps`). Kişiye özel al/sat
 * önerisi SPK lisanslı yatırım danışmanlığıdır; ürün bunu yapmaz.
 *
 * BUGÜNKÜ AĞIRLIKLARLA GEÇEN YIL. Oynaklık, beta, düşüş ve kur etkisi
 * okurun BUGÜNKÜ ağırlıklarını sabit tutup son bir yılın günlük getirilerine
 * uygular (her gün aynı ağırlığa dönen sepet). Okurun gerçek geçmişi bu
 * değil — pozisyonları yıl içinde almış olabilir — ve ekran bunu künyede
 * açıkça yazar. Amaç portföyün BUGÜNKÜ biçiminin risk karakterini ölçmek.
 *
 * VERİ DÜRÜSTLÜĞÜ: son tamamlanmış seansta kapanışı olmayan pozisyon
 * ölçülerin dışında kalır; risk ölçüleri ayrıca yılın en az
 * `MIN_HISTORY_SHARE`ini kapsayan seri ister (yeni halka arz edilmiş hisse
 * dışarıda). Kapsanan pozisyon sayısı her ölçüyle birlikte döner; yarıdan
 * azı okunuyorsa ölçü HİÇ dönmez (null) — eksik portföyün "oynaklığı"
 * yanlış olurdu.
 */

import { formatPrice } from "@/lib/utils";

/** Yıllıklaştırma: ABD borsasında yılda yaklaşık işlem günü. */
export const TRADING_DAYS = 252;
/** Pencere: son bir yılın günlük getirileri. */
export const WINDOW_RETURNS = TRADING_DAYS;
/** Risk ölçüsüne giren serinin, gösterge seanslarının en az bu payında kapanışı olmalı. */
export const MIN_HISTORY_SHARE = 0.9;
/** Ölçünün basılması için kapsanan pozisyonların en az payı ("yarıdan azı okunuyorsa basılmaz"). */
export const MIN_COVERAGE_SHARE = 0.5;
/** Eksik sektör: S&P 500 ağırlığının en az bu kadar puan altında. */
export const UNDERWEIGHT_GAP_PTS = 5;
/** Eksik sektörde gösterilen en çok satır. */
export const MAX_GAPS = 4;
/** Eksik sektör başına "inceleyebileceğin örnek" sayısı. */
export const EXAMPLES_PER_SECTOR = 4;
/** Senaryoda seçilebilen ek ağırlıklar (yüzde). */
export const SCENARIO_WEIGHTS = [5, 10, 15, 20] as const;
export const DEFAULT_SCENARIO_WEIGHT = 10;
/** Bilanço yoğunlaşmasının penceresi (gün). */
export const EARNINGS_WINDOW_DAYS = 30;
/** Korelasyon listesinde en çok birlikte hareket eden çift sayısı. */
export const TOP_PAIRS = 5;
/** En az birlikte hareket eden çift sayısı. */
export const LOW_PAIRS = 2;
/** Temettü: son 12 ay. */
export const DIVIDEND_LOOKBACK_DAYS = 365;

const PERCENT = 100;
const DAY_MS = 86_400_000;
/** ISO haftası pazartesi başlar; `getUTCDay` pazara 0 der. */
const MONDAY_OFFSET = 6;
const DAYS_IN_WEEK = 7;

/**
 * S&P 500'ü izleyen geniş fonlar: sektör dağılımında endeksin ağırlıklarıyla
 * dağıtılır (fonun içi endeksin kendisi). Diğer fonlar ve endeks dışı
 * şirketler "sınıflanamayan" kovasına düşer; tahmin yok.
 */
export const SP500_TRACKERS = new Set(["SPY", "VOO", "IVV", "SPLG"]);

export type DailyClose = { date: string; close: number };

export type Holding = {
  symbol: string;
  quantity: number;
  /** GICS ana sektörü (İngilizce ad, ör. "Health Care"); bilinmiyorsa null. */
  sector: string | null;
};

export type SectorFund = { symbol: string; sector: string };

export type BenchmarkSectors = {
  asOf: string;
  /** GICS sektörü → S&P 500 içindeki ağırlık, yüzde (toplam ~100). */
  weights: Record<string, number>;
  /** Sektör → sektörün endeksteki en büyük şirketleri (ağırlık sırasıyla gelir, ağırlığı taşımaz; ekrana `sectorGaps` alfabe sırasıyla verir). */
  leaders: Record<string, { symbol: string; name: string }[]>;
};

export type AnalysisInput = {
  /** Son tamamlanmış seans, ET "YYYY-MM-DD". */
  session: string;
  holdings: Holding[];
  closes: Record<string, DailyClose[]>;
  benchmark: string;
  benchmarkSectors: BenchmarkSectors | null;
  /** Önümüzdeki `EARNINGS_WINDOW_DAYS` gündeki açıklanmamış bilançolar. */
  earnings: { symbol: string; date: string }[];
  /** Son 12 ayın olağan nakit temettüleri (hisse başı dolar). */
  dividends: { symbol: string; exDate: string; rate: number }[];
  /** TCMB döviz alış: pencerenin başı ve sonu. */
  fx: { start: number | null; end: number | null };
};

export type WeightRow = { symbol: string; sector: string | null; value: number; weight: number };

export type Concentration = {
  count: number;
  largest: { symbol: string; weight: number };
  top5Share: number;
  hhi: number;
  effectiveCount: number;
};

export type SectorRow = { sector: string; portfolio: number; benchmark: number; diff: number };

export type RiskBlock = {
  covered: number;
  sessions: number;
  start: string;
  end: string;
  volatility: number;
  benchmarkVolatility: number;
  beta: number;
  maxDrawdown: { depth: number; peak: string; trough: string };
  benchmarkMaxDrawdown: number;
  returnUsd: number;
  benchmarkReturn: number;
};

export type CorrelationPair = { a: string; b: string; value: number };

export type PortfolioRisk = {
  session: string;
  total: number;
  covered: number;
  totalValue: number;
  rows: WeightRow[];
  concentration: Concentration;
  sectors: { asOf: string; rows: SectorRow[]; unclassified: number } | null;
  risk: RiskBlock | null;
  correlation: { covered: number; average: number; top: CorrelationPair[]; low: CorrelationPair[] } | null;
  fx: {
    returnUsd: number;
    returnTl: number;
    /** Aynı pencerede S&P 500 (SPY) — kur etkisinin portföye özgü olmadığını gösteren eş. */
    benchmarkUsd: number;
    benchmarkTl: number;
    fxChange: number;
    rateStart: number;
    rateEnd: number;
  } | null;
  earnings: { weeks: { weekStart: string; weight: number; symbols: string[] }[]; totalWeight: number };
  dividends: { annualUsd: number; annualTl: number | null; yieldPct: number; payers: number } | null;
};

/**
 * Birimsiz ölçü (beta, korelasyon, etkin pozisyon sayısı) — eksi işareti
 * sitenin eksisi (U+2212). `formatPrice` birimsizde Intl'in tiresini
 * basıyordu ("-0,32"); ekran ve Claude girdisi aynı biçimi kullanır.
 */
export const formatMeasure = (value: number, locale: string, digits = 2) =>
  value < 0 ? `\u2212${formatPrice(-value, locale, { digits })}` : formatPrice(value, locale, { digits });

/* ---------------------------------------------------------------- yardımcı */

const sum = (values: readonly number[]) => values.reduce((total, value) => total + value, 0);
const mean = (values: readonly number[]) => (values.length ? sum(values) / values.length : 0);

function covariance(a: readonly number[], b: readonly number[]): number {
  const n = Math.min(a.length, b.length);
  if (n < 2) return 0;
  const ma = mean(a.slice(0, n));
  const mb = mean(b.slice(0, n));
  let total = 0;
  for (let i = 0; i < n; i += 1) total += (a[i]! - ma) * (b[i]! - mb);
  return total / (n - 1);
}

export const stdev = (values: readonly number[]) => Math.sqrt(covariance(values, values));

export function correlation(a: readonly number[], b: readonly number[]): number {
  const denominator = stdev(a) * stdev(b);
  return denominator > 0 ? covariance(a, b) / denominator : 0;
}

/** Yıllıklaştırılmış oynaklık, yüzde. */
export const annualVolatility = (returns: readonly number[]) => stdev(returns) * Math.sqrt(TRADING_DAYS) * PERCENT;

export function beta(returns: readonly number[], benchmark: readonly number[]): number {
  const variance = covariance(benchmark, benchmark);
  return variance > 0 ? covariance(returns, benchmark) / variance : 0;
}

/** En büyük düşüş (yüzde, eksi) ve tepe/dip günleri — getiri dizisinden kurulan endeksle. */
export function maxDrawdown(returns: readonly number[], dates: readonly string[]): { depth: number; peak: string; trough: string } {
  let level = 1;
  let peak = 1;
  let peakDate = dates[0] ?? "";
  let worst = { depth: 0, peak: peakDate, trough: peakDate };
  returns.forEach((r, i) => {
    level *= 1 + r;
    const date = dates[i + 1] ?? dates[i] ?? "";
    if (level > peak) {
      peak = level;
      peakDate = date;
    }
    const depth = (level / peak - 1) * PERCENT;
    if (depth < worst.depth) worst = { depth, peak: peakDate, trough: date };
  });
  return worst;
}

/**
 * Bir yılın ödemeleri — fazladan düşen ödeme ayıklanır (25 Ekim düzeltmesi).
 * 365 günlük pencere çeyreklik ödeyen bir şirketin BEŞ ödemesini de
 * yakalayabiliyor: ödeme günü haftanın gününe bağlı kaydığı için aralık
 * 364 gün olabiliyor (ör. 10 Kasım 2025 ve 9 Kasım 2026, ikisi de aynı
 * pencerede); yıllık tahmin o gün %25 şişiyordu. Ödeme sıklığı aralıkların
 * ortancasından çıkar (yılda round(365 / ortanca) ödeme); pencerede bundan
 * fazlası varsa EN YENİLERİ kalır.
 */
export function annualPayments<T extends { exDate: string }>(payments: readonly T[]): T[] {
  const sorted = [...payments].sort((a, b) => a.exDate.localeCompare(b.exDate));
  if (sorted.length < 2) return sorted;
  const gaps = sorted
    .slice(1)
    .map((p, i) => (Date.parse(p.exDate) - Date.parse(sorted[i]!.exDate)) / DAY_MS)
    .sort((a, b) => a - b);
  const median = gaps[Math.floor(gaps.length / 2)]!;
  if (!(median > 0)) return sorted;
  const perYear = Math.max(1, Math.round(DIVIDEND_LOOKBACK_DAYS / median));
  return sorted.length > perYear ? sorted.slice(-perYear) : sorted;
}

/** Dolar getirisinin (yüzde) lira karşılığı: (1 + r) × kur oranı − 1. */
const inLira = (returnUsd: number, rateStart: number, rateEnd: number) => ((1 + returnUsd / PERCENT) * (rateEnd / rateStart) - 1) * PERCENT;

const compound = (returns: readonly number[]) => (returns.reduce((level, r) => level * (1 + r), 1) - 1) * PERCENT;

/** Ağırlıklardan (kesir, toplam 1) yoğunlaşma. */
export function concentrationOf(weights: { symbol: string; weight: number }[]): Concentration {
  const sorted = [...weights].sort((a, b) => b.weight - a.weight);
  const hhi = sum(sorted.map((row) => row.weight * row.weight));
  return {
    count: sorted.length,
    largest: { symbol: sorted[0]?.symbol ?? "", weight: (sorted[0]?.weight ?? 0) * PERCENT },
    top5Share: sum(sorted.slice(0, 5).map((row) => row.weight)) * PERCENT,
    hhi,
    effectiveCount: hhi > 0 ? 1 / hhi : 0,
  };
}

/** ET günü → o haftanın pazartesisi. */
export function weekStartOf(date: string): string {
  const day = new Date(`${date}T12:00:00Z`);
  const back = (day.getUTCDay() + MONDAY_OFFSET) % DAYS_IN_WEEK;
  return new Date(day.getTime() - back * DAY_MS).toISOString().slice(0, 10);
}

const addDays = (date: string, days: number) => new Date(new Date(`${date}T12:00:00Z`).getTime() + days * DAY_MS).toISOString().slice(0, 10);

/* -------------------------------------------------------------- hizalama */

export type Aligned = {
  dates: string[];
  benchmark: number[];
  /** Sembol → göstergenin tarih ızgarasında günlük getiri. */
  returns: Map<string, number[]>;
};

/**
 * Bütün seriler GÖSTERGENİN tarih ızgarasına oturur (son `WINDOW_RETURNS`
 * getiri). Izgara sembol eklenince değişmez — senaryonun "önce"si risk
 * panelindeki sayının AYNISI olsun diye (CLAUDE.md, veri dürüstlüğü 3).
 * Izgarada kapanışı olmayan gün önceki kapanışla doldurulur (o gün getiri
 * 0); ızgaranın `MIN_HISTORY_SHARE`inden azını kapsayan seri hiç girmez.
 */
export function alignReturns(closes: Record<string, DailyClose[]>, benchmark: string, symbols: readonly string[], session: string): Aligned | null {
  const bench = (closes[benchmark] ?? []).filter((bar) => bar.date <= session);
  if (bench.length < 2 || bench[bench.length - 1]!.date !== session) return null;
  const grid = bench.slice(-(WINDOW_RETURNS + 1));
  const dates = grid.map((bar) => bar.date);
  const toReturns = (series: number[]) => series.slice(1).map((close, i) => close / series[i]! - 1);
  const returns = new Map<string, number[]>();
  for (const symbol of symbols) {
    const byDate = new Map((closes[symbol] ?? []).map((bar) => [bar.date, bar.close]));
    const hits = dates.filter((date) => (byDate.get(date) ?? 0) > 0).length;
    if (hits < dates.length * MIN_HISTORY_SHARE || !byDate.has(session)) continue;
    const first = dates.map((date) => byDate.get(date)).find((close) => close !== undefined && close > 0)!;
    let last = first;
    const filled = dates.map((date) => {
      const close = byDate.get(date);
      if (close !== undefined && close > 0) last = close;
      return last;
    });
    returns.set(symbol, toReturns(filled));
  }
  return { dates, benchmark: toReturns(grid.map((bar) => bar.close)), returns };
}

const basket = (weights: Map<string, number>, aligned: Aligned) =>
  aligned.benchmark.map((_, day) => {
    let r = 0;
    for (const [symbol, weight] of weights) r += weight * (aligned.returns.get(symbol)?.[day] ?? 0);
    return r;
  });

/* ------------------------------------------------------------ ana hesap */

const sectorBuckets = (rows: { symbol: string; sector: string | null; weight: number }[], bench: BenchmarkSectors | null) => {
  const buckets = new Map<string, number>();
  let unclassified = 0;
  for (const row of rows) {
    if (SP500_TRACKERS.has(row.symbol) && bench) {
      for (const [sector, share] of Object.entries(bench.weights)) buckets.set(sector, (buckets.get(sector) ?? 0) + (row.weight * share) / PERCENT);
    } else if (row.sector) buckets.set(row.sector, (buckets.get(row.sector) ?? 0) + row.weight);
    else unclassified += row.weight;
  }
  return { buckets, unclassified };
};

function sectorRows(rows: { symbol: string; sector: string | null; weight: number }[], bench: BenchmarkSectors) {
  const { buckets, unclassified } = sectorBuckets(rows, bench);
  const names = new Set([...Object.keys(bench.weights), ...buckets.keys()]);
  const out: SectorRow[] = [...names].map((sector) => {
    const portfolio = buckets.get(sector) ?? 0;
    const benchmark = bench.weights[sector] ?? 0;
    return { sector, portfolio, benchmark, diff: portfolio - benchmark };
  });
  out.sort((a, b) => b.portfolio - a.portfolio || b.benchmark - a.benchmark);
  return { rows: out, unclassified };
}

export function analyzePortfolio(input: AnalysisInput): PortfolioRisk | null {
  const { session, holdings } = input;
  const total = holdings.length;
  if (total === 0) return null;

  /* Değer: son TAMAMLANMIŞ seansın kapanışı × adet. Kapanışı o seansa
     ait değilse pozisyon dışarıda (yazma katmanı kuralı, CLAUDE.md 4). */
  const valued = holdings
    .map((holding) => {
      const last = (input.closes[holding.symbol] ?? []).filter((bar) => bar.date <= session).at(-1);
      return last && last.date === session && last.close > 0 ? { ...holding, value: last.close * holding.quantity } : null;
    })
    .filter((row) => row !== null);
  if (valued.length === 0 || valued.length < total * MIN_COVERAGE_SHARE) return null;
  const totalValue = sum(valued.map((row) => row.value));
  if (!(totalValue > 0)) return null;
  const rows: WeightRow[] = valued
    .map((row) => ({ symbol: row.symbol, sector: row.sector, value: row.value, weight: (row.value / totalValue) * PERCENT }))
    .sort((a, b) => b.weight - a.weight);
  const fractions = rows.map((row) => ({ symbol: row.symbol, sector: row.sector, weight: row.weight / PERCENT }));

  const concentration = concentrationOf(fractions);
  const sectors = input.benchmarkSectors
    ? (() => {
        const { rows: sectorList, unclassified } = sectorRows(
          rows.map((row) => ({ symbol: row.symbol, sector: row.sector, weight: row.weight })),
          input.benchmarkSectors,
        );
        return { asOf: input.benchmarkSectors.asOf, rows: sectorList, unclassified };
      })()
    : null;

  /* Risk: yalnız yılı kapsayan seriler; ağırlık onların içinde yeniden. */
  const aligned = alignReturns(input.closes, input.benchmark, rows.map((row) => row.symbol), session);
  const riskRows = aligned ? rows.filter((row) => aligned.returns.has(row.symbol)) : [];
  let risk: RiskBlock | null = null;
  let correlationBlock: PortfolioRisk["correlation"] = null;
  let fx: PortfolioRisk["fx"] = null;
  if (aligned && riskRows.length > 0 && riskRows.length >= total * MIN_COVERAGE_SHARE) {
    const riskTotal = sum(riskRows.map((row) => row.value));
    const weights = new Map(riskRows.map((row) => [row.symbol, row.value / riskTotal]));
    const series = basket(weights, aligned);
    const drawdown = maxDrawdown(series, aligned.dates);
    risk = {
      covered: riskRows.length,
      sessions: series.length,
      start: aligned.dates[0]!,
      end: aligned.dates[aligned.dates.length - 1]!,
      volatility: annualVolatility(series),
      benchmarkVolatility: annualVolatility(aligned.benchmark),
      beta: beta(series, aligned.benchmark),
      maxDrawdown: drawdown,
      benchmarkMaxDrawdown: maxDrawdown(aligned.benchmark, aligned.dates).depth,
      returnUsd: compound(series),
      benchmarkReturn: compound(aligned.benchmark),
    };
    if (riskRows.length >= 2) {
      const pairs: CorrelationPair[] = [];
      for (let i = 0; i < riskRows.length; i += 1)
        for (let j = i + 1; j < riskRows.length; j += 1) {
          const a = riskRows[i]!.symbol;
          const b = riskRows[j]!.symbol;
          pairs.push({ a, b, value: correlation(aligned.returns.get(a)!, aligned.returns.get(b)!) });
        }
      const byValue = [...pairs].sort((x, y) => y.value - x.value);
      const top = byValue.slice(0, TOP_PAIRS);
      const low = byValue.slice(top.length).slice(-LOW_PAIRS).reverse();
      correlationBlock = { covered: riskRows.length, average: mean(pairs.map((pair) => pair.value)), top, low };
    }
    const { start, end } = input.fx;
    if (start && end && start > 0 && end > 0) {
      const fxChange = (end / start - 1) * PERCENT;
      fx = {
        returnUsd: risk.returnUsd,
        returnTl: inLira(risk.returnUsd, start, end),
        benchmarkUsd: risk.benchmarkReturn,
        benchmarkTl: inLira(risk.benchmarkReturn, start, end),
        fxChange,
        rateStart: start,
        rateEnd: end,
      };
    }
  }

  /* Bilanço: önümüzdeki 30 gün, haftaya göre ağırlık. */
  const weightOf = new Map(rows.map((row) => [row.symbol, row.weight]));
  const horizon = addDays(session, EARNINGS_WINDOW_DAYS);
  const weeks = new Map<string, { weight: number; symbols: string[] }>();
  const seen = new Set<string>();
  for (const item of [...input.earnings].sort((a, b) => a.date.localeCompare(b.date))) {
    const weight = weightOf.get(item.symbol);
    if (weight === undefined || item.date <= session || item.date > horizon || seen.has(item.symbol)) continue;
    seen.add(item.symbol);
    const key = weekStartOf(item.date);
    const week = weeks.get(key) ?? { weight: 0, symbols: [] };
    week.weight += weight;
    week.symbols.push(item.symbol);
    weeks.set(key, week);
  }
  const weekList = [...weeks].map(([weekStart, week]) => ({ weekStart, ...week })).sort((a, b) => a.weekStart.localeCompare(b.weekStart));

  /* Temettü: son 12 ayın olağan ödemeleri × bugünkü adet. */
  const since = addDays(session, -DIVIDEND_LOOKBACK_DAYS);
  const quantityOf = new Map(valued.map((row) => [row.symbol, row.quantity]));
  const paymentsOf = new Map<string, { exDate: string; rate: number }[]>();
  for (const item of input.dividends) {
    if (!quantityOf.has(item.symbol) || item.exDate <= since || item.exDate > session || !(item.rate > 0)) continue;
    paymentsOf.set(item.symbol, [...(paymentsOf.get(item.symbol) ?? []), { exDate: item.exDate, rate: item.rate }]);
  }
  const perSymbol = new Map<string, number>();
  for (const [symbol, payments] of paymentsOf)
    perSymbol.set(symbol, sum(annualPayments(payments).map((p) => p.rate)) * quantityOf.get(symbol)!);
  const annualUsd = sum([...perSymbol.values()]);
  const dividends = {
    annualUsd,
    annualTl: input.fx.end && input.fx.end > 0 ? annualUsd * input.fx.end : null,
    yieldPct: (annualUsd / totalValue) * PERCENT,
    payers: perSymbol.size,
  };

  return {
    session,
    total,
    covered: rows.length,
    totalValue,
    rows,
    concentration,
    sectors,
    risk,
    correlation: correlationBlock,
    fx,
    earnings: { weeks: weekList, totalWeight: sum(weekList.map((week) => week.weight)) },
    dividends,
  };
}

/* ------------------------------------------------------- eksik sektörler */

export type SectorGap = {
  sector: string;
  portfolio: number;
  benchmark: number;
  diff: number;
  fund: string | null;
  /** Sektörün endeksteki en büyük şirketlerinden birkaçı — SEMBOL (alfabe) SIRASIYLA, ağırlıksız. */
  examples: { symbol: string; name: string }[];
};

/**
 * S&P 500'e göre en az `UNDERWEIGHT_GAP_PTS` puan eksik sektörler, farkı en
 * büyükten. Örnekler bilerek alfabe sırasında: büyüklük sırası "en iyisi bu"
 * diye okunurdu (hukuki çizgi, dosya başı).
 */
export function sectorGaps(risk: PortfolioRisk, bench: BenchmarkSectors | null, funds: readonly SectorFund[]): SectorGap[] {
  if (!risk.sectors || !bench) return [];
  return risk.sectors.rows
    .filter((row) => row.diff <= -UNDERWEIGHT_GAP_PTS)
    .sort((a, b) => a.diff - b.diff)
    .slice(0, MAX_GAPS)
    .map((row) => ({
      ...row,
      fund: funds.find((fund) => fund.sector === row.sector)?.symbol ?? null,
      /* Sembolün alfabe sırası: çipte önde duran ve okurun gözüyle
         denetleyebildiği sıra bu (ad sırası çipte "rastgele" görünürdü). */
      examples: [...(bench.leaders[row.sector] ?? [])]
        .slice(0, EXAMPLES_PER_SECTOR)
        .sort((a, b) => a.symbol.localeCompare(b.symbol, "en")),
    }));
}

/* -------------------------------------------------------------- senaryo */

export type ScenarioSide = {
  volatility: number;
  beta: number;
  sectorShare: number;
  effectiveCount: number;
  largestWeight: number;
};

export type Scenario = { fund: string; sector: string; add: number; before: ScenarioSide; after: ScenarioSide };

export const isScenarioWeight = (value: number): value is (typeof SCENARIO_WEIGHTS)[number] =>
  (SCENARIO_WEIGHTS as readonly number[]).includes(value);

/**
 * "Şu sektöre %X eklersem": mevcut ağırlıklar (1 − X) ile küçülür, fon X
 * olur. Fon tek pozisyon sayılır (etkin pozisyon sayısı onu bir kalem
 * görür; içindeki şirketlere dağılmış hâli sayıyı daha da yükseltirdi —
 * künyede yazılı). Fonun sektör payı %100 o sektör: SPDR sektör fonları
 * tek GICS sektörünü tutar (lib/market-boards.ts → SECTOR_ETFS).
 * Risk tarafı risk panelinin AYNI ızgarası ve ağırlıklarıyla; "önce"
 * sütunu oradaki sayının aynısı.
 */
export function scenarioOf(input: AnalysisInput, risk: PortfolioRisk, fund: SectorFund, addPct: number): Scenario | null {
  if (!risk.risk || !(addPct > 0 && addPct < PERCENT)) return null;
  const aligned = alignReturns(input.closes, input.benchmark, [...risk.rows.map((row) => row.symbol), fund.symbol], input.session);
  if (!aligned || !aligned.returns.has(fund.symbol)) return null;
  const riskRows = risk.rows.filter((row) => aligned.returns.has(row.symbol) && row.symbol !== fund.symbol);
  const riskTotal = sum(riskRows.map((row) => row.value));
  if (!(riskTotal > 0)) return null;
  const add = addPct / PERCENT;

  const side = (extra: number): ScenarioSide => {
    /* Okur fonu zaten tutuyorsa ek ağırlık aynı kaleme biner. */
    const weights = new Map<string, number>();
    for (const row of riskRows) weights.set(row.symbol, (row.value / riskTotal) * (1 - extra));
    const held = risk.rows.find((row) => row.symbol === fund.symbol);
    const heldRisk = held && aligned.returns.has(fund.symbol) ? held.value : 0;
    if (heldRisk > 0) {
      const all = riskTotal + heldRisk;
      for (const row of riskRows) weights.set(row.symbol, (row.value / all) * (1 - extra));
      weights.set(fund.symbol, (heldRisk / all) * (1 - extra) + extra);
    } else if (extra > 0) weights.set(fund.symbol, extra);
    const series = basket(weights, aligned);
    /* Sektör ve yoğunlaşma bütün portföyün ağırlıklarıyla (risk kapsamı değil). */
    const all = risk.rows.map((row) => ({ symbol: row.symbol, sector: row.sector, weight: (row.weight / PERCENT) * (1 - extra) }));
    const existing = all.find((row) => row.symbol === fund.symbol);
    if (existing) existing.weight += extra;
    else if (extra > 0) all.push({ symbol: fund.symbol, sector: fund.sector, weight: extra });
    const { buckets } = sectorBuckets(all, input.benchmarkSectors);
    const concentration = concentrationOf(all);
    return {
      volatility: annualVolatility(series),
      beta: beta(series, aligned.benchmark),
      sectorShare: (buckets.get(fund.sector) ?? 0) * PERCENT,
      effectiveCount: concentration.effectiveCount,
      largestWeight: concentration.largest.weight,
    };
  };

  /* "Önce" (ek 0) risk panelindeki sayının aynısı: aynı ızgara, aynı
     ağırlıklar (tests/portfolio-risk.test.ts bunu sınar). */
  return { fund: fund.symbol, sector: fund.sector, add: addPct, before: side(0), after: side(add) };
}
