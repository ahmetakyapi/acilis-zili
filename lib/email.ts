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
export type EmailProvider = "resend" | "brevo";

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
};

/** Gönderir; servis kabul ettiyse true. Hata fırlatmaz — çağıran günlüğe bakmaz. */
export async function sendEmail(email: Email): Promise<boolean> {
  if (!emailConfigured()) return false;
  if (emailProvider() === "brevo") return sendWithBrevo(email);
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY!.trim()}`,
        "Content-Type": "application/json",
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
      return false;
    }
    return true;
  } catch (error) {
    console.error(`[e-posta] gönderilemedi: ${error instanceof Error ? error.message : String(error)}`);
    return false;
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

async function sendWithBrevo(email: Email): Promise<boolean> {
  try {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
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
      return false;
    }
    return true;
  } catch (error) {
    console.error(`[e-posta] brevo gönderemedi: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}
