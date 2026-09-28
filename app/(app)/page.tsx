import { cache, Suspense } from "react";
import { MotionExperience, ScrollProgress } from "@/components/motion/PremiumMotion";
import styles from "@/components/today/TodayExperience.module.css";
import { Countdown } from "@/components/today/Countdown";
import { BellLedger } from "@/components/today/BellLedger";
import { SessionRefresh } from "@/components/today/SessionRefresh";
import { LiveClock } from "@/components/today/LiveClock";
import { SessionRail } from "@/components/today/SessionRail";
import { sessionDomain } from "@/components/today/index-feed";
import { Panel, PanelHeader, PanelLink, Skeleton, PanelSkeleton } from "@/components/ui/primitives";
import { getStatus } from "@/lib/data";
import { displayZone, formatInZone, nextZoneMidnight, zoneTag } from "@/lib/session-clock";
import { FillColumn } from "@/components/today/FillColumn";
import { getI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { RailSection } from "@/components/today/home/RailSection";
import { IndexSkeleton, IndexStrip } from "@/components/today/home/IndexStrip";
import { YieldCard } from "@/components/today/home/YieldCard";
import { WorldStrip } from "@/components/today/home/WorldStrip";
import { BriefCard } from "@/components/today/home/BriefCard";
import { ScheduleList, WeekAhead } from "@/components/today/home/Schedule";
import { DayMovers } from "@/components/today/home/DayMovers";
import { EarningsToday, EarningsTodaySkeleton } from "@/components/today/home/EarningsToday";
import { WatchlistSummary } from "@/components/today/home/WatchlistSummary";
import { MacroSummary } from "@/components/today/home/MacroSummary";
import { NewsGridSkeleton, TOP_NEWS_FILL_POOL, TopNews } from "@/components/today/home/TopNews";
import { ListSkeleton } from "@/components/today/home/ListSkeleton";
import { SpotlightSkeleton, StoriesSpotlight } from "@/components/today/home/StoriesSpotlight";
import { TechnicalPanel } from "@/components/today/home/TechnicalPanel";
import { LatestAnalyses } from "@/components/today/home/LatestAnalyses";
import { PortfolioSlot } from "@/components/today/home/PortfolioSlot";
import {
  SectorRibbon,
  SectorRibbonSkeleton,
  ThemeSpotlight,
  ThemeSpotlightSkeleton,
} from "@/components/today/home/MarketTexture";
import textureStyles from "@/components/today/home/MarketTexture.module.css";

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

/* PANELLER `components/today/home/` ALTINDA, her biri kendi dosyasında
   (28 Eylül). Bu dosya 3.010 satırdı: iskelet, on beş panel, sabitleri ve
   yorumları tek yerdeydi ve bir paneli değiştirmek için sayfanın tamamını
   okumak gerekiyordu. Burada yalnızca SAYFANIN KENDİSİ kaldı: kahraman,
   ızgara, Suspense sınırları ve kolon doldurucu. Sınırlar bilerek burada —
   hangi panelin akışla geleceği, hangisinin kabuğu bekleyeceği (günün
   özeti) sayfanın düzen kararı, panelin değil. İki panelin paylaştığı
   endeks fotoğrafı `home/index-snapshot.ts`te; tek `cache()`li okuma. */

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
                zone={readerZone}
                labels={{
                  name: t.dayRail.marketHours,
                  bands: { pre: t.chart.sessionPre, regular: t.chart.sessionRegular, after: t.chart.sessionAfter },
                  open: `${t.dayRail.openShort} ${formatInZone(new Date(rail.openAt * 1000), readerZone)}`,
                  close: `${t.dayRail.closeShort} ${formatInZone(new Date(rail.closeAt * 1000), readerZone)}`,
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

      {/* YÜZEN BÖLÜM DİZİNİ KALDIRILDI (28 Eylül, sahibinin isteği). Kahraman
          başlığın arkasına geçince açılan sabit sekme bandıydı; sahibi
          kaydırırken beliren bu yapıyı sevmedi. Bölüm çapaları (`id`)
          yerinde: bağlantılar ve adres çubuğundaki #çapa çalışmaya devam
          ediyor. */}

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

      {/* ---- Sektörler ve temalar ----
           İKİ KOLONUN ÜSTÜNDE, KENDİ SATIRINDA (28 Eylül). Önce kolonların
           altındaydı ve 5.580 piksellik sayfanın 3.470. pikselinde kalıyordu
           (1440, ölçüldü); sahibi yukarı istedi. Kolonları ortadan bölmek
           iki kolonun dengesini bozardı, bu yüzden bant kahramanın hemen
           altında tam genişlikte bir satır. Kolonlar ölçülü
           bir dengede (bant eklenmeden önce, misafir, açık tema: 1024'te
           138, 1280'de 14, 1440'ta 31 piksel fark) ve bu bant hangi kolona
           girse ötekinde kendi boyu kadar boşluk açardı. Tam genişlikte
           kolonlara hiç dokunmuyor.
           Seçim gerekçesi ve veri kaynağı `MarketTexture.tsx` başında. */}
      <Panel
        data-home-section="texture"
        id="sektor-ve-tema"
        aria-labelledby="sektor-ve-tema-baslik"
        className={cn(textureStyles.band, styles.texture, "min-w-0 lg:col-span-2 lg:row-start-1")}
      >
        <div className={textureStyles.bandHead}>
          <h2 id="sektor-ve-tema-baslik">{t.today.textureTitle}</h2>
          <p>{t.today.textureNote}</p>
        </div>
        <Suspense fallback={<SectorRibbonSkeleton t={t} />}>
          <SectorRibbon locale={locale} t={t} />
        </Suspense>
        <Suspense fallback={<ThemeSpotlightSkeleton locale={locale} t={t} />}>
          <ThemeSpotlight locale={locale} t={t} />
        </Suspense>
      </Panel>

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
        className="flex min-w-0 flex-col gap-5 lg:col-start-1 lg:row-start-2"
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

        {/* ---- Portföy ya da Piyasa Nabzı ----
             Mercek'in altında, çünkü ikisi de "sana ne anlatıyor" bloğu:
             biri olayın mekanizmasını, öteki senin pozisyonlarını. Portföyü
             olmayan okuyucuda aynı yuvaya kompakt Nabız giriyor; yuva boş
             kalsaydı kolon dengesi yalnızca portföy tutanlar için kurulurdu
             (ölçüm ve gerekçe `PortfolioSlot`). Yükleme yedeği iki hâlin
             ortak iskeleti: başlık ve üç satır. */}
        <div id="portfoy-ozeti" data-home-section="portfolio">
          <Suspense fallback={<PanelSkeleton rows={3} />}>
            <PortfolioSlot locale={locale} t={t} />
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
        className="flex min-w-0 flex-col gap-5 lg:col-start-2 lg:row-start-2"
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
            tone="title"
            action={<PanelLink href="/takvim">{t.common.showAll}</PanelLink>}
          />
          <Suspense fallback={<ListSkeleton rows={3} />}>
            <ScheduleList locale={locale} t={t} />
          </Suspense>
        </Panel>

        <Panel data-home-section="week">
          <PanelHeader
            title={t.today.weekAhead}
            tone="title"
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
      <section data-home-section="news" id="haber-akisi" className={cn(styles.news, "min-w-0 lg:col-span-2 lg:row-start-3")}>
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
              {/* Künyedeki sayı yedeklerin havuzu: seçki son 40 haberden,
                  manşetin yanını dolduran yedekler son 80'den geliyor
                  (TopNews). Ekrandaki her haber için doğru olan büyük sayı. */}
              {t.today.topNewsNote.replace("{n}", String(TOP_NEWS_FILL_POOL))}
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
      <footer data-home-section="sources" className="flex flex-wrap justify-between gap-x-6 gap-y-1 pt-2 text-tiny text-muted lg:col-span-2 lg:row-start-4">
        <span>{t.today.sourceLine}</span>
        <span>{t.today.sourceNote}</span>
      </footer>
    </div>
    </MotionExperience>
  );
}
