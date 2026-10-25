import test from "node:test";
import assert from "node:assert/strict";

import {
  alignReturns,
  analyzePortfolio,
  annualPayments,
  annualVolatility,
  beta,
  concentrationOf,
  correlation,
  maxDrawdown,
  MATRIX_SIZE,
  scenarioOf,
  sectorGaps,
  weekStartOf,
  type AnalysisInput,
  type BenchmarkSectors,
  type DailyClose,
} from "../lib/portfolio-risk";

/* Deterministik fixture: iş günleri, tohumlu sözde rastgele getiriler. */
function dates(n: number, end = "2026-10-23"): string[] {
  const out: string[] = [];
  const day = new Date(`${end}T12:00:00Z`);
  while (out.length < n) {
    const dow = day.getUTCDay();
    if (dow !== 0 && dow !== 6) out.unshift(day.toISOString().slice(0, 10));
    day.setUTCDate(day.getUTCDate() - 1);
  }
  return out;
}

function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296 - 0.5;
  };
}

const DAYS = dates(260);
const SESSION = DAYS[DAYS.length - 1]!;

function series(returns: number[], start = 100): DailyClose[] {
  let close = start;
  return DAYS.map((date, i) => {
    if (i > 0) close *= 1 + returns[i - 1]!;
    return { date, close };
  });
}

const market = (() => {
  const r = rng(1);
  return DAYS.slice(1).map(() => r() * 0.02);
})();
const noise = (seed: number, scale: number) => {
  const r = rng(seed);
  return DAYS.slice(1).map(() => r() * scale);
};
/* NVDA ve AMD piyasayla güçlü birlikte; KO zayıf; XLV bağımsız. */
const nvda = market.map((m, i) => 1.6 * m + noise(2, 0.01)[i]!);
const amd = market.map((m, i) => 1.5 * m + noise(3, 0.012)[i]!);
const ko = market.map((m, i) => 0.4 * m + noise(4, 0.008)[i]!);
const xlv = market.map((m, i) => 0.6 * m + noise(5, 0.009)[i]!);

const BENCH: BenchmarkSectors = {
  asOf: "2026-10-22",
  weights: { "Information Technology": 33, "Health Care": 10, Financials: 13, "Consumer Staples": 6, Energy: 3, Industrials: 8, "Communication Services": 9, "Consumer Discretionary": 10, Materials: 2, Utilities: 3, "Real Estate": 3 },
  leaders: { "Health Care": [{ symbol: "LLY", name: "Eli Lilly" }, { symbol: "JNJ", name: "Johnson & Johnson" }, { symbol: "ABBV", name: "AbbVie" }], Financials: [{ symbol: "JPM", name: "JPMorgan" }, { symbol: "BRK.B", name: "Berkshire" }] },
};

function input(overrides: Partial<AnalysisInput> = {}): AnalysisInput {
  return {
    session: SESSION,
    holdings: [
      { symbol: "NVDA", quantity: 10, sector: "Information Technology" },
      { symbol: "AMD", quantity: 10, sector: "Information Technology" },
      { symbol: "KO", quantity: 10, sector: "Consumer Staples" },
    ],
    closes: { SPY: series(market, 500), NVDA: series(nvda, 100), AMD: series(amd, 100), KO: series(ko, 50), XLV: series(xlv, 140) },
    benchmark: "SPY",
    benchmarkSectors: BENCH,
    earnings: [],
    dividends: [],
    fx: { start: 40, end: 44 },
    ...overrides,
  };
}

test("istatistik yardımcıları bilinen değerleri verir", () => {
  assert.equal(correlation([1, 2, 3], [2, 4, 6]).toFixed(6), "1.000000");
  assert.equal(correlation([1, 2, 3], [3, 2, 1]).toFixed(6), "-1.000000");
  assert.equal(beta([0.02, -0.02, 0.04], [0.01, -0.01, 0.02]).toFixed(6), "2.000000");
  assert.equal(annualVolatility([0, 0, 0]), 0);
  const dd = maxDrawdown([0.1, -0.5, 0.2], ["a", "b", "c", "d"]);
  assert.equal(dd.depth.toFixed(4), "-50.0000");
  assert.deepEqual([dd.peak, dd.trough], ["b", "c"]);
});

test("yoğunlaşma: HHI ve etkin pozisyon sayısı", () => {
  const even = concentrationOf([0.25, 0.25, 0.25, 0.25].map((weight, i) => ({ symbol: `S${i}`, weight })));
  assert.equal(even.effectiveCount.toFixed(6), "4.000000");
  const skewed = concentrationOf([{ symbol: "A", weight: 0.7 }, { symbol: "B", weight: 0.2 }, { symbol: "C", weight: 0.1 }]);
  assert.equal(skewed.largest.symbol, "A");
  assert.equal(skewed.hhi.toFixed(2), "0.54");
  assert.equal(skewed.top5Share.toFixed(0), "100");
});

