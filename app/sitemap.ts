import type { MetadataRoute } from "next";
import { GUIDE_SLUGS } from "@/content/guide";
import { GLOSSARY_SLUGS } from "@/content/glossary";
import { THEME_SLUGS } from "@/content/themes";
import { INVESTOR_SLUGS } from "@/lib/investors";
import { COMPARE_PAIR_SLUGS } from "@/content/compare-pairs";
import { getAnalyses, getBriefArchive, getCompanies, getStories } from "@/lib/data";
import { briefHref, type BriefPeriod } from "@/lib/brief";
import { SITE_URL } from "@/lib/site";
import { DEFAULT_LOCALE, LOCALES } from "@/lib/i18n/config";
import { withLocale } from "@/lib/i18n/routing";
import { analysisHref } from "@/lib/analysis";
import { technicalHref } from "@/lib/technical";
import { getTechnicalBoard } from "@/lib/technical-data";

type Locale = (typeof LOCALES)[number];
type SitemapItem = { path: string; locale: Locale; modified: Date };
type Frequency = MetadataRoute.Sitemap[number]["changeFrequency"];
type StaticRoute = {
  path: string;
  priority: number;
  frequency: Frequency;
  /**
   * `false`: ekranın içeriği veriyle değişmiyor (metin, araç, künye) ve
   * değişme anı bilinmiyor — `lastmod` yazılmaz. Gerekçe aşağıda
   * `bothLocales` → `stamp`; yanlış `lastmod` görmezden gelinmeyi öğretiyor.
   */
  stamp?: boolean;
};

/**
 * Site haritası.
 *
 * Yedi kaynaktan derlenir: durağan ekranlar, depodaki rehber yazıları,
 * veritabanındaki mercek yazıları, bilanço analizleri, bülten sayıları,
 * teknik analizler ve piyasa değeri en büyük şirketlerin sayfaları.
 *
 * Veritabanı düşerse harita yine üretilir; yalnızca o bölüm boş kalır.
 */
/* Tavan yüksek tutuluyor: 200'lük sınır eski yazıları SESSİZCE düşürüyordu
   ve düşen yazı arama motoruna bir daha hiç gösterilmiyordu. Haritanın
   kendi sınırı 50.000 adres; bu tavanla dört liste birlikte 8.000'i
   geçmez. */
const SITEMAP_LIMIT = 2000;

/**
 * ŞİRKET SAYFALARI HARİTADA — KARAR TERSİNE DÖNDÜ (28 Eylül).
 *
 * Eski gerekçe şuydu: /hisse/* beş yüzden fazla sayfa üretir, içerikleri
 * neredeyse tamamen sağlayıcı verisi ve her gün değişiyor; arama motoruna
 * gönderilecek asıl değer yazılan metinler. O gün doğruydu: sayfa bir
 * fiyat, bir grafik ve sağlayıcının profil metninden ibaretti, yani başka
 * yüz sitede aynısı olan içerik.
 *
 * Değişen şey sayfanın kendisi. Şirket sayfası artık sitenin ÜRETTİĞİ bir
 * metin katmanı taşıyor: sıradaki bilançonun tarihi ve Türkiye saatiyle
 * penceresi, hangi endekslerin bileşeni olduğu, ilgili rehber yazılarına
 * bağlantılar. Bu, "ABD hissesi X ne zaman bilanço açıklıyor, saat kaçta"
 * sorusunun Türkçe cevabı ve başka yerde yok.
 *
 * TAVAN 300, bin değil. Tarama bütçesi sınırsız değil ve katalogun kuyruğu
 * (küçük, profili eksik, logosuz şirketler) en ince sayfalar; onları
 * listelemek arama motoruna ince sayfa göstermenin en hızlı yolu. Piyasa
 * değeri sırası hem okuyucu ilgisini hem de sayfanın zenginliğini (analist
 * kapsamı, bilanço geçmişi, haber) iyi izliyor. Listelenmeyen sayfalar
 * dizine KAPALI DEĞİL: site içi bağlantılardan yine bulunuyorlar, yalnızca
 * haritayla öne itilmiyorlar.
 */
const COMPANY_SITEMAP_LIMIT = 300;

/**
 * 28 Eylül paketlerinin getirdiği ekranlar. Durağanlar bu listede; dinamik
 * olanlar (terim, tema, çift) rehber yazılarıyla AYNI kalıpla, kendi slug
 * listeleri üzerinde `bothLocales` döngüsüyle aşağıda. Karşılaştırma
 * çiftlerinden yalnızca KÜRATÖRLÜ olanlar girer: her kombinasyon
 * listelenseydi binlerce ince sayfa olurdu.
 *
 * `/portfoy` HİÇBİR ZAMAN buraya girmez: kişisel ekran, `noindex` (bkz.
 * next.config.ts → NOINDEX_PATHS). `/gomulu/*` da girmez: başka sitelerin
 * içinde çizilen parçalar. `/gun/[tarih]/kart` bir görsel, sayfa değil.
 */
