import test from "node:test";
import assert from "node:assert/strict";
import { emailIdempotent, emailRejected, idempotencyHeader, sendEmail, type Email, type EmailResult } from "../lib/email";
import { sendStep } from "../lib/email-notify";

/**
 * Gönderim sonucunun üç hâli (lib/email.ts → EmailResult) ve bildirim
 * postasının kararı (lib/email-notify.ts → sendStep). Belirsiz sonuç
 * "gitmedi" sayılırsa aynı posta iki kez teslim edilir.
 */

const mail: Email = { to: "okur@example.com", subject: "Konu", text: "metin", html: "<p>metin</p>" };

async function withEnv<T>(env: Record<string, string | undefined>, run: () => Promise<T>): Promise<T> {
  const saved = { ...process.env };
  try {
    for (const [key, value] of Object.entries(env)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    return await run();
  } finally {
    process.env = saved;
  }
}

const resendEnv = { RESEND_API_KEY: "re_test", BREVO_API_KEY: undefined, EMAIL_PROVIDER: undefined, EMAIL_FROM: "Açılış Zili <hesap@example.com>" };
const brevoEnv = { RESEND_API_KEY: undefined, BREVO_API_KEY: "b_test", EMAIL_PROVIDER: undefined, EMAIL_FROM: "Açılış Zili <hesap@example.com>" };

/** Sahte fetch: verilen yanıtı döner ya da fırlatır, isteği kaydeder. */
function fakeFetch(outcome: number | Error) {
  const calls: { url: string; init: RequestInit }[] = [];
  const impl = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    if (outcome instanceof Error) throw outcome;
    return new Response(outcome >= 400 ? '{"message":"x"}' : '{"id":"1"}', { status: outcome });
  }) as typeof fetch;
  return { impl, calls };
}

test("ret sınıfı: 4xx kesin, 409 / 5xx / 2xx değil", () => {
  for (const status of [400, 401, 403, 422, 429]) assert.equal(emailRejected(status), true, String(status));
  for (const status of [200, 409, 500, 502, 503]) assert.equal(emailRejected(status), false, String(status));
});

test("sendEmail (Resend): ok, kesin ret ve belirsiz dallar", async () => {
  const silence = console.error;
  console.error = () => undefined;
  try {
    await withEnv(resendEnv, async () => {
      const cases: [number | Error, EmailResult][] = [
        [200, { ok: true }],
        [422, { ok: false, rejected: true }],
        [429, { ok: false, rejected: true }],
        [409, { ok: false, rejected: false }],
        [500, { ok: false, rejected: false }],
        [new Error("The operation was aborted due to timeout"), { ok: false, rejected: false }],
      ];
      for (const [outcome, expected] of cases) {
        const { impl } = fakeFetch(outcome);
        assert.deepEqual(await sendEmail(mail, impl), expected, String(outcome));
      }
    });
  } finally {
    console.error = silence;
  }
});

test("sendEmail (Brevo): aynı üç hâl", async () => {
  const silence = console.error;
  console.error = () => undefined;
  try {
    await withEnv(brevoEnv, async () => {
      assert.deepEqual(await sendEmail(mail, fakeFetch(201).impl), { ok: true });
      assert.deepEqual(await sendEmail(mail, fakeFetch(400).impl), { ok: false, rejected: true });
      assert.deepEqual(await sendEmail(mail, fakeFetch(503).impl), { ok: false, rejected: false });
      assert.deepEqual(await sendEmail(mail, fakeFetch(new Error("ağ")).impl), { ok: false, rejected: false });
    });
  } finally {
    console.error = silence;
  }
});

test("ayar yoksa istek atılmaz ve sonuç kesin ret", async () => {
  await withEnv({ RESEND_API_KEY: undefined, BREVO_API_KEY: undefined, EMAIL_FROM: undefined }, async () => {
    const { impl, calls } = fakeFetch(200);
    assert.deepEqual(await sendEmail(mail, impl), { ok: false, rejected: true });
    assert.equal(calls.length, 0);
  });
});

test("Idempotency-Key: Resend'e anahtarla gider, uzun anahtar özetlenir", async () => {
  await withEnv(resendEnv, async () => {
    assert.equal(emailIdempotent(), true);
    const { impl, calls } = fakeFetch(200);
    await sendEmail({ ...mail, idempotencyKey: "alert:abc:2026-11-08T14:00:00.000Z" }, impl);
    await sendEmail(mail, impl);
    const headers = calls.map((call) => call.init.headers as Record<string, string>);
    assert.equal(headers[0]!["Idempotency-Key"], "alert:abc:2026-11-08T14:00:00.000Z");
    assert.equal("Idempotency-Key" in headers[1]!, false);
  });
  const long = "weekly-resend:" + "x".repeat(300);
  assert.match(idempotencyHeader(long), /^[0-9a-f]{64}$/);
  assert.equal(idempotencyHeader(long), idempotencyHeader(long));
  assert.equal(idempotencyHeader("kısa"), "kısa");
  await withEnv(brevoEnv, async () => assert.equal(emailIdempotent(), false));
});

test("sendStep: gitti → sent; kesin ret → alarmda bir tekrar, sonra geri al", () => {
  const ok: EmailResult = { ok: true };
  const rejected: EmailResult = { ok: false, rejected: true };
  assert.equal(sendStep(ok, 1, "alert", false), "sent");
  assert.equal(sendStep(ok, 2, "weekly", true), "sent");
  assert.equal(sendStep(rejected, 1, "alert", false), "retry");
  assert.equal(sendStep(rejected, 2, "alert", false), "release");
  assert.equal(sendStep(rejected, 1, "weekly", true), "release");
});

test("sendStep: belirsiz sonuç satırı tutar, kör tekrar YOK", () => {
  const unknown: EmailResult = { ok: false, rejected: false };
  /* Servis anahtarı tanımıyorsa (Brevo) hiç tekrar yok. */
  assert.equal(sendStep(unknown, 1, "alert", false), "keep");
  /* Resend: aynı anahtarla bir tekrar güvenli; ikincisi de belirsizse dur. */
  assert.equal(sendStep(unknown, 1, "alert", true), "retry");
  assert.equal(sendStep(unknown, 2, "alert", true), "keep");
  /* Haftalık belirsizde satırı silmez — sonraki saatlik koşu yeniden atmasın. */
  assert.equal(sendStep(unknown, 1, "weekly", true), "keep");
  assert.equal(sendStep(unknown, 1, "weekly", false), "keep");
});
