import test from "node:test";
import assert from "node:assert/strict";
import { checkChartBlock } from "../lib/daily-chart";
import { boardKeys, boardTiles, mosaicCells, ringGradient, ringSlices } from "../lib/daily-chart-board";
import { divergingScale } from "../lib/daily-chart-figure";

/* 23 Ekim'in canlı kaydının şekli, rutinin yazdığı sırayla DEĞİL (sıralamayı
   pano garanti ediyor mu?). */
const SECTORS = `::: bar Sektör Fonları, Günlük Değişim %, 23 Ekim
Teknoloji | +0,49
Enerji | +2,60
Gayrimenkul | +0,12
Kamu Hizmetleri | -0,72
Hammadde | -0,74
Sağlık | -1,11
Sanayi | -1,27
Finans | -1,32
İsteğe Bağlı Tüketim | -1,66
İletişim Hizmetleri | -1,78
Temel Tüketim | -1,92
:::`;

function block(md: string, locale = "tr") {
  const check = checkChartBlock(md, locale);
  assert.ok(check.ok, check.ok ? "" : check.reason);
  return check.block;
}

function bars(md: string) {
  const b = block(md);
  assert.equal(b.kind, "bars");
  if (b.kind !== "bars") throw new Error("bar bekleniyordu");
  return b;
}

test("boardTiles: yüksekten düşüğe, uçlar işaretli, fon ve yön doğru", () => {
  const { tiles, signed, scale } = boardTiles(bars(SECTORS));
  assert.equal(signed, true);
  assert.deepEqual(
    tiles.map((tile) => tile.name).slice(0, 3),
    ["Enerji", "Teknoloji", "Gayrimenkul"],
  );
  assert.equal(tiles[0].rank, "top");
  assert.equal(tiles.at(-1)?.rank, "bottom");
  assert.equal(tiles.filter((tile) => tile.rank !== null).length, 2);
  assert.equal(tiles[0].fund, "XLE");
  assert.equal(tiles.at(-1)?.fund, "XLP");
  assert.equal(tiles[0].dir, "up");
  assert.equal(tiles.at(-1)?.dir, "down");
  /* Ölçek sayfanın eski grafiğiyle ve paylaşım görseliyle aynı. */
  assert.deepEqual(scale, divergingScale(tiles.map((tile) => tile.value)));
  /* Bloktaki yazılış olduğu gibi taşınır. */
  assert.equal(tiles[0].display, "+2,60");
});

test("boardTiles: eksi çubuk sıfırın solunda biter, artı sağında başlar", () => {
  const { tiles, scale } = boardTiles(bars(SECTORS));
  assert.ok(scale);
  const top = tiles[0].bar!;
  const bottom = tiles.at(-1)!.bar!;
  assert.ok(Math.abs(top.start - scale.zero) < 1e-9);
  assert.ok(Math.abs(bottom.start + bottom.size - scale.zero) < 1e-9);
  assert.ok(Math.abs(top.start + top.size - 100) < 1e-9);
  assert.ok(Math.abs(bottom.start) < 1e-9);
});

test("boardTiles: eşit değerde blok sırası korunur (kararlı)", () => {
  const { tiles } = boardTiles(bars("::: bar Test\nA | +1\nB | +1\nC | -1\n:::"));
  assert.deepEqual(tiles.map((tile) => tile.name), ["A", "B", "C"]);
});

test("boardTiles: nötr blok yönsüz, çubuk soldan grubun en büyüğüne göre", () => {
  const { tiles, signed, scale } = boardTiles(bars("::: bar notr Hacim\nA | 10\nB | 40\nC | 20\n:::"));
  assert.equal(signed, false);
  assert.equal(scale, null);
  assert.deepEqual(tiles.map((tile) => tile.name), ["B", "C", "A"]);
  assert.ok(tiles.every((tile) => tile.dir === "flat"));
  assert.deepEqual(tiles[0].bar, { start: 0, size: 100 });
  assert.deepEqual(tiles[2].bar, { start: 0, size: 25 });
});

test("boardKeys: işaretli blokta en güçlü, en zayıf ve sayım", () => {
  const keys = boardKeys(block(SECTORS));
  assert.equal(keys.length, 3);
  const [top, bottom, count] = keys;
  assert.deepEqual(top, { kind: "extreme", role: "top", name: "Enerji", display: "+2,60", fund: "XLE", dir: "up" });
  assert.deepEqual(bottom, { kind: "extreme", role: "bottom", name: "Temel Tüketim", display: "-1,92", fund: "XLP", dir: "down" });
  assert.deepEqual(count, { kind: "count", up: 3, down: 8, flat: 0, total: 11 });
});

test("boardKeys: pay en büyük dilimi, oncesi künyesiz", () => {
  const share = boardKeys(block("::: pay Pay\nA | %20\nB | %50\nC | %30\n:::"));
  assert.equal(share.length, 1);
  assert.equal(share[0].kind === "extreme" && share[0].name, "B");
  assert.deepEqual(boardKeys(block("::: oncesi SPY\n660,12 | 22 Eylül\n671,30 | 23 Ekim\n:::")), []);
});

test("ringSlices: büyükten küçüğe, toplam 100, beşinci dilim 'diğer' tonunda", () => {
  const slices = ringSlices([
    { name: "A", value: 10, display: "10" },
    { name: "B", value: 30, display: "30" },
    { name: "C", value: 20, display: "20" },
    { name: "D", value: 15, display: "15" },
    { name: "E", value: 25, display: "25" },
  ]);
  assert.deepEqual(slices.map((slice) => slice.name), ["B", "E", "C", "D", "A"]);
  assert.ok(Math.abs(slices.reduce((sum, slice) => sum + slice.part, 0) - 100) < 1e-9);
  assert.deepEqual(slices.map((slice) => slice.tone), [1, 2, 3, 4, 0]);
  assert.equal(slices[1].start, 30);
  assert.match(ringGradient(slices), /^conic-gradient\(transparent 0deg/);
  assert.deepEqual(ringSlices([{ name: "A", value: 0, display: "0" }]), []);
});

test("mosaicCells: sıralı, ton yön, en büyük tam koyuluk", () => {
  const cells = mosaicCells(block(SECTORS));
  assert.equal(cells.length, 11);
  assert.equal(cells[0].dir, "up");
  assert.equal(cells[0].weight, 1);
  assert.equal(cells.at(-1)?.dir, "down");
  assert.ok(cells.every((cell) => cell.weight > 0 && cell.weight <= 1));
});
