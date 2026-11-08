import { createHash } from "node:crypto";

/**
 * E-POSTA — gönderici (9 Ekim). Kullanıcıları şifre sıfırlama
 * (lib/password-reset.ts) ve 16 Ekim'den beri okuyucunun açtığı bildirim
 * postaları (lib/email-notify.ts: alarm, pazar özeti).
 *
 * SERVİS RESEND, SDK YOK. Ücretsiz katmanı ayda 3.000, günde 100 e-posta;
 * bu sitenin hacminde (yalnızca okuyucunun kendi istediği sıfırlama
 * bağlantıları) yeterli. Uç tek bir JSON POST'u ve bir paket bağımlılığı
 * eklemeye değmez: `fetch` ile yazıldı, servis değişirse değişen yalnızca
 * bu dosya.
 *
 * ANAHTARLAR ORTAMDA: `RESEND_API_KEY` ve `EMAIL_FROM` ("Açılış Zili
 * <hesap@alanadi.com>"). Gönderen alan adı Resend'de doğrulanmış olmalı;
 * doğrulanmamış alan adıyla servis yalnızca hesabın kendi adresine
 * gönderiyor. İkisinden biri yoksa `emailConfigured()` false: giriş
 * formundaki "Şifremi Unuttum" bağlantısı hiç basılmıyor — gönderilemeyen
 * bir bağlantı isteyen form, tıklamayı yutmak olurdu.
 */

/**
 * İKİNCİ SERVİS: BREVO (17 Ekim). Resend'in ücretsiz katmanı günde 100
 * posta; Brevo'nunki günde 300. `BREVO_API_KEY` tanımlıysa ve
 * `EMAIL_PROVIDER=brevo` ya da Resend anahtarı yoksa posta Brevo'dan gider.
 * Gönderen adres Brevo'da da doğrulanmış olmalı. Günlük bütçenin varsayılanı
 * servise göre (lib/email-notify.ts → dailyBudget).
 */
type EmailProvider = "resend" | "brevo";

export function emailProvider(): EmailProvider | null {
  const resend = Boolean(process.env.RESEND_API_KEY?.trim());
  const brevo = Boolean(process.env.BREVO_API_KEY?.trim());
  if (brevo && (process.env.EMAIL_PROVIDER === "brevo" || !resend)) return "brevo";
  return resend ? "resend" : null;
}

export function emailConfigured(): boolean {
  return emailProvider() !== null && Boolean(process.env.EMAIL_FROM?.trim());
}

/** "Açılış Zili <hesap@alanadi.com>" → ad ve adres (Brevo gönderen nesnesi). */
function parseFrom(from: string): { name?: string; email: string } {
  const match = /^\s*(.*?)\s*<([^>]+)>\s*$/.exec(from);
  return match ? { name: match[1]?.replace(/^"|"$/g, "") || undefined, email: match[2]! } : { email: from.trim() };
}

export type Email = {
  to: string;
  subject: string;
  text: string;
  html: string;
  /** Ek başlıklar — bildirim postasında `List-Unsubscribe` (tek tıkla çıkış). */
  headers?: Record<string, string>;
  /**
   * Servis tarafı tekrarsızlık anahtarı (8 Kasım) — bildirim postasında
   * defterin `dedupeKey`i. Resend aynı anahtarlı ikinci isteği 24 saat
   * boyunca YENİDEN GÖNDERMEDEN ilkinin yanıtıyla karşılıyor
   * (`Idempotency-Key` başlığı, en çok 256 karakter; uzunsa SHA-256 özeti
   * gider). Brevo'da karşılığı yok: orada yok sayılır (`emailIdempotent`).
   */
  idempotencyKey?: string;
};

