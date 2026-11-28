import assert from "node:assert/strict";
import test from "node:test";
import { RequestBudget, STALE_MAX_MS, SymbolMemo, type FetchOutcome } from "../lib/providers/symbol-memo";

/* Sembol başına bellek önbelleği ve istek bütçesi (lib/providers/symbol-memo.ts). */

const TTL = 15_000;

function setup() {
  let clock = 1_000_000;
  const calls: string[][] = [];
  const memo = new SymbolMemo<number, string>();
  let next: (missing: string[]) => FetchOutcome<number, string> = (missing) => ({
    ok: true,
    data: Object.fromEntries(missing.filter((s) => s !== "ZZZZ").map((s) => [s, s.length])),
    at: clock,
  });
  const fetcher = async (missing: string[]) => {
    calls.push([...missing]);
    return next(missing);
  };
  return {
    memo,
    calls,
    fetcher,
    now: () => clock,
    tick: (ms: number) => (clock += ms),
    setNext: (fn: typeof next) => (next = fn),
  };
}

test("farklı kombinasyonlar önbelleği paylaşır: yalnız eksik sembol sorulur", async () => {
  const t = setup();
  const a = await t.memo.get(["MU", "NVDA", "AMD"], TTL, t.fetcher, { now: t.now });
  assert.deepEqual(a.data, { MU: 2, NVDA: 4, AMD: 3 });
  t.tick(5_000);
  const b = await t.memo.get(["MU", "AAPL"], TTL, t.fetcher, { now: t.now });
  assert.deepEqual(t.calls, [["MU", "NVDA", "AMD"], ["AAPL"]]);
  assert.deepEqual(b.data, { MU: 2, AAPL: 4 });
  /* Paket damgası en eski sembolün damgası. */
  assert.equal(b.oldestAt, 1_000_000);
});

test("süresi dolan sembol yeniden sorulur; dönmeyen sembol de bir süre 'yok' olarak tutulur", async () => {
  const t = setup();
  await t.memo.get(["MU", "ZZZZ"], TTL, t.fetcher, { now: t.now });
  t.tick(TTL - 1);
  const again = await t.memo.get(["MU", "ZZZZ"], TTL, t.fetcher, { now: t.now });
  assert.equal(t.calls.length, 1);
  assert.deepEqual(again.data, { MU: 2 });
  t.tick(2);
  await t.memo.get(["MU", "ZZZZ"], TTL, t.fetcher, { now: t.now });
  assert.deepEqual(t.calls[1], ["MU", "ZZZZ"]);
});

test("aynı anda gelen istekler tek uçuşa iner", async () => {
  const t = setup();
  const [x, y] = await Promise.all([
    t.memo.get(["MU", "NVDA"], TTL, t.fetcher, { now: t.now }),
    t.memo.get(["NVDA", "MU", "AMD"], TTL, t.fetcher, { now: t.now }),
  ]);
  assert.deepEqual(t.calls, [["MU", "NVDA"], ["AMD"]]);
  assert.deepEqual(x.data, { MU: 2, NVDA: 4 });
  assert.deepEqual(y.data, { NVDA: 4, MU: 2, AMD: 3 });
});

test("istek düşerse eldeki kayıt eski damgasıyla döner; çok eskiyse dönmez", async () => {
  const t = setup();
  await t.memo.get(["MU"], TTL, t.fetcher, { now: t.now });
  t.setNext(() => ({ ok: false, failure: "429" }));
  t.tick(TTL + 1);
  const stale = await t.memo.get(["MU"], TTL, t.fetcher, { now: t.now });
  assert.deepEqual(stale.data, { MU: 2 });
  assert.equal(stale.oldestAt, 1_000_000);
  assert.equal(stale.failure, "429");
  t.tick(STALE_MAX_MS);
  const gone = await t.memo.get(["MU"], TTL, t.fetcher, { now: t.now });
  assert.deepEqual(gone.data, {});
  assert.equal(gone.oldestAt, null);
});

test("fresh tazeliği atlar ama sonucu yazar", async () => {
  const t = setup();
  await t.memo.get(["MU"], TTL, t.fetcher, { now: t.now });
  t.tick(1_000);
  const fresh = await t.memo.get(["MU"], TTL, t.fetcher, { now: t.now, fresh: true });
  assert.equal(t.calls.length, 2);
  assert.equal(fresh.oldestAt, 1_001_000);
  await t.memo.get(["MU"], TTL, t.fetcher, { now: t.now });
  assert.equal(t.calls.length, 2);
});

test("bütçe kayan pencerede sınırlar", () => {
  const budget = new RequestBudget(3, 60_000);
  assert.equal(budget.take(0), true);
  assert.equal(budget.take(1), true);
  assert.equal(budget.take(2), true);
  assert.equal(budget.take(3), false);
  assert.equal(budget.used(30_000), 3);
  assert.equal(budget.take(60_000), true);
});

test("düşen paketin sembolü 'yok' sayılmaz, eldeki fiyat durur (28 Kasım, portföyde SHAZ)", async () => {
  const t = setup();
  await t.memo.get(["MU", "SHAZ"], TTL, t.fetcher, { now: t.now });
  t.tick(TTL + 1);
  /* İkinci paket düştü: yanıt yalnız MU'yu kapsıyor. */
  t.setNext(() => ({ ok: true, data: { MU: 9 }, at: 2_000_000, covered: ["MU"] }));
  const r = await t.memo.get(["MU", "SHAZ"], TTL, t.fetcher, { now: t.now });
  assert.deepEqual(r.data, { MU: 9, SHAZ: 4 });
});

test("'yok' eldeki iyi fiyatın üstüne yazılmaz; boş kayıtta 'yok' en çok bir dakika", async () => {
  const t = setup();
  await t.memo.get(["SHAZ"], TTL, t.fetcher, { now: t.now });
  t.tick(TTL + 1);
  t.setNext(() => ({ ok: true, data: {}, at: 2_000_000 }));
  const kept = await t.memo.get(["SHAZ"], TTL, t.fetcher, { now: t.now });
  assert.deepEqual(kept.data, { SHAZ: 4 });
  /* Hiç kaydı olmayan sembol: "yok" tutulur ama uzun önbellek süresinde bile bir dakikada yeniden sorulur. */
  const long = 30 * 60_000;
  await t.memo.get(["ZZZZ"], long, t.fetcher, { now: t.now });
  const before = t.calls.length;
  t.tick(30_000);
  await t.memo.get(["ZZZZ"], long, t.fetcher, { now: t.now });
  assert.equal(t.calls.length, before);
  t.tick(31_000);
  await t.memo.get(["ZZZZ"], long, t.fetcher, { now: t.now });
  assert.equal(t.calls.length, before + 1);
});
