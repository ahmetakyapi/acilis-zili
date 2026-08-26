import { Suspense } from "react";
import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { auth } from "@/auth";
import { GlyphTile } from "@/components/article/GlyphTile";
import { NewsImage } from "@/components/news/NewsImage";
import { BriefBody } from "@/components/today/BriefBody";
import { BriefSwitch, type BriefView } from "@/components/today/BriefSwitch";
import { Countdown } from "@/components/today/Countdown";
import { DayRail, type RailEvent } from "@/components/today/DayRail";
import { SessionRefresh } from "@/components/today/SessionRefresh";
import { AnalysisBadge } from "@/components/earnings/AnalysisBadge";
import { LiveClock } from "@/components/today/LiveClock";
import {
  DataError,
  DataStamp,
  EmptyState,
  ImpactDot,
  Panel,
  PanelHeader,
  PanelLink,
  PercentReading,
  Skeleton,
  TimingChip,
  LogoTile,
  ButtonLink,
  PanelSkeleton,
} from "@/components/ui/primitives";
import {
  BRIEF_PUBLISH_TR,
  getAnalyses,
  getAnalysisBadges,
  getEventsBetween,
  getGenericImageUrls,
  getLatestBrief,
  getLatestNews,
  getMacroRows,
  getStatus,
  getStories,
  getStoryBySlug,
  getSymbolNames,
  getTodayEvents,
  getEarningsBetween,
  getUserSymbols,
  weekAnchor,
} from "@/lib/data";
import {
  SESSION_BOUNDS,
  addEtDays,
  etParts,
  todayEt,
  type MarketStatus,
} from "@/lib/market-hours";
import {
  displayOffsets,
  timePair,
  zoneTag,
} from "@/lib/session-clock";
import { FillColumn } from "@/components/today/FillColumn";
import { getQuotes } from "@/lib/providers";
import { isSpotlight } from "@/lib/spotlight";
import { INDEX_STRIP, WORLD_MARKETS } from "@/db/seed/symbols";
import { ALL_MEMBERS, primaryOnly } from "@/db/seed/indices";
import { getI18n, type Dictionary, type Locale } from "@/lib/i18n";
import {
  analysisHref,
  verdictLabel,
  verdictOf,
  verdictPillClass,
} from "@/lib/analysis";
import {
  cn,
  directionOf,
  directionText,
  formatEtDateLong,
  formatEtDateCompact,
  formatEtDateShort,
  formatPercent,
  formatEventValue,
  formatPercentPlain,
  formatPeriodLabel,
  formatPrice,
  headlineMentions,
  timeAgo,
} from "@/lib/utils";
import { Sparkline } from "@/components/ui/Sparkline";
import {
  StoryFigure,
  storyFigureOf,
} from "@/components/stories/StoryFigure";
import { getChartBarsMulti } from "@/lib/providers";
import { getSeries } from "@/lib/providers/fred";
import { VIX_SERIES, vixBand } from "@/components/markets/FearGauge";

import { pageMetadata } from "@/lib/page-meta";

/* Canonical yalnızca BURADA. Kökte durduğu sürece bütün alt sayfalara miras
   kalıyor ve hepsi arama motoruna "asıl adresim ana sayfa" diyordu; gerekçe
   `app/layout.tsx` içindeki `alternates` yorumunda. Başlık ve açıklama
   köktekilerden miras alınmaya devam ediyor — ana sayfa için doğru olan
   zaten onlar.

   `pageAlternates` üzerinden yazılıyor: `alternates` derin birleşmediği için
   elle yazılan bir canonical, kökteki RSS keşif etiketini sessizce
   siliyordu. */
export const generateMetadata = pageMetadata({
  path: "/",
  absoluteTitle: true,
  tr: {
    title: "Açılış Zili — ABD Piyasa Takibi",
    description:
      "ABD borsalarında bugün ne var: ekonomik takvim, bilanço tarihleri, haberler ve favori hisselerin tek ekranda — saatleriyle birlikte.",
  },
  en: {
    title: "Opening Bell — US Market Tracker",
    description:
      "What's happening in US markets today: economic calendar, earnings dates, news and your watchlist on one screen — with the times.",
  },
});

