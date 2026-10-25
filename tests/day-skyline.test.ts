import test from "node:test";
import assert from "node:assert/strict";
import {
  MIN_DISTRICT_SIZE,
  OTHER_DISTRICT,
  SKY_FLOOR,
  SKY_MODES,
  districtMoves,
  districtsOf,
  labelBox,
  partitionRows,
  rowSplits,
  skyDomain,
  skylineLayout,
  skylineStocks,
  type SkyModeName,
  type SkyStock,
} from "../lib/day-skyline";

/**
 * Siluetin yerleşimi — `lib/day-skyline.ts`. Örnek şehir Nasdaq 100'ün
 * şekline yakın: 101 bina, büyük bir teknoloji mahallesi, beşin altındaki
 * sektörler "Diğer"de, piyasa değerleri ~300 kat aralıkta, iki uç hisse.
 * Değerler tohumlu ve deterministik (Math.random yok).
 */

const SECTORS: [string, number][] = [
  ["Information Technology", 38],
  ["Consumer Discretionary", 14],
  ["Communication Services", 10],
  ["Health Care", 12],
  ["Industrials", 11],
  ["Consumer Staples", 7],
  ["Utilities", 4],
  ["Energy", 2],
  ["Materials", 1],
  ["Financials", 1],
  ["Real Estate", 1],
];

/** Basit doğrusal eşlik üreteci: aynı tohum, aynı şehir. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

function city(seed = 7, dominant = false) {
  const rand = rng(seed);
  const members: { symbol: string; name: string; sector: string }[] = [];
  const stocks: { symbol: string; change: number; close: number }[] = [];
  const caps = new Map<string, number>();
  let n = 0;
  for (const [sector, count] of SECTORS) {
    for (let j = 0; j < count; j++) {
      const symbol = `S${String(n).padStart(3, "0")}`;
      members.push({ symbol, name: `Şirket ${n}`, sector });
      /* Değişim −3..+3; iki uç: biri +%12, biri −%9. */
      const change = n === 5 ? 12 : n === 60 ? -9 : Math.round((rand() * 6 - 3) * 100) / 100;
      stocks.push({ symbol, change, close: 100 });
      /* Piyasa değeri 15 milyar – 4,5 trilyon (~300 kat). */
      /* `dominant`: gerçek Nasdaq 100 gibi en büyük şirketler teknolojide. */
      caps.set(symbol, (dominant && sector === "Information Technology" ? 20 : 1) * 15e9 * 300 ** rand());
      n++;
    }
  }
  /* Değişmeyen bir bina ve piyasa değeri bilinmeyen bir bina. */
  stocks[10].change = 0;
  caps.delete(stocks[20].symbol);
  const sky = skylineStocks(stocks, members, (symbol) => caps.get(symbol) ?? null);
  return { sky, districts: districtsOf(sky) };
}

const MODES = Object.keys(SKY_MODES) as SkyModeName[];

type Rect = { x: number; y: number; w: number; h: number };
const intersects = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

test("mahalleler: beşin altındaki sektörler Diğer'de, hiçbir bina düşmüyor", () => {
  const { sky, districts } = city();
  assert.equal(sky.length, 101);
  const keys = new Set(sky.map((s) => s.district));
  assert.deepEqual([...keys].sort(), ["OTHER", "XLC", "XLI", "XLK", "XLP", "XLV", "XLY"]);
  assert.equal(sky.filter((s) => s.district === OTHER_DISTRICT).length, 4 + 2 + 1 + 1 + 1);
  for (const d of districts) if (d.key !== OTHER_DISTRICT) assert.ok(d.members.length >= MIN_DISTRICT_SIZE);
  assert.equal(districts.reduce((acc, d) => acc + d.members.length, 0), 101);
  /* Sektörü bilinmeyen üye de Diğer'e. */
  const lone = skylineStocks([{ symbol: "ZZZ", change: 1, close: 1, high: 1, low: 1 } as never], [], () => null);
  assert.equal(lone[0].district, OTHER_DISTRICT);
  assert.equal(lone[0].cap, null);
});

