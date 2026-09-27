import test from "node:test";
import assert from "node:assert/strict";
import {
  ERROR_MESSAGE_MAX,
  describeError,
  errorFingerprint,
  scrubErrorText,
} from "../lib/error-log-core";

/**
 * Hata günlüğünün saf parçaları. Tablo kişisel veri tutmuyor (lib/schema.ts
 * → appErrors); mesajın kendisi sızıntı yüzeyi olabildiği için örtme ve
 * kırpma burada sınanıyor.
 */

test("e-posta ve IP biçimli parçalar örtülüyor", () => {
  const out = scrubErrorText(
    'duplicate key value violates unique constraint "users_email_key" Key (email)=(ali.veli+x@ornek.com.tr) from 192.168.1.20',
    ERROR_MESSAGE_MAX,
  );
  assert.ok(!out.includes("ornek.com"));
  assert.ok(!out.includes("192.168"));
  assert.match(out, /\[e-posta\]/);
  assert.match(out, /\[ip\]/);
});

test("saat ve iki noktalı künyeler IPv6 sanılmıyor", () => {
  assert.equal(scrubErrorText("16:30 TR · Key:Value", 100), "16:30 TR · Key:Value");
  assert.equal(scrubErrorText("from 2001:db8:85a3:0:0:8a2e:370:7334", 100), "from [ip]");
});

test("uzun metin sınırda kırpılıyor", () => {
  const out = scrubErrorText("a".repeat(900), ERROR_MESSAGE_MAX);
  assert.equal(out.length, ERROR_MESSAGE_MAX);
  assert.ok(out.endsWith("…"));
});

test("sunucu hatasının parmak izi digest'in kendisi", () => {
  assert.equal(errorFingerprint("server", "123456789", "x"), "123456789");
});

test("istemci hatası mesajın ilk satırından: bileşen yığını izi değiştirmiyor", () => {
  const a = errorFingerprint("client", null, "Cannot read properties of undefined\n    at Foo");
  const b = errorFingerprint("client", null, "Cannot read properties of undefined\n    at Bar");
  assert.equal(a, b);
  assert.equal(a.length, 16);
  assert.notEqual(a, errorFingerprint("server", null, "Cannot read properties of undefined"));
});

test("Error olmayan fırlatılan değer de okunuyor", () => {
  assert.deepEqual(describeError("düz metin"), { message: "düz metin", stack: null, digest: null });
  const withDigest = Object.assign(new Error("boom"), { digest: "42" });
  assert.equal(describeError(withDigest).digest, "42");
  assert.equal(describeError(withDigest).message, "boom");
});