test("hafta başı pazartesi", () => {
  assert.equal(weekStartOf("2026-10-29"), "2026-10-26");
  assert.equal(weekStartOf("2026-10-26"), "2026-10-26");
  assert.equal(weekStartOf("2026-11-01"), "2026-10-26");
});

test("analiz: ağırlık, sektör farkı, risk ve korelasyon", () => {
  const risk = analyzePortfolio(input())!;
  assert.equal(risk.covered, 3);
  assert.equal(risk.rows.length, 3);
  assert.equal(Math.round(risk.rows.reduce((s, r) => s + r.weight, 0)), 100);
  const tech = risk.sectors!.rows.find((row) => row.sector === "Information Technology")!;
  assert.ok(tech.portfolio > 60 && tech.diff > 25, "teknoloji ağır");
  assert.ok(risk.risk && risk.risk.sessions === 252);
  assert.ok(risk.risk.beta > 1, "yarı iletken ağırlıklı sepetin betası 1'in üstünde");
  assert.ok(risk.risk.volatility > risk.risk.benchmarkVolatility);
  assert.equal(`${risk.correlation!.top[0]!.a}/${risk.correlation!.top[0]!.b}`, "NVDA/AMD");
  /* Kur: TL getirisi = (1 + USD) × 44/40 − 1. */
  const expected = ((1 + risk.fx!.returnUsd / 100) * 1.1 - 1) * 100;
  assert.equal(risk.fx!.returnTl.toFixed(8), expected.toFixed(8));
  assert.equal(risk.fx!.fxChange.toFixed(6), "10.000000");
});

test("eksik sektörler: fon ve sembol sırasıyla örnekler, puansız", () => {
  const risk = analyzePortfolio(input())!;
  const gaps = sectorGaps(risk, BENCH, [{ symbol: "XLV", sector: "Health Care" }, { symbol: "XLF", sector: "Financials" }]);
  assert.equal(gaps[0]!.sector, "Financials");
  const health = gaps.find((gap) => gap.sector === "Health Care")!;
  assert.equal(health.fund, "XLV");
  assert.deepEqual(health.examples.map((e) => e.symbol), ["ABBV", "JNJ", "LLY"]);
  assert.ok(gaps.every((gap) => gap.diff <= -5));
});

test("kapanışı son seansa ait olmayan pozisyon dışarıda; yarıdan azı okunursa ölçü yok", () => {
  const stale = series(ko, 50).slice(0, -1);
  const partial = analyzePortfolio(input({ closes: { ...input().closes, KO: stale } }))!;
  assert.equal(partial.covered, 2);
  assert.equal(partial.total, 3);
  const none = analyzePortfolio(input({ closes: { SPY: series(market, 500), NVDA: series(nvda) } }));
  assert.equal(none, null, "3 pozisyonun 1'i okunuyor: basılmaz");
});

test("yeni halka arz risk ölçüsünün dışında, ağırlıkta içeride", () => {
  const young = series(amd, 100).slice(-100);
  const risk = analyzePortfolio(input({ closes: { ...input().closes, AMD: young } }))!;
  assert.equal(risk.covered, 3);
  assert.equal(risk.risk!.covered, 2);
});

test("bilanço haftaları ve temettü tahmini", () => {
  const risk = analyzePortfolio(
    input({
      earnings: [
        { symbol: "NVDA", date: "2026-11-18" },
        { symbol: "AMD", date: "2026-11-17" },
        { symbol: "KO", date: "2026-12-30" },
      ],
      dividends: [
        { symbol: "KO", exDate: "2026-09-15", rate: 0.51 },
        { symbol: "KO", exDate: "2026-06-13", rate: 0.51 },
        { symbol: "KO", exDate: "2025-06-01", rate: 0.48 },
      ],
    }),
  )!;
  assert.equal(risk.earnings.weeks.length, 1, "KO 30 günün dışında");
  assert.deepEqual(risk.earnings.weeks[0]!.symbols, ["AMD", "NVDA"]);
  assert.equal(risk.dividends!.annualUsd.toFixed(2), "10.20");
  assert.equal(risk.dividends!.annualTl!.toFixed(2), "448.80");
  assert.equal(risk.dividends!.payers, 1);
});

