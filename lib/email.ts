/**
 * E-POSTA — gönderici (9 Ekim). Tek kullanıcısı şimdilik şifre sıfırlama
 * (lib/password-reset.ts).
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

export function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim() && process.env.EMAIL_FROM?.trim());
}

export type Email = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

/** Gönderir; servis kabul ettiyse true. Hata fırlatmaz — çağıran günlüğe bakmaz. */
export async function sendEmail(email: Email): Promise<boolean> {
  if (!emailConfigured()) return false;
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
