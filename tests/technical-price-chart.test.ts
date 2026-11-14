import assert from "node:assert/strict";
import { test } from "node:test";
import { buildPriceChart, chartLabelSlots, CHART_SESSIONS } from "../components/technical/price-chart";
import type { Bar } from "../lib/providers/types";
import type { Level } from "../lib/technical";

/* Teknik analiz kapağındaki fiyat grafiğinin saf hesabı (14 Kasım 2026). */

const DAY = 86_400;
function series(count: number, close: (index: number) => number): Bar[] {
  const start = Date.UTC(2026, 0, 5) / 1000;
  return Array.from({ length: count }, (_, index) => {
    const value = close(index);
    return { time: start + index * DAY, open: value, high: value, low: value, close: value, volume: 1 };
  });
}

test("pencere son altı ay, ortalamalar bütün seriden hesaplanır", () => {
  const bars = series(254, (index) => 100 + index * 0.5);
  const model = buildPriceChart(bars, null, [], false);
  assert.ok(model);
  assert.equal(model.closes.length, CHART_SESSIONS);
  assert.equal(model.dates.length, CHART_SESSIONS);
  const ma200 = model.averages.find((average) => average.window === 200);
  /* 254 barda 200 günlük ancak son 55 seansta var; önce kesip sonra
     hesaplasaydık hiç çizilmezdi. */
  assert.ok(ma200);
  assert.equal(ma200.values.filter((value) => value !== null).length, 55);
  assert.equal(ma200.values[ma200.values.length - 1], ma200.last);
});

test("son nokta kotasyondur: başlıktaki fiyat ile çizginin ucu aynı sayı", () => {
  const bars = series(60, () => 50);
  const model = buildPriceChart(bars, 57.25, [], false);
  assert.ok(model);
  assert.equal(model.closes[model.closes.length - 1], 57.25);
  assert.ok(model.priceY !== null && model.priceY > 0 && model.priceY < 1);
});

test("az bar varsa grafik hiç kurulmaz", () => {
  assert.equal(buildPriceChart(series(12, () => 10), 10, [], false), null);
  assert.equal(buildPriceChart([], 10, [], false), null);
});

test("seviyeler alanın içinde; bölge bant olarak, SAT'ta hedef satış seviyesi", () => {
  const bars = series(120, (index) => 100 + Math.sin(index / 5) * 4);
  const levels: Level[] = [
    { kind: "target", price: 112, order: 1 },
    { kind: "entry", price: 96, high: 99 },
    { kind: "stop", price: 90 },
  ];
  const model = buildPriceChart(bars, 101, levels, false);
  assert.ok(model);
  for (const level of model.levels) assert.ok(level.y > 0 && level.y < 1, `${level.kind} alanın dışında`);
  const entry = model.levels.find((level) => level.kind === "entry");
  assert.ok(entry && entry.yTop !== undefined && entry.yBottom !== undefined && entry.yTop < entry.yBottom);
  /* Yukarıdaki seviye yukarıda çizilir: hedef < fiyat < stop (y aşağı artar). */
  const y = (kind: string) => model.levels.find((level) => level.kind === kind)!.y;
  assert.ok(y("target") < model.priceY! && model.priceY! < y("stop"));
  assert.equal(model.levels.find((level) => level.kind === "target")!.tone, "target");
  const sell = buildPriceChart(bars, 101, levels, true);
  assert.equal(sell!.levels.find((level) => level.kind === "target")!.tone, "sellLevel");
});

test("çok uzak seviye ekseni sıkıştırmaz, sayılır", () => {
  const bars = series(120, () => 100);
  const model = buildPriceChart(bars, 100, [{ kind: "resistance", price: 190 }, { kind: "support", price: 95 }], false);
  assert.ok(model);
  assert.equal(model.levels.length, 1);
  assert.equal(model.offScale, 1);
  assert.ok(model.domain.max < 150);
});

test("ay başları eksende, ilk seans sayılmaz", () => {
  const model = buildPriceChart(series(90, () => 20), 20, [], false);
  assert.ok(model);
  assert.ok(model.months.length >= 2);
  for (const tick of model.months) assert.ok(tick.x > 0 && tick.x <= 1);
});

test("yakın etiketler ayrılır, sıra korunur, sütunun dışına çıkmaz", () => {
  const ys = [0.5, 0.505, 0.51, 0.9];
  const slots = chartLabelSlots(ys, 0.08);
  for (let i = 1; i < 3; i++) assert.ok(slots[i]! - slots[i - 1]! >= 0.08 - 1e-9);
  assert.ok(slots.every((slot) => slot >= 0 && slot <= 1));
  assert.equal(slots[3], 0.9);
  /* Sığmayacak kadar çok etikette pay eşit bölünür, üst üste binmez. */
  const many = chartLabelSlots(Array.from({ length: 21 }, () => 0.5), 0.08);
  const sorted = [...many].sort((a, b) => a - b);
  for (let i = 1; i < sorted.length; i++) assert.ok(sorted[i]! - sorted[i - 1]! > 0.04);
  assert.ok(sorted[0]! >= 0 && sorted[sorted.length - 1]! <= 1 + 1e-9);
  assert.deepEqual(chartLabelSlots([], 0.08), []);
});
