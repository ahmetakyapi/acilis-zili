import test from "node:test";
import assert from "node:assert/strict";

import {
  alignedBeta,
  atrSeries,
  crossOnLast,
  crossedBelowOnLast,
  drawdownFromPeak,
  ewmaForecast,
  ewmaVariance,
  logReturns,
  realizedVol,
  sma,
  type DailyBar,
} from "../lib/risk/math";
import { measureSymbol, weightedMean } from "../lib/risk/measures";

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

/** Tohumlu sözde rastgele getiri (deterministik). */
function series(n: number, seed = 7, drift = 0.0004, scale = 0.012): number[] {
  let s = seed;
  const rand = () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648 - 0.5;
  };
  const out = [100];
  for (let i = 1; i < n; i += 1) out.push(out[i - 1]! * Math.exp(drift + rand() * scale * 2));
  return out;
}

function barsOf(closes: number[], spread = 0.01): DailyBar[] {
  const d = dates(closes.length);
  return closes.map((close, i) => ({ date: d[i]!, open: close, high: close * (1 + spread), low: close * (1 - spread), close }));
}

test("logReturns ve yıllıklaştırılmış oynaklık", () => {
  assert.deepEqual(logReturns([100, 100, 100]), [0, 0]);
  assert.equal(realizedVol([100, 101], 5), null, "pencere dolmadan null");
  /* +%1 / −%1 dönüşümlü seri: log getiri ±ln(1,01); örnek std ≈ 0,00995·√(n/(n−1)). */
  const closes = [100];
  for (let i = 0; i < 20; i += 1) closes.push(closes[i]! * (i % 2 === 0 ? 1.01 : 1 / 1.01));
  const vol = realizedVol(closes, 20)!;
  const expected = Math.log(1.01) * Math.sqrt(20 / 19) * Math.sqrt(252) * 100;
  assert.ok(Math.abs(vol - expected) < 1e-9, `${vol} ≈ ${expected}`);
});

test("sma pencere dolmadan null", () => {
  assert.deepEqual(sma([1, 2, 3, 4], 3), [null, null, 2, 3]);
});

test("Wilder ATR: ilk değer TR ortalaması, sonra yumuşatma", () => {
  const bars: DailyBar[] = [
    { date: "a", open: 10, high: 11, low: 9, close: 10 }, // TR 2
    { date: "b", open: 10, high: 12, low: 10, close: 11 }, // TR max(2, 2, 0) = 2
    { date: "c", open: 11, high: 11.5, low: 10.5, close: 11 }, // TR 1
    { date: "d", open: 11, high: 15, low: 11, close: 14 }, // TR max(4, 4, 0) = 4
  ];
  const atr = atrSeries(bars, 3);
  assert.equal(atr[0], null);
  assert.equal(atr[1], null);
  assert.ok(Math.abs(atr[2]! - 5 / 3) < 1e-12);
  assert.ok(Math.abs(atr[3]! - ((5 / 3) * 2 + 4) / 3) < 1e-12);
});

test("tepeden düşüş ve kesişimler", () => {
  assert.equal(drawdownFromPeak([100, 120, 90], 10), -25);
  assert.equal(crossOnLast([1, 3], [2, 2]), "golden");
  assert.equal(crossOnLast([3, 1], [2, 2]), "death");
  assert.equal(crossOnLast([3, 3], [2, 2]), null);
  assert.equal(crossedBelowOnLast([105, 95], [100, 100]), true);
  assert.equal(crossedBelowOnLast([95, 94], [100, 100]), false, "zaten altındaydı");
});

test("beta: kendisine 1, iki katı hareket eden seriye 2", () => {
  const closes = series(300);
  const bench = barsOf(closes);
  assert.ok(Math.abs(alignedBeta(bench, bench, 252, 120)! - 1) < 1e-9);
  const doubled = bench.map((b, i) => ({ ...b, close: i === 0 ? 100 : 0 }));
  for (let i = 1; i < bench.length; i += 1) doubled[i]!.close = doubled[i - 1]!.close * (1 + 2 * (bench[i]!.close / bench[i - 1]!.close - 1));
  assert.ok(Math.abs(alignedBeta(doubled, bench, 252, 120)! - 2) < 1e-9);
  assert.equal(alignedBeta(bench.slice(0, 50), bench, 252, 120), null, "az gözlem");
});

test("EWMA: sabit getiride varyans o getirinin karesine yakınsar; bant simetrik ve tutma oranı 0-100", () => {
  const r = Array.from({ length: 400 }, (_, i) => (i % 2 ? 0.01 : -0.01));
  const v = ewmaVariance(r);
  assert.ok(Math.abs(v[v.length - 1]! - 0.0001) < 1e-8);
  const f = ewmaForecast(series(600))!;
  assert.ok(f.annualized > 0);
  assert.ok(f.bandLow < 0 && f.bandHigh > 0);
  assert.ok(f.coverage !== null && f.coverage >= 0 && f.coverage <= 100);
  assert.ok(f.coverageSamples > 40);
  assert.equal(ewmaForecast([100, 101, 102]), null, "az veri");
});

test("measureSymbol: GO uzaklığı, bayraklar ve pencere kuralı", () => {
  const closes = series(320, 3, 0.001);
  const bars = barsOf(closes);
  const m = measureSymbol("TEST", bars, bars)!;
  assert.equal(m.date, bars[bars.length - 1]!.date);
  assert.ok(m.ma[200].value !== null && m.ma[50].value !== null);
  assert.equal(m.below[200], m.close < m.ma[200].value!);
  assert.ok(Math.abs(m.beta! - 1) < 1e-9);
  assert.ok(m.vol20Pctile !== null && m.vol20Pctile >= 0 && m.vol20Pctile <= 100);
  const short = measureSymbol("NEW", bars.slice(-60), null)!;
  assert.equal(short.ma[200].value, null, "200 gün yoksa ortalama da yok");
  assert.equal(short.below[200], null);
  assert.equal(short.beta, null);
});

test("weightedMean bilinmeyeni paydadan çıkarır", () => {
  assert.deepEqual(weightedMean([{ weight: 60, value: 1.5 }, { weight: 40, value: null }]), { value: 1.5, coveredWeight: 60 });
  assert.equal(weightedMean([{ weight: 10, value: null }]), null);
});
