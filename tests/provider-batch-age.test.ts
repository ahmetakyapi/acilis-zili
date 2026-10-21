import test from "node:test";
import assert from "node:assert/strict";
import { getBarsMulti, getSnapshots } from "../lib/providers/alpaca";

/**
 * Paketlere bölünen Alpaca isteklerinde yanıtın YAŞI (20 Ekim).
 *
 * `getSnapshots` en YENİ paketin, `getBarsMulti` SON paketin `Date`
 * başlığını döndürüyordu: stale-while-revalidate tazelemesi düşmüş tek bir
 * paket, taze paketlerin yanında `packCurrent` / `barsCurrent`in yaş
 * sorusundan geçiyordu. Doğrusu en ESKİ paket — eskiyse çağıran bir kez
 * önbelleksiz tekrarlıyor. `getBarsMulti`nin paketleri de artık paralel.
 */

const OLD = new Date("2026-10-20T13:00:00Z");
const NEW = new Date("2026-10-20T13:20:00Z");

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

/** Harf-yalnız sembol adları: QAA, QAB… — `canonicalSymbol` dokunmasın. */
function symbolList(count: number): string[] {
  const a = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  return Array.from({ length: count }, (_, i) => `Q${a[Math.floor(i / 26) % 26]}${a[i % 26]}`);
}

test("anlık görüntü: paketlerden biri eskiyse paketin yaşı o paketin yaşı", async () => {
  const symbols = symbolList(250); // 200 + 50: iki paket
  await withProvider(async (input) => {
    const batch = new URL(String(input)).searchParams.get("symbols")!.split(",");
    const body = Object.fromEntries(
      batch.map((s) => [s, { latestTrade: { p: 10, t: NEW.toISOString() }, prevDailyBar: { c: 9 } }]),
    );
    // İlk paket önbellekten eski gelmiş gibi.
    const date = batch.includes(symbols[0]) ? OLD : NEW;
    return Response.json(body, { headers: { date: date.toUTCString() } });
  }, async () => {
    const result = await getSnapshots(symbols, 0);
    assert.ok(result.ok);
    assert.equal(Object.keys(result.data).length, 250);
    assert.equal(result.fetchedAt.getTime(), OLD.getTime());
  });
});

test("çoklu bar: paketler paralel gidiyor ve yaş en eski paketten", async () => {
  const symbols = symbolList(6); // 1G'de paket başına 5 sembol: iki paket
  let inflight = 0;
  let maxInflight = 0;
  await withProvider(async (input) => {
    const batch = new URL(String(input)).searchParams.get("symbols")!.split(",");
    inflight++;
    maxInflight = Math.max(maxInflight, inflight);
    await new Promise((resolve) => setTimeout(resolve, 20));
    inflight--;
    const bar = { t: NEW.toISOString(), o: 1, h: 1, l: 1, c: 1, v: 1 };
    const body = { bars: Object.fromEntries(batch.map((s) => [s, [bar]])), next_page_token: null };
    // Sıralı listede ilk paket (ilk beş sembol) eski.
    const date = batch.includes(symbols[0]) ? OLD : NEW;
    return Response.json(body, { headers: { date: date.toUTCString() } });
  }, async () => {
    const result = await getBarsMulti(symbols, "1D", 0);
    assert.ok(result.ok);
    assert.equal(Object.keys(result.data).length, 6);
    assert.equal(maxInflight, 2);
    assert.equal(result.fetchedAt.getTime(), OLD.getTime());
  });
});
