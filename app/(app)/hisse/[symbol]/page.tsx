import { Suspense } from "react";
import { MorphTarget } from "@/components/motion/Morph";
import Image from "next/image";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { notFound } from "next/navigation";
import { and, eq, inArray } from "drizzle-orm";
import { auth } from "@/auth";
import { SymbolAnalyses } from "@/components/earnings/SymbolAnalyses";
import { analysisHref } from "@/lib/analysis";
import { withLocale } from "@/lib/i18n/routing";
import { ArrowDownRight, ArrowLeft, ArrowUpRight, Bank, CalendarBlank, CalendarCheck, Flag, GlobeHemisphereWest, Heart, LinkSimple, SquaresFour, Stack, ChartLineUp, UsersThree } from "@phosphor-icons/react/dist/ssr";
import { MotionExperience, ScrollStage, Reveal, ScrollProgress, SectionNav } from "@/components/motion/PremiumMotion";
import styles from "./stock.module.css";
import { NewsImage } from "@/components/news/NewsImage";
import { FavoriteToggle } from "@/components/stock/FavoriteToggle";
import { PriceChartLazy } from "@/components/stock/PriceChartLazy";
import { ChartReadingProvider, HeaderReadout } from "@/components/stock/ChartReadingContext";
import { exchangeLabel } from "@/components/stock/exchange-label";
import { StockTechnicalCard } from "@/components/technical/StockTechnicalCard";
import {
  SymbolStories,
  SymbolStoriesSkeleton,
} from "@/components/stock/SymbolStories";
import { chartLabels } from "@/lib/chart-labels";
import {
  ChangePill,
  DataError,
  DataStamp,
  EmptyState,
  EmptyValue,
  Panel,
  PanelHeader,
  PanelLink,
  Skeleton,
} from "@/components/ui/primitives";
import { ChapterHeading } from "@/components/ui/ChapterHeading";
import { ScaleBar } from "@/components/markets/CompareScale";
import { PriceRail, type RailMark } from "@/components/ui/PriceRail";
import { db } from "@/lib/db";
import { news, watchlistItems, watchlists } from "@/lib/schema";
import {
  getEarningsForSymbol,
  getNextEarnings,
  getGenericImageUrls,
  getStatus,
  getAnalyses,
  getStoriesForSymbol,
  getCompanies,
  getSymbolNames,
  liveMarketCap,
  isKnownSymbol,
  getHolidays,
  getNextReport,
  type AnalysisIndexRow,
} from "@/lib/data";
import { fiscalLabel, fiscalOf } from "@/lib/fiscal";
import { EpsTrack } from "@/components/stock/EpsTrack";
import {
  buildPastQuarters,
  epsSurprise,
  formatEpsSurprise,
  type EpsSurprise,
  type PastQuarter,
} from "@/components/stock/past-quarters";
import { rateLimit, requestKey } from "@/lib/rate-limit";
import { getI18n, type Dictionary, type Locale } from "@/lib/i18n";
import { missingMetadata } from "@/lib/page-meta";
import { pageAlternates } from "@/lib/site";
import {
  getChartBars,
  getCompanyProfile,
  getQuote,
  getQuotes,
} from "@/lib/providers";
import { COMPLIANCE_THRESHOLD, screenCompliance } from "@/lib/compliance";
import { industryLabel } from "@/lib/sectors";
import { companySector } from "@/lib/company-sector";
import { indexMemberOf, peersOf, primaryOnly } from "@/db/seed/indices";
import { fundMetaOf, INDEX_STRIP } from "@/db/seed/symbols";
import { subIndustryName } from "@/db/seed/sub-industries";
import {
  getCompanyNews,
  getEarningsCalendar,
  getEarningsSurprises,
  getKeyMetrics,
  getRecommendations,
} from "@/lib/providers/finnhub";
import { addEtDays, todayEt,
  closeMinutesFor,
  etParts,
} from "@/lib/market-hours";
import type { Metadata } from "next";
import { describeSymbol } from "@/db/seed/descriptions";
import { isTechnicalSymbol, technicalHref } from "@/lib/technical";
import { ScrollEdges } from "@/components/ui/ScrollEdges";
import { GuideHint } from "@/components/article/GuideHint";
import {
  cn,
  directionOf,
  directionText,
  directionWash,
  formatPercent,
  formatMoneyCompact,
  formatEtDateLong,
  formatEtDateMedium,
  formatPercentPlain,
  formatPrice,
  formatVolume,
  headlineMentions,
  isValidSymbol,
  NO_VALUE,
  bandFiyatiKapsiyorMu,
  hareketliOrtalama,
  peRatioOf,
  plural,
  safeExternalUrl,
  timeAgo,
  titleCaseLabel,
} from "@/lib/utils";

/* --------------------------------------------------------------------------
   Sağlayıcı kotasını koruyan süzgeç

   YALNIZCA TANINMAYAN SEMBOLLER SINIRLANIR.

   Bir süre tanınan sembollere de dakikada 40'lık bir tavan konmuştu ve bu,
   siteyi kullanılamaz hale getirdi: Next, görüş alanına giren `<Link>`leri
   kendiliğinden ön yüklüyor ve her ön yükleme sunucuda gerçek bir sayfa
   render'ı demek. 500 satırlık Şirketler dizininde biraz aşağı kaydırmak
   tavanı tek başına tüketiyordu; sonrasında kullanıcının GERÇEK tıklamaları
   "Biraz Yavaşla" ekranına düşüyordu. Yani sınır, korumaya çalıştığı
   kullanıcıyı dışarıda bırakıyordu.

   Doğru ayrım kota değil KARDİNALİTE. Tanınan evren `symbols` tablosundaki
   ~500 sembolle sınırlı ve hepsinin sağlayıcı yanıtı önbellekli; ne kadar
   gezilirse gezilsin sağlayıcıya giden istek sayısının bir tavanı var.
   Sayım saldırısının işlemesi için ise TANINMAYAN sembol gerekiyor — sonsuz
   uzay orası. O yüzden tavan yalnızca oraya konuyor.

   Kendi kendini onaran taraf duruyor: gerçek bir hissenin sayfası
   açıldığında `getCompanyProfile` profili `symbols` tablosuna yazıyor, yani
   sembol bir sonraki ziyarette tanınan tarafa geçiyor ve sınırdan çıkıyor.
   Uydurma semboller hiçbir zaman geçmiyor.
   -------------------------------------------------------------------------- */
const UNKNOWN_LIMIT = 10;
const WINDOW_MS = 60_000;

async function allowStockRender(symbol: string): Promise<boolean> {
  if (await isKnownSymbol(symbol)) return true;
  return rateLimit(await requestKey("stock-unknown"), UNKNOWN_LIMIT, WINDOW_MS)
    .allowed;
}

/**
 * Paylaşım künyesi.
 *
 * Sayfa kendi başlığını vermediğinde Next kökteki varsayılanı miras alıyor
 * ve her hisse linki "Açılış Zili — ABD Piyasa Takibi" diye paylaşılıyordu.
 * Fiyat BURAYA yazılmıyor: künye önbelleğe giriyor ve saatler sonra eski
 * bir fiyatı sanki güncelmiş gibi gösterirdi (bkz. CLAUDE.md → veri
 * dürüstlüğü). Fiyat yalnızca her istekte yeniden çizilen OG kartında.
 */
export async function generateMetadata(
  props: PageProps<"/hisse/[symbol]">,
): Promise<Metadata> {
  const { symbol: raw } = await props.params;
  const symbol = raw.toUpperCase();
  const { locale, t } = await getI18n();
  if (!isValidSymbol(symbol)) return missingMetadata(locale);
  const meta = await getSymbolNames([symbol]);
  const info = meta[symbol];
  const sector = industryLabel(info?.industry, locale);
  /* Açıklama SÖZLÜKTEN. Sabit Türkçe yazılıydı: İngilizce okuyan birinin
     arama sonucunda ve paylaşım kartında Türkçe cümle çıkıyordu — üstelik
     hemen yanındaki sektör etiketi çevrilmiş olarak. */
  const description = sector
    ? t.stock.metaWithSector
        .replace("{ad}", info?.name ?? symbol)
        .replace("{sektor}", sector)
    : t.stock.metaPlain.replace("{ad}", symbol);
  return {
    title: info?.name ? `${info.name} (${symbol})` : symbol,
    description,
    /* CANONICAL VE HREFLANG. Dinamik sayfalar künyelerini elden yazıyor ve
       `alternates` bloğunu hiç vermiyorlardı: sitenin en kalabalık
       adresleri (yüzlerce hisse, her yazı, her analiz) canonical'sız ve
       "öteki dildeki karşılığı şu" bilgisi olmadan yayımlanıyordu. Kök
       layout canonical yazmıyor (orada gerekçesi var), yani miras da yok.
       `pageAlternates` RSS keşif etiketini de birlikte taşıyor. */
    alternates: pageAlternates(`/hisse/${symbol}`, locale),
    /* TANINMAYAN SEMBOL DİZİNE GİRMESİN. Biçimi geçerli her dizi bu sayfayı
       açıyor (`ZQXW` da) ve şirket bilinmiyorsa ekran boş kartlarla doluyor.
       Sonsuz bir adres uzayı: taranırsa hem kotamız hem sitenin dizin
       kalitesi yanar. `follow` açık kalıyor — sayfadaki gerçek bağlantılar
       yine izlensin. Gerçek ama HENÜZ tanınmayan bir sembol bu ziyarette
       profilini yazıyor (allowStockRender yorumuna bak), yani bir sonraki
       taramada tanınan tarafa geçip dizine giriyor. */
    ...(info?.name ? {} : { robots: { index: false, follow: true } }),
  };
}

