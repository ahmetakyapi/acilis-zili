import test from "node:test";
import assert from "node:assert/strict";
import { joblessClaimsEvents } from "../db/seed/economic-events";

/** Haftalık işsizlik başvuruları kuralı (db/seed/economic-events.ts, 20 Ekim). */

const dates = (from: string, weeks: number) => joblessClaimsEvents(from, weeks).map((event) => event.eventDate);

test("sıradan hafta perşembe", () => {
  assert.deepEqual(dates("2026-10-20", 2), ["2026-10-22", "2026-10-29"]);
});

test("Şükran Günü perşembesi çarşambaya kayar; slug da yeni günü taşır", () => {
  const [thanksgiving, next] = joblessClaimsEvents("2026-11-20", 2);
  assert.equal(thanksgiving!.eventDate, "2026-11-25");
  assert.equal(thanksgiving!.slug, "jobless-claims-2026-11-25");
  assert.equal(next!.eventDate, "2026-12-03");
});

test("perşembeye düşen sabit federal tatiller çarşambaya kayar", () => {
  assert.deepEqual(dates("2024-07-01", 1), ["2024-07-03"]); // 4 Temmuz
  assert.deepEqual(dates("2025-06-16", 1), ["2025-06-18"]); // 19 Haziran
  assert.deepEqual(dates("2025-12-22", 2), ["2025-12-24", "2025-12-31"]); // 25 Aralık, 1 Ocak
  assert.deepEqual(dates("2027-11-08", 3), ["2027-11-10", "2027-11-18", "2027-11-24"]); // 11 Kasım, Şükran Günü
});

test("kasımın 22'sinden önceki perşembe Şükran Günü değil", () => {
  assert.deepEqual(dates("2026-11-16", 1), ["2026-11-19"]);
});

test("bugün tatil perşembesinin çarşambasıysa olay bugün", () => {
  assert.deepEqual(dates("2026-11-25", 1), ["2026-11-25"]);
});
