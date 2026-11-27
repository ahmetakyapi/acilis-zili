import assert from "node:assert/strict";
import test from "node:test";
import { alpacaRequestKind, COOLDOWN_FALLBACK_MS, quotaSaving, resetHeaderMs, SAVE_BELOW, WINDOW_MS } from "../lib/providers/quota-guard";

/* Alpaca kota koruması (lib/providers/quota-guard.ts). */

const T = 1_800_000_000_000;
const none = { remaining: null, remainingAt: null, resetAt: null, lastRateLimitedAt: null };

test("bilgi yoksa ya da kalan hak bolsa koruma yok", () => {
  assert.equal(quotaSaving(none, T), false);
  assert.equal(quotaSaving({ ...none, remaining: 150, remainingAt: T - 1000, resetAt: T + 30_000 }, T), false);
  assert.equal(quotaSaving({ ...none, remaining: SAVE_BELOW + 1, remainingAt: T, resetAt: T + 30_000 }, T), false);
});

test("kalan hak eşikte: pencere sıfırlanana kadar koruma, sonra biter", () => {
  const r = { ...none, remaining: SAVE_BELOW, remainingAt: T, resetAt: T + 20_000 };
  assert.equal(quotaSaving(r, T + 1000), true);
  assert.equal(quotaSaving(r, T + 20_000), false);
  /* Sıfırlanma başlığı yoksa en çok bir pencere. */
  const noReset = { ...r, resetAt: null };
  assert.equal(quotaSaving(noReset, T + WINDOW_MS - 1), true);
  assert.equal(quotaSaving(noReset, T + WINDOW_MS), false);
  /* Eski bir sıfırlanma anı (önceki pencere) okumayı uzatmaz. */
  assert.equal(quotaSaving({ ...r, resetAt: T - 5000 }, T + WINDOW_MS), false);
});

test("429 sonrası sıfırlanmaya kadar, başlık yoksa kısa bekleme", () => {
  const r = { ...none, lastRateLimitedAt: T, resetAt: T + 40_000 };
  assert.equal(quotaSaving(r, T + 39_000), true);
  assert.equal(quotaSaving(r, T + 40_000), false);
  const noReset = { ...none, lastRateLimitedAt: T };
  assert.equal(quotaSaving(noReset, T + COOLDOWN_FALLBACK_MS - 1), true);
  assert.equal(quotaSaving(noReset, T + COOLDOWN_FALLBACK_MS), false);
  /* Bozuk, çok uzak sıfırlanma anı korumayı bir pencereden fazla uzatmaz. */
  assert.equal(quotaSaving({ ...none, lastRateLimitedAt: T, resetAt: T + 3_600_000 }, T + WINDOW_MS), false);
});

test("sıfırlanma başlığı saniye ya da ms", () => {
  assert.equal(resetHeaderMs("1800000000"), 1_800_000_000_000);
  assert.equal(resetHeaderMs("1800000000000"), 1_800_000_000_000);
  assert.equal(resetHeaderMs(null), null);
  assert.equal(resetHeaderMs(""), null);
  assert.equal(resetHeaderMs("abc"), null);
});

test("istek türü adresten", () => {
  assert.equal(alpacaRequestKind("https://data.alpaca.markets/v2/stocks/snapshots?symbols=MU"), "snapshots");
  assert.equal(alpacaRequestKind("https://data.alpaca.markets/v2/stocks/bars/latest?symbols=MU&feed=iex"), "latest-bars");
  assert.equal(alpacaRequestKind("https://data.alpaca.markets/v2/stocks/bars?symbols=MU"), "bars");
  assert.equal(alpacaRequestKind("https://data.alpaca.markets/v2/stocks/MU/bars?timeframe=1Day"), "bars");
  assert.equal(alpacaRequestKind("https://data.alpaca.markets/v1/corporate-actions?symbols=MU"), "corporate");
  assert.equal(alpacaRequestKind("https://data.alpaca.markets/v1beta1/options/snapshots/MU"), "options");
});

test("sağlık izi: düşük kalan hak korumayı açar, istek türleri sayılır, önbellek yanıtı sayılmaz", async () => {
  const { noteProviderResponse, providerSaving, providerUsage } = await import("../lib/providers/usage");
  const now = new Date("2026-11-27T15:08:00Z");
  const res = (remaining: number, at: Date, status = 200) =>
    new Response("{}", { status, headers: { date: at.toUTCString(), "x-ratelimit-remaining": String(remaining), "x-ratelimit-reset": String(Math.floor(at.getTime() / 1000) + 30) } });
  noteProviderResponse("alpaca", res(150, now), now, "snapshots");
  assert.equal(providerSaving("alpaca", now), false);
  noteProviderResponse("alpaca", res(3, now), now, "latest-bars");
  assert.equal(providerSaving("alpaca", new Date(now.getTime() + 5_000)), true);
  assert.equal(providerSaving("alpaca", new Date(now.getTime() + 31_000)), false);
  /* Next önbelleğinden gelen eski yanıt gerçek istek sayılmaz. */
  noteProviderResponse("alpaca", res(150, new Date(now.getTime() - 120_000)), now, "bars");
  const usage = providerUsage(now).providers.alpaca;
  assert.deepEqual(usage.requestsLastHour, { snapshots: 1, "latest-bars": 1 });
});