export default async function StockPage(
  props: PageProps<"/hisse/[symbol]">,
) {
  const { symbol: raw } = await props.params;
  const symbol = decodeURIComponent(raw).toUpperCase();
  const { locale, t } = await getI18n();

  /* Geçersiz sembol 404 DÖNER — ekran `not-found.tsx` dosyasında. Kota
     dolduğunda gösterilen alttaki ekran 200 kalır: adres geçerli, veri yok. */
  if (!isValidSymbol(symbol)) notFound();

  /* Sağlayıcı kotasının en pahalı yüzeyi burası: tanınmayan bir sembolün tam
     sayfası altı ayrı Finnhub ucuna gidiyor (profil, metrik, tavsiye, bilanço
     sürprizi, takvim, haber) ve Finnhub ücretsiz katmanı dakikada 60 istek
     kabul ediyor — yani dakikada ~10 yeni sembol kotayı bitiriyordu. Grafik
     ucundaki iki kademeli sınırın aynısı, aynı gerekçeyle. */
  if (!(await allowStockRender(symbol))) {
    return (
      /* ÇIKIŞ YOLU VAR. Ekran çıplak iki cümleydi: sembol geçerli, veri
         birazdan gelecek ama "tekrar dene" bile yoktu. Aynı adrese giden
         bağlantı sayfayı yeniden çizdiriyor — sınır dakikalık olduğu için
         bekleyen okuyucunun ihtiyacı tam olarak bu. */
      <EmptyState
        title={t.stock.throttled}
        hint={t.stock.throttledHint}
        action={
          <Link
            href={`/hisse/${symbol}`}
            className="text-sm font-semibold text-primary hover:underline"
          >
            {t.common.retry}
          </Link>
        }
      />
    );
  }

  /* Fon sayfası ayrı kurgudur: metrikler, analist tavsiyeleri, katılım taraması
     ve sektör benzerleri bir ETF için anlamsızdır — sağlayıcı da bu uçlarda
     boş döner. Yerine fonun künyesi ve izlediği piyasa anlatılır. */
  const fund = fundMetaOf(symbol);
  if (fund) {
    const fundStatus = await getStatus();
    const fundOffSession =
      fundStatus.session === "pre-market" || fundStatus.session === "after-hours";
    return (
      <MotionExperience className={styles.page}>
        <ScrollProgress />
        {/* FON KÜNYESİ KENDİ ADIYLA: "Şirket Dosyası" bir sepetin adı değil. */}
        <StockBreadcrumb symbol={symbol} t={t}>
          <span className={styles.pageLabel}>{t.stock.fundEyebrow}</span>
        </StockBreadcrumb>
        {/* FON DA KOMPAKT ÜST BLOKTA (24 Eylül). Şirket dalı ilk ekranı
            grafiğe ve profile ayırıyordu, fon dalı ise eski düzende kalmıştı:
            SPY'de 1440×900'de aralık düğmeleri ekranın altındaydı ve 430
            piksellik sabit grafik yan kolonu 150 piksel aşıyordu. Aynı sınıf,
            aynı ölçülü değişkenler, aynı iskelet. */}
        <div className={cn(styles.heroGrid, styles.companyOverview)}>
          <Panel className={styles.chartPanel}>
            <ChartReadingProvider>
            {/* KİMLİK GRAFİĞİN İÇİNE GİRDİ. Başlık (logo, sembol, ad, sektör,
                canlı fiyat) panelin DIŞINDA çıplak bir satırdı ve hemen altındaki
                grafik paneli aynı fiyatı bir kez daha basıyordu: ölçüldü,
                "229,49 $" sayfada iki kez, aralarında yüz piksel. Fiyat ile onun
                grafiği aynı cümle; ayrı iki kutuda durmalarının bir sebebi yoktu.
                Ana sayfadaki geri sayım + gün şeridi birleştirmesiyle aynı hamle.

                GRAFİĞİN KOPYA FİYATI KALKTI ve bu, var olan bir kararın
                DAYANAĞINI güncelliyor: PriceChart'ta o fiyat "dar ekranda yok,
                geniş ekranda kalıyor" diye yazılıydı ve gerekçesi "başlıktaki
                fiyat sağ uçta, ekranın öbür yanında" idi. Birleştirmeden sonra
                öbür yanda değil, tam üstünde — dayanak düştüğü için kopya her
                genişlikte kalktı. Aralığa bağlı YÜZDE grafikte kaldı; o başka
                bir sayı (seçili aralığın getirisi) ve gerekçesi orada yazılı. */}
            <Suspense fallback={<HeaderSkeleton sessionRow={fundOffSession} />}>
              <StockHeader symbol={symbol} locale={locale} t={t} />
            </Suspense>
            <Suspense fallback={<Skeleton className={styles.chartSkeleton} />}>
              <ChartSection symbol={symbol} locale={locale} t={t} compact />
            </Suspense>
            </ChartReadingProvider>
          </Panel>

          <div className={styles.profileColumn}>
            <Suspense fallback={<Skeleton className={styles.fundSkeleton} />}>
              <FundCard symbol={symbol} locale={locale} t={t} />
            </Suspense>

            {/* HAREKETLİ ORTALAMA FONDA DA VAR. Yukarıdaki künye "metrikler
                bir ETF için anlamsızdır" diyor ve doğru — F/K, analist
                tavsiyesi ve katılım taraması bir sepet için tanımsız. Ama
                ortalama bir DEĞERLEME ölçüsü değil, fiyatın kendi geçmişine
                göre yeri; sepette de tam olarak aynı şeyi söylüyor ve SPY'nin
                200 günlük ortalaması piyasanın en çok izlediği sayılardan
                biri. Barlar da kotasyon da öteki dalla aynı yerden geliyor. */}
            <Panel>
              <PanelHeader title={t.stock.movingAverages} className="pb-1.5" />
              <Suspense fallback={<Skeleton className={styles.averagesSkeleton} />}>
                <MovingAverages symbol={symbol} locale={locale} t={t} />
              </Suspense>
            </Panel>
          </div>
        </div>
      </MotionExperience>
    );
  }

  /* Mercek satırları ve analizler AKIŞTAN ÖNCE — gerekçesi blokların kendi
     yorumlarında. İkisi de yerel veritabanı okuması, sağlayıcıya gitmiyor.
     TEK TURDA: ardışık beklenirlerse kabuk iki Neon gidiş dönüşü bekler ve
     kazanılan CLS, gecikmeye geri verilir. */
  const [storyRows, analysisRows, status] = await Promise.all([
    getStoriesForSymbol(symbol, locale, 3),
    getAnalyses(locale, { symbols: [symbol], limit: 6 }),
    /* Yalnızca başlık iskeleti için: seans dışındaysa gerçek başlıkta bir
       hap satırı var ve yedek aynı yeri ayırmalı. İstek içinde önbellekli. */
    getStatus(),
  ]);
  const offSession = status.session === "pre-market" || status.session === "after-hours";
  const latestAnalysis = analysisRows[0];
  const researchLink = latestAnalysis ? (
    <Link
      prefetch={false}
      className="tap-44"
      href={withLocale(analysisHref(latestAnalysis.symbol, latestAnalysis.period), locale)}
    >
      <span>{t.stock.latestAnalysis}</span>
      <strong>{latestAnalysis.periodLabel}</strong>
      <ArrowUpRight aria-hidden size={15} />
    </Link>
  ) : (
    <a href="#stock-earnings" className="tap-44">
      {t.stock.earningsShortcut}
      <ArrowDownRight aria-hidden size={14} />
    </a>
  );

  return (
    <MotionExperience className={styles.page}>
      <ScrollProgress />
      <StockBreadcrumb symbol={symbol} t={t}>
        {/* NVDA at 390px: report links began at y3474, after the entire
            fundamentals chapter. Surface the existing latest report in the
            opening navigation, while retaining the full chart and profile.
            TELEFONDA KÜNYEDE DEĞİL KİMLİKTE (24 Eylül): 768'in altında
            bağlantı künyenin altında tam genişlikte 44 piksellik ikinci bir
            satır açıyordu ve 390×844'te aralık düğmeleri ilk ekranın dışına
            düşüyordu. Aynı bağlantı orada sektör satırının altında bir çip;
            burada yalnızca geniş ekranda görünüyor (`display:none`, yani
            ekran okuyucu da tek kopya duyuyor). */}
        <nav className={styles.researchLinks} aria-label={t.stock.experienceNav}>
          {researchLink}
        </nav>
      </StockBreadcrumb>
      {/* Üst blok — kimlik ve grafik solda tek panelde, şirket künyesi sağda */}
      <div id="stock-overview" className={cn(styles.heroGrid, styles.companyOverview)}>
        {/* SEKMEYLE AYNI ADDA BAŞLIK. "Genel Bakış" sekmesi ilk h2'si "Şirket
            Profili" olan bir bölüme iniyordu; her bölümün başlığı sekmesinin
            adını taşıyor (ChapterHeading). Kapak görsel bir başlık istemiyor
            — kimlik zaten orada — ama belge ağacında adı olmalı. */}
        <h2 className="sr-only">{t.stock.experienceOverview}</h2>
        <Panel className={styles.chartPanel}>
          <ChartReadingProvider>
        {/* KİMLİK GRAFİĞİN İÇİNE GİRDİ. Başlık (logo, sembol, ad, sektör,
            canlı fiyat) panelin DIŞINDA çıplak bir satırdı ve hemen altındaki
            grafik paneli aynı fiyatı bir kez daha basıyordu: ölçüldü,
            "229,49 $" sayfada iki kez, aralarında yüz piksel. Fiyat ile onun
            grafiği aynı cümle; ayrı iki kutuda durmalarının bir sebebi yoktu.
            Ana sayfadaki geri sayım + gün şeridi birleştirmesiyle aynı hamle.

            GRAFİĞİN KOPYA FİYATI KALKTI ve bu, var olan bir kararın
            DAYANAĞINI güncelliyor: PriceChart'ta o fiyat "dar ekranda yok,
            geniş ekranda kalıyor" diye yazılıydı ve gerekçesi "başlıktaki
            fiyat sağ uçta, ekranın öbür yanında" idi. Birleştirmeden sonra
            öbür yanda değil, tam üstünde — dayanak düştüğü için kopya her
            genişlikte kalktı. Aralığa bağlı YÜZDE grafikte kaldı; o başka
            bir sayı (seçili aralığın getirisi) ve gerekçesi orada yazılı. */}
          <Suspense fallback={<HeaderSkeleton sessionRow={offSession} chip />}>
            <StockHeader
              symbol={symbol}
              locale={locale}
              t={t}
              chip={<nav className={styles.identityChip} aria-label={t.stock.experienceNav}>{researchLink}</nav>}
            />
          </Suspense>
          {/* ÖLÇÜLMÜŞ YÜKSEKLİK. Yedek 300 (mobil) / 430 piksel ayırıyordu
              ama grafik bölümü 636–637 piksel kaplıyor: sayfanın EN
              TEPESİNDE 336 piksellik bir sıçrama demekti ve altındaki her
              şeyi itiyordu — hisse sayfasının mobil CLS'i 0,244 çıkıyordu.
              Sayı tahmin değil: beş sembol × üç aralık × beş genişlikte
              ölçüldü, hepsinde 636/637. Grafiğin iç yükseklikleri sabit
              olduğu için bu ölçü içerikle birlikte kaymıyor. */}
          {/* Kompakt görünüm bu eski sabit ölçüyü günceller: gerçek çizim ve
              iki yükleme aşaması aynı viewport değişkenlerini kullanır. */}
          <Suspense fallback={<Skeleton className={styles.chartSkeleton} />}>
            <ChartSection symbol={symbol} locale={locale} t={t} compact />
          </Suspense>
          </ChartReadingProvider>
        </Panel>

        {/* Sağ kolon grafiğin boyuna geriliyor (ızgara varsayılanı) ama
            kartlar doğal boyunda kaldığı için altta tırtıklı bir boşluk
            kalıyordu. Profil kartı artık artan yeri kendi içine alıyor:
            satırlar boşluğa yayılıyor, kartın alt kenarı grafiğinkiyle
            hizalanıyor. Veri çoksa `flex-1` zaten bağlayıcı olmuyor ve kart
            eskisi gibi içeriği kadar yer kaplıyor. */}
        {/* İlk ekran artık doğal boydaki özeti gösterir; satırlar grafiğin
            yüksekliğine göre esnetilmez. Yaklaşan bilanço kendi bölümündedir. */}
        <div className={styles.profileColumn}>
          {/* PROFİL ÜSTTE, TEKNİK ANALİZ ALTINDA (23 Eylül, sahibinin
              isteği). Bir dönem tersiydi — "analiz günlük yenilenen bir
              görüş, taze olan üstte" gerekçesiyle; ama sağ kolonu şirketin
              kimliğiyle açmak okuyucunun sırasına daha uygun: önce ne iş
              yaptığı ve büyüklüğü, sonra hissenin teknik görünümü. Kapsam
              dışındaki sembollerde teknik kart hiç basılmıyor ve kolon
              yalnızca profilden oluşuyor. */}
          <Panel className={styles.profilePanel}>
            {/* Başlık kartın İÇİNDE çiziliyor: künye (kaynak · saat) ayrı bir
                dip satırı değil, başlığın sağındaki boş yerde duruyor. Yedek
                aynı başlığı basıyor, akış gelince hiçbir şey kaymıyor.
                Altı künye satırı + iki paragraf: gövde 369 (mobil) / 437
                piksel. Beş satırlık yedek 216 piksel ayırıyordu. */}
            <Suspense
              fallback={
                <>
                  <PanelHeader title={t.stock.profile} />
                  <ListSkeleton rows={10} />
                </>
              }
            >
              <ProfileCard symbol={symbol} locale={locale} t={t} />
            </Suspense>
          </Panel>
          {/* YEDEK KARTIN BOYUNDA (24 Eylül). `null` idi: kapsamdaki
              sembollerde kart akışla gelip kolonu 179-201 piksel uzatıyor,
              kolon da grafiği geriyordu — NVDA'da 1440'ta CLS 0,027. Kart
              yalnızca kapsamdaki sembolde basıldığı için yedek de öyle. */}
          <Suspense
            fallback={
              isTechnicalSymbol(symbol) ? <Skeleton className={styles.technicalSkeleton} /> : null
            }
          >
            <StockTechnicalCard symbol={symbol} locale={locale} t={t} />
          </Suspense>
        </div>
      </div>

      {/* Bölüm menüsü ilk ekranı bölmez; özetin ardından doğal akışta gelir
          ve kaydırınca üstte kalır. 1280×720 ölçümünde eski menü/boşluk
          grafiğin önünde 80px harcıyordu. */}
      <SectionNav
        className={styles.chapterNav}
        label={t.stock.experienceNav}
        /* Telefonda aşağı kaydırınca çekilir (844 piksellik ekranın 202
           pikselini sabit katmanlar tutuyor); gerekçe `SectionNav` başında. */
        hideOnScrollDown
        /* YAPIŞINCA KİMLİK (24 Eylül). Aşağıda Değerleme ya da Bilançolar
           okunurken sayfanın hangi şirkete ait olduğu ve fiyatı ekranda
           hiçbir yerde kalmıyordu. Kimlik yalnızca çubuk yapışınca açılıyor
           (SectionNav); fiyat başlıktakiyle AYNI istek-içi önbellek
           anahtarından (`getQuote`), ek sağlayıcı turu yok. */
        lead={
          <Suspense fallback={<span className={styles.navLead} />}>
            <NavLead symbol={symbol} locale={locale} />
          </Suspense>
        }
        items={[
          { id: "stock-overview", label: t.stock.experienceOverview },
          { id: "stock-fundamentals", label: t.stock.chapterValuation },
          { id: "stock-earnings", label: t.stock.chapterEarnings },
          { id: "stock-context", label: t.stock.chapterContext },
        ]}
      />

      {/* Ölçüler şeridi — üç kart yan yana; dar ekranda kendiliğinden alt alta.
          Eskiden bunlar tek sütuna dizildiği için sağ kolon uzayıp sol taraf
          boş kalıyordu; artık sayfanın tam genişliğini kullanıyorlar. */}
      <section id="stock-fundamentals" className={cn(styles.chapter, styles.fundamentalsChapter)}>
        <ChapterHeading title={t.stock.chapterValuation} />
        <ScrollStage>
        <div className={styles.fundamentalsGrid}>
        {/* `flex flex-col` — içerideki liste kutuyu doldurabilsin diye;
            gerekçe MetricsCard'ın kendi künyesinde. */}
        <Panel className={styles.metricsPanel}>
          <PanelHeader title={t.stock.metrics} action={<SquaresFour className={styles.cardIcon} size={19} weight="duotone" aria-hidden />} />
          {/* ON ölçü satırı: sekiz sabit (F/K, hisse başına kâr, temettü,
              beta, 52 hafta yüksek/düşük, hacim) artı üç koşullu (ileri
              F/K, net kâr marjı, borç/özsermaye) — üçü de gelmezse yedi.
              Yedek ON satır ayırıyor çünkü koşulluların üçü de gerçek
              şirketlerde neredeyse hep geliyor; sayı bir dönem sekizde
              kalmıştı ve iki satırlık (74 piksel) bir sıçrama yapıyordu. */}
          <Suspense fallback={<Skeleton className={styles.metricsSkeleton} />}>
            <MetricsCard symbol={symbol} locale={locale} t={t} />
          </Suspense>
        </Panel>

        {/* ORTA SÜTUN İKİ PARÇA. Üstte hareketli ortalamalar, altında
            katılım taraması. İkisi de kısa kartlar ve tek başlarına
            bırakıldıklarında yanlarındaki uzun kartların yanında bir sütunu
            yarıya kadar dolduruyorlardı; alt alta gelince şerit üç eşit
            kolona oturuyor.

            SON PANEL BÜYÜYOR (`flex-1`), ARALIK DEĞİL. Izgara satırı üç
            kolonu aynı yüksekliğe geriyor ve fark bir yere gitmek zorunda.
            `justify-between` bu farkı PANEL ARASINA dağıtırdı — CLAUDE.md
            "Düzen" bölümü tam olarak bunu yasaklıyor, çünkü o zaman aralık
            kendi ölçüsü olmaktan çıkıp komşu kolonun boyuna bağlanıyor.
            Aralık `gap-5` sabit kalıyor; artan yer alttaki kartın İÇİNE
            gidiyor ve iki sütun aynı hizada bitiyor. */}
        {/* Four independent cards now share two rows. No card absorbs the height of a neighboring column. */}
          <Panel className={styles.averagesPanel}>
            {/* KAPSAMDAKİ ON İKİ HİSSEDE ORTALAMALAR PANELİ TEKNİK ANALİZE AÇILIYOR.
                Bağlantı yalnızca tek yöndeydi: teknik sayfa şirkete gidiyor,
                şirket sayfası hissenin günlük teknik analizinin var olduğunu
                hiç söylemiyordu. `isTechnicalSymbol` saf bir küme sorgusu;
                öteki semboller için ek sorgu ya da maliyet yok.

                ARTIK ASIL KÖPRÜ YUKARIDA: sayfanın en üstünde, profil
                kartının üzerinde duran teknik analiz kartı
                (`StockTechnicalCard`) görüşü ve gerekçesinin ilk cümlesini
                de gösteriyor. Buradaki bağlantı duruyor çünkü BAĞLAMI
                başka: okuyucu ortalamalara bakarken "bu seviyelerin
                yorumu nerede" diye soruyor ve cevabı satırın yanında
                buluyor. */}
            <PanelHeader
              title={t.stock.movingAverages}
              action={
                isTechnicalSymbol(symbol) ? (
                  <PanelLink href={technicalHref(symbol)}>{t.technical.title}</PanelLink>
                ) : (
                  <ChartLineUp className={styles.cardIcon} size={19} weight="duotone" aria-hidden />
                )
              }
            />
            <Suspense fallback={<Skeleton className={styles.averagesSkeleton} />}>
              <MovingAverages symbol={symbol} locale={locale} t={t} />
            </Suspense>
          </Panel>

        {/* PANEL VE BAŞLIK KARTIN İÇİNDE. Başlığın sağındaki rozet
            sağlayıcıdan gelen veriden hesaplanıyor, yani başlık akışın
            dışında kalamıyor. Yedek de artık başlık şeridini çiziyor —
            beş satır, kartın gerçekte bastığı kova sayısı. */}
        <Suspense fallback={<Skeleton className={styles.analystSkeleton} />}>
          <AnalystCard symbol={symbol} locale={locale} t={t} />
        </Suspense>
          <Suspense
            fallback={
              <Skeleton className="h-[220px] w-full rounded-(--radius-xl)" />
            }
          >
            <ComplianceCard symbol={symbol} locale={locale} t={t} />
          </Suspense>

      </div>

        </ScrollStage>
      </section>

      <section id="stock-earnings" className={styles.chapter}>
        <ChapterHeading title={t.stock.chapterEarnings} />
        {/* Yaklaşan bilanço, geçmiş sonuçlarla aynı bölümde; ilk fiyat ekranının boyunu uzatmaz. */}
        <Suspense
          fallback={
            <Skeleton className="h-[160px] w-full rounded-(--radius-xl) sm:h-[168px]" />
          }
        >
          <UpcomingEarnings symbol={symbol} locale={locale} t={t} />
        </Suspense>
      {/* Analizler tablonun HEMEN üstünde: tablo çeyreklerin rakamları,
          panel o rakamların okunmuş hâli. Analizi olmayan şirkette hiçbir
          şey basılmaz. Akışta DEĞİL — gerekçesi bileşenin kendi yorumunda. */}
      <Reveal><SymbolAnalyses rows={analysisRows} locale={locale} t={t} /></Reveal>

      {/* Bilanço tablosu tam genişlikte — kolonlar sıkışmadan okunur */}
      <Reveal>
      <Panel className={styles.earningsPanel}>
        <PanelHeader title={t.stock.pastEarnings} />
        <Suspense fallback={<ListSkeleton rows={6} />}>
          <PastEarnings symbol={symbol} locale={locale} t={t} analyses={analysisRows} />
        </Suspense>
      </Panel>

      </Reveal>
      </section>

      <section id="stock-context" className={styles.chapter}>
        <ChapterHeading title={t.stock.chapterContext} />
      {/* MERCEK EN SONDA, GEÇMİŞ BİLANÇOLARIN DA ALTINDA. Sıralama kodun
          kendi gerekçesini takip ediyor: analiz bir çeyreğin okunmuş hâli,
          geçmiş bilançolar o çeyreklerin tablosu — ikisi aynı malzeme ve
          yan yana durmalı. Mercek ise bir olayın anlatısı, yani bir adım
          geride duran bağlam; araya girdiğinde analizle tabloyu birbirinden
          ayırıyordu.

          SATIRLAR AKIŞTAN ÖNCE ÇEKİLİYOR. Blok `fallback={null}` ile
          akıyordu; kartlara geçince mobilde ~840 piksellik bir blok geç
          gelip altındaki her şeyi itmeye başladı ve sayfanın mobil CLS'i
          NVDA'da 0,266'ya çıktı. Yer tutucu koymak tek başına çözüm değil:
          806 sembolün yalnızca 68'inde yazı var, yani yer tutucu çoğu
          sayfada hiç gelmeyecek bir blok için boşluk ayırırdı.
          "Yazı var mı" sorusu bu yüzden burada, yerel bir veritabanı
          okumasıyla yanıtlanıyor — sağlayıcıya gitmiyor. Yazı yoksa hiçbir
          şey basılmıyor; varsa iskelet gerçek kart sayısını çiziyor ve
          sağlayıcıya giden iş (logolar, olaydan bugüne getirisi) akışta
          kalıyor. */}
      {storyRows.length > 0 && (
        <Suspense
          fallback={<SymbolStoriesSkeleton count={storyRows.length} />}
        >
          <SymbolStories
            rows={storyRows}
            symbol={symbol}
            locale={locale}
            t={t}
          />
        </Suspense>
      )}


      <Suspense fallback={<Skeleton className="h-48 w-full rounded-(--radius-xl)" />}>
        <PeersCard symbol={symbol} locale={locale} t={t} />
      </Suspense>

      {/* Haberler en altta — mobilde de masaüstünde de son durak */}
      <Reveal>
      <Panel className={styles.newsPanel}>
        {/* SEMBOL SÜZGECİNE KÖPRÜ. `/haberler?sembol=XXX` çalışıyor ve bir
            hata düzeltmesiyle sağlamlaştırılmış (60 haberlik pencere,
            `getNewsForSymbol`) ama SİTEDE HİÇBİR YERDEN bağlantı verilmiyordu:
            yalnızca adresi elle yazan bulabiliyordu. Bu panel şirketin son
            sekiz haberini gösteriyor, süzgeç altmışını; okuyucunun "devamı
            var mı" sorusunun cevabı buradaydı ve gösterilmiyordu. */}
        <PanelHeader
          title={t.stock.companyNews}
          action={
            <PanelLink href={`/haberler?sembol=${symbol}`}>
              {t.common.showAll}
            </PanelLink>
          }
        />
        <Suspense fallback={<ListSkeleton rows={4} />}>
          <CompanyNews symbol={symbol} locale={locale} t={t} />
        </Suspense>
      </Panel>
      </Reveal>
      {/* SAYFA REHBERLE KAPANIYOR — öteki ekranların sırası (CLAUDE.md
          "Ekran düzeni" 7). Tablonun altındaki EPS açıklama paragrafının
          yerini de bu şerit alıyor: kısaltma orada tek satırlık künye,
          ayrıntısı burada. */}
      <GuideHint
        label={t.guide.contextLabel}
        locale={locale}
        slugs={["bilanco", "degerleme", "piyasa-degeri"]}
        className="pt-1"
      />
      </section>
    </MotionExperience>
  );
}

function StockBreadcrumb({ symbol, t, children }: { symbol: string; t: Dictionary; children?: React.ReactNode }) {
  return (
    <div className={styles.breadcrumb}>
      {/* `tap-44`: bağlantı 18 piksel yüksekliğinde ve telefonda parmak ~44
          piksellik bir alana basıyor — künyedeki öteki geri bağlantıları
          (rehber, mercek) bu sınıfı zaten taşıyor, hisse sayfası atlanmıştı.
          Genişletme yalnızca DİKEY ve 13'er piksel; ölçüldü, en yakın
          dokunulabilir komşu yukarıda 34, aşağıda 40 piksel uzakta, yani
          `globals.css`teki "saran listede komşunun hedefini kapar" istisnası
          burada geçerli değil. */}
      <Link href="/sirketler" className={cn("tap-44", styles.backLink)}>
        <ArrowLeft size={15} weight="bold" />
        {t.nav.companies}
      </Link>
      <span aria-hidden className={styles.breadcrumbSlash}>/</span>
      <span className="numeral text-xs font-semibold text-strong">{symbol}</span>
      {children ?? <span className={styles.pageLabel}>{t.stock.experienceEyebrow}</span>}
    </div>
  );
}

/* Bölüm başlığı burada `SectionHeading` adıyla yerel bir bileşendi: başlık,
   yaklaşık sekiz yüz sayfada birebir aynı olan genel bir alt cümle ve
   sağında hiçbir yere götürmeyen 30 piksellik bir ok. Artık paylaşılan
   `ChapterHeading` (components/ui) — gerekçe orada; sekme etiketi ile
   bölüm başlığı aynı sözlük anahtarını okuyor. */

/** Yapışkan menünün kimliği: logo, sembol, fiyat ve yüzde. */
async function NavLead({ symbol, locale }: { symbol: string; locale: Locale }) {
  const status = await getStatus();
  const [quote, meta] = await Promise.all([getQuote(symbol, status), getSymbolNames([symbol])]);
  const logo = meta[symbol]?.logoUrl;
  return (
    <span className={styles.navLead}>
      {logo && (
        <span className={styles.navLeadLogo}>
          <Image src={logo} alt="" width={22} height={22} />
        </span>
      )}
      <span className={cn("numeral", styles.navLeadSymbol)}>{symbol}</span>
      {quote.ok && (
        <>
          <span className="numeral text-[13px] font-semibold text-strong">
            {formatPrice(quote.data.price, locale, { currency: true })}
          </span>
          <ChangePill changePct={quote.data.changePct} locale={locale} size="sm" className={styles.navLeadPill} />
        </>
      )}
    </span>
  );
}

