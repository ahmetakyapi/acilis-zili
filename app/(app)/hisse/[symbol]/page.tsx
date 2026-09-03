import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq, inArray } from "drizzle-orm";
import { auth } from "@/auth";
import { SymbolAnalyses } from "@/components/earnings/SymbolAnalyses";
import { Heart } from "@phosphor-icons/react/dist/ssr";
import { NewsImage } from "@/components/news/NewsImage";
import { FavoriteToggle } from "@/components/stock/FavoriteToggle";
import { PriceChartLazy } from "@/components/stock/PriceChartLazy";
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
  Panel,
  PanelHeader,
  PanelLink,
  PanelSkeleton,
  Skeleton,
} from "@/components/ui/primitives";
import { db } from "@/lib/db";
import { news, watchlistItems, watchlists } from "@/lib/schema";
import {
  getEarningsForSymbol,
  getNextEarnings,
  getGenericImageUrls,
  getStatus,
  getAnalyses,
  getStoriesForSymbol,
  getSymbolNames,
  liveMarketCap,
  isKnownSymbol,
  getHolidays,
} from "@/lib/data";
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
import { industryLabel, sectorLabel } from "@/lib/sectors";
import { indexMemberOf, peersOf } from "@/db/seed/indices";
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
import {
  cn,
  directionOf,
  directionText,
  formatChange,
  formatPercent,
  formatMoneyCompact,
  formatEtDateLong,
  formatEtDateShort,
  formatPercentPlain,
  formatPrice,
  formatVolume,
  headlineMentions,
  isValidSymbol,
  bandFiyatiKapsiyorMu,
  hareketliOrtalama,
  peRatioOf,
  plural,
  safeExternalUrl,
  timeAgo,
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
    return (
      <div className="flex flex-col gap-5">
        <Suspense fallback={<HeaderSkeleton />}>
          <StockHeader symbol={symbol} locale={locale} t={t} />
        </Suspense>

        <div className="grid gap-5 lg:grid-cols-3">
          <Panel className="min-w-0 p-4 sm:p-5 lg:col-span-2">
            <Suspense fallback={<Skeleton className="h-[300px] w-full sm:h-[430px]" />}>
              <ChartSection symbol={symbol} locale={locale} t={t} />
            </Suspense>
          </Panel>

          <div className="flex min-w-0 flex-col gap-5">
            <Suspense fallback={<Skeleton className="h-96 w-full rounded-(--radius-xl)" />}>
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
              <PanelHeader title={t.stock.movingAverages} />
              <Suspense fallback={<ListSkeleton rows={3} />}>
                <MovingAverages symbol={symbol} locale={locale} t={t} />
              </Suspense>
            </Panel>
          </div>
        </div>
      </div>
    );
  }

  /* Mercek satırları ve analizler AKIŞTAN ÖNCE — gerekçesi blokların kendi
     yorumlarında. İkisi de yerel veritabanı okuması, sağlayıcıya gitmiyor.
     TEK TURDA: ardışık beklenirlerse kabuk iki Neon gidiş dönüşü bekler ve
     kazanılan CLS, gecikmeye geri verilir. */
  const [storyRows, analysisRows] = await Promise.all([
    getStoriesForSymbol(symbol, locale, 3),
    getAnalyses(locale, { symbols: [symbol], limit: 6 }),
  ]);

  return (
    <div className="flex flex-col gap-5">
      <Suspense fallback={<HeaderSkeleton />}>
        <StockHeader symbol={symbol} locale={locale} t={t} />
      </Suspense>

      {/* Üst blok — grafik solda geniş, şirketin kimliği sağda */}
      <div className="grid gap-5 lg:grid-cols-3">
        <Panel className="min-w-0 p-4 sm:p-5 lg:col-span-2">
          {/* ÖLÇÜLMÜŞ YÜKSEKLİK. Yedek 300 (mobil) / 430 piksel ayırıyordu
              ama grafik bölümü 636–637 piksel kaplıyor: sayfanın EN
              TEPESİNDE 336 piksellik bir sıçrama demekti ve altındaki her
              şeyi itiyordu — hisse sayfasının mobil CLS'i 0,244 çıkıyordu.
              Sayı tahmin değil: beş sembol × üç aralık × beş genişlikte
              ölçüldü, hepsinde 636/637. Grafiğin iç yükseklikleri sabit
              olduğu için bu ölçü içerikle birlikte kaymıyor. */}
          <Suspense fallback={<Skeleton className="h-[636px] w-full sm:h-[637px]" />}>
            <ChartSection symbol={symbol} locale={locale} t={t} />
          </Suspense>
        </Panel>

        {/* Sağ kolon grafiğin boyuna geriliyor (ızgara varsayılanı) ama
            kartlar doğal boyunda kaldığı için altta tırtıklı bir boşluk
            kalıyordu. Profil kartı artık artan yeri kendi içine alıyor:
            satırlar boşluğa yayılıyor, kartın alt kenarı grafiğinkiyle
            hizalanıyor. Veri çoksa `flex-1` zaten bağlayıcı olmuyor ve kart
            eskisi gibi içeriği kadar yer kaplıyor. */}
        <div className="flex min-w-0 flex-col gap-5">
          <Panel className="flex flex-1 flex-col">
            <PanelHeader title={t.stock.profile} />
            {/* Altı künye satırı + iki paragraf: gövde 369 (mobil) / 437
                piksel. Beş satırlık yedek 216 piksel ayırıyordu. */}
            <Suspense fallback={<ListSkeleton rows={9} />}>
              <ProfileCard symbol={symbol} locale={locale} t={t} />
            </Suspense>
          </Panel>

          <Suspense
            fallback={
              <Skeleton className="h-[160px] w-full rounded-(--radius-xl) sm:h-[168px]" />
            }
          >
            <UpcomingEarnings symbol={symbol} locale={locale} t={t} />
          </Suspense>
        </div>
      </div>

      {/* Ölçüler şeridi — üç kart yan yana; dar ekranda kendiliğinden alt alta.
          Eskiden bunlar tek sütuna dizildiği için sağ kolon uzayıp sol taraf
          boş kalıyordu; artık sayfanın tam genişliğini kullanıyorlar. */}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(17rem,1fr))] gap-5">
        <Panel>
          <PanelHeader title={t.stock.metrics} />
          {/* Yedi ölçü satırı basıyor; yedek beş satır ayırıyordu. */}
          <Suspense fallback={<ListSkeleton rows={7} />}>
            <MetricsCard symbol={symbol} locale={locale} t={t} />
          </Suspense>
        </Panel>

        {/* PANEL VE BAŞLIK KARTIN İÇİNDE. Başlığın sağındaki rozet
            sağlayıcıdan gelen veriden hesaplanıyor, yani başlık akışın
            dışında kalamıyor. Yedek de artık başlık şeridini çiziyor —
            beş satır, kartın gerçekte bastığı kova sayısı. */}
        <Suspense fallback={<PanelSkeleton rows={5} footer />}>
          <AnalystCard symbol={symbol} locale={locale} t={t} />
        </Suspense>

        <Suspense
          fallback={
            <Skeleton className="h-[319px] w-full rounded-(--radius-xl)" />
          }
        >
          <ComplianceCard symbol={symbol} locale={locale} t={t} />
        </Suspense>
      </div>

      {/* Analizler tablonun HEMEN üstünde: tablo çeyreklerin rakamları,
          panel o rakamların okunmuş hâli. Analizi olmayan şirkette hiçbir
          şey basılmaz. Akışta DEĞİL — gerekçesi bileşenin kendi yorumunda. */}
      <SymbolAnalyses rows={analysisRows} locale={locale} t={t} />

      {/* Mercek yazıları analizlerin ALTINDA: analiz bir çeyreğin okunmuş
          hâli ve sayfanın tablosuyla doğrudan bağlı; mercek ise bir olayın
          anlatısı, yani bir adım geride duran bağlam.

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

      {/* Bilanço tablosu tam genişlikte — kolonlar sıkışmadan okunur */}
      {/* Hareketli ortalamalar metrik kartının hemen ardında: ikisi de
          "bu hisse nerede duruyor" sorusunun parçası, biri değerleme
          tarafından biri fiyat tarafından bakıyor. */}
      <Panel>
        <PanelHeader title={t.stock.movingAverages} />
        <Suspense fallback={<ListSkeleton rows={3} />}>
          <MovingAverages symbol={symbol} locale={locale} t={t} />
        </Suspense>
      </Panel>

      <Panel>
        <PanelHeader title={t.stock.pastEarnings} />
        <Suspense fallback={<ListSkeleton rows={6} />}>
          <PastEarnings symbol={symbol} locale={locale} t={t} />
        </Suspense>
      </Panel>

      <Suspense fallback={<Skeleton className="h-48 w-full rounded-(--radius-xl)" />}>
        <PeersCard symbol={symbol} locale={locale} t={t} />
      </Suspense>

      {/* Haberler en altta — mobilde de masaüstünde de son durak */}
      <Panel>
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
    </div>
  );
}

