import { Suspense } from "react";
import { QueryTransition } from "@/components/layout/QueryTransition";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { MotionExperience, ScrollProgress } from "@/components/motion/PremiumMotion";
import styles from "@/components/motion/DirectoryExperience.module.css";
import { GuideHint } from "@/components/article/GuideHint";
import { ScaleBar } from "@/components/markets/CompareScale";
import { ChipStrip } from "@/components/ui/ChipStrip";
import { FilterChip } from "@/components/ui/FilterChip";
import { LoadingFallback } from "@/components/ui/LoadingState";
import { ScrollEdges } from "@/components/ui/ScrollEdges";
import { LinkedRows } from "@/components/companies/LinkedRows";
import {
  DataStamp,
  EmptyState,
  LogoTile,
  PageHeader,
  Panel,
  PanelHeader,
  Skeleton,
  SkeletonRow,
} from "@/components/ui/primitives";
import { primaryOnly } from "@/db/seed/indices";
import { getCompanies, getStatus, liveMarketCap, type CompanyRow } from "@/lib/data";
import { getI18n, type Dictionary, type Locale } from "@/lib/i18n";
import { pageMetadata } from "@/lib/page-meta";
import { getQuotes } from "@/lib/providers";
import { sectorLabel } from "@/lib/sectors";
import type { StoredMetrics } from "@/lib/scorecard";
import { getAllMetrics, type ScreenerMetricsRow } from "@/lib/symbol-metrics";
import {
  bandFiyatiKapsiyorMu,
  cn,
  directionOf,
  directionText,
  formatMoneyCompact,
  formatPercent,
  staleMark,
  NO_VALUE,
} from "@/lib/utils";

export const generateMetadata = pageMetadata({
  path: "/tarama",
  tr: {
    title: "Hisse Tarayıcı",
    description:
      "Endeks üyelerini temel ölçülerle süz ve sırala: F/K, gelir büyümesi, net marj, özkaynak kârlılığı, borçluluk.",
  },
  en: {
    title: "Stock Screener",
    description:
      "Filter and sort index members by fundamentals: P/E, revenue growth, net margin, return on equity, leverage.",
  },
});

/**
 * Hisse Tarayıcı — /tarama (15 Ekim).
 *
 * `/sirketler` dizinin KİM olduğu, burası NASIL göründüğü: `symbol_metrics`
 * tablosundaki temel ölçüler (Finnhub, kademeli tazelenen ~500 GICS'li
 * endeks üyesi) süzülüp sıralanıyor. Kalıbın tamamı /sirketler'den: durum
 * adreste yaşar (?sektor=&suzgec=&sirala=&yon=&adet=), sıralama TAMAMI
 * üzerinde yapılır dilim sonra alınır, boş değer her yönde sonda, tablo
 * Suspense ile ayrı akar.
 *
 * Veri dürüstlüğü: F/K SAKLANMAZ, canlı fiyattan kurulur (lib/scorecard.ts
 * gerekçesi) ve yalnızca USD raporlayan + fiyatı 52 hafta bandında kalan
 * şirkette; bayat kotasyonun fiyatı ORANA GİRMEZ (ScorecardPanel kuralı) —
 * o turda F/K ve canlı piyasa değeri hesaplanmaz ve künye bunu söyler.
 * Kapsam sınırlı ve panelin dibinde yazılı: dizindeki her şirket burada yok.
 */

const SORT_KEYS = ["cap", "fk", "buyume", "marj", "roe", "borc"] as const;
type SortKey = (typeof SORT_KEYS)[number];
type SortDir = "asc" | "desc";

const PAGE_STEP = 60;

/** Hazır süzgeçler — ölçüt çipte değil panel künyesinde yazılır (dürüstlük). */
const PRESETS = ["deger", "buyume", "karlilik", "saglam"] as const;
type PresetKey = (typeof PRESETS)[number];

type Row = {
  symbol: string;
  sector: string;
  company: CompanyRow;
  metrics: StoredMetrics;
  /** Canlı fiyattan kurulmuş F/K; kurulamıyorsa null (gerekçe üstte). */
  fk: number | null;
  cap: number | null;
};