/* ==========================================================================
   Başlık: fiyat + favori yıldızı
   ========================================================================== */

async function StockHeader({
  symbol,
  locale,
  t,
  chip,
}: {
  symbol: string;
  locale: Locale;
  t: Dictionary;
  /** Telefonda sektör satırının altındaki araştırma bağlantısı. */
  chip?: React.ReactNode;
}) {
  const status = await getStatus();
  const [quoteResult, profileResult, session] = await Promise.all([
    getQuote(symbol, status),
    getCompanyProfile(symbol),
    auth(),
  ]);

  const profile = profileResult.ok ? profileResult.data : null;
  /* Künyedeki sektör, profil panelindekiyle ve /teknik dağılım balonuyla
     AYNI tercih sırasından geliyor (`companySector`): GICS varsa o, yoksa
     sağlayıcının serbest metinli alanı. */
  const kunyeSektor = companySector(symbol, profile?.industry, locale);
  // Fonlarda sağlayıcı profili boş döner — ad ve künye yerel kayıttan gelir.
  const fund = fundMetaOf(symbol);

  let isFavorite = false;
  if (session?.user?.id) {
    try {
      const rows = await db
        .select({ id: watchlistItems.id })
        .from(watchlistItems)
        .innerJoin(watchlists, eq(watchlistItems.watchlistId, watchlists.id))
        .where(
          and(
            eq(watchlists.userId, session.user.id),
            eq(watchlistItems.symbol, symbol),
          ),
        )
        .limit(1);
      isFavorite = rows.length > 0;
    } catch {
      // veri yoksa yıldız pasif kalır
    }
  }

  /* SEANS DIŞINDAKİ FİYAT KENDİNİ SÖYLÜYOR.
     Konsolide tape'e geçtikten sonra açılış öncesi ve kapanış
     sonrası işlemler akıyor (eski IEX beslemesinde hiç akmıyordu),
     yani buradaki sayı artık "dünkü kapanış" değil o dakikanın ön
     seans fiyatı. Ama ekranda bunu söyleyen hiçbir şey yoktu:
     okuyucu seans dışı bir baskıyı normal seans fiyatı sanıyordu.
     Yanındaki önceki kapanış da yüzdenin neye göre hesaplandığını
     görünür kılıyor — aradaki fark elle doğrulanabiliyor. */
  const sessionNote =
    quoteResult.ok &&
    (status.session === "pre-market" || status.session === "after-hours") ? (
      <p className="mt-2 flex flex-wrap items-center justify-start gap-x-2 gap-y-1 text-tiny">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-wash px-2.5 py-[3px] font-semibold text-primary-ink">
          <span aria-hidden className="size-1.5 rounded-full bg-current" />
          {status.session === "pre-market" ? t.market.preMarket : t.market.afterHours}
        </span>
        {quoteResult.data.prevClose !== null && (
          <span className="numeral text-muted">
            {t.market.prevClose}{" "}
            {formatPrice(quoteResult.data.prevClose, locale, { currency: true })}
          </span>
        )}
      </p>
    ) : null;

  return (
    <header className={styles.stockHeader}>
      {/* `data-morph-stage`: logo uçarak gelirken ad ve künye bekliyor,
          inince yanından açılıyor (components/motion/Morph). */}
      <div data-motion-reveal data-morph-stage className={styles.identity}>
        {profile?.logoUrl ? (
          /* Logo ÇERÇEVESİZ ve tam oturur: kenarlık + iç dolgu, logoyu beyaz
             bir kutunun ortasında küçük bir damga gibi gösteriyordu. Artık
             kare kendi köşe yarıçapıyla kırpılıyor, görsel kutuyu tümüyle
             dolduruyor. Beyaz zemin duruyor çünkü logoların çoğu şeffaf PNG
             ve koyu temada kendi koyu harfleriyle kayboluyor. */
          /* Listeden gelindiyse logo tıklanan satırın yerinden buraya uçuyor
             (components/motion/Morph). */
          <MorphTarget morphKey={`logo:${symbol}`}>
            <span className={styles.companyLogo}>
              <Image
                src={profile.logoUrl}
                alt=""
                width={64}
                height={64}
                className="size-full object-contain"
              />
            </span>
          </MorphTarget>
        ) : fund ? (
          // Fonun logosu yok; ülke/piyasa bayrağı kimliği taşır
          <span
            aria-hidden
            className="flex size-14 shrink-0 items-center justify-center rounded-(--radius-lg) border border-line bg-surface-elevated text-2xl"
          >
            {fund.flag}
          </span>
        ) : null}
        <div className="min-w-0">
          {/* SIRA: SEMBOL → AD → KÜNYE.
              Önce künye (borsa · sektör) geliyordu, altında ad ve onun
              yanında sembol ile kalp. Telefonda üçü de sığmıyordu: künye iki
              satıra kırılıyor, 24 puntoluk ad satırı dolduruyor, sembol ve
              kalp üçüncü satıra düşüyordu — kalp adın yanında bir eylem
              olmaktan çıkıp havada asılı bir ikona dönüşüyordu.
              Yeni sıra kimliği yukarı alıyor: sembol ve kalp aynı satırda ve
              her zaman birlikte (ikisi de kısa, hiçbir genişlikte
              ayrılmıyorlar), altında tam ad, en altta künye tek satırda
              kırpılıyor. Künye bir etiket, başlık değil — en alta düşmesi
              okuma sırasını da düzeltiyor. */}
          <div className="flex items-center gap-2">
            <span className={cn("numeral", styles.symbol)}>
              {symbol}
            </span>
            {session?.user ? (
              /* Kalp KENDİ istemci bileşeninde: tıklamanın karşılığını
                 anında vermesi gerekiyor (bkz. FavoriteToggle). */
              <FavoriteToggle
                symbol={symbol}
                isFavorite={isFavorite}
                addLabel={t.stock.addToWatchlist}
                removeLabel={t.stock.removeFromWatchlist}
              />
            ) : (
              /* GİRİŞ YAPMAMIŞA DA GÖRÜNÜYOR. Düğme tamamen gizliydi: ürünün
                 hesap açma gerekçesi tam olarak takip listesi ama bu vaat,
                 dönüşüm ihtimalinin en yüksek olduğu yerde — okuyucu bir
                 şirketin sayfasındayken — hiç gösterilmiyordu. `devam`
                 parametresi `safeRedirectTarget` ile doğrulanıyor, giriş
                 sonrası okuyucu aynı hisseye dönüyor. */
              <Link
                href={`/giris?devam=${encodeURIComponent(`/hisse/${symbol}`)}`}
                aria-label={t.stock.addToWatchlist}
                title={t.stock.addToWatchlist}
                className="tap-44 inline-flex size-8 items-center justify-center rounded-sm text-muted transition-colors hover:bg-surface-elevated hover:text-soft"
              >
                <Heart weight="duotone" size={17} />
              </Link>
            )}
          </div>
          <h1 className={styles.companyName}>
            {profile?.name || fund?.name || symbol}
          </h1>
          {/* Künye şeridi — borsa · sektör.
              SEKTÖR AYNI KAYNAKTAN. Burası sağlayıcının serbest metinli
              alanını yazıyordu, otuz piksel aşağıdaki profil paneli ise
              GICS sınıflandırmasını: /hisse/CSCO'da künye "İletişim",
              panel "Bilgi Teknolojileri" diyordu. /hisse/WMT'de künye
              "Perakende", panel "Temel Tüketim". Tek sayfada iki farklı
              sektör iddiası, üstelik ikisi de aynı ekranda görünüyor.
              Tercih sırası panelinkiyle birebir: GICS varsa o, yoksa
              sağlayıcının alanı. */}
          {kunyeSektor && (
            /* BORSA ADI KÜNYEDEN ÇIKTI. Satır "NASDAQ NMS - GLOBAL MARKET ·
               BİLGİ TEKNOLOJİLERİ" diye kuruluyor ve 390 pikselde 39 piksel
               kırpılıyordu — kesilen yer de sektördü. İkisi de aşağıdaki
               Şirket Profili kartında kendi satırlarında zaten var; künye
               genişliğinin tamamını tekrara harcayıp tekrar olmayan yarısını
               kesiyordu. Sektör tek başına sığıyor. */
            <p className={styles.sector}>
              {kunyeSektor}
            </p>
          )}
          {chip}
          {fund && (
            <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-tiny leading-tight text-muted">
              <span className="font-semibold text-soft">
                {locale === "tr" ? fund.labelTr : fund.labelEn}
              </span>
              <span aria-hidden>·</span>
              <span>{locale === "tr" ? fund.tracksTr : fund.tracksEn}</span>
            </p>
          )}
        </div>
      </div>

      {quoteResult.ok ? (
        <div className={styles.priceBlock}>
          {/* FİYAT VE DEĞİŞİM AYNI SATIRDA. Değişim satırı fiyatın altına
              iniyordu ve telefonda başlık dört satıra çıkıyordu; oysa ikisi
              tek bir okuma — "şu fiyat, şu kadar değişmiş". Sığmadığında
              kendiliğinden alt satıra iniyor (`flex-wrap`), sığdığında yan
              yana duruyorlar. `items-baseline`: 28 puntoluk fiyat ile 13
              puntoluk değişim taban çizgisinde hizalı.
              SATIR İSTEMCİ YAPRAĞI (`HeaderReadout`): grafikte bir nokta
              okunurken burası o barın kapanışını yazıyor — gerekçe
              components/stock/ChartReadingContext.tsx. Canlı sayılar ve
              damga yine burada, sunucuda hesaplanıyor. */}
          <HeaderReadout
            price={quoteResult.data.price}
            change={quoteResult.data.change}
            changePct={quoteResult.data.changePct}
            locale={locale}
            classes={{ line: styles.priceLine, price: cn("tote", styles.livePrice), change: styles.priceChange }}
            session={sessionNote}
            stamp={
              <DataStamp
                labels={t.data}
                source={quoteResult.source}
                at={quoteResult.fetchedAt}
                stale={quoteResult.stale}
                locale={locale}
                className="m-0 justify-start"
              />
            }
          />
        </div>
      ) : (
        <div className="text-right">
          <p className="text-sm text-muted">{t.data.failed}</p>
        </div>
      )}
    </header>
  );
}

/**
 * Hisse başlığının yer tutucusu — gerçek başlığın SARMA DÜZENİYLE aynı.
 *
 * Burada iki blok yan yana sabitti ve iskelet 60 piksel kaplıyordu; gerçek
 * başlık ise dar ekranda fiyat bloğunu alt satıra indirdiği için 167 piksel
 * (320 pikselde 203). Aradaki 107 piksel sayfanın EN ÜSTÜNDE açılıyor ve
 * altındaki her şeyi itiyordu — hisse sayfasının mobil CLS'i 0,185–0,244
 * çıkıyordu, Google'ın "kötü" eşiğinin iki katı.
 *
 * Yükseklik yazılmıyor: aynı `flex-wrap` ve aynı `w-full sm:w-auto` kuralı
 * kullanıldığı için iskelet de gerçek başlıkla aynı genişlikte sarıyor ve
 * içerik değiştikçe onunla birlikte kayıyor.
 */
function HeaderSkeleton({ sessionRow = false, chip = false }: { sessionRow?: boolean; chip?: boolean }) {
  return (
    <header className={styles.stockHeader}>
      <div className="flex items-center gap-3">
        <Skeleton className="size-12 shrink-0 rounded-(--radius-lg)" />
        <div className="flex flex-col gap-1">
          <Skeleton className="h-6 w-20" />
          <Skeleton className="h-8 w-44" />
          <Skeleton className="h-3.5 w-36" />
          {chip && <Skeleton className="mt-1.5 h-7 w-48 md:hidden" />}
        </div>
      </div>
      {/* FİYAT BLOĞU GERÇEĞİN ÖLÇÜLERİYLE (24 Eylül). Yedek 64 + 30 + 28
          piksellik üç blok basıyordu; gerçek blok fiyat satırı (puntosu
          kadar, `line-height:1`) + seans dışında hap satırı + künye. 1440'ta
          122'ye karşı 108, 768'de ise 127'ye karşı 96 piksel: akış gelince
          grafik 31 piksel yukarı kayıyordu (CLS 0,019). Fiyatın yeri artık
          aynı sınıfla (`livePrice`, 1em), hap satırı yalnızca seans
          dışındaysa — sunucu seansı zaten biliyor. */}
      <div className={styles.priceBlock}>
        <div className={styles.priceLine}>
          <span className={cn("skeleton block w-52", styles.livePrice, styles.priceSkeleton)} />
        </div>
        {sessionRow && <Skeleton className="mt-2 h-[26px] w-56" />}
        <Skeleton className="mt-2 h-[19px] w-48" />
      </div>
    </header>
  );
}

/* ==========================================================================
   Grafik — yön rengi günün değişiminden gelir
   ========================================================================== */

async function ChartSection({
  symbol,
  locale,
  t,
  compact = false,
}: {
  symbol: string;
  locale: Locale;
  t: Dictionary;
  compact?: boolean;
}) {
  /* Grafiğin okuma satırı ile sayfa başlığındaki fiyat AYNI kaynaktan gelmeli.
     Eskiden başlık anlık kotasyonu (son işlem), grafik ise son DAKİKA BARININ
     kapanışını yazıyordu; ikisi tanımı gereği farklı sayılar ve ekranda yan
     yana duran iki fiyat birbirini tutmuyordu ($897,75 ile $897,06 gibi).
     Kotasyon buradan geçiriliyor: eğri barlardan çizilmeye devam ediyor, ama
     büyük punto ile yazılan fiyat başlıktakiyle aynı. İkinci çağrı sağlayıcıya
     gitmiyor — aynı önbellek. */
  const status = await getStatus();
  /* Barlar da BURADA çekiliyor. Grafik onları istemciden `/api/chart` ile
     ikinci kez istiyordu: "HTML → JS indir → hidrasyon → fetch → çizim".
     Veri sunucuda zaten erişilebilir ve `/api/chart` yanıtları `no-store`
     olduğu için o istek hiçbir katmanda önbelleğe de girmiyordu. */
  const [result, bars, holidays] = await Promise.all([
    getQuote(symbol, status),
    getChartBars(symbol, "1D", status),
    getHolidays(),
  ]);

  /* KAPANIŞ, ÇİZİLEN GÜNÜN KAPANIŞI — "bugünün" değil.
     Buraya `status.closeMinutes` veriliyordu, yani BUGÜNÜN kapanışı; 1G
     grafiği ise son İŞLEM gününü çiziyor ve ikisi ayrışabiliyor. 28 Kasım
     2026 cumartesi bir hisse sayfası açıldığında `getMarketStatus`
     cumartesi için tatil kaydı bulamıyor ve 16:00 dönüyor, grafik ise 27
     Kasım cumayı (13:00 erken kapanış) çiziyor: gölgeler piyasanın kapalı
     olduğu üç saati ana seans gibi boyuyordu.
     Barlar zaten burada, dolayısıyla çizilecek gün de biliniyor. */
  const grafikGunu = bars.ok && bars.data.length > 0
    ? etParts(new Date(bars.data[0].time * 1000)).dateStr
    : status.etDate;

  return (
    <PriceChartLazy
      symbol={symbol}
      compact={compact}
      locale={locale}
      labels={chartLabels(t)}
      closeMinutes={closeMinutesFor(grafikGunu, holidays)}
      /* Uç ancak çizilen gün BUGÜNÜN seansıysa ve seans açıksa atıyor
         (gerekçe PriceChart → "SERİNİN UCU ATIYOR"). */
      live={status.session !== "closed" && grafikGunu === status.sessionDate}
      quote={
        result.ok
          ? {
              price: result.data.price,
              changePct: result.data.changePct,
              /* İŞLEM ANI DA GİDİYOR. Okuma satırı 1G'nin SON noktasında
                 başlıktaki fiyatı yazıyor (gerekçesi `PriceChart` içinde) ama
                 bunu ancak kotasyon son bardan yeniyse yapmalı; ölçü bu
                 damga. */
              tradedAt: result.data.tradedAt?.toISOString() ?? null,
            }
          : null
      }
      initialBars={
        bars.ok
          ? {
              bars: bars.data,
              prevClose: result.ok ? result.data.prevClose : null,
            }
          : null
      }
    />
  );
}

/* ==========================================================================
   Profil / metrikler / analistler / bilançolar / haberler
   ========================================================================== */

/** Bilanço kayıtlarının ortak biçimi — DB satırı da sağlayıcı girdisi de buna iner. */
type EarningsItem = {
  reportDate: string;
  hour: string | null;
  epsEstimate: number | null;
  epsActual: number | null;
  revenueEstimate: number | null;
  revenueActual: number | null;
  quarter: number | null;
  year: number | null;
};

/**
 * Sembolün bilanço geçmişi + geleceği. Yerel takvim tablosu yalnızca yakın
 * aralığı tutar; kapsam dışı kalan sembollerde Finnhub'ın sembol bazlı
 * takvimi devreye girer (geçmiş ~13 ay, gelecek ~4 ay — 6 saat önbellekli).
 */
async function symbolEarnings(symbol: string): Promise<EarningsItem[]> {
  const today = todayEt();
  const result = await getEarningsCalendar(
    addEtDays(today, -400),
    addEtDays(today, 120),
    symbol,
  );
  return result.ok ? result.data : [];
}

/**
 * Yaklaşan bilanço — sağ kolonun tepesinde pirinç vurgulu kart.
 * Tarih, seans zamanı ve analistlerin EPS + gelir beklentisi bir arada.
 */
/**
 * Sembolün para birimi — `formatPrice`/`formatMoneyCompact`e verilecek biçimde.
 *
 * NEDEN: sağlayıcının bilanço rakamları dolar değil, ŞİRKETİN ANA BORSASININ
 * parasında geliyor. /hisse/TSM'de "Gelir Beklentisi 1,47 T $" yazıyordu —
 * bir çeyrekte bir buçuk trilyon dolar; sayı doğru, para birimi (TWD) yanlıştı.
 *
 * Kural bu sayfada üç yerde uygulanmıştı (anahtar metrikler, yaklaşan bilanço
 * kartı, karşılaştırma tablosu) ama GEÇMİŞ BİLANÇOLAR tablosu dışarıda
 * kalmıştı: orada her hücre koşulsuz `{ currency: true }` ile basılıyordu.
 * Sonuç TSM'de 27,25 TWD'nin "27,25 $" görünmesi, PDD'de 118 milyar CNY'nin
 * "118 Mr $" görünmesiydi — yedi kat şişik bir sayı, üstelik ekranın en
 * güvenilir görünen yerinde, bir tablonun içinde.
 *
 * Üç ayrı kopya yerine tek yardımcı: dördüncü bir kullanım yeri çıktığında
 * kuralın yeniden unutulacağı bir yer kalmasın. `getSymbolNames` istek içinde
 * önbellekli, yani ikinci çağrı sağlayıcıya gitmiyor.
 *
 * `true` "dolar olarak biçimlendir" demek — `formatPrice`in sözleşmesi bu.
 */
