import test from "node:test";
import assert from "node:assert/strict";
import {
  deliveredAny,
  firstNotifyRecord,
  isMissingTable,
  needsNotifyRetry,
  NOTIFY_MAX_ATTEMPTS,
  NOTIFY_RETRY_MIN_AGE_MS,
  NOTIFY_RETRY_WINDOW_MS,
  pickNotifyRetries,
  readArmedAt,
  resetAlertState,
} from "../lib/alert-state";

/**
 * Alarm durumu (lib/alert-state.ts, migration 0043): bildirim tekrarının
 * seçimi, ilk denemenin kaydı, tablo-yok geri dönüşü.
 */

const now = new Date("2026-11-09T15:00:00.000Z");
const ago = (msAgo: number) => new Date(now.getTime() - msAgo);
const min = 60_000;

test("needsNotifyRetry: tablo", () => {
  type Row = Parameters<typeof needsNotifyRetry>[0];
  const rows: [string, Row, boolean][] = [
    ["tetik 5 dk önce, bildirilmedi, ilk deneme kayıtlı → dene", { triggeredAt: ago(5 * min), notifiedAt: null, notifyAttempts: 1 }, true],
    ["bildirildi → dokunma", { triggeredAt: ago(5 * min), notifiedAt: ago(5 * min), notifyAttempts: 1 }, false],
    ["tetik yok (yeniden kurulmuş) → dokunma", { triggeredAt: null, notifiedAt: null, notifyAttempts: 1 }, false],
    ["tavan doldu (2) → dokunma", { triggeredAt: ago(5 * min), notifiedAt: null, notifyAttempts: NOTIFY_MAX_ATTEMPTS }, false],
    ["ilk deneme kaydı yok (0, yeniden kurma sıfırladı) → dokunma", { triggeredAt: ago(5 * min), notifiedAt: null, notifyAttempts: 0 }, false],
    ["pencere dışında (15 dk + 1 ms) → dokunma", { triggeredAt: ago(NOTIFY_RETRY_WINDOW_MS + 1), notifiedAt: null, notifyAttempts: 1 }, false],
    ["pencere sınırı (tam 15 dk) → dene", { triggeredAt: ago(NOTIFY_RETRY_WINDOW_MS), notifiedAt: null, notifyAttempts: 1 }, true],
    ["çok taze (aynı tarama) → sonraki taramaya kalır", { triggeredAt: ago(30_000), notifiedAt: null, notifyAttempts: 1 }, false],
    ["asgari yaş sınırı (tam 2 dk) → dene", { triggeredAt: ago(NOTIFY_RETRY_MIN_AGE_MS), notifiedAt: null, notifyAttempts: 1 }, true],
    ["gelecekteki tetik (saat kayması) → dokunma", { triggeredAt: ago(-min), notifiedAt: null, notifyAttempts: 1 }, false],
    ["ISO dize tetik → dene", { triggeredAt: ago(5 * min).toISOString(), notifiedAt: null, notifyAttempts: 1 }, true],
    ["okunamayan tetik → dokunma", { triggeredAt: "bozuk", notifiedAt: null, notifyAttempts: 1 }, false],
  ];
  for (const [name, row, expected] of rows) {
    assert.equal(needsNotifyRetry(row, now), expected, name);
    assert.equal(needsNotifyRetry(row, now.getTime()), expected, `${name} (ms)`);
  }
});

test("pickNotifyRetries: yalnız uygun satırlar, sıra korunur, ek alanlar taşınır", () => {
  const rows = [
    { id: "a", triggeredAt: ago(3 * min), notifiedAt: null, notifyAttempts: 1 },
    { id: "b", triggeredAt: ago(3 * min), notifiedAt: ago(3 * min), notifyAttempts: 1 },
    { id: "c", triggeredAt: ago(20 * min), notifiedAt: null, notifyAttempts: 1 },
    { id: "d", triggeredAt: ago(10 * min), notifiedAt: null, notifyAttempts: 1 },
  ];
  assert.deepEqual(
    pickNotifyRetries(rows, now).map((row) => row.id),
    ["a", "d"],
  );
});

test("deliveredAny: en az bir kanal; fırlayan bildirim teslim değil", () => {
  assert.equal(deliveredAny({ inbox: true, push: 0, email: false }), true);
  assert.equal(deliveredAny({ inbox: false, push: 2, email: false }), true);
  assert.equal(deliveredAny({ inbox: false, push: 0, email: true }), true);
  assert.equal(deliveredAny({ inbox: false, push: 0, email: false }), false);
  assert.equal(deliveredAny(null), false);
});

test("firstNotifyRecord: teslim → bildirildi; hiçbiri → tekrar adayı; fırladı → tavan (tekrar yok)", () => {
  assert.deepEqual(firstNotifyRecord({ inbox: true, push: 0, email: false }, now), { notifiedAt: now, notifyAttempts: 1 });
  const failed = firstNotifyRecord({ inbox: false, push: 0, email: false }, now);
  assert.deepEqual(failed, { notifiedAt: null, notifyAttempts: 1 });
  /* Kaydedilen hâl 5 dk sonra tekrar seçilir… */
  assert.equal(needsNotifyRetry({ triggeredAt: now, ...failed }, now.getTime() + 5 * min), true);
  /* …fırlayan bildirim (kutu satırı yazılmış olabilir) seçilmez. */
  const unknown = firstNotifyRecord(null, now);
  assert.deepEqual(unknown, { notifiedAt: null, notifyAttempts: NOTIFY_MAX_ATTEMPTS });
  assert.equal(needsNotifyRetry({ triggeredAt: now, ...unknown }, now.getTime() + 5 * min), false);
});

test("isMissingTable: 42P01 doğrudan ya da cause içinde", () => {
  assert.equal(isMissingTable({ code: "42P01" }), true);
  assert.equal(isMissingTable(Object.assign(new Error("sarılı"), { cause: { code: "42P01" } })), true);
  assert.equal(isMissingTable({ code: "57P01" }), false);
  assert.equal(isMissingTable(new Error("ağ")), false);
  assert.equal(isMissingTable(null), false);
});

test("tablo yok / veritabanı yok: okuma null (createdAt'e düşülür), yazma eski yola düşürür", async () => {
  /* Testte DATABASE_URL yok: sorgu fırlatır; modül yutup eski davranışı
     seçtirmeli — sayfa ya da eylem düşmemeli. */
  const saved = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  const originalError = console.error;
  console.error = () => undefined;
  try {
    assert.equal(await readArmedAt("percent", ["00000000-0000-0000-0000-000000000000"]), null);
    /* Boş liste veritabanına gitmez. */
    assert.deepEqual(await readArmedAt("percent", []), new Map());
    const write = await resetAlertState("percent", "00000000-0000-0000-0000-000000000000", now);
    assert.notEqual(write, "ok", "ok değilse rearmPercentAlert createdAt'i eskisi gibi ileri çeker");
  } finally {
    console.error = originalError;
    if (saved !== undefined) process.env.DATABASE_URL = saved;
  }
});
