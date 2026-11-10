import { PageShare } from "@/components/article/PageShare";
import { cache, Suspense } from "react";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { DirectoryHeader } from "@/components/motion/DirectoryHeader";
import { MotionExperience } from "@/components/motion/PremiumMotion";
import polish from "@/components/motion/UtilityExperience.module.css";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { GuideHint } from "@/components/article/GuideHint";
import { BreadcrumbJsonLd } from "@/components/seo/JsonLd";
import detail from "@/components/themes/ThemeDetail.module.css";
import { ThemeReading, type ReadingLabels } from "@/components/themes/ThemeReading";
import { ThemeStats } from "@/components/themes/ThemeStats";
import { ThemeTable } from "@/components/themes/ThemeTable";
import { ThemeTreemap } from "@/components/themes/ThemeTreemap";
import styles from "@/components/themes/Themes.module.css";
import { HeatLegend } from "@/components/themes/ThemeVisuals";
import { ThemeTimelineChart, type ThemeTimelineView } from "@/components/themes/ThemeTimelineChart";
import { evenTicks } from "@/lib/duo-chart";
import { gapVerdict } from "@/lib/return-timeline";
import { THEME_TIMELINE_RANGES, type ThemeTimelineRange } from "@/lib/theme-timeline";
import { loadThemeTimeline } from "@/lib/theme-timeline-data";
import { CompanyCards } from "@/components/ui/CompanyCards";
import {
  ButtonLink,
  DataStamp,
  LogoTile,
  Panel,
  PanelHeader,
  Skeleton,
  SkeletonRow,
} from "@/components/ui/primitives";
import {
  THEMES,
  THEME_SLUGS,
  themeBySlug,
  themeDek,
  themeTitle,
  themeWhy,
  type ThemeEntry,
} from "@/content/themes";
import { compareHref, MAX_COMPARE_SYMBOLS } from "@/lib/compare";
import { getStatus, getSymbolNames } from "@/lib/data";
import { getI18n, type Dictionary, type Locale } from "@/lib/i18n";
import { logoSrc } from "@/lib/logos";
import { metaDescription, missingMetadata } from "@/lib/page-meta";
import { getQuotes } from "@/lib/providers";
import { pageAlternates } from "@/lib/site";
import { sameSessionMoves, themePhase } from "@/lib/theme-stats";
import {
  byMarketCap,
  KATILIM_MAX,
  KATILIM_POOL,
  katilimMembers,
  katilimPool,
  themeRow,
  themeUniverse,
} from "@/lib/themes-data";
import { cn, formatPercent, formatPercentPlain, formatPrice } from "@/lib/utils";

