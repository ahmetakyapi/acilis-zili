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

/* GÜN SINIRI (16 Ekim). Gecikmeli tape'te bugün henüz işlem yokken
   kotasyonun `prevClose`u DÜNKÜ kotasyonun referansı, yani iki gün önceki
   kapanış. Bugünün IEX fiyatı onun üstüne konup `tradedAt` bugüne çekilirse
   iki seansın toplam hareketi "bugün" diye basılıyor, önbelleğe yazılıyor ve
   yüzde alarmını tetikliyordu. Katman yalnız aynı ET gününde uygulanır. */
test("gecikmeli işlem DÜNE aitse IEX katmanı uygulanmaz — iki seanslık yüzde bugüne yazılmaz", () => {
  const morning = Date.parse("2026-10-16T13:45:00Z"); // Cuma 09:45 ET
  const yesterday = quote({
    price: 94, prevClose: 100, change: -6, changePct: -6, // dünkü hareket, referansı önceki gün
    tradedAt: new Date("2026-10-15T19:58:00Z"),
  });
  const { quotes, live } = mergeRealtime(
    { XYZ: yesterday },
    { XYZ: { close: 95, minute: new Date(morning - 60_000) } },
    morning,
  );
  assert.equal(live, 0);
  assert.equal(quotes.XYZ!.price, 94);
  assert.equal(quotes.XYZ!.tradedAt!.toISOString(), "2026-10-15T19:58:00.000Z", "dünün kotasyonu dünde kalır");
  assert.equal(quotes.XYZ!.realtime, undefined);
});

test("işlem anı bilinmiyorsa referansın seansı da bilinmez — katman uygulanmaz", () => {
  const { live } = mergeRealtime(
    { MU: quote({ tradedAt: null }) },
    { MU: { close: 102.5, minute: new Date(now - 60_000) } },
    now,
  );
  assert.equal(live, 0);
});
