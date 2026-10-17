import test from "node:test";
import assert from "node:assert/strict";
import { emailProvider } from "../lib/email";

/* Gönderici seçimi (lib/email.ts): Brevo yalnız açıkça seçildiğinde ya da Resend anahtarı yokken. */
test("e-posta servisi: Resend varsayılan, Brevo seçilince ya da tek başınayken", () => {
  const saved = { ...process.env };
  try {
    delete process.env.RESEND_API_KEY;
    delete process.env.BREVO_API_KEY;
    delete process.env.EMAIL_PROVIDER;
    assert.equal(emailProvider(), null);
    process.env.BREVO_API_KEY = "b";
    assert.equal(emailProvider(), "brevo");
    process.env.RESEND_API_KEY = "r";
    assert.equal(emailProvider(), "resend");
    process.env.EMAIL_PROVIDER = "brevo";
    assert.equal(emailProvider(), "brevo");
  } finally {
    process.env = saved;
  }
});
