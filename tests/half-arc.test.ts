import { test } from "node:test";
import assert from "node:assert/strict";
import { halfArcPath, halfArcPoint } from "../lib/half-arc";

const ARC = { cx: 110, cy: 110, r: 92 };

test("pay 0 sol uç, 1 sağ uç, 0,5 tepe", () => {
  const left = halfArcPoint(ARC, 0);
  const top = halfArcPoint(ARC, 0.5);
  const right = halfArcPoint(ARC, 1);
  assert.equal(Math.round(left.x), 18);
  assert.equal(Math.round(left.y), 110);
  assert.equal(Math.round(top.x), 110);
  assert.equal(Math.round(top.y), 18);
  assert.equal(Math.round(right.x), 202);
  assert.equal(Math.round(right.y), 110);
});

test("sınır dışı pay kırpılır", () => {
  assert.deepEqual(halfArcPoint(ARC, -0.4), halfArcPoint(ARC, 0));
  assert.deepEqual(halfArcPoint(ARC, 1.7), halfArcPoint(ARC, 1));
});

test("yol saat yönünde, yarıçapla yazılır", () => {
  assert.equal(halfArcPath(ARC, 0, 1), "M 18.00 110.00 A 92 92 0 0 1 202.00 110.00");
});
