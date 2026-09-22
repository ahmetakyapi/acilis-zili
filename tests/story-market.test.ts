import { test } from "node:test";
import assert from "node:assert/strict";
import { lastStoryClose } from "../lib/story-market";
const bar = (date: string, close: number) => ({ time: Date.parse(`${date}T04:00:00Z`) / 1000, close });
const status = { etDate: "2026-09-21", etMinutes: 600, closeMinutes: 960, tradingToday: true };
test("an unfinished daily candle is not a last close", () => {
 assert.deepEqual(lastStoryClose([bar("2026-09-18", 100), bar("2026-09-21", 110)], status), { date: "2026-09-18", price: 100 });
});
test("weekend stories can show Friday's dated closing price", () => {
 assert.deepEqual(lastStoryClose([bar("2026-09-18", 100)], { ...status, etDate: "2026-09-19", tradingToday: false }), { date: "2026-09-18", price: 100 });
});
test("regular and early closes respect the delayed feed window", () => {
 const bars = [bar("2026-09-18", 100), bar("2026-09-21", 110)];
 for (const closeMinutes of [780, 960]) {
  assert.equal(lastStoryClose(bars, { ...status, closeMinutes, etMinutes: closeMinutes + 14 })?.price, 100);
  assert.equal(lastStoryClose(bars, { ...status, closeMinutes, etMinutes: closeMinutes + 15 })?.price, 110);
 }
});
test("invalid, future and absent closes do not produce fabricated values", () => {
 assert.equal(lastStoryClose(undefined, status), null);
 assert.equal(lastStoryClose([bar("2026-09-18", 0),bar("2026-09-22", 12),bar("2026-09-17", NaN)], status), null);
});