test("mahalle sırası: güçlüden zayıfa; içeride en çok yükselenden en çok düşene", () => {
  const { sky, districts } = city();
  for (let j = 1; j < districts.length; j++) assert.ok(districts[j - 1].change >= districts[j].change);
  for (const d of districts) {
    for (let j = 1; j < d.members.length; j++) assert.ok(sky[d.members[j - 1]].change >= sky[d.members[j]].change);
    assert.equal(d.advancing, d.members.filter((i) => sky[i].change > 0).length);
    assert.equal(d.declining, d.members.filter((i) => sky[i].change < 0).length);
  }
  assert.deepEqual(
    districtMoves(districts).map((m) => m.symbol),
    districts.map((d) => d.key),
  );
});

test("mahallenin değişimi piyasa değeriyle ağırlıklı", () => {
  const stock = (symbol: string, change: number, cap: number): SkyStock => ({ symbol, name: symbol, district: "XLK", change, cap });
  const [d] = districtsOf([stock("A", 2, 300), stock("B", -1, 100)]);
  assert.equal(d.change, (2 * 300 - 1 * 100) / 400);
  /* Değeri bilinmeyen bina en küçük bilinen değerle tartılıyor. */
  const [e] = districtsOf([stock("A", 2, 300), { ...stock("B", -1, 0), cap: null }]);
  assert.equal(e.change, (2 * 300 - 1 * 300) / 600);
});

test("ölçek: %98'lik dilim; yakın uç kesilmiyor, sakin gün tabanda", () => {
  const calm = skyDomain([0.2, -0.3, 0.1]);
  assert.equal(calm.hi, SKY_FLOOR);
  const changes = Array.from({ length: 100 }, (_, i) => (i % 2 ? 1 : -1) * (1 + (i % 20) / 10));
  const near = skyDomain([...changes, 3.2]);
  assert.equal(near.hi, 3.2);
  const far = skyDomain([...changes, 12]);
  assert.ok(far.hi < 3, `hi=${far.hi}`);
  assert.equal(far.maxUp, 12);
});

test("bütün ardışık bölünüşler", () => {
  assert.equal(rowSplits(7, 3).length, 15);
  assert.equal(rowSplits(7, 1).length, 1);
  assert.deepEqual(rowSplits(2, 3), [[[0], [1]]]);
  for (const split of rowSplits(6, 2)) assert.deepEqual(split.flat(), [0, 1, 2, 3, 4, 5]);
});

test("sıra bölme: sıra korunuyor, en dolu sıra en hafif", () => {
  assert.deepEqual(partitionRows([5, 5, 5, 5], 2), [[0, 1], [2, 3]]);
  assert.deepEqual(partitionRows([10, 1, 1, 1, 1, 1], 2), [[0], [1, 2, 3, 4, 5]]);
  assert.deepEqual(partitionRows([1, 2], 3), [[0], [1]]);
  assert.deepEqual(partitionRows([3, 3, 3], 1), [[0, 1, 2]]);
  /* Her mahalle bir kez ve sırayla. */
  const rows = partitionRows([4, 1, 7, 2, 2, 6, 3], 3);
  assert.deepEqual(rows.flat(), [0, 1, 2, 3, 4, 5, 6]);
  assert.equal(rows.length, 3);
});

