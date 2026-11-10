import test from "node:test";
import assert from "node:assert/strict";

import { BIG_MOVE, CAP_SHARE_MIN_COVERAGE, DAY_LANE_SPAN, DRAW_STAGGER_ROWS, LANE_STEPS, WEEK_LANE_SPAN, capShares, laneModeOf, laneOver, laneSpan, drawStep, rangeShare, changeHistogram, laneArm, histogramShare, HISTOGRAM_LIMIT, HISTOGRAM_STEP } from "../lib/market-scales";

/**
 * Piyasalar ekranının iki çizim ölçeği (gerekçe `lib/market-scales.ts`):
 * dağılım kutuları sıfırı sınır sayar; tablo kulvarları sabit ölçekli,
 * piyasa değeri payı bilinenlerin toplamına oran.
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

test("yön kulvarı: kol yarım kulvarda doyar", () => {
  assert.equal(laneArm(0, DAY_LANE_SPAN), 0);
  assert.equal(laneArm(DAY_LANE_SPAN / 2, DAY_LANE_SPAN), 25);
  assert.equal(laneArm(-DAY_LANE_SPAN / 2, DAY_LANE_SPAN), 25, "işaret uzunluğu değiştirmez");
  assert.equal(laneArm(40, DAY_LANE_SPAN), 50, "eşiğin ötesi tam kol");
  assert.equal(laneArm(Number.NaN, WEEK_LANE_SPAN), 0);
  assert.equal(laneArm(1, 0), 0);
  assert.equal(BIG_MOVE, DAY_LANE_SPAN, "hap eşiği kulvarın dolduğu yer");
});

/** n değerlik sakin liste: ±limit içinde, deterministik. */
const calm = (n: number, limit = 1) => Array.from({ length: n }, (_, i) => ((i * 37) % 21) / 10 * limit - limit);

test("kulvar ölçeği: sakin günde taban, basamağa oturur", () => {
  assert.equal(laneSpan([], DAY_LANE_SPAN), DAY_LANE_SPAN, "boş liste taban");
  assert.equal(laneSpan(calm(100), DAY_LANE_SPAN), 3, "hepsi ±%1 içinde: günlük taban");
  assert.equal(laneSpan(calm(100), WEEK_LANE_SPAN), 8, "haftalık taban");
  assert.equal(laneSpan(calm(100), DAY_LANE_SPAN, "rise"), 3, "sıralıyken de taban");
  assert.equal(laneSpan(calm(100), DAY_LANE_SPAN, "fall"), 3);
  assert.equal(laneSpan([null, undefined, Number.NaN, 0.4], DAY_LANE_SPAN), 3, "bilinmeyen değer hesaba girmez");
  assert.equal(laneSpan([5, 5, 5], DAY_LANE_SPAN), 5, "tam basamaktaki değer o basamakta kalır");
  assert.equal(laneSpan([400, 400, 400], DAY_LANE_SPAN), LANE_STEPS.at(-1), "son basamağın ötesi son basamak");
  assert.ok(LANE_STEPS.includes(DAY_LANE_SPAN as 3) && LANE_STEPS.includes(WEEK_LANE_SPAN as 8), "tabanlar basamak");
});

test("kulvar ölçeği: tek uç değer herkesi ezmez", () => {
  const list = [...calm(99), -9.34];
  assert.equal(laneSpan(list, DAY_LANE_SPAN), 3, "gövde: uçtaki onda bir ölçeği belirlemez");
  assert.equal(laneSpan(list, DAY_LANE_SPAN, "fall"), 3, "uç: tek değer de belirlemez (ikinci en büyük düşüş)");
  assert.ok(laneOver(-9.34, 3), "uç değer kola dayanır ve işaretlenir");
  assert.ok(!laneOver(3, 3) && !laneOver(-2.9, 3) && !laneOver(Number.NaN, 3) && !laneOver(4, 0));
});

test("kulvar ölçeği: değişime göre sıralıyken o yönün ucu ayrışır", () => {
  /* Kararın çıkış noktası: −%9,34 · −%3,88 · −%3,01 sabit ±%3'te aynı boydaydı. */
  const list = [...calm(97, 1.5), -9.34, -3.88, -3.01];
  assert.equal(laneSpan(list, DAY_LANE_SPAN), 3, "gövde okuması: liste hâlâ sakin (tek okuma yetmezdi)");
  const fall = laneSpan(list, DAY_LANE_SPAN, "fall");
  assert.equal(fall, 5, "düşenlerin ikincisinin (3,88) basamağı");
  /* İlk denemede sıra üçüncüydü: bu dizide ölçek tabanda kalıp ilk iki satır aynı dolu koldu. */
  const close = laneSpan([...calm(97, 1.5), -3.88, -3.01, -2.42], DAY_LANE_SPAN, "fall");
  assert.equal(close, 5);
  assert.ok(!laneOver(-3.88, close) && laneArm(-3.88, close) > laneArm(-3.01, close));
  assert.ok(laneArm(-3.88, fall) > laneArm(-3.01, fall), "ikinci ile üçüncü artık farklı boyda");
  assert.ok(laneOver(-9.34, fall), "birinci yine taşar");
  assert.equal(laneSpan(list, DAY_LANE_SPAN, "rise"), 3, "yükselenler sakin: o yönün cetveli tabanda");
});

