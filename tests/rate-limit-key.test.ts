import test from "node:test";
import assert from "node:assert/strict";
import { forwardedKey } from "../lib/rate-limit";

/** Oran sınırı anahtarı (lib/rate-limit.ts → forwardedKey) — giriş sayacı ve formun okuması aynı kovayı görmeli. */

test("aynı /64 içindeki iki IPv6 adresi aynı giriş kovasına düşer", () => {
  assert.equal(forwardedKey("signin", "2a01:db8:1:2::5"), forwardedKey("signin", "2a01:db8:1:2:ffff::6"));
  assert.equal(forwardedKey("signin", "2a01:db8:1:2:3:4:5:6"), "signin:2a01:db8:1:2");
});

test("komşu /64 ayrı kovada kalır", () => {
  assert.notEqual(forwardedKey("signin", "2a01:db8:1:2::5"), forwardedKey("signin", "2a01:db8:1:3::5"));
});

test("zincirde ilk adres alınır; IPv4 olduğu gibi kalır", () => {
  assert.equal(forwardedKey("signin", "203.0.113.7, 10.0.0.1"), "signin:203.0.113.7");
  assert.equal(forwardedKey("signin", "::ffff:203.0.113.7"), "signin:::ffff:203.0.113.7");
});

test("başlık yoksa ortak bilinmeyen kovası", () => {
  assert.equal(forwardedKey("signin", null), "signin:bilinmeyen");
  assert.equal(forwardedKey("signin", ""), "signin:bilinmeyen");
});