const FEATURE_STATIC_ROUTES: StaticRoute[] = [
  { path: "/vergi", priority: 0.7, frequency: "monthly", stamp: false },
  { path: "/sozluk", priority: 0.8, frequency: "weekly", stamp: false },
  { path: "/tema", priority: 0.7, frequency: "daily" },
  { path: "/yatirimcilar", priority: 0.7, frequency: "weekly", stamp: false },
  /* 9 Ekim: dizine açık, menüde ve README'de var ama haritada yoktu. */
  { path: "/hisse-secimi", priority: 0.7, frequency: "weekly" },
  { path: "/bilancolar/hafta", priority: 0.7, frequency: "daily" },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticRoutes: StaticRoute[] = [
    { path: "/", priority: 1, frequency: "hourly" },
    { path: "/piyasalar", priority: 0.8, frequency: "hourly" },
    { path: "/bilancolar", priority: 0.8, frequency: "daily" },
    { path: "/bilancolar/analizler", priority: 0.9, frequency: "daily" },
    { path: "/teknik", priority: 0.8, frequency: "hourly" },
    { path: "/takvim", priority: 0.8, frequency: "daily" },
    { path: "/makro", priority: 0.7, frequency: "daily" },
    { path: "/sirketler", priority: 0.6, frequency: "weekly" },
    { path: "/karsilastir", priority: 0.6, frequency: "weekly", stamp: false },
    { path: "/haberler", priority: 0.6, frequency: "hourly" },
    { path: "/bulten", priority: 0.7, frequency: "daily" },
    { path: "/rehber", priority: 0.9, frequency: "weekly", stamp: false },
    { path: "/mercek", priority: 0.9, frequency: "daily" },
    /* `/menu` YOK: telefon gezinmesinin tam ekran listesi, kendi içeriği
       olmayan bir bağlantı sayfası. Sayfa `noindex` taşıyor. */
    { path: "/kvkk", priority: 0.3, frequency: "monthly", stamp: false },
    /* Güven sayfası: kim işletiyor, veri ve içerik nasıl üretiliyor. */
    { path: "/hakkinda", priority: 0.4, frequency: "monthly", stamp: false },
    ...FEATURE_STATIC_ROUTES,
  ];

  /* HER KAYIT İKİ DİLDE. Harita bir dönem yalnızca önekSİZ adresleri
     listeliyordu ve İngilizce içeriğin adresi olmadığı için listelenecek bir
     şey de yoktu; arama motoru EN tarafını hiç görmüyordu. `alternates`
     bloğu iki adresi birbirinin çevirisi olarak bağlıyor. */
  /* `x-default` SAYFADAKİ KÜNYEYLE AYNI. Sayfalar `pageAlternates` ile
     tr + en + x-default yazıyor, harita yalnızca tr + en yazıyordu; aynı
     adres iki kaynakta iki farklı hreflang kümesi ilan ediyordu. Kural
     da aynı: x-default önekSİZ Türkçe, Türkçesi olmayan kayıtta yazılmaz. */
  const languagesFor = (path: string, langs: readonly Locale[] = LOCALES) => ({
    ...Object.fromEntries(
      langs.map((locale) => [locale, `${SITE_URL}${withLocale(path, locale)}`]),
    ),
    ...(langs.includes(DEFAULT_LOCALE)
      ? { "x-default": `${SITE_URL}${withLocale(path, DEFAULT_LOCALE)}` }
      : {}),
  });
  const alternatesFor = (path: string) => ({ languages: languagesFor(path) });

  const bothLocales = (
    path: string,
    priority: number,
    frequency: Frequency,
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
    bothLocales(route.path, route.priority, route.frequency, route.stamp ?? true),
  );

  for (const slug of GUIDE_SLUGS) {
    entries.push(...bothLocales(`/rehber/${slug}`, 0.7, "monthly", false));
  }
  /* Terimler ve çiftler depoda duruyor, değişme anı bilinmiyor: rehberle
     aynı gerekçeyle `lastmod` yok. Tema sayfası canlı kotasyon taşıyor. */
  for (const slug of GLOSSARY_SLUGS) {
    entries.push(...bothLocales(`/sozluk/${slug}`, 0.6, "monthly", false));
  }
  for (const slug of THEME_SLUGS) {
    entries.push(...bothLocales(`/tema/${slug}`, 0.6, "daily"));
  }
  /* Yatırımcılar kodda (lib/investors.ts); veri çeyrekte bir, Kongre
     bildirimleri ayda birkaç kez değişiyor. */
  for (const slug of INVESTOR_SLUGS) {
    entries.push(...bothLocales(`/yatirimcilar/${slug}`, 0.6, "weekly", false));
  }
  for (const slug of COMPARE_PAIR_SLUGS) {
    entries.push(...bothLocales(`/karsilastir/${slug}`, 0.5, "weekly", false));
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
    items: SitemapItem[],
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
                languages: languagesFor(
                  item.path,
                  LOCALES.filter((l) => langs.has(l)),
                ),
              },
            }
          : {}),
      };
    });
  };

  /* ÜÇ İÇERİK, TEK KALIP. Mercek, analiz ve bülten aynı işi yapıyordu:
     her dil için satırları oku, yalnızca O DİLDE yazılmış satırları tut
     (okuyucu dili bulunamayınca öteki dilin satırını döndürüyor; o satır
     haritaya yazılırsa var olmayan bir çeviri ilan edilir), adres + dil +
     değişiklik anını topla. Kalıp üç kez kopyalıydı; bir kural değişince
     üç yerde birden değişmesi gerekiyordu. Okunamayan tablo haritayı
     düşürmez: o bölüm eksik kalır, harita geçerli kalır. */
  const section = async <Row extends { locale: string }>(
    load: (locale: Locale) => Promise<Row[]>,
    toItem: (row: Row, locale: Locale) => SitemapItem,
    priority: number,
  ) => {
    try {
      const items: SitemapItem[] = [];
      for (const locale of LOCALES) {
        for (const row of (await load(locale)).filter((r) => r.locale === locale)) {
          items.push(toItem(row, locale));
        }
      }
      entries.push(...dynamicEntries(items, priority));
    } catch {
      // Veritabanı yoksa harita durağan kısımla üretilsin, hata vermesin.
    }
  };

  // Metnin son yazıldığı an. Bir dönem olayın günüydü (eventDate):
  // düzeltilen bir yazı haritada hiç değişmemiş görünüyordu.
  await section(
    (locale) => getStories(locale, SITEMAP_LIMIT),
    (story, locale) => ({ path: `/mercek/${story.slug}`, locale, modified: story.updatedAt }),
    0.7,
  );

  /* Adres `analysisHref`ten geliyor: sayfanın canonical'ı ve JSON-LD'si de
     aynı yardımcıyı kullanıyor, yani harita ile sayfa aynı adresi yazıyor. */
  await section(
    (locale) => getAnalyses(locale, { limit: SITEMAP_LIMIT }),
    (analysis, locale) => ({
      path: analysisHref(analysis.symbol, analysis.period),
      locale,
      modified: analysis.updatedAt,
    }),
    0.7,
  );

  /* BÜLTEN SAYILARI. Her sayının kendi adresi var (`briefHref`); öncesinde
     hepsi `/bulten?tarih=` idi ve canonical'ları `/bulten`du, yani haritaya
     yazılacak bir adresleri yoktu. Değişiklik anı `modifiedAt`: panel
     düzeltmesi `generatedAt`i ilerletmiyor (gerekçe lib/data.ts). */
  for (const period of ["daily", "weekly"] as BriefPeriod[]) {
    await section(
      (locale) => getBriefArchive(locale, period, SITEMAP_LIMIT),
      (row, locale) => ({ path: briefHref(row.briefDate, period), locale, modified: row.modifiedAt }),
      0.5,
    );
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

  /* ŞİRKET SAYFALARI — gerekçe ve tavan dosya başında
     (`COMPANY_SITEMAP_LIMIT`). Sıra piyasa değeri; değeri bilinmeyen
     (USD dışı, profili eksik) şirket listeye girmez. `getCompanies`
     hatayı kendisi yutuyor (boş liste), harita yine geçerli kalıyor.
     `lastModified` yok: sayfa her istekte çiziliyor ve "şimdi" yazmak her
     gün üç yüz sayfanın değiştiğini söylemek olurdu — rehberdeki gerekçe. */
  const companies = (await getCompanies())
    .filter((company) => company.marketCap !== null && company.marketCap > 0)
    .sort((a, b) => (b.marketCap ?? 0) - (a.marketCap ?? 0))
    .slice(0, COMPANY_SITEMAP_LIMIT);
  for (const company of companies) {
    entries.push(...bothLocales(`/hisse/${company.symbol}`, 0.5, "daily", false));
  }

  return entries;
}
