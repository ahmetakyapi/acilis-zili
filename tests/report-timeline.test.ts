import { test } from "node:test";
import assert from "node:assert/strict";
import { formatSpan, nextReportAt } from "../lib/ai-analysis-core";

const U = { min: "dk", hour: "sa", day: "gün" };
const at = (iso: string) => new Date(iso);

test("seans içinde teknik odak: son rapordan bir saat sonra", () => {
  const next = nextReportAt(at("2026-10-12T14:32:00Z"), "technical", { flowing: true, sessionEnd: at("2026-10-13T00:15:00Z"), nextOpen: at("2026-10-13T13:30:00Z") });
  assert.equal(next.at, "2026-10-12T15:32:00.000Z");
  assert.equal(next.reason, "gap");
  assert.equal(next.gapMinutes, 60);
});

test("piyasa kapalı ve son rapor seans bittikten sonra: öneri açılışa kayar", () => {
  // Cumartesi 10:00 UTC; cuma seansının verisi cuma 00:15 UTC'de tamamlanmış, açılış pazartesi 13:30 UTC.
  const next = nextReportAt(at("2026-10-10T10:00:00Z"), "technical", { flowing: false, sessionEnd: at("2026-10-10T00:15:00Z"), nextOpen: at("2026-10-12T13:30:00Z") });
  assert.equal(next.at, "2026-10-12T13:30:00.000Z");
  assert.equal(next.reason, "market-closed");
});

test("piyasa kapalı ama son rapor seans içinde yazılmış: kapanıştan beri fiyat değişti, bir saatlik kural", () => {
  const next = nextReportAt(at("2026-10-09T19:00:00Z"), "technical", { flowing: false, sessionEnd: at("2026-10-10T00:15:00Z"), nextOpen: at("2026-10-12T13:30:00Z") });
  assert.equal(next.at, "2026-10-09T20:00:00.000Z");
  assert.equal(next.reason, "gap");
});

test("hisse seçimi: bir gün; açılış daha erkense gün kuralı kazanır", () => {
  const next = nextReportAt(at("2026-10-12T02:00:00Z"), "selection", { flowing: false, sessionEnd: at("2026-10-10T00:15:00Z"), nextOpen: at("2026-10-12T13:30:00Z") });
  assert.equal(next.at, "2026-10-13T02:00:00.000Z");
  assert.equal(next.reason, "gap");
});

test("süre metni", () => {
  assert.equal(formatSpan(23 * 60_000, U), "23 dk");
  assert.equal(formatSpan(72 * 60_000, U), "1 sa 12 dk");
  assert.equal(formatSpan(60 * 60_000, U), "1 sa");
  assert.equal(formatSpan((2 * 1440 + 180) * 60_000, U), "2 gün 3 sa");
  assert.equal(formatSpan(10_000, U), "1 dk");
  assert.equal(formatSpan(-23 * 60_000, U), "23 dk");
});
