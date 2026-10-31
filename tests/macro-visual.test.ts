import test from "node:test";
import assert from "node:assert/strict";
import {
  buildYieldCurve,
  curveRatio,
  curveShape,
  FLAT_CURVE_SPREAD,
  heatShare,
  heatCeiling,
  balancedSpans,
  fillTemplate,
  TILE_GRID_UNITS,
  gaugeRatio,
  macroGaugeFacts,
  sectorLeaders,
} from "../lib/macro-visual";

/** Makro ve piyasa görsellerinin saf mantığı (lib/macro-visual.ts). */

const days = (start: string, values: number[]) =>
  values.map((value, i) => ({
    date: new Date(Date.parse(`${start}T00:00:00Z`) + i * 86_400_000).toISOString().slice(0, 10),
    value,
  }));

test("eğri: en yeni ORTAK gün; bir vadenin o gün gözlemi yoksa önceki ortak güne iner", () => {
  const curve = buildYieldCurve([
    { key: "2y", observations: [{ date: "2026-10-22", value: 4.6 }, { date: "2026-10-23", value: 4.69 }] },
    { key: "10y", observations: [{ date: "2026-10-22", value: 4.95 }] },
  ]);
  assert.ok(curve);
  assert.equal(curve.date, "2026-10-22");
  assert.deepEqual(curve.points.map((p) => p.value), [4.6, 4.95]);
});

test("eğri: hayalet eğri 30 gün öncesinin son ortak günü; yoksa null", () => {
  const two = days("2026-09-01", Array.from({ length: 53 }, (_, i) => 4 + i / 100));
  const ten = days("2026-09-01", Array.from({ length: 53 }, (_, i) => 4.5 + i / 100));
  const curve = buildYieldCurve([{ key: "2y", observations: two }, { key: "10y", observations: ten }]);
  assert.ok(curve);
  assert.equal(curve.date, "2026-10-23");
  assert.equal(curve.ghostDate, "2026-09-23");
  assert.equal(curve.points[0].ghost, two.find((p) => p.date === "2026-09-23")!.value);

  const short = buildYieldCurve([
    { key: "2y", observations: days("2026-10-20", [4, 4.1]) },
    { key: "10y", observations: days("2026-10-20", [4.5, 4.6]) },
  ]);
  assert.equal(short?.ghostDate, null);
  assert.deepEqual(short?.points.map((p) => p.ghost), [null, null]);
});

test("eğri: iki vadeden azı veriliyse eğri yok; ölçek iki eğriyi de kapsar", () => {
  assert.equal(buildYieldCurve([{ key: "2y", observations: days("2026-10-20", [4]) }, { key: "10y", observations: [] }]), null);
  const curve = buildYieldCurve([
    { key: "2y", observations: [{ date: "2026-09-20", value: 3 }, { date: "2026-10-23", value: 4 }] },
    { key: "10y", observations: [{ date: "2026-09-20", value: 5 }, { date: "2026-10-23", value: 4.5 }] },
  ])!;
  for (const point of curve.points) {
    for (const value of [point.value, point.ghost]) {
      const ratio = curveRatio(value!, curve);
      assert.ok(ratio > 0 && ratio < 1, `${value} ölçeğin içinde`);
    }
  }
});

test("eğri biçimi: sıfırın altı ters, eşiğin altı düz, üstü normal", () => {
  assert.equal(curveShape(-0.01), "inverted");
  assert.equal(curveShape(0), "flat");
  assert.equal(curveShape(FLAT_CURVE_SPREAD - 0.01), "flat");
  assert.equal(curveShape(FLAT_CURVE_SPREAD), "normal");
  assert.equal(curveShape(0.31), "normal");
});

test("ölçüler: hedef farkı, işsizlik değişimi ve aralığı, eğri, Sahm; uçlar veriden ve yuvarlak", () => {
  const facts = macroGaugeFacts([
    { id: "CPIAUCSL", latest: 3.72, prev: 3.35 },
    { id: "UNRATE", latest: 4.2, prev: 4.1, points: [4.3, 3.9, 4.0, 4.1, 4.2].map((value) => ({ value })) },
    { id: "T10Y3M", latest: 0.87, prev: 0.86 },
    { id: "SAHMREALTIME", latest: 0, prev: 0.07 },
  ]);
  assert.ok(facts);
  assert.ok(Math.abs(facts.inflation!.gap - 1.72) < 1e-9);
  assert.deepEqual(facts.inflation!.domain, { lo: 0, hi: 5 });
  assert.ok(Math.abs(facts.unemployment!.delta! - 0.1) < 1e-9);
  assert.deepEqual(facts.unemployment!.domain, { lo: 3.8, hi: 4.4 });
  assert.equal(facts.curve!.shape, "normal");
  assert.equal(facts.curve!.span, 1);
  assert.equal(facts.sahm!.triggered, false);
  assert.deepEqual(facts.sahm!.domain, { lo: 0, hi: 1 });
});

