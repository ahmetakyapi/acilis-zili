/**
 * Site sabitleri — tek kaynak.
 *
 * NEXT_PUBLIC_SITE_URL Vercel'de tanımlı; yoksa yerel geliştirme adresine
 * düşer. metadataBase, sitemap ve robots üçü de buradan okur, böylece adres
 * değiştiğinde tek yerde değişir.
 */

export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ??
  // Vercel'de değişken unutulursa üretim alan adına düş; site haritasının
  // localhost adresleri yayması sessiz ama pahalı bir hata olurdu.
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000")
).replace(/\/$/, "");

/**
 * Arama motorlarına açık mı.
 *
 * Uzun süre `false` idi ve bu bir geliştirme kalıntısıydı: site canlı,
 * herkese açık ve rehber yazılarının amacı zaten okunmak. Kapatmak
 * istersen tek yapman gereken burayı `false` yapmak — robots.ts, sitemap.ts
 * ve kök metadata üçü de bu değeri okuyor.
 *
 * Önizleme (preview) dağıtımları asla indekslenmez: aynı içeriğin ikinci bir
 * adreste görünmesi arama motorlarında kopya içerik sayılır.
 */
export const INDEXABLE = process.env.VERCEL_ENV !== "preview";
