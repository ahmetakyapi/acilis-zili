import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  LABEL_HEAD,
  LABEL_MAX_SHIFT,
  LABEL_TIERS,
  MIN_DISTRICT_SIZE,
  OTHER_DISTRICT,
  SKY_FLOOR,
  REFLECTION_SCALE,
  RISE_DURATION,
  RISE_SPREAD,
  RISE_START,
  SKY_MODES,
  WINDOW_MIN_H,
  WINDOW_MIN_W,
  buildingPath,
  cityInk,
  districtMoves,
  districtsOf,
  labelBox,
  labelPicks,
  partitionRows,
  pctChars,
  rowSplits,
  skyDomain,
  skylineLayout,
  skylineStocks,
  type SkyLayout,
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
        const box = labelBox(spec.label, sky[label.i].symbol, spec, sky[label.i].change);
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

/* ------------------------------------------------------------------
   "Silüet" turu (25 Ekim): sahne yolları, küresel etiket seçimi, giriş.
   ------------------------------------------------------------------ */

/** Yoldaki alt yol sayısı (`M` komutları). */
const subpaths = (d: string) => (d.match(/M/g) ?? []).length;

test("sahne yolları: her bina bir kez, yönüne göre; yansıma yalnız yükselenler", () => {
  const { sky, districts } = city(7, true);
  for (const mode of ["stripWide", "wide", "narrow"] as const) {
    const layout = skylineLayout({ stocks: sky, districts, mode });
    for (const row of layout.rows) {
      const ink = cityInk(row, sky);
      assert.deepEqual(ink.districts.map((d) => d.key), row.districts.map((d) => d.key));
      const count = (dir: 1 | -1 | 0) =>
        row.buildings.filter((b) => b.dir === dir).reduce((acc, b) => acc + subpaths(buildingPath(b)), 0);
      const sum = (key: "up" | "down" | "flat") => ink.districts.reduce((acc, d) => acc + subpaths(d[key]), 0);
      assert.equal(sum("up"), count(1), `${mode}: yükselenler`);
      assert.equal(sum("down"), count(-1), `${mode}: düşenler`);
      assert.equal(sum("flat"), count(0), `${mode}: değişmeyenler`);
      /* Düşen binanın yansıması YOK: göğe çıkıp "yükseldi" diye okunurdu. */
      assert.equal(subpaths(ink.reflection), count(1));
      /* Pencere yalnız büyük binada. */
      const big = row.buildings.filter((b) => b.dir !== 0 && b.w >= WINDOW_MIN_W && b.h >= WINDOW_MIN_H).length;
      assert.equal(ink.districts.reduce((acc, d) => acc + subpaths(d.windows), 0), big);
    }
  }
  assert.ok(REFLECTION_SCALE > 0 && REFLECTION_SCALE < 1);
});

test("kesik bina: yarık yolun içinde (iki alt yol), kesik olmayan tek", () => {
  const { sky, districts } = city();
  const layout = skylineLayout({ stocks: sky, districts, mode: "wide" });
  const all = layout.rows.flatMap((row) => row.buildings);
  const clipped = all.filter((b) => b.clip);
  assert.ok(clipped.length > 0);
  for (const b of clipped) assert.equal(subpaths(buildingPath(b)), 2);
  for (const b of all.filter((x) => !x.clip)) assert.equal(subpaths(buildingPath(b)), 1);
});

test("etiketler sahne genelinde seçiliyor: en büyükler ve uçlar, sıra sayısından bağımsız", () => {
  const { sky, districts } = city(7, true);
  for (const mode of ["stripNarrow", "narrow", "medium", "stripWide", "xwide"] as const) {
    const spec = SKY_MODES[mode];
    const layout = skylineLayout({ stocks: sky, districts, mode });
    const shown = new Set(layout.rows.flatMap((row) => row.labels.map((label) => label.i)));
    const picks = labelPicks(sky, districts.flatMap((d) => d.members), spec.labelCaps, spec.labelExtremes);
    /* Yer kalmazsa sondakiler düşüyor; öncelik başı hiç düşmüyor. */
    for (const i of shown) assert.ok(picks.includes(i), `${mode}: ${sky[i].symbol} seçilmemişti`);
    for (const i of picks.slice(0, LABEL_HEAD)) assert.ok(shown.has(i), `${mode}: ${sky[i].symbol} düştü`);
    assert.ok(shown.size <= spec.labelCaps + spec.labelExtremes * 2);
  }
});