export default async function TodayPage() {
  const { locale, t } = await getI18n();
  const status = await getStatus();

  const sessionLabel: Record<string, string> = {
    regular: t.market.open,
    "pre-market": t.market.preMarket,
    "after-hours": t.market.afterHours,
    closed: status.holiday
      ? t.market.holiday
      : status.isWeekend
        ? t.market.weekend
        : t.market.closed,
  };

  const trading = status.session === "regular";
  const countdownTarget = trading ? status.nextClose : status.nextOpen;
  const countdownLabel = trading ? t.today.untilClose : t.today.untilBell;

  return (
    /* IZGARA ÜÇ PARÇALI: ana kolon, yan kolon ve altlarında tam genişlik
       haber bandı.

       DÖRT PARÇAYDI ve sol kolonun kuyruğu çok uzundu: analizler ve haberler
       de birinci sütunda, ana yığının altında duruyordu. Yan kolon sayfanın
       üçte birinde bitiyor, kalan iki bin piksel boyunca sağ taraf boş
       kalıyordu — ekranın üçte biri hiçbir şey söylemeyen bir oluktu.

       Şimdi analizler yan kolona geçti (orası bir gösterge tablosu ve analiz
       de bir ölçüm okuması), haberler ise iki kolonun ALTINA, tam genişliğe
       indi. İki kolon böylece boyca eşitlendi ve haber bandı sayfanın kendi
       kapanışı oldu. */
    <div className="grid gap-x-6 gap-y-5 lg:grid-cols-[minmax(0,1fr)_376px]">
      {/* Seans sınırında sayfa kendini tazeler. Hiçbir şey çizmez, ızgarada yer
          kaplamaz. Geri sayım sıfıra inince orada kilitleniyor ve yeni güne
          ancak elle yenilemeyle geçiliyordu; gerekçenin tamamı bileşende. */}
      <SessionRefresh atIso={status.nextTransition.toISOString()} />

      {/* ================= Ana kolon =================
          `justify-between` KALKTI ve bu bir hata düzeltmesi. İki kolon da
          onu taşıyordu; ızgara satırı iki kolonu aynı yüksekliğe geriyor ve
          KISA olan kolon, aradaki farkı panel aralarına dağıtıyordu. Yani
          panellerin arasındaki boşluk kendi ölçüsü değil, ÖTEKİ KOLONUN
          boyu tarafından belirleniyordu: sağ kolon kısayken oradaki
          aralıklar 20 pikselden 92'ye çıkıyordu, sol kolon kısaldığında bu
          kez geri sayımla "Bugünün Akışı" arası 35 piksele açılıyordu ve
          okuyucunun gördüğü şey "sayfanın başında sebepsiz bir boşluk"
          oluyordu. Aralık artık her zaman `gap-5`; kısa kolon erken bitiyor
          ve iki sütunlu bir düzende olması gereken de bu. */}
      <div
        data-col="main"
        className="flex min-w-0 flex-col gap-5 lg:col-start-1 lg:row-start-1"
      >
        {/* ---- Oturum rozeti + tarih ---- */}
        <header>
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-2">
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-[11px] py-1 text-tiny font-semibold",
                trading
                  ? "bg-up-wash text-up"
                  : status.session === "closed"
                    ? "bg-surface-elevated text-body"
                    : "bg-primary-wash text-primary-ink",
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "size-1.5 rounded-full bg-current",
                  trading && "pulse-live",
                )}
              />
              {sessionLabel[status.session]}
            </span>
            {/* Tarih 13px sessiz gövdeydi ve yanındaki rozetle saatin
                arasında üçüncü bir ağırlık gibi duruyordu; oysa "bugün hangi
                gün" bu şeridin ana bilgisi. Yarı kalın koyu mürekkebe çıktı,
                rozet ve saat ise künye kaldı. */}
            {/* TARİH NEW YORK TAKVİMİNDEN ve bu artık yazıyor.
                Yanındaki saat Türkçe okuyanda İstanbul'u gösteriyor; Türkiye
                saatiyle gece yarısı ile sabah 07:00 arasında ikisi BİR GÜN
                ayrışıyor ve ekranda "11 Ağustos Salı · 02:14 TR" gibi kendi
                kendisiyle çelişen bir satır kalıyordu. Künye, hangi takvimin
                konuştuğunu söylüyor — saatlerin yanındaki TR/NY künyesiyle
                aynı dil. */}
            <span className="flex items-baseline gap-1 text-base font-semibold text-strong">
              {formatEtDateLong(status.etDate, locale)}
              <span className="text-nano font-bold tracking-[0.06em] text-muted">
                NY
              </span>
            </span>
            <LiveClock locale={locale} />
          </div>

          {/* Sayfanın en büyük sayısı — zil geri sayımı.
              Bu satır aynı zamanda sayfanın H1'i: ana sayfada hiç `h1` yoktu
              (denetimde çıktı), ekran okuyucu ve arama motoru için sayfa
              başlıksız görünüyordu. Geri sayım + "Açılış Ziline Kaldı"
              zaten sayfanın ne anlattığını söyleyen cümle; görünüm
              değişmiyor, yalnızca etiket doğru olanla değişti. */}
          {/* H1 KONUYU DA SÖYLÜYOR. Sitenin en değerli sayfasının tek
              başlığı geri sayımdan ibaretti: taranan HTML'de "5 sa 42 dk
              11 sn Açılış Ziline Kaldı" gibi, sayfanın ne hakkında olduğunu
              hiç söylemeyen ve her istekte değişen bir metin duruyordu.
              Görsel düzen aynı kalsın diye ad ekranda değil, yalnızca
              erişilebilirlik ağacında ve tarayıcıda. */}
          <h1 className="mt-3.5 flex flex-wrap items-end gap-3.5">
            <span className="sr-only">{t.today.pageHeading}</span>
            <Countdown
              targetIso={countdownTarget.toISOString()}
              units={{
                d: t.today.unitD,
                h: t.today.unitH,
                m: t.today.unitM,
                s: t.today.unitS,
              }}
              className="tote display-ink text-[44px] leading-none sm:text-[66px]"
            />
            {/* Etiket sözlükteki hâliyle basılır. Bir süre burada
                `toLocaleLowerCase` vardı ve sözlükte Title Case yazan metni
                ekranda küçültüyordu — sayfanın H1'i "açılış ziline kaldı"
                diye okunuyordu. Vurgu taşıyan metin Title Case yazılır ve
                bundan büyük vurgulu bir yer yok. */}
            <span className="pb-1.5 text-base font-normal text-body sm:pb-2.5 sm:text-read">
              {countdownLabel}
            </span>
          </h1>
        </header>

        {/* ---- Gün Şeridi ---- */}
        <Panel className="px-4 py-5 sm:px-5">
          {/* Şeridin kapsadığı pencere ("11:00 — 03:00 TR") burada, başlığın
              sağında duruyordu. Aynı iki saat artık eksenin kendi uçlarında
              yazılı — okuyucu "bu çizginin solu hangi saat" diye sorduğunda
              cevabın ekranın öbür ucunda olması gerekmiyor. */}
          <h2 className="display-ink display-ink-tight mb-5 w-fit text-read font-bold">
            {t.today.todayFlow}
          </h2>
          <Suspense fallback={<Skeleton className="h-28 w-full" />}>
            <RailSection
              t={t}
              locale={locale}
              status={{
                /* `!isWeekend && !holiday` diye hesaplanıyordu ve yarım
                   günleri tatil sayıyordu — gerekçe `tradingToday`
                   alanının üstünde. */
                trading: status.session !== "closed" || status.tradingToday,
                closeMinutes: status.closeMinutes,
                nowMinutes: status.etMinutes,
              }}
            />
          </Suspense>
        </Panel>

        {/* Ön seans / akşam seansı hareketleri BURADAN KALKTI. Panel
             yalnızca o iki pencerede basılıyordu ve seans açıkken ana
             sayfada tek bir hissenin bugün ne yaptığını gösteren hiçbir şey
             kalmıyordu. Şimdi yan kolonda, her seansta ve seansa göre
             başlık değiştirerek duruyor (`DayMovers`) — gerekçesi orada. */}

        {/* ---- Günün özeti — ana kolonda, günü okumaya buradan başlanıyor ---- */}
        {/* SUSPENSE YOK — bilerek, ve gerekçesi ölçülü.
            Günün özeti ekranın en üstündeki en uzun blok: mobilde 1245,
            geniş ekranda 672 piksel. Boyu her gün metinle birlikte
            değiştiği için hiçbir sabit yer tutucu doğru olamıyordu; eski
            yedek 214 piksel ayırıyor, kart akışla gelince altındaki her şeyi
            bin piksel aşağı itiyordu — ana sayfanın mobil CLS'i tek başına
            bundan 0,232 çıkıyordu.
            Karşılığı bedava değil: sayfa artık iki veritabanı okumasını
            (`getLatestBrief`, günlük ve haftalık) kabuğu basmadan önce
            bekliyor ve TTFB 113 ms'den 178 ms'ye çıkıyor — ölçüldü, altı
            koşumun ortancası. Takas bilinçli: 65 milisaniye görünmez,
            bin piksellik sıçrama değil. Sağlayıcıya giden paneller akışta
            kalmaya devam ediyor; beklenen tek şey yerel veritabanı. */}
        <BriefCard locale={locale} t={t} />

        {/* ---- Mercek ----
             SAYFANIN EN ÜST ÜÇTE BİRİNDE, çünkü sitenin başka hiçbir yerde
             bulunmayan içeriği bu. Uzun süre en altta, "son yazılanlar"
             ızgarasının sağ yarısında dört satırlık bir liste olarak
             duruyordu: ana sayfayı açan okuyucu ölçüleri, takvimi,
             bilançoları ve haberleri geçtikten SONRA görüyordu onu — yani
             çoğu hiç görmüyordu. Takvim ve bilanço listeleri her sitede var,
             bu yazılar yalnızca burada.

             Günün özetinin hemen ardında duruyor: ikisi de okunacak metin,
             biri bugünü biri olayı anlatıyor. Ölçüm kartları aşağıda kalıyor,
             araya okuma daveti girmiyor.

             Yüzey de ayrışıyor — çevresindeki paneller nötr zeminde, bu blok
             accent kenarlık ve çok soluk degrade taşıyor. Ana sayfada
             degrade kullanan tek yüzey bu. */}
        <Suspense fallback={<SpotlightSkeleton />}>
          <StoriesSpotlight locale={locale} t={t} />
        </Suspense>

        {/* ---- Bugün bilanço açıklayanlar ---- */}
        <Suspense fallback={<EarningsTodaySkeleton t={t} />}>
          <EarningsToday locale={locale} t={t} />
        </Suspense>

        {/* ---- Son analizler ----
             KOLON DENGESİ ÖLÇÜLEREK KURULDU. Bu panel bir tur yan kolonda
             durdu ve orada yanlış yerdeydi: yan kolon neredeyse SABİT
             yükseklikte (ölçüldü: 2265 piksel, sekiz panel, hepsi kısa
             listeler), ana kolon ise veriye göre 1500 ile 2100 arasında
             değişiyor — bültenin uzunluğu, mercek girişinin uzunluğu ve o
             gün kaç şirketin bilanço açıkladığı. Yani sağ kolon neredeyse
             HER ZAMAN daha uzundu ve altında 532 piksellik boş bir dikdörtgen
             kalıyordu (1440px'te ölçüldü).

             Panel buraya geçince iki kolon birbirinin etrafında salınıyor:
             ana kolon 1800-2400, yan kolon 1965. Boşluk 532'den 70 piksele
             iniyor ve yoğun bir bilanço gününde diğer tarafa geçse bile küçük
             kalıyor. İçerik olarak da yeri burası: üstündeki bilanço listesi
             "bugün kim açıklıyor", bu panel "açıklayanlar ne yaptı". */}
        <Suspense fallback={<PanelSkeleton rows={5} />}>
          <LatestAnalyses locale={locale} t={t} />
        </Suspense>

      </div>

      {/* ================= Yan kolon =================
          Yalnızca ölçüler: endeksler → dünya → tahviller → makro → senin
          listen. Okunacak metin sol kolonda. */}
      <div
        data-col="side"
        className="flex min-w-0 flex-col gap-5 lg:col-start-2 lg:row-start-1"
      >
        <Suspense fallback={<IndexSkeleton />}>
          <IndexStrip locale={locale} t={t} />
        </Suspense>

        {/* Dünya piyasaları endekslerin hemen altında: ikisi de "bugün
            borsalar ne yapmış" sorusunun cevabı, ABD'si ve dünyası. */}
        <Suspense fallback={<PanelSkeleton rows={5} footer />}>
          <WorldStrip locale={locale} t={t} />
        </Suspense>

        {/* ---- Günün hareketleri ----
             SIRA ÖLÇEKTEN İNCEYE. Üstteki iki panel endeksleri ve dünyayı
             gösteriyor, yani "borsa bugün ne yaptı"; bu panel aynı soruyu
             bir basamak inceden soruyor: tek tek hangi isimler taşıdı. */}
        <Suspense fallback={<PanelSkeleton rows={6} footer />}>
          <DayMovers locale={locale} t={t} />
        </Suspense>

        <Suspense fallback={<PanelSkeleton rows={3} footer />}>
          <YieldCard locale={locale} t={t} />
        </Suspense>

        {/* Burada bir "Petrol ve Korku Endeksi" kartı vardı; kaldırıldı.
            Brent, FRED'in EIA spot serisinden geliyordu ve o seri günlerce
            geriden yayımlanıyor: 4 Ağustos'ta ekranda 27 Temmuz'un fiyatı
            duruyordu, aradaki pencerede varil 92'den 80'e inmişti. Bir
            fiyatı büyük puntoyla bir hafta geriden göstermek, küçük puntoda
            tarihini yazarak kurtarılamaz. Ücretsiz sağlayıcılarımızın
            hiçbirinde canlı emtia spotu yok, o yüzden metrik düştü.
            Korku Endeksi (VIX) ise günlük geliyor ve yaşıyor: alt şeritte
            her sayfada, /piyasalar'da bantlı göstergesiyle. */}
        <Suspense fallback={<PanelSkeleton rows={3} footer />}>
          <MacroSummary locale={locale} t={t} />
        </Suspense>

        {/* ---- Ekonomik takvim ----
             ANA KOLONDAN BURAYA TAŞINDI. İkisi de kısa, tarifeli listeler:
             saat, olayın adı ve bir rakam. Ana kolonda tam genişlikte
             durduklarında satırın sağ yarısı boş kalıyor ve iki panel,
             yanlarındaki uzun metinlerle (günün özeti, mercek manşeti) aynı
             ağırlıkta görünüyordu. Yan kolon zaten ölçülerin sütunu — takvim
             de bir ölçü, sadece geleceğin ölçüsü.

             Sıra bilinçli: bugünün olayları, sonra hafta, sonra senin
             listen. Ölçekten kişisel olana doğru. */}
        <Panel>
          <PanelHeader
            title={t.today.schedule}
            tone="plate"
            action={<PanelLink href="/takvim">{t.common.showAll}</PanelLink>}
          />
          <Suspense fallback={<ListSkeleton rows={3} />}>
            <ScheduleList locale={locale} t={t} />
          </Suspense>
        </Panel>

        <Panel>
          <PanelHeader
            title={t.today.weekAhead}
            tone="plate"
            action={<PanelLink href="/takvim">{t.common.showAll}</PanelLink>}
          />
          <Suspense fallback={<ListSkeleton rows={3} />}>
            <WeekAhead locale={locale} t={t} />
          </Suspense>
        </Panel>

        <Suspense fallback={<PanelSkeleton rows={3} />}>
          <WatchlistSummary locale={locale} t={t} />
        </Suspense>
      </div>

      {/* ---- Öne çıkan haberler ----
           TAM GENİŞLİK BANT, KUTU DEĞİL. Haberler bir süre sol kolonda,
           analizlerin altında, altı satırlık düz bir listeydi: sayfanın en
           son gördüğün ve en az tasarlanmış bloğuydu, üstelik sağında 470
           piksel boş oluk duruyordu.

           İki şey birden değişti. Blok iki kolonun ALTINA indi ve genişliğin
           tamamını aldı; başlığı da bir panel başlığı değil BÖLÜM başlığı
           oldu — kutu yok, altında hairline var. Sayfa böylece "kutu, kutu,
           kutu" ritminden çıkıp bir bölümle kapanıyor. */}
      <section className="min-w-0 lg:col-span-2 lg:row-start-2">
        <div className="flex items-center justify-between gap-3 border-b border-line pb-3">
          <h2 className="display-ink display-ink-tight w-fit text-read font-bold">
            {t.today.topNews}
          </h2>
          <div className="flex shrink-0 items-center gap-3">
            {/* KÜNYE DAR EKRANDA YOK. Türkçesi ("SON 40 HABERDEN SEÇİLDİ")
                büyük harfle 154 piksel tutuyor; başlık ve bağlantıyla
                birlikte 382 piksel ediyor ve 420 pikselin altındaki her
                telefonda üçü de ikişer satıra kırılıyordu — sayfanın
                kapanış bölümü üç satırlık düzensiz bir bloğa dönüşüyordu.
                Seçkinin nasıl yapıldığı bir künye, manşet değil. */}
            <span className="plate hidden whitespace-nowrap text-nano sm:inline">
              {/* Havuz büyüklüğü SABİTTEN geliyor: metinde "40" yazılıydı ve
                  `TOP_NEWS_POOL` değişirse künye sessizce yalan söylerdi. */}
              {t.today.topNewsNote.replace("{n}", String(TOP_NEWS_POOL))}
            </span>
            <PanelLink href="/haberler" className="whitespace-nowrap">
              {t.common.showAll}
            </PanelLink>
          </div>
        </div>
        <Suspense fallback={<NewsGridSkeleton />}>
          <TopNews locale={locale} t={t} />
        </Suspense>
      </section>

      {/* ---- Kaynak künyesi ---- */}
      <footer className="flex flex-wrap justify-between gap-x-6 gap-y-1 pt-2 text-tiny text-muted lg:col-span-2 lg:row-start-3">
        <span>{t.today.sourceLine}</span>
        <span>{t.today.sourceNote}</span>
      </footer>
    </div>
  );
}

/* ==========================================================================
   Parçalar
   ========================================================================== */

/**
 * Şeridi besleyen iki kaynak: ekonomik takvim ve bugünün bilançoları.
 * Mockup 4a'da ikisi de aynı eksende duruyor — gün gerçekten böyle akıyor,
 * "08:30 istihdam" ile "16:30 AAPL" aynı zaman çizgisinin olayları.
 */