async function paraSecenegi(symbol: string): Promise<string | true> {
  const meta = await getSymbolNames([symbol]);
  const kod = meta[symbol]?.currency ?? null;
  return kod && kod !== "USD" ? kod : true;
}

/** `formatMoneyCompact` kod ya da `null` ister; `true` orada geçmiyor. */
function paraKoduOf(opt: string | true): string | null {
  return typeof opt === "string" ? opt : null;
}

async function UpcomingEarnings({
  symbol,
  locale,
  t,
}: {
  symbol: string;
  locale: Locale;
  t: Dictionary;
}) {
  const paraOpt = await paraSecenegi(symbol);
  const today = todayEt();
  /* Tüm takvim satırları TEK SORGUDA: hem sıradaki bilanço hem son açıklanan
     aynı listeden çıkıyor, sağlayıcıya ikinci tur yok. */
  const tumu = await symbolEarnings(symbol);
  let next: EarningsItem | null = await getNextEarnings(symbol);
  if (!next) {
    next =
      tumu
        .filter((row) => row.reportDate >= today)
        .sort((a, b) => a.reportDate.localeCompare(b.reportDate))[0] ?? null;
  }
  if (!next) return null;

  /* BEKLENTİ KARNESİ — kartın boşluğunu dolduran şey tablonun KOPYASI değil,
     tablonun söylemediği ÖZET. Aşağıdaki Geçmiş Bilançolar zaten her çeyreğin
     tarihini, beklentisini, gerçekleşenini ve sapmasını satır satır yazıyor;
     bu kart forward bakıyor ve "şirket bu bilançoya nasıl giriyor" sorusunu
     yanıtlıyor. İlk hâlinde son çeyreğin ham sayılarını basıyordum ve o
     tablonun tam bir alt kümesiydi — aynı sayfada aynı sayı iki kez.

     Yalnızca İKİSİ DE bilinen çeyrekler sayılıyor: gerçekleşen var ama
     beklenti yoksa o çeyrek "aşıldı mı" sorusuna cevap veremez, sayıma
     girmiyor. Eşik yok: gerçekleşen beklentinin üstündeyse aşılmış sayılıyor.
     Dört çeyrek yeterli — daha uzun geçmiş şirketin bugünkü hâlini anlatmıyor
     ve kart bir özet, bir seri değil. */
  /* KAYNAK SÜRPRİZ GEÇMİŞİ, TAKVİM DEĞİL. Takvim tablosu geçmiş tarafında
     sembol başına TEK satır tutuyor (ölçüldü: NVDA ve SNOW'da birer tane) —
     bir çeyrekten karne kurulamaz. `getEarningsSurprises` dört çeyreği
     birden veriyor ve sayfanın Geçmiş Bilançolar tablosu da zaten onu
     kullanıyor; `finnhubFetch` altı saatlik `revalidate` ile önbelleklediği
     için ikinci bileşenden çağırmak yeni bir tur açmıyor. */
  const surpriz = await getEarningsSurprises(symbol);
  const karneler = (surpriz.ok ? surpriz.data : [])
    .filter((row) => row.epsActual !== null && row.epsEstimate !== null)
    .sort((a, b) => b.period.localeCompare(a.period))
    .slice(0, 4)
    .map((row) => (row.epsActual! > row.epsEstimate! ? "asti" : "kaldi"));
  const asilan = karneler.filter((x) => x === "asti").length;

  const earningsHourLabel: Record<string, string> = {
    bmo: t.earnings.beforeOpen,
    amc: t.earnings.afterClose,
    dmh: t.earnings.duringMarket,
  };

  return (
    <Panel className={styles.upcomingPanel}>
      <div className={styles.eventKicker}><h2 className="plate text-nano">{t.stock.nextEarnings}</h2><CalendarBlank aria-hidden size={21} weight="duotone" /></div>
      <p className={cn("numeral", styles.earningsDate)}>
        {formatEtDateLong(next.reportDate, locale)}
      </p>
      <p className="mt-0.5 text-xs text-soft">
        {next.hour
          ? (earningsHourLabel[next.hour] ?? t.earnings.timeUnknown)
          : t.earnings.timeUnknown}
      </p>
      {(next.epsEstimate !== null || next.revenueEstimate !== null) && (
        /* İKİ ÖLÇÜ AYNI HATTA. Etiketler 84 piksellik hücrede iki
           satıra düşüyor (768'de ölçüldü) ve İkisi aynı anda düşmezse
           değerler birbirinden kayıyor: İngilizce tarafta "EPS ESTIMATE"
           tek satır, "REVENUE ESTIMATE" iki. Alt ızgara etiketi ve değeri
           iki hücrede de aynı satıra bağlıyor. */
        <dl className="mt-3 grid grid-cols-2 gap-3 border-t border-line-soft pt-3">
          {next.epsEstimate !== null && (
            <div className="row-span-2 grid grid-rows-subgrid gap-y-0.5">
              <dt className="text-nano text-muted">
                {t.earnings.epsEstimate}
              </dt>
              <dd className="numeral self-start text-sm font-semibold text-strong">
                {formatPrice(next.epsEstimate, locale, { currency: paraOpt })}
              </dd>
            </div>
          )}
          {next.revenueEstimate !== null && (
            <div className="row-span-2 grid grid-rows-subgrid gap-y-0.5">
              <dt className="text-nano text-muted">
                {t.earnings.revenueEstimate}
              </dt>
              <dd className="numeral self-start text-sm font-semibold text-strong">
                {formatMoneyCompact(
                  next.revenueEstimate,
                  locale,
                  typeof paraOpt === "string" ? paraOpt : null,
                )}
              </dd>
            </div>
          )}
        </dl>
      )}

      {/* TEK ÇEYREK KARNE DEĞİLDİR. "Son 1 çeyreğin tamamında beklenti
          aşıldı" hem Türkçe olarak tuhaf hem de istatistik olarak boş;
          en az iki çeyrek gerekiyor. */}
      {karneler.length > 1 && (
        <div className="mt-3 border-t border-line-soft pt-3">
          <p className="text-nano text-muted">
            {t.earnings.beatRecord}
          </p>
          {/* Dört işaret: her çeyrek bir kutu, dolu olan aşılmış. Renk TEK
              TAŞIYICI DEĞİL — dolu/boş ayrımı gri tonlamada da okunuyor ve
              altındaki cümle sayıyı zaten yazıyor. Sıra ESKİDEN YENİYE:
              soldan sağa okuma yönü zamanla aynı. */}
          <div aria-hidden className="mt-1.5 flex gap-1">
            {[...karneler].reverse().map((durum, i) => (
              <span
                key={i}
                className={cn(
                  "h-1.5 flex-1 rounded-full",
                  durum === "asti" ? "bg-up" : "bg-line-strong",
                )}
              />
            ))}
          </div>
          <p className="mt-1.5 text-tiny leading-relaxed text-body">
            {(asilan === karneler.length
              ? t.earnings.beatRecordAll
              : asilan === 0
                ? t.earnings.beatRecordNone
                : t.earnings.beatRecordLine
            )
              .replace("{total}", String(karneler.length))
              .replace("{beat}", String(asilan))}
          </p>
        </div>
      )}
    </Panel>
  );
}


/**
 * 52 hafta bandı — iki kartın (profil ve ortalamalar) ortak kuralı.
 *
 * BANT YALNIZCA PARA BİRİMİ AYNIYSA CETVELE GİRER. Metrik ucu bandı şirketin
 * ana borsasının parasında veriyor; TSM'de dolar fiyatıyla aynı eksene
 * konsaydı fiyat bandın çok dışına düşerdi. Orada uçlar kendi para
 * birimiyle yazılıyor, cetvel ve konum yok. `bandFiyatiKapsiyorMu` da şart:
 * BRK.B'de band A sınıfının (gerekçe MetricsCard'da).
 */
function week52Band(
  m: { low52: number | null; high52: number | null } | null,
  price: number | null,
  currency: string | null,
) {
  const homeCurrency = Boolean(currency && currency !== "USD");
  if (!m || m.low52 === null || m.high52 === null || !(m.high52 > m.low52)) return null;
  if (!homeCurrency && !bandFiyatiKapsiyorMu(price, m.low52, m.high52)) return null;
  const onRail = !homeCurrency;
  return {
    low: m.low52,
    high: m.high52,
    onRail,
    para: homeCurrency ? currency! : (true as const),
    position:
      onRail && price !== null
        ? Math.min(100, Math.max(0, ((price - m.low52) / (m.high52 - m.low52)) * 100))
        : null,
  };
}

/**
 * Hareketli ortalamalar — 50, 100 ve 200 günlük.
 *
 * NE SÖYLER: fiyatın kendi son elli/yüz/iki yüz günlük ortalamasına göre
 * nerede durduğu. Teknik analizin en yaygın üç penceresi; sitenin geri
 * kalanı gibi burada da bir tavsiye yok, yalnızca hesaplanmış bir ölçü.
 *
 * VERİ: `getChartBars(symbol, "1Y")` — 254 günlük bar (ölçüldü), 200'lük
 * pencere oradan doluyor. "5Y" KULLANILMIYOR: o aralık topluşturulmuş
 * (5 yıl için yalnızca 262 bar) ve barları günlük değil.
 *
 * FİYAT KOTASYONDAN, son bardan değil. Sayfa başlığı, grafik okuması ve bu
 * panel aynı sayıyı yazsın diye — aynı gerekçe grafik künyesinde de yazılı;
 * son barın kapanışı ile son işlem tanımı gereği farklı sayılar.
 *
 * PENCERE DOLMAZSA SATIR "—". Yeni halka arz olmuş bir şirkette 200 günlük
 * geçmiş yok ve yarım pencereden "200 günlük ortalama" üretmek uydurma
 * kesinlik olurdu (bkz. lib/utils.ts → `hareketliOrtalama`).
 */
async function MovingAverages({
  symbol,
  locale,
  t,
}: {
  symbol: string;
  locale: Locale;
  t: Dictionary;
}) {
  const status = await getStatus();
  const [barsResult, quoteResult, metricsResult, meta] = await Promise.all([
    getChartBars(symbol, "1Y", status),
    getQuote(symbol, status),
    /* 52 hafta bandı buradan — Anahtar Metrikler aynı ucu aynı parametreyle
       çağırıyor, `finnhubFetch` altı saat önbellekli: yeni tur yok. */
    getKeyMetrics(symbol),
    getSymbolNames([symbol]),
  ]);

  if (!barsResult.ok) return <DataError message={t.data.failed} />;

  const closes = barsResult.data.map((bar) => bar.close);
  const quote = quoteResult.ok ? quoteResult.data : null;
  const price = quote?.price ?? null;

  const pencereler = [50, 100, 200] as const;
  const satirlar = pencereler.map((pencere) => ({
    pencere,
    deger: hareketliOrtalama(closes, pencere),
  }));

  /* Hiçbiri hesaplanamadıysa panel boş bir liste basmıyor: sebebi tek
     satırda söyleniyor. */
  if (satirlar.every((s) => s.deger === null)) {
    return (
      <EmptyState
        compact
        title={t.stock.movingAveragesShort.replace(
          "{n}",
          String(closes.length),
        )}
      />
    );
  }

  /* TEK CETVEL (24 Eylül). Ortalamalar ±en büyük sapma üzerine SİMETRİK
     izlerde çiziliyordu — NVDA'nın üç ortalaması da artıdaydı ve her izin
     sol yarısı daima boştu. Artık ortalamalar ve canlı fiyat tek eksende
     (`PriceRail`); zeminde 52 haftalık bant gölge olarak duruyor ki
     ortalamaların yılın neresine düştüğü görünsün. Bandın uçları ETİKETSİZ:
     sayılar profil kartındaki 52 hafta satırında yazılı, burada tekrar
     edilmiyor. Bant yoksa (ADR, BRK.B) cetvel yalnızca ortalamaları taşır. */
  const m = metricsResult.ok ? metricsResult.data : null;
  const band = week52Band(m, price, meta[symbol]?.currency ?? null);

  const marks: RailMark[] = [];
  if (band?.onRail) {
    marks.push({ kind: "band", from: band.low, to: band.high, tone: "range" });
  }
  satirlar.forEach(({ pencere, deger }, index) => {
    if (deger === null) return;
    marks.push({
      kind: "tick",
      at: deger,
      tone: price !== null ? (price >= deger ? "up" : "down") : "flat",
      label: t.stock.movingAverageShort.replace("{n}", String(pencere)),
      /* Üst, alt, üst: yakın duran ortalamaların etiketleri ayrı satırlara
         düşüyor (NVDA'da 50G ile 100G arası 3,74 $). */
      side: index % 2 === 0 ? "above" : "below",
    });
  });
  if (price !== null) {
    marks.push({ kind: "point", at: price, variant: "live", value: formatPrice(price, locale), side: "below" });
  }

  return (
    /* ÜST DOLGU YOK. Başlığın kendi `py-4` alt dolgusu (16px) buradaki
       `py-3` (12) ve satırın `py-2` (8) ile üst üste biniyordu: başlık
       metniyle ilk ortalama arasında 36 piksel saf boşluk vardı ve kart
       üç satırlık içeriğe göre şişkin duruyordu. Başlık `pb-1.5`e indi,
       gövdenin üst dolgusu tümüyle kalktı; satırın kendi `py-2`si zaten
       nefes alacak kadar. Ölçüldü: kart 245 → 190 piksel. */
    <div className={styles.averagesBody}>
      <PriceRail marks={marks} className={styles.averagesRail} />
      {/* Çizim `aria-hidden`; her sayısı bu listede metin olarak da var. */}
      <dl className={styles.averageRows}>
        <div className={styles.averageRow}>
          <dt>{t.stock.currentQuote}</dt>
          <dd className="numeral text-sm font-semibold text-strong">
            {formatPrice(price, locale, { currency: true })}
          </dd>
        </div>
        {satirlar.map(({ pencere, deger }) => {
          /* Fark yalnızca İKİSİ de varken yazılıyor; ortalama yoksa fiyatla
             kıyaslanacak bir şey de yok. */
          const fark =
            deger !== null && price !== null && deger > 0
              ? ((price - deger) / deger) * 100
              : null;
          return (
            <div key={pencere} className={styles.averageRow}>
              <dt>{t.stock.movingAverageRow.replace("{n}", String(pencere))}</dt>
              <dd className="flex items-baseline gap-2.5">
                <span className="numeral text-sm text-body">
                  {deger !== null
                    ? formatPrice(deger, locale, { currency: true })
                    : NO_VALUE}
                </span>
                {fark !== null && (
                  <span
                    className={cn(
                      "numeral w-14 shrink-0 text-right text-tiny font-semibold",
                      directionText(directionOf(fark)),
                    )}
                  >
                    {formatPercent(fark, locale)}
                  </span>
                )}
              </dd>
            </div>
          );
        })}
      </dl>
      <p className={styles.cardNote}>
        {t.stock.movingAveragesNote}
      </p>
    </div>
  );
}

/**
 * Fon künyesi — ETF'ler için profil kartının karşılığı.
 *
 * Sağlayıcı fonlar hakkında hiçbir şey döndürmediğinden içeriğin tamamı
 * yerel kayıttan gelir: ne izlediği, kim çıkardığı ve fiyatının yerel
 * endeksten nasıl ayrıştığı. Bu ayrım kartın altında açıkça yazılır.
 */
