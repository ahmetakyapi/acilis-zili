import { MotionExperience, ScrollProgress } from "@/components/motion/PremiumMotion";
import polish from "@/components/motion/UtilityExperience.module.css";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { GuideHint } from "@/components/article/GuideHint";
import { PageShare } from "@/components/article/PageShare";
import { ChartBoard } from "@/components/daily-chart/ChartBoard";
import { ChartMosaic } from "@/components/daily-chart/ChartMosaic";
import styles from "@/components/daily-chart/DailyChart.module.css";
import { ButtonLink, DataStamp, EmptyState, PageHeader, Panel, PanelHeader } from "@/components/ui/primitives";
import { getI18n } from "@/lib/i18n";
import { pageMetadata } from "@/lib/page-meta";
import { getDailyChartArchive } from "@/lib/daily-chart-data";
import { DAILY_CHART_STAMP_SOURCE, dailyChartHref } from "@/lib/daily-chart";
import { getLatestPosterDate } from "@/lib/day-poster-data";
import { formatEtDateLong } from "@/lib/utils";
import { DayContext } from "@/components/daily-chart/DayContext";
import { getChartDayContext, getChartLogos } from "@/lib/daily-chart-day";
import { dailyChartTr, dailyChartEn } from "@/lib/i18n/dictionaries/daily-chart";

export const generateMetadata = pageMetadata({
  path: "/gunun-grafigi",
  tr: { title: dailyChartTr.title, description: dailyChartTr.metaDescription },
  en: { title: dailyChartEn.title, description: dailyChartEn.metaDescription },
});

/** Arşivde bir sayfada kaç grafik — bir işlem yılının yarısı. */
const ARCHIVE_LIMIT = 120;

/**
 * Günün Grafiği — en son grafik ve arşiv (24 Ekim).
 *
 * EKRAN SIRASI (CLAUDE.md "Ekran düzeni"): başlık, en son günün PANOSU
 * (künye kartları, grafik kartları ve metin; detay sayfasıyla aynı
 * `ChartBoard`, 25 Ekim kart turu), günün bağlamı, arşiv ızgarası, rehber
 * ipucu. Arşiv kartı grafiğin minyatürünü taşıyor (`ChartMosaic`: kalem
 * başına bir kare, ton yön, koyuluk büyüklük) ve günün iki ucunu sayısıyla:
 * bir günü başlığından önce şekliyle tanımak için.
 *
 * Kayıt yokken (tablo henüz yok ya da rutin daha yazmadı) sayfa 404 değil,
 * boş durum: adres menüde ve site haritasında duruyor. BOŞ DURUM YÖN VERİR
 * (25 Ekim düzeltmesi): rutinin ne zaman yazdığını söylüyor ve aynı seansı
 * bugün anlatan tek parçaya, son Günün Posteri'ne bağlanıyor. Paylaş düğmesi
 * boş sayfada basılmıyor; paylaşılacak bir grafik yok.
 */
export default async function DailyChartIndexPage() {
  const { locale, t } = await getI18n();
  const d = t.dailyChart;
  const rows = await getDailyChartArchive(locale, ARCHIVE_LIMIT);
  const [latest, ...archive] = rows;
  /* Boş durumun bağlantısı: son tamamlanmış seansın posteri. Okunamazsa
     arşiv sayfası (poster kendi tarihini orada seçtiriyor). */
  const posterHref = latest ? null : await getLatestPosterDate().then((date) => `/gun/${date}`, () => "/gun");
  const [context, logos] = latest
    ? await Promise.all([getChartDayContext(latest.chartDate), getChartLogos(latest.chartMd, latest.locale)])
    : [null, {}];

  return (
    <MotionExperience className={polish.page}>
      <ScrollProgress />
      <PageHeader
        title={d.title}
        subtitle={d.subtitle}
        share={latest ? <PageShare path="/gunun-grafigi" title={d.title} locale={locale} t={t} compactOnMobile align="right" /> : undefined}
      />

      {!latest ? (
        <Panel>
          <EmptyState
            title={d.empty}
            hint={d.emptyHint}
            scene="chart"
            action={
              posterHref && (
                <ButtonLink href={posterHref} variant="ghost" prefetch={false}>
                  {d.emptyAction}
                  <ArrowRight size={14} weight="bold" aria-hidden />
                </ButtonLink>
              )
            }
          />
        </Panel>
      ) : (
        <>
          {latest.locale !== locale && <p className={styles.fallback}>{d.fallbackNote}</p>}
          {/* İlk ekranda bugünün panosu, büyük: detay sayfasıyla aynı pano
              (`ChartBoard`); tarih ana kartın başlık satırında. */}
          <ChartBoard
            row={latest}
            context={context}
            logos={logos}
            locale={locale}
            labels={d}
            headingId={`grafik-${latest.chartDate}`}
            action={
              <Link href={dailyChartHref(latest.chartDate)} className={styles.openLink}>
                {formatEtDateLong(latest.chartDate, locale)}
                <ArrowRight size={14} weight="bold" aria-hidden />
              </Link>
            }
            footer={
              <div className={styles.textFoot}>
                <Link href={dailyChartHref(latest.chartDate)} className={styles.openLink}>
                  {d.readMore}
                  <ArrowRight size={14} weight="bold" aria-hidden />
                </Link>
              </div>
            }
          />
        </>
      )}

      {/* Ölçü ızgarası: grafiğin günü (CLAUDE.md "Ekran düzeni" 4). */}
      {context && <DayContext context={context} locale={locale} labels={d} omitBreadth />}

      {/* Damga ana görselin künyesi: veri kaynağı ve kaydın son yazıldığı an. */}
      {latest && <DataStamp source={DAILY_CHART_STAMP_SOURCE} at={latest.updatedAt} locale={locale} labels={t.data} />}

      {archive.length > 0 && (
        <Panel>
          <PanelHeader
            title={d.archiveTitle}
            meta={d.archiveCount.replace("{count}", rows.length.toLocaleString(locale === "tr" ? "tr-TR" : "en-US"))}
          />
          <ul className={styles.grid}>
            {archive.map((row) => (
              <li key={row.chartDate} className="min-w-0">
                <Link href={dailyChartHref(row.chartDate)} prefetch={false} className={styles.card}>
                  <span className={styles.cardDate}>
                    <span>{formatEtDateLong(row.chartDate, locale)}</span>
                    {/* Kayıt okunan dilde değilse dili rozetle söylenir (bülten arşivi kalıbı). */}
                    {row.locale !== locale && (
                      <span className={`plate text-nano ${styles.lang}`}>{row.locale.toUpperCase()}</span>
                    )}
                  </span>
                  <span className={styles.cardTitle} lang={row.locale}>{row.title}</span>
                  <ChartMosaic chartMd={row.chartMd} locale={row.locale} roles={d.board.roles} />
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <GuideHint label={t.guide.contextLabel} locale={locale} slugs={["endeks", "sektor-rotasyonu"]} />
    </MotionExperience>
  );
}
