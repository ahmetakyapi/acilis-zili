import type { MetadataRoute } from "next";
import { GUIDE_SLUGS } from "@/content/guide";
import { getAnalyses, getStories } from "@/lib/data";
import { SITE_URL } from "@/lib/site";
import { LOCALES } from "@/lib/i18n/config";
import { withLocale } from "@/lib/i18n/routing";
import { analysisHref } from "@/lib/analysis";

/**
 * Site haritası.
 *
 * Dört kaynaktan derlenir: durağan ekranlar, depodaki rehber yazıları,
 * veritabanındaki mercek yazıları ve bilanço analizleri. Şirket sayfaları (/hisse/*) bilinçli
 * olarak YOK — beş yüzden fazla sayfa üretirdi, içerikleri neredeyse
 * tamamen sağlayıcı verisi ve her biri her gün değişiyor. Arama motoruna
 * gönderilecek asıl değer, yazılan metinler.
 *
 * Veritabanı düşerse harita yine üretilir; yalnızca mercek bölümü boş kalır.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticRoutes: {
    path: string;
    priority: number;
    frequency: MetadataRoute.Sitemap[number]["changeFrequency"];
  }[] = [
    { path: "/", priority: 1, frequency: "hourly" },
    { path: "/piyasalar", priority: 0.8, frequency: "hourly" },
    { path: "/bilancolar", priority: 0.8, frequency: "daily" },
    { path: "/bilancolar/analizler", priority: 0.9, frequency: "daily" },
    { path: "/takvim", priority: 0.8, frequency: "daily" },
    { path: "/makro", priority: 0.7, frequency: "daily" },
    { path: "/sirketler", priority: 0.6, frequency: "weekly" },
    { path: "/karsilastir", priority: 0.6, frequency: "weekly" },
    { path: "/haberler", priority: 0.6, frequency: "hourly" },
    { path: "/bulten", priority: 0.7, frequency: "daily" },
    { path: "/rehber", priority: 0.9, frequency: "weekly" },
    { path: "/mercek", priority: 0.9, frequency: "daily" },
    { path: "/menu", priority: 0.3, frequency: "monthly" },
    { path: "/kvkk", priority: 0.3, frequency: "monthly" },
  ];

  /* HER KAYIT İKİ DİLDE. Harita bir dönem yalnızca önekSİZ adresleri
     listeliyordu ve İngilizce içeriğin adresi olmadığı için listelenecek bir
     şey de yoktu; arama motoru EN tarafını hiç görmüyordu. `alternates`
     bloğu iki adresi birbirinin çevirisi olarak bağlıyor. */
  const alternatesFor = (path: string) => ({
    languages: Object.fromEntries(
      LOCALES.map((locale) => [locale, `${SITE_URL}${withLocale(path, locale)}`]),
    ),
  });

  const bothLocales = (
    path: string,
    priority: number,
    frequency: MetadataRoute.Sitemap[number]["changeFrequency"],
  ): MetadataRoute.Sitemap =>
    LOCALES.map((locale) => ({
      url: `${SITE_URL}${withLocale(path, locale)}`,
      lastModified: now,
      changeFrequency: frequency,
      priority,
      alternates: alternatesFor(path),
    }));

  const entries: MetadataRoute.Sitemap = staticRoutes.flatMap((route) =>
    bothLocales(route.path, route.priority, route.frequency),
  );

  for (const slug of GUIDE_SLUGS) {
    entries.push(...bothLocales(`/rehber/${slug}`, 0.7, "monthly"));
  }

  /* MERCEK VE ANALİZ YAZILARI DİLE GÖRE listelenir; durağan sayfaların
     aksine bunların çevirisi OLMAYABİLİR. Var olmayan bir çeviriyi
     `hreflang` ile göstermek arama motoruna yanlış söz vermek olur — sayfa
     açıldığında orijinali "TR" rozetiyle çıkıyor, o adres o dilin sayfası
     değil. Bu yüzden her dil kendi yazdıklarıyla listeleniyor.

     SÜZME BURADA YAPILIYOR, YÜKLEYİCİDE DEĞİL. `getStories` ve `getAnalyses`
     dile göre SÜZMÜYOR: slug başına tek satır seçerken istenen dili TERCİH
     ediyorlar ama çevirisi olmayan kaydı da orijinal diliyle döndürüyorlar —
     sayfa boş kalmasın diye, doğru bir karar. Sonuç haritada şuydu: iki
     döngü de aynı slug kümesini basıyor, yani yalnızca Türkçe yazılmış her
     yazı `/en/...` adresiyle de listeleniyordu. Yukarıdaki söz ("her dil
     kendi yazdıklarıyla") tutulmuyordu. Dönen satır `locale` alanını zaten
     taşıyor; ek sorgu yok. */
  try {
    for (const locale of LOCALES) {
      const rows = (await getStories(locale, 200)).filter(
        (row) => row.locale === locale,
      );
      for (const story of rows) {
        entries.push({
          // eventDate olayın günü (YYYY-MM-DD); yazının yazıldığı gün değil ama
          // "bu içerik ne kadar taze" sorusuna verilecek en yakın cevap o.
          url: `${SITE_URL}${withLocale(`/mercek/${story.slug}`, locale)}`,
          lastModified: new Date(story.eventDate),
          changeFrequency: "monthly",
          priority: 0.7,
        });
      }
    }
  } catch {
    // Veritabanı yoksa harita durağan kısımla üretilsin, hata vermesin.
  }

  try {
    for (const locale of LOCALES) {
      /* Süzme gerekçesi mercek döngüsünde. Adres `analysisHref`ten geliyor:
         sayfanın canonical'ı ve JSON-LD'si de aynı yardımcıyı kullanıyor,
         yani harita ile sayfa aynı adresi yazıyor. */
      const rows = (await getAnalyses(locale, { limit: 200 })).filter(
        (row) => row.locale === locale,
      );
      for (const analysis of rows) {
        entries.push({
          url: `${SITE_URL}${withLocale(
            analysisHref(analysis.symbol, analysis.period),
            locale,
          )}`,
          lastModified: new Date(analysis.reportDate),
          changeFrequency: "monthly",
          priority: 0.7,
        });
      }
    }
  } catch {
    // Aynı gerekçe: analiz tablosu okunamazsa harita eksik ama geçerli kalır.
  }

  return entries;
}
