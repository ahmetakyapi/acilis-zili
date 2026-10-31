import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MotionExperience, ScrollProgress } from "@/components/motion/PremiumMotion";
import polish from "@/components/motion/UtilityExperience.module.css";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { ArrowLeft, ArrowRight, CaretLeft, CaretRight, DownloadSimple, SquaresFour } from "@phosphor-icons/react/dist/ssr";
import { GuideHint } from "@/components/article/GuideHint";
import { ShareButton } from "@/components/article/ShareButton";
import { ArticleJsonLd, BreadcrumbJsonLd } from "@/components/seo/JsonLd";
import styles from "@/components/daily-chart/DailyChart.module.css";
import { DataStamp, PageHeader } from "@/components/ui/primitives";
import { getI18n } from "@/lib/i18n";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { withLocale } from "@/lib/i18n/routing";
import { articleOpenGraph, metaDescription, missingMetadata } from "@/lib/page-meta";
import { absoluteUrl, pageAlternates } from "@/lib/site";
import { cn, formatEtDateCompact, formatEtDateLong, safeExternalUrl } from "@/lib/utils";
import { DAILY_CHART_STAMP_SOURCE, dailyChartHref, dailyChartImageHref, firstSentence } from "@/lib/daily-chart";
import { getDailyChart, getDailyChartArchive } from "@/lib/daily-chart-data";
import { DAILY_CHART_OG_SIZES } from "@/lib/daily-chart-og";
import { getChartDayContext, getChartLogos } from "@/lib/daily-chart-day";
import { ChartBoard } from "@/components/daily-chart/ChartBoard";
import { DayContext } from "@/components/daily-chart/DayContext";

/**
 * Günün Grafiği — tek gün (24 Ekim). Adres grafiğin anlattığı İŞLEM GÜNÜ;
 * kayıt yoksa 404 (bülten sayısının kuralı: adres bir kaydın kendisi).
 *
 * DİL MERCEK KALIBINDA: istenen dil yoksa orijinali notuyla; canonical,
 * hreflang ve `og:locale` için AYNI dil listesi (`locales`).
 *
 * PAYLAŞIM GÖRSELİ GRAFİĞİN KENDİSİ: `og:image` `gorsel/route.tsx`ten,
 * 1200×630; dikey (1080×1350) indirme bağlantısında. Dosya tabanlı
 * `opengraph-image` değil: o kural dili adresten alamıyor (lib/og.tsx),
 * bu rota alıyor — `/en/...` paylaşımı İngilizce kartı çizer.
 */

async function load(tarih: string, locale: Locale) {
  return getDailyChart(tarih, locale);
}

export async function generateMetadata(props: PageProps<"/gunun-grafigi/[tarih]">): Promise<Metadata> {
  const { tarih } = await props.params;
  const { locale, t } = await getI18n();
  const issue = await load(tarih, locale);
  if (!issue) return missingMetadata(locale);
  const { row, locales } = issue;
  /* Görselin dili metnin dili: çevirisi olmayan grafikte kart da orijinal. */
  const imageLocale = isLocale(row.locale) ? row.locale : locale;
  const date = formatEtDateLong(row.chartDate, imageLocale);
  const image = (kind: "yatay" | "dikey") => absoluteUrl(dailyChartImageHref(row.chartDate, kind), imageLocale);
  return {
    title: row.title,
    description: metaDescription(firstSentence(row.bodyMd)),
    alternates: pageAlternates(dailyChartHref(row.chartDate), locale, locales),
    openGraph: {
      ...articleOpenGraph(locale, { publishedTime: row.publishedAt?.toISOString(), availableLocales: locales }),
      images: [
        {
          url: image("yatay"),
          ...DAILY_CHART_OG_SIZES.landscape,
          alt: t.dailyChart.landscapeAlt.replace("{title}", row.title).replace("{date}", date),
        },
      ],
    },
    twitter: { card: "summary_large_image", images: [image("yatay")] },
  };
}

