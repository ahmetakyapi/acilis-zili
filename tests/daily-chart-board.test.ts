import test from "node:test";
import assert from "node:assert/strict";
import { checkChartBlock } from "../lib/daily-chart";
import { boardKeys, boardTiles, mosaicCells, percentDisplay, ringGradient, ringSlices, tileTiers } from "../lib/daily-chart-board";
import { divergingScale, memberSymbolOf } from "../lib/daily-chart-figure";
import { SIGN_GAP as GAP } from "../lib/utils";

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
  /* Bloktaki rakamlar olduğu gibi; etiket "%" taşıdığı için birimiyle. */
  assert.equal(tiles[0].display, `+${GAP}%2,60`);
  /* Karışık grafikte iki uç da vurgulu ve adı "en güçlü / en zayıf". */
  assert.equal(tiles[0].role, "strongest");
  assert.equal(tiles.at(-1)?.role, "weakest");
  assert.ok(tiles[0].emphasis && tiles.at(-1)?.emphasis);
});

/* 30 Ekim'in canlı kaydı: sekiz kalemin hepsi eksi ("En Çok Düşen
   Hisseler"). Künye "En Güçlü −10,77 Dell" diyordu (31 Ekim itirazı). */
const LOSERS = `::: bar En Çok Düşen Hisseler, Günlük Değişim %
Intel | -28,58
Sandisk | -13,47
Datadog | -11,50
Coherent | -11,34
Qualcomm | -11,12
Astera Labs | -10,93
Advanced Micro Devices | -10,88
Dell Technologies | -10,77
:::`;

test("boardTiles: hepsi eksi — en sert düşüş başta, yalnız o vurgulu, adlar yönle", () => {
  const { tiles, trend, percent } = boardTiles(bars(LOSERS));
  assert.equal(trend, "allDown");
  assert.equal(percent, true);
  assert.equal(tiles[0].name, "Intel");
  assert.equal(tiles[0].rank, "bottom");
  assert.equal(tiles[0].role, "mostDown");
  assert.equal(tiles[0].emphasis, true);
  assert.equal(tiles.at(-1)?.name, "Dell Technologies");
  assert.equal(tiles.at(-1)?.role, "leastDown");
  assert.equal(tiles.at(-1)?.emphasis, false);
  assert.ok(tiles.every((tile) => tile.role !== "strongest" && tile.role !== "weakest"));
  assert.equal(tiles[0].display, `−${GAP}%28,58`);
  /* Logo ve bağlantı için sembol, yalnız adın tek anlamlı eşleşmesinden. */
  assert.deepEqual(
    tiles.map((tile) => tile.symbol),
    ["INTC", "SNDK", "DDOG", "COHR", "QCOM", "ALAB", "AMD", "DELL"],
  );
});

test("boardKeys: hepsi eksi — en çok düşen, en az düşen, ortalama düşüş (sayım yok)", () => {
  const keys = boardKeys(block(LOSERS));
  assert.equal(keys.length, 3);
  const [lead, other, mean] = keys;
  assert.equal(lead.kind === "extreme" && lead.role, "mostDown");
  assert.equal(lead.kind === "extreme" && lead.name, "Intel");
  assert.equal(other.kind === "extreme" && other.role, "leastDown");
  assert.equal(other.kind === "extreme" && other.name, "Dell Technologies");
  assert.equal(mean.kind, "mean");
  if (mean.kind !== "mean") return;
  /* (28,58 + 13,47 + 11,50 + 11,34 + 11,12 + 10,93 + 10,88 + 10,77) / 8 */
  assert.ok(Math.abs(mean.value - -13.57375) < 1e-9);
  /* Bloğun ondalığıyla (iki hane), sitenin yüzde biçimiyle. */
  assert.equal(mean.display, `−${GAP}%13,57`);
  assert.equal(mean.trend, "allDown");
  assert.equal(mean.dir, "down");
  assert.ok(mean.bar && mean.bar.size > 0);
});

test("boardKeys: hepsi artı — en çok yükselen önce, İngilizcede birim sonda", () => {
  const md = "::: bar AI Infrastructure vs. Indexes, Daily Change %\nVertiv | +16.48\nNasdaq 100 | +0.60\nS&P 500 | +0.34\n:::";
  const keys = boardKeys(block(md, "en"), "en");
  const [lead, other, mean] = keys;
  assert.equal(lead.kind === "extreme" && lead.role, "mostUp");
  assert.equal(lead.kind === "extreme" && lead.display, `+${GAP}16.48%`);
  assert.equal(lead.kind === "extreme" && lead.symbol, "VRT");
  assert.equal(other.kind === "extreme" && other.role, "leastUp");
  /* Endeks adı bir üyenin adı değil: logo ya da bağlantı uydurulmaz. */
  assert.equal(other.kind === "extreme" && other.symbol, null);
  assert.equal(mean.kind, "mean");
});

