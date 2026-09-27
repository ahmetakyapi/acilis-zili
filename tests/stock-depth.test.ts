import test from "node:test";
import assert from "node:assert/strict";

import { groupInsiderRows, openMarketSummary, sanitizeTradePrices, sentimentSeries, type RawInsiderRow } from "../lib/insider";
import {
  averageAbsMove,
  historicalMoves,
  impliedMove,
  parseOcc,
  pickExpiry,
  type OptionQuote,
} from "../lib/expected-move";
import { analystTrend } from "../lib/analyst-trend";
import {
  percentileOf,
  scoreCard,
  storedMetricsFrom,
  trAblative,
  type ScoreSubject,
} from "../lib/scorecard";

/**
 * Hisse sayfasının derinlik panelleri — içeriden işlemler, bilanço hareketi,
 * analist dağılımı değişimi ve skor kartı. Hepsi ekrana SAYI basıyor ve
 * her test bir "uydurma kesinlik" yolunu kapatıyor.
 */

const row = (over: Partial<RawInsiderRow>): RawInsiderRow => ({
  name: "Teter Timothy S.",
  share: 1000,
  change: -100,
  filingDate: "2026-09-23",
  transactionDate: "2026-09-21",
  transactionCode: "S",
  transactionPrice: 220,
  id: "f1",
  isDerivative: false,
  ...over,
});

test("aynı Form 4'ün parçaları tek işlem, fiyat hacim ağırlıklı", () => {
  const trades = groupInsiderRows([
    row({ change: -100, transactionPrice: 220 }),
    row({ change: -300, transactionPrice: 224 }),
  ]);
  assert.equal(trades.length, 1);
  assert.equal(trades[0]!.shares, -400);
  assert.equal(trades[0]!.parts, 2);
  assert.ok(Math.abs(trades[0]!.price! - 223) < 1e-9);
  assert.ok(Math.abs(trades[0]!.value! - 400 * 223) < 1e-6);
});

test("sıfır fiyatlı ödül fiyatsız kalır, tutar uydurulmaz", () => {
  const [grant] = groupInsiderRows([row({ transactionCode: "A", change: 500, transactionPrice: 0 })]);
  assert.equal(grant!.price, null);
  assert.equal(grant!.value, null);
});

test("özet yalnızca açık piyasa P ve S'yi sayar", () => {
  const trades = groupInsiderRows([
    row({ id: "a", transactionCode: "P", change: 10, transactionPrice: 100, name: "A" }),
    row({ id: "b", transactionCode: "S", change: -5, transactionPrice: 100, name: "B" }),
    row({ id: "c", transactionCode: "F", change: -50, transactionPrice: 100, name: "C" }),
    row({ id: "d", transactionCode: "M", change: 70, transactionPrice: 10, name: "D" }),
    row({ id: "e", transactionCode: "S", change: -9, transactionPrice: 100, name: "E", isDerivative: true }),
  ]);
  const s = openMarketSummary(trades);
  assert.equal(s.buyValue, 1000);
  assert.equal(s.sellValue, 500);
  assert.equal(s.netValue, 500);
  assert.equal(s.buyers, 1);
  assert.equal(s.sellers, 1);
});

test("hisse fiyatıyla tutmayan işlem fiyatı düşer, özet tutarı uydurmaz", () => {
  const trades = sanitizeTradePrices(
    groupInsiderRows([row({ transactionCode: "P", change: 40, transactionPrice: 76.2 })]),
    451,
  );
  assert.equal(trades[0]!.price, null);
  assert.equal(trades[0]!.priceDropped, true);
  const s = openMarketSummary(trades);
  assert.equal(s.buyPriced, 0);
  assert.equal(s.buyUnpriced, 1);
  assert.equal(sanitizeTradePrices(trades, null).length, 1);
});

test("MSPR serisinde eksik ay sıfır değil boş", () => {
  const series = sentimentSeries(
    [
      { year: 2026, month: 7, mspr: -100, change: -5 },
      { year: 2026, month: 9, mspr: 20, change: 3 },
    ],
    "2026-09",
    3,
  );
  assert.equal(series.length, 3);
  assert.equal(series[0]!.mspr, -100);
  assert.equal(series[1], null);
  assert.equal(series[2]!.month, "2026-09");
});

