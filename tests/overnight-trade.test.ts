import assert from "node:assert/strict";
import test from "node:test";
import { isOvernightTrade, onlyLastTradingDay } from "../lib/providers/alpaca";

/* Gece seansı işlemi fiyat sayılmıyor — gerekçe `isOvernightTrade`. */

test("cumartesi 00:59 ET (QQQ'nun ölçülen işlemi) gece seansı", () => {
  assert.equal(isOvernightTrade(new Date("2026-10-31T04:59:35Z")), true);
});

test("hafta içi 20:00 ET ve sonrası, 04:00 ET öncesi gece seansı", () => {
  assert.equal(isOvernightTrade(new Date("2026-10-29T00:30:00Z")), true); // Çar 20:30 ET
  assert.equal(isOvernightTrade(new Date("2026-10-29T07:00:00Z")), true); // Per 03:00 ET
});

test("ön seans, asıl seans ve akşam seansı gece değil", () => {
  assert.equal(isOvernightTrade(new Date("2026-10-29T09:00:00Z")), false); // 05:00 ET
  assert.equal(isOvernightTrade(new Date("2026-10-29T15:00:00Z")), false); // 11:00 ET
  assert.equal(isOvernightTrade(new Date("2026-10-29T23:30:00Z")), false); // 19:30 ET
  assert.equal(isOvernightTrade(null), false);
});


test("1G cumartesi gece barlarını değil cumanın seansını çizer", () => {
  const bar = (iso: string, close: number) => ({ time: Date.parse(iso) / 1000, open: close, high: close, low: close, close, volume: 1 });
  const bars = [
    bar("2026-10-30T19:55:00Z", 204.6), // Cum 15:55 ET — seans
    bar("2026-10-30T23:00:00Z", 205.1), // Cum 19:00 ET — akşam seansı
    bar("2026-10-31T04:00:00Z", 208.2), // Cmt 00:00 ET — gece
    bar("2026-10-31T04:50:00Z", 209.3), // Cmt 00:50 ET — gece
  ];
  const day = onlyLastTradingDay(bars);
  assert.deepEqual(day.map((b) => b.close), [204.6, 205.1]);
});
