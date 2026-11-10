import test from "node:test";
import assert from "node:assert/strict";

import { BOARD_MIN_SPAN, boardAxis, heatOf, splitSmall, spreadPosition, spreadScale, squarify, barScale } from "../lib/theme-view";

/**
 * Tema ekranlarının çizim hesapları (gerekçe `lib/theme-view.ts`).
 * Kare haritasında iki şey ölçülüyor: alanlar ağırlıkla orantılı ve
 * karolar kabın dışına taşmıyor, birbirinin üstüne binmiyor.
 */

const EPSILON = 1e-6;

test("kare haritası alanları ağırlıkla orantılı ve kabı tam dolduruyor", () => {
  const weights = [5440, 4210, 3850, 2690, 1900, 1650, 1230, 1030, 455, 395, 365, 261, 140, 62.5, 28];
  const total = weights.reduce((a, b) => a + b, 0);
  for (const aspect of [2.1, 0.9]) {
    const rects = squarify(weights, aspect);
    assert.equal(rects.length, weights.length);
    let covered = 0;
    for (const rect of rects) {
      const area = (rect.w * rect.h) / 10000;
      covered += area;
      assert.ok(Math.abs(area - weights[rect.index] / total) < EPSILON, `alan ${rect.index}`);
      assert.ok(rect.x >= -EPSILON && rect.y >= -EPSILON);
      assert.ok(rect.x + rect.w <= 100 + EPSILON && rect.y + rect.h <= 100 + EPSILON);
    }
    assert.ok(Math.abs(covered - 1) < EPSILON);
    for (const a of rects) for (const b of rects) {
      if (a === b) continue;
      const overlapX = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
      const overlapY = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
      assert.ok(overlapX <= EPSILON || overlapY <= EPSILON, `çakışma ${a.index}/${b.index}`);
    }
  }
});

test("sıfır ve eksi ağırlık haritaya girmez", () => {
  assert.deepEqual(squarify([], 2), []);
  assert.deepEqual(squarify([0, -3], 2), []);
  assert.equal(squarify([4, 0, 2], 2).length, 2);
});

test("ısı kademesi piyasalar ekranının eşikleriyle aynı", () => {
  assert.deepEqual(heatOf(0), { tone: "flat", level: 0 });
  assert.deepEqual(heatOf(0.2), { tone: "up", level: 1 });
  assert.deepEqual(heatOf(-1), { tone: "down", level: 2 });
  assert.deepEqual(heatOf(2.9), { tone: "up", level: 3 });
  assert.deepEqual(heatOf(-3), { tone: "down", level: 4 });
});

test("şerit ölçeği okunur bir tavana yuvarlanır ve uçlara yapışır", () => {
  assert.equal(spreadScale([]), 2);
  assert.equal(spreadScale([0.4, -1.2]), 2);
  assert.equal(spreadScale([2.75, -4.1]), 5);
  /* Tek bir uç hareket ölçeği açmıyor: on değerin dokuzu 1 puanın altında. */
  assert.equal(spreadScale([0.2, -0.4, 0.9, 0.1, -0.8, 0.5, 0.3, -0.6, 0.7, 8.6]), 2);
  assert.equal(spreadPosition(0, 5), 50);
  assert.equal(spreadPosition(-5, 5), 0);
  assert.equal(spreadPosition(9, 5), 100);
});

test("küçük üyeler tek karoda toplanır, tek küçük üye gruplanmaz", () => {
  /* Uzay teması, 28 Eylül: SPCX sepetin dörtte üçü, SPCE binde biri. */
  const weights = [1750, 180, 110, 75, 38, 35, 17, 9, 0.4];
  const { kept, grouped } = splitSmall(weights, 0.003);
  assert.deepEqual(grouped, [], "yalnızca SPCE eşiğin altında");
  assert.equal(kept.length, 9, "tek küçük üye haritada kalıyor");

  const wide = splitSmall(weights, 0.006);
  assert.deepEqual(wide.grouped, [7, 8], "büyükten küçüğe");
  assert.deepEqual(wide.kept, [0, 1, 2, 3, 4, 5, 6]);

  assert.deepEqual(splitSmall([0, 5, 5], 0.4), { kept: [1, 2], grouped: [] });
  assert.deepEqual(splitSmall([], 0.1), { kept: [], grouped: [] });
});

test("barScale: en büyük mutlak medyanın oturduğu ilk basamak; tabanı ±%0,5", () => {
  assert.equal(barScale([]), 0.5);
  assert.equal(barScale([0.18, -0.35, 0.47]), 0.5);
  assert.equal(barScale([0.83, -0.35]), 1);
  assert.equal(barScale([-1.4, 0.2]), 2);
  assert.equal(barScale([6.2]), 8);
  assert.equal(barScale([120]), 50);
});

test("pano ekseni: sıfır günün aralığındaki yerinde, en uzun çubuk uca dayanır", () => {
  const mixed = boardAxis([0.83, 0.4, -0.35, 0.1]);
  assert.ok(Math.abs(mixed.zero - (0.35 / 1.18) * 100) < 1e-9, "sıfır düşüşün payı kadar içeride");
  assert.ok(Math.abs(mixed.zero + 0.83 * mixed.unit - 100) < 1e-9, "en güçlü çubuk sağ uca dayanır");
  assert.ok(Math.abs(mixed.zero - 0.35 * mixed.unit) < 1e-9, "en zayıf çubuk sol uca dayanır");
  assert.ok(mixed.neg && mixed.pos);
});

test("pano ekseni: tek yönlü günde sıfır kenarda, sütunun tamamı çubuğa", () => {
  const up = boardAxis([1.2, 0.6, 0.2]);
  assert.equal(up.zero, 0);
  assert.equal(up.neg, false);
  assert.ok(Math.abs(1.2 * up.unit - 100) < 1e-9);
  const down = boardAxis([-2, -0.5]);
  assert.equal(down.zero, 100);
  assert.equal(down.pos, false);
});

test("pano ekseni: sakin gün büyük gün gibi görünmez; veri yoksa sıfır ortada", () => {
  const calm = boardAxis([0.05, -0.03]);
  assert.equal(calm.unit, 100 / BOARD_MIN_SPAN, "aralık tabanın altındaysa birim tabandan");
  assert.ok(0.05 * calm.unit < 100 - calm.zero, "çubuk uca varmaz");
  const empty = boardAxis([]);
  assert.deepEqual(empty, { zero: 50, unit: 100 / BOARD_MIN_SPAN, neg: false, pos: false });
  assert.equal(boardAxis([0, 0]).zero, 50);
});