test("etiket punto ve karo ölçüsü: masaüstünde karo 28–32, metin okunur", () => {
  for (const mode of ["wide", "xwide", "stripWide", "stripXwide"] as const) {
    assert.ok(SKY_MODES[mode].logo >= 28 && SKY_MODES[mode].logo <= 32, mode);
  }
  /* Telefonda sahne ~0,85 ölçekte: 13 birim ≈ 11 piksel. */
  for (const mode of ["narrow", "stripNarrow"] as const) assert.ok(SKY_MODES[mode].font >= 13, mode);
});

test("giriş mahalle mahalle ve 1,2 saniyenin içinde", () => {
  const { sky, districts } = city();
  const layout = skylineLayout({ stocks: sky, districts, mode: "stripWide" });
  for (const row of layout.rows) {
    for (const b of row.buildings) {
      const span = row.districts.find((d) => d.key === sky[b.i].district)!;
      assert.equal(b.delay, span.delay);
    }
  }
  const last = Math.max(...layout.rows.flatMap((row) => row.districts.map((d) => d.delay)));
  assert.ok(Math.abs(last - (RISE_START + RISE_SPREAD)) < 1e-9);
  assert.ok(last + RISE_DURATION <= 1.2);
});

/* ------------------------------------------------------------------
   "Silüet: etiket" turu (25 Ekim): etiket binasının üstünde.
   ------------------------------------------------------------------ */

/**
 * Gerçek 23 Ekim 2026 Nasdaq 100'ü (canlı posterden: sembol, mahalle,
 * değişim, piyasa değeri). Sahibinin 1440 şikâyetinin günü: MU etiketi
 * binasından 95 birim, META/TSLA 143 birim uzaktaydı.
 */
function realDay(): { sky: SkyStock[]; districts: ReturnType<typeof districtsOf> } {
  const rows = JSON.parse(fs.readFileSync(new URL("./fixtures/ndx-2026-10-23.json", import.meta.url), "utf8")) as [
    string,
    string,
    number,
    number | null,
  ][];
  const sky = rows.map(([symbol, district, change, cap]) => ({ symbol, name: symbol, district, change, cap }));
  return { sky, districts: districtsOf(sky) };
}

/** Kalabalık gün: herkes ±%2–9 oynuyor, en büyükler teknolojide yan yana. */
function crowdedDay(seed: number) {
  const { sky } = city(seed, true);
  const rand = rng(seed * 31 + 5);
  const loud = sky.map((stock) => ({
    ...stock,
    change: Math.round((rand() < 0.5 ? -1 : 1) * (2 + rand() * 7) * 100) / 100,
  }));
  return { sky: loud, districts: districtsOf(loud) };
}

/**
 * Bir yerleşimin etiket sözleşmesi; en büyük kaymayı döndürüyor. `strict`:
 * öncelik başının hepsi etiketli (gerçek gün). Değilse başından biri ancak
 * GEOMETRİK zorunlulukla düşebilir: aynı sırada etiketli başka bir öncelik
 * başının ekseni, iki etiketin eşik içinde yan yana duramayacağı kadar yakın.
 */
function checkLabels(name: string, layout: SkyLayout, sky: readonly SkyStock[], picks: readonly number[], strict = true): number {
  let worst = 0;
  const shown = new Set<number>();
  for (const row of layout.rows) {
    for (const [j, label] of row.labels.entries()) {
      shown.add(label.i);
      const b = row.buildings.find((x) => x.i === label.i)!;
      const shift = Math.abs(label.x + label.w / 2 - (b.x + b.w / 2));
      worst = Math.max(worst, shift);
      assert.ok(shift <= LABEL_MAX_SHIFT + 1e-9, `${name}: ${sky[label.i].symbol} binasından ${shift.toFixed(1)} birim uzak`);
      /* Binanın ekseni etiketin içinden geçiyor. */
      assert.ok(b.x + b.w / 2 > label.x && b.x + b.w / 2 < label.x + label.w);
      assert.ok(label.tier >= 0 && label.tier < LABEL_TIERS);
      for (const other of row.labels.slice(j + 1)) {
        assert.ok(!intersects(label, other), `${name}: ${sky[label.i].symbol} ile ${sky[other.i].symbol} çakışıyor`);
      }
      if (label.leader) {
        /* Bağ dik, çatıdan etikete; başka etiketin içinden geçmiyor. */
        const { x1, y1, x2, y2 } = label.leader;
        assert.equal(x1, x2);
        assert.equal(y1, b.dir === -1 ? b.h : -b.h);
        assert.equal(y2, label.dir === 1 ? label.y + label.h : label.y);
        for (const other of row.labels) {
          if (other === label) continue;
          const crosses = x1 > other.x && x1 < other.x + other.w && Math.max(y1, y2) > other.y && Math.min(y1, y2) < other.y + other.h;
          assert.ok(!crosses, `${name}: ${sky[label.i].symbol} bağı ${sky[other.i].symbol} etiketinden geçiyor`);
        }
      } else {
        /* Bağsız etiket çatısına oturuyor ve ortalı. */
        assert.ok(shift < 0.5);
      }
    }
  }
  const head = picks.slice(0, LABEL_HEAD);
  const spec = SKY_MODES[layout.mode];
  for (const i of head) {
    if (shown.has(i)) continue;
    assert.ok(!strict, `${name}: öncelik başı ${sky[i].symbol} düştü`);
    const row = layout.rows.find((r) => r.buildings.some((b) => b.i === i))!;
    const axis = (j: number) => {
      const b = row.buildings.find((x) => x.i === j)!;
      return b.x + b.w / 2;
    };
    const w = labelBox(spec.label, sky[i].symbol, spec, sky[i].change).w;
    const rival = row.labels.find((l) => head.includes(l.i) && Math.abs(axis(l.i) - axis(i)) < w + 2 * LABEL_MAX_SHIFT);
    assert.ok(rival, `${name}: öncelik başı ${sky[i].symbol} zorunluluk olmadan düştü`);
  }
  return worst;
}

