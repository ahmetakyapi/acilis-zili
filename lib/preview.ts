/**
 * Yönetimin CİHAZ ÖNİZLEMESİ — ortak sözleşme (31 Ekim).
 *
 * `/admin/onizleme` sitenin kendi bir sayfasını iki `<iframe>` içinde
 * (telefon 390 × 844, masaüstü 1440 genişlik) yan yana çiziyor. Site her
 * yanıtta `X-Frame-Options: DENY` + `frame-ancestors 'none'` gönderiyor, yani
 * çerçeve normalde boş kalır. İstisna DAR ve üç katlı:
 *
 * 1. BAŞLIK (next.config.ts): `?onizleme=1` taşıyan istek DENY yerine
 *    `SAMEORIGIN` + `frame-ancestors 'self'` alır. Gevşeme "her yere" değil
 *    YALNIZ AYNI KÖKE: tıklama hırsızlığının (clickjacking) saldırganı başka
 *    bir kökende oturur ve tarayıcı onun çerçevesini yine reddeder — parametreyi
 *    kendisi eklese bile. İki kural aynı sorgu anahtarının `has`/`missing`
 *    çiftiyle seçiliyor: arada boşluk yok, her istek tam birini alıyor.
 * 2. KAPI (proxy.ts): parametreli istek, oturum çerezindeki JWT "admin"
 *    demiyorsa parametresiz adrese yönlendirilir → DENY'e geri düşer. Yalnız
 *    çerez çözülüyor (veritabanı yok); rol görünüm içindir, yetki değil —
 *    ama burada açılan şey zaten herkese açık bir sayfanın aynı köke
 *    çerçevelenebilmesi. Asıl koruma 1. madde; bu kat derinlik.
 * 3. YOL (`previewPathError`): `/admin`, `/api` ve site dışı adresler
 *    önizlenmez — yönetim ekranları formlarıyla birlikte hiçbir koşulda
 *    çerçevelenemez. Çerçeve de `sandbox`lı: form gönderemez, üst pencereyi
 *    yönlendiremez (önizlemede yanlışlıkla bir yazma eylemi tetiklenmesin).
 *
 * `/gomulu/*` bu kuralın DIŞINDA ve olduğu gibi (`frame-ancestors *`).
 *
 * Dosya `"use client"` DEĞİL ve bağımlılıksız: next.config.ts, proxy.ts, sayfa
 * ve istemci bileşeni aynı sabitleri okuyor.
 */

/** Önizleme isteğinin işareti — sitenin bütün sorgu parametreleri Türkçe. */
export const PREVIEW_PARAM = "onizleme";

/** Çerçevenin teması — gömülü parçalarla aynı parametre ve değerler (`lib/embed.ts`). */
export const PREVIEW_THEME_PARAM = "tema";

export type PreviewTheme = "acik" | "koyu";
export type PreviewLocale = "tr" | "en";

/** Cihaz ölçüleri — CSS pikseli. Telefon iPhone 15/16 sınıfı, masaüstü 1440. */
export const PREVIEW_DEVICES = {
  phone: { width: 390, height: 844 },
  desktop: { width: 1440, height: 900 },
} as const;

/** Yolun en çok uzunluğu — adres çubuğuna yapıştırılan kuyruklu bağlantılar için yeter. */
const MAX_PATH = 300;

/** Önizlenmeyen yol önekleri (dil öneksiz). */
const BLOCKED_PREFIXES = ["/admin", "/api", "/_next"] as const;

/**
 * Girilen adresi yola indirger: tam adres (`https://aciliszili.com/x`) ise
 * yalnız yol + sorgu kalır, kök bilgisi atılır — çerçeve HER ZAMAN sitenin
 * kendi kökünde açılır, başka bir alan adına gidemez.
 */
export function normalizePreviewInput(raw: string | null | undefined): string {
  const value = (raw ?? "").trim();
  if (!value) return "/";
  if (/^https?:\/\//i.test(value)) {
    try {
      const url = new URL(value);
      return `${url.pathname}${url.search}`;
    } catch {
      return value;
    }
  }
  return value.startsWith("/") ? value : `/${value}`;
}

/** Dil önekini ayırır: `/en/piyasalar` → `{ locale: "en", path: "/piyasalar" }`. */
export function splitPreviewLocale(path: string): { locale: PreviewLocale | null; path: string } {
  if (path === "/en" || path.startsWith("/en/") || path.startsWith("/en?")) {
    const rest = path.slice(3);
    return { locale: "en", path: rest === "" || rest.startsWith("?") ? `/${rest}` : rest };
  }
  return { locale: null, path };
}

/**
 * Yol önizlenebilir mi? Değilse kullanıcıya gösterilecek cümle, öyleyse `null`.
 * Yol dil ÖNEKSİZ beklenir (önce `splitPreviewLocale`).
 */
export function previewPathError(path: string): string | null {
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\")) {
    return "Yalnız sitenin kendi yolları önizlenir; adres / ile başlamalı.";
  }
  if (path.length > MAX_PATH) return "Adres çok uzun.";
  if (/[\u0000-\u001f\s]/.test(path)) return "Adreste boşluk ya da denetim karakteri olamaz.";
  const bare = path.split(/[?#]/)[0].toLowerCase();
  if (BLOCKED_PREFIXES.some((p) => bare === p || bare.startsWith(`${p}/`))) {
    return "Yönetim ekranları ve API uçları önizlenmez.";
  }
  return null;
}

/** Proxy'nin kapısı da aynı yasakları uygular — `/admin?onizleme=1` hiçbir koşulda gevşemez. */
export function isPreviewablePath(path: string): boolean {
  return previewPathError(path) === null;
}

/**
 * Çerçevenin adresi: dil öneki + yol + `onizleme=1` + tema. Yolun kendi sorgusu
 * korunur, parmak izi (`#`) sona taşınır.
 */
export function previewSrc(
  path: string,
  { locale, theme }: { locale: PreviewLocale; theme: PreviewTheme },
): string {
  const [beforeHash, hash = ""] = path.split("#", 2);
  const [pathname, query = ""] = beforeHash.split("?", 2);
  const params = new URLSearchParams(query);
  params.delete(PREVIEW_PARAM);
  params.delete(PREVIEW_THEME_PARAM);
  params.set(PREVIEW_PARAM, "1");
  params.set(PREVIEW_THEME_PARAM, theme);
  const prefixed = locale === "en" ? (pathname === "/" ? "/en" : `/en${pathname}`) : pathname;
  return `${prefixed}?${params.toString()}${hash ? `#${hash}` : ""}`;
}

/** Adres çubuğunda gösterilen yol — önizleme parametreleri olmadan. */
export function previewDisplayPath(path: string, locale: PreviewLocale): string {
  const prefixed = locale === "en" ? (path === "/" ? "/en" : `/en${path}`) : path;
  return prefixed;
}
