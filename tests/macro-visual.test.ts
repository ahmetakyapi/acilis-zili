import test from "node:test";
import assert from "node:assert/strict";
import {
  buildYieldCurve,
  composeMacroLead,
  curveRatio,
  curveShape,
  FLAT_CURVE_SPREAD,
  heatShare,
  heatCeiling,
  macroLeadFacts,
  sectorLeaders,
  type MacroLeadText,
  type LeadFormat,
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

const TEXT: MacroLeadText = {
  inflationAbove: "TÜFE {value} ile Fed'in %2 hedefinin {gap} puan üstünde",
  inflationBelow: "TÜFE {value} ile Fed'in %2 hedefinin {gap} puan altında",
  inflationAt: "TÜFE {value} ile Fed'in %2 hedefinde",
  unemploymentUp: "işsizlik {delta} puan artarak {value} oldu",
  unemploymentDown: "işsizlik {delta} puan azalarak {value} oldu",
  unemploymentFlat: "işsizlik {value} ile değişmedi",
  curve: {
    normal: "getiri eğrisi normal ({spread} puan)",
    flat: "getiri eğrisi düz ({spread} puan)",
    inverted: "getiri eğrisi ters ({spread} puan)",
  },
  and: " ve ",
};
const fmt = (value: number) => value.toFixed(2).replace(".", ",");
const FORMAT: LeadFormat = {
  locale: "tr",
  percent: (value) => `%${fmt(value)}`,
  points: fmt,
  signedPoints: (value) => `${value > 0 ? "+" : value < 0 ? "−" : ""}${fmt(Math.abs(value))}`,
};

test("cümle: her sayı veriden; hedef farkı, işsizlik yönü, eğri biçimi", () => {
  const facts = macroLeadFacts([
    { id: "CPIAUCSL", latest: 3.72, prev: 3.35 },
    { id: "UNRATE", latest: 4.2, prev: 4.1 },
    { id: "T10Y3M", latest: 0.88, prev: 0.86 },
  ]);
  assert.ok(facts);
  assert.equal(
    composeMacroLead(facts, TEXT, FORMAT),
    "TÜFE %3,72 ile Fed'in %2 hedefinin 1,72 puan üstünde, işsizlik 0,10 puan artarak %4,20 oldu ve getiri eğrisi normal (+0,88 puan).",
  );
});

test("cümle: eksik seri parçayı düşürür; hiçbiri yoksa cümle yok; büyük harf Türkçe", () => {
  assert.equal(macroLeadFacts([{ id: "PAYEMS", latest: 29, prev: 133 }]), null);
  const facts = macroLeadFacts([
    { id: "UNRATE", latest: 4.2, prev: 4.2 },
    { id: "T10Y3M", latest: -0.12, prev: 0.1 },
  ])!;
  assert.equal(composeMacroLead(facts, TEXT, FORMAT), "İşsizlik %4,20 ile değişmedi ve getiri eğrisi ters (−0,12 puan).");
  const below = macroLeadFacts([{ id: "CPIAUCSL", latest: 1.5, prev: null }])!;
  assert.equal(composeMacroLead(below, TEXT, FORMAT), "TÜFE %1,50 ile Fed'in %2 hedefinin 0,50 puan altında.");
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
