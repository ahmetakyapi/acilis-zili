/**
 * Site sabitleri — tek kaynak.
 *
 * NEXT_PUBLIC_SITE_URL Vercel'de tanımlı; yoksa yerel geliştirme adresine
 * düşer. metadataBase, sitemap ve robots üçü de buradan okur, böylece adres
 * değiştiğinde tek yerde değişir.
 */

/**
 * Boş dizgiyi de "tanımsız" sayar.
 *
 * `??` yalnızca null/undefined'da devreye girer, boş dizgide girmez. Vercel
 * bir değişkeni tanımlı ama boş bırakabiliyor (`env pull` de öyle yazıyor) ve
 * o durumda SITE_URL boş kalıyordu — `new URL("")` fırlatıyor ve BÜTÜN build
 * "Invalid URL" ile düşüyor. Hata mesajı da nedeni söylemiyor: /_not-found
 * sayfasını işaret ediyor.
 */
function firstNonEmpty(...values: (string | undefined)[]): string | undefined {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) return trimmed;
  }
  return undefined;
}

export const SITE_URL = (
  firstNonEmpty(
    process.env.NEXT_PUBLIC_SITE_URL,
    // Vercel'de değişken unutulursa üretim alan adına düş; site haritasının
    // localhost adresleri yayması sessiz ama pahalı bir hata olurdu.
    process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : undefined,
  ) ?? "http://localhost:3000"
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

/**
 * Bir sayfanın `alternates` bloğu.
 *
 * TUZAK: Next metadata birleştirmesinde `alternates` DERİN BİRLEŞMEZ, tümüyle
 * değiştirilir. Kökte `types: { "application/rss+xml": "/feed.xml" }` yazıyor
 * ve bir alt sayfa `alternates: { canonical: "..." }` verdiği anda o sayfada
 * besleme keşif etiketi SESSİZCE kayboluyor. Ana sayfada tam olarak bu oldu:
 * canonical eklendi, RSS bağlantısı düştü ve HTML'de hiçbir uyarı çıkmadı.
 *
 * Bu yüzden canonical yazan her sayfa bloğu buradan üretiliyor — `types`
 * unutulamıyor.
 */
export function pageAlternates(path: string) {
  return {
    canonical: path,
    types: { "application/rss+xml": "/feed.xml" },
  } as const;
}