test("temettü: 365 günlük pencereye düşen beşinci çeyrek ödemesi sayılmaz", () => {
  /* Ödeme günü haftanın gününe bağlı: aralık 364 gün olabiliyor. */
  const quarterly = ["2025-11-10", "2026-02-09", "2026-05-11", "2026-08-10", "2026-11-09"].map((exDate) => ({ exDate, rate: 0.26 }));
  assert.deepEqual(
    annualPayments(quarterly).map((p) => p.exDate),
    ["2026-02-09", "2026-05-11", "2026-08-10", "2026-11-09"],
    "en yeni dördü kalır",
  );
  const monthly = Array.from({ length: 13 }, (_, i) => ({ exDate: new Date(Date.UTC(2025, 10, 3 + i * 30)).toISOString().slice(0, 10), rate: 0.1 }));
  assert.equal(annualPayments(monthly).length, 12);
  assert.equal(annualPayments([{ exDate: "2026-06-01", rate: 1 }]).length, 1, "yıllık tek ödeme");
  assert.equal(annualPayments(quarterly.slice(0, 3)).length, 3, "eksik yıl kırpılmaz");
});

test("SPY tutan portföy sektörlere endeks ağırlığıyla dağılır", () => {
  const risk = analyzePortfolio(input({ holdings: [{ symbol: "SPY", quantity: 1, sector: null }, { symbol: "KO", quantity: 1, sector: "Consumer Staples" }] }))!;
  assert.equal(risk.sectors!.unclassified, 0);
  const total = risk.sectors!.rows.reduce((s, row) => s + row.portfolio, 0);
  assert.equal(total.toFixed(6), "100.000000");
});

test("senaryo: önce sütunu risk panelinin aynısı, sektör fonu çeşitlendirir", () => {
  const data = input();
  const risk = analyzePortfolio(data)!;
  const scenario = scenarioOf(data, risk, { symbol: "XLV", sector: "Health Care" }, 20)!;
  assert.equal(scenario.before.volatility, risk.risk!.volatility);
  assert.equal(scenario.before.beta, risk.risk!.beta);
  assert.equal(scenario.before.sectorShare, 0);
  assert.equal(scenario.after.sectorShare.toFixed(6), "20.000000");
  assert.ok(scenario.after.volatility < scenario.before.volatility, "düşük betalı fon oynaklığı düşürür");
  assert.ok(scenario.after.effectiveCount > scenario.before.effectiveCount);
  assert.equal(scenario.before.effectiveCount, risk.concentration.effectiveCount);
  assert.equal(scenarioOf(data, risk, { symbol: "XLE", sector: "Energy" }, 10), null, "fon verisi yoksa senaryo yok");
});

test("hizalama gösterge ızgarasında; kısa seri girmez", () => {
  const aligned = alignReturns(input().closes, "SPY", ["NVDA", "XLV"], SESSION)!;
  assert.equal(aligned.dates.length, 253);
  assert.equal(aligned.returns.get("NVDA")!.length, 252);
  const gap = { ...input().closes, NVDA: series(nvda).filter((_, i) => i % 5 !== 0) };
  assert.equal(alignReturns(gap, "SPY", ["NVDA"], SESSION)!.returns.has("NVDA"), false);
});

test("korelasyon ısı matrisi: ağırlık sırasında, simetrik, listeyle aynı sayılar", () => {
  const risk = analyzePortfolio(input())!;
  const matrix = risk.correlation!.matrix;
  assert.deepEqual(matrix.symbols, risk.rows.slice(0, MATRIX_SIZE).map((row) => row.symbol));
  const n = matrix.symbols.length;
  for (let i = 0; i < n; i += 1) {
    assert.equal(matrix.values[i]![i], 1);
    for (let j = 0; j < n; j += 1) assert.equal(matrix.values[i]![j], matrix.values[j]![i]);
  }
  /* Listedeki en yüksek çiftin değeri matristeki hücreyle birebir aynı. */
  const top = risk.correlation!.top[0]!;
  const at = (s: string) => matrix.symbols.indexOf(s);
  assert.equal(matrix.values[at(top.a)]![at(top.b)], top.value);
});

test("ısı matrisi en büyük MATRIX_SIZE pozisyonla sınırlı", () => {
  const extra = ["AAA", "BBB", "CCC", "DDD", "EEE"];
  const closes = { ...input().closes };
  extra.forEach((symbol, i) => {
    closes[symbol] = series(market.map((m, k) => m + noise(10 + i, 0.01)[k]!), 20 + i);
  });
  const holdings = [
    ...input().holdings,
    ...extra.map((symbol) => ({ symbol, quantity: 1, sector: "Industrials" })),
  ];
  const risk = analyzePortfolio(input({ holdings, closes }))!;
  assert.equal(risk.correlation!.covered, 8);
  assert.equal(risk.correlation!.matrix.symbols.length, MATRIX_SIZE);
});
