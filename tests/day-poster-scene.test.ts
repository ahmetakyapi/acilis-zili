import test from "node:test";
import assert from "node:assert/strict";
import {
  ENTRY,
  SWARM_FLOOR,
  SWARM_MODES,
  entryTiming,
  fitSwarm,
  noteDelay,
  packRow,
  placeNotes,
  swarmClipped,
  posterActs,
  sceneStocks,
  sizeKey,
  sizeKeyRow,
  swarmDomain,
  swarmExtremes,
  swarmLayout,
  swarmRadius,
  swarmSvg,
  swarmX,
  type SceneStock,
} from "../lib/day-poster-scene";

/**
 * Günün Posteri'nin sahnesi — her hisse bir nokta, sektör sektör. Testler
 * sahnenin sözünü tutuyor: x yalnız değişimden gelir ve yığma onu hiç
 * oynatmaz, noktalar üst üste binmez, eksenin dışındaki hisse silinmez
 * (kenarda, işaretli), aynı veri aynı şekli verir.
 */

const stock = (symbol: string, sector: string, change: number, cap: number | null = 1e10): SceneStock => ({
  symbol,
  name: symbol,
  sector,
  change,
  cap,
});

/** Bir sektöre `n` hisse, değişimleri −1…+1 arasında yayılmış. */
function crowd(sector: string, n: number, offset = 0): SceneStock[] {
  return Array.from({ length: n }, (_, k) => stock(`${sector}${k}`, sector, offset + ((k % 21) - 10) / 10, 1e9 * (1 + (k % 7))));
}

test("hisseler: sektör GICS'ten fona, piyasa değeri kapanıştan; sektörsüz hisse sayılıp dışarıda", () => {
  const { stocks, unplaced } = sceneStocks(
    [
      { symbol: "AAA", change: 1.234567, close: 10 },
      { symbol: "BBB", change: -2, close: 20 },
      { symbol: "CCC", change: 0.5, close: 5 },
    ],
    [
      { symbol: "AAA", name: "Aaa", sector: "Energy" },
      { symbol: "BBB", name: "Bbb", sector: "Information Technology" },
      { symbol: "CCC", name: "Ccc" },
    ],
    (_symbol, close) => close * 1_234_567,
  );
  assert.equal(unplaced, 1);
  assert.deepEqual(
    stocks.map((s) => [s.symbol, s.sector, s.change, s.cap]),
    [
      ["AAA", "XLE", 1.2346, 12_300_000],
      ["BBB", "XLK", -2, 24_700_000],
    ],
  );
});

test("eksen: taban ±%1, okunur adım, sıfır her zaman içeride; uçtaki %1 dışarıda", () => {
  const calm = swarmDomain([0.1, -0.2, 0.3]);
  assert.ok(calm.lo <= -SWARM_FLOOR && calm.hi >= SWARM_FLOOR, "sakin gün tabana yayılıyor");
  assert.ok(calm.ticks.includes(0));
  // 200 hisse ±2 içinde, iki uç hisse +25 ve −30: eksen onlara göre kurulmuyor.
  const changes = [...Array.from({ length: 200 }, (_, k) => (k / 199) * 4 - 2), 25, -30];
  const d = swarmDomain(changes);
  assert.ok(d.hi < 10 && d.lo > -10, `eksen ${d.lo}…${d.hi}`);
  assert.ok(d.ticks.length <= 7);
  for (const tick of d.ticks) assert.equal(Math.round(tick / d.step) * d.step, tick);
  // Dışarıda kalan hisse kenarda ve işaretli.
  const mode = SWARM_MODES.wide;
  assert.deepEqual(swarmX(25, d, mode), { x: swarmX(d.hi, d, mode).x, clip: 1 });
  assert.equal(swarmX(-30, d, mode).clip, -1);
  assert.equal(swarmX(0, d, mode).clip, 0);
});

test("boy: alan piyasa değeriyle orantılı, taban ve tavan; anahtar yuvarlanmış değerden", () => {
  const mode = SWARM_MODES.wide;
  assert.equal(swarmRadius(4e12, 4e12, mode), mode.rMax);
  assert.ok(Math.abs(swarmRadius(1e12, 4e12, mode) - mode.rMax / 2) < 1e-9, "dörtte bir değer, yarı yarıçap");
  assert.equal(swarmRadius(1e6, 4e12, mode), mode.rMin);
  assert.equal(swarmRadius(null, 4e12, mode), mode.rMin);
  const key = sizeKey(4.6e12, mode);
  assert.deepEqual(
    key.map((k) => k.cap),
    [5e12, 1e12, 3e11],
  );
  assert.equal(key[0].r, mode.rMax, "anahtarın ilk dairesi tavanda");
  const row = sizeKeyRow(4.6e12, mode, (cap) => `${cap / 1e9}`, 7);
  for (let k = 1; k < row.length; k++) {
    assert.ok(row[k].cx - row[k].r > row[k - 1].tx, "daire bir önceki künyeden sonra");
  }
});

