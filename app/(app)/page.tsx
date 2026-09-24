import { withLocale } from "@/lib/i18n/routing";
import { cache, Suspense } from "react";
import { MotionExperience, ScrollProgress, SectionNav, SpotlightCard } from "@/components/motion/PremiumMotion";
import styles from "@/components/today/TodayExperience.module.css";
import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "@phosphor-icons/react/dist/ssr";
import { auth } from "@/auth";
import { GlyphTile } from "@/components/article/GlyphTile";
import { NewsImage } from "@/components/news/NewsImage";
import { BriefBody } from "@/components/today/BriefBody";
import { BriefSwitch, type BriefView } from "@/components/today/BriefSwitch";
import { Countdown } from "@/components/today/Countdown";
import { BellLedger } from "@/components/today/BellLedger";
import { DayFlowLoader } from "@/components/today/DayFlow";
import { loadDayFlow } from "@/lib/day-flow-data";
import { SessionRefresh } from "@/components/today/SessionRefresh";
import { ScoreRing } from "@/components/earnings/ScoreRing";
import { AnalysisBadge } from "@/components/earnings/AnalysisBadge";
import { LiveClock } from "@/components/today/LiveClock";
import { SessionRail } from "@/components/today/SessionRail";
import { IndexLive } from "@/components/today/IndexLive";
import { loadIndexFeed, sessionDomain } from "@/components/today/index-feed";
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
  getHolidays,
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
  isSessionTrade,
  quoteBasis,
  todayEt,
  type MarketStatus,
} from "@/lib/market-hours";
import {
  displayZone,
  formatInZone,
  nextZoneMidnight,
  timePair,
  zoneTag,
} from "@/lib/session-clock";
import { FillColumn } from "@/components/today/FillColumn";
import { TechnicalPulse } from "@/components/technical/TechnicalPulse";
import {
  TECHNICAL_SYMBOLS,
  editionClock,
  editionTime,
  newestEdition,
  nextEdition,
  pendingSymbols,
  slotLabel,
} from "@/lib/technical";
import { getTechnicalBoard } from "@/lib/technical-data";
import { getQuotes } from "@/lib/providers";
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
  formatPercent,
  formatEventValue,
  formatPercentPlain,
  formatPeriodLabel,
  formatPrice,
  headlineMentions,
  NO_VALUE,
  timeAgo,
  titleCaseLabel,
  unitLabel,
} from "@/lib/utils";
import { Sparkline } from "@/components/ui/Sparkline";
import {
  StoryFigure,
  storyFigureOf,
} from "@/components/stories/StoryFigure";
import { getChartBarsMulti } from "@/lib/providers";
import { getSeries } from "@/lib/providers/fred";
import { VIX_SERIES, vixBand } from "@/lib/vix";

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
    title: "Açılış Zili · ABD Piyasa Takibi",
    description:
      "ABD borsalarında bugün ne var: ekonomik takvim, bilanço tarihleri, haberler ve favori hisselerin, saatleriyle birlikte tek ekranda.",
  },
  en: {
    title: "Opening Bell · US Market Tracker",
    description:
      "What's happening in US markets today: economic calendar, earnings dates, news and your watchlist on one screen, with the times.",
  },
});

// İstek boyunca tek damga: tarih ve sunucu geri sayımı aynı anı okur.
const getPageTimestamp = cache(() => Date.now());

