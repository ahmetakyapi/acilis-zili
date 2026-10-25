import test from "node:test";
import assert from "node:assert/strict";
import { BIG_TILE_SCALE, capCell, CELL_MAX_SLOTS, tileScale, tileTierOf } from "../lib/earnings-horizon";

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
  const six = ["A", "B", "C", "D", "E", "F"];
  assert.deepEqual(capCell(six), { shown: six, more: 0 });
  assert.deepEqual(capCell([...six, "G"]), { shown: ["A", "B", "C", "D", "E"], more: 2 });
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
