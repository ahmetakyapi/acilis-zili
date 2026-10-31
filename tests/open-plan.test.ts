import test from "node:test";
import assert from "node:assert/strict";

import { ladderOf, openPlan, openRangeLayout, openWhere, planReading, priceLadderLayout } from "../lib/technical";

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

test("bölgesiz TUT'un yeri: arasında, seviyede, geçilmiş; seviye yoksa null", () => {
  assert.equal(openWhere(openPlan("hold", 1150.89, sndk)!), "between");
  assert.equal(openWhere(openPlan("hold", 1255.26, sndk)!), "atResistance");
  assert.equal(openWhere(openPlan("hold", 1400, sndk)!), "aboveResistance");
  assert.equal(openWhere(openPlan("hold", 950, sndk)!), "belowSupport");
  assert.equal(openWhere(openPlan("hold", 1100, { ...sndk, resistances: [] })!), "aboveSupport");
  assert.equal(openWhere(openPlan("hold", 1100, { ...sndk, supports: [] })!), "belowResistance");
  assert.equal(openWhere(openPlan("hold", 1100, { ...sndk, supports: [], resistances: [] })!), null);
});

test("bölgesiz TUT ekseni: destek ve direnç iki uç, fiyat doğrusal yerinde, şeritler nötr", () => {
  const layout = openRangeLayout(openPlan("hold", 1150.89, sndk)!, 1150.89);
  assert.ok(layout);
  assert.equal(layout.support, 0);
  assert.equal(layout.resistance, 1);
  assert.ok(Math.abs(layout.price - (1150.89 - 998.19) / (1255.35 - 998.19)) < 1e-9);
  assert.deepEqual(layout.segments.map((s) => [s.side, s.tone]), [["buy", "flat"], ["sell", "flat"]]);
  /* Uzaklık `openPlan`ın yüzdesi: aynı sayı iki yerde aynı kaynaktan. */
  assert.ok(Math.abs(layout.segments[0]!.pct - ((1150.89 - 998.19) / 1150.89) * 100) < 1e-9);
  /* Şeritler fiyatta buluşuyor. */
  assert.equal(layout.segments[0]!.to, layout.price);
  assert.equal(layout.segments[1]!.from, layout.price);
});

test("bölgesiz TUT ekseni: geçilmiş seviye yön renginde, fiyat uca yapışmıyor; fiyatsız eksen yok", () => {
  const below = openRangeLayout(openPlan("hold", 950, sndk)!, 950)!;
  assert.equal(below.segments.find((s) => s.side === "buy")?.tone, "down");
  assert.ok(below.price > 0 && below.price < (below.support ?? 0));
  const above = openRangeLayout(openPlan("hold", 1400, sndk)!, 1400)!;
  assert.equal(above.segments.find((s) => s.side === "sell")?.tone, "up");
  assert.ok(above.price < 1 && above.price > (above.resistance ?? 1));
  /* Dirençte: o tarafa şerit yok (uzaklık "%0,0" çizilmiyor). */
  const at = openRangeLayout(openPlan("hold", 1255.26, sndk)!, 1255.26)!;
  assert.equal(at.segments.some((s) => s.side === "sell"), false);
  assert.equal(openRangeLayout(openPlan("hold", null, sndk)!, null), null);
  for (const l of [below, above, at]) {
    for (const v of [l.price, l.support, l.resistance]) if (v !== null) assert.ok(v >= 0 && v <= 1);
  }
});