for (const [mode, dominant] of MODES.flatMap((m) => [[m, false], [m, true]] as const)) {
  test(`yerleşim (${mode}${dominant ? ", baskın teknoloji" : ""}): sıra sayısı, genişlik toplamı, binalar ve etiketler`, () => {
    const { sky, districts } = city(7, dominant);
    const spec = SKY_MODES[mode];
    const layout = skylineLayout({ stocks: sky, districts, mode });
    assert.equal(layout.rows.length, Math.min(spec.rows, districts.length));
    /* Her bina tam bir kez; okuma sırası mahalle sırası. */
    const order = layout.rows.flatMap((row) => row.buildings.map((b) => b.i));
    assert.deepEqual(order, districts.flatMap((d) => d.members));
    /* Aynı büyüklükteki şirket her sırada aynı genişlikte: genişlik √cap'in doğrusal işlevi. */
    const all = layout.rows.flatMap((row) => row.buildings);
    const wOf = new Map(all.map((b) => [b.i, b.w] as const));
    const sorted = [...sky.keys()].filter((i) => sky[i].cap !== null).sort((a, b) => (sky[a].cap ?? 0) - (sky[b].cap ?? 0));
    for (let j = 1; j < sorted.length; j++) assert.ok(wOf.get(sorted[j])! >= wOf.get(sorted[j - 1])! - 1e-9);
    for (const row of layout.rows) {
      /* Genişlik toplamı sıranın içinde; binalar üst üste binmiyor. */
      const xs = [...row.buildings].sort((a, b) => a.x - b.x);
      assert.ok(xs[0].x >= 0, `${mode}: ilk bina ${xs[0].x}`);
      const last = xs[xs.length - 1];
      assert.ok(last.x + last.w <= spec.width + 1e-6, `${mode}: son bina ${last.x + last.w} > ${spec.width}`);
      for (let j = 1; j < xs.length; j++) assert.ok(xs[j].x >= xs[j - 1].x + xs[j - 1].w - 1e-6);
      for (const b of row.buildings) assert.ok(b.w >= spec.minW - 1e-9);
      /* Mahalle aralıkları sırayla ve binalarını kapsıyor. */
      for (let j = 1; j < row.districts.length; j++) assert.ok(row.districts[j].x0 >= row.districts[j - 1].x1);
      for (const span of row.districts) {
        const d = districts.find((x) => x.key === span.key)!;
        if (spec.minDistrictW > 0) assert.ok(span.x1 - span.x0 >= spec.minDistrictW - 1e-6);
        for (const i of d.members) {
          const b = row.buildings.find((x) => x.i === i)!;
          assert.ok(b.x >= span.x0 - 1e-6 && b.x + b.w <= span.x1 + 1e-6);
        }
      }
      /* Kesik bina yalnız ölçeği aşan. */
      for (const b of row.buildings) {
        assert.equal(b.clip, Math.abs(sky[b.i].change) > layout.domain.hi);
        assert.ok(b.h <= spec.half + 1e-9);
        assert.equal(b.dir, Math.sign(sky[b.i].change));
      }
      /* Etiketler: kutu sırada, birbirine ve binaya binmiyor. */
      const rects = row.buildings.map((b) => ({ x: b.x, y: b.dir === 1 ? -b.h : b.dir === -1 ? 0 : -b.h / 2, w: b.w, h: b.h }));
      for (const [j, label] of row.labels.entries()) {
        assert.ok(label.x >= 0 && label.x + label.w <= spec.width, `${mode}: etiket ${sky[label.i].symbol} taşıyor`);
        assert.ok(label.y >= row.top && label.y + label.h <= row.bottom);
        for (const other of row.labels.slice(j + 1)) {
          assert.ok(!intersects(label, other), `${mode}: ${sky[label.i].symbol} ile ${sky[other.i].symbol} çakışıyor`);
        }
        for (const [k, rect] of rects.entries()) {
          assert.ok(!intersects(label, rect), `${mode}: ${sky[label.i].symbol} etiketi ${sky[row.buildings[k].i].symbol} binasına biniyor`);
        }
        const box = labelBox(spec.label, sky[label.i].symbol, spec);
        assert.equal(label.w, box.w);
      }
    }
    if (spec.label === "none") assert.equal(layout.rows.flatMap((r) => r.labels).length, 0);
    else assert.ok(layout.rows.flatMap((r) => r.labels).length > 0);
    /* Giriş ~1 saniye: gecikmeler sırayla artıyor. */
    const delays = layout.rows.flatMap((r) => r.buildings.map((b) => b.delay));
    for (let j = 1; j < delays.length; j++) assert.ok(delays[j] >= delays[j - 1]);
  });
}

test("yerleşim farklı tohumlarda da çakışmasız", () => {
  for (const seed of [1, 2, 3, 11, 42, 99]) {
    const { sky, districts } = city(seed);
    for (const mode of ["narrow", "medium", "wide", "xwide"] as const) {
      const layout = skylineLayout({ stocks: sky, districts, mode });
      for (const row of layout.rows) {
        for (const [j, label] of row.labels.entries()) {
          for (const other of row.labels.slice(j + 1)) assert.ok(!intersects(label, other), `tohum ${seed}, ${mode}`);
        }
      }
    }
  }
});