async function FundCard({
  symbol,
  locale,
  t,
}: {
  symbol: string;
  locale: Locale;
  t: Dictionary;
}) {
  const fund = fundMetaOf(symbol);
  if (!fund) return null;

  const about = await describeSymbol(symbol, locale);
  const rows: [string, React.ReactNode][] = [
    [t.stock.fundKind, t.stock.fundKindLabel],
    [t.stock.fundTracks, locale === "tr" ? fund.tracksTr : fund.tracksEn],
    [t.stock.fundIssuer, fund.issuer],
  ];

  return (
    <Panel>
      {/* FON SAYFALARINDAN KARŞILAŞTIRMAYA SIFIR YOL VARDI. Hisse sayfası
          benzer şirketler panelinden karşılaştırmaya bağlanıyor ama ETF dalı
          o panelden önce dönüyor — oysa hazır setlerden biri tam olarak bu
          dört endeks fonu. */}
      <PanelHeader
        title={t.stock.fundProfile}
        action={
          <PanelLink href={`/karsilastir?semboller=${INDEX_STRIP.join(",")}`}>
            {t.compare.addCta}
          </PanelLink>
        }
      />
      <div className="px-4 py-3 sm:px-5">
        {about && (
          <p className="border-b border-line-soft pb-3 text-base leading-relaxed text-body">
            {about}
          </p>
        )}
        <dl className="divide-y divide-line-soft">
          {rows.map(([label, value]) => (
            <div
              key={label}
              className="flex items-start justify-between gap-3 py-2"
            >
              <dt className="shrink-0 text-xs text-muted">{label}</dt>
              <dd className="text-right text-sm text-body">{value}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 border-t border-line-soft pt-2.5 text-tiny leading-relaxed text-muted">
          {fund.kind === "country"
            ? t.stock.fundNoteCountry
            : t.stock.fundNoteIndex}
        </p>
      </div>
    </Panel>
  );
}

async function ProfileCard({
  symbol,
  locale,
  t,
}: {
  symbol: string;
  locale: Locale;
  t: Dictionary;
}) {
  /* Piyasa değeri CANLI hesaplanıyor: `profile.marketCap` profilin çekildiği
     anın fotoğrafı ve o profil ~29 günde bir tazeleniyor, yani künyedeki sayı
     `/piyasalar` ve bilanço analizindekinden farklı olabiliyordu — aynı
     şirket, iki ekran, iki değer. Kural tek yerde: lib/data.ts →
     liveMarketCap. Fiyat alınamazsa kayıtlı değere düşülür. */
  const status = await getStatus();
  const [result, meta, quoteForCap, nextReport, metricsForBand, directory] = await Promise.all([
    getCompanyProfile(symbol),
    getSymbolNames([symbol]),
    getQuote(symbol, status),
    /* Yerel takvim okuması; sağlayıcıya gitmiyor (lib/data.ts). */
    getNextReport(symbol),
    /* 52 hafta bandı — Anahtar Metrikler ile aynı çağrı, `finnhubFetch`
       altı saat önbellekli: yeni tur yok. */
    getKeyMetrics(symbol),
    /* Dizindeki sıra için — sembol tablosu beş dakika önbellekte
       (lib/data.ts → loadSymbolTable), yeni bir tur yok. */
    getCompanies(),
  ]);
  if (!result.ok) {
    return (
      <>
        <PanelHeader title={t.stock.profile} />
        <DataError message={t.data.failed} hint={t.data.failedHint} />
      </>
    );
  }
  const profile = result.data;
  /* YEDEK YALNIZCA DOLAR CİNSİNDEYSE. Buradaki `?? profile.marketCap`
     sağlayıcının ham alanına düşüyordu ve o alan şirketin ANA BORSASININ
     para biriminde geliyor — Finnhub'ın kendi belgesi de öyle diyor, bizim
     yorum "milyon dolar" yazıyordu ve yanlıştı. USD dışı bir ADR'de sayı
     dolar işaretiyle basılıyordu: /hisse/SKHY künyesinde "Piyasa Değeri
     1.233 T $", /hisse/TSM'de "61,6 T $" (Apple 4,55 T $ iken).
     `SymbolMeta` bu ayrımı zaten yapıyor (USD dışında null); yedeğin de
     aynı kuralı tanıması gerekiyordu. Bilinmiyorsa tire basılır — uydurma
     bir dolar değerinden iyidir. */
  const band = week52Band(
    metricsForBand.ok ? metricsForBand.data : null,
    quoteForCap.ok ? quoteForCap.data.price : null,
    meta[symbol]?.currency ?? null,
  );
  const liveCapValue = liveMarketCap(meta[symbol], quoteForCap.ok ? quoteForCap.data.price : null);
  const liveCap = liveCapValue !== null;
  const marketCap = liveCapValue ?? (profile.currency === "USD" ? profile.marketCap : null);
  const member = indexMemberOf(symbol);
  /* DİZİNDEKİ SIRA (24 Eylül). Piyasa değeri kartta tek başına bir sayıydı
     ve sağ yarısı boştu: "4,97 T $" büyük mü, küçük mü, okuyucu kendi
     bilgisiyle tamamlamak zorundaydı. Sıra ve en büyük şirkete oranı o
     sayıyı ölçeğe oturtuyor. Bu şirketin değeri CANLI (yukarıda), ötekiler
     sembol tablosunun önbellek fiyatından — en fazla birkaç dakika geride;
     sıra o farktan ancak sınırdaki iki şirket arasında oynayabilir. Şirket
     dizinde yoksa (ikinci sınıf pay, dolar dışı ADR) blok basılmıyor. */
  const listed = primaryOnly(directory).filter(
    (row) => row.marketCap !== null && row.marketCap > 0,
  );
  const rankInfo = (() => {
    if (marketCap === null || !listed.some((row) => row.symbol === symbol)) return null;
    const others = listed.filter((row) => row.symbol !== symbol);
    const rank = 1 + others.filter((row) => (row.marketCap as number) > marketCap).length;
    const leader = others.reduce<(typeof others)[number] | null>(
      (best, row) => (best === null || (row.marketCap as number) > (best.marketCap as number) ? row : best),
      null,
    );
    const leaderCap = leader ? Math.max(leader.marketCap as number, marketCap) : marketCap;
    return { rank, total: listed.length, leader: rank === 1 ? null : leader, share: marketCap / leaderCap };
  })();
  const about = await describeSymbol(symbol, locale);
  const websiteHref = safeExternalUrl(profile.weburl);
  const hourLabels: Record<string, string> = {
    bmo: t.earnings.beforeOpen,
    amc: t.earnings.afterClose,
    dmh: t.earnings.duringMarket,
  };

  /* Ülke adı — kod tanınmazsa `of()` girdiyi aynen geri veriyor, o durumda
     "US" gibi ham bir kod basmak yerine satırı hiç açmıyoruz. */
  const ulkeAdi = (() => {
    const kod = profile.country?.trim();
    if (!kod || kod.length !== 2) return null;
    try {
      const ad = new Intl.DisplayNames([locale === "tr" ? "tr" : "en"], {
        type: "region",
      }).of(kod.toUpperCase());
      return ad && ad !== kod.toUpperCase() ? ad : null;
    } catch {
      return null;
    }
  })();

  const rows: [string, React.ReactNode][] = [
    /* SEKTÖR SATIRI YOK — kimlik künyesinde, bu kartın hemen SOLUNDA duruyor.
       İkisi AYNI tercih zincirinden besleniyor (GICS varsa o, yoksa
       sağlayıcının serbest metinli alanı; StockHeader'daki `kunyeSektor`
       yorumu da bunu yazıyor), yani üretilen dize garantili aynı. Kimlik
       grafiğin içine girmeden önce başlık sayfanın en üstünde ayrı bir
       satırdı ve tekrar göze batmıyordu; şimdi iki panel yan yana ve aynı
       cümle iki kez okunuyor. Değeri boşsa ikisi de boş — "Sektör: —"
       basmanın da bir faydası olmuyordu.
       ALT SEKTÖR KALIYOR: daha dar bir sınıflandırma ve künyede yok. */
    ...(member?.sub
      ? ([[t.stock.industry, subIndustryName(member.sub, locale)]] as [
          string,
          React.ReactNode,
        ][])
      : []),
    /* ÜLKE — sağlayıcı ISO-2 kodu veriyor ("US", "TW", "NL") ve çeviri
       `Intl.DisplayNames` ile yapılıyor: yeni bir ülke sözlüğü kurmaya gerek
       yok, kural tarayıcının ve Node'un kendisinde. Satır ADR'lerde asıl
       işini görüyor — TSM "Tayvan", ASML "Hollanda" — ve o sembollerde
       zaten para birimi notu duran kartın hemen yanında duruyor.
       Kod tanınmazsa `of()` girdiyi aynen döndürüyor; o zaman ham kod
       basmak yerine satır hiç yazılmıyor. */
    ...(ulkeAdi ? ([[t.stock.country, ulkeAdi]] as [string, React.ReactNode][]) : []),
    [t.stock.exchange, exchangeLabel(profile.exchange, locale) ?? NO_VALUE],
    /* DEĞER YOKSA SATIR DA YOK. Koruma bilinçli (dolar dışı para biriminde
       null döner, gerekçe yukarıda) ama sonucu hep "—" olan bir satır yer
       kaplayıp hiçbir şey söylemiyordu — üstelik tam da ADR'lerde, kartın
       en havadar olduğu yerde. Boş satır sildikçe kalanlar gerçek bilgi
       taşıyor; aynı desen `ulkeAdi` ve alt sektörde de var. */
    /* Piyasa değeri artık listenin üstündeki büyük okumada; aynı kaynağı
       iki defa basmamak için bu satır oraya taşındı. */
    [
      t.stock.ipoDate,
      profile.ipoDate ? (
        <span className="numeral">
          {formatEtDateMedium(profile.ipoDate, locale)}
        </span>
      ) : (
        NO_VALUE
      ),
    ],
    /* SIRADAKİ BİLANÇO BİR SATIR, BİR KART DEĞİL. Yaklaşan bilanço kartı
       ilk ekrandan Bilançolar bölümüne taşınmıştı (ilk ekranın boyunu
       uzatıyordu); ama tarihin kendisi şirket künyesinin bir satırı ve
       profil kartının altında boşluk bırakan yere tam oturuyor. Satır
       bölüme bağlanıyor — ayrıntı orada. Tarih yoksa satır da yok. */
    ...(nextReport
      ? ([
          [
            t.stock.nextReportRow,
            <a key="next" href="#stock-earnings" className="tap-44 numeral text-primary hover:underline">
              {formatEtDateMedium(nextReport.date, locale)}
              {nextReport.hour && hourLabels[nextReport.hour]
                ? ` · ${hourLabels[nextReport.hour]}`
                : ""}
            </a>,
          ],
        ] as [string, React.ReactNode][])
      : []),
  ];
  /* SATIRIN İKONU (26 Eylül). Profil etiket-değer satırlarından ibaretti ve
     "düz sayfa" gibi okunuyordu. Her satırın başında ne anlattığını
     gösteren küçük bir karo var; göz etiketi okumadan satırı buluyor.
     Eşleme etikete göre: satırlar koşullu eklendiği için sıra değil ad
     tanımlayıcı. Eşlenmeyen satır ikonsuz kalır, kaymaz. */
  const rowIcon = new Map<string, typeof Stack>([
    [t.stock.industry, Stack],
    [t.stock.country, GlobeHemisphereWest],
    [t.stock.exchange, Bank],
    [t.stock.ipoDate, Flag],
    [t.stock.nextReportRow, CalendarCheck],
    [t.stock.website, LinkSimple],
  ]);
  const rowLabel = (label: string) => {
    const Icon = rowIcon.get(label);
    return (
      <dt className="flex items-center gap-2.5 text-xs font-semibold text-strong">
        {Icon && (
          <span aria-hidden className={styles.profileIcon}>
            <Icon size={14} weight="duotone" />
          </span>
        )}
        {label}
      </dt>
    );
  };

  /* KÜNYE BAŞLIĞIN SAĞINDA. "Finnhub · 22 Eylül 21:52 Güncellendi" kartın
     dibinde tek başına bir satır tutuyordu; başlık satırının sağı ise
     boştu. Aynı damga orada, satır harcamadan. */
  return (
    <>
    <PanelHeader
      title={t.stock.profile}
      action={
        <DataStamp
          labels={t.data}
          source={result.source}
          at={result.fetchedAt}
          stale={result.stale}
          locale={locale}
          className={styles.headerStamp}
        />
      }
    />
    <div className={styles.profileBody}>
      {/* TEK BÜYÜK OKUMA: PİYASA DEĞERİ (24 Eylül). Kartın tepesinde "Son
          Fiyat", yüzdesi ve kotasyon damgası duruyordu — solundaki başlığın
          birebir kopyası, aynı panelin 400 piksel yanında. Kopyası gitti;
          kalan tek sayı başlığın söylemediği şey. Künye onun neyle
          hesaplandığını söylüyor (lib/data.ts → liveMarketCap). Arka
          plandaki sembol filigranı ve yörünge halkaları da gitti: derinlik
          tonla kuruluyor, süsle değil (tema § 1). */}
      {marketCap !== null && (
        <div className={styles.profileVisual} data-has-rank={rankInfo !== null}>
          <dl className={styles.profileMetric}>
            <dt>{t.market.marketCap}</dt>
            <dd className={cn("numeral", styles.profileCapValue)}>
              {formatMoneyCompact(marketCap, locale)}
            </dd>
            {liveCap && <dd className={styles.profileCapNote}>{t.stock.capLiveNote}</dd>}
          </dl>
          {rankInfo && (
            <dl className={styles.profileRank}>
              <dt>{t.stock.capRank}</dt>
              <dd className={cn("numeral", styles.profileRankValue)}>
                {rankInfo.rank.toLocaleString(locale)}.
                <span>{t.stock.capRankOf.replace("{n}", rankInfo.total.toLocaleString(locale))}</span>
              </dd>
              {/* Ölçek: en büyük şirkete oran — bir büyüklük, yargı değil
                  (CLAUDE.md "Karşılaştırılan her büyüklük bir de ÇİZGİ"). */}
              <dd aria-hidden className={styles.profileRankTrack}>
                <i style={{ width: `${Math.max(2, Math.min(100, rankInfo.share * 100)).toFixed(1)}%` }} />
              </dd>
              <dd className={styles.profileCapNote}>
                {rankInfo.leader
                  ? t.stock.capLeader
                      .replace("{symbol}", rankInfo.leader.symbol)
                      .replace("{value}", formatMoneyCompact(rankInfo.leader.marketCap, locale))
                  : t.stock.capLeaderSelf}
              </dd>
            </dl>
          )}
        </div>
      )}
      {/* Şirket ne iş yapar — sektör satırından önce düz cümleyle anlatılır */}
      {about && (
        <p className={styles.about}>
          {about}
        </p>
      )}
      {/* Satırlar artan yere yayılır: kart grafiğin boyuna gerildiğinde
          altta ölü boşluk yerine nefes alan bir liste kalıyor. İçerik
          kartı zaten dolduruyorsa `justify-between`in etkisi olmuyor. */}
      {/* `justify-between` KALKTI — artan yer ARALIKLARA gidiyordu.
          CLAUDE.md "Düzen" bölümü bunu açıkça yasaklıyor: aralık kendi
          ölçüsü olmaktan çıkıp komşu kolonun boyuna bağlanıyor. Burada tam
          o oluyordu: kart grafik panelinin boyuna geriliyor ve 37 piksellik
          satırların ARASI 54 piksele açılıyordu. Kimlik grafiğin içine
          girince panel doksan piksel uzadı ve kusur gözle görülür hâle
          geldi — sebebi birleştirme değil, birleştirmenin ortaya çıkardığı
          bu satırdı.
          Artan yer artık satırların İÇİNE gidiyor (`flex-1`), ayıraçlar eşit
          aralıkta kalıyor; emsali aynı sayfadaki Anahtar Metrikler kartı. */}
      <dl className="flex flex-1 flex-col divide-y divide-line-soft">
        {rows.map(([label, value]) => (
          <div key={label} className="flex flex-1 items-center justify-between gap-3 py-2">
            {rowLabel(label)}
            <dd className="text-right text-sm text-body">{value}</dd>
          </div>
        ))}
        {/* Adres sağlayıcıdan geliyor; şeması süzülmeden href'e konmaz. */}
        {websiteHref && (
          <div className="flex flex-1 items-center justify-between gap-3 py-2">
            {rowLabel(t.stock.website)}
            <dd className="min-w-0 text-right text-sm">
              <a
                href={websiteHref}
                target="_blank"
                rel="noopener noreferrer"
                className="tap-44 -my-2 block min-h-8 truncate py-2 text-primary hover:underline"
              >
                {/* Sondaki eğik çizgi de gidiyor: "nvidia.com/" bir adres
                    değil, bir yolun başı gibi okunuyordu. */}
                {websiteHref.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}
              </a>
            </dd>
          </div>
        )}
      </dl>
      {/* 52 HAFTA BANDI PROFİLİN SONUNDA (24 Eylül). Anahtar Metrikler'de
          ayrı bir bloktu; profil kartı ise grafiğin yanında içeriğinden
          erken bitiyordu (1440'ta AAPL 141, ASTS 251, TSM 295 piksel
          kuyruk). Band şirketin künyesi kadar kalıcı bir okuma: fiyatın
          yılın neresinde durduğu. Uçlar metin olarak yazılı; ray yalnızca
          çizim (`aria-hidden`). ADR'de uçlar ana borsanın parasında ve ray
          yok (`week52Band`). */}
      {band && (
        <div className={styles.profileBand}>
          <div className="flex items-baseline justify-between gap-3">
            <span className={styles.profileBandLabel}>
              {t.stock.week52Range}
              {band.position !== null && (
                <span className="numeral ml-2 font-normal text-muted">
                  {t.stock.week52Position.replace("{value}", formatPercentPlain(band.position, locale, 0))}
                </span>
              )}
            </span>
            <span className="numeral text-xs text-strong">
              {formatPrice(band.low, locale, { currency: band.para })}
              {" – "}
              {formatPrice(band.high, locale, { currency: band.para })}
            </span>
          </div>
          {band.onRail && quoteForCap.ok && (
            <PriceRail
              marks={[
                { kind: "band", from: band.low, to: band.high, tone: "range" },
                { kind: "point", at: quoteForCap.data.price, variant: "live" },
              ]}
              pad={0}
              className="mt-2"
            />
          )}
        </div>
      )}
    </div>
    </>
  );
}

async function MetricsCard({
  symbol,
  locale,
  t,
}: {
  symbol: string;
  locale: Locale;
  t: Dictionary;
}) {
  const status = await getStatus();
  const [metricsResult, quoteResult, profileResult] = await Promise.all([
    getKeyMetrics(symbol),
    getQuote(symbol, status),
    /* PARA BİRİMİ ŞART. Finnhub'ın metrik ucu EPS ve 52 hafta bandını
       şirketin ANA BORSASININ para biriminde veriyor, bu tablo ise hepsini
       dolar sanıp `$` basıyordu. TSM'de başlıktaki ADR fiyatı 419,55 $
       dururken tabloda "52 Hafta En Yüksek 2.535,00 $" yazıyordu; sayı
       doğru, para birimi yanlıştı (TWD) ve okuyucu fiyatı bandın çok
       altında sanıyordu. Depoda 21 sembol USD dışı (TSM, ASML, PDD,
       NTES, SKHY…). */
    getCompanyProfile(symbol),
  ]);

  if (!metricsResult.ok) {
    return <DataError message={t.data.failed} />;
  }
  const m = metricsResult.data;
  const quote = quoteResult.ok ? quoteResult.data : null;
  const currency = profileResult.ok ? profileResult.data.currency : null;
  const homeCurrency = Boolean(currency && currency !== "USD");

  /* ÖLÇÜLER BU HİSSEYE AİT Mİ. Sağlayıcı BRK.B için A SINIFININ rakamlarını
     döndürüyor: 506 dolarlık hissenin sayfasında "F/K 0,01", "Hisse Başına
     Kâr 59.668,81 $" ve "52 Hafta Bandı 698.000 – 806.102 $" yazıyordu.
     Gerekçe ve ölçüm lib/utils.ts → `bandFiyatiKapsiyorMu`.

     Test yalnızca PARA BİRİMİ AYNIYKEN çalışıyor: ADR'de band ana borsanın
     parasında ve fiyatla zaten tutmuyor — orada ayrı ve yazılı bir çözüm var
     (`homeCurrency` dalı, aşağıdaki not). */
  const olculerTutarli =
    homeCurrency ||
    bandFiyatiKapsiyorMu(quote?.price, m.low52, m.high52);

  /* Hisse başına ölçüler tutarsızsa GÖSTERİLMİYOR. Oranlar (beta, temettü
     verimi, ileri F/K) sınıflar arasında ortak olduğu için kalıyor; mutlak
     tutarlar (EPS, band) ve onlardan türeyen F/K düşüyor. */
  const hisseBasi = <T,>(value: T): T | null =>
    olculerTutarli ? value : null;

  const rows: [string, string][] = [
    /* F/K sağlayıcının hazır alanından değil, sayfanın gösterdiği fiyattan
       kuruluyor — o alan geriden gelen bir fiyatla hesaplanmış oluyor ve
       tablonun hemen üstündeki kotasyonla çelişiyordu. Bkz. `peRatioOf`.
       AMA yalnızca ikisi aynı para birimindeyse: ADR'de fiyat dolar, EPS
       ana borsanın parası ve bölüm anlamsız bir sayı veriyordu (TSM'de
       4,80 gibi). Orada sağlayıcının kendi oranı kullanılıyor — o oran ana
       borsanın içinde kurulduğu için birimsiz ve tutarlı. */
    [
      t.stock.peRatio,
      formatPrice(
        hisseBasi(homeCurrency ? m.peRatio : peRatioOf(quote?.price, m.eps)),
        locale,
      ),
    ],
    /* İLERİ F/K sağlayıcının kendi oranı — TTM F/K'nin aksine yeniden
       KURULMUYOR, çünkü ileri EPS elimizde yok (gerekçe
       `KeyMetrics.forwardPe` künyesinde). Oran para biriminden bağımsız:
       pay da payda da ana borsanın parasında ve bölümde sadeleşiyor. Bu
       yüzden ADR'de de, sınıf karışıklığında da doğru okunuyor — mutlak
       tutar değil. ETF'de gelmiyor, o zaman satır hiç yazılmıyor. */
    ...(m.forwardPe
      ? ([[t.stock.forwardPe, formatPrice(m.forwardPe, locale)]] as [
          string,
          string,
        ][])
      : []),
    [
      t.stock.eps,
      hisseBasi(m.eps)
        ? formatPrice(m.eps, locale, { currency: currency ?? true })
        : NO_VALUE,
    ],
    [
      t.stock.dividend,
      /* İşaret elle SONA konuyordu ve Türkçede başa gelmesi gerekiyor;
         kural tek yerde: lib/utils.ts → withPercent. */
      /* `!== null` ile ayrılıyor: `m.dividendYield ?` sıfır temettüyü de
         "—" yapıyordu, oysa "temettü ödemiyor" ile "bilinmiyor" aynı şey
         değil. */
      m.dividendYield !== null && m.dividendYield !== undefined
        ? formatPercentPlain(m.dividendYield, locale, 2)
        : NO_VALUE,
    ],
    [t.stock.beta, m.beta ? formatPrice(m.beta, locale) : NO_VALUE],
    /* NET KÂR MARJI — kartın tek KÂRLILIK ölçüsü. Sekiz satırın hepsi
       değerleme (F/K, ileri F/K), dağıtım (temettü), oynaklık (beta) ya da
       fiyatın kendi geçmişindeki yeri (52 hafta bandı, hacim) hakkındaydı;
       "bu şirket kazanıyor mu" sorusunu hiçbiri yanıtlamıyordu. Gelirin
       yüzde kaçının net kâra döndüğü tek satırda onu söylüyor.

       PARA BİRİMİ SORUNU YOK, çünkü ORAN: pay da payda da ana borsanın
       parasında ve bölümde sadeleşiyor. Bu yüzden `hisseBasi()` ile
       sarılmıyor — o sarmalayıcı MUTLAK tutarlar için ve BRK.B'de yanlış
       sınıfın rakamını düşürmek üzere var. Marj şirket düzeyinde bir ölçü;
       iki hisse sınıfı için de aynı sayı, ADR'de de doğru okunuyor
       (ölçüldü: TSM %50,70, ASML %29,49 — ikisi de kendi gerçek marjı).

       Alan zaten çekiliyordu ve iki ekranda daha basılıyor (bilanço detayı
       ve karşılaştırma); yeni bir sağlayıcı turu ya da yeni sözlük anahtarı
       getirmiyor. Kapsam ölçüldü: 24 sembolün 22'sinde geliyor, gelmeyen
       ikisi ETF (SPY, QQQ) ve onlar zaten fon dalına gidip bu kartı hiç
       görmüyor. `!== null` ile ayrılıyor — zarardaki şirketin marjı negatif
       bir sayı, "bilinmiyor" değil (DKNG %-2,68, SOFI %-19,79). */
    ...(m.netMarginPct !== null && m.netMarginPct !== undefined
      ? ([
          [t.stock.netMargin, formatPercentPlain(m.netMarginPct, locale, 1)],
        ] as [string, string][])
      : []),
    /* BORÇ / ÖZSERMAYE — kartın tek KALDIRAÇ ölçüsü, marjın kâr tarafına
       karşılık bilanço tarafı. Marjla aynı gerekçelerle güvenli: oran
       olduğu için para birimi sadeleşiyor, şirket düzeyinde olduğu için
       hisse sınıfından bağımsız. Kapsam ölçüldü: 20 sembolün 20'sinde
       geliyor ve hepsi çeyreklik alandan (`totalDebt/totalEquityQuarterly`).

       ORAN, YÜZDE DEĞİL — beta gibi biçimlendiriliyor. Ölçülen değerler
       0,04 (NVDA, neredeyse borçsuz) ile 7,52 (BA) arasında; yüzde sanılıp
       "%0,04" basılsaydı borçsuz bir bilanço "sıfıra yakın borç" değil
       "ölçülemeyecek kadar küçük" gibi okunurdu.

       `> 0` DEĞİL `!== null`: sıfır borç gerçek bir bilanço durumu ve
       "bilinmiyor"dan farklı — temettü satırındaki aynı ayrım. */
    ...(m.debtToEquity !== null && m.debtToEquity !== undefined
      ? ([
          [t.stock.debtToEquity, formatPrice(m.debtToEquity, locale)],
        ] as [string, string][])
      : []),
    [t.market.volume, quote?.volume ? formatVolume(quote.volume, locale) : NO_VALUE],
  ];

  /* 52 HAFTA BANDI BU KARTTA DEĞİL (24 Eylül). "İki satırdan bir bloğa"
     dönmüştü (fiyatın bandın neresinde durduğu tek bakışta); o blok şimdi
     Hareketli Ortalamalar'ın fiyat cetvelinde, ortalamalarla AYNI eksende
     — iki kart aynı soruyu iki ayrı ölçekle yanıtlıyordu. Gerekçe
     MovingAverages'ta. */

  /* FİYAT / SATIŞ DEĞERLENDİRİLDİ, EKLENMEDİ — gerekçe yazılıyor çünkü
     aday güçlü ve yeniden önerilmesi çok olası.

     Lehine olan taraf gerçek: `psTTM` bir ORAN, yani para birimi bölümde
     sadeleşiyor (TSM'de baştan sona TWD içinde kuruluyor) ve hisse
     sınıfından bağımsız (BRK.A ile BRK.B birebir aynı 2,5391 dönüyor, çünkü
     pay ve payda birlikte 1500'e bölünüyor). Kapsam 67/68. Üstelik kartın
     değerleme tarafının TÜMÜYLE çöktüğü yeri dolduruyor: CRWV, RKLB, ASTS
     ve NBIS'te ne F/K ne İleri F/K geliyor, F/S dördünde de dolu.

     ENGEL FİYAT TABANI. `psTTM` sağlayıcının KENDİ fiyatından kurulu ve o
     fiyat geriden geliyor: ölçüldü, AAPL'de oran 301,07 dolarlık bir fiyat
     ima ediyor, canlı kotasyon 324,96 — %7,4 sapma. Depo sağlayıcının hazır
     `peTTM`ini tam bu yüzden zaten reddetmiş ve oradaki ölçüm %5,6'ydı
     (lib/utils.ts → `peRatioOf`), yani bu daha büyük. Aynı kartta F/K CANLI
     fiyattan kuruluyor; F/S eklenseydi iki değerleme oranı iki farklı fiyat
     tabanında yan yana dururdu.

     İleri F/K'nin neden kabul edildiği sorulursa: orada yeniden kurmanın
     yolu KAPALI, ileri EPS elimizde yok (types.ts → `forwardPe`). F/S'de
     ise yol açık görünüyor ama açılırsa yanlış — `price / revenuePerShare`
     ADR'de dolar/TWD karışımı verir, BRK.B'de 0,002 basar. Yani ne olduğu
     gibi alınabiliyor ne yeniden kurulabiliyor. */

  return (
    /* LİSTE KUTUYU DOLDURUYOR. Izgara satırının boyunu orta sütun kuruyor
       ve bu kartın içeriği 156 piksel erken bitiyordu: son satırın altında
       kartın üçte biri kadar boş yer kalıyor, kart yarım kalmış gibi
       duruyordu. Satırlar artan yeri PAYLAŞIYOR (`flex-1`) — sekiz satıra
       yirmişer piksel, yani liste seyreliyor ama hiçbir yerde delik yok.
       Dar ekranda ızgara tek sütuna düşüyor, gerilme olmuyor ve satırlar
       kendi doğal boylarında kalıyor. */
    <div className={styles.metricsBody}>
      <dl data-motion-stagger className={styles.metricsList}>
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd className="numeral">{value}</dd>
          </div>
        ))}
      </dl>
      {/* Para birimi başlıktaki dolar fiyatından farklıysa sebebi yazılır —
          yoksa okuyucu iki sayıyı yan yana koyup birini yanlış sanıyor. */}
      {homeCurrency && (
        <p className="mt-2 border-t border-line-soft pt-2.5 text-small text-muted">
          {t.stock.homeCurrencyNote.replace("{code}", currency!)}
        </p>
      )}
      {/* Sessizce "—" basmak da yanlış olurdu: okuyucu veriyi bizim
          alamadığımızı sanır, oysa sağlayıcı BAŞKA bir menkul kıymetin
          rakamlarını gönderiyor ve biz onları bilerek yazmıyoruz. */}
      {!olculerTutarli && (
        <p className="mt-2 border-t border-line-soft pt-2.5 text-small text-muted">
          {t.stock.metricsMismatch}
        </p>
      )}
    </div>
  );
}

