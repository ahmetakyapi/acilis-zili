import test from "node:test";
import assert from "node:assert/strict";

import { PERIOD_SESSIONS, barDate, periodReturns } from "../lib/period-returns";
import type { Bar } from "../lib/providers/types";

/**
 * Sektör ve emtia panellerinin dönem getirileri.
 *
 * Değişmezler: dönem İŞLEM GÜNÜ sayısıyla geriye gidiyor; yeterli bar yoksa
 * sonuç null (daha kısa bir dönemin getirisi "3A" başlığı altında
 * yazılmaz); YBB tabanı önceki yılın SON kapanışı.
 */

const DAY_SECONDS = 86_400;
/** Günlük bar damgası 04:00Z (yaz saati, 00:00 ET). */
const ET_MIDNIGHT_OFFSET = 4 * 3600;

function barsFrom(start: string, closes: number[]): Bar[] {
  const base = Date.parse(`${start}T00:00:00Z`) / 1000 + ET_MIDNIGHT_OFFSET;
  return closes.map((close, index) => ({
    time: base + index * DAY_SECONDS,
    open: close,
    high: close,
    low: close,
    close,
    volume: 0,
  }));
}

test("barın günü ET gün başı damgasından okunur", () => {
  assert.equal(barDate({ time: Date.parse("2026-09-25T04:00:00Z") / 1000 }), "2026-09-25");
  assert.equal(barDate({ time: Date.parse("2026-01-05T05:00:00Z") / 1000 }), "2026-01-05");
});

test("dönemler işlem günü sayısıyla geriye gider", () => {
  const closes = Array.from({ length: 70 }, (_, index) => 100 + index);
  const result = periodReturns(barsFrom("2026-06-01", closes));
  const last = closes.at(-1)!;
  const expect = (sessions: number) => ((last - closes[closes.length - 1 - sessions]) / closes[closes.length - 1 - sessions]) * 100;
  assert.equal(result.w1, expect(PERIOD_SESSIONS.w1));
  assert.equal(result.m1, expect(PERIOD_SESSIONS.m1));
  assert.equal(result.m3, expect(PERIOD_SESSIONS.m3));
});

test("yeterli bar yoksa dönem null, eldeki en eski bar kullanılmaz", () => {
  const result = periodReturns(barsFrom("2026-09-01", Array.from({ length: 30 }, () => 50)));
  assert.equal(result.m3, null);
  assert.notEqual(result.m1, null);
});

test("YBB tabanı önceki yılın son kapanışı", () => {
  const bars = barsFrom("2025-12-29", [90, 95, 100, 104, 110]);
  // 29, 30, 31 Aralık 2025 → taban 31 Aralık (100); son kapanış 110.
  const result = periodReturns(bars);
  assert.equal(result.lastDate, "2026-01-02");
  assert.equal(result.ytd, 10);
});

test("önceki yıldan bar yoksa YBB null", () => {
  assert.equal(periodReturns(barsFrom("2026-01-02", [10, 11, 12])).ytd, null);
});

test("boş seri", () => {
  assert.deepEqual(periodReturns([]), { w1: null, m1: null, m3: null, ytd: null, lastDate: null });
});