/**
 * Tematik liste — "yapay zekâ hisseleri hangileri, bugün ne yaptılar".
 *
 * Ekran sırası (10 Kasım 2026, yeniden tasarım; önceki sıra kapak → harita
 * → ölçü ızgarası → zaman çizgisi → tablo idi):
 *   1. Kapak: ad, tek cümle ve GÜNÜN OKUMASI — medyan (sayfanın en büyük
 *      puntosu), üyelerin dağılım şeridi, ölçüt fonuyla kıyas
 *      (`ThemeReading`). Logo kümesi kalktı: sabit 184 piksellik kutuydu,
 *      beş üyeli temada içi boş duruyordu ve günü söylemiyordu.
 *      Akşam (ikinci tur): logolar sol sütuna TEK SIRA olarak döndü (44
 *      piksel, sabit boy — `HeroLogos`), kıyas iki kalın çubuk oldu
 *      (`ThemeStrip`); harita uzadı (oran 2,6 → 2,15), tabloda kimlik
 *      büyüdü (satır 60, logo 36 — ThemeTable.module.css).
 *   2. Ölçü ızgarası "Temanın Günü": yükselen/düşen, en güçlü, en zayıf ve
 *      en büyük üye. Kapaktaki medyanın açılımı, hemen altında.
 *   3. Ana görsel: kare haritası, panelin tam genişliğinde (ölçüt sütunu
 *      kapağa taşındı; harita 1440'ta 1.006 → 1.278 piksel).
 *   4. Sıralanabilir tablo (tek katlı satır), dibinde karşılaştırma
 *      bağlantısı. Haritanın hemen altında: "hangisi" sorusunun kesin
 *      sayıları.
 *   5. Zaman çizgisi (ikinci görsel, 1A/3A/YBB) — bugünden geçmişe.
 *   6. Metin (neden bu şirketler) ve künyeler panelin içinde.
 *   7. Diğer temalar, veri damgası, rehber.
 *
 * Kotasyon TEK ÇAĞRI ve dizinle AYNI ANAHTAR: bütün temaların üyeleri ve
 * ölçütleri (`themeUniverse`, gerekçesi orada). Ana sayfada okunan medyan
 * detayda başka bir çekim anından hesaplanmasın. Katılım temasında üyeler o çağrının sonucuyla
 * seçiliyor, yani elemeye giren fiyat tabloda görünen fiyatın kendisi.
 *
 * SAYFA KOTASYONU BEKLEMİYOR (28 Eylül). Sayfa önce kotasyonu (ve Katılım
 * temasında kırk adayın bilanço taramasını) bekleyip sonra tek parça
 * çiziyordu; soğuk önbellekte Katılım sayfasının ilk baytı 626 ms'ydi
 * (ölçüldü). Kapak, metin ve diğer temalar durağan (content/themes.ts);
 * veriye bağlı üç panel ve damga Suspense içinde akıyor ve hepsi aynı
 * `loadTheme`i okuyor (`cache`, istek içinde tek hesap).
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

/** Diğer temalar satırındaki logo sayısı; fazlası "+N". */
const OTHER_STACK_MAX = 4;

const loadTheme = cache(async function loadTheme(slug: string) {
  const theme = themeBySlug(slug)!;
  const status = await getStatus();
  const universe = await themeUniverse();
  const [quotesResult, names] = await Promise.all([
    getQuotes(universe, status),
    getSymbolNames(universe),
  ]);
  const quotes = quotesResult.ok ? quotesResult.data : {};

  const memberSymbols =
    theme.symbols === "katilim"
      ? await katilimMembers(await katilimPool(), quotes, names)
      : [...theme.symbols];

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
  const phase = moves ? themePhase(moves.basis, status.session) : null;
  return { theme, rows, moves, phase, benchmark, quotesResult, quotes, names, status };
});

