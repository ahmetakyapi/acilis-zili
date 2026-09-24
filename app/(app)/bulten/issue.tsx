import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArticleJsonLd, BreadcrumbJsonLd } from "@/components/seo/JsonLd";
import { getBriefIssue } from "@/lib/data";
import { getI18n, type Locale } from "@/lib/i18n";
import { isLocale } from "@/lib/i18n/config";
import {
  articleOpenGraph,
  metaDescription,
  missingMetadata,
} from "@/lib/page-meta";
import { pageAlternates } from "@/lib/site";
import { BRIEF_DATE, briefHref, briefSummary, type BriefPeriod } from "@/lib/brief";
import { BriefArchiveView } from "./BriefArchiveView";

/**
 * Bülten SAYISI — `/bulten/[tarih]` ve `/bulten/haftalik/[tarih]` ortak
 * gövdesi. İki rota dosyası yalnızca dönemi söylüyor.
 *
 * Sayı yoksa 404: arşiv ekranı (`/bulten`) geçersiz bir tarihte en yeniye
 * düşüyordu ve orada doğru, çünkü adres bir sayı vaat etmiyordu. Burada
 * adres bir sayının KENDİSİ; başka bir günün metnini bu adreste göstermek
 * arama motoruna aynı metnin ikinci bir adresini vermek olurdu.
 */
async function loadIssue(tarih: string, period: BriefPeriod, locale: Locale) {
  if (!BRIEF_DATE.test(tarih)) return null;
  const rows = await getBriefIssue(tarih, period);
  const brief = rows.find((row) => row.locale === locale) ?? rows[0];
  if (!brief) return null;
  const locales = rows.map((row) => row.locale).filter(isLocale);
  return { brief, locales };
}

export async function briefIssueMetadata(
  tarih: string,
  period: BriefPeriod,
): Promise<Metadata> {
  const { locale } = await getI18n();
  const issue = await loadIssue(tarih, period, locale);
  if (!issue) return missingMetadata(locale);
  const { brief, locales } = issue;
  return {
    /* Başlık sayının manşeti: arama sonucunda yüz tane "Günlük Bülten" alt
       alta durmasın, her sayı kendi haberiyle okunsun. Tarih ve dönem
       eklenmiyor — manşetler zaten 60-70 harf ve sonuna kök şablon marka
       adını ekliyor; fazlası arama sonucunda kesiliyordu. */
    title: brief.headline,
    description: metaDescription(briefSummary(brief.bodyMd)),
    alternates: pageAlternates(briefHref(tarih, period), locale, locales),
    openGraph: articleOpenGraph(locale, {
      publishedTime: brief.generatedAt?.toISOString(),
    }),
  };
}

export async function BriefIssuePage({
  tarih,
  period,
}: {
  tarih: string;
  period: BriefPeriod;
}) {
  const { locale, t } = await getI18n();
  const issue = await loadIssue(tarih, period, locale);
  if (!issue) notFound();
  const { brief } = issue;
  const path = briefHref(brief.briefDate, period);
  /* Künye sayının kendi dilinde — gerekçe mercek sayfasında: çevirisi
     olmayan sayıda canonical yazıldığı dile gidiyor. */
  const briefLocale = isLocale(brief.locale) ? brief.locale : locale;

  return (
    <>
      <ArticleJsonLd
        headline={brief.headline}
        description={briefSummary(brief.bodyMd)}
        path={path}
        locale={briefLocale}
        published={brief.generatedAt}
      />
      <BreadcrumbJsonLd
        locale={briefLocale}
        items={[
          /* Halka her iki dönemde de `/bulten`: `?tur=haftalik` canonical
             olmayan bir adres (canonical'ı sorgusuz), kırıntıya yazılmaz. */
          {
            name: period === "weekly" ? t.brief.weeklyTitle : t.brief.title,
            path: "/bulten",
          },
          { name: brief.headline, path },
        ]}
      />
      <BriefArchiveView period={period} issue={brief} locale={locale} t={t} />
    </>
  );
}
