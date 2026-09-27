import { notFound } from "next/navigation";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import { MotionExperience } from "@/components/motion/PremiumMotion";
import polish from "@/components/motion/UtilityExperience.module.css";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { GuideHint } from "@/components/article/GuideHint";
import { BreadcrumbJsonLd } from "@/components/seo/JsonLd";
import { ThemeTable } from "@/components/themes/ThemeTable";
import { ThemeStats } from "@/components/themes/ThemeStats";
import {
  ButtonLink,
  DataStamp,
  PageHeader,
  Panel,
  PanelHeader,
} from "@/components/ui/primitives";
import { THEME_SLUGS, themeBySlug, themeDek, themeTitle, themeWhy } from "@/content/themes";
import { compareHref, MAX_COMPARE_SYMBOLS } from "@/lib/compare";
import { getStatus, getSymbolNames } from "@/lib/data";
import { getI18n } from "@/lib/i18n";
import { metaDescription, missingMetadata } from "@/lib/page-meta";
import { getQuotes } from "@/lib/providers";
import { pageAlternates } from "@/lib/site";
import { sameSessionMoves } from "@/lib/theme-stats";
import {
  byMarketCap,
  KATILIM_MAX,
  KATILIM_POOL,
  katilimMembers,
  themeQuoteSymbols,
  themeRow,
} from "@/lib/themes-data";

/**
 * Tematik liste — "yapay zekâ hisseleri hangileri, bugün ne yaptılar".
 *
 * Ekran sırası sitenin kuralı: başlık (sağında tek denetim: ilk dördü
 * karşılaştır), künye şeridi (üye sayısı, günün medyanı, yükselen/düşen),
 * ana tablo, metin (neden bu şirketler) ve künyeler panelin içinde, sonra
 * veri damgası ve rehber.
 *
 * Kotasyon TEK ÇAĞRI: üyeler + ölçüt ETF'i aynı anahtarda (gerekçe
 * `lib/themes-data.ts`). Katılım temasında üyeler o çağrının sonucuyla
 * seçiliyor, yani elemeye giren fiyat tabloda görünen fiyatın kendisi.
 */

