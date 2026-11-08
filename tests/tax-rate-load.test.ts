import assert from "node:assert/strict";
import { test } from "node:test";
import {
  RATE_LOAD_IDLE,
  rateLoadReducer,
  ratesFailedOf,
  type RateLoad,
  type RateLoadEvent,
} from "../components/tax/rate-load";

/* Vergi hesaplayıcının kur yüklemesi (components/tax/rate-load.ts). İki eski
   hata yolu burada sabitleniyor: temizlenen uçuşun "yükleniyor"da takılması
   ve ikinci partinin ilk partinin hatasını silmesi. */

const run = (events: RateLoadEvent[], from: RateLoad = RATE_LOAD_IDLE) => events.reduce(rateLoadReducer, from);

test("uçuşta temizlenen efekt: faz idle'a döner, uyarı görünür kalabilir", () => {
  const state = run([{ type: "start" }, { type: "cancel" }]);
  assert.equal(state.phase, "idle");
  // Okur daha önce sunucunun "yok" dediği güne döndü: uyarı gizlenmez.
  assert.equal(ratesFailedOf(state, ["2026-01-01"], { "2026-01-01": null }), true);
});

test("uçuş sürerken uyarı basılmaz", () => {
  const state = run([{ type: "start" }]);
  assert.equal(ratesFailedOf(state, ["2026-01-01"], { "2026-01-01": null }), false);
});

test("ikinci parti ilk partinin hatasını silmez", () => {
  const first = ["2025-01-02", "2025-01-03"];
  const second = ["2025-03-03"];
  const state = run([
    { type: "start" },
    { type: "settle", dates: first, ok: false },
    { type: "start" },
    { type: "settle", dates: second, ok: true },
  ]);
  assert.deepEqual([...state.failed].sort(), first);
  assert.equal(ratesFailedOf(state, [...first, ...second], { "2025-03-03": { buying: 1 } }), true);
});

test("başarılı parti yalnız kendi günlerini temizler", () => {
  const state = run([
    { type: "settle", dates: ["a", "b"], ok: false },
    { type: "settle", dates: ["a"], ok: true },
  ]);
  assert.deepEqual([...state.failed], ["b"]);
});

test("Tekrar Dene düşen günleri boşaltır; hata yoksa aynı nesne", () => {
  const failed = run([{ type: "settle", dates: ["a"], ok: false }]);
  assert.equal(rateLoadReducer(failed, { type: "retry" }).failed.size, 0);
  assert.equal(rateLoadReducer(RATE_LOAD_IDLE, { type: "retry" }), RATE_LOAD_IDLE);
  assert.equal(rateLoadReducer(RATE_LOAD_IDLE, { type: "cancel" }), RATE_LOAD_IDLE);
});

test("uyarı yalnız GEREKEN günlere bakar: hatalı tarih düzeltilince kalkar", () => {
  const state = run([{ type: "settle", dates: ["a"], ok: false }]);
  assert.equal(ratesFailedOf(state, ["a"], {}), true);
  assert.equal(ratesFailedOf(state, ["b"], { b: { buying: 1 } }), false);
  assert.equal(ratesFailedOf(RATE_LOAD_IDLE, ["b"], { b: { buying: 1 } }), false);
});