test("ay dizisi yıl sınırını geçer", () => {
  const series = sentimentSeries([{ year: 2025, month: 12, mspr: 1, change: 1 }], "2026-01", 2);
  assert.equal(series[0]!.month, "2025-12");
});

const closes = [
  { date: "2026-08-21", close: 100 },
  { date: "2026-08-24", close: 110 },
  { date: "2026-08-25", close: 120 },
  { date: "2026-08-26", close: 108 },
];

test("bmo: önceki kapanıştan rapor gününe; amc: rapor gününden ertesi güne", () => {
  const moves = historicalMoves(
    [
      { date: "2026-08-24", timing: "bmo" },
      { date: "2026-08-25", timing: "amc" },
    ],
    closes,
    "2026-09-28",
  );
  assert.equal(moves[0]!.date, "2026-08-25");
  assert.ok(Math.abs(moves[0]!.movePct! - -10) < 1e-9);
  assert.ok(Math.abs(moves[1]!.movePct! - 10) < 1e-9);
});

test("saati bilinmeyen rapor ölçülmez ve ortalamaya girmez", () => {
  const moves = historicalMoves(
    [
      { date: "2026-08-24", timing: null },
      { date: "2026-08-25", timing: "amc" },
    ],
    closes,
    "2026-09-28",
  );
  assert.equal(moves.find((m) => m.date === "2026-08-24")!.reason, "timing-unknown");
  assert.equal(averageAbsMove(moves), null);
});

test("ertesi günün barı yoksa amc ölçülmez; gelecek rapor listelenmez", () => {
  const moves = historicalMoves(
    [
      { date: "2026-08-26", timing: "amc" },
      { date: "2026-11-17", timing: "amc" },
    ],
    closes,
    "2026-09-28",
  );
  assert.equal(moves.length, 1);
  assert.equal(moves[0]!.reason, "bars-missing");
});

test("ortalama mutlak hareket", () => {
  const avg = averageAbsMove([
    { date: "a", timing: "bmo", movePct: -10, reason: null },
    { date: "b", timing: "amc", movePct: 4, reason: null },
  ]);
  assert.deepEqual(avg, { avg: 7, count: 2 });
});

test("OCC sembolü", () => {
  assert.deepEqual(parseOcc("NVDA261120C00222500"), { root: "NVDA", expiry: "2026-11-20", type: "C", strike: 222.5 });
  assert.equal(parseOcc("NVDA"), null);
});

test("amc'de rapor günü biten vade haberi görmez", () => {
  assert.equal(pickExpiry(["2026-11-17", "2026-11-20"], "2026-11-17", "amc"), "2026-11-20");
  assert.equal(pickExpiry(["2026-11-17", "2026-11-20"], "2026-11-17", "bmo"), "2026-11-17");
  assert.equal(pickExpiry(["2026-11-17", "2026-11-20"], "2026-11-17", null), "2026-11-20");
});

const q = (type: "C" | "P", strike: number, bid: number, ask: number, expiry = "2026-11-20"): OptionQuote => ({
  expiry,
  type,
  strike,
  bid,
  ask,
  at: "2026-09-25T19:59:59Z",
});
const now = new Date("2026-09-28T12:00:00Z");

test("başa baş straddle ÷ spot", () => {
  const r = impliedMove({
    quotes: [q("C", 220, 16.35, 16.45), q("P", 220, 9.67, 9.84), q("C", 230, 11.1, 11.3), q("P", 230, 14.5, 14.7)],
    spot: 221,
    reportDate: "2026-11-17",
    timing: "amc",
    now,
  });
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.strike, 220);
    assert.ok(Math.abs(r.pct - ((16.4 + 9.755) / 221) * 100) < 1e-9);
  }
});

test("geniş aralıkta sayı yok, başka kontrat aranmaz", () => {
  const r = impliedMove({
    quotes: [q("C", 220, 10, 20), q("P", 220, 9.67, 9.84), q("C", 225, 13, 13.1), q("P", 225, 12, 12.1)],
    spot: 221,
    reportDate: "2026-11-17",
    timing: "amc",
    now,
  });
  assert.deepEqual(r, { ok: false, reason: "wide-spread" });
});

