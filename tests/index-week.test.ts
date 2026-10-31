import test from "node:test";
import assert from "node:assert/strict";
import { weekLine } from "../lib/index-week";

/** Endeks kartının yedek çizgisi — son beş seansın kapanışları (lib/index-week.ts). */

/* Alpaca günlük barı ET gece yarısında damgalanır (04:00Z yazın). */
const day = (date: string, value: number) => ({ time: Date.parse(`${date}T04:00:00Z`) / 1000, value });
const WEEK = [
  day("2026-10-22", 100),
  day("2026-10-23", 101),
  day("2026-10-26", 99),
  day("2026-10-27", 102),
  day("2026-10-28", 103),
  day("2026-10-29", 104),
  day("2026-10-30", 110),
];

test("son altı kapanış, beş seansın hareketi", () => {
  const line = weekLine(WEEK, "2026-10-30T19:59:00Z");
  assert.ok(line);
  assert.deepEqual(line.points.map((point) => point.value), [101, 99, 102, 103, 104, 110]);
  assert.ok(Math.abs(line.changePct - (110 / 101 - 1) * 100) < 1e-9);
});

test("son bar kotasyonun işlem gününe ait değilse çizgi yok", () => {
  // Kotasyon pazartesinin ön seansından, bar serisi cumada bitiyor.
  assert.equal(weekLine(WEEK, "2026-11-02T09:05:00Z"), null);
  // Kotasyon önbellekten, bir gün eski.
  assert.equal(weekLine(WEEK, "2026-10-29T19:59:00Z"), null);
});

test("ET günü UTC gününden ayrıldığında da aynı gün sayılır", () => {
  // 30 Ekim 20:30 ET = 31 Ekim 00:30Z: kapanış sonrası işlem hâlâ cuma.
  assert.ok(weekLine(WEEK, "2026-10-31T00:30:00Z"));
});

test("eksik veri ya da işlem zamanı yoksa çizgi yok", () => {
  assert.equal(weekLine(WEEK, null), null);
  assert.equal(weekLine(WEEK.slice(-4), "2026-10-30T19:59:00Z"), null);
  assert.equal(weekLine([], "2026-10-30T19:59:00Z"), null);
});
