import { SITE_URL } from "./site";

/**
 * Dosya tabanlı paylaşım görselinin (`opengraph-image.tsx`) MUTLAK adresi —
 * makale JSON-LD'sinin `image` alanı için (14 Kasım 2026, SEO ikinci tur).
 *
 * NEDEN ELLE: Next, rota grubu (`(app)`) içindeki metadata görsel
 * rotalarının adına altı karakterlik bir ek koyar
 * (`/mercek/x/opengraph-image-1a2b3c`); ek, dosyanın `app/` altındaki
 * klasör yolunun djb2 karmasıdır (node_modules/next/dist/lib/metadata/
 * get-metadata-route.js → `getMetadataRouteSuffix`). Sayfa gövdesi kendi
 * `og:image` etiketini okuyamaz, o yüzden aynı hesap burada. Aynı adresi
 * ürettiğini `tests/og-image.test.ts` Next'in kendi fonksiyonuyla
 * karşılaştırır: Next kuralı değiştirirse test düşer, künyeye ölü adres
 * çıkmaz. (`lib/telegram-data.ts` → `ogImageOf` aynı adresi sayfanın
 * HTML'inden okuyor; orada bir ağ turu var, burada yok.)
 *
 * Adres ÖNEKSİZ: sayfanın `og:image`i de öyle (gerekçe lib/og.tsx — kart
 * rotaları dili adresten alamıyor). İkisi aynı dosyayı gösterir.
 */
function djb2(text: string): number {
  let hash = 5381;
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) + hash + text.charCodeAt(i)) & 0xffffffff;
  }
  return hash >>> 0;
}

/** Klasör yolunda rota grubu ya da paralel rota varsa ek; yoksa boş. */
export function ogImageSuffix(routeDir: string): string {
  const special = routeDir.split("/").some((segment) => (segment.startsWith("(") && segment.endsWith(")")) || segment.startsWith("@"));
  return special ? djb2(routeDir).toString(36).slice(0, 6) : "";
}

/**
 * @param routeDir `opengraph-image.tsx`in `app/` altındaki klasörü, başında
 *   eğik çizgiyle: `"/(app)/mercek/[slug]"`.
 * @param path Sayfanın dil öneksiz yolu: `"/mercek/faiz-karari"`.
 */
export function ogImageUrl(routeDir: string, path: string): string {
  const suffix = ogImageSuffix(routeDir);
  return `${SITE_URL}${path}/opengraph-image${suffix ? `-${suffix}` : ""}`;
}
