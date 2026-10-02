import test from "node:test";
import assert from "node:assert/strict";

import { targetItemSchema, validateTarget, type TargetItem } from "../lib/analyst-targets";

/* Ortalama hedefin yazma kuralları (lib/analyst-targets.ts): sayı rutinin
   araştırmasından geliyor, ekrana çıkmadan önce burada duruyor. */

const today = "2026-10-02";
const item = (over: Partial<TargetItem> = {}): TargetItem =>
  targetItemSchema.parse({
    symbol: "MU", as_of: today, mean: 1600, median: 1650, high: 2000, low: 1100,
    analyst_count: 32, source: "MarketBeat", source_url: "https://www.marketbeat.com/stocks/NASDAQ/MU/forecast/",
    ...over,
  });
const ctx = { todayEt: today, price: 1108, previous: { mean: 1580, asOf: "2026-10-01" } };

test("tutarlı, taze ve makul bir kayıt kabul edilir", () => {
  assert.deepEqual(validateTarget(item(), ctx), { ok: true });
});

test("gelecek tarih ve yedi günden eski tarih reddedilir", () => {
  assert.deepEqual(validateTarget(item({ as_of: "2026-10-03" }), ctx), { ok: false, reason: "future-date" });
  assert.deepEqual(validateTarget(item({ as_of: "2026-09-24" }), ctx), { ok: false, reason: "too-old" });
  assert.deepEqual(validateTarget(item({ as_of: "2026-09-25" }), { ...ctx, previous: null }), { ok: true });
});

test("aralık sırası ve medyan denetlenir", () => {
  assert.deepEqual(validateTarget(item({ low: 1700 }), ctx), { ok: false, reason: "range-order" });
  assert.deepEqual(validateTarget(item({ high: 1500 }), ctx), { ok: false, reason: "range-order" });
  assert.deepEqual(validateTarget(item({ median: 2100 }), ctx), { ok: false, reason: "median-out-of-range" });
  assert.deepEqual(validateTarget(item({ median: null, high: null, low: null }), ctx), { ok: true });
});

test("ölçeği kaçmış okuma (1.600 → 1,6) canlı fiyatla yakalanır", () => {
  assert.deepEqual(validateTarget(item({ mean: 1.6, median: null, high: null, low: null }), { ...ctx, previous: null }), { ok: false, reason: "implausible-vs-price" });
  assert.deepEqual(validateTarget(item({ mean: 5000, median: null, high: null }), { ...ctx, previous: null }), { ok: false, reason: "implausible-vs-price" });
  /* Fiyat yoksa makullük atlanır, öteki kurallar işler. */
  assert.deepEqual(validateTarget(item({ mean: 5000, median: null, high: null }), { ...ctx, price: null, previous: null }), { ok: true });
});

test("%20'den büyük sıçrama teyitsiz reddedilir, teyitle ya da eski kayıtta kabul", () => {
  const jump = item({ mean: 2000, median: null, high: 2400 });
  assert.deepEqual(validateTarget(jump, ctx), { ok: false, reason: "jump-unconfirmed" });
  assert.deepEqual(validateTarget({ ...jump, confirm_jump: true }, ctx), { ok: true });
  assert.deepEqual(validateTarget(jump, { ...ctx, previous: { mean: 1580, asOf: "2026-09-10" } }), { ok: true });
});

test("şema: https olmayan kaynak, sıfır analist ve geçersiz sembol reddedilir", () => {
  assert.equal(targetItemSchema.safeParse({ ...item(), source_url: "http://x.com" }).success, false);
  assert.equal(targetItemSchema.safeParse({ ...item(), analyst_count: 0 }).success, false);
  assert.equal(targetItemSchema.safeParse({ ...item(), symbol: "mu ; drop" }).success, false);
  assert.equal(targetItemSchema.parse({ ...item(), symbol: "brk.b" }).symbol, "BRK.B");
});
