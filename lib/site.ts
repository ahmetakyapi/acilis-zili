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

import { DEFAULT_LOCALE, type Locale } from "./i18n/config";
import { languageAlternates, stripLocale, withLocale } from "./i18n/routing";

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
export function pageAlternates(path: string, locale: Locale = DEFAULT_LOCALE) {
  return {
    /* CANONICAL HER DİLDE KENDİSİ. Bir dönem her iki dil de Türkçe adresi
       canonical gösteriyordu ve bu, İngilizce sayfayı Türkçenin mükerreri
       ilan etmek demekti: arama motoru onu dizinden düşürür, yani dili
       adrese taşımanın bütün faydası kaybolurdu. */
    canonical: withLocale(path, locale),
    /* hreflang: aynı içeriğin öteki dildeki adresi. Bu olmadan arama motoru
       iki sayfayı birbirinin çevirisi olarak değil, ayrı iki sayfa (hatta
       mükerrer içerik) olarak görüyordu. `x-default` önekSİZ Türkçeyi
       gösteriyor — dili bilinmeyen istemcinin gideceği adres o. */
    languages: {
      ...languageAlternates(path),
      "x-default": stripLocale(path) || "/",
    },
    types: { "application/rss+xml": "/feed.xml" },
  } as const;
}

/**
 * Bir yolun paylaşılabilir TAM adresi — şema, alan adı ve dil öneki dahil.
 *
 * Paylaş düğmesi bunu istiyor. Adresi tarayıcıdan (`window.location`) okumak
 * kolay ama yanlış: o adres okuyucunun geldiği filtreleri ve çapaları da
 * taşıyor ve paylaşılan bağlantıya sızıyorlar. Canonical ile aynı yerden
 * üretmek, paylaşılan her bağlantının arama motoruna gösterdiğimiz adresle
 * birebir aynı olmasını da garantiliyor.
 */
export function absoluteUrl(
  path: string,
  locale: Locale = DEFAULT_LOCALE,
): string {
  return `${SITE_URL}${withLocale(path, locale)}`;
}
