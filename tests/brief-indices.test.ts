import test from "node:test";
import assert from "node:assert/strict";
import { closeToClose, rangeCovering } from "../lib/brief-indices";
import type { Bar } from "../lib/providers/types";

const bar = (day: string, open: number, close: number): Bar =>
  ({ time: Date.parse(`${day}T04:00:00Z`) / 1000, open, high: Math.max(open, close), low: Math.min(open, close), close, volume: 1 }) as Bar;

/* 27–31 Temmuz örneğinin biçimi: pazartesi büyük boşlukla yukarı açılıp
   hafta içinde biraz geri veriyor. Açılıştan kapanışa eksi, önceki cumaya
   göre artı — doğru cevap artı. */
const bars = [
  bar("2026-07-23", 100, 100),
  bar("2026-07-24", 100, 100),
  bar("2026-07-27", 105, 104),
  bar("2026-07-28", 104, 103),
  bar("2026-07-31", 103, 102),
  bar("2026-08-03", 102, 101),
];

test("haftalık: önceki haftanın son kapanışından", () => {
  const move = closeToClose(bars, "2026-07-27", "2026-07-31");
  assert.equal(move.price, 102);
  assert.equal(move.price_date, "2026-07-31");
  assert.equal(move.prev_price, 100);
  assert.equal(move.prev_date, "2026-07-24");
  assert.ok(move.change_pct !== null && Math.abs(move.change_pct - 2) < 1e-9);
});

test("günlük: bir önceki işlem günü, hafta sonunu atlar", () => {
  const move = closeToClose(bars, "2026-07-27", "2026-07-27");
  assert.equal(move.prev_date, "2026-07-24");
  assert.ok(move.change_pct !== null && Math.abs(move.change_pct - 4) < 1e-9);
});

test("dönemde bar yoksa hepsi null", () => {
  const move = closeToClose(bars, "2026-07-29", "2026-07-30");
  assert.equal(move.price, null);
  assert.equal(move.change_pct, null);
});

test("önceki kapanış yoksa yüzde null, fiyat kalır", () => {
  const move = closeToClose(bars, "2026-07-01", "2026-07-23");
  assert.equal(move.price, 100);
  assert.equal(move.prev_price, null);
  assert.equal(move.change_pct, null);
});

test("aralık seçimi geriye bakışı kapsar", () => {
  assert.equal(rangeCovering("2026-07-27", "2026-10-13"), "3M");
  assert.equal(rangeCovering("2026-05-01", "2026-10-13"), "6M");
  assert.equal(rangeCovering("2025-12-01", "2026-10-13"), "1Y");
  assert.equal(rangeCovering("2025-01-01", "2026-10-13"), null);
});
