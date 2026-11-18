import assert from "node:assert/strict";
import test from "node:test";
import { RATE_LIMIT_MAX_WAIT_MS, rateLimitWaitMs, retryOnRateLimit } from "../lib/providers/rate-limit";

const NOW = Date.parse("2026-11-18T15:06:02Z");
const noJitter = () => 0;
const res = (status: number, headers: Record<string, string> = {}) => ({ status, headers: new Headers(headers) });

test("Retry-After in seconds wins", () => {
  assert.equal(rateLimitWaitMs(res(429, { "retry-after": "3", "x-ratelimit-reset": String(NOW / 1000 + 50) }), 0, NOW, noJitter), 3000);
});

test("Retry-After as an HTTP date", () => {
  const at = new Date(NOW + 2500).toUTCString();
  const wait = rateLimitWaitMs(res(429, { "retry-after": at }), 0, NOW, noJitter);
  // HTTP tarihi saniye çözünürlüklü: 2–3 sn arası.
  assert.ok(wait >= 2000 && wait <= 3000, String(wait));
});

test("X-RateLimit-Reset (Unix seconds) — Alpaca and Finnhub", () => {
  assert.equal(rateLimitWaitMs(res(429, { "x-ratelimit-reset": String(NOW / 1000 + 4) }), 0, NOW, noJitter), 4000);
});

test("a far reset is capped so a page render is not held for a minute", () => {
  assert.equal(rateLimitWaitMs(res(429, { "x-ratelimit-reset": String(NOW / 1000 + 58) }), 0, NOW, noJitter), RATE_LIMIT_MAX_WAIT_MS);
  assert.equal(rateLimitWaitMs(res(429, { "x-ratelimit-reset": String(NOW / 1000 + 58) }), 0, NOW, () => 0.99), RATE_LIMIT_MAX_WAIT_MS);
});

test("no header or a past reset falls back to 1 s, 2 s", () => {
  assert.equal(rateLimitWaitMs(res(429), 0, NOW, noJitter), 1000);
  assert.equal(rateLimitWaitMs(res(429), 1, NOW, noJitter), 2000);
  assert.equal(rateLimitWaitMs(res(429, { "x-ratelimit-reset": String(NOW / 1000 - 5) }), 0, NOW, noJitter), 1000);
});

test("jitter spreads callers that were limited in the same second", () => {
  const a = rateLimitWaitMs(res(429), 0, NOW, () => 0);
  const b = rateLimitWaitMs(res(429), 0, NOW, () => 0.9);
  assert.ok(b > a);
});

test("retries 429 then returns the first success", async () => {
  const seq = [429, 429, 200];
  const waits: number[] = [];
  let calls = 0;
  const out = await retryOnRateLimit(async () => ({ res: res(seq[calls++]) }), {
    sleep: async (ms) => { waits.push(ms); },
    now: () => NOW,
  });
  assert.equal(out.res.status, 200);
  assert.equal(calls, 3);
  assert.equal(waits.length, 2);
});

test("gives up after the retry budget and returns the last 429", async () => {
  let calls = 0;
  const out = await retryOnRateLimit(async () => { calls++; return { res: res(429) }; }, { sleep: async () => {} });
  assert.equal(out.res.status, 429);
  assert.equal(calls, 3);
});

test("other errors are not retried", async () => {
  for (const status of [200, 403, 404, 500]) {
    let calls = 0;
    await retryOnRateLimit(async () => { calls++; return { res: res(status) }; }, { sleep: async () => { throw new Error("slept"); } });
    assert.equal(calls, 1, String(status));
  }
});
