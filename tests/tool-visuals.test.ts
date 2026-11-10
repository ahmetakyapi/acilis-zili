import test from "node:test";
import assert from "node:assert/strict";

import {
  fitSwarm,
  foldSlices,
  REST_SLICE,
  laneLabelLayout,
  median,
  metricBands,
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

test("kulvar etiketleri: sığan etiket noktasında kalır", () => {
  const places = laneLabelLayout(
    [{ at: 10, width: 30 }, { at: 50, width: 30 }, { at: 90, width: 30 }],
    { track: 300, gap: 4, maxRows: 2, maxShift: 20 },
  );
  assert.deepEqual(places, [{ row: 0, shift: 0 }, { row: 0, shift: 0 }, { row: 0, shift: 0 }]);
});

test("kulvar etiketleri: küme yana açılır, sıra ve aralık korunur, kulvarda kalır", () => {
  const items = [40, 41, 42, 43, 97, 98].map((at) => ({ at, width: 30 }));
  const opts = { track: 300, gap: 4, maxRows: 1, maxShift: 999 };
  const places = laneLabelLayout(items, opts);
  const centers = items.map((item, i) => (item.at / 100) * opts.track + places[i].shift);
  for (let i = 1; i < centers.length; i++) assert.ok(centers[i] - centers[i - 1] >= 34 - 0.2, `aralık ${i}`);
  assert.ok(centers.at(-1)! <= 300 - 15 + 0.1, "sağ uç kulvarda");
  /* Simetrik küme ortalanır: 40–43 kümesinin merkezi yerinde kalır. */
  assert.ok(Math.abs((centers[0] + centers[3]) / 2 - 124.5) < 0.2);
});

test("kulvar etiketleri: kayma büyükse ikinci satıra dönüşümlü dağıtır", () => {
  const items = [50, 51, 52, 53].map((at) => ({ at, width: 30 }));
  const places = laneLabelLayout(items, { track: 300, gap: 4, maxRows: 2, maxShift: 30 });
  assert.deepEqual(places.map((p) => p.row), [0, 1, 0, 1]);
  assert.ok(places.every((p) => Math.abs(p.shift) <= 30));
});

test("kulvar etiketleri: deterministik, eşit konumda girdi sırası", () => {
  const items = [{ at: 93, width: 24 }, { at: 93, width: 30 }, { at: 91, width: 30 }];
  const opts = { track: 1000, gap: 6, maxRows: 2, maxShift: 40 };
  assert.deepEqual(laneLabelLayout(items, opts), laneLabelLayout(items, opts));
  const places = laneLabelLayout(items, opts);
  const x = items.map((item, i) => item.at * 10 + places[i].shift);
  assert.ok(x[2] < x[0] && x[0] < x[1]);
});

test("katlanan dilimler: kuyruk tek dilimde, seçili grup kuyruktan çıkar", () => {
  const slices = shareSlices([
    { key: "a", value: 500 },
    { key: "b", value: 200 },
    { key: "c", value: 100 },
    { key: "d", value: 50 },
    { key: "e", value: 30 },
  ]);
  const folded = foldSlices(slices, 2);
  assert.deepEqual(folded.slices.map((s) => s.key), ["a", "b", REST_SLICE]);
  assert.equal(folded.restGroups, 3);
  const rest = folded.slices[2];
  assert.equal(rest.count, 3);
  assert.equal(rest.value, 180);
  const total = folded.slices.reduce((sum, s) => sum + s.valueShare, 0);
  assert.ok(Math.abs(total - 1) < 1e-9);

  /* Seçili grup kuyruktaysa son tutulanın yerine geçer. */
  const pinned = foldSlices(slices, 2, "d");
  assert.deepEqual(pinned.slices.map((s) => s.key), ["a", "d", REST_SLICE]);
  assert.equal(pinned.restGroups, 3);
  /* Zaten tutulan seçili grup sırayı bozmaz. */
  assert.deepEqual(foldSlices(slices, 2, "a").slices.map((s) => s.key), ["a", "b", REST_SLICE]);
  /* Katlanacak tek dilim varsa katlanmaz. */
  assert.deepEqual(foldSlices(slices, 4).slices.map((s) => s.key), ["a", "b", "c", "d", "e"]);
  assert.equal(foldSlices(slices, 4).restGroups, 0);
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

test("metricBands: log ölçekte 1-2-5 sınırları, uçlar açık, sayım toplamı korunur", () => {
  const values = [6.8e9, 1.2e10, 4.5e10, 4.6e10, 9e10, 1.5e11, 4e11, 5.1e12];
  const bands = metricBands(values, "log");
  assert.ok(bands.length >= 2 && bands.length <= 7);
  assert.equal(bands[0].lo, null);
  assert.equal(bands[bands.length - 1].hi, null);
  assert.equal(bands.reduce((sum, band) => sum + band.count, 0), values.length);
  for (let i = 1; i < bands.length; i += 1) assert.equal(bands[i].lo, bands[i - 1].hi);
  /* Sınırlar yuvarlak: mantis 1, 2, 3 ya da 5. */
  for (const band of bands.slice(1)) {
    const mantissa = Number((band.lo! / 10 ** Math.floor(Math.log10(band.lo!))).toPrecision(6));
    assert.ok([1, 2, 3, 5].includes(mantissa), String(band.lo));
  }
  /* Üyeler girdi sırasını taşır: en büyük değer son basamakta. */
  assert.ok(bands[bands.length - 1].members.includes(7));
});

test("metricBands: doğrusalda sıfır bir sınır, uçtaki dev değer merdiveni germez", () => {
  const values = [-12, -3, 1, 4, 8, 15, 16, 22, 23, 31, 38, 44, 4500];
  const bands = metricBands(values, "linear");
  assert.ok(bands.length <= 7);
  assert.equal(bands.reduce((sum, band) => sum + band.count, 0), values.length);
  assert.ok(bands.some((band) => band.lo === 0 || band.hi === 0));
  /* 4.500 son açık basamakta; sınırlar onun yanına gitmez. */
  assert.ok((bands[bands.length - 1].lo ?? 0) < 100);
  assert.equal(bands[bands.length - 1].members.at(-1), 12);
});

test("metricBands: boş, tek değer ve log ölçekte eksi değer", () => {
  assert.deepEqual(metricBands([], "linear"), []);
  const flat = metricBands([5, 5, 5], "linear");
  assert.equal(flat.reduce((sum, band) => sum + band.count, 0), 3);
  const log = metricBands([-4, 0, 10, 100], "log");
  assert.equal(log.reduce((sum, band) => sum + band.count, 0), 2);
  assert.equal(metricBands([0.1 + 0.2, 0.9], "linear").every((band) => String(band.lo ?? 0).length < 8), true);
});

test("metricBands: log ölçekte dar aralık doğrusal yuvarlak adımlara düşer", () => {
  /* F/K: orta yüzde seksen 22–58; 1-2-5 merdiveni yalnız 50'yi verirdi. */
  const values = [9, 21, 23, 26, 29, 31, 34, 38, 41, 44, 47, 52, 55, 59, 61, 410];
  const bands = metricBands(values, "log");
  assert.ok(bands.length >= 4, String(bands.length));
  assert.equal(bands.reduce((sum, band) => sum + band.count, 0), values.length);
});
