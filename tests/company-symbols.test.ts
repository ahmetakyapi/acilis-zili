import test from "node:test";
import assert from "node:assert/strict";
import { primaryOnly } from "../db/seed/indices";
import { canonicalSymbol } from "../lib/symbols";
import { getSnapshots, getPeriodChanges, getBarsMulti } from "../lib/providers/alpaca";

async function withProvider(handler: typeof fetch, run: () => Promise<void>) {
  const fetchBefore = globalThis.fetch;
  const key = process.env.ALPACA_API_KEY_ID, secret = process.env.ALPACA_API_SECRET_KEY;
  process.env.ALPACA_API_KEY_ID = "fixture"; process.env.ALPACA_API_SECRET_KEY = "fixture";
  globalThis.fetch = handler;
  try { await run(); } finally {
    globalThis.fetch = fetchBefore;
    if (key === undefined) delete process.env.ALPACA_API_KEY_ID; else process.env.ALPACA_API_KEY_ID = key;
    if (secret === undefined) delete process.env.ALPACA_API_SECRET_KEY; else process.env.ALPACA_API_SECRET_KEY = secret;
  }
}
const snapshot = { latestTrade: { p: 200, t: new Date().toISOString() }, prevDailyBar: { c: 190 } };
const bar = (c: number) => ({ c, o: c, h: c, l: c, v: 100, t: new Date().toISOString() });

test("Berkshire aliases use the canonical row regardless of database order", () => {
  const rows = [{ symbol: "BRK-B", name: "Alias" }, { symbol: "BRK.B", name: "Canonical" }, { symbol: "BRK-A", name: "Class A" }, { symbol: "AAPL", name: "Apple" }];
  for (const input of [rows, [...rows].reverse()]) {
    const result = primaryOnly(input);
    assert.equal(result.length, 2);
    assert.equal(result.find(row => row.symbol === "BRK.B")?.name, "Canonical");
  }
  assert.deepEqual(primaryOnly([{ symbol: "BRK-B" }]), [{ symbol: "BRK.B" }]);
  assert.equal(canonicalSymbol(" brk/b "), "BRK.B");
  assert.equal(canonicalSymbol("ABC-P"), "ABC-P");
});

test("normalizing a Berkshire alias preserves Apple and Amazon in the same snapshot batch", async () => {
  await withProvider(async input => {
    assert.equal(new URL(String(input)).searchParams.get("symbols"), "AAPL,BRK.B,AMZN");
    return Response.json({ AAPL: snapshot, "BRK.B": snapshot, AMZN: snapshot });
  }, async () => {
    const result = await getSnapshots(["AAPL", "BRK-B", "AMZN"], 0);
    assert.ok(result.ok);
    assert.equal(result.data.AAPL.price, 200);
    assert.equal(result.data["BRK-B"].price, 200);
    assert.equal(result.data.AMZN.price, 200);
  });
});

test("a newly rejected identifier does not poison the remaining quote batch", async () => {
  const requests: string[] = [];
  await withProvider(async input => {
    const symbols = new URL(String(input)).searchParams.get("symbols")!; requests.push(symbols);
    if (symbols.includes("BAD-X")) return Response.json({ message: "code=400, message=invalid symbol: BAD-X" }, { status: 400 });
    return Response.json({ AAPL: snapshot, AMZN: snapshot });
  }, async () => {
    const result = await getSnapshots(["AAPL", "BAD-X", "AMZN"], 0);
    assert.ok(result.ok); assert.deepEqual(Object.keys(result.data), ["AAPL", "AMZN"]);
    assert.deepEqual(requests, ["AAPL,BAD-X,AMZN", "AAPL,AMZN"]);
  });
});

test("rate limits and unknown provider errors are not retried or guessed", async () => {
  for (const status of [429, 503, 400]) {
    let calls = 0;
    await withProvider(async () => { calls++; return Response.json({ message: "invalid symbol: NOT-REQUESTED" }, { status }); }, async () => {
      assert.equal((await getSnapshots(["AAPL"], 0)).ok, false); assert.equal(calls, 1);
    });
  }
});

test("weekly returns and multi-company charts isolate invalid symbols too", async () => {
  await withProvider(async input => {
    const symbols = new URL(String(input)).searchParams.get("symbols")!;
    if (symbols.includes("BAD-X")) return Response.json({ message: "invalid symbol: BAD-X" }, { status: 400 });
    assert.equal(symbols, "AAPL,BRK.B");
    return Response.json({ bars: { AAPL: [bar(100), bar(110)], "BRK.B": [bar(200), bar(220)] } });
  }, async () => {
    const weekly = await getPeriodChanges(["AAPL", "BAD-X", "BRK-B"], 5, 0);
    assert.ok(weekly.ok); assert.equal(weekly.data.AAPL, 10); assert.equal(weekly.data["BRK-B"], 10);
    const chart = await getBarsMulti(["AAPL", "BAD-X", "BRK-B"], "1M", 0);
    assert.ok(chart.ok); assert.equal(chart.data.AAPL.length, 2); assert.equal(chart.data["BRK-B"].length, 2);
  });
});