test("ölçüler: eksik seri düşer; hiçbiri yoksa null; ters eğri ve tetiklenen Sahm ölçeğe sığar", () => {
  assert.equal(macroGaugeFacts([{ id: "PAYEMS", latest: 29, prev: 133 }]), null);
  const facts = macroGaugeFacts([
    { id: "T10Y3M", latest: -1.62, prev: -1.5 },
    { id: "SAHMREALTIME", latest: 0.93, prev: 0.6 },
  ])!;
  assert.equal(facts.inflation, null);
  assert.equal(facts.unemployment, null);
  assert.equal(facts.curve!.shape, "inverted");
  assert.equal(facts.curve!.span, 2);
  assert.equal(facts.sahm!.triggered, true);
  assert.ok(facts.sahm!.domain.hi >= 0.93);
  /* Önceki değer yoksa değişim yok, aralık yalnız son değerden. */
  const lone = macroGaugeFacts([{ id: "UNRATE", latest: 4.2, prev: null }])!;
  assert.equal(lone.unemployment!.delta, null);
  assert.deepEqual(lone.unemployment!.domain, { lo: 4.1, hi: 4.3 });
});

test("ölçek oranı uçlara kırpılır; şablon yer tutucuyu doldurur, bilinmeyeni bırakır", () => {
  assert.equal(gaugeRatio(2, { lo: 0, hi: 5 }), 0.4);
  assert.equal(gaugeRatio(-1, { lo: 0, hi: 5 }), 0);
  assert.equal(gaugeRatio(9, { lo: 0, hi: 5 }), 1);
  assert.equal(gaugeRatio(1, { lo: 1, hi: 1 }), 0);
  assert.equal(fillTemplate("Hedefin {gap} puan üstünde {x}", { gap: "1,72" }), "Hedefin 1,72 puan üstünde {x}");
});

test("dengeli satırlar: boş hücre ve tek geniş kart yok; her satır tam genişlik", () => {
  const rowsOf = (spans: number[]) => {
    const rows: number[][] = [];
    let sum = 0;
    for (const span of spans) {
      if (sum === 0) rows.push([]);
      rows.at(-1)!.push(span);
      sum = (sum + span) % TILE_GRID_UNITS;
    }
    return rows;
  };
  assert.deepEqual(rowsOf(balancedSpans(11, 6)).map((row) => row.length), [6, 5]);
  assert.deepEqual(rowsOf(balancedSpans(11, 3)).map((row) => row.length), [3, 3, 3, 2]);
  assert.deepEqual(rowsOf(balancedSpans(11, 2)).map((row) => row.length), [2, 2, 2, 2, 2, 1]);
  assert.deepEqual(rowsOf(balancedSpans(7, 6)).map((row) => row.length), [4, 3]);
  for (const spans of [balancedSpans(11, 6), balancedSpans(9, 4), balancedSpans(5, 6)]) {
    for (const row of rowsOf(spans)) assert.equal(row.reduce((a, b) => a + b, 0), TILE_GRID_UNITS);
    assert.ok(spans.every(Number.isInteger));
  }
  assert.deepEqual(balancedSpans(0, 6), []);
});

test("ısı: sütun ölçeğine oran, 0–1 arası; boş değer ve sıfır ölçek 0", () => {
  assert.equal(heatShare(5, 10), 0.5);
  assert.equal(heatShare(-10, 10), 1);
  assert.equal(heatShare(12, 10), 1);
  assert.equal(heatShare(null, 10), 0);
  assert.equal(heatShare(3, 0), 0);
});

test("sektör cümlesi: en iyi, en kötü, artıdakiler; boşlar sayılmaz", () => {
  const leaders = sectorLeaders([
    { name: "Enerji", value: 10.75 },
    { name: "Teknoloji", value: -5.9 },
    { name: "İletişim", value: -7.44 },
    { name: "Finans", value: 2.51 },
    { name: "Boş", value: null },
  ]);
  assert.ok(leaders);
  assert.equal(leaders.best.name, "Enerji");
  assert.equal(leaders.worst.name, "İletişim");
  assert.equal(leaders.up, 2);
  assert.equal(leaders.total, 4);
  assert.equal(sectorLeaders([{ name: "Tek", value: 1 }]), null);
  assert.equal(sectorLeaders([{ name: "A", value: 1 }, { name: "B", value: 1 }]), null);
});

test("heatCeiling: sütunun tavanı tam sayı bir yüzdeye yuvarlanır", () => {
  assert.equal(heatCeiling(2.6), 3);
  assert.equal(heatCeiling(3), 3);
  assert.equal(heatCeiling(1.2), 2);
  assert.equal(heatCeiling(10.75), 15);
  assert.equal(heatCeiling(4.1), 5);
  assert.equal(heatCeiling(7), 8);
  assert.equal(heatCeiling(31), 40);
  assert.equal(heatCeiling(52), 60);
  assert.equal(heatCeiling(0.4), 1);
  assert.equal(heatCeiling(0), 1);
  assert.equal(heatCeiling(Number.EPSILON), 1);
  assert.equal(heatCeiling(9), 10);
});
