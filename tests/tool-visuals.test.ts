import test from "node:test";
import assert from "node:assert/strict";

import {
  fitSwarm,
  labelRows,
  median,
  percentileRank,
  quantile,
  screenerSentence,
  sharePercent,
  stackSlices,
  shareSlices,
  swarmDomain,
  swarmLayout,
  swarmPosition,
} from "../lib/tool-visuals";

/**
 * Araç ekranlarının görsel katmanı (25 Ekim): /tarama tepe cümlesi ve arı
 * kümesi, /sirketler sektör payları, /hisse-secimi puan kulvarı etiketleri.
 */

const COPY = {
  filtered: "Süzgeçten {n} hisse geçti",
  all: "Evrende {n} hisse var",
  topSector: "en kalabalık sektör {sector} ({k} hisse)",
  oneSector: "tamamı {sector}",
  medianFk: "ortanca F/K {fk}",
  none: "Süzgeçten hisse geçmedi.",
};
const fmt = (v: number) => v.toFixed(1).replace(".", ",");

test("ortanca ve yüzdelik", () => {
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([1, 2, 3, 4]), 2.5);
  assert.equal(median([null, undefined]), null);
  assert.equal(quantile([], 0.5), null);
  assert.equal(quantile([0, 10], 0.25), 2.5);
  const sorted = [1, 2, 3, 4, 5];
  assert.equal(percentileRank(sorted, 1), 0);
  assert.equal(percentileRank(sorted, 5), 1);
  assert.equal(percentileRank(sorted, 3), 0.5);
  assert.equal(percentileRank([7], 7), 0.5);
});

test("tepe cümlesi: süzgeç, en kalabalık sektör ve ortanca F/K", () => {
  const s = screenerSentence(
    {
      count: 23,
      filtered: true,
      sectors: [
        { label: "Bilgi Teknolojileri", count: 14 },
        { label: "Sağlık", count: 9 },
      ],
      fkValues: [20, 22, 24, 26, 28, null],
      formatFk: fmt,
    },
    COPY,
  );
  assert.equal(s, "Süzgeçten 23 hisse geçti; en kalabalık sektör Bilgi Teknolojileri (14 hisse), ortanca F/K 24,0.");
});

test("tepe cümlesi: az F/K ölçüsünde ortanca yazılmaz, eşitlikte sektör seçilmez", () => {
  const s = screenerSentence(
    {
      count: 4,
      filtered: false,
      sectors: [
        { label: "Enerji", count: 2 },
        { label: "Finans", count: 2 },
      ],
      fkValues: [10, 12, null, null],
      formatFk: fmt,
    },
    COPY,
  );
  assert.equal(s, "Evrende 4 hisse var.");
});

test("tepe cümlesi: tek sektör ve boş küme", () => {
  const one = screenerSentence(
    { count: 3, filtered: true, sectors: [{ label: "Enerji", count: 3 }], fkValues: [], formatFk: fmt },
    COPY,
  );
  assert.equal(one, "Süzgeçten 3 hisse geçti; tamamı Enerji.");
  assert.equal(
    screenerSentence({ count: 0, filtered: true, sectors: [], fkValues: [], formatFk: fmt }, COPY),
    "Süzgeçten hisse geçmedi.",
  );
});

test("küme alanı: doğrusal ölçek uçları kırpar, log ölçek kırpmaz", () => {
  const values = Array.from({ length: 101 }, (_, i) => i);
  const lin = swarmDomain(values, "linear")!;
  assert.equal(lin.lo, 4);
  assert.equal(lin.hi, 96);
  assert.deepEqual(swarmPosition(100, lin), { t: 1, clipped: true });
  assert.equal(swarmPosition(50, lin).clipped, false);
  const log = swarmDomain([1e9, 1e10, 1e12], "log")!;
  assert.equal(log.lo, 1e9);
  assert.ok(Math.abs(swarmPosition(1e10, log).t - 1 / 3) < 1e-9);
  assert.equal(swarmDomain([], "linear"), null);
  /* Tek değerli küme çökmez. */
  const flat = swarmDomain([5, 5, 5], "linear")!;
  assert.ok(flat.hi > flat.lo);
});

test("küme yerleşimi: çarpışma yok, tek nokta merkezde", () => {
  const xs = Array.from({ length: 60 }, (_, i) => 50 + (i % 7));
  const r = 3;
  const ys = swarmLayout(xs, r);
  for (let a = 0; a < xs.length; a++) {
    for (let b = a + 1; b < xs.length; b++) {
      const dist = Math.hypot(xs[a] - xs[b], ys[a] - ys[b]);
      assert.ok(dist >= 2 * r - 1e-6, `çarpışma ${a}-${b}`);
    }
  }
  assert.deepEqual(swarmLayout([10], 3), [0]);
});

test("küme sığdırma: yükseklik payını aşmaz", () => {
  const ts = Array.from({ length: 400 }, (_, i) => (i % 40) / 40);
  const fit = fitSwarm(ts, 340, 60);
  for (const y of fit.ys) assert.ok(Math.abs(y) <= 60 - fit.radius + 1e-6);
  for (const x of fit.xs) assert.ok(x >= fit.radius - 1e-6 && x <= 340 - fit.radius + 1e-6);
});

test("pay dilimleri: adet ve değer payı, değere göre sıralı", () => {
  const slices = shareSlices([
    { key: "tek", value: 300 },
    { key: "tek", value: 100 },
    { key: "fin", value: 100 },
    { key: "fin", value: null },
    { key: "fin", value: 0 },
  ]);
  assert.equal(slices[0].key, "tek");
  assert.equal(slices[0].count, 2);
  assert.equal(slices[0].valueShare, 0.8);
  assert.equal(slices[1].countShare, 0.6);
  assert.equal(sharePercent(0.004), 1);
  assert.equal(sharePercent(0), 0);
  assert.equal(sharePercent(0.415), 42);
});

test("etiket satırları: yakın etiketler ayrı satıra", () => {
  assert.deepEqual(labelRows([10, 12, 40, 41, 42], 6), [0, 1, 0, 1, 2]);
  assert.deepEqual(labelRows([10, 30, 50], 6), [0, 0, 0]);
});

test("yığılı şeritler: aralıklı ve toplam genişlik korunur", () => {
  const slices = shareSlices([
    { key: "a", value: 300 },
    { key: "b", value: 100 },
    { key: "b", value: 0 },
  ]);
  const geo = stackSlices(slices, 1000, 4);
  assert.equal(geo[0].cx, 0);
  assert.equal(geo[1].vx, geo[0].vw + 4);
  const last = geo[geo.length - 1];
  assert.ok(Math.abs(last.cx + last.cw - 1000) < 1e-9);
  assert.ok(Math.abs(last.vx + last.vw - 1000) < 1e-9);
});