function presetTest(key: PresetKey, row: Row): boolean {
  const m = row.metrics;
  switch (key) {
    case "deger":
      return row.fk !== null && row.fk < 20;
    case "buyume":
      return m.revenueGrowthTTMYoy !== null && m.revenueGrowthTTMYoy >= 15;
    case "karlilik":
      return m.netProfitMarginTTM !== null && m.netProfitMarginTTM >= 15;
    case "saglam":
      return (
        m.debtToEquity !== null &&
        m.debtToEquity >= 0 &&
        m.debtToEquity < 1 &&
        m.currentRatio !== null &&
        m.currentRatio >= 1.5
      );
  }
}

/** GICS sektör adı → adres anahtarı ("Information Technology" → "information-technology"). */
function sectorSlug(sector: string): string {
  return sector.toLocaleLowerCase("en-US").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

/** Oran biçimi — "18,4" (tr) / "18.4" (en); null → —. */
function formatRatio(value: number | null, locale: Locale): string {
  if (value === null || !Number.isFinite(value)) return NO_VALUE;
  return new Intl.NumberFormat(locale === "tr" ? "tr-TR" : "en-US", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);
}

function SortHead({
  label,
  href,
  active,
  dir,
  className,
  hint,
}: {
  label: string;
  href: string;
  active: boolean;
  dir: SortDir;
  className?: string;
  hint?: string;
}) {
  return (
    <th
      scope="col"
      aria-sort={active ? (dir === "desc" ? "descending" : "ascending") : "none"}
      className={cn("px-1.5 py-2.5 text-right font-semibold sm:px-3", className)}
    >
      {/* Dokunma hedefi ve scroll={false} — gerekçeler /sirketler SortHead'de. */}
      <Link
        href={href}
        scroll={false}
        title={hint}
        className={cn(
          "-my-3.5 inline-flex min-h-11 items-center gap-1 py-3.5 transition-colors hover:text-primary sm:-my-2 sm:min-h-8 sm:py-2",
          active && "text-primary",
        )}
      >
        {label}
        <span aria-hidden className="numeral text-micro text-primary-ink">
          {active ? (dir === "desc" ? "▼" : "▲") : "▽"}
        </span>
      </Link>
    </th>
  );
}

export default async function ScreenerPage(props: PageProps<"/tarama">) {
  const search = await props.searchParams;
  const { locale, t } = await getI18n();
  const L = t.screener;

  const sort: SortKey = SORT_KEYS.includes(search.sirala as SortKey)
    ? (search.sirala as SortKey)
    : "cap";
  const dir: SortDir = search.yon === "asc" ? "asc" : "desc";
  const preset: PresetKey | null = PRESETS.includes(search.suzgec as PresetKey)
    ? (search.suzgec as PresetKey)
    : null;
  const sectorParam = typeof search.sektor === "string" ? search.sektor : null;

  const requested = Number(typeof search.adet === "string" ? search.adet : PAGE_STEP);
  const limit =
    Number.isFinite(requested) && requested > 0
      ? Math.ceil(requested / PAGE_STEP) * PAGE_STEP
      : PAGE_STEP;

  const paramsFor = (over: {
    sort?: SortKey;
    dir?: SortDir;
    preset?: PresetKey | null;
    sector?: string | null;
    adet?: number;
  }) => {
    const params = new URLSearchParams({
      sirala: over.sort ?? sort,
      yon: over.dir ?? dir,
    });
    const p = over.preset === undefined ? preset : over.preset;
    const s = over.sector === undefined ? sectorParam : over.sector;
    if (p) params.set("suzgec", p);
    if (s) params.set("sektor", s);
    if (over.adet) params.set("adet", String(over.adet));
    return `/tarama?${params.toString()}`;
  };
  const sortHref = (key: SortKey) =>
    paramsFor({
      sort: key,
      dir: sort === key && dir === "desc" ? "asc" : "desc",
      adet: limit > PAGE_STEP ? limit : undefined,
    });

  return (
    <MotionExperience className={styles.page}>
      <ScrollProgress />
      <PageHeader title={L.title} subtitle={L.subtitle} />
      <div className="flex flex-col gap-4">
        {/* Hazır süzgeç şeridi — ölçütü çip değil künye söyler. */}
        <ChipStrip
          activeKey={preset}
          scrollLabels={{ prev: t.common.scrollPrev, next: t.common.scrollNext }}
          className="scroll-x flex items-center gap-1.5 sm:gap-2"
        >
          <FilterChip href={paramsFor({ preset: null })} active={preset === null} label={L.presetAll} />
          {PRESETS.map((key) => (
            <FilterChip
              key={key}
              href={paramsFor({ preset: preset === key ? null : key })}
              active={preset === key}
              label={L.presets[key]}
            />
          ))}
        </ChipStrip>
      </div>

      <QueryTransition label={t.common.loading}>
        <Suspense
          key={`${sectorParam ?? "hepsi"}:${preset ?? "yok"}:${sort}:${dir}`}
          fallback={
            <LoadingFallback label={t.common.loading}>
              <ScreenerSkeleton />
            </LoadingFallback>
          }
        >
          <ScreenerTable
            sort={sort}
            dir={dir}
            preset={preset}
            sectorParam={sectorParam}
            limit={limit}
            paramsFor={paramsFor}
            sortHref={sortHref}
            locale={locale}
            t={t}
          />
        </Suspense>
      </QueryTransition>

      <GuideHint
        label={t.guide.contextLabel}
        locale={locale}
        slugs={["degerleme", "piyasa-degeri"]}
        className="pt-1"
      />
    </MotionExperience>
  );
}

async function ScreenerTable({
  sort,
  dir,
  preset,
  sectorParam,
  limit,
  paramsFor,
  sortHref,
  locale,
  t,
}: {
  sort: SortKey;
  dir: SortDir;
  preset: PresetKey | null;
  sectorParam: string | null;
  limit: number;
  paramsFor: (over: {
    sort?: SortKey;
    dir?: SortDir;
    preset?: PresetKey | null;
    sector?: string | null;
    adet?: number;
  }) => string;
  sortHref: (key: SortKey) => string;
  locale: Locale;
  t: Dictionary;
}) {
  const L = t.screener;
  const [metricsRows, companies, status] = await Promise.all([
    getAllMetrics(),
    getCompanies().then(primaryOnly),
    getStatus(),
  ]);

  /* Tablo yok ya da henüz boş: iki durumda da "Hazırlanıyor" — okuyucu için
     fark yok, ikisi de "veri kademeli toplanıyor" demek. */
  if (metricsRows === null || metricsRows.length === 0) {
    return <EmptyState scene="searching" title={L.preparing} hint={L.preparingHint} />;
  }

  const companyBySymbol = new Map(companies.map((company) => [company.symbol, company]));
  const known = metricsRows.filter(
    (row): row is ScreenerMetricsRow => companyBySymbol.has(row.symbol),
  );

  const symbols = known.map((row) => row.symbol);
  const quotesResult = await getQuotes(symbols, status);
  const quotes = quotesResult.ok ? quotesResult.data : {};
  /* Bayat paketin fiyatı ORANA girmez (veri dürüstlüğü 4): o turda F/K ve
     canlı piyasa değeri kurulmaz, önbellek değeri taban kalır. */
  const stale = !quotesResult.ok || quotesResult.stale === true;

  const rows: Row[] = known.map((row) => {
    const company = companyBySymbol.get(row.symbol)!;
    const price = stale ? null : quotes[row.symbol]?.price ?? null;
    const m = row.metrics;
    const fk =
      price !== null &&
      price > 0 &&
      row.currency === "USD" &&
      bandFiyatiKapsiyorMu(price, m.low52, m.high52) &&
      m.epsTTM !== null &&
      m.epsTTM > 0
        ? price / m.epsTTM
        : null;
    const cap =
      price !== null
        ? liveMarketCap(
            { marketCap: company.storedMarketCap, shareOutstanding: company.shareOutstanding },
            price,
          ) ?? company.marketCap
        : company.marketCap;
    return { symbol: row.symbol, sector: row.sector, company, metrics: m, fk, cap };
  });

  /* Sektör çipleri VERİDEN: 11 GICS sektörü, boş olan hiç görünmez. */
  const sectorCounts = new Map<string, number>();
  for (const row of rows) sectorCounts.set(row.sector, (sectorCounts.get(row.sector) ?? 0) + 1);
  const sectors = [...sectorCounts.keys()].sort((a, b) =>
    (sectorLabel(a, locale) ?? a).localeCompare(sectorLabel(b, locale) ?? b, locale),
  );
  const activeSector = sectors.find((sector) => sectorSlug(sector) === sectorParam) ?? null;

  const filtered = rows.filter(
    (row) =>
      (activeSector === null || row.sector === activeSector) &&
      (preset === null || presetTest(preset, row)),
  );

  const valueOf = (row: Row): number | null => {
    switch (sort) {
      case "fk":
        return row.fk;
      case "buyume":
        return row.metrics.revenueGrowthTTMYoy;
      case "marj":
        return row.metrics.netProfitMarginTTM;
      case "roe":
        return row.metrics.roeTTM;
      case "borc":
        /* Negatif özkaynak oranı anlamsız — boş sayılır, sonda kalır. */
        return row.metrics.debtToEquity !== null && row.metrics.debtToEquity >= 0
          ? row.metrics.debtToEquity
          : null;
      default:
        return row.cap;
    }
  };

  /* Boşlar her yönde SONDA — /sirketler'deki -Infinity dersi. */
  const sorted = [...filtered].sort((a, b) => {
    const av = valueOf(a);
    const bv = valueOf(b);
    if (av === null) return bv === null ? 0 : 1;
    if (bv === null) return -1;
    return dir === "asc" ? av - bv : bv - av;
  });
  const shown = sorted.slice(0, Math.min(limit, sorted.length));
  const total = filtered.length;
  const hasMore = total > shown.length;
  const peakCap = Math.max(...filtered.map((row) => row.cap ?? 0), 1);

  const presetNote = preset ? L.presetHints[preset] : null;

  return (
    <>
      <Panel className={styles.tablePanel}>
        <PanelHeader
          title={activeSector ? sectorLabel(activeSector, locale) ?? activeSector : L.allSectors}
          meta={(() => {
            const parts = [
              presetNote,
              hasMore
                ? L.showing.replace("{n}", String(shown.length)).replace("{total}", String(total))
                : null,
              quotesResult.ok && quotesResult.stale
                ? staleMark(t.data.mayBeStale, quotesResult.fetchedAt, locale)
                : null,
            ]
              .filter(Boolean)
              .join(" · ");
            /* Telefonda gizli sütuna göre sıralanmış olabilir — künye söyler
               (/sirketler kalıbı). */
            const sortLabels: Record<SortKey, string> = {
              cap: L.colCap,
              fk: L.colFk,
              buyume: L.colGrowth,
              marj: L.colMargin,
              roe: L.colRoe,
              borc: L.colDebt,
            };
            const sortNote = `${sortLabels[sort]} ${dir === "asc" ? "▲" : "▼"}`;
            return (
              <>
                {parts || null}
                <span className="sm:hidden">
                  {parts ? " · " : ""}
                  {sortNote}
                </span>
              </>
            );
          })()}
        />

        {/* Sektör şeridi panelin içinde, başlığın altında: süzgecin
            değiştirdiği liste ile aynı kutuda. */}
        {sectors.length > 1 && (
          <div className="border-b border-line-soft px-4 py-2.5 sm:px-5">
            <ChipStrip
              activeKey={activeSector ? sectorSlug(activeSector) : null}
              scrollLabels={{ prev: t.common.scrollPrev, next: t.common.scrollNext }}
              className="scroll-x flex items-center gap-1.5 sm:gap-2"
            >
              <FilterChip
                href={paramsFor({ sector: null })}
                active={activeSector === null}
                label={L.allSectors}
                count={rows.length}
              />
              {sectors.map((sector) => {
                const active = sector === activeSector;
                return (
                  <FilterChip
                    key={sector}
                    href={paramsFor({ sector: active ? null : sectorSlug(sector) })}
                    active={active}
                    label={sectorLabel(sector, locale) ?? sector}
                    count={sectorCounts.get(sector) ?? 0}
                  />
                );
              })}
            </ChipStrip>
          </div>
        )}

        {shown.length === 0 ? (
          <EmptyState title={L.empty} hint={L.emptyHint} compact />
        ) : (
          <ScrollEdges
            className={cn(
              styles.tableScroll,
              "scroll-x focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--line-focus)",
            )}
            tabIndex={0}
            role="region"
            aria-label={L.title}
            fixedStart
          >
            <table className="w-full table-fixed text-sm sm:table-auto sm:min-w-[760px]">
              <thead>
                <tr className="border-b border-line text-left text-nano text-muted">
                  <th className="hidden w-10 px-4 py-2.5 font-semibold sm:table-cell sm:px-5">#</th>
                  <th className="px-3 py-2.5 font-semibold">{L.company}</th>
                  <th className="hidden px-3 py-2.5 font-semibold lg:table-cell">{L.sector}</th>
                  <SortHead
                    label={L.colFk}
                    href={sortHref("fk")}
                    active={sort === "fk"}
                    dir={dir}
                    hint={L.colFkHint}
                    className="w-[58px] sm:w-auto"
                  />
                  <SortHead
                    label={L.colGrowth}
                    href={sortHref("buyume")}
                    active={sort === "buyume"}
                    dir={dir}
                    hint={L.colGrowthHint}
                    className="w-[76px] sm:w-auto"
                  />
                  <SortHead
                    label={L.colMargin}
                    href={sortHref("marj")}
                    active={sort === "marj"}
                    dir={dir}
                    hint={L.colMarginHint}
                    className="hidden sm:table-cell"
                  />
                  <SortHead
                    label={L.colRoe}
                    href={sortHref("roe")}
                    active={sort === "roe"}
                    dir={dir}
                    hint={L.colRoeHint}
                    className="hidden md:table-cell"
                  />
                  <SortHead
                    label={L.colDebt}
                    href={sortHref("borc")}
                    active={sort === "borc"}
                    dir={dir}
                    hint={L.colDebtHint}
                    className="hidden lg:table-cell"
                  />
                  <SortHead
                    label={L.colCap}
                    href={sortHref("cap")}
                    active={sort === "cap"}
                    dir={dir}
                    className="w-[74px] pr-4 sm:w-auto sm:pr-5"
                  />
                </tr>
              </thead>
              <LinkedRows data-motion-stagger className="divide-y divide-line-soft">
                {shown.map((row, index) => {
                  const m = row.metrics;
                  return (
                    <tr key={row.symbol} className="cursor-pointer transition-colors hover:bg-primary-tint">
                      <td className="numeral hidden px-4 py-3 text-xs text-muted sm:table-cell sm:px-5">
                        {index + 1}
                      </td>
                      <td className="py-3 pl-3 pr-1.5 sm:px-3">
                        <Link
                          href={`/hisse/${row.symbol}`}
                          prefetch={false}
                          className="flex min-h-11 items-center gap-2 sm:min-h-0 sm:gap-2.5"
                        >
                          <LogoTile
                            symbol={row.symbol}
                            logoUrl={row.company.logoUrl}
                            className="size-[30px] sm:size-[34px]"
                          />
                          <span className="min-w-0">
                            <span className="block text-base font-bold leading-[18px] text-strong">
                              {row.symbol}
                            </span>
                            <span className="block truncate text-tiny leading-[15px] text-muted">
                              {row.company.name}
                            </span>
                          </span>
                        </Link>
                      </td>
                      <td className="hidden max-w-44 truncate px-3 py-3 text-small text-soft lg:table-cell">
                        {sectorLabel(row.sector, locale) ?? row.sector}
                      </td>
                      <td className="numeral px-1.5 py-3 text-right text-read font-semibold text-strong sm:px-3">
                        {formatRatio(row.fk, locale)}
                      </td>
                      {/* Büyüme bir DEĞİŞİM — yön rengi meşru. Marj, ROE ve
                          borç seviye ölçüleri: renk yok, işaret sayının içinde. */}
                      <td className="numeral px-1.5 py-3 text-right text-read sm:px-3">
                        {m.revenueGrowthTTMYoy !== null ? (
                          <span
                            className={cn(
                              "font-semibold",
                              directionText(directionOf(m.revenueGrowthTTMYoy)),
                            )}
                          >
                            {formatPercent(m.revenueGrowthTTMYoy, locale, 1)}
                          </span>
                        ) : (
                          <span className="text-xs text-muted">{NO_VALUE}</span>
                        )}
                      </td>
                      <td className="numeral hidden px-3 py-3 text-right text-read text-body sm:table-cell">
                        {m.netProfitMarginTTM !== null
                          ? formatPercent(m.netProfitMarginTTM, locale, 1)
                          : NO_VALUE}
                      </td>
                      <td className="numeral hidden px-3 py-3 text-right text-read text-body md:table-cell">
                        {m.roeTTM !== null ? formatPercent(m.roeTTM, locale, 1) : NO_VALUE}
                      </td>
                      <td className="numeral hidden px-3 py-3 text-right text-read text-body lg:table-cell">
                        {formatRatio(
                          m.debtToEquity !== null && m.debtToEquity >= 0 ? m.debtToEquity : null,
                          locale,
                        )}
                      </td>
                      <td className="numeral py-3 pl-1 pr-3 text-right text-small font-semibold text-body sm:px-3 sm:pr-5 sm:text-base">
                        {row.cap ? (
                          <>
                            {formatMoneyCompact(row.cap, locale)}
                            <ScaleBar ratio={row.cap / peakCap} signed={false} className="max-w-[96px]" />
                          </>
                        ) : (
                          NO_VALUE
                        )}
                      </td>
                    </tr>
                  );
                })}
              </LinkedRows>
            </table>
          </ScrollEdges>
        )}

        {hasMore && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3 sm:px-5">
            <div className="min-w-0">
              <p className="numeral text-small text-muted">
                {L.showing.replace("{n}", String(shown.length)).replace("{total}", String(total))}
              </p>
              <span
                aria-hidden
                className="mt-1.5 block h-[3px] w-28 overflow-hidden rounded-full bg-(--line-soft)"
              >
                <span
                  data-motion-draw="line"
                  className="block h-full rounded-full bg-primary/60"
                  style={{ width: `${Math.min(100, (shown.length / Math.max(1, total)) * 100)}%` }}
                />
              </span>
            </div>
            <Link
              href={paramsFor({ adet: Math.min(limit, total) + PAGE_STEP })}
              scroll={false}
              className="inline-flex min-h-11 items-center rounded-md border border-line bg-surface px-4 text-base font-semibold text-body transition-[color,background-color,border-color,scale] hover:border-line-strong hover:text-strong active:scale-[0.97] motion-reduce:active:scale-100 sm:min-h-10"
            >
              {L.showMore}
            </Link>
          </div>
        )}

        {/* Kapsam künyesi panelin İÇİNDE, hairline üstünde (CLAUDE.md). */}
        <p className="border-t border-line px-4 py-3 text-small leading-relaxed text-muted sm:px-5">
          {L.coverage.replace("{n}", String(rows.length))}
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
    </>
  );
}

/** Süzgeç değişiminde anında görünen iskelet. */
function ScreenerSkeleton() {
  return (
    <Panel>
      <div className="flex min-h-12 items-center justify-between gap-4 px-4 py-3.5 sm:px-5">
        <Skeleton className="h-3 w-36" />
        <Skeleton className="h-2.5 w-16" />
      </div>
      <div className="flex h-9 items-center gap-6 border-b border-line bg-surface-sunken px-4 sm:px-5">
        <Skeleton className="h-2 w-20" />
        <Skeleton className="h-2 w-12" />
        <Skeleton className="ml-auto h-2 w-14" />
        <Skeleton className="h-2 w-14" />
      </div>
      <div className="flex flex-col gap-px">
        {Array.from({ length: 12 }).map((_, i) => (
          <SkeletonRow key={i} />
        ))}
      </div>
    </Panel>
  );
}
