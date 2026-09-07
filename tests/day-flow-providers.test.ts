import test from "node:test";
import assert from "node:assert/strict";
import { getReleasedObservation } from "../lib/providers/fred";
import { getEarningsCalendar } from "../lib/providers/finnhub";

async function withFetch<T>(handler: typeof fetch, run: () => Promise<T>) {
  const previousFetch = globalThis.fetch;
  const fredKey = process.env.FRED_API_KEY;
  const finnhubKey = process.env.FINNHUB_API_KEY;
  globalThis.fetch = handler;
  process.env.FRED_API_KEY = "fixture-key";
  process.env.FINNHUB_API_KEY = "fixture-key";
  try { return await run(); }
  finally {
    globalThis.fetch = previousFetch;
    if (fredKey === undefined) delete process.env.FRED_API_KEY; else process.env.FRED_API_KEY = fredKey;
    if (finnhubKey === undefined) delete process.env.FINNHUB_API_KEY; else process.env.FINNHUB_API_KEY = finnhubKey;
  }
}

test("FRED release check compares date-specific vintages and preserves transformed values", async () => {
  const calls: { date: string | null; ttl: number | undefined; units: string | null }[] = [];
  await withFetch(async (input, init) => {
    const url = new URL(String(input));
    const date = url.searchParams.get("realtime_start");
    calls.push({ date, ttl: (init as RequestInit & { next?: { revalidate: number } })?.next?.revalidate, units: url.searchParams.get("units") });
    return Response.json({ observations: date === "2026-09-11"
      ? [{ date: "2026-08-01", value: "2.7" }, { date: "2026-07-01", value: "2.8" }]
      : [{ date: "2026-07-01", value: "2.8" }] });
  }, async () => {
    const result = await getReleasedObservation("CPIAUCSL", "2026-09-11");
    assert.equal(result?.actual, "2.7"); assert.equal(result?.previous, "2.8");
    assert.deepEqual(calls.map(call => call.date).sort(), ["2026-09-10", "2026-09-11"]);
    assert.ok(calls.every(call => call.units === "pc1"));
    assert.equal(calls.find(call => call.date === "2026-09-11")?.ttl, 60);
  });
});
test("FRED revisions and unavailable vintages do not claim a new result", async () => {
  await withFetch(async () => Response.json({ observations: [{ date: "2026-07-01", value: "2.7" }] }), async () => {
    assert.equal(await getReleasedObservation("CPIAUCSL", "2026-09-11"), null);
  });
  await withFetch(async () => new Response("unavailable", { status: 503 }), async () => {
    assert.equal(await getReleasedObservation("CPIAUCSL", "2026-09-11"), null);
  });
});
test("initial claims converts persons to the calendar's thousands unit", async () => {
  await withFetch(async (input) => {
    const date = new URL(String(input)).searchParams.get("realtime_start");
    return Response.json({ observations: date === "2026-09-10" ? [{ date: "2026-09-05", value: "215000" }] : [{ date: "2026-08-29", value: "220000" }] });
  }, async () => assert.equal((await getReleasedObservation("ICSA", "2026-09-10"))?.actual, "215"));
});
test("monthly Fed Funds average cannot substitute for a FOMC decision", async () => {
  let calls = 0;
  await withFetch(async () => { calls++; return Response.json({}); }, async () => {
    assert.equal(await getReleasedObservation("FEDFUNDS", "2026-09-16"), null);
    assert.equal(calls, 0);
  });
});
test("earnings result polling is cached per day without changing ordinary calendar TTL", async () => {
  const ttls: (number | undefined)[] = [];
  await withFetch(async (_input, init) => {
    ttls.push((init as RequestInit & { next?: { revalidate: number } })?.next?.revalidate);
    return Response.json({ earningsCalendar: [{ symbol: "AAPL", date: "2026-09-08", epsActual: 0, epsEstimate: 1, revenueActual: null, revenueEstimate: null, hour: "amc", quarter: 3, year: 2026 }] });
  }, async () => {
    const fresh = await getEarningsCalendar("2026-09-08", "2026-09-08", undefined, "results");
    assert.ok(fresh.ok); if (fresh.ok) assert.equal(fresh.data[0].epsActual, 0);
    await getEarningsCalendar("2026-09-08", "2026-09-08");
    assert.deepEqual(ttls, [60, 21600]);
  });
});
