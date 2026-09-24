import type { MetadataRoute } from "next";
import { GUIDE_SLUGS } from "@/content/guide";
import { getAnalyses, getBriefArchive, getStories } from "@/lib/data";
import { briefHref, type BriefPeriod } from "@/lib/brief";
import { SITE_URL } from "@/lib/site";
import { LOCALES } from "@/lib/i18n/config";
import { withLocale } from "@/lib/i18n/routing";
import { analysisHref } from "@/lib/analysis";
import { technicalHref } from "@/lib/technical";
import { getTechnicalBoard } from "@/lib/technical-data";

/**
 * Site haritası.
 *
 * Altı kaynaktan derlenir: durağan ekranlar, depodaki rehber yazıları,
 * veritabanındaki mercek yazıları, bilanço analizleri, bülten sayıları ve
 * teknik analizler. Şirket sayfaları (/hisse/*) bilinçli
 * olarak YOK — beş yüzden fazla sayfa üretirdi, içerikleri neredeyse
 * tamamen sağlayıcı verisi ve her biri her gün değişiyor. Arama motoruna
 * gönderilecek asıl değer, yazılan metinler.
 *
 * Veritabanı düşerse harita yine üretilir; yalnızca mercek bölümü boş kalır.
 */
/* Tavan yüksek tutuluyor: 200'lük sınır eski yazıları SESSİZCE düşürüyordu
   ve düşen yazı arama motoruna bir daha hiç gösterilmiyordu. Haritanın
   kendi sınırı 50.000 adres; bu tavanla dört liste birlikte 8.000'i
   geçmez. */