export default async function DailyChartPage(props: PageProps<"/gunun-grafigi/[tarih]">) {
  const { tarih } = await props.params;
  const { locale, t } = await getI18n();
  const d = t.dailyChart;
  const [issue, archive] = await Promise.all([load(tarih, locale), getDailyChartArchive(locale, 400)]);
  if (!issue) notFound();
  const { row } = issue;
  const [context, logos] = await Promise.all([getChartDayContext(row.chartDate), getChartLogos(row.chartMd, row.locale)]);
  const rowLocale = isLocale(row.locale) ? row.locale : locale;
  const path = dailyChartHref(row.chartDate);
  const date = formatEtDateLong(row.chartDate, locale);
  const dateShort = formatEtDateCompact(row.chartDate, locale);

  /* Komşu günler arşivin sırasından (yeniden eskiye). */
  const index = archive.findIndex((entry) => entry.chartDate === row.chartDate);
  const newer = index > 0 ? archive[index - 1] : null;
  const older = index >= 0 ? (archive[index + 1] ?? null) : null;
  const sources = row.sources ?? [];

  return (
    <MotionExperience className={polish.page}>
      <ScrollProgress />
      <ArticleJsonLd
        type="NewsArticle"
        headline={row.title}
        description={firstSentence(row.bodyMd)}
        path={path}
        locale={rowLocale}
        published={row.publishedAt}
        modified={row.updatedAt}
      />
      <BreadcrumbJsonLd
        locale={rowLocale}
        items={[
          { name: d.title, path: "/gunun-grafigi" },
          { name: row.title, path },
        ]}
      />

      {/* KAPAK SAYFANIN KİMLİĞİ (25 Ekim, kart turu). Önceki kapakta rutinin
          başlığı dev display puntoda iki satırdı (1440'ta 218 piksel; telefonda
          beş satır) ve ilk ekranın üçte birini yiyordu. Sahibi: "Başlık yok
          öncelikle." Şimdi kapak sitenin öteki ekranları gibi "Günün Grafiği";
          rutinin başlığı ana kartın h2'si. Sağdaki tek denetim grubu: günler
          arası oklar + tarih, iki görsel indirme ve Paylaş (küçük düğmeler);
          telefonda başlığın altında tek satır. */}
      <PageHeader
        title={d.title}
        action={
          <div className={styles.headTools}>
            <nav aria-label={d.dayNav} className={styles.dayStep}>
              {older ? (
                <Link href={dailyChartHref(older.chartDate)} className={styles.stepBtn} aria-label={d.prevDay} title={d.prevDay}>
                  <CaretLeft size={16} weight="bold" aria-hidden />
                </Link>
              ) : (
                <span className={styles.stepBtn} data-off="" aria-hidden>
                  <CaretLeft size={16} weight="bold" />
                </span>
              )}
              <span className={styles.dayLabel}>
                <span className={styles.dayLong}>{d.sessionLine.replace("{date}", date)}</span>
                <span className={styles.dayShort}>{dateShort}</span>
              </span>
              {newer ? (
                <Link href={dailyChartHref(newer.chartDate)} className={styles.stepBtn} aria-label={d.nextDay} title={d.nextDay}>
                  <CaretRight size={16} weight="bold" aria-hidden />
                </Link>
              ) : (
                <span className={styles.stepBtn} data-off="" aria-hidden>
                  <CaretRight size={16} weight="bold" />
                </span>
              )}
            </nav>
            <div className={styles.toolGroup}>
              {(["yatay", "dikey"] as const).map((kind) => (
                <a
                  key={kind}
                  href={withLocale(dailyChartImageHref(row.chartDate, kind), rowLocale)}
                  download={`aciliszili-gunun-grafigi-${row.chartDate}-${kind}.png`}
                  className={cn("tap-44", styles.toolBtn)}
                  aria-label={kind === "yatay" ? d.downloadLandscape : d.downloadPortrait}
                  title={kind === "yatay" ? d.downloadLandscape : d.downloadPortrait}
                >
                  <DownloadSimple size={15} weight="bold" aria-hidden />
                  <span className={styles.toolWord} aria-hidden>
                    {kind === "yatay" ? d.board.landscapeShort : d.board.portraitShort}
                  </span>
                  <span className={styles.toolShape} data-shape={kind} aria-hidden />
                </a>
              ))}
              <ShareButton
                url={absoluteUrl(path, locale)}
                title={row.title}
                labels={{ ...t.share, title: d.shareTitle }}
                compact
                align="right"
              />
            </div>
          </div>
        }
      />

      {row.locale !== locale && (
        <p className={styles.fallback}>{d.fallbackNote}</p>
      )}

      {/* ---- Pano: künye → grafik kartları → metin (ilk ekran) ---- */}
      <ChartBoard
        row={row}
        context={context}
        logos={logos}
        locale={locale}
        labels={d}
        headingId={`grafik-${row.chartDate}`}
        footer={
          <div className={styles.notes}>
            <p>{d.dataNote}</p>
            {sources.length > 0 && (
              <div className="flex flex-col gap-1">
                <p className="font-semibold text-body">{d.sources}</p>
                <ul className={styles.sourceList}>
                  {sources.map((source, i) => {
                    /* zod `.url()` `javascript:` şemasını geçiriyor; süzgeç burada. */
                    const href = safeExternalUrl(source.url);
                    return (
                      <li key={`${i}-${source.label}`}>
                        {href ? (
                          <a href={href} target="_blank" rel="noreferrer noopener">{source.label}</a>
                        ) : (
                          source.label
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
            <p className="font-semibold">{d.disclaimer}</p>
          </div>
        }
      />

      {/* Ölçü ızgarası: o günün geri kalanı. Genişlik künyede (Nasdaq 100
          kartı), burada ikinci kez basılmıyor. */}
      <DayContext context={context} locale={locale} labels={d} omitBreadth />

      <nav aria-label={d.dayNav} className={styles.dayNav}>
        {older ? (
          <Link href={dailyChartHref(older.chartDate)} className={styles.navLink}>
            <ArrowLeft size={14} weight="bold" aria-hidden />
            {d.prevDay}
          </Link>
        ) : <span />}
        <Link href="/gunun-grafigi" className={styles.navLink}>
          <SquaresFour size={14} weight="bold" aria-hidden />
          {d.allCharts}
        </Link>
        {newer ? (
          <Link href={dailyChartHref(newer.chartDate)} className={styles.navLink}>
            {d.nextDay}
            <ArrowRight size={14} weight="bold" aria-hidden />
          </Link>
        ) : <span />}
      </nav>

      <DataStamp source={DAILY_CHART_STAMP_SOURCE} at={row.updatedAt} locale={locale} labels={t.data} />

      <GuideHint label={t.guide.contextLabel} locale={locale} slugs={["endeks", "sektor-rotasyonu"]} />
    </MotionExperience>
  );
}
