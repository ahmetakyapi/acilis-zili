import test from "node:test";
import assert from "node:assert/strict";
import { rollingAverage, seriesDomain, seriesPath, seriesY } from "../components/stock/average-paths";
import { hareketliOrtalama } from "../lib/utils";

test("kayan ortalama pencere dolmadan değer üretmez", () => {
  assert.deepEqual(rollingAverage([1, 2, 3, 4], 3), [null, null, 2, 3]);
  assert.deepEqual(rollingAverage([1, 2], 3), [null, null]);
  assert.deepEqual(rollingAverage([1, 2], 0), [null, null]);
});

test("son değer kartın yazdığı ortalamayla aynı", () => {
  const closes = Array.from({ length: 254 }, (_, i) => 100 + Math.sin(i / 9) * 12 + i * 0.1);
  for (const window of [50, 100, 200]) {
    const series = rollingAverage(closes, window);
    const last = series[series.length - 1];
    const expected = hareketliOrtalama(closes, window);
    assert.ok(last !== null && expected !== null);
    assert.ok(Math.abs(last - expected) < 1e-9, `pencere ${window}`);
    assert.equal(series.filter((v) => v === null).length, window - 1);
  }
});

test("bozuk kapanış penceresini boş bırakır, sonra toparlanır", () => {
  const series = rollingAverage([1, Number.NaN, 3, 4, 5], 2);
  assert.deepEqual(series, [null, null, null, 3.5, 4.5]);
});

test("alan iki yana pay bırakır, boş seride null", () => {
  assert.equal(seriesDomain([[null, null]]), null);
  const domain = seriesDomain([[10, 20], [null, 15]], 0.1);
  assert.deepEqual(domain, { min: 9, max: 21 });
});

test("yol boşlukta kesilir ve tek noktayı çizmez", () => {
  const domain = { min: 0, max: 10 };
  assert.equal(seriesPath([0, 10], domain), "M0.00 100.00 L100.00 0.00");
  assert.equal(seriesPath([null, 5, 5], domain), "M50.00 50.00 L100.00 50.00");
  // Ortadaki tek nokta: iki yanı boş, çizilmez.
  assert.equal(seriesPath([null, 5, null], domain), "");
  assert.equal(seriesPath([0, 10, null, 5, 5], domain).split("M").length - 1, 2);
});

test("dikey yer alanın içinde kalır", () => {
  const domain = { min: 0, max: 10 };
  assert.equal(seriesY(10, domain), 0);
  assert.equal(seriesY(0, domain), 100);
  assert.equal(seriesY(99, domain), 0);
});