const SITEMAP_LIMIT = 2000;

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
    { path: "/teknik", priority: 0.8, frequency: "hourly" },
    { path: "/takvim", priority: 0.8, frequency: "daily" },
    { path: "/makro", priority: 0.7, frequency: "daily" },
    { path: "/sirketler", priority: 0.6, frequency: "weekly" },
    { path: "/karsilastir", priority: 0.6, frequency: "weekly" },
    { path: "/haberler", priority: 0.6, frequency: "hourly" },
    { path: "/bulten", priority: 0.7, frequency: "daily" },
    { path: "/rehber", priority: 0.9, frequency: "weekly" },
    { path: "/mercek", priority: 0.9, frequency: "daily" },
    /* `/menu` YOK: telefon gezinmesinin tam ekran listesi, kendi içeriği
       olmayan bir bağlantı sayfası. Sayfa `noindex` taşıyor. */
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
    /* Rehber yazısı için `false`: depoda duruyor ve değişme anı bilinmiyor.
       Her üretimde "şimdi" yazmak, arama motoruna her gün yüz yazının
       değiştiğini söylemekti; yanlış `lastmod` görmezden gelinmeyi öğretiyor.
       Veri ekranları (piyasalar, takvim) gerçekten her gün değişiyor, onlarda
       kalıyor. */
    stamp = true,
  ): MetadataRoute.Sitemap =>
    LOCALES.map((locale) => ({
      url: `${SITE_URL}${withLocale(path, locale)}`,
      ...(stamp ? { lastModified: now } : {}),
      changeFrequency: frequency,
      priority,
      alternates: alternatesFor(path),
    }));

  const entries: MetadataRoute.Sitemap = staticRoutes.flatMap((route) =>
    bothLocales(route.path, route.priority, route.frequency),
  );

  for (const slug of GUIDE_SLUGS) {
    entries.push(...bothLocales(`/rehber/${slug}`, 0.7, "monthly", false));
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
  /* Çevirisi olan kayıt İKİ dilin adresini `alternates` ile bağlıyor;
     yalnızca bir dilde yazılmışsa blok hiç basılmıyor. Önce iki dilin
     listesi toplanıyor, sonra kayıtlar üretiliyor — bir kaydın öteki dilde
     var olup olmadığı ancak ikisi de okunduktan sonra biliniyor. */
  const dynamicEntries = (
    items: { path: string; locale: (typeof LOCALES)[number]; modified: Date }[],
    priority: number,
  ): MetadataRoute.Sitemap => {
    const byPath = new Map<string, Set<string>>();
    for (const item of items) {
      byPath.set(item.path, (byPath.get(item.path) ?? new Set()).add(item.locale));
    }
    return items.map((item) => {
      const langs = byPath.get(item.path)!;
      return {
        url: `${SITE_URL}${withLocale(item.path, item.locale)}`,
        lastModified: item.modified,
        changeFrequency: "monthly" as const,
        priority,
        ...(langs.size > 1
          ? {
              alternates: {
                languages: Object.fromEntries(
                  LOCALES.filter((l) => langs.has(l)).map((l) => [
                    l,
                    `${SITE_URL}${withLocale(item.path, l)}`,
                  ]),
                ),
              },
            }
          : {}),
      };
    });
  };

  try {
    const items = [];
    for (const locale of LOCALES) {
      const rows = (await getStories(locale, SITEMAP_LIMIT)).filter(
        (row) => row.locale === locale,
      );
      for (const story of rows) {
        // Metnin son yazıldığı an. Bir dönem olayın günüydü (eventDate):
        // düzeltilen bir yazı haritada hiç değişmemiş görünüyordu.
        items.push({ path: `/mercek/${story.slug}`, locale, modified: story.updatedAt });
      }
    }
    entries.push(...dynamicEntries(items, 0.7));
  } catch {
    // Veritabanı yoksa harita durağan kısımla üretilsin, hata vermesin.
  }

  try {
    const items = [];
    for (const locale of LOCALES) {
      /* Süzme gerekçesi mercek döngüsünde. Adres `analysisHref`ten geliyor:
         sayfanın canonical'ı ve JSON-LD'si de aynı yardımcıyı kullanıyor,
         yani harita ile sayfa aynı adresi yazıyor. */
      const rows = (await getAnalyses(locale, { limit: SITEMAP_LIMIT })).filter(
        (row) => row.locale === locale,
      );
      for (const analysis of rows) {
        items.push({
          path: analysisHref(analysis.symbol, analysis.period),
          locale,
          modified: analysis.updatedAt,
        });
      }
    }
    entries.push(...dynamicEntries(items, 0.7));
  } catch {
    // Aynı gerekçe: analiz tablosu okunamazsa harita eksik ama geçerli kalır.
  }

  /* BÜLTEN SAYILARI. Her sayının kendi adresi var (`briefHref`); öncesinde
     hepsi `/bulten?tarih=` idi ve canonical'ları `/bulten`du, yani haritaya
     yazılacak bir adresleri yoktu. Dil kuralı mercekle aynı. */
  try {
    const items = [];
    for (const period of ["daily", "weekly"] as BriefPeriod[]) {
      for (const locale of LOCALES) {
        const rows = (await getBriefArchive(locale, period, SITEMAP_LIMIT)).filter(
          (row) => row.locale === locale,
        );
        for (const row of rows) {
          items.push({ path: briefHref(row.briefDate, period), locale, modified: row.generatedAt });
        }
      }
    }
    entries.push(...dynamicEntries(items, 0.5));
  } catch {
    // Bülten tablosu okunamazsa harita eksik ama geçerli kalır.
  }

  /* TEKNİK ANALİZ SAYFALARI yazılmış metin taşıyor, hisse sayfası gibi
     yalnızca sağlayıcı verisi değil — o yüzden haritada. Dil kuralı mercekle
     aynı: İngilizce metni olmayan analiz /en adresiyle listelenmiyor.
     Yükleyici hatayı kendisi yutuyor (boş liste döner). */
  for (const { row } of await getTechnicalBoard()) {
    const path = technicalHref(row.symbol);
    const langs = LOCALES.filter((locale) => locale !== "en" || row.copy.en);
    for (const locale of langs) {
      entries.push({
        url: `${SITE_URL}${withLocale(path, locale)}`,
        lastModified: row.updatedAt,
        changeFrequency: "daily",
        priority: 0.6,
        ...(langs.length > 1 ? { alternates: alternatesFor(path) } : {}),
      });
    }
  }

  return entries;
}
