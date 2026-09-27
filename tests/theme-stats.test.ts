import test from "node:test";
import assert from "node:assert/strict";

import { median, sameSessionMoves, MIN_SESSION_ROWS } from "../lib/theme-stats";

/**
 * Tema medyanı yalnızca aynı günün yüzdelerinden kurulur (gerekçe
 * `lib/theme-stats.ts` başında). Üç hâl, üç test; bir de medyanın kendisi.
 */

test("bu seansa ait yeterli üye varsa yalnızca onlar sayılır", () => {
  const set = sameSessionMoves([
    { changePct: 2, basis: "session" },
    { changePct: -1, basis: "pre-market" },
    { changePct: 5, basis: "lastClose" },
    { changePct: 1, basis: "session" },
    { changePct: null, basis: "session" },
  ]);
  assert.ok(set);
  assert.equal(set.basis, "session");
  assert.deepEqual(set.values, [2, -1, 1]);
  assert.deepEqual(set.included, [true, true, false, true, false]);
});

test("hiçbir üye bu seansta işlem görmediyse son kapanış kümesi", () => {
  const set = sameSessionMoves([
    { changePct: 2, basis: "lastClose" },
    { changePct: -1, basis: "lastClose" },
    { changePct: 3, basis: "lastClose" },
  ]);
  assert.equal(set?.basis, "lastClose");
  assert.deepEqual(set?.values, [2, -1, 3]);
});

test("karışık ve yetersiz hâlde medyan yok", () => {
  const rows = [
    { changePct: 2, basis: "session" as const },
    { changePct: -1, basis: "lastClose" as const },
    { changePct: 3, basis: "lastClose" as const },
  ];
  assert.ok(rows.filter((row) => row.basis === "session").length < MIN_SESSION_ROWS);
  assert.equal(sameSessionMoves(rows), null);
  assert.equal(sameSessionMoves([{ changePct: 1, basis: null }]), null);
});

test("medyan tek ve çift sayıda doğru", () => {
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([4, 1, 3, 2]), 2.5);
  assert.equal(median([]), null);
});
