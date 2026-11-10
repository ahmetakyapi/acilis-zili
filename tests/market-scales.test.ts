import test from "node:test";
import assert from "node:assert/strict";

import { capAxis, changeHistogram, histogramShare, HISTOGRAM_LIMIT, HISTOGRAM_STEP } from "../lib/market-scales";

/**
 * Piyasalar ekranının iki çizim ölçeği (gerekçe `lib/market-scales.ts`):
 * dağılım kutuları sıfırı sınır sayar, piyasa değeri ekseni onluk basamak.
 */

test("histogram sıfırın iki yanında eşit sayıda kutu kurar, uçlar açık", () => {
  const h = changeHistogram([]);
  const perSide = HISTOGRAM_LIMIT / HISTOGRAM_STEP + 1;
  assert.equal(h.bins.length, perSide * 2);
  assert.equal(h.bins[0].from, -Infinity);
  assert.equal(h.bins.at(-1)!.to, Infinity);
  assert.equal(h.bins[perSide - 1].to, 0);
  assert.equal(h.bins[perSide].from, 0);
  assert.equal(h.peak, 0);
});

test("değerler işaretine göre yarıya, büyüklüğüne göre kutuya düşer", () => {
  const h = changeHistogram([-0.2, -0.5, 0.5, 0.51, 2.9, 3, 3.01, -7, 0, Number.NaN]);
  const count = (from: number) => h.bins.find((bin) => bin.from === from)!.count;
  assert.equal(count(-0.5), 2, "−0,2 ve sınırdaki −0,5 sıfıra yakın kutuda");
  assert.equal(count(0), 1, "+0,5 sınırda, sıfıra yakın kutuda");
  assert.equal(count(0.5), 1);
  assert.equal(count(2.5), 2, "2,9 ve tam eşikteki 3");
  assert.equal(count(3), 1, "uç kutu yalnız eşiği aşanlar");
  assert.equal(h.bins[0].count, 1);
  assert.equal(h.flat, 1, "tam sıfır yön kutusuna girmez");
  assert.equal(h.total, 9, "sonlu olmayan atlanır");
  assert.equal(h.peak, 2);
  assert.equal(h.bins.reduce((sum, bin) => sum + bin.count, 0) + h.flat, h.total);
});

test("histogram payı: sıfır ortada, eşik ötesi uç kutunun ortasında", () => {
  assert.equal(histogramShare(0), 0.5);
  assert.ok(histogramShare(1) > 0.5 && histogramShare(-1) < 0.5);
  assert.equal(histogramShare(40), histogramShare(3.2));
  const lastBinCentre = 1 - 0.5 / (h14());
  assert.ok(Math.abs(histogramShare(9) - lastBinCentre) < 1e-9);
});
const h14 = () => changeHistogram([]).bins.length;

test("piyasa değeri ekseni veriyi saran onluklara oturur", () => {
  const axis = capAxis([27.6e9, 4.38e12, null, undefined, 0])!;
  assert.equal(axis.min, 1e10);
  assert.equal(axis.max, 1e13);
  assert.deepEqual(axis.ticks, [1e10, 1e11, 1e12, 1e13]);
  assert.equal(axis.at(1e10), 0);
  assert.equal(axis.at(1e13), 1);
  assert.ok(Math.abs(axis.at(1e11) - 1 / 3) < 1e-9, "her onluk eşit adım");
  assert.equal(axis.at(5), 0, "eksenin altı sol uca sabitlenir");
});

test("piyasa değeri ekseni: tam onluk ve tek değer bir basamaklık eksen verir, veri yoksa null", () => {
  const axis = capAxis([1e11])!;
  assert.equal(axis.min, 1e11);
  assert.equal(axis.max, 1e12);
  assert.equal(capAxis([null, 0, -4]), null);
});