test("boardKeys: birimi bilinmeyen tek yönlü blokta ortalama yok, sayım kalır", () => {
  const keys = boardKeys(block("::: bar Değişim\nA | -3\nB | -1\n:::"));
  assert.equal(keys.at(-1)?.kind, "count");
  const [lead] = keys;
  assert.equal(lead.kind === "extreme" && lead.display, "-3");
});

test("percentDisplay: rakam dokunulmaz, işaret sitenin biçimi, sıfır işaretsiz", () => {
  assert.equal(percentDisplay("-10,77", "tr"), `−${GAP}%10,77`);
  assert.equal(percentDisplay("+1.23", "en"), `+${GAP}1.23%`);
  assert.equal(percentDisplay("0,00", "tr"), "%0,00");
  assert.equal(percentDisplay("−%11,64", "tr"), "−%11,64");
  assert.equal(percentDisplay("$2.3B", "en"), "$2.3B");
});

test("tileTiers: kalem sayısına göre sütun, ölçek künyesi yalnız tek boşluğu doldurur", () => {
  /* 11 sektör: 6×2, 4×3, 3×4, 2×6 — künye hep son hücrede (eski hâl). */
  assert.deepEqual(tileTiers(11, true), [
    { cols: 2, legendInGrid: true },
    { cols: 3, legendInGrid: true },
    { cols: 4, legendInGrid: true },
    { cols: 6, legendInGrid: true },
  ]);
  /* 8 hisse: geniş kapta 4×2 (eskiden 6+2 ve yetim ölçek kartı). */
  const eight = tileTiers(8, true);
  assert.deepEqual(eight[3], { cols: 4, legendInGrid: false });
  assert.deepEqual(eight[2], { cols: 4, legendInGrid: false });
  assert.deepEqual(eight[1], { cols: 3, legendInGrid: true });
  /* Dört endeks tek satıra dizilmez (kartlar metin kolonuna gerilip boş
     kuleye dönüyordu): 2×2, künye altta. */
  assert.deepEqual(tileTiers(4, true)[2], { cols: 2, legendInGrid: false });
  assert.deepEqual(tileTiers(4, true)[3], { cols: 2, legendInGrid: false });
  /* İki kalem iki sütun; ölçeksiz blokta künye hiç ızgaraya girmez. */
  assert.deepEqual(tileTiers(2, false)[3], { cols: 2, legendInGrid: false });
  for (const count of [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]) {
    for (const tier of tileTiers(count, true)) {
      const cells = count + (tier.legendInGrid ? 1 : 0);
      assert.ok(tier.cols >= 1 && tier.cols <= 6);
      if (tier.legendInGrid) assert.equal(cells % tier.cols, 0, `${count} kalem, ${tier.cols} sütun`);
    }
  }
});

test("memberSymbolOf: yalnız tek anlamlı ad eşleşir, sektör ve endeks adı eşleşmez", () => {
  assert.equal(memberSymbolOf("Intel"), "INTC");
  assert.equal(memberSymbolOf("Coherent"), "COHR");
  assert.equal(memberSymbolOf("Coherent Corp."), "COHR");
  assert.equal(memberSymbolOf("Oracle"), "ORCL");
  assert.equal(memberSymbolOf("Flex"), "FLEX");
  assert.equal(memberSymbolOf("SanDisk"), "SNDK");
  assert.equal(memberSymbolOf("NVDA"), "NVDA");
  assert.equal(memberSymbolOf("Nasdaq 100"), null);
  assert.equal(memberSymbolOf("S&P 500"), null);
  assert.equal(memberSymbolOf("Dow Jones"), null);
  assert.equal(memberSymbolOf("Teknoloji"), null);
  assert.equal(memberSymbolOf("Uydurma Şirket"), null);
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
  assert.deepEqual(top, { kind: "extreme", role: "strongest", name: "Enerji", display: `+${GAP}%2,60`, fund: "XLE", symbol: null, dir: "up" });
  assert.deepEqual(bottom, { kind: "extreme", role: "weakest", name: "Temel Tüketim", display: `−${GAP}%1,92`, fund: "XLP", symbol: null, dir: "down" });
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