async function AnalystCard({
  symbol,
  locale,
  t,
}: {
  symbol: string;
  locale: Locale;
  t: Dictionary;
}) {
  const bos = (
    <Panel className={styles.analystPanel}>
      <PanelHeader title={t.stock.analysts} />
      <DataError message={t.common.noData} />
    </Panel>
  );

  const result = await getRecommendations(symbol);
  if (!result.ok) return bos;

  const latest = result.data[0];
  const total =
    latest.strongBuy + latest.buy + latest.hold + latest.sell + latest.strongSell;
  if (total === 0) return bos;

  const kotasyon = latest.symbol?.toUpperCase();
  const alimTarafi = latest.strongBuy + latest.buy;

  const segments = [
    { label: t.stock.strongBuy, value: latest.strongBuy, cls: "bg-up", color: "var(--up)" },
    { label: t.stock.buy, value: latest.buy, cls: "bg-up/60", color: "color-mix(in srgb, var(--up) 60%, var(--surface-solid))" },
    { label: t.stock.hold, value: latest.hold, cls: "bg-flat", color: "var(--flat)" },
    { label: t.stock.sell, value: latest.sell, cls: "bg-down/60", color: "color-mix(in srgb, var(--down) 60%, var(--surface-solid))" },
    { label: t.stock.strongSell, value: latest.strongSell, cls: "bg-down", color: "var(--down)" },
  ];

  /* KART KOMŞUSUNUN RİTMİNE OTURUYOR.
     Beş etiket iki sütuna diziliyordu ve üç satır tutuyordu; kart, üçlü
     ızgarada yanındaki Anahtar Metrikler (yedi satır) ve Katılım Taraması
     kadar uzuyor ama içeriği o boyun yarısını bile doldurmuyordu — panelin
     alt yarısı boştu. Aynı veri tek sütunda, komşu kartla AYNI satır
     düzeninde (`divide-y divide-line-soft`, `py-2.5`) beş satır tutuyor ve
     boşluk kendiliğinden kapanıyor. Yeni bilgi eklenmedi; eklenen tek şey
     payın yüzdesi, o da çubuğun zaten çizdiği oranın sayısı.

     BURAYA YENİ VERİ EKLENMEZ. Finnhub `/stock/recommendation` dört aylık
     anlık görüntü döndürüyor ve kart yalnızca ilkini çiziyor; kalan üçüyle
     bir trend merdiveni çizmek ilk bakışta boşluğun doğal cevabı gibi
     duruyor. Ölçüldü, değil: üç kart `repeat(auto-fit,minmax(17rem,1fr))`
     ızgarasında AYNI satırda ve satırın boyu EN UZUN karta göre kuruluyor.
     Merdiven (~90px) satırı uzatır ve boşluk komşu kartların altında
     yeniden açılır; bir kartın sorunu üç karta dağıtılmış olur. Aynı
     gerekçe kaynak damgası ve "alım tarafı payı" manşeti için de geçerli.

     AÇIKLAMA METNİ BU YASAĞIN DIŞINDA ve ayrımın ölçüsü net: yeni veri
     satırı UZATIR, açıklama satırı UZATMAZ. Satırın boyunu orta sütun
     kuruyor (ölçüldü: 529 piksel) ve bu kartın içeriği 332'de bitiyordu —
     yani 197 piksel zaten ödenmiş ve boş duruyordu. Paragraf o ödenmiş yere
     iniyor. Sınır da buradan çıkıyor: metin bu boşluktan uzun olmaya
     başlarsa artık dolgu değil, satırı uzatan bir yük olur.

     NEDEN AÇIKLAMA. Dağılım kartın en çok yanlış okunan yeri: "%91 Al
     Yönünde" bir fiyat hedefi, bir zamanlama ya da öncü bir sinyal
     sanılabiliyor. Üçü de değil ve üçünü de söyleyen tek bir paragraf,
     boşluğu doldurmak için uydurulmuş bir metin değil. */
  return (
    /* KART KUTUSUNU DOLDURUYOR. Izgara satırı üç kolonu aynı yüksekliğe
       geriyor ve boyu orta sütun kuruyor (ölçüldü: 529 piksel). Bu kartın
       içeriği 332'de bitiyordu, yani künyenin ALTINDA 197 piksel boş kalıyor
       ve kart yarım kalmış gibi duruyordu. Künye artık kartın dibinde;
       artan yer künye ile satırlar ARASINA gidiyor, künyenin altına değil.
       Tek sütuna düşen dar ekranda gerilme olmadığı için hiçbir şey
       değişmiyor. */
    <Panel className={styles.analystPanel}>
      <PanelHeader
        title={t.stock.analysts}
        action={<UsersThree className={styles.cardIcon} size={19} weight="duotone" aria-hidden />}
        /* ROZET BAŞLIĞIN SAĞINDA. Sayı bir süre dip künyesinde durdu ve
           orada künyenin ilk kelimesiydi: kartın tek cümlelik cevabı, en son
           okunan satırda kalıyordu. Başlığın yanında ilk bakışta okunuyor.
           Yeşil, altındaki çubuğun yeşil kısmının payı olduğu için — rozet
           o oranın sayısı, ayrı bir hüküm değil. Renk tek taşıyıcı da değil:
           yön kelimesi rozetin içinde yazılı. */
        /* Yeni grafik başlığın hemen altında aynı özeti taşıyor;
           rozetin sayısı burada tekrarlanmıyor. */
      />
      <div className={styles.analystBody}>
      <div className={styles.analystOverview}>
      <div className={styles.consensus}>
        <svg viewBox="0 0 120 120" className={styles.consensusRing} aria-hidden>
          <circle cx="60" cy="60" r="47" fill="none" stroke="var(--surface-elevated)" strokeWidth="8" />
          {segments.map((segment, index) => {
            const circumference = 2 * Math.PI * 47;
            const length = segment.value / total * circumference;
            const offset = segments.slice(0, index).reduce((sum, item) => sum + item.value, 0) / total * circumference;
            return segment.value > 0 ? <circle key={segment.label} cx="60" cy="60" r="47" fill="none" stroke={segment.color} strokeWidth="8" strokeDasharray={`${Math.max(0, length - 2)} ${circumference - Math.max(0, length - 2)}`} strokeDashoffset={-offset} transform="rotate(-90 60 60)" /> : null;
          })}
          <circle cx="60" cy="60" r="33" fill="none" stroke="var(--line-soft)" strokeWidth="1" />
        </svg>
        <div className={styles.consensusValue}>
          <strong className="numeral">{formatPercentPlain((alimTarafi / total) * 100, locale, 0)}</strong>
          <span>{t.stock.analystLeaning}</span>
        </div>
      </div>
      {/* Çubuk ARIA'dan gizli: altındaki liste aynı veriyi zaten okunabilir
          hâlde taşıyor, ikisi birden okununca sayılar iki kez geçiyordu.
          Dilim sınırını renk değil boşluk çiziyor — komşu basamaklar aynı
          renk ailesinden ve kontrast ayırmaya yetmiyor. */}
      <dl className={styles.analystDistribution}>
        {segments.map((segment) => (
          <div key={segment.label} className={styles.analystRow}>
            <dt className="flex min-w-0 flex-1 items-center gap-2 text-xs font-semibold text-strong">
              <span
                aria-hidden
                className={cn("size-2 shrink-0 rounded-full", segment.cls)}
              />
              {segment.label}
            </dt>
            {/* Sayı sütunu da sabit genişlikte — tek haneli "3" ile iki
                haneli "13" aynı sağ kenardan okunuyor. */}
            <dd className="numeral w-7 shrink-0 text-right text-sm text-body">
              {segment.value}
            </dd>
            {/* Sabit genişlik: yüzdeler sağ kenarda hizalı dursun, sayının
                kaç hane olduğuna göre sağa sola kaymasın. */}
            {/* YÜZDE SÜTUNU DAR EKRANDA YOK. Aynı dağılım bu kartta dört kez
                çizilmiş: rozet, yığılmış çubuk, adet sütunu ve bu yüzde
                sütunu. Yüzde yeni bir şey söylemiyor — çubuğun zaten çizdiği
                oranın sayısı. Varlık sebebi masaüstündeki üç sütunlu ızgarada
                kart boyunu eşitlemekti; mobilde o ızgara yok, paneller alt
                alta. Üstelik üstteki "%94 Al Yönünde" rozetinin bazı FARKLI
                (al tarafının toplam paya oranı) ve yan yana duran altı yüzde
                iki ayrı bazı ayırt edilemez hâle getiriyordu. */}
            {/* ÖLÇEK FARKI YÜZDEYİ SİLİYORDU. Sütun 11 piksel (`text-tiny`)
                ve `text-muted` ile çiziliyordu; hemen solundaki adet sütunu
                ise 14 piksel ve `text-body`. Kontrast zaten AA'yı geçiyordu
                (açık temada 5,57:1, koyuda 5,32:1) — sorun renk değil, üç
                piksellik punto farkının yüzdeyi komşusunun gölgesine
                itmesiydi. 12 piksele ve aynı renk ailesine çekildi; sayının
                altında değil YANINDA duruyor artık. Hâlâ ikincil: adet
                sütunundan iki punto küçük ve ağırlığı yok. */}
            <dd className="numeral w-11 shrink-0 text-right text-small text-body">
              {formatPercentPlain((segment.value / total) * 100, locale, 0)}
            </dd>
          </div>
        ))}
      </dl>
      </div>
      {/* Listenin kapanış çizgisi VE paragrafın ayıracı aynı kural; ikinci
          bir çizgi çekilmiyor. Künye kendi çizgisini koruyor, çünkü o
          açıklamanın devamı değil ayrı bir kayıt (kapsam ve dönem). */}
      {/* KÜNYE AÇIKLAMA SATIRINDA. "55 Analist · Eylül 2026" kartın dibinde
          tek başına bir satır tutuyordu; hemen üstündeki "12 Aylık Tavsiye
          Dağılımı" satırının ortası boştu (23 Eylül, sahibinin isteği). */}
      <details className={styles.analystExplanation}>
        <summary>
          <span className={styles.analystSummaryLabel}>{t.stock.analystReading}</span>
          <span className={cn("numeral", styles.analystStamp)}>
            {total} {plural(total, t.stock.analystOne, t.stock.analystMany)} ·{" "}
            {new Intl.DateTimeFormat(locale === "tr" ? "tr-TR" : "en-US", {
              month: "long",
              year: "numeric",
              timeZone: "UTC",
            }).format(new Date(`${latest.period}T12:00:00Z`))}
          </span>
          <span aria-hidden className={styles.analystToggle}>+</span>
        </summary>
        <p className={styles.cardNote}>{t.stock.analystsNote}</p>
      </details>
      {/* KÜNYE ÜÇ ŞEYİ SÖYLÜYOR: özet, kapsam, dönem.
          Başta yalnızca ay yazıyordu. Analist sayısı eklendi, çünkü
          dağılımın ağırlığı sayıya bağlı — "3 analistin 2'si Al diyor" ile
          "54 analistin 37'si Al diyor" aynı şey değil. Sonra başa tek bir
          okuma geldi: beş kovayı kafada toplamak okuyucunun işi olmamalı.

          BU SAYI AĞIRLIKLANDIRILMIŞ BİR PUAN DEĞİL, İKİ TOPLAMA. Güçlü Al
          ile Al'ın toplamının paya oranı; çubuğun yeşil kısmının yüzdesi.
          Kasıtlı olarak 1-5 ortalaması ya da 0-100 puan değil: o iki biçim
          "Güçlü Al, Al'dan tam bir basamak yukarıdadır" gibi bizim
          uydurduğumuz bir ağırlıklandırma taşır ve 0-100 olanı sitenin
          KENDİ bilanço analizi puanıyla (AL · 75 rozetleri) karışırdı —
          okuyucu analist konsensüsünü bizim hükmümüz sanardı. */}
      {/* TAVSİYELER BAŞKA BİR KOTASYONA AİT OLABİLİR. Finnhub sorulan
          sembolü değil, karşılık getirdiği kotasyonu yanıtlıyor: TSM
          sorulunca dönen kayıtların sembolü "2330.TW", yani dağılım
          Tayvan'daki payı izleyen analistlerden toplanmış. Sayfanın
          başlığındaki fiyat ise ABD'de işlem gören ADR'nin. İkisi yan yana
          durunca aynı hisseymiş gibi okunuyordu — Anahtar Metrikler'deki
          para birimi notunun (`homeCurrencyNote`) analist tarafındaki eşi.
          `?.` şart: alan bir gün gelmezse uyarı hiç basılmamalı, yanlış
          uyarı uyarısızlıktan kötü. */}
      {kotasyon && kotasyon !== symbol.toUpperCase() && (
        /* Kendi ayraç çizgisi YOK: hemen üstündeki künye zaten bir
           `border-t` taşıyor ve ikisi on piksel arayla iki çizgi olarak
           çiziliyordu. Not o künyenin devamı, ayrı bir bölüm değil. */
        <p className="mt-1.5 text-small leading-relaxed text-muted">
          {t.stock.analystListingNote.replace("{code}", kotasyon)}
        </p>
      )}
      </div>
    </Panel>
  );
}

