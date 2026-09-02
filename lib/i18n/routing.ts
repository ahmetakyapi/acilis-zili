import { DEFAULT_LOCALE, LOCALES, isLocale, type Locale } from "./config";

/**
 * Dilin ADRESTEKİ yeri.
 *
 * SORUN: dil yalnızca `az-locale` çerezinde yaşıyordu ve iki dil aynı adresi
 * paylaşıyordu. Çerez göndermeyen her istemci varsayılan Türkçeyi alıyor —
 * Googlebot, paylaşım kartını çizen botlar, RSS okuyucular, `curl`. Yani
 * sözlükteki bütün İngilizce çeviriler, `locale='en'` mercek yazıları ve
 * rehberin EN katmanı arama motorlarına HİÇ görünmüyordu. Bir sayfanın
 * İngilizcesine bağlantı vermek de mümkün değildi: paylaşılan adres alıcının
 * çerezine göre bambaşka bir dilde açılıyordu.
 *
 * ÇÖZÜM: İngilizce içeriğin kendi adresi var — `/en/...`. Türkçe önekSİZ
 * kalıyor; varsayılan dilin öneki olması hem adresleri uzatır hem de
 * yıllardır paylaşılmış bağlantıları kırardı.
 *
 * Yönlendirme DEĞİL YENİDEN YAZMA (`proxy.ts`): `/en/piyasalar` isteği
 * sunucuda `/piyasalar` sayfasını çalıştırır, tarayıcıdaki adres `/en/...`
 * olarak kalır ve sayfa dili istek başlığından okur. Böylece 29 sayfa
 * dosyasının hiçbiri taşınmıyor.
 *
 * Çerez KALIYOR ama artık ikincil: adreste önek varsa o kazanır. Önek yoksa
 * çerez okunur — yıllardır Türkçe dışında bir tercihle gezen kimse
 * varsayılana düşmesin diye.
 */

/** Adreste önek taşıyan diller — varsayılan dil önek almaz. */
export const PREFIXED_LOCALES = LOCALES.filter(
  (locale) => locale !== DEFAULT_LOCALE,
);

/** Yeniden yazma sırasında dili sayfaya taşıyan istek başlığı. */
export const LOCALE_HEADER = "x-az-locale";

/**
 * "/en/piyasalar" → { locale: "en", path: "/piyasalar" }
 * "/piyasalar"    → { locale: null, path: "/piyasalar" }
 *
 * `locale` NULL olabilir ve bu "Türkçe" demek DEĞİL: "adres bir şey
 * söylemiyor" demek. Kararı çağıran veriyor — proxy önek yoksa dokunmuyor,
 * `getLocale()` çereze bakıyor.
 */
export function splitLocale(pathname: string): {
  locale: Locale | null;
  path: string;
} {
  for (const locale of PREFIXED_LOCALES) {
    if (pathname === `/${locale}`) return { locale, path: "/" };
    if (pathname.startsWith(`/${locale}/`)) {
      return { locale, path: pathname.slice(locale.length + 1) };
    }
  }
  return { locale: null, path: pathname };
}

/**
 * Bir yolu istenen dilin adresine çevirir.
 *
 * Site içi HER bağlantı buradan geçer: `/en/piyasalar` sayfasındaki bir
 * bağlantı `/hisse/NVDA`ya giderse okuyucu sessizce Türkçeye düşerdi.
 * Dış adresler, çapa ve `mailto:` olduğu gibi bırakılır.
 */
export function withLocale(href: string, locale: Locale): string {
  if (!href.startsWith("/")) return href;
  const { path } = splitLocale(href);
  if (locale === DEFAULT_LOCALE) return path;
  return path === "/" ? `/${locale}` : `/${locale}${path}`;
}

/** Adresin dilden arınmış hâli — aktif gezinme karşılaştırmaları için. */
export function stripLocale(pathname: string): string {
  return splitLocale(pathname).path;
}

/**
 * Bir yolun bütün dillerdeki karşılığı — `hreflang` ve site haritası için.
 * Anahtarlar `Metadata.alternates.languages` biçiminde.
 */
export function languageAlternates(
  path: string,
  /**
   * GERÇEKTEN VAR OLAN diller. Verilmezse ikisi de yazılır.
   *
   * Varsayılan doğru davranış çünkü sitenin sayfalarının çoğu iki dilde de
   * var: arayüz sözlükten geliyor. Ama veritabanından gelen içerikte
   * (mercek yazısı, bilanço analizi) çeviri EKSİK OLABİLİYOR ve o durumda
   * sayfa orijinal dilinde, "TR" rozetiyle gösteriliyor. Koşulsuz `hreflang`
   * o sayfalar için var olmayan bir İngilizce sürüm ilan ediyordu: İngilizce
   * arayan biri arama sonucunda "İngilizce sürüm" görüp tıkladığında baştan
   * sona Türkçe bir yazıya düşüyordu. Site haritası aynı hatayı YAPMIYOR —
   * `app/sitemap.ts` yalnızca dönen satırın kendi dilini yazıyor ve gerekçesi
   * orada kayıtlı; bu parametre aynı kuralı künyeye taşıyor.
   */
  locales: readonly Locale[] = LOCALES,
): Record<string, string> {
  const clean = splitLocale(path).path;
  return Object.fromEntries(
    locales.map((locale) => [locale, withLocale(clean, locale) || "/"]),
  );
}

/** Başlıktan gelen dil — proxy yazıyor, `getLocale()` okuyor. */
export function localeFromHeader(value: string | null | undefined): Locale | null {
  return isLocale(value) ? value : null;
}