test("kulvar ölçeği: yönler birbirinin cetvelini ezmez", () => {
  /* Sert yükselişli gün: en büyük on hareketin hepsi artı. */
  const list = [...calm(90, 2), 12.4, 11.8, 9.6, 8.1, 7.7, 6.9, 6.2, 5.8, 5.5, 5.1];
  assert.equal(laneSpan(list, DAY_LANE_SPAN, "rise"), 15, "yükselenlerin ikincisi 11,8 → 15");
  assert.equal(laneSpan(list, DAY_LANE_SPAN, "fall"), 3, "düşenler ±%2 içinde: taban; ±%15'te çizgiye inerlerdi");
  /* Yönde iki değer: ikincisi ölçer, yalnız en uçtaki taşar. */
  const few = [...Array.from({ length: 40 }, (_, i) => 0.2 + i * 0.05), -6, -4];
  const span = laneSpan(few, DAY_LANE_SPAN, "fall");
  assert.equal(span, 5);
  assert.ok(laneOver(-6, span) && !laneOver(-4, span));
  /* Yönde tek değer: kendisi ölçer, taşmaz. */
  assert.equal(laneSpan([0.4, 1.1, -6], DAY_LANE_SPAN, "fall"), 8);
  assert.equal(laneSpan([1, 2, 3], DAY_LANE_SPAN, "fall"), 3, "o yönde değer yoksa taban");
});

test("kulvar ölçeği: sert günde gövde de açılır; büyük listede uç yüzde birden", () => {
  const hard = Array.from({ length: 100 }, (_, i) => (i % 5 === 0 ? (i % 2 ? -9 : 8.5) : ((i % 7) - 3) * 0.8));
  assert.equal(laneSpan(hard, DAY_LANE_SPAN), 10, "yüzde yirmisi ±%8 üstünde: 90. yüzdelik 9, basamak 10");
  const big = [...calm(990, 2).map((value) => Math.abs(value)), ...Array.from({ length: 10 }, (_, i) => 12 + i * 3)];
  assert.equal(laneSpan(big, DAY_LANE_SPAN, "rise"), 15, "bin yükselende onuncu en büyük (12) → 15");
  assert.equal(laneSpan(big, DAY_LANE_SPAN), 3);
});

test("kulvar ölçeği: sıra ve dilim ölçeği değiştirmez; okuma sıralamadan", () => {
  const list = [...calm(57, 2.5), 6.1, -7.4, 4.4];
  const shuffled = [...list].reverse();
  for (const mode of ["body", "rise", "fall"] as const) {
    assert.equal(laneSpan(list, DAY_LANE_SPAN, mode), laneSpan(shuffled, DAY_LANE_SPAN, mode));
  }
  assert.equal(laneModeOf(false, "desc"), "body");
  assert.equal(laneModeOf(true, "desc"), "rise", "azalan sıra: en çok yükselenler önde");
  assert.equal(laneModeOf(true, "asc"), "fall");
});

test("piyasa değeri payı: bilinenlerin toplamına oran, toplamı 100", () => {
  const share = capShares([4e12, 1e12, 5e11, 5e11])!;
  assert.equal(share(4e12), (4 / 6) * 100);
  assert.equal(share(null), null);
  assert.equal(share(0), null);
  const sum = [4e12, 1e12, 5e11, 5e11].reduce((total, value) => total + share(value)!, 0);
  assert.ok(Math.abs(sum - 100) < 1e-9);
});

test("piyasa değeri payı: eksik çoksa ya da veri yoksa hiç basılmaz", () => {
  const nine = Array.from({ length: 9 }, () => 1e10);
  assert.ok(capShares([...nine, null]), "onda dokuz bilinen yeter");
  assert.equal(capShares([...nine.slice(0, 8), null, undefined]), null, "onda sekiz yetmez: pay şişerdi");
  assert.ok(CAP_SHARE_MIN_COVERAGE >= 0.9);
  assert.equal(capShares([]), null);
  assert.equal(capShares([null, 0, -4]), null);
});

test("gün aralığındaki yer: dip 0, tepe 100, aralık yoksa çizim yok", () => {
  assert.equal(rangeShare(10, 20, 10), 0);
  assert.equal(rangeShare(10, 20, 20), 100);
  assert.equal(rangeShare(10, 20, 12.5), 25);
  assert.equal(rangeShare(10, 20, 25), 100, "aralığın dışı uca sabitlenir");
  assert.equal(rangeShare(10, 20, 4), 0);
  assert.equal(rangeShare(10, 10, 10), null, "dip = tepe: aralık yok");
  assert.equal(rangeShare(null, 20, 15), null);
  assert.equal(rangeShare(10, undefined, 15), null);
  assert.equal(rangeShare(10, 20, Number.NaN), null);
});

test("çizim kademesi ilk on satırda, toplamı 400 ms'yi aşmaz", () => {
  assert.equal(drawStep(0), 0);
  assert.equal(drawStep(DRAW_STAGGER_ROWS - 1), DRAW_STAGGER_ROWS - 1);
  assert.equal(drawStep(DRAW_STAGGER_ROWS), 0, "ekranın altındaki satır beklemez");
  assert.equal(drawStep(-1), 0);
  assert.ok(DRAW_STAGGER_ROWS * 40 <= 400, "kademe toplamı (--step 40 ms)");
});
