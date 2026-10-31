import assert from "node:assert/strict";
import test from "node:test";
import { TimeoutError, withTimeout } from "../lib/providers/timeout";

const after = <T,>(ms: number, value: T) => new Promise<T>((resolve) => setTimeout(() => resolve(value), ms));

test("withTimeout: süre içinde gelen sonuç aynen döner", async () => {
  assert.equal(await withTimeout(after(5, "canlı"), 200), "canlı");
});

test("withTimeout: süre dolunca TimeoutError — getQuotesWithin bunu yedeğe çeviriyor", async () => {
  await assert.rejects(withTimeout(after(200, "geç"), 10), (error) => error instanceof TimeoutError);
});

test("withTimeout: alttaki hata TimeoutError değildir, olduğu gibi geçer", async () => {
  await assert.rejects(withTimeout(Promise.reject(new Error("sağlayıcı")), 200), (error) => !(error instanceof TimeoutError));
});
