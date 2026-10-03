import assert from "node:assert/strict";
import test from "node:test";
import { getMarketStatus } from "../lib/market-hours";
import { barsCurrent, spliceRealtimeTail } from "../lib/providers";
import type { Bar } from "../lib/providers/types";

/* 1 Ekim 2026 perşembe, 12:00 ET (16:00 UTC) — ana seans açık. */
const NOON = new Date("2026-10-01T16:00:00Z");
const open = getMarketStatus(NOON);
const sec = (iso: string) => Math.floor(new Date(iso).getTime() / 1000);
const bar = (iso: string, close = 100): Bar => ({ time: sec(iso), open: close, high: close, low: close, close, volume: 1 });

const justNow = new Date(NOON.getTime() - 20_000);

test("a 1D series ending ~15 minutes ago is current during the session", () => {
  assert.equal(open.session, "regular");
  const bars = [bar("2026-10-01T13:30:00Z"), bar("2026-10-01T15:40:00Z")];
  assert.equal(barsCurrent(bars, justNow, "1D", open, 60, NOON), true);
});

test("a 1D series from the morning is stale at noon (the cache bug)", () => {
  const bars = [bar("2026-10-01T13:30:00Z"), bar("2026-10-01T14:10:00Z")];
  assert.equal(barsCurrent(bars, justNow, "1D", open, 60, NOON), false);
});

test("yesterday's series is stale once today's session has data", () => {
  assert.equal(barsCurrent([bar("2026-09-30T19:55:00Z")], justNow, "1D", open, 60, NOON), false);
});

test("an old response is stale in session even for daily ranges", () => {
  const bars = [bar("2026-10-01T04:00:00Z")];
  const old = new Date(NOON.getTime() - 2 * 3600_000);
  assert.equal(barsCurrent(bars, old, "1Y", open, 900, NOON), false);
  assert.equal(barsCurrent(bars, justNow, "1Y", open, 900, NOON), true);
});

test("on Saturday only a response fetched after Friday's session end counts", () => {
  const saturday = new Date("2026-10-03T16:00:00Z");
  const closed = getMarketStatus(saturday);
  const bars = [bar("2026-10-02T23:55:00Z")];
  // Cuma 21:00 ET'de çekilmiş seri doğru; cuma sabahı çekilmiş olan değil.
  assert.equal(barsCurrent(bars, new Date("2026-10-03T01:00:00Z"), "1D", closed, 3600, saturday), true);
  assert.equal(barsCurrent(bars, new Date("2026-10-02T11:00:00Z"), "1D", closed, 3600, saturday), false);
});

test("the IEX tail is appended only after the last SIP bar", () => {
  const sip = [bar("2026-10-01T15:35:00Z", 100), bar("2026-10-01T15:40:00Z", 101)];
  const iex = [bar("2026-10-01T15:40:00Z", 999), bar("2026-10-01T15:45:00Z", 102), bar("2026-10-01T15:55:00Z", 103)];
  const { bars, added } = spliceRealtimeTail(sip, iex, "1D", NOON);
  assert.equal(added, 2);
  assert.deepEqual(bars.map((b) => b.close), [100, 101, 102, 103]);
});

test("bars stamped in the future are dropped", () => {
  const sip = [bar("2026-10-01T15:40:00Z")];
  const iex = [bar("2026-10-01T16:05:00Z")];
  assert.equal(spliceRealtimeTail(sip, iex, "1D", NOON).added, 0);
});

test("on 1D a tail from a new day replaces yesterday's series", () => {
  const morning = new Date("2026-10-01T12:30:00Z");
  const sip = [bar("2026-09-30T19:55:00Z", 90)];
  const iex = [bar("2026-10-01T12:00:00Z", 95), bar("2026-10-01T12:20:00Z", 96)];
  const { bars } = spliceRealtimeTail(sip, iex, "1D", morning);
  assert.deepEqual(bars.map((b) => b.close), [95, 96]);
});
