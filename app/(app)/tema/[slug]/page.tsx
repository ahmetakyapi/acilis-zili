import { cache, Suspense } from "react";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { DirectoryHeader } from "@/components/motion/DirectoryHeader";
import { MotionExperience } from "@/components/motion/PremiumMotion";
import polish from "@/components/motion/UtilityExperience.module.css";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { GuideHint } from "@/components/article/GuideHint";
import { BreadcrumbJsonLd } from "@/components/seo/JsonLd";
import { ThemeStats } from "@/components/themes/ThemeStats";
import { ThemeTable } from "@/components/themes/ThemeTable";
import { ThemeTreemap } from "@/components/themes/ThemeTreemap";
import styles from "@/components/themes/Themes.module.css";
import { HeatLegend, LogoGroup } from "@/components/themes/ThemeVisuals";
import { CompanyCards } from "@/components/ui/CompanyCards";
import {
  ButtonLink,
  DataStamp,
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
import { median, sameSessionMoves, themePhase, type MoveSet } from "@/lib/theme-stats";
import {
  byMarketCap,
  KATILIM_MAX,
  KATILIM_POOL,
  katilimMembers,
  katilimPool,
  themeRow,
  themeUniverse,
  type ThemeRow,
} from "@/lib/themes-data";
import {
  cn,
  directionOf,
  directionText,
  formatPercent,
  formatPercentPlain,
  formatPrice,
  NO_VALUE,
} from "@/lib/utils";

/**
 * Tematik liste — "yapay zekâ hisseleri hangileri, bugün ne yaptılar".
 *
 * Ekran sırası sitenin kuralı:
 *   1. Kapak: ad, tek cümle, üye logolarının kümesi.
 *   2. Ana görsel: kare haritası (piyasa değeriyle boyutlanmış karolar,
 *      günün hareketiyle boyanmış) ve yanında temanın ölçüt ETF'i.
 *   3. Ölçü ızgarası: medyan, yükselen/düşen, en güçlü ve en zayıf üye.
 *   4. Sıralanabilir tablo, dibinde karşılaştırma bağlantısı.
 *   5. Metin (neden bu şirketler) ve künyeler panelin içinde.
 *   6. Diğer temalar, veri damgası, rehber.
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

/** Kapak kümesinde en fazla kaç logo — tavan temaların üye tavanıyla aynı. */
const CLUSTER_MAX = 20;
/** Bu farkın altında "aynı yerde" denir: iki basamaklı yazımda 0,00. */
const EVEN_POINTS = 0.005;
/** Diğer temalar satırındaki logo yığını. */
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
  const symbols = theme.symbols;
  const katilim = symbols === "katilim";
  const staticMembers =
    symbols === "katilim" ? [] : symbols.map((symbol) => ({ symbol, logoUrl: logoSrc(symbol, null) }));

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
        eyebrow={t.themes.eyebrow}
        title={title}
        description={themeDek(theme, locale)}
        visual={
          katilim ? (
            <Suspense
              fallback={<LogoGroup members={[]} variant="cluster" size="lg" max={CLUSTER_MAX} placeholder={KATILIM_MAX} />}
            >
              <LiveCluster slug={theme.slug} />
            </Suspense>
          ) : (
            <LogoGroup members={staticMembers} variant="cluster" size="lg" max={CLUSTER_MAX} card />
          )
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

async function LiveCluster({ slug }: { slug: string }) {
  const { rows } = await loadTheme(slug);
  return <LogoGroup members={rows} variant="cluster" size="lg" max={CLUSTER_MAX} card />;
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
  const { rows, moves, phase, benchmark, quotesResult, quotes, names, status } = await loadTheme(slug);

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
      {/* Panel kırpmıyor: karoların künye kartı haritanın dışına taşabiliyor. */}
      <Panel className={styles.mapPanel}>
        <PanelHeader
          title={t.themes.mapTitle}
          action={rows.length > 0 ? <HeatLegend locale={locale} label={t.themes.mapHint} /> : undefined}
        />
        {rows.length > 0 ? (
          <div className={styles.mapBody} data-bench={benchmark ? "" : undefined}>
            <div className={styles.mapMain}>
              <p className={styles.mapHint}>
                {moves?.basis === "lastClose" ? t.themes.mapLastClose : t.themes.mapHint}
              </p>
              <ThemeTreemap
                rows={rows}
                moves={moves}
                solo={!benchmark}
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
            {benchmark && <BenchmarkAside
                benchmark={benchmark}
                moves={moves}
                sessionLabel={phase === "pre-market" ? t.themes.medianPreMarket : t.themes.medianSession}
                locale={locale}
                t={t}
              />}
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

      <ThemeStats
        rows={rows}
        moves={moves}
        locale={locale}
        labels={{
          title: t.themes.todayTitle,
          median: phase === "pre-market" ? t.themes.medianPre : phase === "lastClose" ? t.themes.medianClose : t.themes.median,
          medianSession: phase === "pre-market" ? t.themes.medianPreMarket : t.themes.medianSession,
          coverage: t.themes.coverage,
          medianLastClose: t.themes.medianLastClose,
          medianMissing: t.themes.medianMissing,
          breadth: t.themes.breadth,
          best: t.themes.best,
          worst: t.themes.worst,
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
              sortBy: t.themes.sortBy,
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
    </>
  );
}

/**
 * Ölçüt kıyası — temanın medyanı ile temayı izleyen ETF'in günü, ortak
 * sıfırdan iki yana açılan iki çubukla.
 *
 * Kıyas ancak ikisi AYNI SEANSI anlatıyorsa kuruluyor: açılış öncesinde
 * ETF bu sabah işlem görmüş, üyeler görmemiş olabilir (ya da tersi). O
 * hâlde iki sayı yine yazılıyor ama çubuk ve "kaç puan üstünde" cümlesi
 * yok; iki ayrı günden bir fark üretmek, fark göstermemekten kötü.
 */
function BenchmarkAside({
  benchmark,
  moves,
  sessionLabel,
  locale,
  t,
}: {
  benchmark: ThemeRow & { displayName: string };
  moves: MoveSet | null;
  sessionLabel: string;
  locale: Locale;
  t: Dictionary;
}) {
  const mid = moves ? median(moves.values) : null;
  const themeSession = moves?.basis === "session";
  const benchSession = benchmark.basis !== null && benchmark.basis !== "lastClose";
  const comparable =
    mid !== null && benchmark.changePct !== null && moves !== null && themeSession === benchSession;
  const peak = comparable ? Math.max(Math.abs(mid), Math.abs(benchmark.changePct!)) : 0;
  const diff = comparable ? mid - benchmark.changePct! : null;

  const bar = (value: number | null, session: boolean) => {
    if (!comparable || value === null || peak === 0 || value === 0) return null;
    const ratio = value / peak;
    return (
      <i
        className={styles.rankBar}
        data-tone={session ? (ratio > 0 ? "up" : "down") : "flat"}
        data-motion-draw="line"
        style={
          ratio > 0
            ? { left: "50%", width: `${ratio * 50}%`, transformOrigin: "left center" }
            : { right: "50%", width: `${-ratio * 50}%`, transformOrigin: "right center" }
        }
      />
    );
  };
  const tone = (value: number | null, session: boolean) =>
    value === null ? "text-muted" : session ? directionText(directionOf(value)) : "text-body";

  return (
    <aside className={styles.bench} aria-labelledby="theme-bench-title">
      <h3 id="theme-bench-title" className={styles.benchTitle}>
        {t.themes.benchTitle}
      </h3>
      <div className={styles.benchRow}>
        <span className={styles.benchLabel}>
          <b>{t.themes.benchMedian}</b>
          {moves ? (themeSession ? sessionLabel : t.themes.medianLastClose) : NO_VALUE}
        </span>
        <span className={cn("numeral", styles.benchValue, tone(mid, themeSession))}>
          {mid === null ? NO_VALUE : formatPercent(mid, locale)}
        </span>
        <span className={styles.benchTrack} aria-hidden>
          {bar(mid, themeSession)}
        </span>
      </div>
      <div className={styles.benchRow}>
        <span className={styles.benchLabel}>
          <b className="numeral">{benchmark.symbol}</b>
          {benchmark.displayName}
        </span>
        <span className={cn("numeral", styles.benchValue, tone(benchmark.changePct, benchSession))}>
          {benchmark.changePct === null ? NO_VALUE : formatPercent(benchmark.changePct, locale)}
        </span>
        <span className={styles.benchTrack} aria-hidden>
          {bar(benchmark.changePct, benchSession)}
        </span>
      </div>
      <p className={styles.benchNote}>
        {diff === null
          ? t.themes.benchMixed
          : Math.abs(diff) < EVEN_POINTS
            ? t.themes.benchEven
            : (diff > 0 ? t.themes.benchAbove : t.themes.benchBelow).replace(
                "{diff}",
                formatPrice(Math.abs(diff), locale),
              )}
      </p>
    </aside>
  );
}

/**
 * Akış sürerken yerini tutan iskelet — haritanın kabı aynı oranda, tablo
 * aynı satır sayısında (Katılım'da tavan kadar). Harita ilk ekranda
 * duruyor; oranı tuttuğu için veri inince altındaki hiçbir şey kaymıyor.
 */
function LiveSkeleton({ theme, t }: { theme: ThemeEntry; t: Dictionary }) {
  const rowCount = theme.symbols === "katilim" ? KATILIM_MAX : theme.symbols.length;
  return (
    <>
      <Panel aria-busy>
        <PanelHeader title={t.themes.mapTitle} />
        <div className={styles.mapBody} data-bench={theme.benchmark ? "" : undefined}>
          <div className={styles.mapMain}>
            <p className={styles.mapHint}>{t.themes.mapHint}</p>
            <div className={cn("skeleton rounded-xl", styles.mapSkeleton)} />
          </div>
          {theme.benchmark && (
            <div className={styles.bench}>
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          )}
        </div>
      </Panel>
      <Panel aria-busy>
        <PanelHeader title={t.themes.todayTitle} />
        <div className={styles.metrics}>
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className={styles.metric}>
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-11 w-28" />
            </div>
          ))}
        </div>
      </Panel>
      <Panel aria-busy>
        <PanelHeader title={t.themes.tableTitle} />
        <div className="border-t border-line-soft">
          {Array.from({ length: rowCount }, (_, i) => (
            <SkeletonRow key={i} />
          ))}
        </div>
      </Panel>
    </>
  );
}

/**
 * Diğer temalara geçiş — iki sütunlu satırlar, her satırda temanın ilk
 * logoları. Durağan: sayılar yok, akış beklemiyor.
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
              <LogoGroup
                members={
                  theme.symbols === "katilim"
                    ? []
                    : theme.symbols.map((symbol) => ({ symbol, logoUrl: logoSrc(symbol, null) }))
                }
                variant="stack"
                size="sm"
                max={OTHER_STACK_MAX}
                className={styles.otherStack}
                card
              />
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