export default async function ThemePage(props: PageProps<"/tema/[slug]">) {
  const { slug } = await props.params;
  const { locale, t } = await getI18n();
  const theme = themeBySlug(slug);
  if (!theme) notFound();

  const title = themeTitle(theme, locale);
  const katilim = theme.symbols === "katilim";
  const readingLabels: ReadingLabels = {
    median: t.themes.median,
    theme: t.themes.boardTheme,
    coverage: t.themes.coverage,
    medianMissing: t.themes.medianMissing,
    spreadLabel: t.themes.spreadLabel,
    spreadMissing: t.themes.spreadMissing,
    lastClose: t.themes.lastClose,
    benchAbove: t.themes.benchAbove,
    benchBelow: t.themes.benchBelow,
    benchEven: t.themes.benchEven,
    benchMixed: t.themes.benchMixed,
  };

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
      <DirectoryHeader
        title={title}
        description={themeDek(theme, locale)}
        share={<PageShare path={`/tema/${theme.slug}`} title={`${title} · ${t.themes.eyebrow}`} locale={locale} t={t} />}
        visual={
          <Suspense
            fallback={
              <ThemeReading data={null} hasBenchmark={theme.benchmark !== null} benchSymbol={theme.benchmark?.symbol} locale={locale} labels={readingLabels} />
            }
          >
            <LiveReading slug={theme.slug} locale={locale} t={t} labels={readingLabels} />
          </Suspense>
        }
      >
        <p className={styles.heroMeta}>
          <span>
            {katilim ? (
              t.themes.companies.replace("{count}", `≤ ${KATILIM_MAX}`)
            ) : (
              <b className="numeral">{t.themes.companies.replace("{count}", String(theme.symbols.length))}</b>
            )}
          </span>
          {theme.benchmark && (
            <span>
              {t.themes.benchmark}: <b className="numeral">{theme.benchmark.symbol}</b>
            </span>
          )}
        </p>
        {/* ÜYELERİN LOGOLARI KAPAKTA (10 Kasım akşamı; "temanın kimliği
            güçlü"): elle seçilmiş temada durağan (content/themes.ts), akış
            beklemez. Katılım'ın üyeleri sayfa açılınca seçiliyor: yedeği
            aynı boyda iskelet, kapak oynamaz. */}
        {katilim ? (
          <Suspense fallback={<HeroLogos members={null} />}>
            <LiveHeroLogos slug={theme.slug} />
          </Suspense>
        ) : (
          <HeroLogos members={(theme.symbols as readonly string[]).map((symbol) => ({ symbol, logoUrl: logoSrc(symbol, null) }))} />
        )}
      </DirectoryHeader>

      <Suspense fallback={<LiveSkeleton theme={theme} t={t} />}>
        <LiveTheme slug={theme.slug} locale={locale} t={t} />
      </Suspense>

      <Panel>
        <PanelHeader title={t.themes.whyTitle} />
        <p className="border-t border-line px-4 py-4 text-read leading-[27px] text-body sm:px-5">
          {themeWhy(theme, locale)}
        </p>
        {/* KÜNYELER PANELİN İÇİNDE, hairline ile ayrılmış düz paragraflar —
            bir uyarı için yeni kutu açılmıyor (ekran düzeni kuralı 6). */}
        {katilim && (
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

      <OtherThemes current={theme.slug} locale={locale} t={t} />

      {/* Damga en sonda ama aynı hesaptan: yedeği boş, akış ekranın
          dibine iniyor ve üstündeki hiçbir şeyi oynatmıyor. */}
      <Suspense fallback={null}>
        <LiveStamp slug={theme.slug} locale={locale} t={t} />
      </Suspense>
      <GuideHint label={t.guide.contextLabel} locale={locale} slugs={[...theme.guides]} />
    </MotionExperience>
  );
}

async function LiveReading({
  slug,
  locale,
  t,
  labels,
}: {
  slug: string;
  locale: Locale;
  t: Dictionary;
  labels: ReadingLabels;
}) {
  const { theme, rows, moves, phase, benchmark } = await loadTheme(slug);
  return (
    <ThemeReading
      data={{ rows, moves, benchmark }}
      hasBenchmark={theme.benchmark !== null}
      locale={locale}
      labels={{
        ...labels,
        /* Künye pencereye göre tek ifade ("Açılış Öncesi Medyanı"). */
        median: phase === "pre-market" ? t.themes.medianPre : phase === "lastClose" ? t.themes.medianClose : t.themes.median,
      }}
    />
  );
}

/** Kapaktaki logo sırasında basılan en çok logo: 1440'ta sol sütun 660
    piksel, 44 + 8 ile on iki logo sığıyor; fazlası zaten kırpılırdı. */
const HERO_LOGOS = 12;

function HeroLogos({ members }: { members: readonly { symbol: string; logoUrl: string | null }[] | null }) {
  return (
    <div className={detail.heroLogos} aria-hidden>
      {members === null
        ? Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className={detail.heroLogoGhost} />)
        : members.slice(0, HERO_LOGOS).map((member) => (
            <LogoTile key={member.symbol} symbol={member.symbol} logoUrl={member.logoUrl} size="lg" className={detail.heroLogo} card />
          ))}
    </div>
  );
}

