import assert from "node:assert/strict";
import test from "node:test";
import { getMarketStatus } from "../lib/market-hours";
import { loadSnapshotInputs } from "../lib/technical-data";
import { fail, ok, type Bar, type Quote } from "../lib/providers/types";

const status = getMarketStatus(new Date("2026-11-18T15:06:02Z"));
const bar: Bar = { time: 1, open: 1, high: 1, low: 1, close: 1, volume: 1 };
const quote = { symbol: "X" } as unknown as Quote;
const SYMBOLS = ["AAPL", "NVDA", "MSFT"];

type BarsCall = { symbols: string[]; options: unknown };

function harness(plan: {
  bars: ((symbols: string[]) => Record<string, Bar[]>)[];
  quotes: ReturnType<typeof ok<Record<string, Quote>>> | ReturnType<typeof fail>;
  live?: ReturnType<typeof ok<Record<string, Quote>>> | ReturnType<typeof fail>;
}) {
  const barsCalls: BarsCall[] = [];
  let liveCalls = 0;
  let slept = 0;
  const deps = {
    bars: (async (symbols: string[], _range: unknown, _status: unknown, options: unknown) => {
      barsCalls.push({ symbols, options });
      return plan.bars[barsCalls.length - 1](symbols);
    }) as never,
    quotes: (async () => plan.quotes) as never,
    liveQuotes: (async () => { liveCalls++; return plan.live ?? plan.quotes; }) as never,
    sleep: async () => { slept++; },
  };
  return { deps, barsCalls, get liveCalls() { return liveCalls; }, get slept() { return slept; } };
}

const allBars = (symbols: string[]) => Object.fromEntries(symbols.map((s) => [s, [bar]]));
const goodQuotes = ok({ AAPL: quote, NVDA: quote, MSFT: quote }, "alpaca");

test("all present: one round, no wait", async () => {
  const h = harness({ bars: [allBars], quotes: goodQuotes });
  const out = await loadSnapshotInputs(SYMBOLS, status, h.deps);
  assert.equal(h.barsCalls.length, 1);
  assert.equal(h.slept, 0);
  assert.equal(h.liveCalls, 0);
  assert.deepEqual(Object.keys(out.bars).sort(), [...SYMBOLS].sort());
});

test("the whole bar call failed (429): retried once, uncached, with the DB fallback still off", async () => {
  const h = harness({ bars: [() => ({}), allBars], quotes: goodQuotes });
  const out = await loadSnapshotInputs(SYMBOLS, status, h.deps);
  assert.equal(h.barsCalls.length, 2);
  assert.equal(h.slept, 1);
  assert.deepEqual(h.barsCalls[0].options, { allowCache: false });
  assert.deepEqual(h.barsCalls[1].options, { allowCache: false, fresh: true });
  assert.equal(Object.keys(out.bars).length, 3);
});

test("only the missing symbols are asked again", async () => {
  const h = harness({ bars: [() => ({ AAPL: [bar], NVDA: [] }), allBars], quotes: goodQuotes });
  const out = await loadSnapshotInputs(SYMBOLS, status, h.deps);
  assert.deepEqual(h.barsCalls[1].symbols, ["NVDA", "MSFT"]);
  assert.equal(out.bars.NVDA.length, 1);
});

test("a second failure leaves the symbol out — never more than two rounds", async () => {
  const h = harness({ bars: [() => ({ AAPL: [bar] }), () => ({})], quotes: goodQuotes });
  const out = await loadSnapshotInputs(SYMBOLS, status, h.deps);
  assert.equal(h.barsCalls.length, 2);
  assert.equal(out.bars.NVDA, undefined);
});

test("failed or stale quotes are retried uncached; a failed retry keeps the original", async () => {
  const fixed = harness({ bars: [allBars], quotes: fail("alpaca", "rate-limited", "429"), live: goodQuotes });
  const out = await loadSnapshotInputs(SYMBOLS, status, fixed.deps);
  assert.equal(fixed.liveCalls, 1);
  assert.equal(out.quotes.ok, true);
  assert.equal(fixed.barsCalls.length, 1);

  const stale = ok({ AAPL: quote }, "cache", { stale: true });
  const still = harness({ bars: [allBars], quotes: stale, live: fail("alpaca", "rate-limited", "429") });
  const kept = await loadSnapshotInputs(SYMBOLS, status, still.deps);
  assert.equal(still.liveCalls, 1);
  assert.equal(kept.quotes, stale);
});
