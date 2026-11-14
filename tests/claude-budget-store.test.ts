import test from "node:test";
import assert from "node:assert/strict";
import { CACHE_ONLY, ClaudeBudgetError, createClaudeBudget, memberClient } from "../lib/claude-budget";
import type { SpendStore } from "../lib/claude-spend-store";

/**
 * Claude bütçesinin KALICI sayacı (lib/claude-budget.ts → "KALICI SAYAÇ").
 * Depo sahte: gerçek deyimlerin yaptığını (koşullu artış, sıfırda duran
 * iade, koşulsuz ekleme) bellekte yapar; deyimlerin kendisi
 * `tests/claude-spend-store.test.ts`te. İki "süreç" aynı depoyu paylaşan
 * iki bütçe örneğidir.
 */

type Mode = "ok" | "missing" | "down" | "hang";

function fakeStore() {
  const rows = new Map<string, number>();
  const state = { mode: "ok" as Mode, calls: 0 };
  const gate = async () => {
    state.calls += 1;
    if (state.mode === "missing") throw Object.assign(new Error("Failed query: insert into claude_spend"), { cause: { code: "42P01" } });
    if (state.mode === "down") throw new Error("fetch failed");
    if (state.mode === "hang") await new Promise(() => {});
  };
  const store: SpendStore = {
    async take(day, ceiling) {
      await gate();
      const n = rows.get(day);
      if (n === undefined) {
        rows.set(day, 1);
        return 1;
      }
      if (n >= ceiling) return null;
      rows.set(day, n + 1);
      return n + 1;
    },
    async refund(day) {
      await gate();
      const n = rows.get(day) ?? 0;
      if (n > 0) rows.set(day, n - 1);
    },
    async add(day, count) {
      await gate();
      rows.set(day, (rows.get(day) ?? 0) + count);
    },
  };
  return { store, rows, state };
}

const DAY = "2026-11-14";
const NEXT_DAY = "2026-11-15";

function clock(iso = `${DAY}T10:00:00Z`) {
  const state = { t: Date.parse(iso) };
  return { now: () => state.t, advance: (ms: number) => void (state.t += ms) };
}

const rejects = (work: Promise<unknown>) => assert.rejects(work, ClaudeBudgetError);

test("tavan depoda sayılır: dolunca ret, depo tavanda durur", async () => {
  process.env.INSIGHT_DAILY_CAP = "3";
  const { store, rows } = fakeStore();
  const budget = createClaudeBudget({ store, now: clock().now });
  for (let i = 0; i < 3; i += 1) assert.deepEqual(await budget.reserve(), { day: DAY, durable: true });
  await rejects(budget.reserve());
  await rejects(budget.reserve());
  assert.equal(rows.get(DAY), 3);
});

test("yeniden başlayan süreç sayacı sıfırdan başlatmaz", async () => {
  process.env.INSIGHT_DAILY_CAP = "3";
  const { store, rows } = fakeStore();
  const time = clock();
  const before = createClaudeBudget({ store, now: time.now });
  await before.reserve();
  await before.reserve();
  /* Deploy: yeni süreç, belleği boş. */
  const after = createClaudeBudget({ store, now: time.now });
  await after.reserve();
  await rejects(after.reserve());
  assert.equal(rows.get(DAY), 3);
});

