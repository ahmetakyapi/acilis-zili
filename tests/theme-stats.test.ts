import test from "node:test";
import assert from "node:assert/strict";

import { median, sameSessionMoves, themePhase, MIN_SESSION_ROWS } from "../lib/theme-stats";

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

/* 28 Eylül denetimi: yirmi üyeli temanın üç sabah işlemi "temanın
   medyanı" sayılmıyor — bu seansı anlatan üye yüzdesi bilinenlerin en az
   yarısı olmalı. */
test("bu seansı anlatan üye yarının altındaysa medyan yok", () => {
  const rows = [
    ...Array.from({ length: 3 }, () => ({ changePct: 1, basis: "pre-market" as const })),
    ...Array.from({ length: 17 }, () => ({ changePct: -1, basis: "lastClose" as const })),
  ];
  assert.equal(sameSessionMoves(rows), null);
});

test("tam yarı yeterli; kotasyonu hiç gelmeyen üye paydaya girmiyor", () => {
  const rows = [
    ...Array.from({ length: 4 }, (_, i) => ({ changePct: i, basis: "session" as const })),
    ...Array.from({ length: 4 }, () => ({ changePct: 9, basis: "lastClose" as const })),
    { changePct: null, basis: null },
    { changePct: null, basis: null },
  ];
  const set = sameSessionMoves(rows);
  assert.equal(set?.basis, "session");
  assert.deepEqual(set?.values, [0, 1, 2, 3]);
  assert.equal(median(set!.values), 1.5);
});

test("son kapanış kümesi yalnızca en yeni işlem gününden", () => {
  const set = sameSessionMoves([
    { changePct: 1, basis: "lastClose", tradedDay: "2026-09-25" },
    { changePct: 2, basis: "lastClose", tradedDay: "2026-09-25" },
    { changePct: -8, basis: "lastClose", tradedDay: "2026-09-23" },
    { changePct: 3, basis: "lastClose", tradedDay: "2026-09-25" },
  ]);
  assert.equal(set?.basis, "lastClose");
  assert.deepEqual(set?.values, [1, 2, 3]);
  assert.deepEqual(set?.included, [true, true, false, true]);
});

test("son kapanışta aynı günden üç üye yoksa medyan yok", () => {
  assert.equal(
    sameSessionMoves([
      { changePct: 1, basis: "lastClose", tradedDay: "2026-09-25" },
      { changePct: 2, basis: "lastClose", tradedDay: "2026-09-25" },
      { changePct: 3, basis: "lastClose", tradedDay: "2026-09-24" },
    ]),
    null,
  );
});

test("pencere: açılış öncesi 'Günün' değil", () => {
  assert.equal(themePhase("session", "pre-market"), "pre-market");
  assert.equal(themePhase("session", "regular"), "day");
  assert.equal(themePhase("session", "after-hours"), "day");
  /* Hafta sonu ve gece: yüzde seans gününe ait ama o an bir seans yok. */
  assert.equal(themePhase("session", "closed"), "lastClose");
  assert.equal(themePhase("lastClose", "pre-market"), "lastClose");
  assert.equal(themePhase(null, "regular"), null);
});
