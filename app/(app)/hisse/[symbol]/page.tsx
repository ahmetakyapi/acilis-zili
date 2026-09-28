import { Suspense } from "react";
import { DividendPanel } from "@/components/stock/DividendPanel";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { notFound } from "next/navigation";
import { SymbolAnalyses } from "@/components/earnings/SymbolAnalyses";
import { analysisHref } from "@/lib/analysis";
import { withLocale } from "@/lib/i18n/routing";
import { ArrowDownRight, ArrowUpRight, SquaresFour, ChartLineUp } from "@phosphor-icons/react/dist/ssr";
import { MotionExperience, ScrollStage, Reveal, ScrollProgress, SectionNav } from "@/components/motion/PremiumMotion";
import styles from "./stock.module.css";
import { ChartReadingProvider } from "@/components/stock/ChartReadingContext";
import { StockTechnicalCard } from "@/components/technical/StockTechnicalCard";
import { SymbolStories, SymbolStoriesSkeleton } from "@/components/stock/SymbolStories";
import { EmptyState, Panel, PanelHeader, PanelLink, Skeleton } from "@/components/ui/primitives";
import { ChapterHeading } from "@/components/ui/ChapterHeading";
import { getStatus, getAnalyses, getNextReport, getStoriesForSymbol, getSymbolNames, isKnownSymbol } from "@/lib/data";
import { rateLimit, requestKey } from "@/lib/rate-limit";
import { getI18n } from "@/lib/i18n";
import type { Metadata } from "next";
import { missingMetadata } from "@/lib/page-meta";
import { pageAlternates } from "@/lib/site";
import { industryLabel } from "@/lib/sectors";
import { fundMetaOf } from "@/db/seed/symbols";
import { isTechnicalSymbol, technicalHref } from "@/lib/technical";
import { GuideHint } from "@/components/article/GuideHint";
import { cn, isValidSymbol } from "@/lib/utils";
/* PANELLER `_panels/` ALTINDA (28 Eylül). Bu dosya 3.065 satırdı: sayfanın
   düzeni ile on üç panelin gövdesi aynı yerdeydi ve yeni bir panel eklemek
   üç bin satırlık bir dosyada yer aramak demekti. Bölme çıktıyı değiştirmedi
   — yedi sembolde (NVDA, AAPL, TSM, SPY, MSFT/en, DKNG, BRK.B) hidrasyon
   sonrası DOM bayt bayt aynı ölçüldü. Karar kayıtları kodla birlikte taşındı;
   sayfa artık yalnızca sırayı, Suspense sınırlarını ve yedekleri tutuyor.
   Alt çizgili klasör Next'te özel: rota üretmiyor. */
