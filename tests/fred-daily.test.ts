import test from "node:test";
import assert from "node:assert/strict";
import { getSeries, DAILY_MARKET_SERIES, MACRO_SERIES } from "../lib/providers/fred";

test("daily series share an hourly cache and retain two valid closes across missing days", async () => {
  const original = globalThis.fetch;
  const key = process.env.FRED_API_KEY;
  process.env.FRED_API_KEY = "fixture";
  const calls: { url: URL; init?: RequestInit & { next?: { revalidate?: number | false } } }[] = [];
  globalThis.fetch = async (input, init) => {
    calls.push({ url: new URL(String(input)), init });
    return Response.json({ observations: [
      { date: "2026-09-28", value: "." },
      { date: "2026-09-25", value: " " },
      { date: "2026-09-24", value: "5.18" },
      { date: "2026-09-23", value: "5.11" },
      { date: "2026-09-22", value: "4.96" },
    ] });
  };
  try {
    for (const definition of DAILY_MARKET_SERIES) {
      const result = await getSeries(definition, 2);
      assert.ok(result.ok);
      assert.equal(result.data.latestValue, 5.18);
      assert.equal(result.data.prevValue, 5.11);
      assert.deepEqual(result.data.observations.map(o => o.date), ["2026-09-23", "2026-09-24"]);
      assert.equal(calls.at(-1)?.url.searchParams.get("limit"), "30");
      assert.equal(calls.at(-1)?.init?.next?.revalidate, 3600);
    }
    await getSeries(DAILY_MARKET_SERIES[0], 10);
    assert.equal(calls.at(-1)?.url.toString(), calls[0].url.toString());
    await getSeries(MACRO_SERIES[0]);
    assert.equal(calls.at(-1)?.init?.next?.revalidate, 21600);
    assert.equal(calls.at(-1)?.url.searchParams.get("limit"), "60");
    await getSeries(DAILY_MARKET_SERIES[0], 30, { forceRefresh: true });
    assert.equal(calls.at(-1)?.init?.cache, "no-store");
    assert.equal(calls.at(-1)?.init?.next, undefined);
    globalThis.fetch = async () => new Response("", { status: 503 });
    assert.equal((await getSeries(DAILY_MARKET_SERIES[0], 30, { forceRefresh: true })).ok, false);
  } finally {
    globalThis.fetch = original;
    if (key === undefined) delete process.env.FRED_API_KEY;
    else process.env.FRED_API_KEY = key;
  }
});
