import assert from "node:assert/strict";
import test from "node:test";
import { effectiveSplits, splitAdjustments, type SplitLot, type StockSplit } from "../lib/portfolio-splits";

/* Portföyde hisse bölünmesi düzeltmesi (lib/portfolio-splits.ts). */

const SNDK: StockSplit = { symbol: "SNDK", exDate: "2026-11-20", ratio: 8 };
const lot = (over: Partial<SplitLot>): SplitLot => ({
  id: "a",
  symbol: "SNDK",
  quantity: "14.83593213",
  costUsd: "1406.303953",
  boughtAt: "2026-08-04",
  createdDate: "2026-10-02",
  through: null,
  ...over,
});

test("bölünme öncesi girilmiş parti: adet çarpılır, maliyet bölünür, toplam aynı", () => {
  const [adj] = splitAdjustments([lot({})], [SNDK]);
  assert.ok(adj);
  assert.equal(adj.quantity, "118.68745704");
  assert.equal(adj.costUsd, "175.787994");
  assert.equal(adj.through, "2026-11-20");
  assert.equal(adj.fromQuantity, "14.83593213");
  assert.ok(Math.abs(Number(adj.quantity) * Number(adj.costUsd) - 14.83593213 * 1406.303953) < 0.01);
});

test("bölünmeden sonra alınan, sonra girilen ya da işaretlenen partiye dokunulmaz", () => {
  assert.deepEqual(splitAdjustments([lot({ boughtAt: "2026-11-20" })], [SNDK]), []);
  /* Eski tarihli ama bölünmeden sonra girilmiş: kurumun bölünmüş rakamı. */
  assert.deepEqual(splitAdjustments([lot({ createdDate: "2026-11-21" })], [SNDK]), []);
  /* Bölünme günü girilmiş: belirsiz, dokunma. */
  assert.deepEqual(splitAdjustments([lot({ createdDate: "2026-11-20" })], [SNDK]), []);
  /* Elle düzeltilmiş (defter işaretli). */
  assert.deepEqual(splitAdjustments([lot({ through: "2026-11-24" })], [SNDK]), []);
  /* Başka sembolün bölünmesi. */
  assert.deepEqual(splitAdjustments([lot({ symbol: "MU" })], [SNDK]), []);
});

test("iki bölünme sırayla, aynı gün çift kayıt tek sayılır, işaretten eskisi atlanır", () => {
  const splits: StockSplit[] = [
    { symbol: "X", exDate: "2026-06-01", ratio: 2 },
    { symbol: "X", exDate: "2026-09-01", ratio: 3 },
    { symbol: "X", exDate: "2026-09-01", ratio: 3 },
  ];
  const base = lot({ symbol: "X", quantity: "10", costUsd: "600", boughtAt: "2026-01-02", createdDate: "2026-01-02" });
  const [both] = splitAdjustments([base], splits);
  assert.equal(both!.quantity, "60.00000000");
  assert.equal(both!.costUsd, "100.000000");
  assert.deepEqual(both!.applied.map((s) => s.exDate), ["2026-06-01", "2026-09-01"]);
  const [late] = splitAdjustments([{ ...base, through: "2026-07-01" }], splits);
  assert.equal(late!.quantity, "30.00000000");
});

test("birleşme (reverse split) ve sıfıra yuvarlanan kırıntı", () => {
  const reverse: StockSplit = { symbol: "SHAZ", exDate: "2025-12-23", ratio: 1 / 50 };
  const [adj] = splitAdjustments([lot({ symbol: "SHAZ", quantity: "500", costUsd: "1", boughtAt: "2025-06-01", createdDate: "2025-06-01" })], [reverse]);
  assert.equal(adj!.quantity, "10.00000000");
  assert.equal(adj!.costUsd, "50.000000");
  assert.deepEqual(splitAdjustments([lot({ symbol: "SHAZ", quantity: "0.00000010", boughtAt: "2025-06-01", createdDate: "2025-06-01" })], [reverse]), []);
});

test("ex günü yalnız açılıştan sonra geçerli; oranı bozuk kayıt atılır", () => {
  assert.deepEqual(effectiveSplits([SNDK], "2026-11-20", 569), []);
  assert.deepEqual(effectiveSplits([SNDK], "2026-11-20", 570), [SNDK]);
  assert.deepEqual(effectiveSplits([SNDK], "2026-11-19", 900), []);
  assert.deepEqual(effectiveSplits([SNDK], "2026-11-21", 0), [SNDK]);
  assert.deepEqual(effectiveSplits([{ ...SNDK, ratio: 0 }, { ...SNDK, ratio: 1 }, { ...SNDK, ratio: Number.NaN }], "2026-12-01", 0), []);
});