async function LiveHeroLogos({ slug }: { slug: string }) {
  const { rows } = await loadTheme(slug);
  return <HeroLogos members={rows} />;
}

async function LiveStamp({ slug, locale, t }: { slug: string; locale: Locale; t: Dictionary }) {
  const { quotesResult } = await loadTheme(slug);
  if (!quotesResult.ok) return null;
  return (
    <DataStamp
      labels={t.data}
      source={quotesResult.source}
      at={quotesResult.fetchedAt}
      stale={quotesResult.stale}
      locale={locale}
    />
  );
}

async function LiveTheme({ slug, locale, t }: { slug: string; locale: Locale; t: Dictionary }) {
  const { theme, rows, moves, phase, benchmark, quotesResult, quotes, names, status } = await loadTheme(slug);

  /* İlk dört, piyasa değerine göre — karşılaştırma ekranının sembol sınırı. */
  const compareSet = rows.slice(0, MAX_COMPARE_SYMBOLS).map((row) => row.symbol);

  /* ŞİRKET KARTI — sayfanın bütün üye logoları ve karoları (kapak kümesi,
     harita, liste, tablo, en güçlü/zayıf) aynı kaydı açıyor; kart haritanın
     künye kartının yerini aldı ve onun "Temadaki Payı" satırını taşıyor.
     Diğer temalar satırındaki yığınların logoları da burada: aynı paket
     (`themeUniverse`), yeni tur yok. */
  const sizedTotal = rows.reduce((sum, row) => sum + (row.marketCap ?? 0), 0);
  const otherSymbols = THEMES.filter((entry) => entry.slug !== slug && entry.symbols !== "katilim").flatMap(
    (entry) => (entry.symbols as readonly string[]).slice(0, OTHER_STACK_MAX),
  );

  return (
    <>
      <CompanyCards
        symbols={[...rows.map((row) => row.symbol), ...otherSymbols]}
        quotes={quotesResult.ok ? quotes : null}
        stale={quotesResult.ok && Boolean(quotesResult.stale)}
        names={names}
        status={status}
        extras={Object.fromEntries(
          rows
            .filter((row) => row.marketCap !== null && row.marketCap > 0 && sizedTotal > 0)
            .map((row) => [
              row.symbol,
              {
                facts: [
                  [t.themes.mapShare, formatPercentPlain((row.marketCap! / sizedTotal) * 100, locale)] as [string, string],
                ],
              },
            ]),
        )}
      />
      <ThemeStats
        rows={rows}
        moves={moves}
        locale={locale}
        labels={{
          title: t.themes.todayTitle,
          medianSession:
            phase === "pre-market" ? t.themes.medianPreMarket : phase === "lastClose" ? t.themes.medianLastClose : t.themes.medianSession,
          coverage: t.themes.coverage,
          medianLastClose: t.themes.medianLastClose,
          medianMissing: t.themes.medianMissing,
          breadth: t.themes.breadth,
          best: t.themes.best,
          worst: t.themes.worst,
          largest: t.themes.largest,
          share: t.themes.mapShare,
        }}
      />

      {/* Panel kırpmıyor: karoların künye kartı haritanın dışına taşabiliyor.
          10 Kasım: ölçüt kıyası haritanın yanındaki 272 piksellik sütundan
          KAPAĞA taşındı (`ThemeReading`); harita panelin tam genişliğinde. */}
      <Panel className={styles.mapPanel}>
        <PanelHeader
          title={t.themes.mapTitle}
          action={rows.length > 0 ? <HeatLegend locale={locale} label={t.themes.mapHint} /> : undefined}
        />
        {rows.length > 0 ? (
          <div className={styles.mapBody}>
            <div className={styles.mapMain}>
              <p className={styles.mapHint}>
                {moves?.basis === "lastClose" ? t.themes.mapLastClose : t.themes.mapHint}
              </p>
              <ThemeTreemap
                rows={rows}
                moves={moves}
                solo
                locale={locale}
                labels={{
                  unsized: t.themes.mapUnsized,
                  lastClose: t.themes.lastClose,
                  small: t.themes.mapSmall,
                  smallTitle: t.themes.mapSmallTitle,
                  share: t.themes.mapShare,
                  cap: t.themes.colCap,
                }}
              />
            </div>
          </div>
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

      <Panel className={styles.tablePanel}>
        <PanelHeader title={t.themes.tableTitle} meta={t.themes.companies.replace("{count}", String(rows.length))} />
        {rows.length > 0 ? (
          <ThemeTable
            rows={rows}
            moves={moves}
            token={slug}
            locale={locale}
            labels={{
              region: t.themes.tableRegion,
              company: t.themes.colCompany,
              price: t.themes.colPrice,
              day: t.themes.colDay,
              cap: t.themes.colCap,
              lastClose: t.themes.lastClose,
              lastCloseNote: t.themes.tableLastCloseNote,
              sortBy: t.themes.sortBy,
              showAll: t.themes.tableAll,
              showLess: t.compact.showLess,
            }}
          />
        ) : (
          <p className="border-t border-line px-4 py-4 text-small text-muted sm:px-5">
            {t.themes.katilimEmpty}
          </p>
        )}
        {compareSet.length >= 2 && (
          <div className={styles.tableFoot}>
            <span className="text-small text-muted">{compareSet.join(" · ")}</span>
            <ButtonLink href={compareHref(compareSet)} variant="ghost" prefetch={false}>
              {t.themes.compareTop}
            </ButtonLink>
          </div>
        )}
      </Panel>
      {/* ZAMAN İÇİNDE (25 Ekim): ölçü ızgarası bugünü söylüyor; çizgi
          temanın 1A/3A/YBB seyrini ölçüt fonuyla. Ana görsel harita,
          ikinci görsel ölçü ızgarasının altında (CLAUDE.md ekran düzeni 3).
          Barlar ayrı istek: kendi Suspense'inde, iskelet aynı boyda.
          10 Kasım: tablonun ALTINA indi — ekran önce bugünü bitiriyor
          (kapak, ızgara, harita, tablo), sonra geçmişe bakıyor. */}
      {rows.length >= 2 && (
        <Suspense fallback={<TimelineSkeleton title={t.personalVisuals.themeChart.title} />}>
          <ThemeTimeline
            symbols={rows.map((row) => row.symbol)}
            benchmark={benchmark ? { symbol: benchmark.symbol } : null}
            path={`/tema/${slug}`}
            title={themeTitle(theme, locale)}
            locale={locale}
            t={t}
          />
        </Suspense>
      )}
    </>
  );
}

/** Gün etiketi: okuma kartında tam tarih, eksende kısa. */
function timelineDay(day: string, locale: Locale, style: "card" | "axis" | "month") {
  return new Intl.DateTimeFormat(locale === "tr" ? "tr-TR" : "en-US", {
    timeZone: "UTC",
    ...(style === "card"
      ? { day: "numeric", month: "short", year: "numeric" }
      : style === "axis"
        ? { day: "numeric", month: "short" }
        : { month: "short" }),
  }).format(new Date(`${day}T12:00:00Z`));
}

/**
 * Temanın zaman çizgisi — üç aralık sunucuda kuruluyor, istemci yalnız
 * seçiyor (gerekçe lib/theme-timeline-data.ts). Cümle ve künyeler burada,
 * şablon + veri; uydurma yok.
 */
async function ThemeTimeline({
  symbols,
  benchmark,
  path,
  title,
  locale,
  t,
}: {
  symbols: string[];
  benchmark: { symbol: string } | null;
  path: string;
  title: string;
  locale: Locale;
  t: Dictionary;
}) {
  const L = t.personalVisuals.themeChart;
  const data = await loadThemeTimeline([...symbols].sort().join(","), benchmark?.symbol ?? null);
  const views = {} as Record<ThemeTimelineRange, ThemeTimelineView | null>;
  for (const range of THEME_TIMELINE_RANGES) {
    const series = data?.[range];
    if (!series || series.points.length < 2) {
      views[range] = null;
      continue;
    }
    const days = series.points.map((p) => p.day);
    const last = series.points[series.points.length - 1];
    const pct = (value: number) => formatPercent(value, locale, 1);
    const verdict = gapVerdict(last.median, last.bench);
    const sentence = (verdict === "none" ? L.solo : L[verdict])
      .replace("{range}", t.chart.rangeLabels[range])
      .replace("{median}", pct(last.median))
      .replace("{bench}", benchmark?.symbol ?? "")
      .replace("{benchPct}", last.bench === null ? "" : pct(last.bench))
      .replace("{gap}", last.bench === null ? "" : formatPrice(Math.abs(last.median - last.bench), locale, { digits: 1 }));
    views[range] = {
      points: series.points.map((p) => ({
        label: timelineDay(p.day, locale, "card"),
        a: p.median,
        b: p.bench,
        notes: [
          ...(p.best ? [{ label: L.best.replace("{symbol}", p.best.symbol), value: p.best.pct }] : []),
          ...(p.worst && p.worst.symbol !== p.best?.symbol
            ? [{ label: L.worst.replace("{symbol}", p.worst.symbol), value: p.worst.pct }]
            : []),
        ],
      })),
      axis: evenTicks(days.length, 4).map((index) => ({
        index,
        label: timelineDay(days[index], locale, range === "YTD" ? "month" : "axis"),
      })),
      sentence,
      excluded: series.excluded.length > 0 ? L.excluded.replace("{symbols}", series.excluded.join(", ")) : null,
    };
  }
  if (THEME_TIMELINE_RANGES.every((range) => views[range] === null)) {
    return (
      <Panel>
        <PanelHeader title={L.title} />
        <p className="border-t border-line px-4 py-4 text-small text-muted sm:px-5">{L.unavailable}</p>
      </Panel>
    );
  }
  return (
    <Panel id="zaman" className="flex scroll-mt-28 flex-col gap-3 px-4 py-4 sm:px-5">
      <ThemeTimelineChart
        views={views}
        path={path}
        benchName={benchmark?.symbol ?? null}
        medianName={L.median}
        title={L.title}
        rangeLabel={L.rangeLabel}
        ranges={{ "1M": t.chart.ranges["1M"], "3M": t.chart.ranges["3M"], YTD: t.chart.ranges.YTD }}
        rangeLongs={{ "1M": t.chart.rangeLabels["1M"], "3M": t.chart.rangeLabels["3M"], YTD: t.chart.rangeLabels.YTD }}
        announce={L.announce}
        chartLabels={{ gap: L.gap, points: L.points, hint: L.hint }}
        chartTitle={L.chartLabel.replace("{title}", title)}
        locale={locale}
      />
      {/* Künye panelin İÇİNDE, hairline ile (ekran düzeni 6). */}
      <p className="border-t border-line pt-3 text-small leading-relaxed text-muted">{L.lead}</p>
    </Panel>
  );
}

function TimelineSkeleton({ title }: { title: string }) {
  return (
    <Panel aria-busy className="flex flex-col gap-3 px-4 py-4 sm:px-5">
      <h2 className="display-ink display-ink-tight w-fit text-read font-bold">{title}</h2>
      <Skeleton className="h-6 w-3/4" />
      <Skeleton className="h-[200px] w-full" />
      <Skeleton className="h-4 w-1/2" />
    </Panel>
  );
}

/**
 * Akış sürerken yerini tutan iskelet — canlı sırayla aynı üç panel: ölçü
 * ızgarası, haritanın kabı aynı oranda, tablo aynı satır sayısında
 * (Katılım'da tavan kadar; kalabalık temada katlı hâlinin on iki satırı).
 * Harita oranı tuttuğu için veri inince altındaki hiçbir şey kaymıyor.
 */
function LiveSkeleton({ theme, t }: { theme: ThemeEntry; t: Dictionary }) {
  /* Tabloda katlama eşiği ThemeTable ile aynı: 15'ten fazla üyede 12 satır. */
  const members = theme.symbols === "katilim" ? KATILIM_MAX : theme.symbols.length;
  const rowCount = members > 15 ? 12 : members;
  return (
    <>
      <Panel aria-busy>
        <PanelHeader title={t.themes.todayTitle} />
        <div className={detail.metrics} data-cells={4}>
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className={detail.metric}>
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-11 w-28" />
              <Skeleton className="h-7 w-36" />
            </div>
          ))}
        </div>
      </Panel>
      <Panel aria-busy>
        <PanelHeader title={t.themes.mapTitle} />
        <div className={styles.mapBody}>
          <div className={styles.mapMain}>
            <p className={styles.mapHint}>{t.themes.mapHint}</p>
            <div className={cn("skeleton rounded-xl", styles.mapSkeleton)} />
          </div>
        </div>
      </Panel>
      <Panel aria-busy>
        <PanelHeader title={t.themes.tableTitle} />
        {/* Satır boyu tabloyla aynı (640+ 60, telefon 56 — ThemeTable.module.css). */}
        <div className="border-t border-line-soft">
          {Array.from({ length: rowCount }, (_, i) => (
            <div key={i} className="flex h-14 flex-col justify-center sm:h-[60px]">
              <SkeletonRow />
            </div>
          ))}
        </div>
      </Panel>
    </>
  );
}