export async function generateStaticParams() {
  return THEME_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata(props: PageProps<"/tema/[slug]">) {
  const { slug } = await props.params;
  const { locale } = await getI18n();
  const theme = themeBySlug(slug);
  if (!theme) return missingMetadata(locale);
  const title = themeTitle(theme, locale);
  return {
    title: locale === "en" ? `${title} Stocks` : `${title} Hisseleri`,
    description: metaDescription(themeDek(theme, locale)),
    alternates: pageAlternates(`/tema/${theme.slug}`, locale),
  };
}

export default async function ThemePage(props: PageProps<"/tema/[slug]">) {
  const { slug } = await props.params;
  const { locale, t } = await getI18n();
  const theme = themeBySlug(slug);
  if (!theme) notFound();

  const status = await getStatus();
  const quoteSymbols = await themeQuoteSymbols(theme);
  const [quotesResult, names] = await Promise.all([
    getQuotes(quoteSymbols, status),
    getSymbolNames(quoteSymbols),
  ]);
  const quotes = quotesResult.ok ? quotesResult.data : {};

  const benchmarkSymbol = theme.benchmark?.symbol ?? null;
  const memberSymbols =
    theme.symbols === "katilim"
      ? await katilimMembers(quoteSymbols, quotes, names)
      : quoteSymbols.filter((symbol) => symbol !== benchmarkSymbol);

  const rows = memberSymbols
    .map((symbol) => themeRow(symbol, quotes, names, status))
    .sort(byMarketCap);
  const moves = sameSessionMoves(rows);
  const benchmark =
    theme.benchmark && quotesResult.ok
      ? {
          ...themeRow(theme.benchmark.symbol, quotes, names, status),
          displayName: theme.benchmark.name,
        }
      : null;

  /* İlk dört, piyasa değerine göre — karşılaştırma ekranının sembol sınırı. */
  const compareSet = rows.slice(0, MAX_COMPARE_SYMBOLS).map((row) => row.symbol);
  const title = themeTitle(theme, locale);

  return (
    <MotionExperience className={polish.page}>
      <BreadcrumbJsonLd
        locale={locale}
        items={[
          { name: t.themes.title, path: "/tema" },
          { name: title, path: `/tema/${theme.slug}` },
        ]}
      />
      <Link
        href="/tema"
        className="tap-44 -my-2 inline-flex w-fit min-h-8 items-center gap-1.5 py-2 text-small font-semibold text-muted transition-colors hover:text-primary"
      >
        <ArrowLeft weight="bold" size={13} />
        {t.themes.backToList}
      </Link>
      <PageHeader
        eyebrow={t.themes.eyebrow}
        title={title}
        subtitle={themeDek(theme, locale)}
        action={
          compareSet.length >= 2 ? (
            <ButtonLink href={compareHref(compareSet)} variant="ghost" prefetch={false}>
              {t.themes.compareTop}
            </ButtonLink>
          ) : undefined
        }
      />

      <ThemeStats
        count={rows.length}
        moves={moves}
        locale={locale}
        labels={{
          title: t.themes.todayTitle,
          companies: t.themes.companies,
          median: t.themes.median,
          medianSession: t.themes.medianSession,
          medianLastClose: t.themes.medianLastClose,
          medianMissing: t.themes.medianMissing,
          breadth: t.themes.breadth,
        }}
      />

      <Panel>
        <PanelHeader title={t.themes.tableTitle} />
        {rows.length > 0 ? (
          <ThemeTable
            rows={rows}
            benchmark={benchmark}
            moves={moves}
            locale={locale}
            labels={{
              region: t.themes.tableRegion,
              company: t.themes.colCompany,
              price: t.themes.colPrice,
              day: t.themes.colDay,
              cap: t.themes.colCap,
              benchmark: t.themes.benchmark,
              lastClose: t.themes.lastClose,
            }}
          />
        ) : (
          <p className="border-t border-line px-4 py-4 text-small text-muted sm:px-5">
            {t.themes.katilimEmpty}
          </p>
        )}
        {!quotesResult.ok && (
          <p className="border-t border-line px-4 py-3 text-small text-muted sm:px-5">
            {t.themes.quotesUnavailable}
          </p>
        )}
      </Panel>

      <Panel>
        <PanelHeader title={t.themes.whyTitle} />
        <p className="border-t border-line px-4 py-4 text-read leading-[27px] text-body sm:px-5">
          {themeWhy(theme, locale)}
        </p>
        {/* KÜNYELER PANELİN İÇİNDE, hairline ile ayrılmış düz paragraflar —
            bir uyarı için yeni kutu açılmıyor (ekran düzeni kuralı 6). */}
        {theme.symbols === "katilim" && (
          <>
            <p className="border-t border-line px-4 py-3 text-small text-muted sm:px-5">
              {t.themes.katilimPool
                .replace("{pool}", String(KATILIM_POOL))
                .replace("{max}", String(KATILIM_MAX))}
            </p>
            <p className="border-t border-line px-4 py-3 text-small text-muted sm:px-5">
              <span className="font-semibold text-strong">{t.stock.complianceNotFatwa}.</span>{" "}
              {t.stock.complianceDisclaimer} {t.stock.complianceMissing}
            </p>
          </>
        )}
        <p className="border-t border-line px-4 py-3 text-small text-muted sm:px-5">
          {t.themes.listNote}
        </p>
      </Panel>

      {quotesResult.ok && (
        <DataStamp
          labels={t.data}
          source={quotesResult.source}
          at={quotesResult.fetchedAt}
          stale={quotesResult.stale}
          locale={locale}
        />
      )}
      <GuideHint label={t.guide.contextLabel} locale={locale} slugs={[...theme.guides]} />
    </MotionExperience>
  );
}
