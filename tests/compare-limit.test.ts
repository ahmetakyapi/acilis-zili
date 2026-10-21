import test from "node:test";
import assert from "node:assert/strict";
import { allowCompareSet, COMPARE_NEW_SET_LIMIT } from "../lib/compare-limit";
import { getBarsMulti } from "../lib/providers/alpaca";

/** Karşılaştırmanın yeni küme kapısı (lib/compare-limit.ts) ve sıralı bar anahtarı. */

test("yalnız ilk kez görülen küme IP'nin hakkından düşer; sıra kümeyi değiştirmez", () => {
  const ip = "compare-new:test-1";
  for (let i = 0; i < COMPARE_NEW_SET_LIMIT; i++) {
    assert.equal(allowCompareSet([`A${i}`, "ZZT1"], "6M", ip).allowed, true);
  }
  // Görülmüş küme (ters sırayla bile) sayılmaz, hak bitmiş olsa da geçer.
  assert.equal(allowCompareSet(["ZZT1", "A0"], "6M", ip).allowed, true);
  // Yeni küme reddedilir.
  const denied = allowCompareSet(["YENI", "ZZT1"], "6M", ip);
  assert.equal(denied.allowed, false);
  assert.ok(denied.retryAfter > 0);
});

test("reddedilen küme görüldü sayılmaz — başka adres ilk görüşte sayılır", () => {
  const a = "compare-new:test-2a";
  const b = "compare-new:test-2b";
  for (let i = 0; i < COMPARE_NEW_SET_LIMIT; i++) allowCompareSet([`B${i}`, "ZZT2"], "1Y", a);
  assert.equal(allowCompareSet(["RED", "ZZT2"], "1Y", a).allowed, false);
  // `a` reddedildi; küme yazılmadı, yani `b` için hâlâ yeni ve `b`nin hakkından düşer.
  for (let i = 0; i < COMPARE_NEW_SET_LIMIT - 1; i++) allowCompareSet([`C${i}`, "ZZT2"], "1Y", b);
  assert.equal(allowCompareSet(["RED", "ZZT2"], "1Y", b).allowed, true);
  assert.equal(allowCompareSet(["SON", "ZZT2"], "1Y", b).allowed, false);
});

test("aralık kümenin parçası: aynı semboller başka aralıkta yeni sayılır", () => {
  const ip = "compare-new:test-3";
  for (let i = 0; i < COMPARE_NEW_SET_LIMIT - 1; i++) allowCompareSet([`D${i}`, "ZZT3"], "1M", ip);
  assert.equal(allowCompareSet(["NVDA", "ZZT3"], "1M", ip).allowed, true);
  assert.equal(allowCompareSet(["NVDA", "ZZT3"], "5Y", ip).allowed, false);
});

test("çok sembollü bar isteği sırayı adrese taşımaz", async () => {
  const fetchBefore = globalThis.fetch;
  const key = process.env.ALPACA_API_KEY_ID, secret = process.env.ALPACA_API_SECRET_KEY;
  process.env.ALPACA_API_KEY_ID = "fixture"; process.env.ALPACA_API_SECRET_KEY = "fixture";
  const requested: string[] = [];
  globalThis.fetch = async (input) => {
    requested.push(new URL(String(input)).searchParams.get("symbols")!);
    return Response.json({ bars: {} });
  };
  try {
    await getBarsMulti(["NVDA", "AMD", "MU"], "1M", 0);
    await getBarsMulti(["MU", "NVDA", "AMD"], "1M", 0);
    assert.deepEqual(requested, ["AMD,MU,NVDA", "AMD,MU,NVDA"]);
  } finally {
    globalThis.fetch = fetchBefore;
    if (key === undefined) delete process.env.ALPACA_API_KEY_ID; else process.env.ALPACA_API_KEY_ID = key;
    if (secret === undefined) delete process.env.ALPACA_API_SECRET_KEY; else process.env.ALPACA_API_SECRET_KEY = secret;
  }
});