async function RailSection({
  t,
  status,
  locale,
}: {
  t: Dictionary;
  status: { trading: boolean; closeMinutes: number; nowMinutes: number };
  locale: Locale;
}) {
  const today = todayEt();
  const session = await auth();
  const [events, earnings, watched] = await Promise.all([
    getTodayEvents(),
    getEarningsBetween(today, today),
    session?.user?.id ? getUserSymbols(session.user.id) : Promise.resolve([]),
  ]);

  const watchedSet = new Set(watched);

  /* Şeritteki bilanço işaretleri yalnızca okuyucunun tanıyacağı isimleri
     taşıyacak; kimin büyük olduğunu bilmek için piyasa değeri çekiliyor.
     Tablo cron'la profillenmiş sembollerden dolu; tabloda olmayan küçük
     isimler zaten eşiği geçemez. */
  const earningsMeta = await getSymbolNames(earnings.map((row) => row.symbol));

  const eventItems: RailEvent[] = events
    .filter((e) => e.eventTimeEt)
    .map((e) => ({
      id: e.id,
      timeEt: e.eventTimeEt as string,
      title: locale === "tr" ? e.titleTr : e.titleEn,
      importance: (e.importance as RailEvent["importance"]) ?? "medium",
      kind: "event",
      /* Değerler PAYLAŞILAN biçimlendiriciden geçiyor. Burada şablon dizesiyle
         ham yazılıyordu: `actual` bir `text` sütunu ve içinde sağlayıcının
         nokta ayraçlı dizesi duruyor, yani aynı TÜFE rakamı takvimde "2,7"
         burada "2.7" görünüyordu. Yüzde işaretinin yeri de elle konuyordu ve
         İngilizcede yanlıştı. Gerekçe: lib/utils.ts → formatEventValue */
      detail: (() => {
        const actual = formatEventValue(e.actual, e.unit, locale);
        const forecast = formatEventValue(e.forecast, e.unit, locale);
        if (actual) {
          return forecast
            ? `${actual} · ${t.calendar.forecast} ${forecast}`
            : actual;
        }
        return forecast ? `${t.calendar.forecast} ${forecast}` : undefined;
      })(),
    }));

  /* Bilanço saatleri YAKLAŞIKTIR ve şeritte "~" ile yazılır.
     Sağlayıcı yalnızca pencereyi veriyor — bmo (açılış öncesi), amc (kapanış
     sonrası), dmh (seans içi) — dakika vermiyor. Kayıtlar bu yüzden gerçek
     dağılımın merkezine oturtuluyor: ABD'de açılış öncesi açıklamalar
     06:30-08:00 ET arasında yığılıyor, kapanış sonrası olanlar 16:05-16:30'da.
     Kapanış sonrası kayıtlar KAPANIŞ ZİLİNİN KENDİSİNE oturuyor (16:00 ET =
     23:00 TR): bir süre 16:30'a konmuştu, "sonrası" olduğu okunsun diye, ama
     zilin yarım saat ötesine atmak da uydurma bir kesinlik veriyordu. Şerit
     zaten "~" ile yaklaşık olduğunu ve alt satırda hangi pencere olduğunu
     söylüyor; konumun zille aynı olması doğruyu bozmuyor, etiket bir kademe
     aşağıya kaçıyor (bkz. BOUND_COLLISION_MINUTES). */
  /**
   * Bilanço penceresinin şeritteki temsilî saati — ET.
   *
   * Sağlayıcı dakika vermiyor, yalnızca pencereyi söylüyor (bmo/amc/dmh); bu
   * yüzden şeritte "~" ile yazılıyor ve pencerenin adı da yanında duruyor.
   * Buradaki değer o pencerenin AĞIRLIK MERKEZİ olmalı, en erken ucu değil.
   *
   * `bmo` 07:00'dı ve okuyucunun saatiyle 14:00'e düşüyordu — Türkiye'de
   * öğleden hemen sonraya, hiçbir şeyin açıklanmadığı bir saate. Açılış
   * öncesi bilançoların büyük kısmı 07:00-08:30 ET arasında, kalabalık da
   * 08:00'e yakın çıkıyor; 08:00 hem pencerenin ortasına daha yakın hem de
   * okuyucunun saatiyle 15:00'e, gerçekten bir şeylerin olduğu saate denk
   * geliyor.
   *
   * Saat SABİT DEĞİL, ET olarak yazılıyor ve ekrana TR'ye çevrilerek
   * basılıyor: yaz-kış farkı kendiliğinden doğru kalıyor (yazın 15:00,
   * kışın 16:00 TR).
   */
  const EARNINGS_TIME: Record<string, string> = {
    bmo: "08:00",
    amc: "16:00",
    dmh: "12:00",
  };
  /* Pencere adı sözlükteki Title Case hâliyle basılır. Bir süre burada
     küçültülüyordu — künye kuralı gereği — ama bu satır bir ölçünün altındaki
     mikro künye değil, kartın taşıdığı iki bilgiden biri: "ne zaman". */
  const EARNINGS_WINDOW: Record<string, string> = {
    bmo: t.earnings.beforeOpen,
    amc: t.earnings.afterClose,
    dmh: t.earnings.duringMarket,
  };

  const earningsItems: RailEvent[] = earnings
    .filter((row) => row.hour && EARNINGS_TIME[row.hour])
    .map((row) => {
      const window = EARNINGS_WINDOW[row.hour as string];
      return {
        id: `earnings-${row.id}`,
        timeEt: EARNINGS_TIME[row.hour as string],
        title: row.symbol,
        importance: "low" as const,
        kind: "earnings" as const,
        approx: true,
        watched: watchedSet.has(row.symbol),
        detail: watchedSet.has(row.symbol)
          ? `${window} · ${t.dayRail.watchedNote}`
          : window,
      };
    });

  /* Şeride adıyla çıkmanın eşiği: 50 milyar dolar. Bir dönem kalabalık
     "182 bilanço" diye sayıyla yazıldı — o sayı da kimsenin planını
     değiştirmiyordu. İşarete yalnızca takip edilenler, adla seçilen şirketler
     (lib/spotlight.ts) ve eşik üstü şirketler çıkar; hiçbiri yoksa o
     pencerenin işareti HİÇ çizilmez. Tam liste zaten /bilancolar'da. */
  const RAIL_CAP_FLOOR = 50e9;

  // Aynı saate düşen bilançolar tek noktada toplanır — 229 şirketlik bir gün
  // ekseni okunmaz hale getirir.
  const groupedEarnings = Object.values(
    earningsItems.reduce<Record<string, RailEvent[]>>((acc, item) => {
      (acc[item.timeEt] ??= []).push(item);
      return acc;
    }, {}),
  ).flatMap((group) => {
    const capOf = (symbol: string) => earningsMeta[symbol]?.marketCap ?? 0;
    const notable = group
      .filter(
        (item) =>
          item.watched ||
          isSpotlight(item.title) ||
          capOf(item.title) >= RAIL_CAP_FLOOR,
      )
      .sort(
        (a, b) =>
          Number(b.watched) - Number(a.watched) ||
          Number(isSpotlight(b.title)) - Number(isSpotlight(a.title)) ||
          capOf(b.title) - capOf(a.title),
      );
    if (notable.length === 0) return [];

    const shown = notable.slice(0, 3);
    const rest = notable.length - shown.length;
    return [
      {
        ...shown[0],
        id: `earnings-${group[0].timeEt}`,
        title:
          shown.map((item) => item.title).join(" · ") +
          (rest > 0 ? ` +${rest}` : ""),
        watched: notable.some((item) => item.watched),
        /* Kart, sembollerin logolarını başlıkla aynı sırada basar — logo,
           "bunlar şirket" bilgisini sembol kısaltmasından hızlı veriyor. */
        logos: shown.map((item) => ({
          symbol: item.title,
          logoUrl: earningsMeta[item.title]?.logoUrl ?? null,
        })),
      },
    ];
  });

  /* Şerit ET dakikasıyla konumlanır ama okuyucunun saatiyle yazılır. İki saat
     arasındaki fark ABD yaz saatiyle kaydığı için sabit değil, o günün
     tarihiyle hesaplanıp şeride veriliyor. */
  return (
    <DayRail
      events={[...eventItems, ...groupedEarnings]}
      initialNowMinutes={status.nowMinutes}
      tradingDay={status.trading}
      closeMinutes={status.closeMinutes}
      offsets={displayOffsets(today, locale)}
      tags={zoneTag(locale)}
      labels={{
        bell: t.dayRail.openShort,
        close: t.dayRail.closeShort,
        now: t.dayRail.now,
        marketHours: t.dayRail.marketHours,
        noEvents: t.dayRail.noEvents,
        earnings: t.dayRail.earningsNote,
      }}
    />
  );
}

/* SAYI ENDEKSİN SEVİYESİ DEĞİL, FONUN FİYATI. Nasdaq 100 endeksi 25 binli
   seviyelerde; karttaki 716 dolar QQQ'nun hisse fiyatı. Ücretsiz
   sağlayıcılarda endeksin kendisi yok, o yüzden vekil fon izleniyor —
   yüzdesi endeksle neredeyse aynı, seviyesi hiç değil.

   Dünya piyasaları kartında bu sorun "fonun fiyatını hiç yazma" diye
   çözülmüştü (db/seed/symbols.ts → WORLD_MARKETS); burada fiyat yazılıyor
   çünkü QQQ/SPY kendi başına da alınıp satılan, tanınan bir enstrüman. O
   zaman da hangi enstrüman olduğu HER genişlikte görünmeli: sembol bir süre
   `hidden sm:inline` idi ve telefonda kart "Nasdaq 100 · 716,49" diye,
   endeksin seviyesiymiş gibi okunuyordu. */
const INDEX_LABEL: Record<string, string> = {
  QQQ: "Nasdaq 100",
  SPY: "S&P 500",
  DIA: "Dow Jones",
  IWM: "Russell 2000",
};

/**
 * Endeks kartları — yan kolonda 2×2 ızgara, mobilde yatay kayan şerit.
 * Dar kolonda dört sütun okunmuyordu; ikişerli dizilim aynı bilgiyi
 * sıkışmadan taşıyor.
 */