import { ListSkeleton } from "./_panels/shared";
import { StockBreadcrumb, NavLead, StockHeader, HeaderSkeleton } from "./_panels/StockHeader";
import { ChartSection } from "./_panels/ChartSection";
import { UpcomingEarnings } from "./_panels/UpcomingEarnings";
import { MovingAverages } from "./_panels/MovingAverages";
import { FundCard } from "./_panels/FundCard";
import { ProfileCard } from "./_panels/ProfileCard";
import { MetricsCard } from "./_panels/MetricsCard";
import { AnalystCard } from "./_panels/AnalystCard";
import { PastEarnings } from "./_panels/PastEarnings";
import { ComplianceCard } from "./_panels/ComplianceCard";
import { PeersCard } from "./_panels/PeersCard";
import { CompanyNews } from "./_panels/CompanyNews";
import { InsiderPanel } from "./_panels/InsiderPanel";
import { ExpectedMovePanel } from "./_panels/ExpectedMovePanel";
import { AnalystTrendPanel } from "./_panels/AnalystTrendPanel";
import { ScorecardPanel } from "./_panels/ScorecardPanel";
import { TechnicalSnapshotPanel } from "./_panels/TechnicalSnapshotPanel";
import { StockSummary, metaExtras, summaryFacts } from "./_panels/StockSummary";
import { StockJsonLd } from "./_panels/StockJsonLd";
import depth from "./_panels/depth.module.css";
import { BreadcrumbJsonLd } from "@/components/seo/JsonLd";
import { EXPECTED_MOVE_HORIZON_DAYS } from "@/lib/expected-move";
import { daysBetweenEt } from "@/lib/market-hours";
import { indexMemberOf } from "@/db/seed/indices";

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
  const base = sector
    ? t.stock.metaWithSector
        .replace("{ad}", info?.name ?? symbol)
        .replace("{sektor}", sector)
    : t.stock.metaPlain.replace("{ad}", symbol);
  /* ENDEKS VE SONRAKİ BİLANÇO DA AÇIKLAMADA (28 Eylül). Açıklama sektör
     dışında her hisse için aynı cümleydi; arama sonucunda sayfayı
     ayırt eden hiçbir şey taşımıyordu. İki parça da yerel okuma (endeks
     tohumu, takvim tablosu) ve ikisi de fiyat gibi eskimiyor: rapor tarihi
     değişirse takvim onu zaten güncelliyor. Tanınmayan sembolde eklenmiyor. */
  const extras = info?.name ? metaExtras(await summaryFacts(symbol, locale), locale, t) : "";
  const description = extras ? `${base} ${extras}` : base;
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
  const [storyRows, analysisRows, status, nextReport, names] = await Promise.all([
    getStoriesForSymbol(symbol, locale, 3),
    getAnalyses(locale, { symbols: [symbol], limit: 6 }),
    /* Yalnızca başlık iskeleti için: seans dışındaysa gerçek başlıkta bir
       hap satırı var ve yedek aynı yeri ayırmalı. İstek içinde önbellekli. */
    getStatus(),
    /* BEKLENEN HAREKET PANELİ AÇILACAK MI — mercek satırlarıyla aynı
       gerekçe: yerel takvim okuması, sağlayıcıya gitmiyor. Rapor ufkun
       dışındaysa panel ve iskeleti hiç basılmıyor; içindeyse iskelet
       gerçek panelin yerini ayırıyor. */
    getNextReport(symbol),
    /* Kırıntı künyesinin adı — künye ve başlık aynı istek-içi anahtarı
       okuyor, ek tur yok. */
    getSymbolNames([symbol]),
  ]);
  const expectedMoveDue =
    nextReport !== null && daysBetweenEt(status.etDate, nextReport.date) <= EXPECTED_MOVE_HORIZON_DAYS;
  const companyName = names[symbol]?.name ?? symbol;
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
      {/* YAPILANDIRILMIŞ KÜNYE (28 Eylül): kırıntı yolu kabukta, şirket
          künyesi profil gelince (sağlayıcının resmî sitesi ve borsası orada).
          Gerekçe components/seo/JsonLd.tsx → CorporationJsonLd. */}
      <BreadcrumbJsonLd
        locale={locale}
        items={[
          { name: t.nav.companies, path: "/sirketler" },
          { name: `${companyName} (${symbol})`, path: `/hisse/${symbol}` },
        ]}
      />
      <Suspense fallback={null}>
        <StockJsonLd symbol={symbol} locale={locale} />
      </Suspense>
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
      <div
        id="stock-overview"
        className={cn(styles.heroGrid, styles.companyOverview)}
        /* PROFİL TEK BAŞINA MI (28 Eylül) — teknik analiz kartı yalnızca
           kapsamdaki on iki sembolde basılıyor; öteki yaklaşık sekiz yüz
           sembolde sağ kolon yalnızca profilden oluşuyor ve 1440×900'de
           grafiğin 145 piksel altında bitiyordu. Bu işaretle orada grafik
           daha kısa bir TABANDAN başlıyor (satır uzunsa yine esniyor) ve
           profil kolonun tamamı olduğu için daha havadar diziliyor.
           Ölçüler stock.module.css → "PROFİL TEK BAŞINA". */
        data-solo={isTechnicalSymbol(symbol) ? undefined : ""}
      >
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

      {/* DERİNLİK ŞERİDİ (28 Eylül). Üstteki dört kart ölçülmüş bir ızgara
          satırını paylaşıyor ve Analist kartının yorumu oraya yeni veri
          eklenmesini yasaklıyor (satırı uzatıp komşuların altında boşluk
          açıyordu). Skor kartı, analist dağılımının değişimi ve teknik
          fotoğraf bu yüzden AYRI bir ızgarada; paneller kendi boylarında
          biter (`align-items:start`). Skor kartı yalnızca GICS sektörü
          bilinen endeks üyelerinde, teknik fotoğraf yalnızca teknik analiz
          listesinde OLMAYAN hisselerde (listedekiler üstte yazılı analizini
          taşıyor). */}
      <div className={depth.grid}>
        {indexMemberOf(symbol)?.sector && (
          <Suspense fallback={<Skeleton className="h-[360px] w-full rounded-[20px]" />}>
            <ScorecardPanel symbol={symbol} locale={locale} t={t} />
          </Suspense>
        )}
        <Suspense fallback={<Skeleton className="h-[330px] w-full rounded-[20px]" />}>
          <AnalystTrendPanel symbol={symbol} locale={locale} t={t} />
        </Suspense>
        {!isTechnicalSymbol(symbol) && (
          <Suspense fallback={<Skeleton className="h-[420px] w-full rounded-[20px]" />}>
            <TechnicalSnapshotPanel symbol={symbol} locale={locale} t={t} />
          </Suspense>
        )}
        <Suspense fallback={<Skeleton className="h-[300px] w-full rounded-[20px]" />}>
          <DividendPanel symbol={symbol} locale={locale} />
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
        {/* BEKLENEN HAREKET yaklaşan bilançonun hemen altında: aynı olayın
            "ne zaman"ından sonra "ne kadar"ı. Yalnızca rapor yakınsa
            (`EXPECTED_MOVE_HORIZON_DAYS`); karar kabukta verildi. */}
        {expectedMoveDue && nextReport && (
          <Suspense fallback={<Skeleton className="h-[420px] w-full rounded-[20px]" />}>
            <ExpectedMovePanel symbol={symbol} next={nextReport} locale={locale} t={t} />
          </Suspense>
        )}
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
      {/* ŞİRKET ÖZETİ BAĞLAMIN BAŞINDA: sayfanın geri kalanı sağlayıcı
          verisi, bu blok sitenin kendi cümleleri (endeks, sektör, sonraki
          bilanço, rehber). Gerekçe bileşenin başında. Yerel okumalar. */}
      <Suspense fallback={<Skeleton className="h-[150px] w-full rounded-[20px]" />}>
        <StockSummary symbol={symbol} locale={locale} t={t} />
      </Suspense>
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

      {/* İÇERİDEN İŞLEMLER benzer şirketlerden sonra, haberden önce:
          ikisi de "şirketin çevresinde ne oluyor" sorusu, biri piyasanın
          öteki yönetimin davranışı. */}
      <Suspense fallback={<Skeleton className="h-[460px] w-full rounded-[20px]" />}>
        <InsiderPanel symbol={symbol} locale={locale} t={t} />
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

/* Bölüm başlığı burada `SectionHeading` adıyla yerel bir bileşendi: başlık,
   yaklaşık sekiz yüz sayfada birebir aynı olan genel bir alt cümle ve
   sağında hiçbir yere götürmeyen 30 piksellik bir ok. Artık paylaşılan
   `ChapterHeading` (components/ui) — gerekçe orada; sekme etiketi ile
   bölüm başlığı aynı sözlük anahtarını okuyor. */
