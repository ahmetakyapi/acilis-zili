import type { MetadataRoute } from "next";
import { GUIDE_SLUGS } from "@/content/guide";
import { GLOSSARY_SLUGS } from "@/content/glossary";
import { THEME_SLUGS } from "@/content/themes";
import { INVESTOR_SLUGS } from "@/lib/investors";
import { COMPARE_PAIR_SLUGS } from "@/content/compare-pairs";
import { getAnalyses, getAnalyzedSymbols, getBriefArchive, getCompanies, getStories } from "@/lib/data";
import { earningsHref } from "@/lib/earnings-company";
import { getReportingSymbols } from "@/lib/earnings-company-data";
import { addEtDays, todayEt } from "@/lib/market-hours";
import { briefHref, type BriefPeriod } from "@/lib/brief";
import { SITE_URL } from "@/lib/site";
import { DEFAULT_LOCALE, LOCALES } from "@/lib/i18n/config";
import { withLocale } from "@/lib/i18n/routing";
import { analysisHref, dropShadowedPeriods } from "@/lib/analysis";
import { technicalHref } from "@/lib/technical";
import { getTechnicalBoard } from "@/lib/technical-data";
import { allFunds } from "@/db/seed/symbols";
import { getDailyChartArchive } from "@/lib/daily-chart-data";
import { dailyChartHref } from "@/lib/daily-chart";

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

/** Şirket bazlı bilanço sayfası için takvim penceresi — gerekçe aşağıda. */
const EARNINGS_PAGE_HORIZON_DAYS = 100;

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
  /* 24 Ekim: aracı kurum karşılaştırması — veri depoda, tarih damgası yok. */
  { path: "/araci-kurumlar", priority: 0.7, frequency: "monthly", stamp: false },
  { path: "/sozluk", priority: 0.8, frequency: "weekly", stamp: false },
  { path: "/bulmaca", priority: 0.6, frequency: "daily", stamp: false },
  { path: "/bulmaca/arsiv", priority: 0.4, frequency: "daily", stamp: false },
  /* 25 Ekim: sitenin değişiklik geçmişi — içerik depoda, yalnız dağıtımla
     değişiyor; değişme anı sayfa için bilinmiyor, damga yok. */
  { path: "/yenilikler", priority: 0.4, frequency: "weekly", stamp: false },
  { path: "/tema", priority: 0.7, frequency: "daily" },
  { path: "/yatirimcilar", priority: 0.7, frequency: "weekly", stamp: false },
  /* 9 Ekim: dizine açık, menüde ve README'de var ama haritada yoktu. */
  { path: "/hisse-secimi", priority: 0.7, frequency: "weekly" },
  { path: "/tarama", priority: 0.7, frequency: "daily" },
  /* Topluluk yazilari (detay) haritada DEGIL: tek tek adresler moderasyon
     ritmiyle degisiyor ve ince sayfa gostermemek kurali (COMPANY_SITEMAP_LIMIT
     gerekcesi) burada da gecerli; akis sayfasi listeliyor. */
  { path: "/topluluk", priority: 0.6, frequency: "daily" },
  { path: "/bilancolar/hafta", priority: 0.7, frequency: "daily" },
  /* Günün Grafiği (24 Ekim): dizin; günler aşağıda dile göre. */
  { path: "/gunun-grafigi", priority: 0.7, frequency: "daily" },
  /* Olasılıklar (25 Ekim): günde bir yenilenen anlık görüntü. */
  { path: "/olasiliklar", priority: 0.7, frequency: "daily" },
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
    /* Eski biçimli dönem ("q3-2026") tek kalıplı adrese iner: liste
       anahtarı tek kalıplı dönem (`dedupeAnalyses`), adres `analysisHref`
       (25 Ekim). Bir dilde `q3-…`, ötekinde `3c-…` satırı olsa da iki
       kayıt aynı yolu yazar ve haritada birbirinin hreflang eşi olur.
       `dropShadowedPeriods` aynı dilde iki yazım kalırsa ikincisini düşürür. */
    async (locale) => dropShadowedPeriods(await getAnalyses(locale, { limit: SITEMAP_LIMIT })),
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

  /* GÜNÜN GRAFİĞİ (24 Ekim) — bülten kalıbı: her dil kendi yazdıklarıyla;
     tablo yoksa okuyucu boş liste döner, bölüm eksik kalır. */
  await section(
    (locale) => getDailyChartArchive(locale, SITEMAP_LIMIT),
    (row, locale) => ({ path: dailyChartHref(row.chartDate), locale, modified: row.updatedAt }),
    0.5,
  );

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

  /* ŞİRKET BAZLI BİLANÇO SAYFALARI (24 Ekim) — `/bilancolar/[symbol]`.
     Ölçüt sayfanın dizin ölçütüyle AYNI: sıradaki raporu takvimde olan ya
     da okunmuş çeyreği olan şirket (öteki sayfalar `noindex`, gerekçe
     sayfanın `generateMetadata`ı). Takvim tarafı yukarıdaki şirket
     listesiyle (piyasa değerinde ilk 300) sınırlı — ince sayfa kuralı;
     analizi olan her şirket ayrıca giriyor. Pencere bir çeyrek ve biraz
     (`EARNINGS_PAGE_HORIZON_DAYS`): daha uzağı sağlayıcının tahmini. */
  const today = todayEt();
  const [reporting, analyzed] = await Promise.all([
    getReportingSymbols(today, addEtDays(today, EARNINGS_PAGE_HORIZON_DAYS)),
    getAnalyzedSymbols(),
  ]);
  const earningsPages = new Set([
    ...companies.filter((company) => reporting.has(company.symbol)).map((company) => company.symbol),
    ...analyzed,
  ]);
  for (const symbol of earningsPages) {
    entries.push(...bothLocales(earningsHref(symbol), 0.6, "daily", false));
  }

  /* FONLAR AYRICA (22 Ekim). Piyasa değeri sırası fonu hiç görmüyor:
     fonun piyasa değeri yok, sektör ve ülke fonlarının çoğu sembol
     tablosunda bile yok (`fundMetaOf` gerekçesi). Sayfaları ise elle
     yazılmış künye taşıyor — sektör panosundan ve Dünya Piyasaları'ndan
     tıklanan adresler bunlar. Liste kısa ve kapalı (~40). */
  const listed = new Set(companies.map((company) => company.symbol));
  for (const fund of allFunds()) {
    if (listed.has(fund.symbol)) continue;
    entries.push(...bothLocales(`/hisse/${fund.symbol}`, 0.5, "daily", false));
  }

  return entries;
}
