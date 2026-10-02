import test from "node:test";
import assert from "node:assert/strict";

import { mergeRealtime } from "../lib/providers";
import type { Quote } from "../lib/providers/types";

/* Melez kotasyonun kuralları (lib/providers/index.ts → `overlayRealtime`):
   IEX barı taze ve gecikmeli işlemden yeniyse fiyat ondan, yüzde resmî
   önceki kapanışa göre, yüksek/düşük fiyatı kapsar; değilse gecikmeli
   kotasyon olduğu gibi kalır. */

const now = Date.parse("2026-10-01T18:00:00Z");
const quote = (over: Partial<Quote> = {}): Quote => ({
  symbol: "MU", price: 100, change: 2, changePct: 2.0408, open: 98, high: 101, low: 97,
  prevClose: 98, volume: 1_000_000, tradedAt: new Date(now - 15 * 60_000), ...over,
});

test("taze IEX barı fiyatı, yüzdeyi ve yüksek/düşüğü günceller", () => {
  const { quotes, live } = mergeRealtime({ MU: quote() }, { MU: { close: 102.5, minute: new Date(now - 60_000) } }, now);
  assert.equal(live, 1);
  const q = quotes.MU!;
  assert.equal(q.price, 102.5);
  assert.equal(q.realtime, true);
  assert.equal(q.change, 102.5 - 98);
  assert.ok(Math.abs(q.changePct! - ((102.5 - 98) / 98) * 100) < 1e-9);
  assert.equal(q.high, 102.5, "fiyat gün içi yükseğin üstünde basılmamalı");
  assert.equal(q.low, 97);
  assert.equal(q.volume, 1_000_000, "hacim gecikmeli tape'ten kalır");
  assert.equal(q.open, 98);
});

test("üç dakikadan eski bar kullanılmaz — gecikmeli fiyat kalır", () => {
  const { quotes, live } = mergeRealtime({ MU: quote() }, { MU: { close: 102.5, minute: new Date(now - 4 * 60_000) } }, now);
  assert.equal(live, 0);
  assert.equal(quotes.MU!.price, 100);
  assert.equal(quotes.MU!.realtime, undefined);
});

test("gecikmeli işlemden eski bar kullanılmaz", () => {
  const { live } = mergeRealtime(
    { MU: quote({ tradedAt: new Date(now - 30_000) }) },
    { MU: { close: 102.5, minute: new Date(now - 60_000) } },
    now,
  );
  assert.equal(live, 0);
});

test("önceki kapanış bilinmiyorsa değişim de bilinmiyor", () => {
  const { quotes } = mergeRealtime({ MU: quote({ prevClose: null }) }, { MU: { close: 95, minute: new Date(now - 30_000) } }, now);
  assert.equal(quotes.MU!.change, null);
  assert.equal(quotes.MU!.changePct, null);
  assert.equal(quotes.MU!.low, 95);
});

test("sembol biçimi farkı (BRK-B / BRK.B) eşleşir; barı olmayan sembol dokunulmaz", () => {
  const { quotes, live } = mergeRealtime(
    { "BRK-B": quote({ symbol: "BRK-B" }), NVR: quote({ symbol: "NVR" }) },
    { "BRK.B": { close: 101, minute: new Date(now - 10_000) } },
    now,
  );
  assert.equal(live, 1);
  assert.equal(quotes["BRK-B"]!.price, 101);
  assert.equal(quotes.NVR!.price, 100);
});