/**
 * Geçmiş bilançolar — dönem başına sapma, sonra onu üreten EPS beklentisi
 * ve gerçekleşeni;
 * gelir verisi varsa ikinci satırda okunur. Açıklanmamış (gelecek) kayıtlar
 * bu listede yer almaz, onlar Yaklaşan Bilanço kartındadır.
 */
async function PastEarnings({
  symbol,
  locale,
  t,
  analyses,
}: {
  symbol: string;
  locale: Locale;
  t: Dictionary;
  analyses: AnalysisIndexRow[];
}) {
  const today = todayEt();
  /* Bu tablo bir dönem koşulsuz dolar basıyordu — gerekçe `paraSecenegi`de. */
  const paraOpt = await paraSecenegi(symbol);

  /* TAKVİM İKİ KAYNAKTAN. Yerel tablo geçmiş tarafında sembol başına TEK
     satır tutuyor (ölçüldü, UpcomingEarnings künyesi) ve sağlayıcının sembol
     takvimine yalnızca yerel tablo BOŞKEN gidiliyordu: NVDA'da dört çeyreğin
     üçü rapor tarihsiz kalıyordu. İki liste birleşiyor, aynı gün tek satır
     (yerel önce: gelir alanları orada). Sağlayıcı çağrısı yeni bir tur
     açmıyor — Yaklaşan Bilanço kartı aynı ucu aynı parametrelerle çağırıyor
     ve `finnhubFetch` altı saat önbellekliyor. */
  const [yerel, saglayici, surprises] = await Promise.all([
    getEarningsForSymbol(symbol, 12),
    symbolEarnings(symbol),
    /* Kanonik EPS kaynağı earnings surprises'tır: çeyrek başına TEK kayıt
       ve rapor günündeki nihai beklentiyi taşır. Takvim beslemesi aynı
       çeyrek için revizyon kopyaları düşürebiliyor (AAPL'da iki farklı
       beklenti görüldü) — bu yüzden takvim yalnızca gelir/rapor-tarihi
       zenginleştirmesi yapar. */
    getEarningsSurprises(symbol),
  ]);
  const byDate = new Map<string, EarningsItem>();
  for (const row of [...yerel, ...saglayici]) {
    if (row.reportDate > today && row.epsActual === null) continue;
    const held = byDate.get(row.reportDate);
    if (!held || (row.epsActual !== null && held.epsActual === null)) byDate.set(row.reportDate, row);
  }
  const calRows = [...byDate.values()];

  let rows: PastQuarter[];
  if (surprises.ok) {
    rows = buildPastQuarters(surprises.data, calRows, analyses, locale, today);
  } else {
    // Surprises yoksa takvimden devam: satır zaten açıklama gününe bağlı.
    rows = calRows
      .filter((row) => row.reportDate <= today)
      .sort((a, b) => b.reportDate.localeCompare(a.reportDate))
      .map((row) => {
        const fiscal = fiscalOf(row);
        return {
          key: row.reportDate,
          fiscal,
          label: fiscal ? fiscalLabel(fiscal, locale) : null,
          shortLabel: null,
          quarterEnd: null,
          reportDate: row.reportDate,
          epsEstimate: row.epsEstimate,
          epsActual: row.epsActual,
          revenueEstimate: row.revenueEstimate,
          revenueActual: row.revenueActual,
        };
      });
  }

  if (rows.length === 0) {
    return <EmptyState title={t.common.noData} />;
  }
  const shown = rows.slice(0, 8);

  /* Ay satırı çeyreğin bittiği ayı söyler; mali yıl etiketi (NVDA'nın
     FY2027'si) tek başına takvimde nereye düştüğünü söylemiyor. İkisi
     birlikte: ad üstteki analiz paneliyle aynı, ay altında sessiz. */
  const periodLabel = new Intl.DateTimeFormat(
    locale === "tr" ? "tr-TR" : "en-US",
    { month: "short", year: "numeric", timeZone: "UTC" },
  );

  /* GELİR SÜTUNLARI YA İKİ SATIRDA DEĞER VARSA YA DA BİR SATIR TAMSA.
     Tek dolu hücre için iki sütun tablonun üçte birini (1440'ta 449 / 1318
     piksel) tireye harcıyordu. Ama beklentisi ve gerçekleşeni birlikte
     bilinen tek bir çeyrek kendi başına bir karşılaştırma: SNDK'nın analizi
     yayımlanmış çeyreği tam da bu (beklenti takvimden, gerçekleşen analiz
     kaydından). */
  const hasRevenue =
    shown.filter((row) => row.revenueActual !== null || row.revenueEstimate !== null).length >= 2 ||
    shown.some((row) => row.revenueActual !== null && row.revenueEstimate !== null);

  return (
    <div>
      <EpsTrack rows={shown} locale={locale} currency={paraOpt} t={t} />
      {/* Tablo dar ekranda kendi kabında kayar — sayfa yana kaymaz.
          KAP KLAVYEYLE ODAKLANABİLİR: 560px'lik tablo 352px'lik kapta kayıyor
          ve `tabindex` olmadan sağdaki sütunlara fare olmadan ulaşılamıyordu
          (WCAG 2.1.1). */}
      <ScrollEdges
        className="scroll-x focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--line-focus)"
        tabIndex={0}
        role="region"
        aria-label={t.stock.pastEarnings}
      >
        {/* DAR EKRANDA KAYDIRMASIZ. `min-w-[560px]` koşulsuzdu: 390 pikselde
            kaba 352 piksel kalıyor ve tablonun 208 pikseli (%37) görüş
            alanının dışında duruyordu — üstelik dışarıda kalan sütun
            tablonun TEK CEVABI olan sayıydı, yani şirketin gerçekten ne
            açıkladığı. Gelir sütunları zaten dar ekranda gizleniyordu ve
            üstündeki yorum "tablo kaydırmadan sığar" diyordu; taban genişlik
            o iddiayı boşa çıkarıyordu. */}
        <table className="w-full min-w-0 text-sm sm:min-w-[560px]">
        <thead>
          <tr className="border-b border-line-soft text-left text-nano text-muted">
            <th className="px-4 py-2.5 font-medium sm:px-5">
              {t.earnings.period}
            </th>
            {/* Tablo tam genişlikte olduğu için rapor tarihi kendi kolonunda
                durur; dar ekranda dönem hücresinin altına iner. */}
            <th className="hidden px-3 py-2.5 font-medium md:table-cell">
              {t.earnings.reportDate}
            </th>
            {/* SAPMA EPS SÜTUNLARININ ÖNÜNDE. Tablo bir aritmetik defteri
                değil, bir karne: okuyucunun aradığı cevap "tutturdu mu",
                girdi sayıları değil. Sapma en sağdayken göz her satırda dört
                sayı geçip sonuca varıyordu; artık dönemin hemen yanında
                duruyor ve isteyen sağdaki iki sütunda nasıl hesaplandığını
                görüyor. Dar ekranda rapor tarihi sütunu gizli, yani sıra
                doğrudan Dönem → Sapma oluyor. */}
            {/* SAYI SÜTUNLARI ORTALI, SAĞA DAYALI DEĞİL. Tablo hisse
                sayfasının tam genişliğinde (1400 piksele kadar) ve beş
                sütunlu: sağa dayandığında her sayı kendi sütununun uzak
                kenarına yapışıyor, sütunlar arasında avuç içi kadar boşluk
                kalıyor ve göz dönem ile değer arasında uzun bir yol
                yürüyordu. Hane hizası burada bedeli küçük bir ödün: en fazla
                sekiz satır var ve değerler aynı büyüklük sınıfında. */}
            <th className="px-2 py-2.5 text-center font-medium sm:px-3">
              {t.earnings.surprise}
            </th>
            <th className="px-2 py-2.5 text-center font-medium sm:px-3">
              EPS · {t.calendar.forecast}
            </th>
            <th className="px-2 py-2.5 text-center font-medium sm:px-3">
              EPS · {t.calendar.actual}
            </th>
            {hasRevenue && (
              <>
                {/* Gelir beklentisi EPS kadar önemli: piyasa çoğu zaman kârı
                    tutturup geliri ıskalayan şirketi de satar. Beklenen ve
                    gerçekleşen ayrı kolonlarda durur ki karşılaştırılabilsin.
                    Dar ekranda ikisi de gizlenir — tablo kaydırmadan sığar. */}
                <th className="hidden px-2 py-2.5 text-center font-medium sm:px-3 lg:table-cell">
                  {t.earnings.revenueShort} · {t.calendar.forecast}
                </th>
                <th className="hidden px-4 py-2.5 text-center font-medium sm:table-cell sm:px-5">
                  {t.earnings.revenueShort} · {t.calendar.actual}
                </th>
              </>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-line-soft">
          {shown.map((row) => {
            const surprise = epsSurprise(row.epsEstimate, row.epsActual);
            return (
              <tr key={row.key}>
                <td className="px-4 py-2.5 sm:px-5">
                  <span className="numeral block whitespace-nowrap text-sm font-semibold text-strong">
                    {row.label ?? <EmptyValue label={t.common.noData} />}
                  </span>
                  {row.quarterEnd && (
                    <span className="numeral hidden text-tiny text-muted md:block">
                      {periodLabel.format(new Date(`${row.quarterEnd}T12:00:00Z`))}
                    </span>
                  )}
                  {/* Rapor günü bilinmiyorsa dar ekranda alt satır HİÇ yok:
                      eskiden yerine dönem sonu basılıyordu. */}
                  {row.reportDate && (
                    <span className="numeral block text-tiny text-muted md:hidden">
                      {formatEtDateMedium(row.reportDate, locale)}
                    </span>
                  )}
                </td>
                <td className="numeral hidden px-3 py-2.5 text-sm text-body md:table-cell">
                  {row.reportDate ? (
                    formatEtDateMedium(row.reportDate, locale)
                  ) : (
                    <EmptyValue label={t.common.noData} />
                  )}
                </td>
                <td className="px-2 py-2.5 text-center sm:px-3">
                  {surprise ? (
                    <SurprisePill
                      surprise={surprise}
                      locale={locale}
                      currency={paraOpt}
                      title={`EPS · ${t.calendar.forecast} ${formatPrice(row.epsEstimate, locale, { currency: paraOpt })} · ${t.calendar.actual} ${formatPrice(row.epsActual, locale, { currency: paraOpt })}`}
                    />
                  ) : (
                    <EmptyValue label={t.common.noData} className="text-xs text-muted" />
                  )}
                </td>
                <td className="numeral px-2 py-2.5 text-center text-muted sm:px-3">
                  {row.epsEstimate !== null
                    ? formatPrice(row.epsEstimate, locale, {
                        currency: paraOpt,
                      })
                    : <EmptyValue label={t.common.noData} />}
                </td>
                <td className="numeral px-2 py-2.5 text-center font-semibold text-strong sm:px-3">
                  {row.epsActual !== null
                    ? formatPrice(row.epsActual, locale, { currency: paraOpt })
                    : <EmptyValue label={t.common.noData} />}
                </td>
                {hasRevenue && (
                  <>
                    <td className="numeral hidden px-2 py-2.5 text-center text-muted sm:px-3 lg:table-cell">
                      {row.revenueEstimate !== null
                        ? formatMoneyCompact(
                            row.revenueEstimate,
                            locale,
                            paraKoduOf(paraOpt),
                          )
                        : <EmptyValue label={t.common.noData} />}
                    </td>
                    <td className="numeral hidden px-4 py-2.5 text-center text-body sm:table-cell sm:px-5">
                      {row.revenueActual !== null ? (
                        <span className="font-semibold text-strong">
                          {formatMoneyCompact(
                            row.revenueActual,
                            locale,
                            paraKoduOf(paraOpt),
                          )}
                        </span>
                      ) : (
                        <EmptyValue label={t.common.noData} />
                      )}
                    </td>
                  </>
                )}
              </tr>
            );
          })}
        </tbody>
        </table>
      </ScrollEdges>

      {/* AÇIKLAMA PARAGRAFI KÜNYEYE İNDİ. EPS'in ne olduğunu anlatan beş-
          sekiz satırlık paragraf (390'da ~190 piksel) her hisse sayfasında
          birebir tekrar ediyordu; kısaltmanın karşılığı tek satırda yetiyor,
          ayrıntısı sayfanın sonundaki rehber bağlantısında. */}
      <p className="border-t border-line-soft px-4 py-2.5 text-tiny text-muted sm:px-5">
        {t.earnings.epsFull}
      </p>
    </div>
  );
}

/**
 * Sapma hapı — `ChangePill` ile aynı yıkama ve ok, ama metin
 * `formatEpsSurprise`ten: yüzde tek ondalık ya da dolar farkı (gerekçe
 * components/stock/past-quarters.ts). `title` iki EPS'i birlikte yazıyor.
 */
function SurprisePill({
  surprise,
  locale,
  currency,
  title,
}: {
  surprise: EpsSurprise;
  locale: Locale;
  currency: string | true;
  title: string;
}) {
  return (
    <span
      title={title}
      className={cn(
        "numeral inline-flex items-center gap-1 whitespace-nowrap rounded-full px-1.5 py-0.5 text-tiny font-semibold",
        directionWash(surprise.direction),
      )}
    >
      {surprise.direction !== "flat" && (
        <span aria-hidden className="text-[0.85em] leading-none">
          {surprise.direction === "up" ? "▲" : "▼"}
        </span>
      )}
      {formatEpsSurprise(surprise, locale, currency)}
    </span>
  );
}

/**
 * Katılım taraması — faaliyet alanı + AAOIFI finansal eşikleri.
 * Sonuç bir fetva değil, ön elemedir; kartın altındaki not bunu söyler.
 */
async function ComplianceCard({
  symbol,
  locale,
  t,
}: {
  symbol: string;
  locale: Locale;
  t: Dictionary;
}) {
  const status = await getStatus();
  const [metricsResult, quoteResult, meta] = await Promise.all([
    getKeyMetrics(symbol),
    getQuote(symbol, status),
    /* PARA BİRİMİ ŞART — MetricsCard'daki gerekçenin aynısı (500 satır
       yukarıda). Metrik ucu hisse başı değerleri ana borsanın parasında
       veriyor, fiyat dolar; kart ikisini bölüp SKHY'de %47.685 gibi
       imkânsız oranlar, PDD ve NTES'te yanlış "Geçemiyor" basıyordu.
       `getSymbolNames` istek içinde önbellekli, sayfa başı zaten çağırıyor. */
    getSymbolNames([symbol]),
  ]);

  const metrics = metricsResult.ok ? metricsResult.data : null;
  const price = quoteResult.ok ? quoteResult.data.price : null;
  const currency = meta[symbol]?.currency ?? null;

  const result = screenCompliance({
    symbol,
    price,
    currency,
    bookValuePerShare: metrics?.bookValuePerShare ?? null,
    debtToEquity: metrics?.debtToEquity ?? null,
    cashPerShare: metrics?.cashPerShare ?? null,
    /* Ölçülerin bu hisseye ait olduğunu sınamak için — gerekçe
       lib/compliance.ts → `ComplianceInputs.low52`. Gösterilmiyorlar. */
    low52: metrics?.low52 ?? null,
    high52: metrics?.high52 ?? null,
  });

  const verdictLabel =
    result.verdict === "pass"
      ? t.stock.compliancePass
      : result.verdict === "fail"
        ? t.stock.complianceFail
        : t.stock.complianceReview;

  const verdictClass =
    result.verdict === "pass"
      ? "bg-up-wash text-up"
      : result.verdict === "fail"
        ? "bg-down-wash text-down"
        : "bg-surface-elevated text-body";

  const ratios: [string, number | null][] = [
    [t.stock.complianceDebt, result.debtRatio],
    [t.stock.complianceCash, result.cashRatio],
  ];

  return (
    /* `flex-1` orta sütunun ARTAN YERİNİ bu kart yutuyor; gerekçe sütunun
       kendi yorumunda. `flex flex-col` olmadan `flex-1` yalnızca dış
       yüksekliği büyütürdü — içerik üstte kalsın diye gövde de esneyebilir
       durumda. */
    <Panel className={styles.compliancePanel}>
      {/* HÜKÜM BAŞLIĞIN YANINDA. Rozet gövdenin ilk satırıydı ve kendi
          satırını tümüyle işgal ediyordu: 28 piksel rozet + 14 piksel
          aralık, üstünde de başlığın 16 piksellik alt dolgusu. Yani kartın
          tek cümlelik cevabı, başlıktan 58 piksel aşağıda başlıyordu.
          Başlığın `action` yuvası tam bunun için var ve komşu Analist
          kartında aynı rol aynı yerde duruyor (orada da rozet başlığın
          sağında). Ölçek de oraya uyduruldu: `text-tiny`, `py-0.5`.
          Dar ekranda `flex-wrap` rozeti kendiliğinden alt satıra indiriyor,
          başlık kesilmiyor. Ölçüldü: kart 264 → 214 piksel. */}
      <PanelHeader
        title={t.stock.compliance}
        className="pb-1.5"
        action={
          <span
            className={cn(
              "shrink-0 rounded-full px-2.5 py-0.5 text-tiny font-semibold",
              verdictClass,
            )}
          >
            {verdictLabel}
          </span>
        }
      />
      <div className={styles.complianceBody}>
        {result.businessReasonKey && (
          <p className="mt-2.5 text-xs leading-relaxed text-body">
            {t.stock.complianceReasons[result.businessReasonKey]}
          </p>
        )}

        {/* FAALİYET ALANI TARANAMADIYSA BUNU SÖYLE. Alt sektör yalnızca
            endeks tohumundan geliyor ve tohumda olmayan sembolde A kriteri
            hiç çalışmıyor. Eskiden bu sessizdi: kart üç ölçütten ikisine
            bakıp "Ön Elemeyi Geçiyor" diyordu ve tam da taramanın var olma
            sebebi olan kategorilerde yanılıyordu (DKNG bahis, SOFI faizli
            kredi — ikisi de geçiyor görünüyordu). Artık hüküm "İnceleme
            Gerekir" ve eksiğin ne olduğu burada yazılı. */}
        {!result.businessKnown && (
          <p className="mt-2.5 text-xs leading-relaxed text-body">
            {t.stock.complianceNoSector}
          </p>
        )}

        {result.ratiosKnown ? (
          <dl className={styles.complianceRatios}>
            {ratios.map(([label, value]) => {
              const over = value !== null && value >= COMPLIANCE_THRESHOLD;
              const width =
                value === null
                  ? 0
                  : Math.min((value / COMPLIANCE_THRESHOLD) * 100, 100);
              return (
                <div key={label} className={styles.complianceRatio}>
                  <div className={styles.complianceReading}>
                    <dt className="text-tiny leading-tight text-muted">
                      {label}
                    </dt>
                    <dd
                      className={cn(
                        "numeral shrink-0 text-xs font-semibold",
                        over ? "text-down" : "text-strong",
                      )}
                    >
                      {/* Yüzde işareti sözlüğe değil biçimlendiriciye ait:
                          elden yazılan "%" iki dilde de sonda kalıyordu
                          ("12,3%"), oysa Türkçede önde yazılır. */}
                      {value !== null
                        ? formatPercentPlain(value, locale, 1)
                        : NO_VALUE}
                    </dd>
                  </div>
                  {/* Eşiğe ne kadar yakın — çubuk %33'te dolar */}
                  <div className={styles.complianceTrack}>
                    <div
                      data-motion-draw="line"
                      className={cn("h-full", over ? "bg-down" : "bg-up")}
                      style={{ width: `${width}%` }}
                    />
                  </div>
                  <div className={styles.complianceScale}><span className="numeral">0</span><span>{t.stock.complianceLimit} <b className="numeral">{formatPercentPlain(COMPLIANCE_THRESHOLD, locale, 0)}</b></span></div>
                </div>
              );
            })}
              {/* Yüzde işareti biçimlendiriciye ait — kartın 18 satır
                  yukarısındaki kural bunu açıkça yazıyor ve oranların
                  kendisi ona uyuyor. Sınır satırı atlanmıştı: elden yazılan
                  "%" iki dilde de önde kalıyordu, oysa İngilizcede sonda
                  yazılır ("33%"). `digits: 0` şart — varsayılan 1 olduğu için
                  argümansız çağrı "%33,0" basardı. */}
          </dl>
        ) : currency && currency !== "USD" ? (
          /* Oranlar bilerek hesaplanmadı: pay ana borsanın parasında, payda
             dolar. Kur uydurulmuyor; gerekçe lib/compliance.ts → `currency`. */
          <p className="mt-3 text-xs text-muted">
            {t.stock.complianceForeignCurrency}{" "}
            <span className="numeral font-semibold text-body">({currency})</span>
          </p>
        ) : (
          <p className="mt-3 text-xs text-muted">{t.stock.complianceUnknown}</p>
        )}

        {/* İKİ UYARI KATLANDI — kart artık ÜÇ KOLONUN BOYUNU BELİRLİYOR.
            Ölçüldü: şerit 580 piksel ve bu boyu orta sütun kuruyor; sol
            (metrikler) ve sağ (analist) kartların içeriği 310-340'ta bitip
            altlarında ~240 piksel boş kalıyordu. Kartın 315 pikselinin 120'si
            bu iki paragraftı.

            EN ÖNEMLİ CÜMLE AÇIKTA: "Bu bir fetva değildir" katlanan yerin
            değil, tetikleyicinin kendisi. Katlanan şey o cümlenin
            AÇIKLAMASI ve taranamayan ölçüt — ikisi de sayfada duruyor, bir
            tık ötede. Uyarıyı tümüyle gizlemek dini uyum ekranında kabul
            edilebilir olmazdı.

            `<details>` KALIYOR, istemci durumu değil: katlama JS gelmeden de
            çalışıyor — emsali components/today/BriefBody.tsx. */}
        <details className="group/uyum mt-3 border-t border-line-soft pt-2.5">
          {/* `tap-44`: özet satırı 35 piksel yüksekliğindeydi (390'da ölçüldü);
              `min-h-9` (36) fare için yeterli, parmak için değil. */}
          <summary className="tap-44 inline-flex min-h-9 w-fit cursor-pointer list-none items-center gap-1.5 text-nano font-semibold text-muted transition-colors hover:text-body [&::-webkit-details-marker]:hidden">
            <span
              aria-hidden
              className="transition-transform group-open/uyum:rotate-90"
            >
              ›
            </span>
            {t.stock.complianceNotFatwa}
          </summary>
          <p className="mt-1 text-nano leading-relaxed text-muted">
            {t.stock.complianceDisclaimer}
          </p>
          <p className="mt-1.5 text-nano leading-relaxed text-muted">
            {t.stock.complianceMissing}
          </p>
        </details>
      </div>
    </Panel>
  );
}

/**
 * Aynı alt sektördeki şirketler — piyasa değerine göre SIRALI bir liste,
 * sayfanın şirketi kendi sırasında (24 Eylül).
 *
 * NEDEN LİSTE: sekiz kart dört sütunluk ızgarada 1440'ta 499, 390'da 891
 * piksel tutuyordu ve her kart aynı üç şeyi (logo, sembol, fiyat) büyük bir
 * boşluğun içinde gösteriyordu. Kartların söylemediği asıl şey şuydu: bu
 * şirket sektörünün NERESİNDE? Sayfanın şirketi listede hiç yoktu. Artık
 * dokuz satır, piyasa değerine göre sıralı; sayfanın şirketi vurgulu satırda
 * kendi sırasında, çubuk büyüklüğü UZUNLUK olarak veriyor (CLAUDE.md
 * "Karşılaştırılan her büyüklük bir de çizgi olarak okunur", `ScaleBar`).
 *
 * Piyasa değeri profil kartıyla AYNI kural (`liveMarketCap`): NVDA satırı
 * profilin tek büyük okumasıyla aynı sayı. FİYATTA ÇUBUK YOK — farklı
 * şirketlerin hisse fiyatları karşılaştırılabilir değil (CompareScale).
 * Sınıflandırma GICS'ten; aynı şirketin ikinci hisse sınıfı listeye girmez.
 */
async function PeersCard({
  symbol,
  locale,
  t,
}: {
  symbol: string;
  locale: Locale;
  t: Dictionary;
}) {
  const member = indexMemberOf(symbol);
  const peers = peersOf(symbol);
  if (peers.length === 0) return null;

  const meta = await getSymbolNames([symbol, ...peers.map((peer) => peer.symbol)]);
  const top = [...peers]
    .sort(
      (a, b) =>
        (meta[b.symbol]?.marketCap ?? 0) - (meta[a.symbol]?.marketCap ?? 0),
    )
    .slice(0, 8);

  const status = await getStatus();
  const result = await getQuotes(
    [symbol, ...top.map((peer) => peer.symbol)],
    status,
  );
  const quotes = result.ok ? result.data : {};

  const rows = [
    { symbol, name: meta[symbol]?.name ?? symbol, self: true },
    ...top.map((peer) => ({ symbol: peer.symbol, name: peer.name, self: false })),
  ]
    .map((row) => ({
      ...row,
      cap: liveMarketCap(meta[row.symbol], quotes[row.symbol]?.price ?? null),
    }))
    .sort((a, b) => (b.cap ?? -1) - (a.cap ?? -1));
  const maxCap = Math.max(0, ...rows.map((row) => row.cap ?? 0));

  /* Karşılaştırma bağlantısı buraya konuyor çünkü soru tam burada doğuyor:
     benzer şirketleri yan yana gören biri "hangisi" diye sorar. Sembol
     listesi bu hissenin kendisiyle başlar ve en büyük üç rakiple dolar. */
  const compareSymbols = [symbol, ...top.map((peer) => peer.symbol)]
    .filter((entry, index, list) => list.indexOf(entry) === index)
    .slice(0, 4);

  return (
    <Panel className={styles.peersPanel}>
      {/* ALT SEKTÖR BAŞLIĞIN KÜNYESİNDE. Kendi satırında ("Alt Sektör:
          Yarı İletkenler") 33 piksel tutuyordu; başlığın sağı boştu. */}
      <PanelHeader
        title={t.stock.peers}
        meta={member?.sub ? subIndustryName(member.sub, locale) : undefined}
        action={
          <PanelLink href={`/karsilastir?semboller=${compareSymbols.join(",")}`}>
            {t.compare.addCta} →
          </PanelLink>
        }
      />
      <ol className={styles.peerList}>
        {rows.map((row) => {
          const quote = quotes[row.symbol];
          const logo = meta[row.symbol]?.logoUrl;
          const body = (
            <>
              {logo ? (
                <span className={styles.peerLogo}>
                  <Image src={logo} alt="" width={28} height={28} />
                </span>
              ) : (
                <span className={styles.peerMonogram} aria-hidden>
                  {row.symbol.slice(0, 1)}
                </span>
              )}
              <span className="min-w-0">
                <span className="numeral block text-sm font-bold text-strong">{row.symbol}</span>
                <span className="block truncate text-xs text-muted">{row.name}</span>
              </span>
              <span className="min-w-0 text-right">
                <span className="numeral block text-xs font-semibold text-strong">
                  {row.cap !== null ? formatMoneyCompact(row.cap, locale) : NO_VALUE}
                </span>
                {row.cap !== null && maxCap > 0 && (
                  <ScaleBar ratio={row.cap / maxCap} signed={false} emphasis={row.self} />
                )}
              </span>
              <span className={styles.peerQuote}>
                {quote ? (
                  <>
                    <span className="numeral text-xs text-body">
                      {formatPrice(quote.price, locale, { currency: true })}
                    </span>
                    <ChangePill changePct={quote.changePct} locale={locale} size="sm" />
                  </>
                ) : (
                  <EmptyValue label={t.common.noData} className="text-xs text-muted" />
                )}
              </span>
            </>
          );
          return (
            <li key={row.symbol} className="min-w-0">
              {row.self ? (
                <div className={styles.peerRow} data-self aria-current="page">
                  {body}
                </div>
              ) : (
                <Link href={`/hisse/${row.symbol}`} className={styles.peerRow}>
                  {body}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </Panel>
  );
}

async function CompanyNews({
  symbol,
  locale,
  t,
}: {
  symbol: string;
  locale: Locale;
  t: Dictionary;
}) {
  const to = todayEt();
  const from = addEtDays(to, -14);
  const result = await getCompanyNews(symbol, from, to);

  /* Sağlayıcı hatası "haber yok" DEĞİLDİR — ikisi aynı daldaydı ve uç
     düştüğünde ekranda "Şu an gösterilecek haber yok." yazıyordu. Aynı
     düzeltmenin emsali components/markets/IpoCalendar.tsx'te. */
  if (!result.ok) {
    return <EmptyState title={t.common.noData} hint={t.common.noDataHint} />;
  }

  if (result.data.length === 0) {
    return <EmptyState title={t.news.empty} />;
  }

  /* KONUDAKİ HABER ÖNCE (24 Eylül). Şirketin beslemesi ara ara genel piyasa
     yazıları da döndürüyor ve bunlar yalnızca tarihleri yeni diye listenin
     başına geçiyordu; NVDA'da ilk iki satırın ikisi de NVIDIA'dan söz
     etmiyordu. Başlıkta şirketi anan haberler kararlı bir sıralamayla öne
     alınıyor, kendi aralarındaki tarih sırası korunuyor. Telefonda ilk dört
     satır gösteriliyor (stock.module.css), gerisi "Tümünü Gör"de. */
  const meta = await getSymbolNames([symbol]);
  const companyName = meta[symbol]?.name;
  const shown = [...result.data]
    .map((item, index) => ({ item, index, on: headlineMentions(item.headline, symbol, companyName) }))
    .sort((a, b) => Number(b.on) - Number(a.on) || a.index - b.index)
    .slice(0, 8)
    .map((entry) => entry.item);

  /* Haber önce SİTE İÇİNDE okunur; kaynak bağlantısı detay sayfasındadır.
     Şirket haberleri canlı uçtan gelir ve genel akış tablosunda olmayabilir —
     görüntülendiği anda tabloya işlenir, bağlantı kalıcı id ile kurulur. */
  let idByProvider = new Map<string, string>();
  /* Şirket haberleri canlı uçtan İngilizce geliyor; günlük senkron ise
     tabloya Türkçe başlığı yazıyor. Aynı okumada çeviriyi de alıp varsa onu
     gösteriyoruz — yoksa liste, akış sayfasında Türkçe olan bir haberi
     burada İngilizce göstermeye devam ederdi. */
  let trByProvider = new Map<string, string>();
  try {
    await db
      .insert(news)
      .values(
        shown.map((item) => ({
          providerId: item.providerId,
          headline: item.headline,
          summary: item.summary,
          url: item.url,
          imageUrl: item.imageUrl,
          source: item.source,
          category: item.category,
          symbols: item.symbols,
          publishedAt: item.publishedAt,
        })),
      )
      .onConflictDoNothing();
    const rows = await db
      .select({
        id: news.id,
        providerId: news.providerId,
        headlineTr: news.headlineTr,
      })
      .from(news)
      .where(
        inArray(
          news.providerId,
          shown.map((item) => item.providerId),
        ),
      );
    idByProvider = new Map(rows.map((row) => [row.providerId, row.id]));
    trByProvider = new Map(
      rows
        .filter((row) => row.headlineTr)
        .map((row) => [row.providerId, row.headlineTr as string]),
    );
  } catch {
    // DB yazılamazsa haberler kaynağa bağlanır — liste yine çalışır.
  }

  /* Küçük resim burada da var artık: haber akışı ve ana sayfa listesi
     gösteriyordu, şirket sayfası göstermiyordu ve aynı haber iki ekranda
     farklı görünüyordu. Jenerik görseller (kaynak logosu) elenir — aynı
     logonun sekiz satırda tekrar etmesi listeyi taranabilir yapmıyor,
     bozuyor. */
  // Görseli olmayan haber şirketin logosunu alır — bu listede hepsi aynı
  // şirketin haberi, o yüzden tek sembol yetiyor (`meta` yukarıda).
  const genericImages = await getGenericImageUrls(shown.map((item) => item.imageUrl));
  const logoUrl = meta[symbol]?.logoUrl ?? null;

  return (
    <ul className={styles.newsGrid}>
      {shown.map((item) => {
        const newsId = idByProvider.get(item.providerId);
        const image =
          item.imageUrl && !genericImages.has(item.imageUrl) ? item.imageUrl : null;
        /* Bu liste şirketin kendi beslemesinden geliyor ama besleme ara ara
           genel piyasa yazıları da döndürüyor; logo yalnızca başlıkta şirket
           geçiyorsa konur. */
        const mentionLogo = headlineMentions(item.headline, symbol, companyName)
          ? logoUrl
          : null;
        const inner = (
          <span className={styles.newsInner}>
            <span className="min-w-0 flex-1">
              {/* ÇEVİRİSİ OLMAYAN BAŞLIK DİLİNİ SÖYLER. Türkçe arayüzde
                  çeviri yoksa sağlayıcının İngilizce başlığına düşülüyor ama
                  metin `<html lang="tr">` altında kalıyordu: ekran okuyucu
                  İngilizce cümleyi Türkçe sesletim kurallarıyla okuyor.
                  Kural üç ekranda uygulanmış (`/haberler`, haber detayı ve
                  oradaki ilgili haberler listesi), bu panel atlanmış. */}
              <span
                lang={
                  locale === "tr" && !trByProvider.get(item.providerId)
                    ? "en"
                    : undefined
                }
                className="line-clamp-2 block text-sm font-medium leading-snug text-strong"
              >
                {(locale === "tr" && trByProvider.get(item.providerId)) ||
                  item.headline}
              </span>
              <span className="mt-1 flex items-center gap-1.5 text-tiny text-muted">
                {item.source && <span>{item.source}</span>}
                <span aria-hidden>·</span>
                <span>{titleCaseLabel(timeAgo(item.publishedAt, locale), locale)}</span>
              </span>
            </span>
            {/* GÖRSEL DE LOGO DA YOKSA KUTU DA YOK. Boş gri bir kare
                başlığın yanında 84 piksel tutuyordu ve bir şey yüklenmeyi
                bekliyormuş gibi duruyordu; başlık artık o yeri kullanıyor. */}
            {(image || mentionLogo) && (
              <NewsImage src={image} logoUrl={mentionLogo} sizeClass={styles.newsImage} />
            )}
          </span>
        );
        // Kaynak adresi sağlayıcıdan; şeması süzülmezse href'e konmaz.
        const sourceHref = safeExternalUrl(item.url);
        return (
          <li key={item.providerId}>
            {newsId ? (
              <Link
                href={`/haberler/${newsId}`}
                className={styles.newsLink}
              >
                {inner}
              </Link>
            ) : sourceHref ? (
              <a
                href={sourceHref}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.newsLink}
              >
                {inner}
              </a>
            ) : (
              <div className={styles.newsLink}>{inner}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function ListSkeleton({ rows }: { rows: number }) {
  return (
    <div className="flex flex-col gap-2 px-4 py-3 sm:px-5">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-8 w-full" />
      ))}
    </div>
  );
}
