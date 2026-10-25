import { MotionExperience, ScrollProgress } from "@/components/motion/PremiumMotion";
import polish from "@/components/motion/UtilityExperience.module.css";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { ArticleBody } from "@/components/article/ArticleBody";
import { GuideHint } from "@/components/article/GuideHint";
import { PageShare } from "@/components/article/PageShare";
import { ChartThumb } from "@/components/daily-chart/ChartThumb";
import styles from "@/components/daily-chart/DailyChart.module.css";
import { ButtonLink, DataStamp, EmptyState, PageHeader, Panel, PanelHeader } from "@/components/ui/primitives";
import { getI18n } from "@/lib/i18n";
import { pageMetadata } from "@/lib/page-meta";
import { getDailyChartArchive } from "@/lib/daily-chart-data";
import { DAILY_CHART_STAMP_SOURCE, dailyChartHref } from "@/lib/daily-chart";
import { getLatestPosterDate } from "@/lib/day-poster-data";
import { formatEtDateLong, tieFigures } from "@/lib/utils";
import { ChartFigure } from "@/components/daily-chart/ChartFigure";
import { DayContext } from "@/components/daily-chart/DayContext";
import { checkChartBlock } from "@/lib/daily-chart";
import { getChartDayContext } from "@/lib/daily-chart-day";
import { chartSummary, summaryText } from "@/lib/daily-chart-figure";
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
 * EKRAN SIRASI (CLAUDE.md "Ekran düzeni"): başlık, ana görsel (en son
 * grafik, tam boy ve açıklamasıyla), arşiv ızgarası, rehber ipucu. Arşiv
 * kartı grafiğin KÜÇÜK hâlini taşıyor (`ChartThumb`): Chartr'ın arşivi
 * gibi, bir günü başlığından önce şekliyle tanımak için.
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
  const context = latest ? await getChartDayContext(latest.chartDate) : null;
  const check = latest ? checkChartBlock(latest.chartMd, latest.locale) : null;
  const summary = check?.ok ? chartSummary(check.block) : null;

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
        <Panel>
          {/* Başlık panelin h2'si; tarih künyesi yanında (başlığa ait bilgi). */}
          <PanelHeader title={latest.title} meta={formatEtDateLong(latest.chartDate, locale)} />
          {latest.locale !== locale && (
            <p className={`${styles.fallback} mx-4 mb-3 sm:mx-5`}>{d.fallbackNote}</p>
          )}
          {summary && (
            <p className={styles.summary} lang={latest.locale}>
              {tieFigures(summaryText(summary, d.summary))}
            </p>
          )}
          <div className={styles.figure} lang={latest.locale}>
            {check?.ok ? (
              <ChartFigure
                block={check.block}
                chartMd={latest.chartMd}
                locale={latest.locale}
                label={check.block.label || d.chartHeading}
                caption={check.block.label || undefined}
              />
            ) : (
              <ArticleBody markdown={latest.chartMd} locale={latest.locale} />
            )}
          </div>
          <div className={styles.text} lang={latest.locale}>
            <ArticleBody markdown={latest.bodyMd} locale={latest.locale} className={styles.body} />
            <Link href={dailyChartHref(latest.chartDate)} className={styles.navLink}>
              {d.readMore}
              <ArrowRight size={14} weight="bold" aria-hidden />
            </Link>
          </div>
        </Panel>
      )}

      {/* Ölçü ızgarası: grafiğin günü (CLAUDE.md "Ekran düzeni" 4). */}
      {context && <DayContext context={context} locale={locale} labels={d} />}

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
                  <ChartThumb chartMd={row.chartMd} locale={row.locale} rows={4} />
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
