import test from "node:test";
import assert from "node:assert/strict";

import { ladderOf, openPlan, planReading, priceLadderLayout } from "../lib/technical";

/**
 * Plansız görüş ve fiyat merdiveni (31 Ekim).
 *
 * İki değişmez: (1) site seviye uydurmuyor — her cevap rutinin verdiği
 * listeden geliyor; (2) fiyat seviyeyi geçtiyse "seviyeye doğru" denmiyor.
 * Örnek SanDisk'in 30 Ekim kapanış öncesi kaydı: TUT, bölge ve stop yok.
 */
const sndk = {
  entryLow: null,
  entryHigh: null,
  stop: null,
  targets: [] as number[],
  supports: [998.19],
  resistances: [1255.35, 1282.14, 1306.09, 1345.95],
};

test("bölgesiz TUT: alım tarafı destek, satış tarafı en yakın direnç", () => {
  const open = openPlan("hold", 1150.89, sndk);
  assert.ok(open);
  assert.equal(open.buy?.state, "toward");
  assert.equal(open.buy?.level, 998.19);
  assert.equal(open.sell?.state, "toward");
  assert.equal(open.sell?.kind, "resistance");
  assert.equal(open.sell?.level, 1255.35);
});

test("dirence kuruş kala 'seviyede', üstünde 'geçildi' — %0,0 uzaklık yazılmıyor", () => {
  const at = openPlan("hold", 1255.26, sndk);
  assert.equal(at?.sell?.state, "at");
  const above = openPlan("hold", 1400, sndk);
  assert.equal(above?.sell?.state, "beyond");
  assert.equal(above?.sell?.level, 1345.95);
  /* İkinci direnç hâlâ yukarıdaysa geçilen değil o cevap. */
  const between = openPlan("hold", 1270, sndk);
  assert.equal(between?.sell?.state, "toward");
  assert.equal(between?.sell?.level, 1282.14);
});

test("destek kırıldıysa alım tarafı 'beyond' ve seviye uydurulmuyor", () => {
  const open = openPlan("hold", 950, sndk);
  assert.equal(open?.buy?.state, "beyond");
  assert.equal(open?.buy?.level, 998.19);
});

test("bölgeli TUT ve AL açık plan değil", () => {
  assert.equal(openPlan("buy", 100, { ...sndk, entryLow: 90, entryHigh: 95 }), null);
  assert.equal(openPlan("hold", 100, { ...sndk, entryLow: 90, entryHigh: 95 }), null);
});

test("SAT: satış tarafı rutinin hedefleri (tepki seviyeleri), destek yoksa alım tarafı boş", () => {
  const intc = { entryLow: null, entryHigh: null, targets: [86.78, 89.47], supports: [], resistances: [86.78, 89.47, 92.14] };
  const open = openPlan("sell", 65.76, intc);
  assert.equal(open?.sell?.kind, "target");
  assert.deepEqual(open?.sell?.levels, [86.78, 89.47]);
  assert.equal(open?.buy, null);
  const reading = planReading("sell", 65.76, { ...intc, stop: null });
  assert.deepEqual(reading, { kind: "sell", level: 86.78, support: null });
});

test("merdiven: ölçek doğrusal, etiketler çakışmıyor ve kutunun içinde", () => {
  const levels = ladderOf({ ...sndk });
  const gap = 40;
  const { marks, height, scale } = priceLadderLayout(levels, 1150.89, { gap, inset: 30, minHeight: 360, labelTop: 30, labelBottom: 12 });
  /* Gerçek yer doğrusal: eşit fiyat farkı eşit piksel farkı. */
  const d1 = scale(1100) - scale(1200);
  const d2 = scale(1000) - scale(1100);
  assert.ok(Math.abs(d1 - d2) < 1e-6);
  const ys = marks.map((mark) => mark.labelY);
  for (let i = 1; i < ys.length; i++) assert.ok(ys[i]! - ys[i - 1]! >= gap - 1e-6, `etiket ${i} çakışıyor`);
  assert.ok(ys[0]! >= 30 - 1e-6);
  assert.ok(ys.at(-1)! <= height - 12 + 1e-6);
  /* Yüksekten düşüğe sıra korunuyor. */
  const prices = marks.map((mark) => ("high" in mark && mark.high !== undefined ? mark.high : mark.price));
  assert.deepEqual(prices, [...prices].sort((a, b) => b - a));
});
