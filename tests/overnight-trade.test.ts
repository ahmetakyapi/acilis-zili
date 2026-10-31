import assert from "node:assert/strict";
import test from "node:test";
import { isOvernightTrade } from "../lib/providers/alpaca";

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
