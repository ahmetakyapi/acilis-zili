import test from "node:test";
import assert from "node:assert/strict";
import {
  BIG_TILE_SCALE,
  capCell,
  CELL_MAX_SLOTS,
  horizonShape,
  shapeSlots,
  karneSlots,
  laneSlots,
  OTHER_MAX_SLOTS,
  peakDay,
  tileScale,
  tileTierOf,
} from "../lib/earnings-horizon";

test("karo boyu: kenar oranı yarıdan büyükse büyük (alan dörtte birden fazla)", () => {
  assert.equal(tileTierOf(1), "big");
  assert.equal(tileTierOf(BIG_TILE_SCALE), "big");
  assert.equal(tileTierOf(0.49), "base");
  assert.equal(tileTierOf(0), "base");
  // Haftanın en büyüğünün çeyreği tam sınırda.
  assert.equal(tileTierOf(tileScale(25, 100)), "big");
  assert.equal(tileTierOf(tileScale(24, 100)), "base");
});

test("hücre sığıyorsa tümü, sığmıyorsa son yuva +N", () => {
  const eight = ["A", "B", "C", "D", "E", "F", "G", "H"];
  assert.deepEqual(capCell(eight), { shown: eight, more: 0 });
  assert.deepEqual(capCell([...eight, "I"]), { shown: ["A", "B", "C", "D", "E", "F", "G"], more: 2 });
  assert.deepEqual(capCell([], CELL_MAX_SLOTS), { shown: [], more: 0 });
  assert.deepEqual(capCell(["A", "B", "C"], 2), { shown: ["A"], more: 2 });
  assert.deepEqual(capCell(["A"], 0), { shown: [], more: 1 });
});

test("+N çipiyle birlikte hücre yuva tavanını aşmaz", () => {
  for (let n = 0; n <= 20; n += 1) {
    const tiles = Array.from({ length: n }, (_, i) => i);
    const { shown, more } = capCell(tiles);
    assert.equal(shown.length + more, n);
    assert.ok(shown.length + (more > 0 ? 1 : 0) <= CELL_MAX_SLOTS);
  }
});

test("yuva tavanı: iki sıra dört karo, saati belirsiz satırı tek sıra", () => {
  assert.equal(laneSlots("bmo"), CELL_MAX_SLOTS);
  assert.equal(laneSlots("amc"), CELL_MAX_SLOTS);
  assert.equal(laneSlots("other"), OTHER_MAX_SLOTS);
  assert.deepEqual(capCell(["A", "B", "C", "D", "E"], laneSlots("other")), { shown: ["A", "B", "C"], more: 2 });
});

test("karne kareleri her zaman dört; eksikler başta veri yok", () => {
  assert.deepEqual(karneSlots([]), ["none", "none", "none", "none"]);
  assert.deepEqual(karneSlots(["beat", "miss"]), ["none", "none", "beat", "miss"]);
  assert.deepEqual(karneSlots(["miss", "beat", "beat", "miss"]), ["miss", "beat", "beat", "miss"]);
  // Dörtten fazlası gelirse en yeni dört (sağdaki).
  assert.deepEqual(karneSlots(["beat", "miss", "miss", "miss", "beat"]), ["miss", "miss", "miss", "beat"]);
});

test("haftanın zirvesi: en kalabalık gün, eşitlikte önce gelen, boşta yok", () => {
  assert.equal(
    peakDay([
      { date: "2026-10-26", total: 102 },
      { date: "2026-10-29", total: 356 },
      { date: "2026-10-28", total: 262 },
    ]),
    "2026-10-29",
  );
  assert.equal(peakDay([{ date: "2026-10-27", total: 5 }, { date: "2026-10-26", total: 5 }]), "2026-10-26");
  assert.equal(peakDay([{ date: "2026-10-26", total: 0 }]), null);
  assert.equal(peakDay([]), null);
});

test("haftanın şekli: sütunlar günün ihtiyacı kadar, karosuz gün sütun almaz", () => {
  const need = (bmo: number, amc: number, other = 0) => ({ bmo, amc, other });
  /* Dengeli hafta tek sıraya sığar. */
  assert.deepEqual(horizonShape([need(4, 3), need(3, 4), need(4, 4), need(2, 4), need(3, 3)]), { columns: [4, 4, 4, 4, 3], rows: 1 });
  /* Tek güne yığılma: kalabalık gün genişler, boş günler 0, tek karolu gün
     dar birimde iki sütun. */
  assert.deepEqual(horizonShape([need(14, 3), need(1, 0), need(0, 0), need(0, 1), need(0, 0)]), { columns: [14, 2, 0, 2, 0], rows: 1 });
  /* Seyrek hafta: birim geniş, tek sütun yeter. */
  assert.deepEqual(horizonShape([need(1, 0), need(0, 0), need(0, 2), need(0, 0), need(0, 0)]), { columns: [1, 0, 2, 0, 0], rows: 1 });
  /* Sezon zirvesi: tek sıra sığmaz, iki sıra. */
  assert.deepEqual(horizonShape([need(6, 6), need(5, 6), need(6, 4), need(6, 6), need(4, 5)]), { columns: [3, 3, 3, 3, 3], rows: 2 });
  /* İki sıra da sığmazsa bütçe orantılı bölünür, toplam bütçeyi aşmaz. */
  const crowded = horizonShape([need(12, 12), need(12, 10), need(12, 12), need(10, 12), need(12, 12)]);
  assert.equal(crowded.rows, 2);
  assert.equal(crowded.columns.reduce((a, b) => a + b, 0), 20);
  assert.ok(crowded.columns.every((value) => value >= 2));
  /* Yalnız saati belirsiz: satır tek sıra, sütun o kadar. */
  assert.deepEqual(horizonShape([need(0, 0, 3), need(0, 0), need(0, 0, 1), need(0, 0), need(0, 0)]), { columns: [3, 0, 1, 0, 0], rows: 1 });
  /* Tamamen boş hafta. */
  assert.deepEqual(horizonShape([need(0, 0), need(0, 0)]), { columns: [0, 0], rows: 1 });
  assert.equal(shapeSlots(4, 2, "amc"), 8);
  assert.equal(shapeSlots(4, 2, "other"), 4);
  assert.equal(shapeSlots(0, 1, "bmo"), 1);
});
