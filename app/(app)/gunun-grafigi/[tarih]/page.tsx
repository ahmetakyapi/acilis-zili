import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MotionExperience, ScrollProgress } from "@/components/motion/PremiumMotion";
import polish from "@/components/motion/UtilityExperience.module.css";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { ArrowLeft, ArrowRight, DownloadSimple } from "@phosphor-icons/react/dist/ssr";
import { ArticleBody } from "@/components/article/ArticleBody";
import { GuideHint } from "@/components/article/GuideHint";
import { ShareButton } from "@/components/article/ShareButton";
import { ArticleJsonLd, BreadcrumbJsonLd } from "@/components/seo/JsonLd";
import styles from "@/components/daily-chart/DailyChart.module.css";
import { DataStamp, PageHeader, Panel, PanelHeader, buttonClass } from "@/components/ui/primitives";
import { getI18n } from "@/lib/i18n";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { withLocale } from "@/lib/i18n/routing";
import { articleOpenGraph, metaDescription, missingMetadata } from "@/lib/page-meta";
import { absoluteUrl, pageAlternates } from "@/lib/site";
import { formatEtDateLong, safeExternalUrl } from "@/lib/utils";
import { DAILY_CHART_STAMP_SOURCE, checkChartBlock, dailyChartHref, dailyChartImageHref, firstSentence } from "@/lib/daily-chart";
import { getDailyChart, getDailyChartArchive } from "@/lib/daily-chart-data";
import { DAILY_CHART_OG_SIZES } from "@/lib/daily-chart-og";

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
  const rowLocale = isLocale(row.locale) ? row.locale : locale;
  const path = dailyChartHref(row.chartDate);
  const date = formatEtDateLong(row.chartDate, locale);
  const check = checkChartBlock(row.chartMd, row.locale);
  const label = check.ok && check.block.label ? check.block.label : d.chartHeading;

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

      {/* Başlık grafiğin söylediği cümle; tarih ALTINDA (üst künye yok). */}
      <PageHeader
        title={row.title}
        subtitle={d.sessionLine.replace("{date}", date)}
        share={
          <ShareButton
            url={absoluteUrl(path, locale)}
            title={row.title}
            labels={{ ...t.share, title: d.shareTitle }}
            compactOnMobile
            align="right"
          />
        }
      />

      {/* ---- Seçim şeridi: görseller ve komşu günler ---- */}
      <div className={styles.dayNav}>
        <div className={styles.actions}>
          {(["yatay", "dikey"] as const).map((kind) => (
            <a
              key={kind}
              href={withLocale(dailyChartImageHref(row.chartDate, kind), rowLocale)}
              download={`aciliszili-gunun-grafigi-${row.chartDate}-${kind}.png`}
              className={buttonClass({ variant: kind === "yatay" ? "primary" : "ghost", size: "md" })}
            >
              <DownloadSimple size={16} weight="bold" aria-hidden />
              {kind === "yatay" ? d.downloadLandscape : d.downloadPortrait}
            </a>
          ))}
        </div>
        <nav aria-label={d.dayNav} className={styles.actions}>
          {older && (
            <Link href={dailyChartHref(older.chartDate)} className={styles.navLink}>
              <ArrowLeft size={14} weight="bold" aria-hidden />
              {d.prevDay}
            </Link>
          )}
          <Link href="/gunun-grafigi" className={styles.navLink}>
            {d.allCharts}
          </Link>
          {newer && (
            <Link href={dailyChartHref(newer.chartDate)} className={styles.navLink}>
              {d.nextDay}
              <ArrowRight size={14} weight="bold" aria-hidden />
            </Link>
          )}
        </nav>
      </div>

      {row.locale !== locale && (
        <p className={styles.fallback}>{d.fallbackNote}</p>
      )}

      {/* ---- Ana görsel, metin ve künye TEK panelde ----
          Künye ve uyarı panelin içinde, hairline ile ayrılmış düz paragraf
          (CLAUDE.md "Ekran düzeni" 6). Gövde kendi dilini söylüyor. */}
      <Panel>
        <PanelHeader title={label} />
        <div className={styles.figure} lang={row.locale}>
          {/* Etiket başlıkta; blok etiketsiz çizilir ki iki kez basılmasın. */}
          <ArticleBody markdown={stripLabel(row.chartMd)} locale={row.locale} />
        </div>
        <div className={styles.text} lang={row.locale}>
          <h3 className="text-read font-bold text-strong">{d.aboutHeading}</h3>
          <ArticleBody markdown={row.bodyMd} locale={row.locale} className={styles.body} />
        </div>
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
      </Panel>

      <DataStamp source={DAILY_CHART_STAMP_SOURCE} at={row.updatedAt} locale={locale} labels={t.data} />

      <GuideHint label={t.guide.contextLabel} locale={locale} slugs={["endeks", "sektor-rotasyonu"]} />
    </MotionExperience>
  );
}

/** `::: bar Etiket` → `::: bar` — etiket panel başlığına taşındı. */
function stripLabel(chartMd: string): string {
  return chartMd.replace(/^(\s*:::\s*\S+)[^\n]*/, "$1");
}
