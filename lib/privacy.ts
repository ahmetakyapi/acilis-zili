/**
 * TUTAR GİZLEME — sözleşme (10 Kasım 2026 gecesi, sahibinin isteği:
 * "tutarlar gizlensin, yüzdelikler gözüksün").
 *
 * Okurun KENDİ parası (portföyün toplamı, K/Z tutarı, pozisyon değeri,
 * maliyet, adet, temettü tutarı) ekranda maskelenebilir; yüzdeler, ağırlıklar
 * ve dağılım şeridi görünür kalır. Piyasa fiyatı ve kur gizlenmez — onlar
 * okurun parası değil, herkesin gördüğü sayı.
 *
 * TERCİH ÇEREZDE, ÖZNİTELİK <html>'DE. Tema ile aynı desen (`az-theme` +
 * `data-theme`): sunucu çerezi okuyup `<html data-privacy>` basar, yani
 * gizleme açıkken sayfa İLK boyamada maskeli gelir — tutar bir kare görünüp
 * sonra kapanmaz. Anahtar (`components/portfolio/PrivacyToggle.tsx`)
 * tıklamada özniteliği anında çevirir ve çerezi tarayıcıda yazar (server
 * action değil; gerekçe `components/layout/preference-controls.tsx` →
 * `writePreference`).
 *
 * MASKE CSS İLE: para basan yer `data-money` taşır (`components/portfolio/Money.tsx`),
 * maske kuralı `app/globals.css` → "TUTAR GİZLEME". Bu modül düz (istemci
 * yönergesi yok): sabitler hem sunucuya hem istemciye gerçek değer olarak
 * gider (`.claude/rules/veri-ve-onbellek.md` → "use client" sınırı).
 */

export const PRIVACY_COOKIE = "az-gizli";
/** Çerezin "açık" değeri — başka her değer kapalı sayılır. */
export const PRIVACY_ON = "1";
/** `<html>` özniteliği; varlığı yeter, değeri boş. */
export const PRIVACY_ATTR = "data-privacy";

/** Çerez değeri gizlemeyi açıyor mu — bozuk ya da boş değer kapalı. */
export function isPrivacyOn(value: string | null | undefined): boolean {
  return value === PRIVACY_ON;
}

/** Tarayıcının yazacağı çerez satırı (ömür tema çereziyle aynı, bir yıl). */
export function privacyCookieLine(on: boolean, secure: boolean): string {
  const tail = `; Path=/; SameSite=Lax${secure ? "; Secure" : ""}`;
  return on ? `${PRIVACY_COOKIE}=${PRIVACY_ON}; Max-Age=${60 * 60 * 24 * 365}${tail}` : `${PRIVACY_COOKIE}=; Max-Age=0${tail}`;
}
