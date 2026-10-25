import test from "node:test";
import assert from "node:assert/strict";

import { buyShareShift } from "../lib/analyst-trend";
import { logScale, peerSpread, peerValue, quantile } from "../lib/peer-spread";
import type { ScoreSubject, StoredMetrics } from "../lib/scorecard";
import { dialSlices, gaugeOf } from "../lib/screening-gauge";
import { THRESHOLDS } from "../lib/screening";

/**
 * Hisse sayfası ve kural kontrolünün görsel katmanı (25 Ekim).
 *
 * Kulvarlar yanındaki sayının İKİNCİ iddiası: yer yanlışsa okuyucu sayıya
 * hiç bakmadan yanlış okur. Değişmezler ekranda görülebilecek hatalara
 * karşılık geliyor.
 */

const metrics = (over: Partial<StoredMetrics> = {}): StoredMetrics => ({
  epsTTM: null, revenuePerShareTTM: null, revenueGrowthTTMYoy: null, epsGrowthTTMYoy: null,
  operatingMarginTTM: null, netProfitMarginTTM: null, roeTTM: null, debtToEquity: null,
  currentRatio: null, high52: null, low52: null, ...over,
});
const subject = (over: Partial<ScoreSubject> & { m?: Partial<StoredMetrics> }): ScoreSubject => ({
  symbol: "X", currency: "USD", price: 100, momentum: null, metrics: metrics(over.m), ...over,
});

test("kulvar: sekizden az komşuda çizilmez (skor kartıyla aynı eşik)", () => {
  assert.equal(peerSpread(10, [1, 2, 3, 4, 5, 6, 7]), null);
  assert.notEqual(peerSpread(10, [1, 2, 3, 4, 5, 6, 7, 8]), null);
});

test("kulvar: medyan ve yüzdelik doğru, eşitlik yarım", () => {
  const peers = [10, 20, 30, 40, 50, 60, 70, 80, 90];
  const s = peerSpread(50, peers)!;
  assert.equal(s.median, 50);
  assert.equal(s.below, (4 + 0.5) / 9 * 100);
  assert.equal(s.clipped, 0);
  assert.ok(Math.abs(s.at - s.medianAt) < 1e-9, "medyandaki şirket çentiğin üstünde durur");
});

test("kulvar: uç değer uca oturur ve işaretlenir, ölçeği bozmaz", () => {
  const peers = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19];
  const s = peerSpread(400, peers)!;
  assert.equal(s.at, 100);
  assert.equal(s.clipped, 1);
  assert.equal(s.hi, quantile(peers, 0.95));
  assert.equal(s.below, 100);
});

test("F/K: zarar, dolar dışı rapor ve tutmayan hisse sınıfı kulvara girmez", () => {
  assert.equal(peerValue(subject({ m: { epsTTM: 5 } }), "pe"), 20);
  assert.equal(peerValue(subject({ m: { epsTTM: -1 } }), "pe"), null);
  assert.equal(peerValue(subject({ currency: "TWD", m: { epsTTM: 5 } }), "pe"), null);
  assert.equal(peerValue(subject({ price: null, m: { epsTTM: 5 } }), "pe"), null);
  /* BRK.B: band A sınıfının, fiyatı kapsamıyor */
  assert.equal(peerValue(subject({ m: { epsTTM: 5, low52: 600_000, high52: 800_000 } }), "pe"), null);
});

test("borç/özsermaye: eksi özsermaye kulvardan çıkar", () => {
  assert.equal(peerValue(subject({ m: { debtToEquity: -2 } }), "debtToEquity"), null);
  assert.equal(peerValue(subject({ m: { debtToEquity: 0 } }), "debtToEquity"), 0);
});

test("eşik kulvarı: eşik motorun sayısı, değer doğru tarafta", () => {
  const g = gaugeOf({ id: "aboveLow", value: 42.8, status: "pass" })!;
  assert.equal(g.spec.pass, THRESHOLDS.minAboveLow);
  assert.ok(g.valueAt > g.passAt, "eşiğin üstündeki değer çentiğin sağında");
  const d = gaugeOf({ id: "debt", value: 0.5, status: "pass" })!;
  assert.equal(d.spec.side, "max");
  assert.ok(d.valueAt < d.passAt);
});

test("eşik kulvarı: log ölçekte on kat bir aralık, taşma işaretli", () => {
  const g = gaugeOf({ id: "marketCap", value: 4e12, status: "pass" })!;
  assert.equal(g.clipped, 0);
  const big = gaugeOf({ id: "marketCap", value: 4e13, status: "pass" })!;
  assert.equal(big.valueAt, 100);
  assert.equal(big.clipped, 1);
  const a = gaugeOf({ id: "price", value: 10, status: "pass" })!;
  const b = gaugeOf({ id: "price", value: 100, status: "pass" })!;
  assert.ok(Math.abs(b.valueAt - a.valueAt - 100 / 3) < 1e-9);
});

test("eşik kulvarı: ölçeği olmayan kural ve boş değer çizilmez", () => {
  assert.equal(gaugeOf({ id: "profitable", value: 6.4, status: "pass" }), null);
  assert.equal(gaugeOf({ id: "funds", value: 3, status: "warn" }), null);
  assert.equal(gaugeOf({ id: "upside", value: null, status: "na" }), null);
});

test("halka dilimleri: dolu kısımların toplamı ağırlıklı puan", () => {
  const cats = [
    { category: "growth", score: 75, weight: 30 },
    { category: "strength", score: 100, weight: 20 },
    { category: "profitability", score: 100, weight: 15 },
    { category: "health", score: 50, weight: 15 },
    { category: "ownership", score: null, weight: 10 },
    { category: "catalyst", score: 25, weight: 10 },
  ];
  const slices = dialSlices(cats, false)!;
  assert.equal(slices.length, 5, "ölçülmeyen kategori dilim almaz");
  const total = slices.reduce((sum, s) => sum + s.length, 0);
  assert.ok(Math.abs(total - 1) < 1e-9);
  const filled = slices.reduce((sum, s) => sum + s.length * s.fill, 0) * 100;
  const raw = (75 * 30 + 100 * 20 + 100 * 15 + 50 * 15 + 25 * 10) / 90;
  assert.ok(Math.abs(filled - raw) < 1e-9);
  assert.equal(dialSlices(cats, true), null, "elenen hissede tavanlı puan dilimlerle çizilmez");
});

test("al tarafı cümlesi: yuvarlanmış iki sayının farkı, dönemler arası ay", () => {
  const shift = buyShareShift({ periods: ["a", "b", "c", "d"], buyShare: [66.67, 68.5, 64.2, 63.27] })!;
  assert.deepEqual(shift, { from: 67, to: 63, delta: -4, months: 3 });
  assert.equal(buyShareShift({ periods: ["a", "b"], buyShare: [null, 50] }), null);
});

test("logScale: emsal piyasa değeri, taban alttaki onluk, tavan en büyük", () => {
  const scale = logScale([5.07e12, 290e9, 21.6e9]);
  assert.ok(scale);
  assert.equal(scale.floor, 1e10);
  assert.equal(scale.ratio(5.07e12), 1);
  /* Doğrusalda %0,4 olan SMCI artık görünür bir pay. */
  const smci = scale.ratio(21.6e9);
  assert.ok(smci > 0.1 && smci < 0.15, String(smci));
  assert.ok(scale.ratio(290e9) > smci);
  /* Tam onluk en küçük değer sıfır çubuk almaz. */
  assert.equal(logScale([1e10, 1e12])!.floor, 1e9);
  assert.equal(logScale([]), null);
  assert.equal(scale.ratio(0), 0);
});
