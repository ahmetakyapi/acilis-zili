import test from "node:test";
import assert from "node:assert/strict";

import { compareReleased, pickReleased, plainNumber, releaseNoteKey } from "../lib/release-notes-core";
import type { EconomicEventRow } from "../lib/schema";

/**
 * "Son Açıklanan Veriler" seçimi ve kıyas rozeti (lib/release-notes-core.ts).
 * Rozet ile Claude'a verilen yön aynı fonksiyondan geliyor; yön ekranda
 * GÖRÜNEN hassasiyetle hesaplanmalı, yoksa not "3,46 beklentinin üstünde,
 * beklenti 3,46" yazardı.
 */

function row(partial: Partial<EconomicEventRow> & { id: string; eventDate: string }): EconomicEventRow {
  return {
    eventTimeEt: "08:30",
    slug: partial.id,
    titleTr: partial.id,
    titleEn: partial.id,
    importance: "high",
    actual: "3.1",
    forecast: null,
    previous: null,
    unit: "%",
    fredSeriesId: null,
    source: "seed",
    updatedAt: new Date("2026-10-01T00:00:00Z"),
    ...partial,
  };
}

test("plainNumber yalnız düz sayıyı okur", () => {
  assert.equal(plainNumber("4.2"), 4.2);
  assert.equal(plainNumber(" -0.3 "), -0.3);
  assert.equal(plainNumber("250K"), null);
  assert.equal(plainNumber("4.25-4.50"), null);
  assert.equal(plainNumber(null), null);
});

test("compareReleased ekranın iki hanesiyle kıyaslar", () => {
  assert.equal(compareReleased("3.2", "3.1"), "above");
  assert.equal(compareReleased("3.0", "3.1"), "below");
  assert.equal(compareReleased("3.10", "3.1"), "inline");
  /* Ham sayıda üstünde, ekranda ikisi de 3,46. */
  assert.equal(compareReleased("3.461", "3.46"), "inline");
  assert.equal(compareReleased("-0.2", "0.1"), "below");
  assert.equal(compareReleased("250K", "240K"), null);
  assert.equal(compareReleased("3.1", null), null);
});

test("pickReleased: pencere, önem, açıklanmış; en yeni önce", () => {
  const rows = [
    row({ id: "old", eventDate: "2026-10-05" }),
    row({ id: "low", eventDate: "2026-10-16", importance: "low" }),
    row({ id: "pending", eventDate: "2026-10-16", actual: null }),
    row({ id: "dash", eventDate: "2026-10-16", actual: "—" }),
    row({ id: "future", eventDate: "2026-10-20" }),
    row({ id: "mid-early", eventDate: "2026-10-15", importance: "medium", eventTimeEt: "08:30" }),
    row({ id: "late", eventDate: "2026-10-15", eventTimeEt: "14:00" }),
    row({ id: "newest", eventDate: "2026-10-16", eventTimeEt: "10:00" }),
    row({ id: "a", eventDate: "2026-10-09" }),
    row({ id: "b", eventDate: "2026-10-08" }),
  ];
  const picked = pickReleased(rows, { from: "2026-10-08", today: "2026-10-18" });
  assert.deepEqual(
    picked.map((r) => r.id),
    ["newest", "late", "mid-early", "a"],
  );
  assert.equal(pickReleased(rows, { from: "2026-10-08", today: "2026-10-18", limit: 10 }).length, 5);
  assert.deepEqual(pickReleased([], { from: "2026-10-08", today: "2026-10-18" }), []);
});

test("pickReleased girdiyi bozmaz", () => {
  const rows = [row({ id: "x", eventDate: "2026-10-10" }), row({ id: "y", eventDate: "2026-10-12" })];
  pickReleased(rows, { from: "2026-10-01", today: "2026-10-18" });
  assert.deepEqual(rows.map((r) => r.id), ["x", "y"]);
});

test("releaseNoteKey revize edilen değerde değişir", () => {
  const base = { id: "e1", actual: "3.1", forecast: "3.0", previous: null };
  assert.notDeepEqual(releaseNoteKey(base), releaseNoteKey({ ...base, actual: "3.2" }));
  assert.deepEqual(releaseNoteKey(base), releaseNoteKey({ ...base, actual: " 3.1 " }));
});