test("yığma: x korunur, hiçbir çift çakışmaz, en büyük nokta sıfır hattında, deterministik", () => {
  const items = Array.from({ length: 80 }, (_, k) => ({ x: 200 + ((k * 37) % 60), r: k === 13 ? 12 : 2 + (k % 4) }));
  const gap = 0.8;
  const ys = packRow(items, gap);
  assert.equal(ys.length, items.length);
  assert.equal(ys[13], 0, "en büyük nokta ilk yerleşiyor, merkezde");
  for (let a = 0; a < items.length; a++) {
    for (let b = a + 1; b < items.length; b++) {
      const d = Math.hypot(items[a].x - items[b].x, ys[a] - ys[b]);
      assert.ok(d >= items[a].r + items[b].r + gap - 1e-6, `çakışma ${a}-${b}`);
    }
  }
  assert.deepEqual(packRow(items, gap), ys, "aynı veri aynı şekil");
  // Yığın iki yana dengeli: üst ve alt yarı kabaca eşit.
  const up = ys.filter((y) => y < 0).length;
  const down = ys.filter((y) => y > 0).length;
  assert.ok(Math.abs(up - down) <= items.length * 0.2, `üst ${up}, alt ${down}`);
});

test("yerleşim: satırlar sırayla, x'ler eksenden, sayımlar ve fonun işareti; boy veriden", () => {
  const stocks = [...crowd("XLK", 60), ...crowd("XLE", 12, 1.5), stock("ZERO", "XLE", 0)];
  const domain = swarmDomain(stocks.map((s) => s.change));
  const layout = swarmLayout({
    stocks,
    sectorOrder: ["XLE", "XLK"],
    fundChange: (sector) => (sector === "XLE" ? 1.5 : null),
    mode: "wide",
    domain,
  });
  assert.deepEqual(
    layout.rows.map((r) => r.sector),
    ["XLE", "XLK"],
  );
  assert.equal(layout.rows[1].top, layout.rows[0].height, "satırlar üst üste");
  assert.equal(layout.height, layout.rows[0].height + layout.rows[1].height);
  assert.equal(layout.rows[0].dots.length, 13);
  assert.equal(layout.rows[0].advancing + layout.rows[0].declining, 12, "sıfır ne yükselen ne düşen");
  assert.equal(layout.rows[1].fundX, null);
  assert.equal(layout.rows[0].fundX, swarmX(1.5, domain, SWARM_MODES.wide).x);
  for (const row of layout.rows) {
    for (const dot of row.dots) {
      assert.equal(dot.x, swarmX(stocks[dot.i].change, domain, SWARM_MODES.wide).x, "x yalnız değişimden");
      assert.ok(dot.y - dot.r >= 0 && dot.y + dot.r <= row.height, "nokta satırın içinde");
    }
  }
  assert.ok(layout.rows[1].height > layout.rows[0].height, "kalabalık sektör daha yüksek");
});

test("uç hisseler: üçer tane, yalnız gerçekten yükselen/düşen; ölçek dışındakilerin hepsi", () => {
  const stocks = [stock("A", "XLK", 5), stock("B", "XLK", 4), stock("C", "XLK", 3), stock("D", "XLK", 2), stock("E", "XLK", -1)];
  assert.deepEqual(swarmExtremes(stocks), { up: [0, 1, 2], down: [4] });
  assert.deepEqual(swarmExtremes([stock("F", "XLK", -1)]).up, [], "yükselen yoksa yükselen etiketi de yok");
  assert.deepEqual(swarmClipped(stocks, { lo: -2, hi: 3.5, step: 1, ticks: [] }), [0, 1]);
});