/* ==========================================================================
   Başlık: fiyat + favori yıldızı
   ========================================================================== */

async function StockHeader({
  symbol,
  locale,
  t,
}: {
  symbol: string;
  locale: Locale;
  t: Dictionary;
}) {
  const status = await getStatus();
  const [quoteResult, profileResult, session] = await Promise.all([
    getQuote(symbol, status),
    getCompanyProfile(symbol),
    auth(),
  ]);

  const profile = profileResult.ok ? profileResult.data : null;
  /* Künyedeki sektör, profil panelindekiyle AYNI tercih sırasından geliyor:
     GICS varsa o, yoksa sağlayıcının serbest metinli alanı. */
  const kunyeSektor =
    sectorLabel(indexMemberOf(symbol)?.sector, locale) ??
    industryLabel(profile?.industry, locale);
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

  return (
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex min-w-0 items-start gap-3 sm:items-center sm:gap-4">
        {profile?.logoUrl ? (
          /* Logo ÇERÇEVESİZ ve tam oturur: kenarlık + iç dolgu, logoyu beyaz
             bir kutunun ortasında küçük bir damga gibi gösteriyordu. Artık
             kare kendi köşe yarıçapıyla kırpılıyor, görsel kutuyu tümüyle
             dolduruyor. Beyaz zemin duruyor çünkü logoların çoğu şeffaf PNG
             ve koyu temada kendi koyu harfleriyle kayboluyor. */
          <span className="block size-16 shrink-0 overflow-hidden rounded-(--radius-lg) bg-white">
            <Image
              src={profile.logoUrl}
              alt=""
              width={64}
              height={64}
              className="size-full object-contain"
            />
          </span>
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
            <span className="numeral text-lead font-bold text-soft sm:text-title">
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
          <h1 className="display-ink mt-0.5 text-heading font-bold leading-[1.15] tracking-[-0.03em] sm:text-display">
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
            <p className="mt-1 truncate text-tiny font-semibold uppercase leading-tight tracking-[0.02em] text-muted">
              {kunyeSektor}
            </p>
          )}
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
        <div className="w-full text-left sm:w-auto sm:text-right">
          {/* FİYAT VE DEĞİŞİM AYNI SATIRDA. Değişim satırı fiyatın altına
              iniyordu ve telefonda başlık dört satıra çıkıyordu; oysa ikisi
              tek bir okuma — "şu fiyat, şu kadar değişmiş". Sığmadığında
              kendiliğinden alt satıra iniyor (`flex-wrap`), sığdığında yan
              yana duruyorlar. `items-baseline`: 28 puntoluk fiyat ile 13
              puntoluk değişim taban çizgisinde hizalı. */}
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1.5 sm:justify-end">
          <p className="tote text-subdisplay leading-none tracking-[-0.04em] sm:text-display">
            {formatPrice(quoteResult.data.price, locale, { currency: true })}
          </p>
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "numeral text-sm",
                directionOf(quoteResult.data.change) === "up"
                  ? "text-up"
                  : directionOf(quoteResult.data.change) === "down"
                    ? "text-down"
                    : "text-muted",
              )}
            >
              {formatChange(quoteResult.data.change, locale)}
            </span>
            <ChangePill changePct={quoteResult.data.changePct} locale={locale} />
          </div>
          </div>

          {/* SEANS DIŞINDAKİ FİYAT KENDİNİ SÖYLÜYOR.
              Konsolide tape'e geçtikten sonra açılış öncesi ve kapanış
              sonrası işlemler akıyor (eski IEX beslemesinde hiç akmıyordu),
              yani buradaki sayı artık "dünkü kapanış" değil o dakikanın ön
              seans fiyatı. Ama ekranda bunu söyleyen hiçbir şey yoktu:
              okuyucu seans dışı bir baskıyı normal seans fiyatı sanıyordu.
              Yanındaki önceki kapanış da yüzdenin neye göre hesaplandığını
              görünür kılıyor — aradaki fark elle doğrulanabiliyor. */}
          {(status.session === "pre-market" ||
            status.session === "after-hours") && (
            <p className="mt-2 flex flex-wrap items-center justify-start gap-x-2 gap-y-1 text-tiny sm:justify-end">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-wash px-2.5 py-[3px] font-semibold text-primary-ink">
                <span aria-hidden className="size-1.5 rounded-full bg-current" />
                {status.session === "pre-market"
                  ? t.market.preMarket
                  : t.market.afterHours}
              </span>
              {quoteResult.data.prevClose !== null && (
                <span className="numeral text-muted">
                  {t.market.prevClose}{" "}
                  {formatPrice(quoteResult.data.prevClose, locale, {
                    currency: true,
                  })}
                </span>
              )}
            </p>
          )}

          <DataStamp
            labels={t.data}
            source={quoteResult.source}
            at={quoteResult.fetchedAt}
            stale={quoteResult.stale}
            locale={locale}
            className="mt-1.5 justify-start sm:justify-end"
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
function HeaderSkeleton() {
  return (
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex items-center gap-3">
        <Skeleton className="size-14 shrink-0 rounded-(--radius-lg) sm:size-16" />
        <div className="flex flex-col gap-2">
          <Skeleton className="h-3 w-44" />
          <Skeleton className="h-8 w-28" />
          <Skeleton className="h-3 w-36" />
        </div>
      </div>
      {/* Fiyat bloğu dar ekranda tam genişlik, `md`den itibaren sağa yaslı.
          Gerçek başlıkta kural `sm:w-auto` ama sarma İÇERİK sürüklüyor:
          640 pikselde gerçek başlık hâlâ iki satır (168px), `sm` eşiğinde
          açılan iskelet ise tek satıra düşüp 94px kalıyordu — tam 74
          piksellik bir fark. Eşik ölçüme göre `md`ye çekildi; bütün
          genişliklerde fark 21 pikselin altında. */}
      <div className="w-full md:w-auto">
        <Skeleton className="h-9 w-40 md:ml-auto" />
        <Skeleton className="mt-1.5 h-6 w-32 md:ml-auto" />
        <Skeleton className="mt-2 h-5 w-48 md:ml-auto" />
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
}: {
  symbol: string;
  locale: Locale;
  t: Dictionary;
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
      locale={locale}
      labels={chartLabels(t)}
      closeMinutes={closeMinutesFor(grafikGunu, holidays)}
      quote={
        result.ok
          ? { price: result.data.price, changePct: result.data.changePct }
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
  /** Çeyreğin bittiği tarih — dönem etiketi bunu kullanır (varsa). */
  periodEnd?: string;
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
  let next: EarningsItem | null = await getNextEarnings(symbol);
  if (!next) {
    const today = todayEt();
    next =
      (await symbolEarnings(symbol))
        .filter((row) => row.reportDate >= today)
        .sort((a, b) => a.reportDate.localeCompare(b.reportDate))[0] ?? null;
  }
  if (!next) return null;

  const earningsHourLabel: Record<string, string> = {
    bmo: t.earnings.beforeOpen,
    amc: t.earnings.afterClose,
    dmh: t.earnings.duringMarket,
  };

  return (
    <Panel className="border-primary-faint bg-primary-tint p-4 sm:p-5">
      <p className="plate text-micro">{t.stock.nextEarnings}</p>
      <p className="numeral mt-1.5 text-lg font-bold text-strong">
        {formatEtDateLong(next.reportDate, locale)}
      </p>
      <p className="mt-0.5 text-xs text-soft">
        {next.hour
          ? (earningsHourLabel[next.hour] ?? t.earnings.timeUnknown)
          : t.earnings.timeUnknown}
      </p>
      {(next.epsEstimate !== null || next.revenueEstimate !== null) && (
        <dl className="mt-3 grid grid-cols-2 gap-3 border-t border-line-soft pt-3">
          {next.epsEstimate !== null && (
            <div>
              <dt className="text-nano uppercase tracking-wider text-muted">
                {t.earnings.epsEstimate}
              </dt>
              <dd className="numeral mt-0.5 text-sm font-semibold text-strong">
                {formatPrice(next.epsEstimate, locale, { currency: paraOpt })}
              </dd>
            </div>
          )}
          {next.revenueEstimate !== null && (
            <div>
              <dt className="text-nano uppercase tracking-wider text-muted">
                {t.earnings.revenueEstimate}
              </dt>
              <dd className="numeral mt-0.5 text-sm font-semibold text-strong">
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
    </Panel>
  );
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
  const [barsResult, quoteResult] = await Promise.all([
    getChartBars(symbol, "1Y", status),
    getQuote(symbol, status),
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

  return (
    <div className="px-4 py-3 sm:px-5">
      <dl className="divide-y divide-line-soft">
        {satirlar.map(({ pencere, deger }) => {
          /* Fark yalnızca İKİSİ de varken yazılıyor; ortalama yoksa fiyatla
             kıyaslanacak bir şey de yok. */
          const fark =
            deger !== null && price !== null && deger > 0
              ? ((price - deger) / deger) * 100
              : null;
          const ton = directionOf(fark);
          return (
            <div
              key={pencere}
              className="flex items-center justify-between gap-3 py-2"
            >
              <dt className="text-xs font-semibold text-strong">
                {t.stock.movingAverageRow.replace("{n}", String(pencere))}
              </dt>
              <dd className="flex items-baseline gap-2.5">
                <span className="numeral text-sm text-body">
                  {deger !== null
                    ? formatPrice(deger, locale, { currency: true })
                    : "—"}
                </span>
                {fark !== null && (
                  <span
                    className={cn(
                      "numeral shrink-0 text-tiny font-semibold",
                      directionText(ton),
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
      <p className="mt-2 border-t border-line-soft pt-2.5 text-small text-muted">
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
  const [result, meta, quoteForCap] = await Promise.all([
    getCompanyProfile(symbol),
    getSymbolNames([symbol]),
    getQuote(symbol, status),
  ]);
  if (!result.ok) {
    return <DataError message={t.data.failed} hint={t.data.failedHint} />;
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
  const marketCap =
    liveMarketCap(meta[symbol], quoteForCap.ok ? quoteForCap.data.price : null) ??
    (profile.currency === "USD" ? profile.marketCap : null);
  const member = indexMemberOf(symbol);
  const about = await describeSymbol(symbol, locale);
  const websiteHref = safeExternalUrl(profile.weburl);

  const rows: [string, React.ReactNode][] = [
    // GICS sınıflandırması varsa o gösterilir — sağlayıcının serbest metinli
    // sektör alanından daha tutarlıdır.
    [
      t.stock.sector,
      sectorLabel(member?.sector, locale) ??
        industryLabel(profile.industry, locale) ??
        "—",
    ],
    ...(member?.sub
      ? ([[t.stock.industry, subIndustryName(member.sub, locale)]] as [
          string,
          React.ReactNode,
        ][])
      : []),
    [t.stock.exchange, profile.exchange ?? "—"],
    [
      t.market.marketCap,
      marketCap ? (
        <span className="numeral">{formatMoneyCompact(marketCap, locale)}</span>
      ) : (
        "—"
      ),
    ],
    [
      t.stock.ipoDate,
      profile.ipoDate ? (
        <span className="numeral">
          {formatEtDateShort(profile.ipoDate, locale)}
        </span>
      ) : (
        "—"
      ),
    ],
  ];

  return (
    <div className="flex flex-1 flex-col px-4 py-3 sm:px-5">
      {/* Şirket ne iş yapar — sektör satırından önce düz cümleyle anlatılır */}
      {about && (
        <p className="border-b border-line-soft pb-3 text-base leading-relaxed text-body">
          {about}
        </p>
      )}
      {/* Satırlar artan yere yayılır: kart grafiğin boyuna gerildiğinde
          altta ölü boşluk yerine nefes alan bir liste kalıyor. İçerik
          kartı zaten dolduruyorsa `justify-between`in etkisi olmuyor. */}
      <dl className="flex flex-1 flex-col justify-between divide-y divide-line-soft">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between gap-3 py-2">
            <dt className="text-xs font-semibold text-strong">{label}</dt>
            <dd className="text-right text-sm text-body">{value}</dd>
          </div>
        ))}
        {/* Adres sağlayıcıdan geliyor; şeması süzülmeden href'e konmaz. */}
        {websiteHref && (
          <div className="flex items-center justify-between gap-3 py-2">
            <dt className="text-xs font-semibold text-strong">{t.stock.website}</dt>
            <dd className="min-w-0 text-right text-sm">
              <a
                href={websiteHref}
                target="_blank"
                rel="noopener noreferrer"
                className="tap-44 -my-2 block min-h-8 truncate py-2 text-primary hover:underline"
              >
                {websiteHref.replace(/^https?:\/\/(www\.)?/, "")}
              </a>
            </dd>
          </div>
        )}
      </dl>
      <DataStamp
        labels={t.data}
        source={result.source}
        at={result.fetchedAt}
        stale={result.stale}
        locale={locale}
        className="mt-2"
      />
    </div>
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
        : "—",
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
        : "—",
    ],
    [t.stock.beta, m.beta ? formatPrice(m.beta, locale) : "—"],
    [
      t.stock.high52,
      hisseBasi(m.high52)
        ? formatPrice(m.high52, locale, { currency: currency ?? true })
        : "—",
    ],
    [
      t.stock.low52,
      hisseBasi(m.low52)
        ? formatPrice(m.low52, locale, { currency: currency ?? true })
        : "—",
    ],
    [t.market.volume, quote?.volume ? formatVolume(quote.volume, locale) : "—"],
  ];

  return (
    <div className="px-4 py-3 sm:px-5">
      <dl className="divide-y divide-line-soft">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between gap-3 py-2">
            <dt className="text-xs font-semibold text-strong">{label}</dt>
            <dd className="numeral text-sm text-body">{value}</dd>
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
    <Panel>
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
    { label: t.stock.strongBuy, value: latest.strongBuy, cls: "bg-up" },
    { label: t.stock.buy, value: latest.buy, cls: "bg-up/60" },
    { label: t.stock.hold, value: latest.hold, cls: "bg-flat" },
    { label: t.stock.sell, value: latest.sell, cls: "bg-down/60" },
    { label: t.stock.strongSell, value: latest.strongSell, cls: "bg-down" },
  ];

  /* KART KOMŞUSUNUN RİTMİNE OTURUYOR.
     Beş etiket iki sütuna diziliyordu ve üç satır tutuyordu; kart, üçlü
     ızgarada yanındaki Anahtar Metrikler (yedi satır) ve Katılım Taraması
     kadar uzuyor ama içeriği o boyun yarısını bile doldurmuyordu — panelin
     alt yarısı boştu. Aynı veri tek sütunda, komşu kartla AYNI satır
     düzeninde (`divide-y divide-line-soft`, `py-2.5`) beş satır tutuyor ve
     boşluk kendiliğinden kapanıyor. Yeni bilgi eklenmedi; eklenen tek şey
     payın yüzdesi, o da çubuğun zaten çizdiği oranın sayısı.

     BURAYA DAHA FAZLASI EKLENMEZ. Finnhub `/stock/recommendation` dört
     aylık anlık görüntü döndürüyor ve kart yalnızca ilkini çiziyor; kalan
     üçüyle bir trend merdiveni çizmek ilk bakışta bu boşluğun doğal cevabı
     gibi duruyor. Ölçüldü, değil: üç kart `repeat(auto-fit,minmax(17rem,1fr))`
     ızgarasında AYNI satırda ve satırın boyu en uzun karta göre kuruluyor.
     Bu düzenden sonra AAPL'de üçü de 346 piksel ve analist kartının içeriği
     345'te bitiyor — yani satırın boyunu artık BU kart belirliyor. Merdiven
     (~90px) eklenirse satır uzuyor ve boşluk komşu iki kartın altında
     yeniden açılıyor; bir kartın sorunu iki karta dağıtılmış oluyor. Aynı
     gerekçe kaynak damgası ve "alım tarafı payı" manşeti için de geçerli. */
  return (
    <Panel>
      <PanelHeader
        title={t.stock.analysts}
        /* ROZET BAŞLIĞIN SAĞINDA. Sayı bir süre dip künyesinde durdu ve
           orada künyenin ilk kelimesiydi: kartın tek cümlelik cevabı, en son
           okunan satırda kalıyordu. Başlığın yanında ilk bakışta okunuyor.
           Yeşil, altındaki çubuğun yeşil kısmının payı olduğu için — rozet
           o oranın sayısı, ayrı bir hüküm değil. Renk tek taşıyıcı da değil:
           yön kelimesi rozetin içinde yazılı. */
        action={
          <span className="numeral shrink-0 whitespace-nowrap rounded-full bg-up-wash px-2 py-0.5 text-tiny font-bold text-up">
            {formatPercentPlain((alimTarafi / total) * 100, locale, 0)}{" "}
            {t.stock.analystLeaning}
          </span>
        }
      />
      <div className="px-4 pb-3 sm:px-5">
      {/* Çubuk ARIA'dan gizli: altındaki liste aynı veriyi zaten okunabilir
          hâlde taşıyor, ikisi birden okununca sayılar iki kez geçiyordu.
          Dilim sınırını renk değil boşluk çiziyor — komşu basamaklar aynı
          renk ailesinden ve kontrast ayırmaya yetmiyor. */}
      <div
        aria-hidden
        className="flex h-3 w-full gap-[2px] overflow-hidden rounded-full"
      >
        {segments.map(
          (segment) =>
            segment.value > 0 && (
              <span
                key={segment.label}
                className={cn("block h-full", segment.cls)}
                style={{ width: `${(segment.value / total) * 100}%` }}
              />
            ),
        )}
      </div>
      <dl className="mt-3 divide-y divide-line-soft border-t border-line-soft">
        {segments.map((segment) => (
          <div key={segment.label} className="flex items-center gap-3 py-2.5">
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
            <dd className="numeral hidden w-11 shrink-0 text-right text-tiny text-muted sm:block">
              {formatPercentPlain((segment.value / total) * 100, locale, 0)}
            </dd>
          </div>
        ))}
      </dl>
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
      <p className="numeral mt-2 border-t border-line-soft pt-2.5 text-small text-muted">
        {total} {plural(total, t.stock.analystOne, t.stock.analystMany)} ·{" "}
        {new Intl.DateTimeFormat(locale === "tr" ? "tr-TR" : "en-US", {
          month: "long",
          year: "numeric",
          timeZone: "UTC",
        }).format(new Date(`${latest.period}T12:00:00Z`))}
      </p>
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
}: {
  symbol: string;
  locale: Locale;
  t: Dictionary;
}) {
  const today = todayEt();
  /* Bu tablo bir dönem koşulsuz dolar basıyordu — gerekçe `paraSecenegi`de. */
  const paraOpt = await paraSecenegi(symbol);

  // Takvim satırları (yerel tablo, yoksa sağlayıcı) — gelir alanlarını taşır.
  let calRows: EarningsItem[] = (await getEarningsForSymbol(symbol, 12)).filter(
    (row) => row.reportDate < today || row.epsActual !== null,
  );
  if (calRows.length === 0) {
    calRows = (await symbolEarnings(symbol)).filter(
      (row) => row.reportDate < today || row.epsActual !== null,
    );
  }

  /* Kanonik EPS kaynağı earnings surprises'tır: çeyrek başına TEK kayıt ve
     rapor günündeki nihai beklentiyi taşır. Takvim beslemesi aynı çeyrek için
     revizyon kopyaları düşürebiliyor (AAPL'da iki farklı beklenti görüldü) —
     bu yüzden takvim yalnızca gelir/rapor-tarihi zenginleştirmesi yapar. */
  let rows: EarningsItem[];
  const surprises = await getEarningsSurprises(symbol);
  if (surprises.ok) {
    rows = surprises.data.map((s) => {
      const periodMs = new Date(`${s.period}T12:00:00Z`).getTime();
      // Rapor, çeyrek bitiminden ~2-10 hafta sonra gelir; o penceredeki takvim
      // kaydı bu çeyreğe aittir.
      const cal = calRows.find((row) => {
        const diffDays =
          (new Date(`${row.reportDate}T12:00:00Z`).getTime() - periodMs) /
          86400000;
        return diffDays > 0 && diffDays <= 100;
      });
      return {
        reportDate: cal?.reportDate ?? s.period,
        hour: cal?.hour ?? null,
        epsEstimate: s.epsEstimate,
        epsActual: s.epsActual,
        revenueEstimate: cal?.revenueEstimate ?? null,
        revenueActual: cal?.revenueActual ?? null,
        quarter: s.quarter,
        year: s.year,
        periodEnd: s.period,
      };
    });
  } else {
    // Surprises yoksa takvimden devam: aynı güne düşen kopyaları tekille.
    const byDate = new Map<string, EarningsItem>();
    for (const row of calRows) {
      const current = byDate.get(row.reportDate);
      if (!current || (row.epsActual !== null && current.epsActual === null)) {
        byDate.set(row.reportDate, row);
      }
    }
    rows = [...byDate.values()];
  }
  rows.sort((a, b) => b.reportDate.localeCompare(a.reportDate));

  if (rows.length === 0) {
    return <EmptyState title={t.common.noData} />;
  }

  // Dönem etiketi çeyreğin bittiği ayı söyler — mali yıl etiketleri (ör.
  // NVDA'nın FY2027'si) okuyucuyu yanıltır, ay+yıl yanıltmaz.
  const periodLabel = new Intl.DateTimeFormat(
    locale === "tr" ? "tr-TR" : "en-US",
    { month: "short", year: "numeric", timeZone: "UTC" },
  );

  const hasRevenue = rows.some(
    (row) => row.revenueActual !== null || row.revenueEstimate !== null,
  );

  return (
    <div>
      {/* Tablo dar ekranda kendi kabında kayar — sayfa yana kaymaz.
          KAP KLAVYEYLE ODAKLANABİLİR: 560px'lik tablo 352px'lik kapta kayıyor
          ve `tabindex` olmadan sağdaki sütunlara fare olmadan ulaşılamıyordu
          (WCAG 2.1.1). */}
      <div
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
          <tr className="border-b border-line-soft text-left text-nano uppercase tracking-wider text-muted">
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
          {rows.slice(0, 8).map((row) => {
            const surprise =
              row.epsActual !== null &&
              row.epsEstimate !== null &&
              row.epsEstimate !== 0
                ? ((row.epsActual - row.epsEstimate) /
                    Math.abs(row.epsEstimate)) *
                  100
                : null;
            return (
              <tr key={row.reportDate}>
                <td className="px-4 py-2.5 sm:px-5">
                  <span className="numeral block whitespace-nowrap text-sm font-semibold text-strong">
                    {periodLabel.format(
                      new Date(`${row.periodEnd ?? row.reportDate}T12:00:00Z`),
                    )}
                  </span>
                  <span className="numeral block text-tiny text-muted md:hidden">
                    {formatEtDateShort(row.reportDate, locale)}
                  </span>
                </td>
                <td className="numeral hidden px-3 py-2.5 text-sm text-body md:table-cell">
                  {formatEtDateShort(row.reportDate, locale)}
                </td>
                <td className="px-2 py-2.5 text-center sm:px-3">
                  {surprise !== null ? (
                    <ChangePill changePct={surprise} locale={locale} size="sm" />
                  ) : (
                    <span className="text-xs text-muted">—</span>
                  )}
                </td>
                <td className="numeral px-2 py-2.5 text-center text-muted sm:px-3">
                  {row.epsEstimate !== null
                    ? formatPrice(row.epsEstimate, locale, {
                        currency: paraOpt,
                      })
                    : "—"}
                </td>
                <td className="numeral px-2 py-2.5 text-center font-semibold text-strong sm:px-3">
                  {row.epsActual !== null
                    ? formatPrice(row.epsActual, locale, { currency: paraOpt })
                    : "—"}
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
                        : "—"}
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
                        "—"
                      )}
                    </td>
                  </>
                )}
              </tr>
            );
          })}
        </tbody>
        </table>
      </div>

      {/* Tablo kısaltmalarının karşılığı — EPS ne demek, sapma neye göre.
          Rakamı okuyanın sözlüğe gitmesi gerekmesin. */}
      <p className="mt-3 border-t border-line-soft px-4 pt-3 text-small leading-relaxed text-muted sm:px-5">
        <b className="font-semibold text-soft">{t.earnings.epsFull}</b>{" "}
        {t.earnings.epsExplainer}
      </p>
    </div>
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
    <Panel>
      <PanelHeader title={t.stock.compliance} />
      <div className="px-4 py-4 sm:px-5">
        <span
          className={cn(
            "inline-flex rounded-full px-3 py-1 text-xs font-semibold",
            verdictClass,
          )}
        >
          {verdictLabel}
        </span>

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
          <dl className="mt-3 flex flex-col gap-2.5">
            {ratios.map(([label, value]) => {
              const over = value !== null && value >= COMPLIANCE_THRESHOLD;
              const width =
                value === null
                  ? 0
                  : Math.min((value / COMPLIANCE_THRESHOLD) * 100, 100);
              return (
                <div key={label}>
                  <div className="flex items-baseline justify-between gap-2">
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
                        : "—"}
                    </dd>
                  </div>
                  {/* Eşiğe ne kadar yakın — çubuk %33'te dolar */}
                  <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-surface-sunken">
                    <div
                      className={cn("h-full", over ? "bg-down" : "bg-up")}
                      style={{ width: `${width}%` }}
                    />
                  </div>
                </div>
              );
            })}
            <p className="numeral text-nano text-muted">
              {/* Yüzde işareti biçimlendiriciye ait — kartın 18 satır
                  yukarısındaki kural bunu açıkça yazıyor ve oranların
                  kendisi ona uyuyor. Sınır satırı atlanmıştı: elden yazılan
                  "%" iki dilde de önde kalıyordu, oysa İngilizcede sonda
                  yazılır ("33%"). `digits: 0` şart — varsayılan 1 olduğu için
                  argümansız çağrı "%33,0" basardı. */}
              {t.stock.complianceLimit}:{" "}
              {formatPercentPlain(COMPLIANCE_THRESHOLD, locale, 0)}
            </p>
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

        <p className="mt-3 border-t border-line-soft pt-2.5 text-nano leading-relaxed text-muted">
          {t.stock.complianceMissing}
        </p>
        <p className="mt-1.5 text-nano leading-relaxed text-muted">
          {t.stock.complianceDisclaimer}
        </p>
      </div>
    </Panel>
  );
}

/**
 * Aynı alt sektördeki şirketler — piyasa değerine göre en büyük sekiz isim,
 * sayfanın tam genişliğinde kart ızgarası olarak. Sınıflandırma GICS'ten
 * gelir; fiyatlar canlı. Aynı şirketin ikinci hisse sınıfı listeye girmez.
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

  const meta = await getSymbolNames(peers.map((peer) => peer.symbol));
  const ranked = [...peers]
    .sort(
      (a, b) =>
        (meta[b.symbol]?.marketCap ?? 0) - (meta[a.symbol]?.marketCap ?? 0),
    )
    .slice(0, 8);

  const status = await getStatus();
  const result = await getQuotes(
    ranked.map((peer) => peer.symbol),
    status,
  );
  const quotes = result.ok ? result.data : {};

  /* Karşılaştırma bağlantısı buraya konuyor çünkü soru tam burada doğuyor:
     benzer dört şirketi yan yana gören biri "hangisi" diye sorar. Sembol
     listesi bu hissenin kendisiyle başlar ve en büyük üç rakiple dolar. */
  const compareSymbols = [symbol, ...ranked.map((peer) => peer.symbol)]
    .filter((entry, index, list) => list.indexOf(entry) === index)
    .slice(0, 4);

  return (
    <Panel>
      <PanelHeader
        title={t.stock.peers}
        action={
          <PanelLink href={`/karsilastir?semboller=${compareSymbols.join(",")}`}>
            {t.compare.addCta} →
          </PanelLink>
        }
      />
      {member?.sub && (
        <p className="border-b border-line-soft px-4 py-2 text-tiny text-muted sm:px-5">
          {t.stock.peersHint}:{" "}
          <span className="text-soft">
            {subIndustryName(member.sub, locale)}
          </span>
        </p>
      )}
      <ul className="grid grid-cols-2 gap-2.5 p-4 lg:grid-cols-4 sm:px-5">
        {ranked.map((peer) => {
          const quote = quotes[peer.symbol];
          return (
            <li key={peer.symbol} className="min-w-0">
              <Link
                href={`/hisse/${peer.symbol}`}
                className="flex h-full flex-col justify-between gap-2.5 rounded-(--radius-lg) border border-line-soft bg-surface-elevated px-3.5 py-3 transition-colors hover:border-line-strong hover:bg-primary-tint"
              >
                <span className="min-w-0">
                  <span className="numeral block text-sm font-bold text-strong">
                    {peer.symbol}
                  </span>
                  <span className="mt-0.5 block truncate text-tiny text-muted">
                    {peer.name}
                  </span>
                </span>
                {quote ? (
                  <span className="flex flex-wrap items-center justify-between gap-1.5">
                    {/* Fiyat sembolle AYNI PUNTODAYDI (ikisi de 14px) ve
                        127 piksellik kartta hangisinin kimlik hangisinin ölçü
                        olduğu okunmuyordu. Bir punto inince yer de açıldı ve
                        para birimi geri kondu: sayfadaki başka her fiyatta
                        "$" varken bu sekiz fiyatta yoktu. */}
                    <span className="numeral text-tiny text-body">
                      {formatPrice(quote.price, locale, { currency: true })}
                    </span>
                    <ChangePill
                      changePct={quote.changePct}
                      locale={locale}
                      size="sm"
                    />
                  </span>
                ) : (
                  <span className="text-xs text-muted">—</span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
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

  const shown = result.data.slice(0, 8);

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
  const [genericImages, meta] = await Promise.all([
    getGenericImageUrls(shown.map((item) => item.imageUrl)),
    // Görseli olmayan haber şirketin logosunu alır — bu listede hepsi aynı
    // şirketin haberi, o yüzden tek sembol yetiyor.
    getSymbolNames([symbol]),
  ]);
  const logoUrl = meta[symbol]?.logoUrl ?? null;

  return (
    <ul className="divide-y divide-line-soft">
      {shown.map((item) => {
        const newsId = idByProvider.get(item.providerId);
        const inner = (
          <span className="flex items-start gap-3">
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
                <span>{timeAgo(item.publishedAt, locale)}</span>
              </span>
            </span>
            <NewsImage
              src={
                item.imageUrl && !genericImages.has(item.imageUrl)
                  ? item.imageUrl
                  : null
              }
              /* Bu liste şirketin kendi beslemesinden geliyor ama besleme
                 ara ara genel piyasa yazıları da döndürüyor; logo yalnızca
                 başlıkta şirket geçiyorsa konur. */
              logoUrl={
                headlineMentions(item.headline, symbol, meta[symbol]?.name)
                  ? logoUrl
                  : null
              }
              sizeClass="size-14"
            />
          </span>
        );
        // Kaynak adresi sağlayıcıdan; şeması süzülmezse href'e konmaz.
        const sourceHref = safeExternalUrl(item.url);
        return (
          <li key={item.providerId}>
            {newsId ? (
              <Link
                href={`/haberler/${newsId}`}
                className="block px-4 py-3 transition-colors hover:bg-primary-tint sm:px-5"
              >
                {inner}
              </Link>
            ) : sourceHref ? (
              <a
                href={sourceHref}
                target="_blank"
                rel="noopener noreferrer"
                className="block px-4 py-3 transition-colors hover:bg-surface-elevated sm:px-5"
              >
                {inner}
              </a>
            ) : (
              <div className="block px-4 py-3 sm:px-5">{inner}</div>
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
