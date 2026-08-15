import { Suspense } from "react";
import Link from "next/link";
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
  Skeleton,
  TimingChip,
  LogoTile,
  ButtonLink,
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
  getSymbolNames,
  getTodayEvents,
  getEarningsBetween,
  getUserSymbols,
  weekAnchor,
} from "@/lib/data";
import { addEtDays, todayEt } from "@/lib/market-hours";
import {
  displayOffsets,
  timePair,
  zoneTag,
} from "@/lib/session-clock";
import { getQuotes } from "@/lib/providers";
import { isSpotlight } from "@/lib/spotlight";
import { INDEX_STRIP, WORLD_MARKETS } from "@/db/seed/symbols";
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
    /* Izgara dört parçalı: ana kolon, yan kolon, okuma girişi ve haberler.
       Son ikisi DOM'da yan kolondan SONRA gelir — mobilde tek kolona inince
       ölçümlerin altına düşer, geniş ekranda `row-start` ile yine sol kolonun
       devamı olarak ana yığının altına oturur. Mobilde okuma kartlarının
       endekslerle dünya piyasaları arasına girmemesi bilinçli: ölçüm okurken
       araya giren bir okuma davetiyesi akışı kesiyordu. */
    <div className="grid gap-x-6 gap-y-5 lg:grid-cols-[minmax(0,1fr)_376px]">
      {/* Seans sınırında sayfa kendini tazeler. Hiçbir şey çizmez, ızgarada yer
          kaplamaz. Geri sayım sıfıra inince orada kilitleniyor ve yeni güne
          ancak elle yenilemeyle geçiliyordu; gerekçenin tamamı bileşende. */}
      <SessionRefresh atIso={status.nextTransition.toISOString()} />

      {/* ================= Ana kolon ================= */}
      <div className="flex min-w-0 flex-col gap-5 lg:col-start-1 lg:row-start-1">
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
                    : "bg-primary-wash text-primary",
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
                trading:
                  status.session !== "closed" ||
                  (!status.isWeekend && !status.holiday),
                closeMinutes: status.closeMinutes,
                nowMinutes: status.etMinutes,
              }}
            />
          </Suspense>
        </Panel>

        {/* ---- Günün özeti — ana kolonda, günü okumaya buradan başlanıyor ---- */}
        <Suspense fallback={<Skeleton className="h-48 w-full rounded-xl" />}>
          <BriefCard locale={locale} t={t} />
        </Suspense>

        {/* ---- Bugünün ekonomik takvimi ---- */}
        <Panel>
          <PanelHeader
            title={t.today.schedule}
            action={<PanelLink href="/takvim">{t.common.showAll}</PanelLink>}
          />
          <Suspense fallback={<ListSkeleton rows={3} />}>
            <ScheduleList locale={locale} t={t} />
          </Suspense>
        </Panel>

        {/* ---- Haftaya bakış ----
             Bugünün takviminin hemen ardından geliyor: ikisi de ekonomik
             takvim ve aynı soruyu farklı ölçekte soruyor. Bilanço listesi
             başka bir kaynağın verisi, o yüzden ikisinin arasına girmiyor. */}
        <Panel>
          <PanelHeader
            title={t.today.weekAhead}
            action={<PanelLink href="/takvim">{t.common.showAll}</PanelLink>}
          />
          <Suspense fallback={<ListSkeleton rows={3} />}>
            <WeekAhead locale={locale} t={t} />
          </Suspense>
        </Panel>

        {/* ---- Bugün bilanço açıklayanlar ---- */}
        <Panel>
          <PanelHeader
            title={t.today.earningsToday}
            action={<PanelLink href="/bilancolar">{t.common.showAll}</PanelLink>}
          />
          <Suspense fallback={<ListSkeleton rows={3} />}>
            <EarningsToday locale={locale} t={t} />
          </Suspense>
        </Panel>

      </div>

      {/* ================= Yan kolon =================
          Yalnızca ölçüler: endeksler → dünya → tahviller → makro → senin
          listen. Okunacak metin sol kolonda. */}
      <div className="flex min-w-0 flex-col gap-5 lg:col-start-2 lg:row-start-1 lg:row-span-3">
        <Suspense fallback={<IndexSkeleton />}>
          <IndexStrip locale={locale} t={t} />
        </Suspense>

        {/* Dünya piyasaları endekslerin hemen altında: ikisi de "bugün
            borsalar ne yapmış" sorusunun cevabı, ABD'si ve dünyası. */}
        <Suspense fallback={<Skeleton className="h-28 w-full rounded-xl" />}>
          <WorldStrip locale={locale} t={t} />
        </Suspense>

        <Suspense fallback={<Skeleton className="h-44 w-full rounded-xl" />}>
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
        <Suspense fallback={<Skeleton className="h-44 w-full rounded-xl" />}>
          <MacroSummary locale={locale} t={t} />
        </Suspense>

        <Suspense fallback={<Skeleton className="h-56 w-full rounded-xl" />}>
          <WatchlistSummary locale={locale} t={t} />
        </Suspense>
      </div>

      {/* ---- Son yazılanlar ----
           Burada bir süre iki STATİK karo vardı ("Mercek" ve "Rehber"), yani
           yalnızca "şuraya git" diyen iki kapı. Okuyucu tıklamadan önce ne
           bulacağını bilmiyordu ve yeni bir analiz ya da yazı çıktığında ana
           sayfa bunu hiç haber vermiyordu.

           Şimdi iki panel de GERÇEK içerik taşıyor: son analizler ve son
           mercek yazıları. Kapı hâlâ orada (başlıktaki "Tümünü Gör") ama
           yanında ne olduğu da yazıyor.

           İçerik yoksa panel hiç basılmıyor ve ızgara kalanla tek sütuna
           iner; ikisi de boşsa eski keşif karoları geri geliyor — henüz
           içerik yazılmamış bir sitede ana sayfanın okuma girişi büsbütün
           kaybolmasın. */}
      <Suspense
        fallback={
          <div className="grid gap-4 sm:grid-cols-2 lg:col-start-1 lg:row-start-2">
            <Skeleton className="h-52 w-full rounded-xl" />
            <Skeleton className="h-52 w-full rounded-xl" />
          </div>
        }
      >
        <LatestWriting locale={locale} t={t} />
      </Suspense>

      {/* ---- Öne çıkan haberler ----
           Okunacak metin ana kolonda durur: manşet dar kolonda iki satıra
           kırılıyor, geniş kolonda bir bakışta okunuyor. Mobilde ise gün
           verisi bittikten sonra, sayfanın en altında okunuyor. */}
      <Panel className="min-w-0 lg:col-start-1 lg:row-start-3 lg:self-start">
        <PanelHeader
          title={t.today.topNews}
          action={<PanelLink href="/haberler">{t.common.showAll}</PanelLink>}
        />
        <Suspense fallback={<ListSkeleton rows={4} />}>
          <TopNews locale={locale} t={t} />
        </Suspense>
      </Panel>

      {/* ---- Kaynak künyesi ---- */}
      <footer className="flex flex-wrap justify-between gap-x-6 gap-y-1 pt-2 text-tiny text-muted lg:col-span-2 lg:row-start-4">
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
              <Panel key={symbol} className="w-28 shrink-0 p-3.5 sm:w-auto">
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
              className="w-28 shrink-0 sm:w-auto"
            >
              <Panel className="panel-hover flex h-full flex-col rounded-xl p-3 sm:rounded-lg sm:p-4">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-tiny font-semibold text-body">
                    {INDEX_LABEL[symbol] ?? symbol}
                  </span>
                  <span className="hidden text-nano text-muted sm:inline">
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
    };
  });

  if (values.every((value) => value.latest === null)) return null;

  const vixLevel = vixResult.ok ? vixResult.data.latestValue : null;
  const vixPrev = vixResult.ok ? vixResult.data.prevValue : null;
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
      <PanelHeader
        title={t.markets.yields}
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
                  dile bağlı: Türkçede sayıdan önce, İngilizcede sonra. Sabit
                  "sonra" yazıldığında panel Türkçede "4,25 %" basıyordu. */}
              <p className="tote mt-1 text-lg">
                {value.latest === null ? (
                  "—"
                ) : locale === "tr" ? (
                  <>
                    <span className="mr-0.5 text-xs text-muted">%</span>
                    {formatPrice(value.latest, locale)}
                  </>
                ) : (
                  <>
                    {formatPrice(value.latest, locale)}
                    <span className="ml-0.5 text-xs text-muted">%</span>
                  </>
                )}
              </p>
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
              {formatPrice(Math.abs(vixDelta), locale, { digits: 2 })}
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
      <PanelHeader title={t.today.worldMarkets} />
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
                  <span className="mt-0.5 block truncate text-nano leading-tight text-muted">
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
        daily && <BriefBody markdown={daily.bodyMd} moreLabel={t.common.showAll} />
      }
      weeklyBody={
        weekly && (
          <BriefBody markdown={weekly.bodyMd} moreLabel={t.common.showAll} />
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
        return (
          <li
            key={event.id}
            className={cn(
              "flex items-center gap-3 border-t border-line px-4 py-3 sm:gap-4 sm:px-5",
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
            <span className="hidden w-[86px] shrink-0 text-right text-small text-muted sm:block">
              {event.forecast
                ? `${t.calendar.forecast} ${event.forecast}${event.unit === "%" ? "%" : ""}`
                : "—"}
            </span>
            <span
              className={cn(
                "numeral w-[62px] shrink-0 text-right text-sm",
                event.actual
                  ? high
                    ? "font-bold text-down"
                    : "font-semibold text-strong"
                  : "text-muted",
              )}
            >
              {event.actual
                ? `${event.actual}${event.unit === "%" ? "%" : ""}`
                : "—"}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

async function EarningsToday({ locale, t }: { locale: Locale; t: Dictionary }) {
  const today = todayEt();
  const rows = await getEarningsBetween(today, today);

  if (rows.length === 0) {
    return <EmptyState title={t.earnings.empty} />;
  }

  const names = await getSymbolNames(rows.map((row) => row.symbol));

  /* Sekiz satır, PİYASA DEĞERİNE göre. Sağlayıcı takvimi alfabetik
     döndürüyor ve liste "APC · ATI · ATII · ATLC" diye başlıyordu: bugünün
     en büyük bilançosu 400 satır aşağıdaydı. Takvim ekranı zaten aynı
     sıralamayı kullanıyor. */
  const shown = [...rows]
    .sort(
      (a, b) =>
        (names[b.symbol]?.marketCap ?? 0) - (names[a.symbol]?.marketCap ?? 0),
    )
    .slice(0, 8);

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
            <span className="w-[66px] shrink-0 text-base font-bold text-strong">
              {row.symbol}
            </span>
            <span className="hidden min-w-0 flex-1 truncate text-base text-body sm:block">
              {names[row.symbol]?.name ?? ""}
            </span>
            {badge ? (
              <AnalysisBadge badge={badge} t={t} size="sm" />
            ) : (
              <TimingChip
                tone={row.hour === "bmo" ? "pre" : row.hour === "amc" ? "post" : "neutral"}
              >
                {row.hour ? (hourLabel[row.hour] ?? t.earnings.timeUnknown) : t.earnings.timeUnknown}
              </TimingChip>
            )}
            <span className="ml-auto shrink-0 text-right text-small text-muted sm:ml-0 sm:w-[82px]">
              {row.epsEstimate !== null
                ? `${t.earnings.epsEstimate} ${formatPrice(row.epsEstimate, locale, { currency: true })}`
                : "—"}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

async function WatchlistSummary({ locale, t }: { locale: Locale; t: Dictionary }) {
  const session = await auth();

  if (!session?.user?.id) {
    return (
      <Panel>
        <PanelHeader title={t.today.watchlistSummary} />
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
        <PanelHeader title={t.today.watchlistSummary} />
        <EmptyState
          title={t.today.watchlistEmpty}
          action={<PanelLink href="/favoriler">{t.watchlist.addSymbol}</PanelLink>}
        />
      </Panel>
    );
  }

  const status = await getStatus();
  const shown = userSymbols.slice(0, 8);
  const [result, bars] = await Promise.all([
    getQuotes(shown, status),
    getChartBarsMulti(shown, "1D", status),
  ]);

  return (
    <Panel className="px-4 py-4 sm:px-5">
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <h2 className="display-ink display-ink-tight w-fit text-read font-bold">
          {t.today.watchlistSummary}
        </h2>
        <PanelLink href="/favoriler">{t.common.showAll}</PanelLink>
      </div>
      {result.ok ? (
        <>
          <ul>
            {shown.map((symbol) => {
              const quote = result.data[symbol];
              const points = (bars[symbol] ?? []).map((bar) => ({
                value: bar.close,
              }));
              const tone = directionOf(quote?.changePct);
              return (
                <li key={symbol} className="border-t border-line first:border-t-0">
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
        <h2 className="display-ink display-ink-tight w-fit text-read font-bold">
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
  const bySymbolCap = (list: typeof pool) => {
    const seen = new Map<string, number>();
    const kept: typeof pool = [];
    for (const item of list) {
      const key = item.symbols?.[0] ?? "";
      const count = seen.get(key) ?? 0;
      if (key && count >= TOP_NEWS_PER_SYMBOL) continue;
      seen.set(key, count + 1);
      kept.push(item);
    }
    return kept;
  };

  const withImage = pool.filter(hasImage);
  const withoutImage = pool.filter((item) => !hasImage(item));
  const ordered = bySymbolCap([...withImage, ...withoutImage]);
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
    <ul>
      {items.map((item) => (
        <li key={item.id}>
          <Link
            href={`/haberler/${item.id}`}
            className="flex gap-3 border-t border-line px-4 py-3 transition-colors hover:bg-primary-tint sm:px-5"
          >
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium leading-snug text-strong">
                {locale === "tr" && item.headlineTr ? item.headlineTr : item.headline}
              </span>
              {(item.summaryTr || item.summary) && (
                <span className="mt-1 line-clamp-2 block text-xs leading-relaxed text-body">
                  {locale === "tr" && item.summaryTr
                    ? item.summaryTr
                    : item.summary}
                </span>
              )}
              <span className="mt-1.5 flex items-center gap-1.5 text-tiny text-muted">
                <span className="numeral">{timeAgo(item.publishedAt, locale)}</span>
                {item.source && (
                  <>
                    <span aria-hidden>·</span>
                    <span className="truncate">{item.source}</span>
                  </>
                )}
              </span>
            </span>
            <NewsImage
              src={
                item.imageUrl && !genericImages.has(item.imageUrl)
                  ? item.imageUrl
                  : null
              }
              logoUrl={logoFor(item)}
              className="shrink-0"
              sizeClass="size-16"
            />
          </Link>
        </li>
      ))}
    </ul>
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
   Son yazılanlar — analizler + mercek
   ========================================================================== */

/**
 * Ana sayfanın okuma girişi.
 *
 * İki panel de son yazılanları gösteriyor; kapı (Tümünü Gör) başlıkta
 * duruyor. Boş liste basılmıyor: analiz ya da yazı yoksa o panel hiç
 * çıkmıyor, ikisi de yoksa keşif karoları geri geliyor.
 */
async function LatestWriting({
  locale,
  t,
}: {
  locale: Locale;
  t: Dictionary;
}) {
  const [analyses, stories] = await Promise.all([
    getAnalyses(locale, { limit: 4 }),
    getStories(locale, 3),
  ]);

  if (analyses.length === 0 && stories.length === 0) {
    return <ReadingDoors t={t} />;
  }

  const meta =
    analyses.length > 0
      ? await getSymbolNames([...new Set(analyses.map((r) => r.symbol))])
      : {};

  return (
    <div
      /* Paneller satırın en uzununa gerilir (grid'in stretch varsayılanı).
         Önceden `items-start` ile her panel kendi boyundaydı ama kısa kartın
         ALTINDA kalan boşluk, kartın İÇİNDE kalan boşluktan daha bozuk
         görünüyor — yan yana kartlar hep aynı boyda olacak. */
      className={cn(
        "grid gap-4 lg:col-start-1 lg:row-start-2",
        analyses.length > 0 && stories.length > 0 && "sm:grid-cols-2",
      )}
    >
      {analyses.length > 0 && (
        <Panel className="min-w-0">
          <PanelHeader
            title={t.today.latestAnalyses}
            action={
              <PanelLink href="/bilancolar/analizler">
                {t.common.showAll}
              </PanelLink>
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
      )}

      {stories.length > 0 && (
        <Panel className="min-w-0">
          <PanelHeader
            title={t.today.latestStories}
            action={<PanelLink href="/mercek">{t.common.showAll}</PanelLink>}
          />
          <ul className="divide-y divide-line-soft">
            {stories.map((story) => (
              <li key={story.slug}>
                <Link
                  href={`/mercek/${story.slug}`}
                  prefetch={false}
                  className="block px-4 py-3 transition-colors hover:bg-primary-tint sm:px-5"
                >
                  <span className="block text-base font-semibold leading-[19px] text-strong">
                    {story.title}
                  </span>
                  <span className="numeral mt-1 block text-tiny text-muted">
                    {formatEtDateShort(story.eventDate, locale)}
                    {story.readMinutes ? (
                      <>
                        <span aria-hidden className="mx-1.5">
                          ·
                        </span>
                        {story.readMinutes} {t.guide.readMinutes}
                      </>
                    ) : null}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}

/**
 * Keşif karoları — yalnızca hiç içerik yokken.
 *
 * Sitenin ilk günlerindeki hâl: iki bölüm de boşken ana sayfada okuma
 * girişinin büsbütün kaybolmaması için duruyor.
 */
function ReadingDoors({ t }: { t: Dictionary }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:col-start-1 lg:row-start-2">
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