test("etiketler: hiçbir noktayı ve birbirini örtmez; aynı x'teki halkalar kat kat", () => {
  const mode = SWARM_MODES.wide;
  const dots = [
    { i: 0, x: 400, y: 0, r: 3 },
    { i: 1, x: 420, y: -10, r: 6 },
    { i: 2, x: 782, y: 4, r: 3 },
    { i: 3, x: 782, y: -3, r: 3 },
    { i: 4, x: 782, y: -10, r: 3 },
    { i: 5, x: 5, y: 0, r: 3 },
  ];
  const notes = placeNotes(dots.filter((d) => d.i !== 1), mode, dots);
  const by = new Map(notes.map((n) => [n.i, n]));
  assert.equal(notes.length, 5, "her etiketli nokta etiketli");
  // Etiketin enindeki en yüksek nokta (i=1, tepe -16) etiketin altında kalıyor.
  assert.ok(by.get(0)!.labelY <= -16);
  // Kenardaki üç halka: üç kat, en alttaki etiket en alttaki halkanın.
  const edge = [2, 3, 4].map((i) => by.get(i)!.labelY);
  assert.ok(edge.every((y) => y <= -13), "hiçbir halkanın üstüne binmiyor");
  assert.ok(edge[0] > edge[1] && edge[1] > edge[2]);
  assert.ok(edge[0] - edge[1] >= mode.labelH - 1e-9 && edge[1] - edge[2] >= mode.labelH - 1e-9);
  assert.equal(by.get(2)?.align, "end");
  assert.equal(by.get(5)?.align, "start");

  // Etiketli satır, etiketin payı kadar açılıyor.
  const sample = [stock("A", "XLK", 5), stock("E", "XLK", -1)];
  const plain = swarmLayout({ stocks: sample, sectorOrder: ["XLK"], mode: "wide", domain: swarmDomain([5, -1]) });
  const noted = swarmLayout({ stocks: sample, sectorOrder: ["XLK"], mode: "wide", domain: swarmDomain([5, -1]), notes: [0] });
  assert.ok(noted.rows[0].height >= plain.rows[0].height + mode.labelH - mode.minHalf);
  assert.ok(noted.rows[0].notes[0].labelY - mode.labelH >= 0, "etiket satırın içinde");
});

test("sığdırma: kutuya sığana kadar yarıçap küçülür, x'ler oynamaz", () => {
  const stocks = crowd("XLK", 120);
  const args = { stocks, sectorOrder: ["XLK"], mode: "og" as const, domain: swarmDomain(stocks.map((s) => s.change)) };
  const full = swarmLayout(args);
  const fit = fitSwarm(args, full.height * 0.6);
  assert.ok(fit.height < full.height);
  assert.deepEqual(
    fit.rows[0].dots.map((d) => d.x),
    full.rows[0].dots.map((d) => d.x),
  );
});

test("perdeler: sıra sabit, verisi olmayan perde yok", () => {
  assert.deepEqual(posterActs({ breadth: true, stocks: 500, indices: 4 }), ["breadth", "sectors", "extremes", "indices"]);
  assert.deepEqual(posterActs({ breadth: false, stocks: 0, indices: 4 }), ["indices"]);
});

test("giriş: uzağa giden daha uzun, toplam kısa; etiketler noktalardan sonra", () => {
  const near = entryTiming({ i: 1, x: 410 }, 400, 400);
  const far = entryTiming({ i: 1, x: 800 }, 400, 400);
  assert.ok(far.duration > near.duration);
  assert.equal(far.duration, ENTRY.base + ENTRY.travel);
  const late = entryTiming({ i: 7, x: 800 }, 400, 400, 99);
  assert.ok(late.delay + late.duration <= 1.6, "en geç satırın en uzak noktası 1,6 sn içinde");
  const row = { dots: [{ i: 0, x: 0, y: 0, r: 1, clip: 0 as const }, { i: 1, x: 800, y: 0, r: 1, clip: 0 as const }] };
  const end = Math.max(...row.dots.map((d) => {
    const t = entryTiming(d, 400, 400);
    return t.delay + t.duration;
  }));
  assert.ok(noteDelay(row, 400, 400) > end);
});

test("minyatür: geçerli SVG, her hisseye bir daire, renk yönden", () => {
  const stocks = [stock("A", "XLK", 2), stock("B", "XLK", -2), stock("C", "XLE", 0)];
  const layout = swarmLayout({ stocks, sectorOrder: ["XLK", "XLE"], mode: "mini", domain: swarmDomain([2, -2, 0]) });
  const svg = swarmSvg(layout, stocks, { up: "#0a0", down: "#a00", flat: "#888", zero: "#000", lane: "#eee" });
  assert.match(svg, /^<svg xmlns="http:\/\/www.w3.org\/2000\/svg" viewBox="0 0 320 /);
  assert.equal((svg.match(/<circle /g) ?? []).length, 3);
  assert.match(svg, /<g fill="#0a0"><circle /);
  assert.match(svg, /<g fill="#a00"><circle /);
  assert.match(svg, /<g fill="#888"><circle /);
});