async function IndexStrip({ locale, t }: { locale: Locale; t: Dictionary }) {
  const status = await getStatus();
  /* Barlar TEK istekte: sembol başına ayrı çağrı hem dört Alpaca isteği
     hem dört `candles_cache` yazması demekti. */
  const [result, bars] = await Promise.all([
    getQuotes([...INDEX_STRIP], status),
    getChartBarsMulti([...INDEX_STRIP], "1D", status),
  ]);

  if (!result.ok) {
    return (
      <Panel>
        <DataError message={t.data.failed} hint={t.data.failedHint} />
      </Panel>
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      <div className="scroll-x -mx-[18px] flex gap-2.5 px-[18px] sm:mx-0 sm:grid sm:grid-cols-2 sm:px-0 lg:gap-3">
        {INDEX_STRIP.map((symbol) => {
          const quote = result.data[symbol];
          if (!quote) {
            return (
              <Panel key={symbol} className="w-32 shrink-0 p-3.5 sm:w-auto">
                <p className="text-xs font-semibold text-strong">{symbol}</p>
                <p className="mt-1 text-xs text-muted">{t.common.noData}</p>
              </Panel>
            );
          }
          const points = (bars[symbol] ?? []).map((bar) => ({
            value: bar.close,
          }));
          const tone = directionOf(quote.changePct);
          return (
            <Link
              key={symbol}
              href={`/hisse/${symbol}`}
              /* 128px: vekil fonun sembolü artık her genişlikte yazılıyor
                 (yukarıdaki `INDEX_LABEL` yorumu) ve 112 pikselde
                 "Nasdaq 100" ile "QQQ" yan yana sığmıyor, ad üç noktaya
                 düşüyordu. Şerit zaten yatay kayıyor, genişlik bedava. */
              className="w-32 shrink-0 sm:w-auto"
            >
              <Panel className="panel-hover flex h-full flex-col rounded-xl p-3 sm:rounded-lg sm:p-4">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-tiny font-semibold text-body">
                    {INDEX_LABEL[symbol] ?? symbol}
                  </span>
                  <span className="numeral shrink-0 text-nano text-muted">
                    {symbol}
                  </span>
                </div>
                <p className="tote mt-[3px] text-lg sm:mt-1.5 sm:text-title">
                  {formatPrice(quote.price, locale)}
                </p>
                <p
                  className={cn(
                    "numeral text-tiny font-semibold sm:text-small",
                    directionText(tone),
                  )}
                >
                  {formatPercent(quote.changePct, locale)}
                </p>
                {points.length > 1 && (
                  <Sparkline
                    points={points}
                    title={`${INDEX_LABEL[symbol] ?? symbol} · 1D`}
                    tone={tone}
                    height={40}
                    className="mt-[7px] h-6 w-full sm:mt-2 sm:h-9"
                  />
                )}
              </Panel>
            </Link>
          );
        })}
      </div>
      <DataStamp
      labels={t.data}
        source={result.source}
        at={result.fetchedAt}
        stale={result.stale}
        locale={locale}
      />
    </div>
  );
}

/**
 * ABD tahvil faizleri — 2, 5 ve 10 yıllık.
 *
 * Endekslerin hemen altında durması bilinçli: hisse tarafındaki hareketin
 * karşılığı çoğu gün burada okunuyor. 30 yıllık bu kartta yok, tam seri
 * /piyasalar'da; yan kolonda üç vade yeterli.
 */
const TODAY_YIELDS = [
  { seriesId: "DGS2", slug: "yield-2y", units: "lin", labelKey: "yieldY2" },
  { seriesId: "DGS5", slug: "yield-5y", units: "lin", labelKey: "yieldY5" },
  { seriesId: "DGS10", slug: "yield-10y", units: "lin", labelKey: "yieldY10" },
] as const;

async function YieldCard({ locale, t }: { locale: Locale; t: Dictionary }) {
  const [vixResult, ...results] = await Promise.all([
    getSeries(VIX_SERIES, 2),
    ...TODAY_YIELDS.map((series) => getSeries(series, 2)),
  ]);


  const values = TODAY_YIELDS.map((series, index) => {
    const result = results[index];
    return {
      key: series.slug,
      label: t.markets[series.labelKey],
      latest: result.ok ? result.data.latestValue : null,
      prev: result.ok ? result.data.prevValue : null,
      date: result.ok ? (result.data.observations.at(-1)?.date ?? null) : null,
    };
  });

  if (values.every((value) => value.latest === null)) return null;

  /* GÖZLEM TARİHİ YAZILIYOR. FRED'in günlük hazine serileri bir-iki iş günü
     geriden yayımlanıyor: 20 Ağustos'ta en yeni gözlem 18 Ağustos'undu ve
     kart, iki gün önceki faizi bugünün faizi gibi 18 puntoyla basıyor,
     altındaki "▲ 0,04 puan" da bugünün hareketi gibi okunuyordu. Aynı
     sayılar /piyasalar'da zaten tarihiyle duruyor; ikisi arasındaki fark
     tek başına bir hataydı. Bkz. CLAUDE.md → "eski veriyi büyük puntoyla
     gösterme". */
  const observedAt = values.find((value) => value.date)?.date ?? null;

  const vixLevel = vixResult.ok ? vixResult.data.latestValue : null;
  const vixPrev = vixResult.ok ? vixResult.data.prevValue : null;
  /* VIX'İN KENDİ TARİHİ. Panelin tek "FRED · tarih" künyesi tahvil
     serilerine ait ve VIX satırının ÜSTÜNDE duruyor; VIX ise tarihsiz
     basılıyordu. Aynı gün olduklarında sorun görünmüyor ama tahvil
     piyasasının kapalı, borsanın açık olduğu günlerde (Columbus Day,
     Veterans Day) ikisi farklı günlere işaret ediyor ve okuyucu üstteki
     tarihi VIX'e de ait sanıyor. Aynı gerekçe faiz künyesinin yazılma
     sebebiydi zaten; VIX atlanmıştı. */
  const vixDate = vixResult.ok
    ? (vixResult.data.observations.at(-1)?.date ?? null)
    : null;
  const vixDelta =
    vixLevel !== null && vixPrev !== null ? vixLevel - vixPrev : null;
  const bandLabel: Record<string, string> = {
    calm: t.markets.fearCalm,
    normal: t.markets.fearNormal,
    tense: t.markets.fearTense,
    fear: t.markets.fearHigh,
    panic: t.markets.fearPanic,
  };
  const vixTone =
    vixLevel !== null
      ? (() => {
          const band = vixBand(vixLevel);
          return { band, label: bandLabel[band.key] ?? "" };
        })()
      : null;

  return (
    <Panel>
      {/* GÖZLEM TARİHİ BAŞLIKTA DEĞİL, PANELİN DİBİNDE. Başlıkta üçüncü öğe
          olarak duruyordu ve 360 piksellik ekranda 324 piksellik panele üç
          öğe sığmıyordu: başlık kesiliyor, künye ve bağlantı kelime
          ortasından ikiye bölünüyordu. Aynı sayılar /piyasalar'da zaten
          tarihini dipte taşıyor — iki ekran artık aynı yerde söylüyor. */}
      <PanelHeader
        title={t.markets.yields}
        tone="plate"
        action={<PanelLink href="/piyasalar">{t.common.showAll}</PanelLink>}
      />
      <div className="grid grid-cols-3 border-t border-line">
        {values.map((value, index) => {
          const delta =
            value.latest !== null && value.prev !== null
              ? value.latest - value.prev
              : null;
          return (
            <div
              key={value.key}
              className={cn(
                "px-4 py-3.5",
                index > 0 && "border-l border-line",
              )}
            >
              <p className="plate text-nano tracking-[0.08em]">{value.label}</p>
              {/* İşaret küçük ve sessiz kalıyor (birim künyesi gibi) ama YERİ
                  dile bağlı: Türkçede sayıdan önce, İngilizcede sonra. Kural
                  artık primitives → PercentReading içinde tek yerde; burada
                  ve /piyasalar'da ayrı ayrı yazılıyken ikisi ayrışmıştı. */}
              <PercentReading
                value={value.latest}
                locale={locale}
                className="tote mt-1 block text-lg"
                signClassName="mx-0.5 text-xs text-muted"
              />
              <p className="numeral mt-0.5 text-tiny text-muted">
                {/* `null` ile `0` AYRI ŞEYLER: biri "önceki gözlemi
                    bilmiyoruz", öteki "faiz gerçekten değişmedi". İkisini de
                    "değişmedi" diye yazmak, olmayan bir ölçümü ölçülmüş gibi
                    göstermek oluyordu. Bilinmeyende tire basılıyor. */}
                {delta === null ? (
                  "—"
                ) : delta === 0 ? (
                  t.macro.unchanged
                ) : (
                  <>
                    <span aria-hidden>{delta > 0 ? "▲" : "▼"}</span>{" "}
                    {formatPrice(Math.abs(delta), locale, { digits: 2 })}{" "}
                    {t.markets.point}
                  </>
                )}
              </p>
            </div>
          );
        })}
      </div>

      {observedAt && (
        <p className="border-t border-line-soft px-4 py-2 text-nano text-muted sm:px-5">
          FRED · {formatEtDateShort(observedAt, locale)}
        </p>
      )}

      {/* ---- Korku Endeksi ----
           Kendi kartı vardı ve o kart Brent'le eşleşmişti; Brent düşünce
           (FRED'in spot serisi günlerce geriden geliyor) VIX tek başına
           kaldı. Yeri burası: faiz de VIX de hisse tarafının arka planını
           okuyan, tek sayıdan ibaret ölçüler ve ikisi de aynı FRED
           beslemesinden günlük geliyor. Bantlı tam göstergesi
           /piyasalar'da — eşikler oradan, tek yerden okunuyor. */}
      {vixLevel !== null && vixTone && (
        <div className="flex items-center gap-3 border-t border-line px-4 py-3">
          <span className="plate shrink-0 text-nano tracking-[0.08em]">
            {t.markets.fearTitle}
          </span>
          <span className="tote ml-auto text-lead leading-none">
            {formatPrice(vixLevel, locale, { digits: 2 })}
          </span>
          <span
            className={cn(
              "shrink-0 rounded-full px-2 py-0.5 text-nano font-semibold",
              vixTone.band.tone === "up" && "bg-up-wash text-up",
              vixTone.band.tone === "flat" && "bg-surface-elevated text-body",
              vixTone.band.tone === "warn" && "bg-brass-wash text-brass",
              vixTone.band.tone === "down" && "bg-down-wash text-down",
            )}
          >
            {vixTone.label}
          </span>
          {/* Tarih yalnızca faiz künyesinden FARKLIYSA yazılıyor: aynı
              günse üstteki künye zaten söylüyor ve tekrar etmek satırı
              gereksiz kalabalıklaştırır. */}
          {vixDate && vixDate !== observedAt && (
            <span className="numeral shrink-0 text-nano text-muted">
              {formatEtDateShort(vixDate, locale)}
            </span>
          )}
          {vixDelta !== null && vixDelta !== 0 && (
            <span
              className={cn(
                "numeral shrink-0 text-tiny font-semibold",
                // Yükselen VIX gerginlik demek — yön rengi hisse
                // sözlüğünün tersine kurulu.
                vixDelta > 0 ? "text-down" : "text-up",
              )}
            >
              <span aria-hidden>{vixDelta > 0 ? "▲" : "▼"}</span>{" "}
              {formatPrice(Math.abs(vixDelta), locale, { digits: 2 })}{" "}
              {/* Birim ŞART: hemen üstteki faiz satırları değişimi "0,04 puan"
                  diye yazıyor, VIX ise çıplak "1,12" yazıyordu. Yan yana
                  duran iki ölçüden biri birimli biri birimsiz olunca okuyucu
                  ikincisini yüzde sanıyor — VIX'te 1,12 puan ile %1,12 çok
                  farklı iki haber. */}
              {t.markets.point}
            </span>
          )}
        </div>
      )}
    </Panel>
  );
}

/**
 * Dünya piyasaları şeridi — ülke fonları üzerinden.
 * Yerel endeksin kendisi değil; kartın altındaki künye bunu açıkça söyler.
 */
async function WorldStrip({ locale, t }: { locale: Locale; t: Dictionary }) {
  const status = await getStatus();
  const result = await getQuotes(
    WORLD_MARKETS.map((market) => market.symbol),
    status,
  );
  if (!result.ok) return null;

  const shown = WORLD_MARKETS.filter((market) => result.data[market.symbol]);
  if (shown.length === 0) return null;

  return (
    <Panel>
      <PanelHeader title={t.today.worldMarkets} tone="plate" />
      <ul>
        {shown.map((market) => {
          const quote = result.data[market.symbol];
          const tone = directionOf(quote.changePct);
          return (
            <li key={market.symbol}>
              <Link
                href={`/hisse/${market.symbol}`}
                className="flex items-center gap-3 border-t border-line px-4 py-2.5 transition-colors hover:bg-primary-tint sm:px-5"
              >
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 text-base font-semibold text-strong">
                    <span aria-hidden>{market.flag}</span>
                    <span className="truncate">
                      {locale === "tr" ? market.nameTr : market.nameEn}
                    </span>
                  </span>
                  {/* DAR EKRANDA SARAR, KESİLMEZ. Bu satır fonun neyi
                      izlediğini söylüyor ("MSCI Japonya · Nikkei'yi izleyen
                      ABD fonu") ve kesildiğinde cümlenin taşıdığı tek bilgi
                      — vekil olduğu — kayboluyordu; 320 ve 360 piksellik
                      ekranlarda beş satırın üçü böyleydi. İki satıra kadar
                      sarıyor, ondan sonrası kesiliyor. */}
                  <span className="mt-0.5 line-clamp-2 block text-nano leading-tight text-muted sm:truncate">
                    {locale === "tr" ? market.tracksTr : market.tracksEn}
                  </span>
                </span>
                {/* Satırın değeri YALNIZCA yüzde.
                    Burada bir süre fonun dolar fiyatı da (38,70 gibi)
                    büyük puntoyla yazıyordu. O sayı yanlış değildi ama
                    okuyucunun etiketten beklediği büyüklük DEĞİLDİ: "Türkiye
                    38,70" satırında 38,70 bir piyasa seviyesi değil, ABD'de
                    işlem gören bir MSCI fonunun fiyatı — BIST 100 on
                    binlerde. Alttaki açıklama bunu kurtarmıyordu; aynı
                    gerekçeyle Brent metriği de kaldırılmıştı (bkz.
                    CLAUDE.md → veri dürüstlüğü). Yüzde ise gerçekten
                    anlamlı: fonun o günkü yönü. */}
                <span
                  className={cn(
                    "numeral shrink-0 text-read font-bold",
                    directionText(tone),
                  )}
                >
                  {formatPercent(quote.changePct, locale)}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
      <p className="border-t border-line px-4 py-3 text-tiny leading-relaxed text-muted sm:px-5">
        {t.today.worldMarketsHint}
      </p>
    </Panel>
  );
}

function IndexSkeleton() {
  return (
    <div className="flex gap-2.5 sm:grid sm:grid-cols-2 lg:gap-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-28 w-28 shrink-0 rounded-lg sm:w-auto" />
      ))}
    </div>
  );
}

/**
 * Günün özeti — sayfadaki tek gradient yüzey (accent %13 → %2) ve tek
 * accent çerçeve. Bu kartın öne çıkması bilinçli: günü tek paragrafta okumak
 * ürünün vaadi.
 *
 * Kart iki metin taşıyor: günlük ve haftalık bülten. İkisi de burada
 * çekiliyor, sekme geçişi istemcide oluyor (BriefSwitch).
 *
 * "Bugünün kaydı" yerine "en son kayıt" okunuyor. Günlük bülten 16:00'da
 * yazıldığı için gün içinde saatlerce boş duran bir kutu vardı; artık dünkü
 * metin duruyor ve üstünde tarihini söyleyen bir uyarı var.
 */
async function BriefCard({ locale, t }: { locale: Locale; t: Dictionary }) {
  const [daily, weekly] = await Promise.all([
    getLatestBrief(locale, "daily"),
    getLatestBrief(locale, "weekly"),
  ]);

  const today = todayEt();
  const thisWeek = weekAnchor(today);

  const stampOf = (row: NonNullable<typeof daily>) => {
    const time = new Intl.DateTimeFormat(locale === "tr" ? "tr-TR" : "en-US", {
      timeZone: "Europe/Istanbul",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(row.generatedAt));
    return `${row.generatedBy === "claude" ? "Claude · " : ""}${time}`;
  };

  const weekRange = (anchor: string) =>
    t.brief.weeklyRange
      .replace("{start}", formatEtDateShort(anchor, locale))
      .replace("{end}", formatEtDateShort(addEtDays(anchor, 4), locale));

  const dailyView: BriefView | null = daily && {
    headline: daily.headline,
    stamp: stampOf(daily),
    dateLabel: formatEtDateLong(daily.briefDate, locale),
    current: daily.briefDate === today,
    staleNote:
      daily.briefDate === today
        ? null
        : t.today.briefStaleNote
            .replace("{date}", formatEtDateLong(daily.briefDate, locale))
            .replace("{time}", BRIEF_PUBLISH_TR.daily),
    langNote: daily.locale === locale ? null : t.brief.fallbackNote,
    archiveHref: "/bulten",
  };

  const weeklyView: BriefView | null = weekly && {
    headline: weekly.headline,
    stamp: stampOf(weekly),
    dateLabel: weekRange(weekly.briefDate),
    current: weekly.briefDate === thisWeek,
    staleNote:
      weekly.briefDate === thisWeek
        ? null
        : t.today.briefWeeklyStaleNote
            .replace("{range}", weekRange(weekly.briefDate))
            .replace("{time}", BRIEF_PUBLISH_TR.weekly),
    langNote: weekly.locale === locale ? null : t.brief.fallbackNote,
    archiveHref: "/bulten?tur=haftalik",
  };

  return (
    <BriefSwitch
      daily={dailyView}
      weekly={weeklyView}
      /* Gövdeler BURADA çiziliyor: `BriefBody` ve iki bültenin ham metni
         sunucuda kalıyor, istemciye yalnızca çizilmiş ağaç gidiyor. */
      dailyBody={
        daily && (
          <BriefBody
            markdown={daily.bodyMd}
            moreLabel={t.common.showAll}
            lessLabel={t.common.less}
          />
        )
      }
      weeklyBody={
        weekly && (
          <BriefBody
            markdown={weekly.bodyMd}
            moreLabel={t.common.showAll}
            lessLabel={t.common.less}
          />
        )
      }
      labels={{
        tabs: { daily: t.brief.periodDaily, weekly: t.brief.periodWeekly },
        titles: {
          daily: t.today.briefTitle,
          weekly: t.today.briefWeeklyTitle,
        },
        empty: {
          daily: t.today.briefEmpty,
          weekly: t.today.briefWeeklyEmpty,
        },
        currentBadge: { daily: t.brief.today, weekly: t.brief.thisWeek },
        periodLabel: t.today.briefPeriod,
        more: t.common.showAll,
        archive: t.brief.archiveLink,
      }}
    />
  );
}

async function ScheduleList({ locale, t }: { locale: Locale; t: Dictionary }) {
  const events = await getTodayEvents();

  if (events.length === 0) {
    return <EmptyState title={t.today.scheduleEmpty} />;
  }

  const tags = zoneTag(locale);

  return (
    <ul>
      {events.map((event) => {
        /* Büyük satır okuyucunun saati, altındaki küçük satır kaynağın
           saati. TR'de sıra dönüyor: "16:30" üstte, "09:30 NY" altta. */
        const times = event.eventTimeEt
          ? timePair(event.eventDate, event.eventTimeEt, locale)
          : null;
        const high = event.importance === "high";
        /* Biçim paylaşılan yardımcıdan: elden yazılan satır yüzdeyi İNGİLİZCE
           kuralıyla sona koyuyordu ("3.46353%") ve ondalık ayracını
           yerelleştirmiyordu — aynı sayı sayfanın üstündeki şeritte "%3,46"
           yazıyordu. */
        const forecast = formatEventValue(event.forecast, event.unit, locale);
        const actual = formatEventValue(event.actual, event.unit, locale);
        return (
          <li
            key={event.id}
            className={cn(
              "flex items-center gap-3 border-t border-line px-4 py-3 sm:px-5",
              high && "bg-down-wash",
            )}
          >
            <span className="w-[52px] shrink-0">
              <span
                className={cn(
                  "numeral block text-base leading-tight",
                  high ? "font-bold text-strong" : "font-semibold text-body",
                )}
              >
                {times ? times.primary : "—"}
              </span>
              {times && (
                <span className="numeral block text-nano leading-tight text-muted">
                  {times.secondary} {tags.secondary}
                </span>
              )}
            </span>
            <ImpactDot
              importance={event.importance ?? "low"}
              label={t.calendar.impact}
              lineHeight={20}
            />
            <span
              className={cn(
                "min-w-0 flex-1 text-sm",
                high ? "font-semibold text-strong" : "text-body",
              )}
            >
              {locale === "tr" ? event.titleTr : event.titleEn}
            </span>
            {/* TEK SAYI SÜTUNU, İKİ DEĞİL. Kart ana kolondayken beklenti ve
                gerçekleşen ayrı sütunlardaydı; yan kolona taşınınca (376px)
                ikisi de çoğu satırda boş olduğu için yan yana iki tire
                genişliğin üçte birini yiyor, olayın adı üç satıra
                kırılıyordu. Gerçekleşen varsa o yazılıyor, yoksa beklenti —
                ve altındaki künye hangisi olduğunu söylüyor. İkisini birden
                görmek isteyen /takvim'e gidiyor. */}
            {(actual || forecast) && (
              <span className="shrink-0 text-right">
                <span
                  className={cn(
                    "numeral block text-base leading-tight",
                    actual
                      ? high
                        ? "font-bold text-down"
                        : "font-semibold text-strong"
                      : "text-body",
                  )}
                >
                  {actual ?? forecast}
                </span>
                <span className="block text-nano leading-tight text-muted">
                  {actual ? t.calendar.actual : t.calendar.forecast}
                </span>
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/* --------------------------------------------------------------------------
   Endeks evreninin BİR ANLIK GÖRÜNTÜSÜ — iki panel de bundan besleniyor.

   `getQuotes` istek boyunca `cache()`li ve anahtarı sıralanmış sembol dizesi
   (lib/providers/index.ts → quotesForKey), yani iki panel aynı listeyi
   sorduğunda sağlayıcıya BİR kez gidiliyor. Bu, hız kadar DOĞRULUK meselesi:
   ayrı ayrı çekilseler aynı ekranda aynı hissenin iki farklı yüzdesi
   durabilir ve deponun kuralı "aynı sayı iki yerde duruyorsa aynı kaynaktan
   gelmeli".

   Evren endeks üyeleri (S&P 500 + Nasdaq 100 + Dow, tekilleştirilmiş) ve
   bu da bir veri dürüstlüğü kararı: takip edilen 800 şirketin tamamı
   alınsaydı sıralamanın tepesine mikro şirketler çıkardı — ölçüldü, bir
   seansta 156 bin dolarlık bir şirket %250 hareketle listeyi açıyordu.
   Endeks üyeliği "haber değeri olan isim" için ucuz ve savunulabilir bir
   süzgeç, üstelik künye kaç sembolün tarandığını yazıyor.
   -------------------------------------------------------------------------- */
const MOVER_UNIVERSE = primaryOnly(ALL_MEMBERS);

async function indexSnapshot(status: MarketStatus) {
  const symbols = MOVER_UNIVERSE.map((member) => member.symbol);
  return { symbols, result: await getQuotes(symbols, status) };
}

/**
 * Günün hareketleri — endeks üyeleri arasında en çok yükselen ve düşen üç.
 *
 * PANEL ARTIK HER SEANSTA VAR. Ön seans ve akşam seansı için yazılmıştı
 * (`SessionMovers`) ve yalnızca o iki pencerede basılıyordu; seans açıkken
 * ana sayfada tek bir hissenin bugün ne yaptığını gösteren hiçbir şey
 * yoktu — kendi favorilerin dışında. Ölçüldü: sağ kolon panelleri toplamı
 * 1797 piksel, kolon ise 2379 piksele uzuyordu ve aradaki 580 piksel
 * `justify-between` tarafından panel aralarına dağıtılıyordu.
 *
 * YALNIZCA BU SEANSTA İŞLEM GÖRENLER — ve bu, panelin en önemli kuralı ama
 * yalnızca UZATILMIŞ seansta geçerli. Ön seansta bir hissenin çoğu hiç işlem
 * görmüyor; o sembolün "son işlemi" dünkü kapanış oluyor ve değişimi de
 * DÜNÜN değişimi. Süzgeç olmasaydı liste, bu sabah hiç kımıldamamış
 * hisselerin dünkü hareketleriyle dolardı. Normal seansta ve kapalıyken
 * böyle bir ayrım yok: `changePct` zaten o günün kapanışına göre.
 *
 * BAŞLIK VE KÜNYE SEANSI SÖYLÜYOR. Piyasa kapalıyken gösterilen şey
 * "günün" değil son kapanışın sıralaması; künye bunu yazmasa panel dünkü
 * sıralamayı bugünmüş gibi basardı.
 */
async function DayMovers({ locale, t }: { locale: Locale; t: Dictionary }) {
  const status = await getStatus();
  const { symbols, result } = await indexSnapshot(status);

  const extended =
    status.session === "pre-market" || status.session === "after-hours";
  const title = !extended
    ? t.today.dayMovers
    : status.session === "pre-market"
      ? t.today.preMarketMovers
      : t.today.afterHoursMovers;

  if (!result.ok) {
    return (
      <Panel>
        <PanelHeader title={title} tone="plate" />
        <DataError message={t.data.failed} hint={t.data.failedHint} />
      </Panel>
    );
  }

  const sinceMinutes =
    status.session === "pre-market"
      ? SESSION_BOUNDS.preMarketOpen
      : status.closeMinutes;

  const usable = symbols
    .map((symbol) => ({ symbol, quote: result.data[symbol] }))
    .filter((row) => {
      const quote = row.quote;
      /* Değişimi BİLİNMEYEN sembol eleniyor, sıfır sayılmıyor: sıfır
         "bugün değişmedi" diye bir iddia, bilinmiyor iddiasızlık. */
      if (!quote || quote.changePct === null || quote.changePct === undefined) {
        return false;
      }
      if (!extended) return true;
      if (!quote.tradedAt) return false;
      const at = etParts(quote.tradedAt);
      return at.dateStr === status.etDate && at.minutes >= sinceMinutes;
    })
    .map((row) => ({ symbol: row.symbol, quote: row.quote! }));

  const ranked = [...usable].sort(
    (a, b) => (b.quote.changePct ?? 0) - (a.quote.changePct ?? 0),
  );
  const gainers = ranked.filter((row) => (row.quote.changePct ?? 0) > 0).slice(0, 3);
  const losers = ranked
    .filter((row) => (row.quote.changePct ?? 0) < 0)
    .slice(-3)
    .reverse();

  /* KÜNYE SEANSI SÖYLÜYOR — üç ayrı cümle, üç ayrı hâl.
     Uzatılmış seansta liste yalnızca O SEANSTA işlem görenlerden kuruluyor.
     Seans açıkken sıralama gün içinde ve canlı. Piyasa KAPALIYKEN ise
     gösterilen şey "bugünün" değil son kapanışın sıralaması; tek bir künye
     kullanılsaydı panel cumartesi günü cuma kapanışını "seans içi" diye
     basardı. */
  const note = (
    extended
      ? t.today.moversNote
      : status.session === "closed"
        ? t.today.dayMoversClosedNote
        : t.today.dayMoversNote
  ).replace("{n}", String(symbols.length));

  if (gainers.length === 0 && losers.length === 0) {
    return (
      <Panel>
        <PanelHeader title={title} tone="plate" />
        <EmptyState
          title={extended ? t.today.moversEmpty : t.today.dayMoversEmpty}
          hint={note}
        />
      </Panel>
    );
  }

  const meta = await getSymbolNames([
    ...gainers.map((row) => row.symbol),
    ...losers.map((row) => row.symbol),
  ]);

  /* DİKEY YIĞIN, İKİ SÜTUN DEĞİL. `SessionMovers` ana kolonda `sm:grid-cols-2`
     ile iki sütun çiziyordu; yan kolon 376 piksel ve sütun 167 pikselden
     düşüyor — satır 26 piksellik logo, sembol, ad ve yüzde istiyor, sığmıyor.
     Ayrım sütunla değil ALT BAŞLIKLA kuruluyor ve bu aynı zamanda doğrusu:
     düşüşle geçen bir günde "yükselenler" listesinin üçü de eksi olabiliyor,
     tek liste + renk o gün "kim yükseldi" sorusunu cevapsız bırakırdı. */
  const block = (heading: string, rows: typeof gainers, divided: boolean) => (
    <div className={cn(divided && "border-t border-line")}>
      <p className="plate px-4 pb-1.5 pt-3.5 text-nano tracking-[0.09em] sm:px-5">
        {heading}
      </p>
      <ul>
        {rows.length === 0 ? (
          <li className="px-4 pb-3.5 text-small text-muted sm:px-5">—</li>
        ) : (
          rows.map((row) => (
            <li key={row.symbol}>
              <Link
                href={`/hisse/${row.symbol}`}
                prefetch={false}
                className="flex items-center gap-2.5 px-4 py-2 transition-colors hover:bg-primary-tint sm:px-5"
              >
                <LogoTile
                  symbol={row.symbol}
                  logoUrl={meta[row.symbol]?.logoUrl}
                  size="sm"
                />
                <span className="min-w-0 flex-1">
                  <span className="numeral block text-base font-bold leading-tight text-strong">
                    {row.symbol}
                  </span>
                  <span className="block truncate text-nano leading-tight text-muted">
                    {meta[row.symbol]?.name ?? ""}
                  </span>
                </span>
                {/* Yüzde ÇIPLAK, rozet değil: yan kolonun grameri bu
                    (dünya şeridi, favoriler, endeksler hepsi böyle). Rozetin
                    zemini dar sütunda satırın yarısını kaplıyor. */}
                <span
                  className={cn(
                    "numeral shrink-0 text-base font-bold",
                    directionText(directionOf(row.quote.changePct)),
                  )}
                >
                  {formatPercent(row.quote.changePct, locale)}
                </span>
              </Link>
            </li>
          ))
        )}
      </ul>
    </div>
  );

  return (
    <Panel>
      <PanelHeader
        title={title}
        tone="plate"
        action={<PanelLink href="/piyasalar">{t.common.showAll}</PanelLink>}
      />
      {block(t.today.moversUp, gainers, true)}
      {block(t.today.moversDown, losers, true)}
      <p className="border-t border-line-soft px-4 py-2 text-nano text-muted sm:px-5">
        {note}
      </p>
    </Panel>
  );
}

/** Başlıksız iskelet — panelin kendi başlığı bileşenin içinde. */
function EarningsTodaySkeleton({ t }: { t: Dictionary }) {
  return (
    <Panel>
      <PanelHeader
        title={t.today.earningsToday}
        action={<PanelLink href="/bilancolar">{t.common.showAll}</PanelLink>}
      />
      <ListSkeleton rows={4} />
    </Panel>
  );
}

/**
 * Bugün bilanço açıklayanlar.
 *
 * PANELİ BİLEŞEN BASIYOR, sayfa değil: başlığın ortasındaki boşluğa listenin
 * BOYU geliyor ("8 şirket") ve o sayı ancak sorgu döndükten sonra biliniyor.
 * Başlık dışarıda, Suspense'in üstünde kalsaydı sayıya erişemezdi.
 */
async function EarningsToday({ locale, t }: { locale: Locale; t: Dictionary }) {
  const today = todayEt();
  const rows = await getEarningsBetween(today, today);

  if (rows.length === 0) {
    return (
      <Panel>
        <PanelHeader
          title={t.today.earningsToday}
          action={<PanelLink href="/bilancolar">{t.common.showAll}</PanelLink>}
        />
        <EmptyState title={t.earnings.empty} />
      </Panel>
    );
  }

  const names = await getSymbolNames(rows.map((row) => row.symbol));

  /* Beş satır, PİYASA DEĞERİNE göre. Sağlayıcı takvimi alfabetik döndürüyor
     ve liste "APC · ATI · ATII · ATLC" diye başlıyordu: bugünün en büyük
     bilançosu 400 satır aşağıdaydı. Takvim ekranı zaten aynı sıralamayı
     kullanıyor.
     SEKİZDEN BEŞE. Panel ana sayfanın ortasında bir ÖZET; sekiz satır onu
     telefonda tek başına bir ekran boyu yapıyor ve altındaki bölümleri
     aşağı itiyordu. Kırpılan geri kalan zaten künyede sayıyla ("43 şirketin
     5 tanesi") ve "Tümünü Gör" ile duruyor. */
  const shown = [...rows]
    .sort(
      (a, b) =>
        (names[b.symbol]?.marketCap ?? 0) - (names[a.symbol]?.marketCap ?? 0),
    )
    .slice(0, 5);

  const badges = await getAnalysisBadges(
    shown.map((row) => row.symbol),
    locale,
    { from: today, to: today },
  );

  const hourLabel: Record<string, string> = {
    bmo: t.earnings.beforeOpen,
    amc: t.earnings.afterClose,
    dmh: t.earnings.duringMarket,
  };

  return (
    <Panel>
      <PanelHeader
        title={t.today.earningsToday}
        /* SAYAÇ YALNIZCA LİSTE KIRPILDIĞINDA. İki sayıyı da söylüyor
           ("47 şirketin 8 tanesi") çünkü önce yalnızca toplam yazıyordu ve
           altında sekiz satır duruyordu: okuyucu ya kırpıldığını fark
           etmiyor ya da sayıyı hatalı sanıyordu. Ama kırpma yoksa sayaç
           "6 şirketin 6 tanesi" diyor — hiçbir şey söylemeyen bir cümle.
           Aynı kalıp /mercek arşivinde de var. */
        meta={
          rows.length > shown.length
            ? t.today.earningsCount
                .replace("{total}", String(rows.length))
                .replace("{n}", String(shown.length))
            : undefined
        }
        action={<PanelLink href="/bilancolar">{t.common.showAll}</PanelLink>}
      />
      <ul>
      {shown.map((row) => {
        const badge = badges[`${row.symbol}:${row.reportDate}`];
        return (
          /* Satır artık bir <a> değil: analiz rozeti kendi bağlantısını
             taşıyor ve iç içe bağlantı geçersiz HTML. Yüzeyi kaplayan
             bağlantı katmanı görünümü aynen koruyor. */
          <li
            key={row.id}
            className="relative flex items-center gap-3 border-t border-line px-4 py-3 transition-colors hover:bg-primary-tint sm:gap-4 sm:px-5"
          >
            <Link
              href={`/hisse/${row.symbol}`}
              aria-label={`${row.symbol} ${names[row.symbol]?.name ?? ""}`}
              className="absolute inset-0"
            />
            {/* LOGO VE İKİ SATIRLI KİMLİK. Satır "WMT ......... Walmart Inc"
                diye iki uca yaslanmış iki metinden ibaretti: aradaki boşluk
                satırın yarısıydı ve hemen altındaki "Son Analizler" paneli
                aynı şirketleri logolu, iki satırlı künyeyle gösteriyordu.
                Aynı sayfada aynı bilgi iki farklı ağırlıkta duruyordu. */}
            <LogoTile
              symbol={row.symbol}
              logoUrl={names[row.symbol]?.logoUrl}
              size="md"
            />
            <span className="min-w-0 flex-1">
              <span className="numeral block text-base font-bold leading-tight text-strong">
                {row.symbol}
              </span>
              <span className="block truncate text-tiny leading-tight text-muted">
                {names[row.symbol]?.name ?? ""}
              </span>
            </span>
            {badge ? (
              <AnalysisBadge badge={badge} t={t} size="sm" />
            ) : (
              <TimingChip
                wide
                tone={row.hour === "bmo" ? "pre" : row.hour === "amc" ? "post" : "neutral"}
              >
                {row.hour ? (hourLabel[row.hour] ?? t.earnings.timeUnknown) : t.earnings.timeUnknown}
              </TimingChip>
            )}
            {row.epsEstimate !== null && (
              <span className="hidden shrink-0 text-right sm:block">
                <span className="numeral block text-base font-semibold leading-tight text-body">
                  {formatPrice(row.epsEstimate, locale, { currency: true })}
                </span>
                <span className="block text-nano leading-tight text-muted">
                  {t.earnings.epsEstimate}
                </span>
              </span>
            )}
          </li>
        );
      })}
      </ul>
    </Panel>
  );
}

/** Favoriler listesinin taban satır sayısı ve yedeklerle birlikte tavanı. */
const WATCHLIST_BASE = 5;
const WATCHLIST_MAX = 10;

async function WatchlistSummary({ locale, t }: { locale: Locale; t: Dictionary }) {
  const session = await auth();

  if (!session?.user?.id) {
    return (
      <Panel>
        <PanelHeader title={t.today.watchlistSummary} tone="plate" />
        <EmptyState
          title={t.watchlist.emptyAll}
          hint={t.watchlist.emptyAllHint}
          action={
            <ButtonLink href="/giris" variant="primary">
              {t.nav.signIn}
            </ButtonLink>
          }
        />
      </Panel>
    );
  }

  const userSymbols = await getUserSymbols(session.user.id);

  if (userSymbols.length === 0) {
    return (
      <Panel>
        <PanelHeader title={t.today.watchlistSummary} tone="plate" />
        <EmptyState
          title={t.today.watchlistEmpty}
          action={<PanelLink href="/favoriler">{t.watchlist.addSymbol}</PanelLink>}
        />
      </Panel>
    );
  }

  const status = await getStatus();
  /* BEŞ SATIR TABAN, ONA KADAR YEDEK.
     Sekiz sabitti ve o sayı hiçbir şeye bakmıyordu: bültenin kısa olduğu bir
     günde sağ kolon sol kolonu aşıyor, uzun olduğu günde altında yüz
     piksellik boşluk kalıyordu. Sunucu on satırın tamamını basıyor ama
     beşten sonrası `hidden`; kaçının açılacağına tarayıcı, iki kolonun
     dibini ölçerek karar veriyor (`FillColumn`). JavaScript kapalıysa beş
     satır kalıyor ve bu da makul bir liste. */
  const shown = userSymbols.slice(0, WATCHLIST_MAX);
  const [result, bars] = await Promise.all([
    getQuotes(shown, status),
    getChartBarsMulti(shown, "1D", status),
  ]);

  return (
    <Panel className="px-4 py-4 sm:px-5">
      {/* Plaka başlık — panelin iki boş dalı zaten `PanelHeader` üzerinden
          plakaya inmişti; dolu dal kendi başlığını elden yazdığı için geride
          kalmıştı ve aynı panel veriye göre iki farklı başlık tipografisi
          basıyordu. */}
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <h2 className="plate min-w-0 truncate">{t.today.watchlistSummary}</h2>
        <PanelLink href="/favoriler">{t.common.showAll}</PanelLink>
      </div>
      {result.ok ? (
        <>
          <FillColumn>
            <ul>
            {shown.map((symbol, index) => {
              const quote = result.data[symbol];
              const points = (bars[symbol] ?? []).map((bar) => ({
                value: bar.close,
              }));
              const tone = directionOf(quote?.changePct);
              return (
                <li
                  key={symbol}
                  /* `data-fill-row` ölçü örneği, `data-fill` açılabilir
                     yedek — ikisini de `FillColumn` okuyor. */
                  data-fill-row=""
                  data-fill={index >= WATCHLIST_BASE ? "" : undefined}
                  hidden={index >= WATCHLIST_BASE}
                  className="border-t border-line first:border-t-0"
                >
                  <Link
                    href={`/hisse/${symbol}`}
                    className="flex items-center gap-3 py-2.5 transition-colors hover:opacity-80"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block text-base font-bold text-strong">
                        {symbol}
                      </span>
                    </span>
                    {points.length > 1 && (
                      <Sparkline
                        points={points}
                        title={`${symbol} · 1D`}
                        tone={tone}
                        width={56}
                        height={24}
                        showArea={false}
                        className="h-6 w-14 shrink-0"
                      />
                    )}
                    {quote ? (
                      <span className="w-[74px] shrink-0 text-right">
                        <span className="numeral block text-base font-bold text-strong">
                          {formatPrice(quote.price, locale)}
                        </span>
                        <span
                          className={cn(
                            "numeral block text-tiny",
                            directionText(tone),
                          )}
                        >
                          {formatPercent(quote.changePct, locale)}
                        </span>
                      </span>
                    ) : (
                      <span className="text-xs text-muted">{t.common.noData}</span>
                    )}
                  </Link>
                </li>
              );
            })}
            </ul>
          </FillColumn>
          <DataStamp
            labels={t.data}
            source={result.source}
            at={result.fetchedAt}
            stale={result.stale}
            locale={locale}
            className="mt-3 border-t border-line pt-3"
          />
        </>
      ) : (
        <DataError message={t.data.failed} hint={t.data.failedHint} />
      )}
    </Panel>
  );
}

/**
 * Makro özeti — dört ana seri, 23px sayı ve yön oklu önceki değer.
 *
 * Ok rengi yalnızca YÖN söyler, yorum yapmaz: düşüş kırmızı, yükseliş accent
 * mavi. Yeşil kasten kullanılmıyor — enflasyonun düşmesi iyi, istihdamın
 * düşmesi kötüdür; hisse tarafındaki yeşil/kırmızı sözlüğü buraya taşınırsa
 * okuyucuya "bu iyi haber" demiş oluruz. Etiket metni nötr gri kalır.
 */
async function MacroSummary({ locale, t }: { locale: Locale; t: Dictionary }) {
  const rows = await getMacroRows();
  if (rows.length === 0) return null;

  const shown = rows.slice(0, 4);

  return (
    <Panel className="px-4 py-4 sm:px-5">
      <div className="mb-3.5 flex items-baseline justify-between gap-3">
        {/* Plaka başlık — yan kolonun tamamı gibi. Gerekçe PanelHeader'da;
            bu panel kendi başlığını elden yazıyor (ölçü ızgarası bir
            `PanelHeader` düzeni değil), o yüzden sınıf burada tekrarlanıyor. */}
        <h2 className="plate">
          {t.today.macroSummary}
        </h2>
        <PanelLink href="/makro">{t.common.showAll}</PanelLink>
      </div>
      <div className="grid grid-cols-2 gap-4">
        {shown.map((row) => {
          const latest = row.latestValue;
          const prev = row.prevValue;
          const delta =
            latest !== null && prev !== null ? latest - prev : null;
          /* Yüzde işaretinin yeri DİLE bağlı: Türkçede sayıdan önce (%2,57),
             İngilizcede sonra (2.57%). Burada dize sonuna elle "%" ekleniyordu
             ve panel iki dilde de "2,57%" basıyordu — sitenin geri kalanı
             `formatPercentPlain` ile doğru yazarken bu panel kuralı
             çiğniyordu (bkz. lib/utils.ts → withPercent). */
          const isPct = row.unit === "%";
          const show = (value: number) =>
            isPct
              ? formatPercentPlain(value, locale, 2)
              : formatPrice(value, locale);
          return (
            <div key={row.seriesId}>
              <p className="truncate text-tiny text-muted">
                {locale === "tr" ? row.titleTr : row.titleEn}
              </p>
              <p className="tote mt-0.5 text-title">
                {latest !== null ? show(latest) : "—"}
              </p>
              {/* DÖNEM KÜNYESİ. Sayı 23 puntoyla basılıyor ama hangi aya ait
                  olduğu yazmıyordu; TÜFE ve istihdam haftalar geriden
                  yayımlanır ve okuyucu bunu bugünün verisi sanıyordu. Makro
                  ekranı aynı sayının yanına bu künyeyi zaten koyuyor. */}
              {row.periodLabel && (
                <p className="text-nano text-muted">
                  {formatPeriodLabel(row.periodLabel, locale)}
                </p>
              )}
              <p className="numeral text-tiny text-muted">
                {delta === null ? (
                  t.common.noData
                ) : delta === 0 ? (
                  t.macro.unchanged
                ) : (
                  <>
                    <span
                      aria-hidden
                      className={cn(
                        "font-semibold",
                        delta > 0 ? "text-primary" : "text-down",
                      )}
                    >
                      {delta > 0 ? "▲" : "▼"}
                    </span>{" "}
                    {t.macro.previous} {show(prev!)}
                  </>
                )}
              </p>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

/**
 * Haftaya bakış — önümüzdeki 7 günün yüksek ve orta önemli olayları.
 */
async function WeekAhead({ locale, t }: { locale: Locale; t: Dictionary }) {
  const today = todayEt();
  const events = (
    await getEventsBetween(addEtDays(today, 1), addEtDays(today, 7))
  ).filter((event) => event.importance !== "low");

  if (events.length === 0) {
    return <EmptyState title={t.today.weekAheadEmpty} />;
  }

  const tags = zoneTag(locale);

  return (
    <ul>
      {events.slice(0, 6).map((event) => {
        const times = event.eventTimeEt
          ? timePair(event.eventDate, event.eventTimeEt, locale)
          : null;
        return (
          <li
            key={event.id}
            className="flex items-start gap-3 border-t border-line px-4 py-3 sm:px-5"
          >
            <span className="w-[86px] shrink-0">
              <span className="block text-tiny font-semibold leading-tight text-strong">
                {formatEtDateLong(event.eventDate, locale)}
              </span>
              {times && (
                <span className="numeral block text-nano leading-tight text-muted">
                  {times.primary} {tags.primary}
                </span>
              )}
            </span>
            <ImpactDot
              importance={event.importance ?? "medium"}
              label={t.calendar.impact}
            />
            <span className="min-w-0 flex-1 text-base leading-snug text-body">
              {locale === "tr" ? event.titleTr : event.titleEn}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/** Kartta gösterilen haber sayısı ve seçkinin tarandığı havuz. */
const TOP_NEWS_COUNT = 6;
const TOP_NEWS_POOL = 40;
/** Aynı sembolden listeye en fazla kaç haber girer. */
const TOP_NEWS_PER_SYMBOL = 2;
/**
 * Aynı KAYNAKTAN listeye en fazla kaç haber girer.
 *
 * Sembol sınırı vardı, kaynak sınırı yoktu. Seçim görseli olan haberleri öne
 * aldığı için (Yahoo yer tutucu logo yolluyor, elenmesi gereken oydu) liste
 * pratikte tek bir siteye kayabiliyor: ölçüldüğü gün altı kartın altısı da
 * SeekingAlpha'ydı. Satır listesinde bu görünmüyordu, üç kolonluk görselli
 * ızgarada "öne çıkan haberler" tek bir yayının bülteni gibi duruyor.
 */
const TOP_NEWS_PER_SOURCE = 2;

async function TopNews({ locale, t }: { locale: Locale; t: Dictionary }) {
  // Bu kart "son haberler" değil "öne çıkanlar": son 40 haberlik havuzdan
  // seçim yapılıyor. Sağlayıcının genel akışı Yahoo ağırlıklı ve Yahoo her
  // habere aynı yer tutucu logoyu iliştiriyor; kendi görseli olan haberler
  // (şirket beslemesinden gelenler) öne alınıyor. Sıralama yine tarihe göre,
  // yalnızca hangi altı haberin seçildiği değişiyor.
  const pool = await getLatestNews(TOP_NEWS_POOL);

  if (pool.length === 0) {
    return <EmptyState title={t.news.empty} />;
  }

  const genericImages = await getGenericImageUrls(
    pool.map((item) => item.imageUrl),
  );
  const hasImage = (item: (typeof pool)[number]) =>
    Boolean(item.imageUrl) && !genericImages.has(item.imageUrl as string);

  /* TEK ŞİRKET LİSTEYİ ELE GEÇİRMESİN. Günlük senkron en büyük şirketlerin
     haber uçlarını tek tek geziyor; hareketli bir günde tek sembol havuzun
     dörtte birini doldurabiliyor (bir gün 40 haberin 12'si MU'ydu) ve
     "Öne Çıkan Haberler" tek şirketin bülteni gibi görünüyordu. Sembol
     başına en fazla iki haber alınır, kalanlar sıradakine yer açar. */
  const capped = (list: typeof pool) => {
    const bySymbol = new Map<string, number>();
    const bySource = new Map<string, number>();
    const kept: typeof pool = [];
    for (const item of list) {
      const symbol = item.symbols?.[0] ?? "";
      const source = item.source ?? "";
      if (symbol && (bySymbol.get(symbol) ?? 0) >= TOP_NEWS_PER_SYMBOL) continue;
      if (source && (bySource.get(source) ?? 0) >= TOP_NEWS_PER_SOURCE) continue;
      bySymbol.set(symbol, (bySymbol.get(symbol) ?? 0) + 1);
      bySource.set(source, (bySource.get(source) ?? 0) + 1);
      kept.push(item);
    }
    return kept;
  };

  const withImage = pool.filter(hasImage);
  const withoutImage = pool.filter((item) => !hasImage(item));
  const ordered = capped([...withImage, ...withoutImage]);
  const items = (ordered.length >= TOP_NEWS_COUNT
    ? ordered
    : [...ordered, ...[...withImage, ...withoutImage].filter((i) => !ordered.includes(i))]
  )
    .slice(0, TOP_NEWS_COUNT)
    .sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());

  /* Görseli olmayan haber, künye kutusunda sembol yazan gri bir kutuyla
     duruyordu. Sıradaki en iyi görsel şirketin kendi logosu: haberin konusunu
     gösteriyor ve zaten elimizde. */
  const logos = await getSymbolNames([
    ...new Set(
      items.map((item) => item.symbols?.[0]).filter((s): s is string => Boolean(s)),
    ),
  ]);

  /* Logo, haber gerçekten o şirketle ilgiliyse konur — `symbols` alanı
     haberin konusunu değil, çekildiği beslemeyi söyleyebiliyor. */
  const logoFor = (item: (typeof pool)[number]) => {
    const symbol = item.symbols?.[0];
    if (!symbol) return null;
    const meta = logos[symbol];
    if (!meta?.logoUrl) return null;
    return headlineMentions(item.headline, symbol, meta.name) ? meta.logoUrl : null;
  };

  return (
    /* KART IZGARASI, SATIR LİSTESİ DEĞİL. Satırlar 64 piksellik bir küçük
       resim + manşet + iki satırlık özet taşıyordu ve sağdaki görsel, metnin
       arkasından gelen bir ek gibi duruyordu. Kartta görsel ÖNCE geliyor ve
       16:9 oranında tam genişlik — haberi haber yapan şey orada.

       Özet düştü: manşet zaten haberin özeti ve altı manşetin altına altı
       özet koymak bloğu iki katına çıkarıyordu. Künye (kaynak · ne zaman)
       manşetin üstünde, çünkü "hangi kaynaktan ve ne kadar taze" sorusu
       başlığı okumadan önce sorulan soru. */
    /* `<ul>/<li>` KALIYOR. Kartlara geçerken düz `<div>` ızgarasına
       dönmüştü ve ekran okuyucu "altı öğelik liste" bilgisini kaybediyordu;
       görsel olarak hiçbir şey değişmiyor. */
    <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => {
        const headline =
          locale === "tr" && item.headlineTr ? item.headlineTr : item.headline;
        return (
          <li key={item.id} className="min-w-0">
            <Link
              href={`/haberler/${item.id}`}
              prefetch={false}
              className="panel panel-hover flex h-full min-w-0 flex-col overflow-hidden"
            >
              <NewsImage
                src={
                  item.imageUrl && !genericImages.has(item.imageUrl)
                    ? item.imageUrl
                    : null
                }
                logoUrl={logoFor(item)}
                /* Kartın kendi kenarlığı zaten var; görselin yalnızca ALT
                   kenarı gövdeden ayırıyor. */
                className="w-full rounded-none border-0 border-b border-line-soft"
                sizeClass="aspect-[16/9] h-auto w-full"
              />
              {/* DOM'DA MANŞET ÖNCE, EKRANDA KÜNYE ÜSTTE.
                  `flex-col-reverse` ikisini birden veriyor: bağlantının
                  erişilebilir adı manşetle başlıyor (yoksa ekran okuyucu her
                  kartta önce "7 saat önce · Benzinga" diyordu), görsel sıra
                  ise künyeyi manşetin üstünde tutuyor. */}
              <span className="flex min-w-0 flex-1 flex-col-reverse justify-end gap-1.5 p-4">
                <span
                  /* ÇEVRİLMEMİŞ SATIR KENDİ DİLİNİ TAŞIR. Çeviri rutini
                     gecikince TR sayfada İngilizce manşet duruyor ve `lang`
                     olmadan ekran okuyucu onu Türkçe fonemlerle sesletiyor.
                     Aynı kural /haberler listesinde ve mercek yazılarında
                     zaten uygulanıyor; kart yazılırken taşınmamıştı. */
                  lang={locale === "tr" && !item.headlineTr ? "en" : undefined}
                  className="line-clamp-3 text-read font-semibold leading-[19px] text-strong"
                >
                  {headline}
                </span>
                {/* KÜNYE BÜYÜK HARFE ÇEVRİLMİYOR. `.plate` ile yazılmıştı ve
                    kaynak adları İngilizce: `<html lang="tr">` altında
                    `text-transform: uppercase` Türkçe kuralı uyguluyor ve
                    "Benzinga" ekranda "BENZİNGA", "SeekingAlpha"
                    "SEEKİNGALPHA" oluyordu. */}
                <span className="text-nano tracking-[0.02em] text-muted">
                  <span className="numeral">{timeAgo(item.publishedAt, locale)}</span>
                  {item.source && (
                    <>
                      <span aria-hidden className="mx-1">
                        ·
                      </span>
                      {item.source}
                    </>
                  )}
                </span>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Haber ızgarasının iskeleti.
 *
 * ÖLÇÜ GERÇEK KARTIN ÖLÇÜSÜ: tek bir 16/10 blok basılıyordu ve gerçek kart
 * (16:9 görsel + üç satırlık metin bloğu) ondan seksen piksel uzundu — bant
 * çözülünce altındaki her şey aşağı zıplıyordu. İskelet artık kartın iki
 * parçasını ayrı ayrı taklit ediyor.
 */
function NewsGridSkeleton() {
  return (
    <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="panel overflow-hidden">
          <Skeleton className="aspect-[16/9] w-full rounded-none" />
          <div className="flex flex-col gap-2 p-4">
            <Skeleton className="h-4 w-full rounded-md" />
            <Skeleton className="h-4 w-4/5 rounded-md" />
            <Skeleton className="h-2.5 w-2/5 rounded-md" />
          </div>
        </div>
      ))}
    </div>
  );
}

function ListSkeleton({ rows }: { rows: number }) {
  return (
    <div className="flex flex-col gap-2 px-4 py-3 sm:px-5">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-9 w-full" />
      ))}
    </div>
  );
}

/* ==========================================================================
   Mercek — ana sayfanın okuma girişi
   ========================================================================== */

/**
 * Son mercek yazıları — manşet + üç satır.
 *
 * NEDEN LİSTE DEĞİL MANŞET. Bu blok eskiden dört başlıktan ibaret bir
 * listeydi ve yanındaki analiz paneliyle aynı ağırlıktaydı; okuyucu
 * başlıklara bakıp geçiyordu çünkü hiçbiri ne anlattığını söylemiyordu. En
 * yeni yazı artık manşet: giriş cümlesi okunuyor, yazının kahramanı
 * şirketlerin logoları görünüyor, tarih ve okuma süresi künyede. Arkasındaki
 * üç satır arşivin devamı — onlar liste kalıyor, çünkü işleri "daha var"
 * demek.
 *
 * LOGOLAR /mercek İLE AYNI KAYNAKTAN. Yazıların fotoğrafı yok ve olmayacak;
 * elimizdeki tek gerçek görsel şirket logoları (`symbols.logo_url`). Blok
 * onları manşetin künyesinde kullanıyor, arşiv kartlarındaki şeridin
 * sıkıştırılmış hâli gibi.
 *
 * Yazı yoksa blok kaybolmuyor, keşif karolarına düşüyor: hiç içerik
 * yazılmamış bir sitede ana sayfanın okuma girişi büsbütün yok olmasın.
 */
async function StoriesSpotlight({
  locale,
  t,
}: {
  locale: Locale;
  t: Dictionary;
}) {
  const stories = await getStories(locale, 4);

  if (stories.length === 0) return <ReadingDoors t={t} />;

  const [lead, ...rest] = stories;

  /* GÖRSEL YAZININ KENDİNDEN GELİYOR — gerekçesi StoryFigure'da. Manşetin
     gövdesi bunun için ayrıca okunuyor: liste sorgusu `body_md` taşımıyor
     (kırk satırlık arşivin tamamını gövdeleriyle çekmek için sebep yok),
     yalnızca manşet için tek satırlık ikinci bir sorgu atılıyor. */
  const full = await getStoryBySlug(lead.slug, locale);
  const figure = storyFigureOf(full?.bodyMd, full?.locale ?? locale);

  return (
    <section className="overflow-hidden rounded-xl border border-primary-faint bg-[linear-gradient(160deg,var(--primary-wash),var(--primary-tint))]">
      {/* Başlık şeridi panel başlıklarıyla aynı ölçüde: bloğu ayıran şey
          başlığın boyu değil, altındaki manşet ve eğri. Cesaret TEK yerde
          harcanıyor. */}
      <div className="flex items-center justify-between gap-3 px-4 py-3.5 sm:px-5">
        <h2 className="display-ink display-ink-tight w-fit text-read font-bold">
          {t.today.latestStories}
        </h2>
        <PanelLink href="/mercek">{t.common.showAll}</PanelLink>
      </div>

      <Link
        href={`/mercek/${lead.slug}`}
        prefetch={false}
        className="group block border-t border-primary-faint px-4 py-5 transition-colors hover:bg-primary-tint sm:px-5"
      >
        {/* MOBİLDE ÖNCE MANŞET, SONRA GÖRSEL.
            Bir süre tersiydi (`flex-col-reverse`): telefonda önce blok
            görülsün, ölçü kartlarıyla dolu ekranda duraklatan şey o olsun
            diye. Ekranda karşılığı başka çıktı — okuyucu bir kutu dolusu
            rakamla karşılaşıp neyin rakamı olduğunu ancak altındaki başlığı
            okuyunca anlıyordu; blok başlığın İLLÜSTRASYONU, tersi değil.
            DOM sırası zaten metin önceydi, yani ekran okuyucu için de
            değişen bir şey yok. Geniş ekranda metin solda, blok sağda:
            manşet dar kolonda üç satıra kırılıyor, geniş kolonda bir
            bakışta okunuyor. */}
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:gap-7">
          <div className="min-w-0 flex-1">
            <p className="numeral flex flex-wrap items-baseline gap-x-1.5 gap-y-1 text-tiny text-muted">
              <span className="text-base font-semibold text-body">
                {formatEtDateLong(lead.eventDate, locale)}
              </span>
              {lead.readMinutes ? (
                <>
                  <span aria-hidden>·</span>
                  <span>
                    {lead.readMinutes} {t.stories.readMinutes}
                  </span>
                </>
              ) : null}
              {/* Çevirisi olmayan yazı orijinal diliyle listeleniyor; rozet
                  bunu tıklamadan önce söylüyor — /mercek ile aynı kural. */}
              {lead.locale !== locale && (
                <span className="plate ml-1 text-micro tracking-[0.09em]">
                  {lead.locale.toUpperCase()}
                </span>
              )}
            </p>

            {/* MANŞET SAYFANIN İKİNCİ EN BÜYÜK METNİ. Blok bir süre 19
                puntoyla yazıldı ve çevresindeki panel başlıklarından
                ayrışmıyordu: aynı ağırlıkta bir kutu daha gibi duruyordu.
                Ölçü farkı, bloğun "burada okunacak bir şey var" demesinin en
                ucuz ve en sessiz yolu. */}
            <h3 className="display-ink mt-2.5 w-fit text-heading font-bold leading-[1.14] tracking-[-0.03em] sm:text-subdisplay">
              {lead.title}
            </h3>
            <p className="mt-3 line-clamp-3 max-w-[62ch] text-base leading-[21px] text-body sm:text-read sm:leading-[24px]">
              {lead.dek}
            </p>

            <p className="mt-4 inline-flex items-center gap-1.5 border-t border-primary-faint pt-3.5 text-small font-semibold text-primary">
              {t.guide.cardCta}
              <ArrowRight
                weight="bold"
                size={12}
                className="transition-transform group-hover:translate-x-0.5"
              />
            </p>
          </div>

          {figure && (
            <StoryFigure
              block={figure}
              className="lg:w-[292px] lg:shrink-0"
            />
          )}
        </div>
      </Link>

      {rest.length > 0 && (
        <ul className="border-t border-primary-faint bg-surface-solid">
          {rest.map((story) => (
            <li
              key={story.slug}
              className="border-t border-line-soft first:border-t-0"
            >
              <Link
                href={`/mercek/${story.slug}`}
                prefetch={false}
                className="flex min-h-11 items-baseline gap-3 px-4 py-2.5 transition-colors hover:bg-primary-tint sm:min-h-0 sm:px-5"
              >
                <span className="min-w-0 flex-1 text-base font-semibold leading-[19px] text-strong">
                  {story.title}
                </span>
                {/* Semboller künye, başlık değil: yazının kimi anlattığını
                    tıklamadan söylüyor. Dar ekranda düşüyor — orada satırın
                    işi yalnızca "daha var" demek. */}
                {story.symbols && story.symbols.length > 0 && (
                  <span className="numeral hidden shrink-0 text-tiny text-muted sm:inline">
                    {story.symbols.slice(0, 2).join(" · ")}
                  </span>
                )}
                <span className="numeral shrink-0 text-tiny text-muted">
                  {formatEtDateCompact(story.eventDate, locale)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* ==========================================================================
   Son analizler
   ========================================================================== */

/**
 * Son bilanço analizleri.
 *
 * Kapı (Tümünü Gör) başlıkta duruyor. Boş liste basılmıyor: analiz yoksa
 * panel hiç çıkmıyor ve ızgara satırı kendiliğinden kapanıyor — okuma girişi
 * yukarıdaki Mercek bloğunda zaten var.
 */
async function LatestAnalyses({
  locale,
  t,
}: {
  locale: Locale;
  t: Dictionary;
}) {
  const analyses = await getAnalyses(locale, { limit: 5 });

  if (analyses.length === 0) return null;

  const meta = await getSymbolNames([
    ...new Set(analyses.map((row) => row.symbol)),
  ]);

  return (
    <Panel className="min-w-0">
      <PanelHeader
        /* Başlık tonu ANA KOLONDA `title`: rol ayrımı yere değil İŞE bağlı
           ve bu bir kayıt listesi, gösterge değil. Panel bir tur yan kolonda
           dururken plakaya inmişti. */
        title={t.today.latestAnalyses}
        action={
          <PanelLink href="/bilancolar/analizler">{t.common.showAll}</PanelLink>
        }
      />
      <ul className="divide-y divide-line-soft">
        {analyses.map((row) => {
          const verdict = verdictOf(row.verdict);
          const logo = meta[row.symbol]?.logoUrl;
          return (
            <li key={`${row.symbol}-${row.period}`}>
              <Link
                href={analysisHref(row.symbol, row.period)}
                prefetch={false}
                className="flex items-center gap-2.5 px-4 py-3 transition-colors hover:bg-primary-tint sm:px-5"
              >
                <LogoTile symbol={row.symbol} logoUrl={logo} size="md" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-base font-semibold text-strong">
                    {row.company}
                  </span>
                  <span className="numeral block text-tiny text-muted">
                    {row.symbol} · {row.periodLabel}
                    <span aria-hidden className="mx-1.5">
                      ·
                    </span>
                    {formatEtDateShort(row.reportDate, locale)}
                  </span>
                </span>
                <span
                  className={cn(
                    "shrink-0 rounded-md px-2 py-[3px] text-tiny font-bold",
                    verdictPillClass(verdict),
                  )}
                >
                  {verdictLabel(verdict, t)} · {row.score}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

/**
 * Keşif karoları — yalnızca hiç yazı yokken.
 *
 * Sitenin ilk günlerindeki hâl: arşiv boşken ana sayfada okuma girişinin
 * büsbütün kaybolmaması için Mercek bloğunun yerine geçiyor.
 */
function ReadingDoors({ t }: { t: Dictionary }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {[
        { href: "/mercek", glyph: "◎", title: t.stories.title, hint: t.stories.subtitle },
        { href: "/rehber", glyph: "?", title: t.guide.title, hint: t.guide.subtitle },
      ].map((entry) => (
        <Link key={entry.href} href={entry.href}>
          <Panel className="panel-hover flex h-full items-start gap-3.5 p-4 sm:p-5">
            <GlyphTile glyph={entry.glyph} size={44} />
            <span className="min-w-0">
              <span className="display-ink display-ink-tight block w-fit text-read font-bold">
                {entry.title}
              </span>
              <span className="mt-1 block text-small leading-[19px] text-body">
                {entry.hint}
              </span>
            </span>
          </Panel>
        </Link>
      ))}
    </div>
  );
}

/**
 * Mercek manşetinin yer tutucusu.
 *
 * Bu blok bir liste paneli değil: başlık şeridi, altında manşet + eğri
 * ikilisi (mobilde alt alta, `lg`den itibaren yan yana) ve en altta üç
 * satırlık kuyruk. Bu yüzden `PanelSkeleton` yerine kendi düzenini taklit
 * ediyor — yükseklik yazılmıyor, aynı sarma kurallarından doğuyor.
 * Ölçüldü: gerçek blok mobilde 699, geniş ekranda 442 piksel; eskiden ikisi
 * için de 256 piksel ayrılıyordu.
 */
function SpotlightSkeleton() {
  return (
    <section className="overflow-hidden rounded-xl border border-primary-faint bg-[linear-gradient(160deg,var(--primary-wash),var(--primary-tint))]">
      <div className="flex items-center justify-between gap-3 px-4 py-3.5 sm:px-5">
        <Skeleton className="h-3.5 w-40" />
        <Skeleton className="h-2.5 w-20" />
      </div>
      <div className="border-t border-primary-faint px-4 py-5 sm:px-5">
        <div className="flex flex-col-reverse gap-5 lg:flex-row lg:items-start lg:gap-7">
          <div className="min-w-0 flex-1">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="mt-2.5 h-7 w-full" />
            <Skeleton className="mt-2 h-7 w-4/5" />
            <Skeleton className="mt-3 h-3.5 w-full" />
            <Skeleton className="mt-2 h-3.5 w-11/12" />
            <Skeleton className="mt-2 h-3.5 w-2/3" />
            <Skeleton className="mt-4 h-3 w-28" />
          </div>
          <Skeleton className="h-[168px] w-full rounded-lg lg:w-[292px] lg:shrink-0" />
        </div>
      </div>
      <div className="border-t border-primary-faint bg-surface-solid">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="flex items-center gap-3 border-t border-line-soft px-4 py-3.5 first:border-t-0 sm:px-5"
          >
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <Skeleton className="h-3 w-4/5" />
              <Skeleton className="h-2.5 w-24" />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
