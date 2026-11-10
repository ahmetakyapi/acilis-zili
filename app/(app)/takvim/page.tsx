import { PageShare } from "@/components/article/PageShare";
import { Suspense } from "react";
import { MotionExperience, ScrollProgress } from "@/components/motion/PremiumMotion";
import styles from "@/components/calendar/CalendarExperience.module.css";
import { GuideHint } from "@/components/article/GuideHint";
import {
  DividendCalendar,
  DividendCalendarSkeleton,
  DividendHero,
  DividendHeroSkeleton,
  DividendWeeks,
  DividendWeeksSkeleton,
} from "@/components/calendar/DividendCalendar";
import { TabBar, TabItem } from "@/components/ui/primitives";
import { getI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { pageMetadata } from "@/lib/page-meta";
import {
  CALENDAR_IMPACTS,
  CALENDAR_VIEWS,
  EconomicCalendar,
  type CalendarImpact,
  type CalendarView,
} from "./_view/EconomicCalendar";

/* Paylaşım künyesi. Sayfa kendi başlığını vermediğinde Next kökteki
   varsayılanı miras alıyor ve her bölüm linki aynı metinle
   paylaşılıyordu. Metin, bölümün OG kartındaki cümleyle aynı. */
export const generateMetadata = pageMetadata({
  path: "/takvim",
  tr: {
    title: "Ekonomik Takvim",
    description:
      "ABD makro veri açıklamaları ve Fed toplantıları, saatleriyle.",
  },
  en: {
    title: "Economic Calendar",
    description:
      "US macro releases and Fed meetings, with the times.",
  },
});

/**
 * Takvim türleri — ekonomik (varsayılan) ve temettü (`?tur=temettu`).
 *
 * TEMETTÜ AYRI BİR GÖRÜNÜM, AYRI BİR ROTA DEĞİL (28 Eylül). İkisi de aynı
 * soruya cevap veriyor ("önümüzdeki günlerde ne olacak") ve halka arz
 * takvimi de bu ekranda duruyor. Gün/Hafta/Ay seçimi ve önem süzgeci
 * temettüde anlamsız; o görünümde basılmıyorlar.
 */
const KINDS = ["ekonomik", "temettu"] as const;
type Kind = (typeof KINDS)[number];

function KindTabs({ kind, labels }: { kind: Kind; labels: { label: string; economic: string; dividends: string } }) {
  return (
    <TabBar label={labels.label}>
      <TabItem href="/takvim" active={kind === "ekonomik"} underlineId="takvim-tur">
        {labels.economic}
      </TabItem>
      <TabItem href="/takvim?tur=temettu" active={kind === "temettu"} underlineId="takvim-tur">
        {labels.dividends}
      </TabItem>
    </TabBar>
  );
}

export default async function CalendarPage(
  props: PageProps<"/takvim">,
) {
  const search = await props.searchParams;
  const kind: Kind = KINDS.includes(search.tur as Kind) ? (search.tur as Kind) : "ekonomik";
  const view: CalendarView = CALENDAR_VIEWS.includes(search.g as CalendarView) ? (search.g as CalendarView) : "week";
  const impact: CalendarImpact | null = CALENDAR_IMPACTS.includes(search.onem as CalendarImpact)
    ? (search.onem as CalendarImpact)
    : null;

  const { locale, t } = await getI18n();
  /* PAYLAŞ KAPAĞIN SAĞ ÜST KÖŞESİNDE (18 Ekim). Başlık satırının sağındaydı
     ama bu kapak iki kolonlu: satır yalnız SOL kolonu kaplıyor ve düğme
     sayfanın ortasında, başlıkla sağ kolon arasında asılı duruyordu
     (sahibinin ekran görüntüsü). Öteki ekranlarda paylaş kapağın sağ üst
     köşesi (`PageHeader share`, `DirectoryHeader shareInTitle`); burada o
     köşe sağ kolonun tepesi, görünüm seçiminin yanı. Tek kolonlu
     yerleşimde (≤767 ve yatay telefon) sağ kolon başlığın ALTINA iniyor;
     orada düğme yine başlık satırının sağında, çünkü satır artık tam
     genişlik. İki kopyadan biri her genişlikte `display: none` — görünüm
     seçimiyle aynı yöntem, erişilebilirlik ağacında tek düğme. */
  const share = (path: string, title: string) => (
    <PageShare compactOnMobile align="right" path={path} title={title} locale={locale} t={t} />
  );
  const kindLabels = {
    label: t.marketExtras.calendarKinds,
    economic: t.marketExtras.calendarEconomic,
    dividends: t.marketExtras.calendarDividends,
  };

  /* Temettü görünümü erken dönüyor: ekonomik takvimin altı haftalık
     sorgusu ve FRED tazelemesi bu görünümde hiçbir şey çizmiyor. */
  if (kind === "temettu") {
    return (
      <MotionExperience className={styles.page}>
        <ScrollProgress />
        {/* Köşe motifi yok: sağ sütun veri kartı taşıyor (gerekçe
            _view/EconomicCalendar.tsx, kapak notu). */}
        <header className={`${styles.hero} page-frame`}>
          {/* KAPAK İKİ KOLONU DA DOLDURUYOR (10 Kasım 2026). Solda başlık ve
              altında sıradaki hak kesim (geniş kolonda yatay dizilir), sağda
              paylaş ve dört haftalık şerit. Önceki hâl: solda yalnız başlık
              (altı ~150 piksel boş), sağda kart, şerit panelde. Gerekçe ve
              ölçüm DividendCalendar.tsx → `DividendWeeks`. Telefonda sıra:
              başlık, sıradaki hak kesim, şerit. */}
          <div className={styles.heroMain}>
            <div className="page-heading-copy">
              <div className="page-title-row">
                <h1 className="display-ink w-fit text-heading font-bold tracking-[-0.03em] sm:text-display">
                  {t.marketExtras.dividendTitle}
                </h1>
                <div className={cn("page-title-actions", styles.shareTitle)}>{share("/takvim?tur=temettu", t.marketExtras.dividendTitle)}</div>
              </div>
              <p>{t.marketExtras.dividendSubtitle}</p>
            </div>
            <div className={styles.heroLead}>
              <Suspense fallback={<DividendHeroSkeleton t={t} />}>
                <DividendHero locale={locale} t={t} />
              </Suspense>
            </div>
          </div>
          <div className={cn(styles.heroSide, styles.heroSideFill)}>
            <div className={styles.heroControls}>
              <span className={styles.shareSide}>{share("/takvim?tur=temettu", t.marketExtras.dividendTitle)}</span>
            </div>
            <div className={styles.heroWeeks}>
              <Suspense fallback={<DividendWeeksSkeleton />}>
                <DividendWeeks locale={locale} t={t} />
              </Suspense>
            </div>
          </div>
        </header>
        <KindTabs kind={kind} labels={kindLabels} />
        <Suspense fallback={<DividendCalendarSkeleton t={t} />}>
          <DividendCalendar locale={locale} t={t} />
        </Suspense>
        <GuideHint
          label={t.guide.contextLabel}
          locale={locale}
          slugs={["temettu", "hisse-senedi"]}
          className="pt-1"
        />
      </MotionExperience>
    );
  }

  return (
    <EconomicCalendar
      view={view}
      impact={impact}
      locale={locale}
      t={t}
      share={share}
      tabs={<KindTabs kind={kind} labels={kindLabels} />}
    />
  );
}
