import test from "node:test";
import assert from "node:assert/strict";
import { hashResetToken, looksLikeResetToken, newResetToken, requestedAtLabel, resetEmail } from "../lib/password-reset";
import tr from "../lib/i18n/dictionaries/tr";

/** Şifre sıfırlamanın saf kısmı (lib/password-reset.ts). */

test("anahtar 43 karakterlik base64url ve her seferinde farklı", () => {
  const a = newResetToken();
  const b = newResetToken();
  assert.equal(looksLikeResetToken(a), true);
  assert.notEqual(a, b);
});

test("biçim denetimi çöp girdiyi veritabanına göndermeden eler", () => {
  assert.equal(looksLikeResetToken(""), false);
  assert.equal(looksLikeResetToken("kisa"), false);
  assert.equal(looksLikeResetToken("a".repeat(42) + "!"), false);
  assert.equal(looksLikeResetToken(undefined), false);
});

test("satırda anahtarın kendisi değil özeti duruyor", () => {
  const token = newResetToken();
  const digest = hashResetToken(token);
  assert.match(digest, /^[0-9a-f]{64}$/);
  assert.notEqual(digest, token);
  assert.equal(hashResetToken(token), digest);
});

test("e-posta kullanıcı adını kaçışlıyor, bağlantı iki gövdede de var", () => {
  const link = "https://example.com/sifre-sifirla?anahtar=abc";
  const requestedAt = new Date(Date.UTC(2026, 9, 16, 15, 4));
  const mail = resetEmail({ to: "a@b.co", username: "<b>ali</b>", link, lang: "tr", requestedAt, copy: tr.passwordReset.mail });
  assert.equal(mail.subject, tr.passwordReset.mail.subject);
  assert.ok(mail.text.includes(link));
  assert.ok(mail.html.includes(link));
  assert.ok(mail.html.includes("&lt;b&gt;ali&lt;/b&gt;"));
  assert.ok(!mail.html.includes("<b>ali</b>"));
  /* İstek zamanı iki gövdede de, okuyucunun duvar saatinde. */
  assert.ok(mail.text.includes("İstek Zamanı: 16 Ekim 2026 · 18:04 İstanbul"));
  assert.ok(mail.html.includes("16 Ekim 2026 · 18:04 İstanbul"));
  /* Bant GIF'i ve marka fontu sitenin kökünden — üçüncü tarafa istek yok. */
  assert.ok(mail.html.includes("https://example.com/email/hero.gif"));
  assert.ok(mail.html.includes("https://example.com/email/schibsted-grotesk-latin.woff2"));
  assert.ok(!/fonts\.(googleapis|gstatic)\.com/.test(mail.html));
});

test("istek zamanı: TR İstanbul, EN New York duvar saati", () => {
  const at = new Date(Date.UTC(2026, 9, 16, 15, 4)); // yaz saati: İstanbul +3, New York −4
  assert.equal(requestedAtLabel(at, "tr", "İstanbul"), "16 Ekim 2026 · 18:04 İstanbul");
  assert.equal(requestedAtLabel(at, "en", "New York"), "October 16, 2026 · 11:04 New York");
  /* Gece yarısı 24:00 değil 00:00 (formatInZone kuralı). */
  const midnight = new Date(Date.UTC(2026, 9, 16, 21, 0));
  assert.equal(requestedAtLabel(midnight, "tr", "İstanbul"), "17 Ekim 2026 · 00:00 İstanbul");
});
