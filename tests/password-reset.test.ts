import test from "node:test";
import assert from "node:assert/strict";
import { hashResetToken, looksLikeResetToken, newResetToken, resetEmail } from "../lib/password-reset";
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
  const mail = resetEmail({ to: "a@b.co", username: "<b>ali</b>", link, copy: tr.passwordReset.mail });
  assert.equal(mail.subject, tr.passwordReset.mail.subject);
  assert.ok(mail.text.includes(link));
  assert.ok(mail.html.includes(link));
  assert.ok(mail.html.includes("&lt;b&gt;ali&lt;/b&gt;"));
  assert.ok(!mail.html.includes("<b>ali</b>"));
});