/**
 * GÖNDERİM SONUCU ÜÇ HÂLLİ (8 Kasım; Telegram'daki kalıbın eşi —
 * lib/telegram.ts → SendResult). Eskiden boolean dönüyordu ve zaman aşımı
 * da "gitmedi" sayılıyordu: alarm postası 2 sn sonra yeniden gönderiliyor,
 * haftalıkta defter satırı silinip sonraki saatlik koşu postayı bir daha
 * atıyordu — istek servise ulaşıp teslim edildiyse okur aynı postayı iki
 * kez alıyor, günlük bütçe iki kez yanıyordu.
 *   - `rejected: true`: servis AÇIKÇA reddetti (4xx; ayar eksikse de) —
 *     posta gitmedi, kesin. Satır geri alınabilir, yeniden denenebilir.
 *   - `rejected: false`: sonuç BİLİNMİYOR — zaman aşımı, ağ hatası, 5xx ya
 *     da 409 (Resend'de 409 yalnız tekrarsızlık anahtarından gelir: aynı
 *     anahtarlı istek sürüyor ya da daha önce farklı gövdeyle kabul
 *     edildi). Çağıran satırı sahiplenilmiş bırakır, kör yeniden gönderim
 *     yapmaz.
 */
export type EmailResult = { ok: true } | { ok: false; rejected: boolean };

/** HTTP durumu kesin ret mi — 4xx, 409 hariç (gerekçe `EmailResult`). */
export function emailRejected(status: number): boolean {
  return status >= 400 && status < 500 && status !== 409;
}

/** Aynı anahtarla yeniden denemek servis tarafında güvenli mi — yalnız Resend. */
export function emailIdempotent(): boolean {
  return emailProvider() === "resend";
}

/** Resend'in 256 karakter tavanı — uzun anahtarın kendisi değil özeti gider. */
export function idempotencyHeader(key: string): string {
  return key.length <= 256 ? key : createHash("sha256").update(key).digest("hex");
}

/**
 * Gönderir; sonuç üç hâlli (`EmailResult`). Hata fırlatmaz. `fetchImpl`
 * yalnız testler için (tests/email-send.test.ts).
 */
export async function sendEmail(email: Email, fetchImpl: typeof fetch = fetch): Promise<EmailResult> {
  if (!emailConfigured()) return { ok: false, rejected: true };
  if (emailProvider() === "brevo") return sendWithBrevo(email, fetchImpl);
  try {
    const response = await fetchImpl("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY!.trim()}`,
        "Content-Type": "application/json",
        ...(email.idempotencyKey ? { "Idempotency-Key": idempotencyHeader(email.idempotencyKey) } : {}),
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM!.trim(),
        to: [email.to],
        subject: email.subject,
        text: email.text,
        html: email.html,
        ...(email.headers ? { headers: email.headers } : {}),
      }),
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    });
    if (!response.ok) {
      /* Gövde günlüğe yazılıyor ama ALICI yazılmıyor: kişisel veri
         sunucu günlüğüne düşmesin. */
      console.error(`[e-posta] gönderilemedi: http ${response.status} ${(await response.text()).slice(0, 200)}`);
      return { ok: false, rejected: emailRejected(response.status) };
    }
    return { ok: true };
  } catch (error) {
    console.error(`[e-posta] gönderilemedi: ${error instanceof Error ? error.message : String(error)}`);
    return { ok: false, rejected: false };
  }
}

/** HTML gövdesine giren metin — kullanıcı adı gibi değerler kaçışlanır. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function sendWithBrevo(email: Email, fetchImpl: typeof fetch): Promise<EmailResult> {
  try {
    const response = await fetchImpl("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": process.env.BREVO_API_KEY!.trim(),
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        sender: parseFrom(process.env.EMAIL_FROM!),
        to: [{ email: email.to }],
        subject: email.subject,
        htmlContent: email.html,
        textContent: email.text,
        ...(email.headers ? { headers: email.headers } : {}),
      }),
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    });
    if (!response.ok) {
      /* Alıcı günlüğe yazılmıyor (gerekçe yukarıda, Resend dalı). */
      console.error(`[e-posta] brevo gönderemedi: http ${response.status} ${(await response.text()).slice(0, 200)}`);
      return { ok: false, rejected: emailRejected(response.status) };
    }
    return { ok: true };
  } catch (error) {
    console.error(`[e-posta] brevo gönderemedi: ${error instanceof Error ? error.message : String(error)}`);
    return { ok: false, rejected: false };
  }
}