test("eski kotasyon ve uzak kontrat reddedilir", () => {
  const stale = impliedMove({
    quotes: [q("C", 220, 16.35, 16.45), q("P", 220, 9.67, 9.84)],
    spot: 221,
    reportDate: "2026-11-17",
    timing: "amc",
    now: new Date("2026-10-05T12:00:00Z"),
  });
  assert.deepEqual(stale, { ok: false, reason: "stale" });
  const far = impliedMove({
    quotes: [q("C", 300, 1, 1.02), q("P", 300, 70, 71)],
    spot: 221,
    reportDate: "2026-11-17",
    timing: "amc",
    now,
  });
  assert.deepEqual(far, { ok: false, reason: "no-atm" });
});

const rec = (period: string, strongBuy: number, buy: number) => ({
  symbol: "NVDA",
  period,
  strongBuy,
  buy,
  hold: 3,
  sell: 1,
  strongSell: 0,
});

test("dağılım değişimi eskiden yeniye, fark en yeni − en eski", () => {
  const trend = analystTrend([rec("2026-09-01", 24, 41), rec("2026-08-01", 23, 41), rec("2026-06-01", 24, 38)]);
  assert.deepEqual(trend!.periods, ["2026-06-01", "2026-08-01", "2026-09-01"]);
  assert.equal(trend!.rows.find((r) => r.bucket === "buy")!.delta, 3);
  assert.equal(trend!.totals.at(-1), 69);
});

test("tek dönemde değişim yok", () => {
  assert.equal(analystTrend([rec("2026-09-01", 1, 1)]), null);
});

test("yüzdelik: eşitlik yarım, yön çevrilebilir", () => {
  assert.equal(percentileOf(5, [1, 5, 9, 3], "higher"), 62.5);
  assert.equal(percentileOf(5, [1, 5, 9, 3], "lower"), 37.5);
});

const subject = (symbol: string, over: Record<string, number>, price = 100, momentum: number | null = 0): ScoreSubject => ({
  symbol,
  currency: "USD",
  price,
  momentum,
  metrics: storedMetricsFrom({ "52WeekHigh": 120, "52WeekLow": 80, ...over }),
});

test("skor kartı: eşik altındaki eksen yok, eksi özsermaye en kötü", () => {
  const peers = Array.from({ length: 8 }, (_, i) =>
    subject(`P${i}`, { epsTTM: i + 1, revenueGrowthTTMYoy: i, "totalDebt/totalEquityQuarterly": i + 1 }),
  );
  const self = subject("S", { epsTTM: 100, revenueGrowthTTMYoy: 50, "totalDebt/totalEquityQuarterly": -2 });
  const card = scoreCard(self, [...peers, self]);
  const axis = (a: string) => card.find((c) => c.axis === a);
  assert.equal(axis("valuation")!.percentile, 100);
  assert.equal(axis("growth")!.percentile, 100);
  assert.equal(axis("health")!.percentile, 0);
  assert.equal(axis("profitability"), undefined);
  assert.equal(axis("valuation")!.peers, 8);
  assert.equal(scoreCard(self, peers.slice(0, 7)).length, 0);
});

test("dolar dışı ve yanlış hisse sınıfı değerlemeye girmez", () => {
  const adr = { ...subject("A", { epsTTM: 5 }), currency: "TWD" };
  const brk = subject("B", { epsTTM: 5, "52WeekHigh": 800000, "52WeekLow": 690000 }, 500);
  const peers = Array.from({ length: 8 }, (_, i) => subject(`P${i}`, { epsTTM: i + 1 }));
  assert.equal(scoreCard(adr, peers).some((c) => c.axis === "valuation"), false);
  assert.equal(scoreCard(brk, peers).some((c) => c.axis === "valuation"), false);
});

test("Türkçe ek sayının okunuşuna göre", () => {
  assert.equal(trAblative(80), "'inden");
  assert.equal(trAblative(50), "'sinden");
  assert.equal(trAblative(30), "'undan");
  assert.equal(trAblative(40), "'ından");
  assert.equal(trAblative(6), "'sından");
  assert.equal(trAblative(3), "'ünden");
  assert.equal(trAblative(100), "'ünden");
  assert.equal(trAblative(0), "'ından");
  assert.equal(trAblative(92), "'sinden");
});
