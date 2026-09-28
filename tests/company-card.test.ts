import { test } from "node:test";
import assert from "node:assert/strict";
import { displayBasis, getMarketStatus, quoteBasis } from "@/lib/market-hours";

/* Şirket kartının fiyat künyesi (28 Eylül denetimi): "Seans İçi" yalnızca
   seans açıkken ve paket tazeyken. */

const shown = (now: string, tradedAt: string, stale = false) => {
  const status = getMarketStatus(new Date(now));
  return displayBasis(quoteBasis({ tradedAt: new Date(tradedAt) }, status), stale, status);
};

test("seans açık ve paket taze: session", () => {
  assert.equal(shown("2026-09-28T15:00:00Z", "2026-09-28T14:45:00Z"), "session");
});

test("seans kapandıktan sonra son olağan işlem: sessionClose", () => {
  assert.equal(shown("2026-09-28T21:30:00Z", "2026-09-28T19:59:00Z"), "sessionClose");
});

test("hafta sonu cumanın kapanışı: sessionClose, session değil", () => {
  assert.equal(shown("2026-09-26T15:00:00Z", "2026-09-25T19:59:00Z"), "sessionClose");
});

test("seans açık ama paket yaşlı: lastPrice", () => {
  assert.equal(shown("2026-09-28T16:30:00Z", "2026-09-28T15:10:00Z", true), "lastPrice");
});

test("önceki seansın işlemi yaştan bağımsız lastClose", () => {
  assert.equal(shown("2026-09-28T15:00:00Z", "2026-09-25T19:59:00Z"), "lastClose");
  assert.equal(shown("2026-09-28T15:00:00Z", "2026-09-25T19:59:00Z", true), "lastClose");
});

test("kapanış sonrası işlem after-hours olarak kalıyor", () => {
  assert.equal(shown("2026-09-28T21:30:00Z", "2026-09-28T21:10:00Z"), "after-hours");
});