/**
 * Diğer temalara geçiş — satırlar (1024+ üç, 768+ iki sütun), her satırda
 * temanın ilk logoları. Durağan: sayılar yok, akış beklemiyor.
 */
function OtherThemes({ current, locale, t }: { current: string; locale: Locale; t: Dictionary }) {
  const others = THEMES.filter((theme) => theme.slug !== current);
  return (
    <Panel>
      <PanelHeader title={t.themes.otherThemes} />
      <ul className={styles.others}>
        {others.map((theme) => (
          <li key={theme.slug} className="min-w-0">
            <Link href={`/tema/${theme.slug}`} prefetch={false} className={styles.otherLink}>
              {/* Katılım'ın üyeleri sayfa açılınca seçiliyor; burada logosu
                  yok ama sütun yerinde, adlar aynı hatta başlasın. */}
              <span className={styles.otherLogos} aria-hidden>
                {theme.symbols !== "katilim" && (
                  <>
                    {/* Tek bir üye artıyorsa "+1" yerine onun logosu (28 Eylül
                        kuralı: yer varken göster). */}
                    {theme.symbols.slice(0, theme.symbols.length === OTHER_STACK_MAX + 1 ? OTHER_STACK_MAX + 1 : OTHER_STACK_MAX).map((symbol) => (
                      <LogoTile key={symbol} symbol={symbol} logoUrl={logoSrc(symbol, null)} size="xs" card />
                    ))}
                    {theme.symbols.length > OTHER_STACK_MAX + 1 && (
                      <span className={cn("numeral", styles.otherMore)}>+{theme.symbols.length - OTHER_STACK_MAX}</span>
                    )}
                  </>
                )}
              </span>
              <span className={styles.otherText}>
                <b>{themeTitle(theme, locale)}</b>
                <small>
                  {theme.symbols === "katilim"
                    ? t.themes.companies.replace("{count}", `≤ ${KATILIM_MAX}`)
                    : t.themes.companies.replace("{count}", String(theme.symbols.length))}
                </small>
              </span>
              <ArrowRight weight="bold" size={14} className={styles.otherArrow} aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