test("iki süreç birlikte tavanı aşamaz; paylar da ortak sayılır", async () => {
  process.env.INSIGHT_DAILY_CAP = "10";
  const { store, rows } = fakeStore();
  const time = clock();
  const blue = createClaudeBudget({ store, now: time.now });
  const green = createClaudeBudget({ store, now: time.now });

  /* Anonim %80: iki süreçten eşzamanlı 12 deneme, 8'i geçer. */
  const anonymous = await Promise.allSettled(
    Array.from({ length: 12 }, (_, i) => (i % 2 ? blue : green).reserve(`claude:two-process-${i}`)),
  );
  assert.equal(anonymous.filter((r) => r.status === "fulfilled").length, 8);
  assert.equal(rows.get(DAY), 8);

  /* Üye %90: bir hak daha; son onda bir yalnız nöbetin. */
  const members = await Promise.allSettled([blue.reserve(memberClient("two-process-a")), green.reserve(memberClient("two-process-b"))]);
  assert.equal(members.filter((r) => r.status === "fulfilled").length, 1);
  const watch = await Promise.allSettled([blue.reserve(), green.reserve(), blue.reserve()]);
  assert.equal(watch.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(rows.get(DAY), 10);
});

test("iade kalıcı sayaçtan düşer ve hakkı yeniden açar", async () => {
  process.env.INSIGHT_DAILY_CAP = "2";
  const { store, rows } = fakeStore();
  const budget = createClaudeBudget({ store, now: clock().now });
  await budget.reserve();
  const ticket = await budget.reserve();
  await rejects(budget.reserve());
  await budget.release(undefined, ticket);
  assert.equal(rows.get(DAY), 1);
  await budget.reserve();
  await rejects(budget.reserve());
  assert.equal(rows.get(DAY), 2);
});

test("iade kimliğin günlük sayacını da açar; reddedilen deneme kimlikten düşmez", async () => {
  process.env.INSIGHT_DAILY_CAP = "10";
  const { store } = fakeStore();
  const budget = createClaudeBudget({ store, now: clock().now });
  const member = memberClient(`refund-${Date.now()}`);
  const tickets = [];
  for (let i = 0; i < 9; i += 1) tickets.push(await budget.reserve(member));
  /* Üye payı (%90) doldu: ret kimlik sayacını şişirmez. */
  await rejects(budget.reserve(member));
  await budget.release(member, tickets[0]!);
  await budget.reserve(member);
  await rejects(budget.reserve(member));
});

test("öteki sürecin iadesi dolu belleği süresiz kapalı tutmaz", async () => {
  process.env.INSIGHT_DAILY_CAP = "2";
  const { store, state } = fakeStore();
  const time = clock();
  const blue = createClaudeBudget({ store, now: time.now });
  const green = createClaudeBudget({ store, now: time.now });
  await blue.reserve();
  const ticket = await green.reserve();
  await rejects(blue.reserve());
  await green.release(undefined, ticket);
  /* Kısa devre: dolu bellek depoya gitmeden reddeder… */
  const calls = state.calls;
  await rejects(blue.reserve());
  assert.equal(state.calls, calls);
  /* …ama bir dakika sonra yeniden sorar. */
  time.advance(61_000);
  await blue.reserve();
});

test("gün dönümünde sayaç yeni günün satırından başlar (UTC)", async () => {
  process.env.INSIGHT_DAILY_CAP = "2";
  const { store, rows } = fakeStore();
  const time = clock(`${DAY}T23:59:30Z`);
  const budget = createClaudeBudget({ store, now: time.now });
  await budget.reserve();
  const late = await budget.reserve();
  await rejects(budget.reserve());
  time.advance(60_000);
  assert.deepEqual(await budget.reserve(), { day: NEXT_DAY, durable: true });
  /* Dünün iadesi dünün satırına gider, bugünün sayacına dokunmaz. */
  await budget.release(undefined, late);
  assert.deepEqual([...rows], [[DAY, 1], [NEXT_DAY, 1]]);
  await budget.reserve();
  await rejects(budget.reserve());
});

test("tablo yokken sessizce bellek sayacına düşer; tablo gelince haklar işlenir", async () => {
  process.env.INSIGHT_DAILY_CAP = "3";
  const { store, rows, state } = fakeStore();
  state.mode = "missing";
  const logs: string[] = [];
  const time = clock();
  const budget = createClaudeBudget({ store, now: time.now, log: (m) => logs.push(m) });
  assert.deepEqual(await budget.reserve(), { day: DAY, durable: false });
  /* Depo bir süre denenmez: her çağrı ayrıca bir sorgu yakmaz. */
  await budget.reserve();
  assert.equal(state.calls, 1);
  /* Tavan bellekte tutulur (14 Kasım öncesinin davranışı). */
  await budget.reserve();
  await rejects(budget.reserve());
  assert.deepEqual(logs, []);
  assert.equal(rows.size, 0);

  /* Migration uygulandı: bellekte sayılan üç hak depoya işlenir, tavan dolu. */
  state.mode = "ok";
  time.advance(6 * 60_000);
  await rejects(budget.reserve());
  assert.equal(rows.get(DAY), 3);
});

test("veritabanı hatası Claude çağrısını engellemez, günlüğe bir kez yazılır", async () => {
  process.env.INSIGHT_DAILY_CAP = "3";
  const { store, rows, state } = fakeStore();
  const logs: string[] = [];
  const time = clock();
  const budget = createClaudeBudget({ store, now: time.now, log: (m) => logs.push(m) });
  await budget.reserve();
  state.mode = "down";
  const ticket = await budget.reserve();
  assert.equal(ticket.durable, false);
  await budget.reserve();
  await rejects(budget.reserve());
  assert.equal(logs.length, 1);
  assert.match(logs[0]!, /kalıcı sayaç yazılamadı.*fetch failed/);
  /* Belleğe düşmüş hakkın iadesi depoya gitmez (oraya hiç yazılmadı). */
  await budget.release(undefined, ticket);
  assert.equal(rows.get(DAY), 1);

  /* Depo döndü: bellekte kalan TEK hak (biri iade edildi) işlenir. */
  state.mode = "ok";
  time.advance(61_000);
  await budget.reserve();
  assert.equal(rows.get(DAY), 3);
  await rejects(budget.reserve());
});

test("yanıt vermeyen veritabanı zaman aşımıyla geçilir", async () => {
  process.env.INSIGHT_DAILY_CAP = "3";
  const { store, state } = fakeStore();
  state.mode = "hang";
  const logs: string[] = [];
  const budget = createClaudeBudget({ store, now: clock().now, log: (m) => logs.push(m), timeoutMs: 5 });
  assert.deepEqual(await budget.reserve(), { day: DAY, durable: false });
  assert.match(logs[0]!, /timeout/);
});

test("iade yazılamazsa fırlatmaz", async () => {
  process.env.INSIGHT_DAILY_CAP = "3";
  const { store, state } = fakeStore();
  const logs: string[] = [];
  const budget = createClaudeBudget({ store, now: clock().now, log: (m) => logs.push(m) });
  const ticket = await budget.reserve();
  state.mode = "down";
  await assert.doesNotReject(budget.release(undefined, ticket));
  assert.match(logs[0]!, /iadesi yazılamadı/);
});

test("depo yokken (DATABASE_URL tanımsız) bütçe bellekte sayar", async () => {
  process.env.INSIGHT_DAILY_CAP = "2";
  const budget = createClaudeBudget({ store: null, now: clock().now });
  assert.deepEqual(await budget.reserve(), { day: DAY, durable: false });
  const ticket = await budget.reserve();
  await rejects(budget.reserve());
  await budget.release(undefined, ticket);
  await budget.reserve();
});

test("yalnız önbellek kimliği ve sıfır tavan depoya gitmeden reddedilir", async () => {
  const { store, state } = fakeStore();
  const budget = createClaudeBudget({ store, now: clock().now });
  process.env.INSIGHT_DAILY_CAP = "150";
  await rejects(budget.reserve(CACHE_ONLY));
  /* Tavan 1: anonim payı floor(0,8) = 0 — günün ilk çağrısı satırı açamamalı. */
  process.env.INSIGHT_DAILY_CAP = "1";
  await rejects(budget.reserve("claude:zero-ceiling"));
  assert.equal(state.calls, 0);
});
