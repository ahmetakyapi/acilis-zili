import test from "node:test";
import assert from "node:assert/strict";
import {
  BIG_TILE_SCALE,
  capCell,
  CELL_MAX_SLOTS,
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
  assert.deepEqual(capCell(["A", "B", "C"], laneSlots("other")), { shown: ["A"], more: 2 });
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