export default async function TodayPage() {
  const { locale, t } = await getI18n();
  const status = await getStatus();

  const sessionLabel: Record<string, string> = {
    regular: t.market.open,
    "pre-market": t.market.preMarket,
    "after-hours": t.market.afterHours,
    /* `holiday` YARIM GÜNDE de dolu (erken kapanış kaydı), tek başına
       "tatil" demiyor. 27 Kasım 2026 01:00 ET'de durum closed + holiday
       13:00 + tradingToday=true ve geri sayım aynı günün 17:30 TR açılışına
       sayarken rozet "Resmî Tatil" yazıyordu; 18:30 ET'de ve 24 Aralık
       17:00 ET sonrasında da aynısı. Tatil yalnızca işlem günü DEĞİLSE. */
    closed: status.holiday && !status.tradingToday
      ? t.market.holiday
      : status.isWeekend
        ? t.market.weekend
        : t.market.closed,
  };

  const trading = status.session === "regular";
  const countdownTarget = trading ? status.nextClose : status.nextOpen;
  const countdownLabel = trading ? t.today.countdownClose : t.today.countdownOpen;
  const nowMs = getPageTimestamp();
  const readerZone = displayZone(locale);
  const dateFormat = new Intl.DateTimeFormat(locale === "tr" ? "tr-TR" : "en-US", {
    timeZone: readerZone, day: "numeric", month: "long", weekday: "long",
  });
  /* Dar ekranın künyesi: "24 Eyl Per" — saatin yanına 320'de de sığıyor. */
  const dateShortFormat = new Intl.DateTimeFormat(locale === "tr" ? "tr-TR" : "en-US", {
    timeZone: readerZone, day: "numeric", month: "short", weekday: "short",
  });
  /* Kahramanın şeridi ile endeks kartlarının kıvılcım çizgileri AYNI
     ekseni okuyor — `sessionDomain`, gerekçe index-feed.ts'te. */
  const rail = sessionDomain(status);
  const tags = zoneTag(locale);
  const flowHeading = (
    <div className={styles.sectionHeading}>
      <h2>{t.today.todayFlow}</h2>
      <p>{t.today.experienceFlowNote}</p>
    </div>
  );
  const sessionState =
    status.session === "regular" ? "regular" : status.session === "closed" ? "closed" : "extended";
  /* Tazeleme anı: seansın bir sonraki sınırı ile OKUYUCUNUN gece yarısının
     erkeni. Üst şeritteki tarih ve zil künyesinin "Bugün / Yarın"ı okuyucunun
     gününe bağlı; yalnızca ET sınırında tazelenince TR okuyucu 00:00 ile
     03:00 (ya da 11:00) arasında dünün tarihini görüyordu. */
  const readerMidnight = nextZoneMidnight(nowMs, readerZone);
  const refreshAt =
    readerMidnight < status.nextTransition ? readerMidnight : status.nextTransition;

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
    <MotionExperience className={styles.page}>
      <ScrollProgress />
      {/* MASTHEAD IZGARANIN DIŞINDA, TAM GENİŞLİKTE. Kahraman blok sol
          kolonun içindeyken 878 piksele sıkışıyordu ve sayfanın imza anı —
          ürünün adını taşıyan geri sayım — yan kolondaki endeks kartlarıyla
          neredeyse aynı ölçekte kalıyordu. Izgaranın ÜSTÜNE alındı.
          `lg:col-span-2` denenmedi: sol kolon `lg:row-start-1` ile satır bire
          çivili ve kahraman ızgaraya girince iki kolonun satır yerleşimi
          çakışıyor. Dışarı almak aynı sonucu veriyor, ızgara hiç değişmiyor.

          İKİ KOLONUN DOLDURMA DENGESİ DEĞİŞİYOR: sol kolon kahraman kadar
          kısaldı ve `FillColumn` bunu kırpılmış listelere satır açarak
          kapatıyor — zaten bunun için var (CLAUDE.md "Boşluk esnetilmez,
          doldurulur"). Ölçüldü. */}
      {/* 1440px ölçümünde eski ana okuma 66px pazarlama başlığıydı;
          geri sayım 45px, NY kadranı 288px'ti. Kullanıcının önceliği zil:
          saat kadranı kaldırıldı, süre ana okuma oldu.

          22 EYLÜL: KUTULAR VE TARİH SATIRI GİTTİ. Geri sayım üç kutuda 59
          punto duruyordu, kopya kolonu ortalandığı için rozetin üstünde 45,
          tarih satırının altında 46 piksellik iki ölü bant vardı (1440).
          Şimdi tek bir rakam satırı (92 punto, kolona ölçekli) ve altında
          iki zilli künye (`BellLedger`): hangi zile sayıldığı, TR ve NY
          saati, sayaç sıfırlanınca sıradaki zil. Rozet sağdaki başlıkla,
          künyenin son satırı veri damgasıyla aynı hatta — ölçümler
          TodayExperience.module.css → `.heroCopy`. Saatler displayZone
          üzerinden yazılır, sabit fark yok. */}
      {/* 7 Eylül tercihi: dekoratif zilin yerine endeksler taşındı.
          Önceki kahraman 1440px'te 679px, 390px'te 848px yüksekliğindeydi.
          Geri sayım ve 2×2 piyasa paneli masaüstünde yan yana; mobilde
          doğal sırayla alt alta. Seans bilgisi geri sayımda korunur. */}
      {/* KÖŞE MOTİFİ BURADA YOK. `HeroAccent` sağ üst köşeye yerleşiyor ve bu
          kahramanda orası DOLU: tarih ile canlı saat tam oraya oturuyor,
          yay saatin arkasından geçiyordu (ölçüldü — 1440'ta "16 Eylül
          Çarşamba" ve saat satırlarıyla çakışıyor). Süs katmanı bilgi
          taşımıyor, yalnızca okunacak metnin arkasını kalabalıklaştırıyordu.
          Kartın kendi köşe ışıması da 23 Eylül'de kalktı; kahraman düz
          yüzeyde (tonla derinlik). */}
      <header id="piyasa-ozeti" className={styles.hero}>
        {/* GAZETE KÜNYESİ (24 Eylül). Üst şeridin solunda bir slogan
            ("ABD Piyasalarına Açılan Penceren") ve bir dalga simgesi
            duruyordu; tarih ise 1024'ün altında HİÇ görünmüyordu
            (`.dateline > span { display:none }`) — telefondaki okuyucu
            hangi günün sayacına baktığını ekranın hiçbir yerinde
            okuyamıyordu. Slogan gitti, yerine tarih geldi: geniş ekranda
            "24 Eylül Perşembe", dar ekranda "24 Eyl Per", saatin yanında. */}
        <div className={styles.heroTopline}>
          <div className={styles.toplineLead}>
            <p className={styles.dateline}>
              <time dateTime={new Date(nowMs).toISOString()} className={styles.dateLong}>{dateFormat.format(new Date(nowMs))}</time>
              <time dateTime={new Date(nowMs).toISOString()} className={styles.dateShort}>{dateShortFormat.format(new Date(nowMs))}</time>
            </p>
            {/* ZİL SAATLERİ TARİHİN YANINDA — gerekçe BellLedger.module.css. */}
            <BellLedger locale={locale} t={t} status={status} nowMs={nowMs} className={styles.toplineBells} />
          </div>
          <LiveClock locale={locale} initialNowMs={nowMs} />
        </div>
        <div className={styles.heroMain}>
          <div className={styles.heroCopy} data-motion-intro>
            {/* SEANS ÇİPİ: nokta seansı renkle de söylüyor — asıl seansta yeşil
                halkalı, uzatılmış seansta mavi, kapalıyken gri. */}
            <div className={styles.heroSession} data-state={sessionState}><span aria-hidden="true" />{sessionLabel[status.session]}</div>
            <h1 className={styles.headline}>{countdownLabel}</h1>
            {/* Rakam satırı ile zil şeridi TEK blok; rozet ve başlık tepede.
                Zil künyesi 24 Eylül'den beri üst şeritte, tarihin yanında
                (BellLedger.module.css). Ölçüm ve gerekçe
                TodayExperience.module.css → `.heroCopy`. */}
            <div className={styles.countdownBlock}>
              <Countdown
                targetIso={countdownTarget.toISOString()}
                initialNowMs={nowMs}
                units={{ d: t.today.countdownDays, h: t.today.countdownHours, m: t.today.countdownMinutes, s: t.today.countdownSeconds }}
                unitsShort={{ d: t.today.unitD, h: t.today.unitH, m: t.today.unitM, s: t.today.unitS }}
                label={countdownLabel}
                className={styles.countdown}
                ring
              />
              <SessionRail
                domain={rail.domain}
                openAt={rail.openAt}
                closeAt={rail.closeAt}
                day={rail.day}
                minutes={rail.minutes}
                live={status.session !== "closed"}
                target={trading ? "close" : "open"}
                initialNowMs={nowMs}
                labels={{
                  name: t.dayRail.marketHours,
                  selectEvent: t.dayFlow.selectEvent,
                  start: formatInZone(new Date(rail.domain[0] * 1000), readerZone),
                  end: `${formatInZone(new Date(rail.domain[1] * 1000), readerZone)} ${tags.primary}`,
                }}
              />
              {/* TABLETTE KÜNYE BURADA. 768–1023'te kolon endeks destesinin
                  boyuna gerili ve sayacın altında zaten boş hava var; künyeyi
                  üst şeride koymak kahramanı 509'dan 571 piksele uzatıyordu
                  (ölçüldü). Aynı künye iki yerde basılıyor ve her genişlikte
                  YALNIZCA biri görünüyor (`display:none` — ekran okuyucu da
                  bir kez duyuyor). */}
              <BellLedger locale={locale} t={t} status={status} nowMs={nowMs} className={styles.copyBells} />
            </div>
          </div>
          <section className={styles.indexDeck} aria-labelledby="hero-indices">
            {/* `text-read`: punto modülde (14px) ama genel `main h2` mürekkebi
                boyu sınıftan okuyor; sınıfsız başlık geniş degradeyi alıyordu
                ve açık ucu 14 pikselde AA'nın altında (globals.css notu). */}
            <div className={styles.indexHeading}><h2 id="hero-indices" className="text-read">{t.today.indices}</h2><span>{t.today.experienceIndexNote}</span></div>
            <Suspense fallback={<IndexSkeleton />}><IndexStrip locale={locale} t={t} /></Suspense>
          </section>
        </div>
      </header>

      {/* YÜZEN BÖLÜM DİZİNİ (24 Eylül). Bölüm bağlantıları gün akışının
          başlığında dört sekmelik bir şeritti: 1440'ta 46, 390'da 48 piksel
          tutuyor, ilk ekranda akışın başlığıyla yarışıyor ve kaydırınca
          kayboluyordu — tam da gerekli olduğu an. Dizin artık akışta yer
          tutmuyor (sabit bant, `variant="floating"`): kahraman başlığın
          arkasına geçince açılıyor, altı durağı var ve geniş ekranda sağında
          küçük bir geri sayım taşıyor; telefonda aşağı kaydırırken çekiliyor.
          Etiketler sözlükten: bir dönem bu sayfadan canlıya geçici bir test
          dizini sızmıştı, dizin yalnızca gerçek adlarla basılır. */}
      <SectionNav
        variant="floating"
        revealAfter="piyasa-ozeti"
        hideOnScrollDown
        label={t.today.sectionIndex}
        className={styles.sectionIndex}
        items={[
          { id: "gunun-akisi", label: t.today.navFlow },
          { id: "gundem", label: t.today.navBrief },
          { id: "dunya-piyasalari", label: t.today.navMarkets },
          { id: "mercek-seckisi", label: t.today.navStories },
          { id: "bugun-bilanco", label: t.today.navEarnings },
          { id: "haber-akisi", label: t.today.navNews },
        ]}
        trail={
          <span className={styles.miniCount}>
            <span>{trading ? t.today.miniToClose : t.today.miniToOpen}</span>
            <Countdown
              targetIso={countdownTarget.toISOString()}
              initialNowMs={nowMs}
              units={{ d: t.today.countdownDays, h: t.today.countdownHours, m: t.today.countdownMinutes, s: t.today.countdownSeconds }}
              unitsShort={{ d: t.today.unitD, h: t.today.unitH, m: t.today.unitM, s: t.today.unitS }}
              label={countdownLabel}
            />
          </span>
        }
      />

      <section id="gunun-akisi" className={styles.flowPanel}>
        {/* İSKELET GERÇEK ÖLÇÜYÜ AYIRIYOR. `h-28` yazıyordu, yani 112 piksel,
            ve akış 594–864 piksel geliyordu: yavaş ağda masaüstünde CLS 0,131
            ölçüldü, kaynağı tam olarak bu sıçramaydı. Yer tutucu o yüzden
            akışın ŞEKLİNİ taşıyor.
            24 EYLÜL: şerit kahramana taşındı ve kısa günde akış satır
            kartlarına indi (DayFlow, "KISA GÜN"); panel 1440'ta 211, 768'de
            255, 390'da 339, 320'de 366 piksel ölçüldü. İskelet artık başlık +
            iki satır kartı — en sık görülen günün şekli. Olay sayısı üçü
            geçen günde liste + sonuç paneli daha uzun ve ölçü tutmuyor;
            takas bilinçli, amaç eski 600 piksellik sıçramayı kapatmak. */}
        <Suspense
          fallback={
            <>
              <div className={styles.flowHeader}>{flowHeading}</div>
              <div aria-hidden className={cn("grid gap-3 pt-3.5", styles.flowSkeleton)}>
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
              </div>
            </>
          }
        >
          <RailSection t={t} locale={locale} heading={flowHeading} />
        </Suspense>
      </section>

    <div className={styles.dashboard}>
      {/* Seans sınırında sayfa kendini tazeler. Hiçbir şey çizmez, ızgarada yer
          kaplamaz. Geri sayım sıfıra inince orada kilitleniyor ve yeni güne
          ancak elle yenilemeyle geçiliyordu; gerekçenin tamamı bileşende.
          Hedef `refreshAt`: seans sınırı ile okuyucunun gece yarısının
          erkeni (yukarıda, `nextZoneMidnight`). */}
      <SessionRefresh atIso={refreshAt.toISOString()} />

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
        <div data-motion-reveal id="gundem" data-home-section="brief" className={styles.brief}><BriefCard locale={locale} t={t} /></div>

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
        <div id="mercek-seckisi" data-home-section="stories">
          <Suspense fallback={<SpotlightSkeleton />}>
            <StoriesSpotlight locale={locale} t={t} />
          </Suspense>
        </div>

        {/* ---- Bugün bilanço açıklayanlar ---- */}
        <div id="bugun-bilanco" data-home-section="earnings">
          <Suspense fallback={<EarningsTodaySkeleton t={t} />}>
            <EarningsToday locale={locale} t={t} />
          </Suspense>
        </div>

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
        <div id="bilanco-analizleri" data-home-section="analyses" className={styles.analyses}>
          <Suspense fallback={<PanelSkeleton rows={5} />}>
            <LatestAnalyses locale={locale} t={t} />
          </Suspense>
        </div>


      </div>

      {/* ================= Yan kolon =================
          Yalnızca ölçüler: endeksler → dünya → tahviller → makro → senin
          listen. Okunacak metin sol kolonda. */}
      <div
        data-col="side"
        className="flex min-w-0 flex-col gap-5 lg:col-start-2 lg:row-start-1"
      >
        {/* ENDEKS ŞERİDİ BURADAN MASTHEAD'E TAŞINDI. Dört endeks piyasanın
            MANŞET sayıları; yan kolonda bir gösterge tablosu satırıydılar,
            oysa "bugün borsa ne yaptı" sorusunun ilk cevabı onlar. Taşınma
            aynı zamanda iki kolonun dengesini geri kurdu: kahraman ızgaranın
            dışına çıkınca sol kolon 552 piksel kısa kalmıştı ve doldurma
            mekanizmasında kapatacak yalnızca bir gizli satır vardı. */}
        {/* Dünya piyasaları en üstte: "bugün borsalar ne yapmış" sorusunun
            ABD'den sonraki halkası. */}
        <div id="dunya-piyasalari" data-home-section="world">
          <Suspense fallback={<PanelSkeleton rows={5} footer />}>
            <WorldStrip locale={locale} t={t} />
          </Suspense>
        </div>

        {/* ---- Günün hareketleri ----
             SIRA ÖLÇEKTEN İNCEYE. Üstteki iki panel endeksleri ve dünyayı
             gösteriyor, yani "borsa bugün ne yaptı"; bu panel aynı soruyu
             bir basamak inceden soruyor: tek tek hangi isimler taşıdı. */}
        <div data-home-section="movers">
          <Suspense fallback={<PanelSkeleton rows={6} footer />}>
            <DayMovers locale={locale} t={t} />
          </Suspense>
        </div>

        {/* ---- Teknik görünüm ----
             HAREKET PANELİNİN HEMEN ALTINDA. İkisi aynı sorunun iki yarısı:
             hareket paneli "bugün hangi isim taşıdı" diyor, teknik panel
             "o isimlerde plan ne" diyor. Arada faiz ve makro dururken
             okuyucu ikisini bağlamıyordu — biri ölçü, öteki görüş ve
             ölçüden hemen sonra gelmeli.

             SİTENİN YAZDIĞI İÇERİĞİN ANA SAYFADA KENDİ YERİ VAR; teknik
             analizin yoktu ve ona yalnızca alt bilgiden ulaşılıyordu. Panel
             yan kolonda çünkü içeriği okunacak bir metin değil bir ölçü: on iki
             hissenin görüş dağılımı ve kimin hangi görüşte olduğu. Ana kolonda
             denendi ve ölçüldü: 292 piksel ana kolonu yan kolondan 1440'ta 345,
             1024'te 543 piksel uzun bırakıyordu (panelsiz fark ~33 piksel).
             Burada dengeyi iyileştiriyor. Aynı veriyle, aynı sayfada paneli
             gizleyerek ölçüldü: ana kolon panelsiz 1024'te 443, 1280'de 328
             piksel uzun kalıyor; panelle fark 158 ve 43 piksele iniyor
             (1440/1600'de ~40). Kolon boyları o günün verisiyle oynuyor, bu
             sayılar 11 Eylül akşamının verisi.
             Pano boşsa panel hiç basılmıyor, yer tutucu yok. */}
        <div data-home-section="technical">
          <Suspense fallback={null}>
            <TechnicalPanel locale={locale} t={t} />
          </Suspense>
        </div>

        <div data-home-section="yields">
          <Suspense fallback={<PanelSkeleton rows={3} footer />}>
            <YieldCard locale={locale} t={t} />
          </Suspense>
        </div>

        {/* Burada bir "Petrol ve Korku Endeksi" kartı vardı; kaldırıldı.
            Brent, FRED'in EIA spot serisinden geliyordu ve o seri günlerce
            geriden yayımlanıyor: 4 Ağustos'ta ekranda 27 Temmuz'un fiyatı
            duruyordu, aradaki pencerede varil 92'den 80'e inmişti. Bir
            fiyatı büyük puntoyla bir hafta geriden göstermek, küçük puntoda
            tarihini yazarak kurtarılamaz. Ücretsiz sağlayıcılarımızın
            hiçbirinde canlı emtia spotu yok, o yüzden metrik düştü.
            Korku Endeksi (VIX) ise günlük geliyor ve yaşıyor: alt şeritte
            her sayfada, /piyasalar'da bantlı göstergesiyle. */}
        <div data-home-section="macro">
          <Suspense fallback={<PanelSkeleton rows={3} footer />}>
            <MacroSummary locale={locale} t={t} />
          </Suspense>
        </div>

        {/* ---- Ekonomik takvim ----
             ANA KOLONDAN BURAYA TAŞINDI. İkisi de kısa, tarifeli listeler:
             saat, olayın adı ve bir rakam. Ana kolonda tam genişlikte
             durduklarında satırın sağ yarısı boş kalıyor ve iki panel,
             yanlarındaki uzun metinlerle (günün özeti, mercek manşeti) aynı
             ağırlıkta görünüyordu. Yan kolon zaten ölçülerin sütunu — takvim
             de bir ölçü, sadece geleceğin ölçüsü.

             Sıra bilinçli: bugünün olayları, sonra hafta, sonra senin
             listen. Ölçekten kişisel olana doğru. */}
        <Panel data-home-section="schedule">
          <PanelHeader
            title={t.today.schedule}
            tone="plate"
            action={<PanelLink href="/takvim">{t.common.showAll}</PanelLink>}
          />
          <Suspense fallback={<ListSkeleton rows={3} />}>
            <ScheduleList locale={locale} t={t} />
          </Suspense>
        </Panel>

        <Panel data-home-section="week">
          <PanelHeader
            title={t.today.weekAhead}
            tone="plate"
            action={<PanelLink href="/takvim">{t.common.showAll}</PanelLink>}
          />
          <Suspense fallback={<ListSkeleton rows={3} />}>
            <WeekAhead locale={locale} t={t} />
          </Suspense>
        </Panel>

        <div data-home-section="watchlist">
          <Suspense fallback={<PanelSkeleton rows={3} />}>
            <WatchlistSummary locale={locale} t={t} />
          </Suspense>
        </div>
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
      <section data-home-section="news" id="haber-akisi" className={cn(styles.news, "min-w-0 lg:col-span-2 lg:row-start-2")}>
        <div className="flex items-center justify-between gap-3 border-b border-line pb-3">
          <h2 className={styles.newsHeading}>
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

      {/* Kolon dengeleyici — hiçbir şey çizmez. İki kolonun dibini ölçüp
          kısa kalanın yedek satırlarını açıyor. Sayfa seviyesinde TEK KEZ
          duruyor: bir dönem favoriler listesinin içindeydi ve o yüzden
          yalnızca sağ kolonu doldurabiliyordu. */}
      <FillColumn />

      {/* ---- Kaynak künyesi ---- */}
      <footer data-home-section="sources" className="flex flex-wrap justify-between gap-x-6 gap-y-1 pt-2 text-tiny text-muted lg:col-span-2 lg:row-start-3">
        <span>{t.today.sourceLine}</span>
        <span>{t.today.sourceNote}</span>
      </footer>
    </div>
    </MotionExperience>
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
async function RailSection({ t, locale, heading }: { t: Dictionary; locale: Locale; heading: React.ReactNode }) {
  const session = await auth();
  const initial = await loadDayFlow(locale, session?.user?.id).catch(() => null);
  return <DayFlowLoader key={locale} initial={initial} locale={locale} labels={t.dayFlow} railLabels={t.dayRail} heading={heading} />;
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
   endeksin seviyesiymiş gibi okunuyordu. Ad tablosu kartla birlikte
   `components/today/IndexLive.tsx` içinde. */

/**
 * Endeks kartları — geri sayımın sağında, mobilde altında 2×2 ızgara.
 * Dar kolonda dört sütun okunmuyordu; ikişerli dizilim aynı bilgiyi
 * sıkışmadan taşıyor.
 *
 * KARTLAR ARTIK CANLI BİR YAPRAK (`IndexLive`): sunucu ilk paketi ve
 * barları veriyor, seans içinde istemci `/api/endeks`ten tazeliyor.
 * Paket `loadIndexFeed` — alt şeridin de okuduğu aynı `getQuotes` anahtarı.
 */
async function IndexStrip({ locale, t }: { locale: Locale; t: Dictionary }) {
  const status = await getStatus();
  /* Barlar TEK istekte: sembol başına ayrı çağrı hem dört Alpaca isteği
     hem dört `candles_cache` yazması demekti. */
  const [feed, bars] = await Promise.all([
    loadIndexFeed(status),
    getChartBarsMulti([...INDEX_STRIP], "1D", status),
  ]);

  if (!feed.ok) {
    return (
      <Panel>
        <DataError message={t.data.failed} hint={t.data.failedHint} />
      </Panel>
    );
  }

  /* KIVILCIM ÇİZGİSİ SAYIYLA AYNI SEANSI ANLATMALI.
     Kartta iki şey yan yana duruyor ve ikisi AYRI kaynaktan geliyor: yüzde
     kotasyondan, çizgi 1G barlarından. Barlar artık seansa bağlı
     (`cachedBarsUsable`) ama kotasyon sağlayıcı düştüğünde önbelleğe
     düşüyor ve önceki seansın yüzdesini taşıyor. O hâlde kartta bir
     önceki seansın yüzdesinin ALTINDA bu seansın şekli çiziliyor —
     damga "güncel olmayabilir" dese de çizgi sessizce başka bir gün
     anlatıyor. Şekil de bir iddia; sayı o seansa ait değilse çizilmiyor
     (paket bayatsa ya da kotasyonun `basis`i "lastClose" ise — kural
     `IndexLive` içinde). Aynı kural favoriler özetinde de var.

     EKSEN SEANSIN KENDİSİ (23 Eylül). Barlar zamanlarıyla 04:00–20:00 ET
     eksenine, önceki kapanış kesik bir taban çizgisi olarak çiziliyor;
     gerekçe ve ölçüm `components/ui/Sparkline.tsx` başında. Yalnızca
     zaman ve kapanış istemciye iniyor, barın öteki dört alanı değil. */
  const { domain, openAt } = sessionDomain(status);
  const points: Record<string, { time: number; value: number }[]> = {};
  for (const symbol of INDEX_STRIP) {
    points[symbol] = (bars[symbol] ?? []).map((bar) => ({ time: bar.time, value: bar.close }));
  }

  return (
    <IndexLive
      symbols={INDEX_STRIP}
      initial={feed}
      bars={points}
      domain={domain}
      openAt={openAt}
      session={status.session}
      locale={locale}
      labels={{
        noData: t.common.noData,
        preMarket: t.market.preMarket,
        afterHours: t.market.afterHours,
        lastClose: t.market.lastClose,
        data: t.data,
      }}
    />
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
              <p className="plate text-nano">{value.label}</p>
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
                  NO_VALUE
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
        <p className="border-t border-line-soft px-4 py-2 text-tiny text-muted sm:px-5">
          FRED · {formatEtDateCompact(observedAt, locale)}
        </p>
      )}

      {/* ---- Korku Endeksi ----
           Kendi kartı vardı ve o kart Brent'le eşleşmişti; Brent düşünce
           (FRED'in spot serisi günlerce geriden geliyor) VIX tek başına
           kaldı. Yeri burası: faiz de VIX de hisse tarafının arka planını
           okuyan, tek sayıdan ibaret ölçüler ve ikisi de aynı FRED
           beslemesinden günlük geliyor. Bantlı tam göstergesi
           /piyasalar'da — eşikler oradan, tek yerden okunuyor. */}
      {/* İKİ KAT, TEK SATIR DEĞİL. Etiket, değer, bant, tarih ve değişim
          aynı esnek satırda ve beşi de `shrink-0` idi: 348 piksellik yan
          kolonda içerik 349 piksel tutuyor, iç dolguyu tüketip kartın
          kenarından kesiliyordu ("Puan" yarım okunuyordu); 320'de taşma 67
          piksele çıkıyordu (ölçüldü, 22 Eylül). Artık faiz hücreleriyle
          aynı kalıp: solda ad ve bant, sağda sayı ve altında değişimi. */}
      {vixLevel !== null && vixTone && (
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 border-t border-line px-4 py-3">
          <div className="flex min-w-0 flex-col items-start gap-1.5">
            <span className="plate text-nano">
              {t.markets.fearTitle}
            </span>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-tiny font-semibold",
                vixTone.band.tone === "up" && "bg-up-wash text-up",
                vixTone.band.tone === "flat" && "bg-surface-elevated text-body",
                vixTone.band.tone === "warn" && "bg-brass-wash text-brass-ink",
                vixTone.band.tone === "down" && "bg-down-wash text-down",
              )}
            >
              {vixTone.label}
            </span>
          </div>
          <div className="flex flex-col items-end gap-1 text-right">
            <span className="tote text-lead leading-none">
              {formatPrice(vixLevel, locale, { digits: 2 })}
            </span>
            {((vixDate && vixDate !== observedAt) || (vixDelta !== null && vixDelta !== 0)) && (
              <span className="flex flex-wrap items-baseline justify-end gap-x-2">
                {/* Tarih yalnızca faiz künyesinden FARKLIYSA yazılıyor: aynı
                    günse üstteki künye zaten söylüyor ve tekrar etmek satırı
                    gereksiz kalabalıklaştırır. */}
                {vixDate && vixDate !== observedAt && (
                  <span className="numeral text-tiny text-muted">
                    {formatEtDateCompact(vixDate, locale)}
                  </span>
                )}
                {vixDelta !== null && vixDelta !== 0 && (
                  <span
                    className={cn(
                      "numeral text-tiny font-semibold",
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
              </span>
            )}
          </div>
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
  /* SAĞLAYICI DÜŞTÜĞÜNDE PANEL KAYBOLMUYOR, SÖYLÜYOR.
     `!result.ok` dalı `null` dönüyordu: aynı arıza endeks şeridinde ve
     hareket panelinde "Veri alınamadı" yazarken bu panel sessizce sayfadan
     siliniyordu. İki zarar birden — okuyucu sitenin dünya piyasalarını
     izlediğini hiç öğrenemiyor, ve sayfanın o günkü hâli ile bir başka
     günkü hâli arasındaki fark açıklanmıyor. Ayrımı doğru yerden kurmak
     gerekiyordu: SAĞLAYICI ARIZASI bir haber, YAYIN OLMAMASI değil. Pano
     boş diye çizilmeyen teknik panel ile faizi hiç gelmeyen tahvil kartı
     (ikisi de `null` dönüyor) ikinci gruba giriyor — orada bir arıza yok,
     gösterilecek bir şey yok. Burada bir arıza var. */
  if (!result.ok) {
    return (
      <Panel>
        <PanelHeader title={t.today.worldMarkets} tone="plate" />
        <DataError message={t.data.failed} hint={t.data.failedHint} />
      </Panel>
    );
  }

  /* Kotasyon geldi ama HİÇBİR dünya sembolü dönmediyse bu da bir arıza:
     liste sabit (`WORLD_MARKETS`), "bugün bu fonlar yok" diye bir hâl yok. */
  const shown = WORLD_MARKETS.filter((market) => result.data[market.symbol]);
  if (shown.length === 0) {
    return (
      <Panel>
        <PanelHeader title={t.today.worldMarkets} tone="plate" />
        <DataError message={t.data.failed} hint={t.data.failedHint} />
      </Panel>
    );
  }

  /* YÜZDE HANGİ SEANSI ANLATIYOR (Veri dürüstlüğü 4, 23 Eylül).
     Açılış öncesinde (11:46 TR) satır "Türkiye −%0,77" yazıyordu ve
     damgası "11:30 Güncellendi"ydi; aynı sembol /hisse/TUR'da "22 Eylül
     23:00 Güncellendi · Güncel Olmayabilir" diyordu — son işlem dünkü
     kapanıştı, yani −0,77 DÜNÜN hareketiydi. Damga çekim anını söylüyor,
     işlemin yaşını değil. Günün Hareketleri paneli bu hatayı bir kez
     düzeltmişti (`isSessionTrade`); bu panel sormuyordu.
     Kural `quoteBasis`te tek yerde: bu seansa ait işlem yoksa yüzde yön
     rengini bırakıyor, altında "Son Kapanış" künyesi duruyor. Satırların
     hiçbiri bu seansta işlem görmediyse künye cümlesi de bunu söylüyor. */
  const bases = Object.fromEntries(
    shown.map((market) => [market.symbol, quoteBasis(result.data[market.symbol], status)]),
  );
  const allLastClose = shown.every((market) => bases[market.symbol] === "lastClose");

  return (
    <Panel>
      <PanelHeader title={t.today.worldMarkets} tone="plate" />
      <ul>
        {shown.map((market) => {
          const quote = result.data[market.symbol];
          const lastClose = bases[market.symbol] === "lastClose";
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
                      sarıyor, ondan sonrası kesiliyor.
                      12 PUNTO (23 Eylül): 10 puntoda sayfanın 54 okunmayan
                      metin düğümünden beşi buydu; 390'da hâlâ iki satıra
                      sığıyor. */}
                  <span className="mt-0.5 line-clamp-2 block text-small leading-tight text-muted sm:truncate">
                    {locale === "tr" ? market.tracksTr : market.tracksEn}
                  </span>
                  {lastClose && (
                    <span className="mt-0.5 block text-tiny font-semibold text-body">
                      {t.market.lastClose}
                    </span>
                  )}
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
                    "numeral shrink-0 text-read",
                    lastClose ? "font-semibold text-body" : cn("font-bold", directionText(tone)),
                  )}
                >
                  {formatPercent(quote.changePct, locale)}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
      {/* DAMGA BURADA DA VAR. Künye fonun neyi vekil ettiğini söylüyordu ama
          yüzdelerin yaşını söyleyen hiçbir şey yoktu; panel tam da bayat
          veriyi büyük puntoyla göstermenin yasak olduğu yerdi. */}
      <div className="border-t border-line px-4 py-3 sm:px-5">
        <p className="text-tiny leading-relaxed text-muted">
          {allLastClose ? t.today.worldLastCloseHint : t.today.worldMarketsHint}
        </p>
        <DataStamp
          labels={t.data}
          source={result.source}
          at={result.fetchedAt}
          stale={result.stale}
          locale={locale}
          className="mt-1.5"
        />
      </div>
    </Panel>
  );
}

function IndexSkeleton() {
  // The previous deck measured 156px / mobile 135px. Use the final card's
  // minimum size and shared 2×2 grid while the right-hand panel streams in.
  return (
    <div className="flex flex-col gap-2.5">
      <div data-motion-stagger className={styles.indexGrid}>
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className={styles.indexSkeleton} />
        ))}
      </div>
      <Skeleton className="h-3 w-64 max-w-full" />
    </div>
  );
}

/**
 * Günün özeti — düz beyaz belge ve accent çerçeve (degradesi bir dönem
 * kalktı, gerekçe BriefSwitch'te). Bu kartın öne çıkması bilinçli: günü tek
 * paragrafta okumak ürünün vaadi.
 *
 * Kart iki metin taşıyor: günlük ve haftalık bülten. İkisi de burada
 * çekiliyor, sekme geçişi istemcide oluyor (BriefSwitch).
 *
 * "Bugünün kaydı" yerine "en son kayıt" okunuyor. Günlük bülten 16:00'da
 * yazıldığı için gün içinde saatlerce boş duran bir kutu vardı; artık dünkü
 * metin duruyor ve üstünde tarihini söyleyen bir uyarı var.
 */
/* ÖZET, BİLANÇO LİSTESİ KISAYSA UZUYOR. Sol kolonun boyu büyük ölçüde iki
   panele bağlı: günün özeti ve bugün bilanço açıklayanlar. İkincisi o günün
   takvimine bakıyor ve boş bir günde 113 piksele düşüyor (ölçüldü, iki
   satır) — o gün sol kolon sağdan 197 piksel kısa kalıyor ve `FillColumn`
   kapatacak yalnızca bir gizli satır buluyor.

   Kısa günde özetin katlanma noktası iki paragraf aşağı iniyor. Sayı
   ölçümden: açık dört paragraf 308 piksel tutuyor, yani paragraf başına
   ortalama 77 — iki paragraf açığın çoğunu kapatıyor, kalanı doldurma
   mekanizmasına kalıyor. Paragraf boyları 44 ile 132 piksel arasında
   değiştiği için hedef tam tutturulmuyor; amaç eşitlemek değil, uçurumu
   kapatmak.

   SAYIM BEDAVA: `getEarningsBetween` `cache()` sarmalı ve aynı istek içinde
   `EarningsToday` de aynı sorguyu soruyor — sağlayıcıya bir kez gidiliyor. */
const KISA_BILANCO_ESIGI = 3;
const OZET_TABAN_SATIR = 4;
const OZET_EK_SATIR = 4;

async function BriefCard({ locale, t }: { locale: Locale; t: Dictionary }) {
  const today = todayEt();
  const [daily, weekly, bugunBilanco] = await Promise.all([
    getLatestBrief(locale, "daily"),
    getLatestBrief(locale, "weekly"),
    getEarningsBetween(today, today),
  ]);
  const acikSatir =
    bugunBilanco.length < KISA_BILANCO_ESIGI
      ? OZET_TABAN_SATIR + OZET_EK_SATIR
      : OZET_TABAN_SATIR;

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
      .replace("{start}", formatEtDateCompact(anchor, locale))
      .replace("{end}", formatEtDateCompact(addEtDays(anchor, 4), locale));

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
            size="card-wide"
            markdown={daily.bodyMd}
            moreLabel={t.common.showAll}
            lessLabel={t.common.less}
            openLines={acikSatir}
          />
        )
      }
      weeklyBody={
        weekly && (
          <BriefBody
            size="card-wide"
            openLines={acikSatir}
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
    return <EmptyState compact title={t.today.scheduleEmpty} />;
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
                {times ? times.primary : NO_VALUE}
              </span>
              {times && (
                <span className="numeral block text-tiny leading-tight text-muted">
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
                <span className="block text-tiny leading-tight text-muted">
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
 * YALNIZCA BU SEANSTA İŞLEM GÖRENLER — panelin en önemli kuralı.
 * Ön seansta bir hissenin çoğu hiç işlem görmüyor; o sembolün "son işlemi"
 * dünkü kapanış oluyor ve değişimi de DÜNÜN değişimi. Süzgeç olmasaydı liste,
 * bu sabah hiç kımıldamamış hisselerin dünkü hareketleriyle dolardı.
 *
 * SÜZGEÇ BİR DÖNEM YALNIZCA UZATILMIŞ SEANSTA ÇALIŞIYORDU ve buradaki
 * gerekçe şöyle yazılıydı: "Normal seansta ve kapalıyken böyle bir ayrım yok,
 * `changePct` zaten o günün kapanışına göre." Cümle sağlayıcı taze veri
 * döndürdüğü sürece doğru — ama `changePct`in hangi günün kapanışına göre
 * olduğuna sağlayıcı karar veriyor, biz değil. Alpaca düştüğünde (514
 * sembollük evrende Finnhub yedeği hiç denenmiyor, sınır sekiz sembol) Neon
 * önbelleğine düşülüyor ve o önbellek ÖNCEKİ seansın yüzdelerini taşıyor.
 * 17 Eylül 11:51'de, seans açıkken, panelde 16 Eylül kapanışının sıralaması
 * duruyordu: GNRC %+20,66 · SMCI %+10,35 · INTC %+9,73, künyesi de "seans
 * içi". Okuyucunun gördüğü şey dünkü hareketti.
 *
 * Kural artık her seansta aynı: sıralamaya giren her sayının işlem günü
 * `status.sessionDate` olmalı (gerekçesi o alanın üzerinde). Uzatılmış
 * seansta dakika tabanı da duruyor — orada soru yalnızca "bugün mü" değil,
 * "bu seansta mı".
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
      /* İşlem günü seansın günü olmalı — her seansta. */
      const tradedAt = quote.tradedAt;
      if (!tradedAt || !isSessionTrade(tradedAt, status)) return false;
      if (!extended) return true;
      /* Uzatılmış seansta gün yetmiyor: işlem o PENCEREDE olmalı. */
      return etParts(tradedAt).minutes >= sinceMinutes;
    })
    .map((row) => ({ symbol: row.symbol, quote: row.quote! }));

  const ranked = [...usable].sort(
    (a, b) => (b.quote.changePct ?? 0) - (a.quote.changePct ?? 0),
  );
  /* ÜÇ SATIR TABAN, BEŞE KADAR YEDEK — sağ kolonun doldurma kapasitesi
     (24 Eylül). Giriş yapmamış okuyucunun favori paneli tek satıra inince
     (227 → 72 piksel) sağ kolonun açabileceği tek liste haftaya bakış
     kaldı ve takvimin boş olduğu bir günde 1024'te sağ kolon 129 piksel
     kısa bitiyordu (ölçüldü). Sıralama zaten elde: dördüncü ve beşinci
     isim sunucuda basılıyor, `FillColumn` ancak yer varsa açıyor. */
  const gainers = ranked.filter((row) => (row.quote.changePct ?? 0) > 0).slice(0, MOVERS_MAX);
  const losers = ranked
    .filter((row) => (row.quote.changePct ?? 0) < 0)
    .slice(-MOVERS_MAX)
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

  /* BOŞ LİSTENİN İKİ AYRI SEBEBİ VAR ve ikisi aynı cümleyle anlatılamaz:
     ya gerçekten sıralanacak hareket yok, ya elimizdeki paket bu seansa ait
     değil. İkincisinde "bugün hareket yok" demek olmayan bir şeyi iddia
     etmek olurdu; doğru cümle "bu seansın verisi alınamadı" — kart boş, ama
     boşluğun sebebi piyasa değil biz. */
  if (gainers.length === 0 && losers.length === 0) {
    return (
      <Panel>
        <PanelHeader title={title} tone="plate" />
        {result.stale ? (
          <DataError message={t.data.failed} hint={t.data.failedHint} />
        ) : (
          <EmptyState
            title={extended ? t.today.moversEmpty : t.today.dayMoversEmpty}
            hint={note}
          />
        )}
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
      <p className="plate px-4 pb-1.5 pt-3.5 text-nano sm:px-5">
        {heading}
      </p>
      <ul>
        {rows.length === 0 ? (
          <li className="px-4 pb-3.5 text-small text-muted sm:px-5">{t.common.noData}</li>
        ) : (
          rows.map((row, index) => (
            <li
              key={row.symbol}
              data-fill={index >= MOVERS_BASE ? "" : undefined}
              hidden={index >= MOVERS_BASE}
              suppressHydrationWarning
            >
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
                  <span className="block truncate text-tiny leading-tight text-muted">
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
      {/* KÜNYE VE DAMGA BİRLİKTE. Panel uzun süre yalnızca "514 endeks üyesi
          tarandı · seans içi" yazıyordu: kaç sembolün tarandığını söylüyor,
          sayıların NE ZAMAN alındığını söylemiyordu. Yan kolondaki
          komşularının (endeksler, favoriler) hepsinde damga vardı; en hızlı
          bayatlayan sayıları basan panelde yoktu. */}
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-t border-line-soft px-4 py-2 sm:px-5">
        <p className="text-tiny text-muted">{note}</p>
        <DataStamp
          labels={t.data}
          source={result.source}
          at={result.fetchedAt}
          stale={result.stale}
          locale={locale}
        />
      </div>
    </Panel>
  );
}

/* Günün hareketlerinin taban ve yedekli tavan satır sayısı (blok başına). */
const MOVERS_BASE = 3;
const MOVERS_MAX = 5;

/** Başlıksız iskelet — panelin kendi başlığı bileşenin içinde. */
function EarningsTodaySkeleton({ t }: { t: Dictionary }) {
  return (
    <Panel>
      <PanelHeader
        title={t.today.earningsToday}
        tone="plate"
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
          tone="plate"
          action={<PanelLink href="/bilancolar">{t.common.showAll}</PanelLink>}
        />
        <EmptyState compact title={t.earnings.empty} />
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
        /* PLAKA BAŞLIK — PANOdaki öteki VERİ panelleriyle aynı aile.
           Bu panel başlığın büyük (`title`) tonundaydı ve hemen üstündeki
           "Bugünün Takvimi" ile "Haftaya Bakış" plakayken yan yana iki ayrı
           başlık ailesi okunuyordu. Kural: sitenin KENDİ YAZDIĞI içerik
           (mercek, bilanço analizi, bülten) büyük başlık alıyor, piyasa
           verisi panelleri plaka. Bugün açıklayanlar bir takvim listesi. */
        tone="plate"
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
          /* SABİT SÜTUNLAR (23 Eylül). Satır esnek bir diziydi ve EPS
             beklentisi yalnızca değer varsa basılıyordu: beklentisiz
             satırda zaman rozeti sağ uca kayıyor, "Açılış Öncesi" ile
             "Saat Belirsiz" farklı hatlarda duruyordu. Izgarada rozet ve
             EPS sütunu her satırda aynı yerde; değer yoksa sütun boş kalır
             ama yerini tutar. */
          <li
            key={row.id}
            className="relative grid grid-cols-[auto_minmax(0,1fr)_7.5rem] items-center gap-3 border-t border-line px-4 py-3 transition-colors hover:bg-primary-tint sm:grid-cols-[auto_minmax(0,1fr)_7.5rem_5.5rem] sm:gap-4 sm:px-5"
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
              <AnalysisBadge badge={badge} t={t} size="sm" className="w-full justify-center" />
            ) : (
              <TimingChip
                className="w-full justify-center"
                tone={row.hour === "bmo" ? "pre" : row.hour === "amc" ? "post" : "neutral"}
              >
                {row.hour ? (hourLabel[row.hour] ?? t.earnings.timeUnknown) : t.earnings.timeUnknown}
              </TimingChip>
            )}
            {row.epsEstimate !== null ? (
              <span className="hidden text-right sm:block">
                <span className="numeral block text-base font-semibold leading-tight text-body">
                  {formatPrice(row.epsEstimate, locale, { currency: true })}
                </span>
                <span className="block text-tiny leading-tight text-muted">
                  {t.earnings.epsEstimate}
                </span>
              </span>
            ) : (
              <span aria-hidden className="hidden sm:block" />
            )}
          </li>
        );
      })}
      </ul>
    </Panel>
  );
}

/** Favoriler listesinin taban satır sayısı ve yedeklerle birlikte tavanı. */
/* Sol kolonun yedek kapasitesi — gerekçe `LatestAnalyses` içinde. */
const ANALYSES_BASE = 5;
const ANALYSES_MAX = 8;

/* Sağ kolonunki — gerekçe `WeekAhead` içinde. */
const WEEK_AHEAD_BASE = 3;
const WEEK_AHEAD_MAX = 6;

const WATCHLIST_BASE = 5;
const WATCHLIST_MAX = 10;

async function WatchlistSummary({ locale, t }: { locale: Locale; t: Dictionary }) {
  const session = await auth();

  /* GİRİŞ YAPMAMIŞ OKUYUCUYA TEK SATIR (24 Eylül). Panel "Favori Listen
     Boş" diyen tam bir boş durumdu (simge, iki satır metin, düğme — 227
     piksel) ve telefonda bugünün bilançolarından ÖNCE duruyordu: listesi
     olmayan okuyucu, sayfanın asıl içeriğine varmadan bir davetle
     karşılaşıyordu. Üstelik "boş" yanlıştı — giriş yapınca bir listesi
     olabilir. Artık solda ne göreceğini söyleyen tek cümle, sağda giriş;
     telefonda sıra da bilançoların ve analizlerin ardına iniyor
     (TodayExperience.module.css, `:has(a[href$="/giris"])`). */
  if (!session?.user?.id) {
    return (
      <Panel className="flex items-center justify-between gap-4 px-4 py-3 sm:px-5">
        <div className="min-w-0 flex-1">
          <h2 className="plate">{t.today.watchlistSignedOutTitle}</h2>
          <p className="mt-1 text-small leading-[1.3] text-body">{t.today.watchlistSignedOutHint}</p>
        </div>
        <ButtonLink href="/giris" variant="primary" className="shrink-0">
          {t.nav.signIn}
        </ButtonLink>
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
  /* LOGO: favori satırı sayfadaki tek çıplak sembol sütunuydu. Aynı sayfada
     yükselenler, günün bilançoları ve son analizler hep logosuyla duruyor;
     okuyucunun EN ÇOK taradığı liste, yani kendi favorileri, iki harflik
     yedeğe düşüyordu. `/favoriler` sayfası bu düzeltmeyi zaten yapmış
     (orada gerekçesi yazılı); ana sayfadaki özet atlanmış.
     Sorgu ücretsiz sayılır: `getSymbolNames` istek içinde önbellekli ve
     anahtarı sıralı sembol dizesi, aynı sayfada beş kez daha çağrılıyor. */
  const [result, bars, names] = await Promise.all([
    getQuotes(shown, status),
    getChartBarsMulti(shown, "1D", status),
    getSymbolNames(shown),
  ]);
  /* Şekil sayıyla aynı seansı anlatmalı — gerekçe `IndexStrip` içinde. */
  const sparkOk = result.ok && !result.stale;

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
                  /* `data-fill`: açılabilir yedek satır. Boyu `FillColumn`
                     satırı açıp ölçerek buluyor, ayrı bir örnek satır
                     işaretlemeye gerek yok. */
                  data-fill={index >= WATCHLIST_BASE ? "" : undefined}
                  hidden={index >= WATCHLIST_BASE}
                  suppressHydrationWarning
                  className="border-t border-line first:border-t-0"
                >
                  <Link
                    href={`/hisse/${symbol}`}
                    className="flex items-center gap-3 py-2.5 transition-colors hover:opacity-80"
                  >
                    <LogoTile symbol={symbol} logoUrl={names[symbol]?.logoUrl} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-base font-bold text-strong">
                        {symbol}
                      </span>
                      {names[symbol]?.name && (
                        <span className="block truncate text-tiny text-muted">{names[symbol]!.name}</span>
                      )}
                    </span>
                    {sparkOk && points.length > 1 && (
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

/* DÖRT SERİ AÇIKÇA SEÇİLİYOR — bir dönem `rows.slice(0, 4)` yazıyordu ve
   `getMacroRows` satırları SLUG'A GÖRE ALFABETİK döndürüyor. Yani panelin
   künyesi "dört ana seri" derken ekrana çıkanlar tesadüfen alfabenin ilk
   dördüydü: core-cpi, core-pce, cpi, fed-funds. Dördün üçü enflasyon ölçüsü,
   ikisi (TÜFE ve Çekirdek TÜFE) 2×2 ızgarada yan yana duran neredeyse aynı
   sayı, ve iş gücü tarafı ana sayfada HİÇ görünmüyordu — oysa aynı sayfanın
   gün şeridi istihdam raporunu yüksek etkili olay diye basıyor.

   Sıralama bir sunum niyeti taşımıyor; taşıdığını sanmak da seri listesine
   yeni bir slug eklendiği gün paneli sessizce değiştirirdi. Seçim artık
   editoryal: enflasyondan bir ölçü, fiyat tercihinden bir ölçü, iş gücünden
   bir ölçü, politikadan bir ölçü. Kalıp TODAY_YIELDS ile aynı. */
const MACRO_HOME_SLUGS = [
  "cpi",
  "core-pce",
  "unemployment",
  "fed-funds",
] as const;

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

  /* Listede olmayan bir slug sessizce atlanır; tohumlama eksikse panel
     üç ölçüyle çıkar, boş bir hücre basmaz. */
  const shown = MACRO_HOME_SLUGS.map((slug) =>
    rows.find((row) => row.slug === slug),
  ).filter((row) => row !== undefined);
  if (shown.length === 0) return null;
  /* HİÇBİRİNİN DEĞERİ YOKSA PANEL HİÇ BASILMIYOR. Satırlar veritabanında
     tohumla açılıyor ve değerleri FRED senkronu dolduruyor; senkron hiç
     koşmamışsa dört başlık, dört tire ve dört "Veri yok" satırı 208 piksel
     yer kaplıyor (390'da ölçüldü) ve tek söylediği şey hiçbir şey
     bilmediğimiz. Aynı kural tahvil kartında zaten var (`YieldCard`,
     `values.every(...)`): bir ölçü panelinin boş hâli, boş bir ölçü paneli
     değil, hiç panel olmamasıdır. Tek tek boş kalan satır duruyor — orada
     "bilinmiyor" bir bilgi, çünkü yanındaki satırda bir sayı var. */
  if (shown.every((row) => row.latestValue === null)) return null;

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
          /* Yüzde OLMAYAN seri (istihdam, bin kişi) `digits: 0` ister.
             `formatPrice`in varsayılanı 2 ve /makro aynı seriyi 0 ile
             yazıyor: seçim düzeltilip `payrolls` panele girdiği anda bu
             panel "147,00", /makro "147" diyecekti. Aynı sayının iki ekranda
             farklı görünmesi bu depoda bir kez düzeltilmiş bir hata.

             BİRİM DE YAZILIYOR — aynı hatanın ikinci yarısıydı. Basamak
             sayısı hizalanmıştı ama birim düşüyordu: PAYEMS burada ve
             /makro'da birimsiz "-23", ekonomik takvimde ise "-23 bin"
             görünüyordu. Etiket kararı lib/utils.ts → `unitLabel`. */
          const birim = unitLabel(row.unit, locale);
          const show = (value: number) =>
            isPct
              ? formatPercentPlain(value, locale, 2)
              : `${formatPrice(value, locale, { digits: 0 })} ${birim}`.trimEnd();
          return (
            <div key={row.seriesId}>
              <p className="truncate text-tiny text-muted">
                {locale === "tr" ? row.titleTr : row.titleEn}
              </p>
              <p className="tote mt-0.5 text-title">
                {latest !== null ? show(latest) : NO_VALUE}
              </p>
              {/* DÖNEM KÜNYESİ. Sayı 23 puntoyla basılıyor ama hangi aya ait
                  olduğu yazmıyordu; TÜFE ve istihdam haftalar geriden
                  yayımlanır ve okuyucu bunu bugünün verisi sanıyordu. Makro
                  ekranı aynı sayının yanına bu künyeyi zaten koyuyor. */}
              {row.periodLabel && (
                <p className="text-tiny text-muted">
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
    return <EmptyState compact title={t.today.weekAheadEmpty} />;
  }

  const tags = zoneTag(locale);

  /* ÜÇ SATIR TABAN, ALTIYA KADAR YEDEK — sağ kolonun doldurma kapasitesi.
     Kapasite bir dönem YALNIZCA favoriler listesindeydi ve o liste giriş
     yapmamış okuyucuda hiç yok: ölçüldü, 1024–1100 pikselde sağ kolon 114 ile
     244 piksel kısa kalıyordu ve açılacak tek bir satır bile bulunmuyordu.
     Haftaya bakış her okuyucuda var ve zaten kırpılmış bir liste. */
  return (
    <ul>
      {events.slice(0, WEEK_AHEAD_MAX).map((event, index) => {
        const times = event.eventTimeEt
          ? timePair(event.eventDate, event.eventTimeEt, locale)
          : null;
        return (
          /* TELEFONDA TARİH SÜTUNU DEĞİL KÜNYE SATIRI.
             Sütun 86 piksel genişti ve "24 Eylül Perşembe" oraya sığmıyor:
             tarih üç satıra (gün, gün adı, saat) çıkarken olayın adı tek
             satırda kalıyor, satır sağı boş bir L'ye dönüyordu (ölçüldü,
             390). Dar ekranda sıra değişiyor — önce etki noktası ve olayın
             adı, altında tarih ile saat tek satırda. Sütun düzeni yalnızca
             1024'ten geniş ekranda geri geliyor — panel orada yan kolonda
             (350 piksel) ve sütun o dar kap için tasarlanmıştı; 768'de pano
             tek kolon ve panel tam genişlikte, orada da yığılmış hâli
             doğru okunuyor. Sıra `order` ile çevriliyor, DOM
             sırası telefondaki okuma sırası. */
          <li
            key={event.id}
            data-fill={index >= WEEK_AHEAD_BASE ? "" : undefined}
            hidden={index >= WEEK_AHEAD_BASE}
            suppressHydrationWarning
            className="flex flex-wrap items-start gap-x-2.5 gap-y-1 border-t border-line px-4 py-3 sm:px-5 lg:flex-nowrap lg:gap-3"
          >
            <span className="lg:order-2">
              <ImpactDot
                importance={event.importance ?? "medium"}
                label={t.calendar.impact}
              />
            </span>
            <span className="min-w-0 flex-1 text-base leading-snug text-body lg:order-3">
              {locale === "tr" ? event.titleTr : event.titleEn}
            </span>
            <span className="flex w-full flex-wrap items-baseline gap-x-2 pl-[18px] lg:order-1 lg:w-[86px] lg:shrink-0 lg:flex-col lg:items-start lg:gap-x-0 lg:pl-0">
              <span className="text-tiny font-semibold leading-tight text-strong">
                {formatEtDateLong(event.eventDate, locale)}
              </span>
              {times && (
                <span className="numeral text-tiny leading-tight text-muted">
                  {times.primary} {tags.primary}
                </span>
              )}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/** Kartta gösterilen haber sayısı ve seçkinin tarandığı havuz. */
const TOP_NEWS_COUNT = 6;
/** Kaynak sınırıyla altıya varılamadığında basılan haber sayısı. */
const TOP_NEWS_FALLBACK = 4;
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

  /* YEDEK DOLDURMA KAYNAK SINIRINI BOZMUYOR (24 Eylül). Sınırlar altı
     haber bırakmadığında liste sınırsız havuzdan tamamlanıyordu ve kaynak
     sınırı (2) tam o yolla deliniyordu: ölçüldüğü gün altı kartın beşi
     Yahoo'ydu. Yedek geçiş artık yalnızca SEMBOL sınırını gevşetiyor;
     kaynak sınırı her geçişte geçerli. Yine altıya varılamıyorsa dört
     haber basılıyor — tek bir sitenin beş haberi, "öne çıkanlar" değil. */
  const withImage = pool.filter(hasImage);
  const withoutImage = pool.filter((item) => !hasImage(item));
  const ranked = [...withImage, ...withoutImage];
  const ordered = capped(ranked);
  const bySource = new Map<string, number>();
  for (const item of ordered) bySource.set(item.source ?? "", (bySource.get(item.source ?? "") ?? 0) + 1);
  for (const item of ranked) {
    if (ordered.length >= TOP_NEWS_COUNT) break;
    if (ordered.includes(item)) continue;
    const source = item.source ?? "";
    if (source && (bySource.get(source) ?? 0) >= TOP_NEWS_PER_SOURCE) continue;
    bySource.set(source, (bySource.get(source) ?? 0) + 1);
    ordered.push(item);
  }
  const shownCount = ordered.length >= TOP_NEWS_COUNT ? TOP_NEWS_COUNT : Math.min(ordered.length, TOP_NEWS_FALLBACK);
  const items = ordered
    .slice(0, shownCount)
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

  /* Manşet kartı: görseli olan İLK haber. Görselsiz haber 16:9'luk bir kart
     değil, bir satır. */
  const lead = items.find(hasImage) ?? null;
  const rows = items.filter((item) => item !== lead);

  /* KÜNYE: kaynak · zaman · dil. Zaman Title Case ("1 Saat Önce"): künye
     bir cümle değil (CLAUDE.md, Title Case). Çevirisi olmayan manşet TR
     sayfada İngilizce duruyor; "EN" rozeti bunu tıklamadan önce söylüyor —
     Mercek listesinde aynı kural. */
  const byline = (item: (typeof pool)[number]) => (
    <span className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-tiny text-muted">
      {locale === "tr" && !item.headlineTr && (
        <span className="plate text-nano">EN</span>
      )}
      <span className="numeral">{titleCaseLabel(timeAgo(item.publishedAt, locale), locale)}</span>
      {item.source && (
        <>
          <span aria-hidden>·</span>
          {item.source}
        </>
      )}
    </span>
  );
  const headlineOf = (item: (typeof pool)[number]) =>
    locale === "tr" && item.headlineTr ? item.headlineTr : item.headline;
  /* ÇEVRİLMEMİŞ SATIR KENDİ DİLİNİ TAŞIR. Çeviri rutini gecikince TR
     sayfada İngilizce manşet duruyor ve `lang` olmadan ekran okuyucu onu
     Türkçe fonemlerle sesletiyor. */
  const langOf = (item: (typeof pool)[number]) =>
    locale === "tr" && !item.headlineTr ? "en" : undefined;

  return (
    /* METİN ÖNCE, GÖRSEL OLDUĞUNDA (24 Eylül). Bant altı tane 16:9 kart
       basıyordu ve görseli olmayan her kart gri bir gazete simgesiyle
       doluyordu: ölçüldüğü gün altı kartın beşi yer tutucuydu, bölüm
       1440'ta 789, 390'da 1926 piksel tutuyordu — telefon sayfasının beşte
       biri gri dikdörtgendi. Görseli olan ilk haber manşet kartı olarak
       solda kalıyor; ötekiler satır: 56 piksellik karo (haberin görseli,
       yoksa şirketin logosu, o da yoksa kaynağın baş harfi), iki satırlık
       manşet ve künye. Hiç görsel yoksa iki sütun, üçer satır.

       DOM'DA MANŞET ÖNCE, EKRANDA KÜNYE ÜSTTE — `flex-col-reverse`
       bağlantının erişilebilir adını manşetle başlatıyor (yoksa ekran
       okuyucu her satırda önce "7 saat önce · Benzinga" diyordu).
       `<ul>/<li>` kalıyor: ekran okuyucu liste bilgisini kaybetmesin. */
    <ul
      className={cn(
        "mt-4 grid min-w-0 gap-x-8",
        lead
          ? "lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]"
          : /* Görselsiz ve az haberli günde (kaynak sınırı üç haber
               bıraktı) üç satır tek sırada; iki sütunda üçüncüsü tek
               başına kalıyordu. */
            rows.length === 3
            ? "lg:grid-cols-3"
            : "sm:grid-cols-2",
      )}
    >
      {lead && (
        <li className="min-w-0 pb-4 lg:row-span-6 lg:pb-0">
          <Link
            href={`/haberler/${lead.id}`}
            prefetch={false}
            className="panel panel-hover flex h-full min-w-0 flex-col overflow-hidden"
          >
            <NewsImage
              src={lead.imageUrl}
              logoUrl={logoFor(lead)}
              className="w-full rounded-none border-0 border-b border-line-soft"
              sizeClass="aspect-[16/9] h-auto w-full"
            />
            <span className="flex min-w-0 flex-1 flex-col-reverse justify-end gap-2 p-4 sm:p-5">
              <span
                lang={langOf(lead)}
                className="line-clamp-3 text-lead font-semibold leading-[1.35] text-strong sm:text-title"
              >
                {headlineOf(lead)}
              </span>
              {byline(lead)}
            </span>
          </Link>
        </li>
      )}
      {rows.map((item, index) => {
        const logo = logoFor(item);
        return (
          <li
            key={item.id}
            className={cn(
              "min-w-0 border-t border-line",
              /* Sütunun ilk satırı üstteki kıl çizgiyi taşımıyor: başlık
                 şeridinin çizgisi hemen üstünde. */
              index === 0 && "lg:border-t-0",
              !lead && index === 0 && "border-t-0",
              !lead && index === 1 && (rows.length === 3 ? "lg:border-t-0" : "sm:border-t-0"),
              !lead && rows.length === 3 && index === 2 && "lg:border-t-0",
            )}
          >
            <Link
              href={`/haberler/${item.id}`}
              prefetch={false}
              className="grid min-w-0 grid-cols-[3.5rem_minmax(0,1fr)] items-start gap-3 rounded-lg py-3 transition-colors hover:bg-primary-tint lg:px-2"
            >
              {hasImage(item) || logo ? (
                <NewsImage
                  src={hasImage(item) ? item.imageUrl : null}
                  logoUrl={logo}
                  className="rounded-lg"
                  sizeClass="size-14"
                />
              ) : (
                <span
                  aria-hidden
                  className="grid size-14 place-items-center rounded-lg bg-surface-sunken text-lead font-bold text-body"
                >
                  {(item.source ?? "?").slice(0, 1).toLocaleUpperCase(locale === "tr" ? "tr-TR" : "en-US")}
                </span>
              )}
              <span className="flex min-w-0 flex-col-reverse justify-end gap-1">
                <span
                  lang={langOf(item)}
                  className="line-clamp-2 text-lead font-semibold leading-[1.35] text-strong"
                >
                  {headlineOf(item)}
                </span>
                {byline(item)}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Haber bandının iskeleti.
 *
 * ÖLÇÜ GERÇEK BANDIN ŞEKLİ: bir dönem tek bir 16/10 blok basılıyordu ve
 * gerçek kart ondan seksen piksel uzundu — bant çözülünce altındaki her şey
 * aşağı zıplıyordu. Bant artık manşet kartı + satırlar (gerekçe `TopNews`);
 * iskelet de aynı iki parçayı taklit ediyor.
 */
function NewsGridSkeleton() {
  return (
    <div aria-hidden className="mt-4 grid gap-x-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
      <div className="panel overflow-hidden lg:row-span-5">
        <Skeleton className="aspect-[16/9] w-full rounded-none" />
        <div className="flex flex-col gap-2 p-4 sm:p-5">
          <Skeleton className="h-2.5 w-2/5 rounded-md" />
          <Skeleton className="h-5 w-full rounded-md" />
          <Skeleton className="h-5 w-4/5 rounded-md" />
        </div>
      </div>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="grid grid-cols-[3.5rem_minmax(0,1fr)] gap-3 border-t border-line py-3 first-of-type:border-t-0">
          <Skeleton className="size-14 rounded-lg" />
          <div className="flex flex-col gap-2">
            <Skeleton className="h-2.5 w-2/5 rounded-md" />
            <Skeleton className="h-4 w-full rounded-md" />
            <Skeleton className="h-4 w-3/5 rounded-md" />
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
    <section className={styles.storySpotlight}>
      {/* Başlık şeridi panel başlıklarıyla aynı ölçüde: bloğu ayıran şey
          başlığın boyu değil, altındaki manşet ve eğri. Cesaret TEK yerde
          harcanıyor.
          DÜZ MÜREKKEP (24 Eylül): blok zaten sayfanın tek degrade yüzeyi;
          başlığına ikinci bir degrade vermek aynı vurguyu iki kez yapıyordu.
          Başlık düz koyu mürekkep, vurguyu yüzey taşıyor. */}
      <div className="flex items-center justify-between gap-3 px-4 py-3.5 sm:px-5">
        <h2 data-ink="plain" className="text-read font-bold text-strong">
          {t.today.latestStories}
        </h2>
        <PanelLink href="/mercek">{t.common.showAll}</PanelLink>
      </div>

      <Link
        href={withLocale(`/mercek/${lead.slug}`, locale)}
        prefetch={false}
        className={`${styles.storyLead} group block border-t border-primary-faint px-4 py-5 transition-colors hover:bg-primary-tint sm:px-5`}
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
                <span className="plate ml-1 text-nano">
                  {lead.locale.toUpperCase()}
                </span>
              )}
            </p>

            {/* MANŞET SAYFANIN İKİNCİ EN BÜYÜK METNİ. Blok bir süre 19
                puntoyla yazıldı ve çevresindeki panel başlıklarından
                ayrışmıyordu: aynı ağırlıkta bir kutu daha gibi duruyordu.
                Ölçü farkı, bloğun "burada okunacak bir şey var" demesinin en
                ucuz ve en sessiz yolu.
                DÜZ MÜREKKEP (23 Eylül): iki-üç satırlık manşette degrade
                satır satır değil kutu boyunca yayılıyordu; bültenin
                manşetiyle aynı gerekçe (BriefSwitch). Ayrımı punto taşıyor. */}
            <h3 className="mt-2.5 text-heading font-bold leading-[1.14] tracking-[-0.03em] text-strong sm:text-subdisplay">
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
              className={`${styles.storyFigure} lg:w-[292px] lg:shrink-0`}
            />
          )}
        </div>
      </Link>

      {rest.length > 0 && (
        <ul className="border-t border-primary-faint bg-surface-solid">
          {rest.map((story, index) => (
            <li
              key={story.slug}
              className="border-t border-line-soft first:border-t-0"
            >
              <Link
                href={withLocale(`/mercek/${story.slug}`, locale)}
                prefetch={false}
                className={styles.storyRow}
              >
                <span className={styles.storyNumber} aria-hidden>{String(index + 2).padStart(2, "0")}</span>
                <div className={styles.storyRowCopy}>
                  <h4 lang={story.locale}>{story.title}</h4>
                  {story.dek && <p lang={story.locale}>{story.dek}</p>}
                </div>
                {/* Semboller başlığın yanında bir künye olarak kalır. Mobilde
                    açıklama tam genişliği kullanır; künye alt satıra geçer. */}
                <div className={styles.storyRowMeta}>
                  <span className="numeral">{formatEtDateCompact(story.eventDate, locale)}</span>
                  {story.symbols && story.symbols.length > 0 && <span>{story.symbols.slice(0, 2).join(" · ")}</span>}
                  {story.locale !== locale && <span>{story.locale.toUpperCase()}</span>}
                  <ArrowUpRight size={15} aria-hidden />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* ==========================================================================
   Teknik görünüm
   ========================================================================== */

/**
 * Teknik analiz paneli — yan kolonda (gerekçe ve ölçüm yerleşim yorumunda).
 * Pano boşsa hiç basılmıyor; başlığı panelin kendisi taşıyor, görüş
 * dağılımının iç başlığı ve süzgeç bağlantısı burada yok (`variant="panel"`).
 */
async function TechnicalPanel({ locale, t }: { locale: Locale; t: Dictionary }) {
  /* OKUMALAR BİRLİKTE BAŞLIYOR. Pano, tatiller, künye ve kotasyon paketi
     sırayla bekleniyordu ve hiçbiri panoya bağlı değil: panel sayfanın en
     son çözülen sınırıydı ve akışın sonunu tutuyordu (üretimde on sıcak
     koşunun onunda en son, 288–381 ms; soğuk önbellekte 809 ms, akış sonu
     841). Pano boşsa kaybolan tek şey önbellekli bir künye sorgusu. */
  const [board, holidays, meta, snapshot] = await Promise.all([
    getTechnicalBoard(),
    getHolidays(),
    getSymbolNames([...TECHNICAL_SYMBOLS]),
    getStatus().then(async (status) => ({ status, pack: (await indexSnapshot(status)).result })),
  ]);
  if (board.length === 0) return null;
  const next = nextEdition(new Date(), holidays);
  /* Bekleyenler panelde de sayılıyor: iki ekran aynı listeyi anlatıyor ve
     biri on iki, öteki on beş deseydi okuyucu hangisine inanacağını
     bilemezdi. Künye `TECHNICAL_SYMBOLS`in tamamı için isteniyor — logolar
     bekleyen satırda da basılıyor. */
  const pending = pendingSymbols(board.map(({ row }) => row.symbol));
  /* BALONUN CANLI FİYATI HAREKET PANELİNİN PAKETİNDEN. `indexSnapshot`
     aynı istekte `DayMovers` tarafından zaten bekleniyor; `getQuotes`
     istek içinde `cache()`li, anahtarı sıralı sembol dizesi ve `status`
     de `cache()`li `getStatus`in aynı nesnesi — yani burada sağlayıcıya
     yeni bir tur gitmiyor ve MU'nun yüzdesi iki panelde aynı sayı.
     `getQuotes(TECHNICAL_SYMBOLS)` BİLEREK ÇAĞRILMIYOR: yeni bir anahtar,
     yeni bir tur ve hareket paneliyle çelişebilecek ikinci bir kaynak
     olurdu. Endekste olmayan semboller (BE, ONDS gibi) fotoğraftaki
     fiyata ve "Analiz Anında" etiketine düşüyor.
     BEDELİ BİR GECİKME BAĞI: panel artık büyük evren paketini bekliyor.
     Ücretsiz olması `DayMovers`ın aynı istekte, aynı `status` nesnesiyle
     çizilmesine bağlı; o panel kalkar ya da başka bir durum nesnesiyle
     çağrılırsa bu satır büyük çekimi TEK BAŞINA başlatır (okuma yukarıda,
     öteki okumalarla birlikte). */
  const latest = newestEdition(board);
  return (
    <Panel className="min-w-0">
      <PanelHeader
        title={t.technical.title}
        tone="plate"
        action={<PanelLink href="/teknik">{t.common.showAll}</PanelLink>}
      />
      <div className="flex flex-col gap-3 px-4 pb-4 sm:px-5">
        {latest && (
          <p className="text-tiny text-muted">
            {t.technical.latestEdition} ·{" "}
            <span className="font-semibold text-body">
              {slotLabel(latest.slot, t)} · {formatEtDateCompact(latest.sessionDate, locale)} ·{" "}
              <span className="numeral">{editionTime(latest.sessionDate, latest.slot, locale)}</span>
            </span>
          </p>
        )}
        {/* Sıradaki yayın — panel de aynı soruyu cevaplıyor: elindeki görüş
            ne kadar süre geçerli. Gerekçesi `nextEdition` üzerinde. */}
        {next && (
          <p className="text-tiny text-muted">
            {t.technical.nextEdition} ·{" "}
            <span className="font-semibold text-body">
              {slotLabel(next.slot, t)} ·{" "}
              <span className="numeral">{editionClock(next.at, locale)}</span>
              {todayEt(next.at) !== todayEt() && (
                <> · {formatEtDateCompact(todayEt(next.at), locale)}</>
              )}
            </span>
          </p>
        )}
        <TechnicalPulse
          locale={locale}
          board={board}
          pending={pending}
          meta={meta}
          quotes={snapshot}
          t={t}
          variant="panel"
        />
      </div>
    </Panel>
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
  /* BEŞ SATIR TABAN, SEKİZE KADAR YEDEK — favoriler listesindekiyle aynı
     kurgu, bu kez SOL kolon için. Sol kolonun boyu o günün verisine bağlı:
     bilanço açıklayan şirket yoksa "Bugün Bilanço Açıklayanlar" boş duruma
     düşüyor ve panel 156 piksele iniyor. Ölçüldü — böyle bir günde sol kolon
     1440 pikselde 127 piksel kısa kalıyordu ve o boşluğu kapatacak hiçbir
     şey yoktu.
     Sunucu sekiz satırın tamamını basıyor, beşten sonrası `hidden`;
     kaçının açılacağına tarayıcı iki kolonun dibini ölçerek karar veriyor
     (`FillColumn`). JavaScript kapalıysa beş satır kalıyor. */
  const analyses = await getAnalyses(locale, { limit: ANALYSES_MAX });

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
        {analyses.map((row, index) => {
          const verdict = verdictOf(row.verdict);
          const logo = meta[row.symbol]?.logoUrl;
          if (index === 0) {
            return (
              <li key={`${row.symbol}-${row.period}`}>
                <Link href={analysisHref(row.symbol, row.period)} prefetch={false} className={styles.analysisLeadLink}>
                  <SpotlightCard className={styles.analysisLead}>
                    <div className={styles.analysisIdentity}>
                      <LogoTile symbol={row.symbol} logoUrl={logo} size="md" />
                      <div><h3>{row.company}</h3><small>{row.symbol} · {row.periodLabel} · {formatEtDateCompact(row.reportDate, locale)}</small></div>
                    </div>
                    <ScoreRing score={row.score} verdict={verdict} size={72} showDenominator className={styles.analysisScore} />
                    <p lang={row.locale} className={styles.analysisExcerpt}>{row.headline}</p>
                    <div className={styles.analysisFooter}>
                      <span className={styles.analysisCta}>{t.guide.cardCta}<ArrowUpRight size={16} /></span>
                      <span className={cn("rounded-md px-2 py-1 text-tiny font-bold", verdictPillClass(verdict))}>{verdictLabel(verdict, t)}</span>
                    </div>
                  </SpotlightCard>
                </Link>
              </li>
            );
          }
          return (
            <li
              key={`${row.symbol}-${row.period}`}
              /* `hidden` bu satırda React'in değil FillColumn'un: akışla gelen bölüm
                 henüz hydrate olmadan ölçüp açabiliyor ve React sunucudaki
                 `hidden`ı istemcidekiyle karşılaştırıp uyumsuzluk yazıyordu
                 (ana sayfa, 1440, aralıklı; ölçüldü). Nitelik bilerek React
                 dışında değişiyor; uyarı bastırılıyor, yama yapılmıyor. */
              data-fill={index >= ANALYSES_BASE ? "" : undefined}
              hidden={index >= ANALYSES_BASE}
              suppressHydrationWarning
            >
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
                    {formatEtDateCompact(row.reportDate, locale)}
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
    <section className="overflow-hidden rounded-xl border border-primary-faint bg-(--premium-surface)">
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