const LABELLED_MODES = MODES.filter((mode) => SKY_MODES[mode].label !== "none");

test("gerçek 23 Ekim: her etiket binasının üstünde (kayma ≤ eşik), çakışma yok, öncelik başı yerinde", () => {
  const { sky, districts } = realDay();
  assert.equal(sky.length, 100);
  for (const mode of LABELLED_MODES) {
    const spec = SKY_MODES[mode];
    const layout = skylineLayout({ stocks: sky, districts, mode });
    const picks = labelPicks(sky, districts.flatMap((d) => d.members), spec.labelCaps, spec.labelExtremes);
    checkLabels(`23 Ekim ${mode}`, layout, sky, picks);
  }
  /* Şikâyetin kendisi: 1440 şeritte (stripWide) Micron etiketi Micron'un üstünde. */
  const strip = skylineLayout({ stocks: sky, districts, mode: "stripWide" });
  const mu = sky.findIndex((stock) => stock.symbol === "MU");
  const row = strip.rows.find((r) => r.labels.some((label) => label.i === mu))!;
  const label = row.labels.find((l) => l.i === mu)!;
  const b = row.buildings.find((x) => x.i === mu)!;
  assert.ok(b.x + b.w / 2 >= label.x && b.x + b.w / 2 <= label.x + label.w);
});

test("kalabalık gün: kayma ≤ eşik her düzende ve tohumda; öncelik başı ancak geometrik zorunlulukla düşüyor", () => {
  for (const seed of [3, 7, 19, 42]) {
    const { sky, districts } = crowdedDay(seed);
    for (const mode of LABELLED_MODES) {
      const spec = SKY_MODES[mode];
      const layout = skylineLayout({ stocks: sky, districts, mode });
      const picks = labelPicks(sky, districts.flatMap((d) => d.members), spec.labelCaps, spec.labelExtremes);
      checkLabels(`kalabalık ${seed} ${mode}`, layout, sky, picks, false);
      /* Kutular kabın içinde ve binalara binmiyor. */
      for (const row of layout.rows) {
        for (const label of row.labels) {
          assert.ok(label.x >= 0 && label.x + label.w <= spec.width);
          for (const b of row.buildings) {
            const rect = { x: b.x, y: b.dir === 1 ? -b.h : b.dir === -1 ? 0 : -b.h / 2, w: b.w, h: b.h };
            assert.ok(!intersects(label, rect), `kalabalık ${seed} ${mode}: ${sky[label.i].symbol} binaya biniyor`);
          }
        }
      }
    }
  }
});

test("etiket kutusu bugünün yüzdesine göre: '+%2,31' yedi karakterlik kutudan dar", () => {
  assert.equal(pctChars(2.31), 6);
  assert.equal(pctChars(-10.25), 7);
  assert.equal(pctChars(9.996), 7);
  assert.equal(pctChars(0), 6);
  assert.equal(pctChars(), 7);
  const spec = SKY_MODES.wide;
  assert.ok(labelBox("full", "MU", spec, 2.31).w < labelBox("full", "MU", spec).w);
  /* Uzun sembol yüzdeden genişse sembol belirliyor. */
  assert.equal(labelBox("full", "GOOGLXX", spec, 1).w, labelBox("full", "GOOGLXX", spec).w);
});
