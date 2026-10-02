import assert from "node:assert/strict";
import test from "node:test";
import { orderPositions } from "../lib/portfolio";

const rows = [
  { id: "a", valueUsd: 100 },
  { id: "b", valueUsd: 500 },
  { id: "c", valueUsd: null },
  { id: "d", valueUsd: 300 },
];
const ids = (list: { id: string }[]) => list.map((row) => row.id).join("");

test("default order puts the largest position first and unpriced last", () => {
  assert.equal(ids(orderPositions(rows, null)), "bdac");
  assert.equal(ids(orderPositions(rows, [])), "bdac");
});

test("a saved order wins over value", () => {
  assert.equal(ids(orderPositions(rows, ["c", "a", "d", "b"])), "cadb");
});

test("positions added after the order go to the end, largest first", () => {
  assert.equal(ids(orderPositions(rows, ["a", "c"])), "acbd");
});

test("ids of deleted positions are skipped", () => {
  assert.equal(ids(orderPositions(rows, ["x", "d", "y", "a"])), "dabc");
});

test("the input array is not mutated", () => {
  const copy = [...rows];
  orderPositions(rows, null);
  assert.deepEqual(rows, copy);
});
