import { Suspense } from "react";
import { Rows, SquaresFour, X } from "@phosphor-icons/react/dist/ssr";
import { QueryTransition } from "@/components/layout/QueryTransition";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { MotionExperience, ScrollProgress } from "@/components/motion/PremiumMotion";
import styles from "@/components/motion/DirectoryExperience.module.css";
import { GuideHint } from "@/components/article/GuideHint";
import { SizeBar, UniverseLane } from "@/components/screener/Lanes";
import { MetricSwarm, type SwarmKind } from "@/components/screener/MetricSwarm";
import visual from "@/components/screener/ScreenerVisuals.module.css";
import { ChipStrip } from "@/components/ui/ChipStrip";
import { FilterChip } from "@/components/ui/FilterChip";
import { LoadingFallback } from "@/components/ui/LoadingState";
import { ScrollEdges } from "@/components/ui/ScrollEdges";
import { LinkedRows } from "@/components/companies/LinkedRows";
import { ScreenQueryBox } from "@/components/screener/ScreenQueryBox";
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
import { indexMemberOf, primaryOnly } from "@/db/seed/indices";
import { getCompanies, getStatus, liveMarketCap, type CompanyRow } from "@/lib/data";
import { getI18n, type Dictionary, type Locale } from "@/lib/i18n";
import { pageMetadata } from "@/lib/page-meta";
import { getQuotes } from "@/lib/providers";
import {
  EMPTY_FILTERS,
  GICS_SECTORS,
  hasFilters,
  SCREEN_SORTS,
  matchesScreenFilters,
  parseScreenParams,
  sectorSlug,
  withoutFilter,
  writeScreenParams,
  type ScreenCondition,
  type ScreenFilters,
} from "@/lib/screen-query";
import { sectorGroupByKey, sectorGroupLabel, sectorGroupOf, sectorLabel } from "@/lib/sectors";
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
import { median, percentileRank, screenerSentence, sharePercent } from "@/lib/tool-visuals";

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
 *
 * DÜZ CÜMLEYLE TARAMA (24 Ekim): kutuya yazılan cümleyi Claude bu sayfanın
 * süzgeçlerine çevirir (lib/screen-query.ts); sonuç adrese yazılır
 * (`grup`, `karli`, `fkmax`, `buyumemin`… ve görüntü için `cumle`) ve süzme
 * yine BURADA, aynı satırlar üzerinde yapılır. Etkin süzgeçler tek tek
 * kaldırılabilen çiplerdir; süzgeç değişince `cumle` düşer (çipler artık o
 * cümlenin çevirisi değil), sıralama ve "Daha Fazla" onu korur.
 */

const SORT_KEYS = SCREEN_SORTS;
type SortKey = (typeof SORT_KEYS)[number];
type SortDir = "asc" | "desc";

const PAGE_STEP = 60;

/** Sektör şeridinde parçanın içine sayı yazılan en küçük pay (ad, CSS kap sorgusuyla sığınca). */
const SEGMENT_LABEL_MIN = 0.05;
/** Şeridin altındaki künyede adıyla yazılan sektör sayısı; fazlası "Diğer". */
const LEGEND_LIMIT = 5;

/** Hazır süzgeçler — ölçüt çipte değil panel künyesinde yazılır (dürüstlük). */
const PRESETS = ["deger", "buyume", "karlilik", "saglam"] as const;
type PresetKey = (typeof PRESETS)[number];

type Row = {
  symbol: string;
  sector: string;
  group: string;
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

/** Koşulun eşiği — yüzdeler "%15" / "15%", oranlar sayı, piyasa değeri para. */
function conditionValue(c: ScreenCondition, locale: Locale): string {
  if (c.field === "marketCap") return formatMoneyCompact(c.value * 1e9, locale);
  const n = new Intl.NumberFormat(locale === "tr" ? "tr-TR" : "en-US", { maximumFractionDigits: 2 }).format(c.value);
  if (c.field === "pe" || c.field === "debtToEquity" || c.field === "currentRatio") return n;
  return locale === "tr" ? `%${n}` : `${n}%`;
}

/**
 * Görünüm — `?gorunum=kart|tablo` (25 Ekim). Adreste yoksa "auto": telefonda
 * kart, 640 pikselden genişte tablo; ikisi de basılır, CSS seçer (sunucu
 * ekranı bilmiyor, istemcide seçmek ilk karede yanlış görünümü gösterip
 * zıplatırdı). Anahtar seçilince yalnız o görünüm basılır.
 */
const VIEWS = ["kart", "tablo"] as const;
type ViewKey = (typeof VIEWS)[number] | "auto";

/** Ölçünün kümede nasıl çizildiği: piyasa değeri log ölçekte para, oranlar sayı. */
const METRIC_KIND: Record<SortKey, SwarmKind> = {
  cap: "money",
  fk: "ratio",
  buyume: "percent",
  marj: "percent",
  roe: "percent",
  borc: "ratio",
};

type ParamsOver = {
  view?: ViewKey;
  sort?: SortKey;
  dir?: SortDir;
  preset?: PresetKey | null;
  sector?: string | null;
  filters?: ScreenFilters;
  adet?: number;
};

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
  const filters = parseScreenParams(search);
  const sectorParam = filters.sector;
  const view: ViewKey = VIEWS.includes(search.gorunum as (typeof VIEWS)[number])
    ? (search.gorunum as (typeof VIEWS)[number])
    : "auto";
  const sentence = typeof search.cumle === "string" && search.cumle.trim() ? search.cumle.trim().slice(0, 200) : null;

  const requested = Number(typeof search.adet === "string" ? search.adet : PAGE_STEP);
  const limit =
    Number.isFinite(requested) && requested > 0
      ? Math.ceil(requested / PAGE_STEP) * PAGE_STEP
      : PAGE_STEP;

  const paramsFor = (over: ParamsOver) => {
    const params = new URLSearchParams({
      sirala: over.sort ?? sort,
      yon: over.dir ?? dir,
    });
    const p = over.preset === undefined ? preset : over.preset;
    const s = over.sector === undefined ? sectorParam : over.sector;
    if (p) params.set("suzgec", p);
    writeScreenParams(params, { ...(over.filters ?? filters), sector: s });
    if (over.adet) params.set("adet", String(over.adet));
    const v = over.view ?? view;
    if (v !== "auto") params.set("gorunum", v);
    /* Süzgeç değişirse çipler artık cümlenin çevirisi değil: cümle düşer. */
    const touches = over.preset !== undefined || over.sector !== undefined || over.filters !== undefined;
    if (sentence && !touches) params.set("cumle", sentence);
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
        <ScreenQueryBox
          labels={t.screenQuery}
          sentence={sentence}
          fieldLabels={t.screenQuery.fields}
          scrollLabels={{ prev: t.common.scrollPrev, next: t.common.scrollNext }}
        />
        <ActiveFilters filters={filters} paramsFor={paramsFor} locale={locale} t={t} />
        {/* Hazır süzgeç şeridi — ölçütü çip değil künye söyler. */}
        <ChipStrip
          activeKey={preset}
          scrollLabels={{ prev: t.common.scrollPrev, next: t.common.scrollNext }}
          className="scroll-x flex items-center gap-1.5 sm:gap-2"
        >
          {/* "Süzgeçsiz" gerçekten süzgeçsiz: cümleden gelen süzgeçler de
              açıkken seçili görünmez, basınca hepsi kalkar. */}
          <FilterChip
            href={paramsFor({ preset: null, sector: null, filters: EMPTY_FILTERS })}
            active={preset === null && !hasFilters(filters)}
            label={L.presetAll}
          />
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
          key={`${writeScreenParams(new URLSearchParams(), filters).toString() || "hepsi"}:${preset ?? "yok"}:${sort}:${dir}`}
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
            filters={filters}
            limit={limit}
            paramsFor={paramsFor}
            sortHref={sortHref}
            view={view}
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
  filters,
  limit,
  paramsFor,
  sortHref,
  view,
  locale,
  t,
}: {
  view: ViewKey;
  sort: SortKey;
  dir: SortDir;
  preset: PresetKey | null;
  sectorParam: string | null;
  filters: ScreenFilters;
  limit: number;
  paramsFor: (over: ParamsOver) => string;
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
    /* Alt sektör grubu sağlayıcının GICS alt sektöründen; yoksa endeks
       tohumundaki alt sektörden (/sirketler'in şeridiyle aynı eşleme). */
    const group = sectorGroupOf(company.industry ?? indexMemberOf(row.symbol)?.sub).key;
    return { symbol: row.symbol, sector: row.sector, group, company, metrics: m, fk, cap };
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
      (preset === null || presetTest(preset, row)) &&
      matchesScreenFilters(row, filters),
  );

  const metricOf = (row: Row, key: SortKey): number | null => {
    switch (key) {
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
  const valueOf = (row: Row) => metricOf(row, sort);

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
  const activeGroup = sectorGroupByKey(filters.group);
  const V = t.toolVisuals.screener;
  const sortLabels: Record<SortKey, string> = {
    cap: L.colCap,
    fk: L.colFk,
    buyume: L.colGrowth,
    marj: L.colMargin,
    roe: L.colRoe,
    borc: L.colDebt,
  };

  /* EVREN İÇİNDEKİ YER (25 Ekim). Satırın ve kartın kulvarı sıralanan
     ölçünün TARAMA EVRENİNDEKİ (süzgeçten önceki bütün satırlar) yüzdeliği:
     süzgeçten geçen bir F/K'nın "düşük" olup olmadığı ancak evrene göre
     okunur. Piyasa değeri sırasında kulvar yok — orada büyüklük çubuğu var. */
  const universe = rows
    .map((row) => valueOf(row))
    .filter((v): v is number => v !== null && Number.isFinite(v))
    .sort((a, b) => a - b);
  const laneOf = (row: Row) => {
    const value = valueOf(row);
    if (sort === "cap" || value === null || universe.length < 2) return null;
    const p = percentileRank(universe, value);
    return { p, title: V.laneTitle.replace("{p}", String(Math.round(p * 100))) };
  };

  /* Tepe cümlesi ve sektör şeridi SONUÇ KÜMESİNDEN (dilimden değil). */
  const resultSectors = new Map<string, number>();
  for (const row of filtered) resultSectors.set(row.sector, (resultSectors.get(row.sector) ?? 0) + 1);
  const sectorMix = [...resultSectors.entries()]
    .map(([sector, count]) => ({ sector, count, label: sectorLabel(sector, locale) ?? sector }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, locale));
  const isFiltered = filtered.length < rows.length;
  const lead = screenerSentence(
    {
      count: filtered.length,
      filtered: isFiltered,
      sectors: sectorMix.map(({ label, count }) => ({ label, count })),
      fkValues: filtered.map((row) => row.fk),
      formatFk: (value) => formatRatio(value, locale),
    },
    V.sentence,
  );
  const swarmPoints = filtered.flatMap((row) => {
    const v = valueOf(row);
    return v === null || !Number.isFinite(v) || (sort === "cap" && v <= 0)
      ? []
      : [{ s: row.symbol, n: row.company.name, v }];
  });

  return (
    <>
      {/* SONUCUN GÖRÜNÜMÜ — ana görsel, tablonun ÜSTÜNDE (ekran düzeni 3):
          tablo 60 satırı sırayla söylüyordu; kümenin şekli ve hangi
          sektörlerden oluştuğu hiçbir satırdan okunmuyordu. */}
      {filtered.length > 0 && (
        <Panel className={visual.summary}>
          <PanelHeader title={V.summaryTitle} meta={`${V.sortedBy}: ${sortLabels[sort]}`} />
          <div className={visual.summaryBody}>
            <p className={visual.lead}>{lead}</p>

            {sectorMix.length > 1 && (
              <section className={visual.block} aria-labelledby="tarama-sektor">
                <h3 id="tarama-sektor" className={visual.blockTitle}>{V.sectorMix}</h3>
                <div className={visual.strip} data-motion-stagger>
                  {sectorMix.map(({ sector, count, label }) => {
                    const share = count / filtered.length;
                    const p = sharePercent(share);
                    return (
                      <Link
                        key={sector}
                        href={paramsFor({ sector: sector === activeSector ? null : sectorSlug(sector) })}
                        scroll={false}
                        className={visual.segment}
                        data-active={sector === activeSector || undefined}
                        style={{ flexGrow: count }}
                        aria-label={V.sectorAria.replace("{sector}", label).replace("{n}", String(count)).replace("{p}", String(p))}
                        title={`${label} · ${count}`}
                      >
                        {share >= SEGMENT_LABEL_MIN && (
                          <span aria-hidden className={visual.segmentLabel}>
                            <span className={visual.segmentName}>{label}</span>
                            <b className="numeral">{count}</b>
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
                <ul className={visual.legend}>
                  {sectorMix.slice(0, LEGEND_LIMIT).map(({ sector, count, label }) => (
                    <li key={sector}>
                      <span className={visual.legendName}>{label}</span>
                      <span className="numeral">{count}</span>
                      <span className="numeral text-muted">{t.toolVisuals.companies.sharePct.replace("{p}", String(sharePercent(count / filtered.length)))}</span>
                    </li>
                  ))}
                  {sectorMix.length > LEGEND_LIMIT && (
                    <li className={visual.legendRest}>{V.other.replace("{n}", String(sectorMix.length - LEGEND_LIMIT))}</li>
                  )}
                </ul>
              </section>
            )}

            <section className={visual.block} aria-labelledby="tarama-kume">
              <div className={visual.blockHead}>
                <h3 id="tarama-kume" className={visual.blockTitle}>{V.swarmTitle.replace("{metric}", sortLabels[sort])}</h3>
                <ChipStrip
                  activeKey={sort}
                  scrollLabels={{ prev: t.common.scrollPrev, next: t.common.scrollNext }}
                  className="scroll-x flex items-center gap-1.5"
                >
                  {SORT_KEYS.map((key) => (
                    <FilterChip
                      key={key}
                      href={paramsFor({ sort: key, dir: key === sort ? dir : "desc" })}
                      active={key === sort}
                      label={sortLabels[key]}
                    />
                  ))}
                </ChipStrip>
              </div>
              {swarmPoints.length === 0 ? (
                <p className={visual.empty}>{V.swarmEmpty}</p>
              ) : (
                <MetricSwarm
                  points={swarmPoints}
                  /* F/K da log: yalnız pozitif (zarar edende boş) ve sağa çok
                     çarpık — doğrusalda büyüme süzgecinin kümesi sol kenara
                     yığılıyordu (25 Ekim ekran görüntüsü). */
                  scale={sort === "cap" || sort === "fk" ? "log" : "linear"}
                  kind={METRIC_KIND[sort]}
                  universeMedian={isFiltered ? median(universe) : null}
                  missing={filtered.length - swarmPoints.length}
                  locale={locale}
                  labels={{
                    aria: V.swarmAria.replace("{metric}", sortLabels[sort]).replace("{n}", String(swarmPoints.length)),
                    hint: V.swarmHint,
                    median: V.swarmMedian,
                    universe: V.swarmUniverse,
                    log: V.swarmLog,
                    clipped: V.swarmClipped,
                    missing: V.swarmMissing,
                    open: V.open,
                  }}
                />
              )}
            </section>
          </div>
        </Panel>
      )}

      <Panel className={styles.tablePanel}>
        <PanelHeader
          action={<ViewSwitch view={view} paramsFor={paramsFor} labels={t.toolVisuals.screener} />}
          title={
            activeGroup
              ? sectorGroupLabel(activeGroup, locale)
              : activeSector
                ? sectorLabel(activeSector, locale) ?? activeSector
                : L.allSectors
          }
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
          <>
          {view !== "tablo" && (
            <ScreenerCards
              rows={shown}
              sort={sort}
              auto={view === "auto"}
              peakCap={peakCap}
              laneOf={laneOf}
              sortLabels={sortLabels}
              locale={locale}
              t={t}
            />
          )}
          {view !== "kart" && (
          <ScrollEdges
            className={cn(
              styles.tableScroll,
              view === "auto" && visual.autoTable,
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
                  const lane = laneOf(row);
                  /* Kulvar yalnız SIRALANAN sütunda: altı sütunun hepsinde
                     ray, satırı çizgi yığınına çeviriyordu. */
                  const laneFor = (key: SortKey) =>
                    key === sort && lane ? <UniverseLane position={lane.p} title={lane.title} className="[--lane-max:72px]" /> : null;
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
                        {laneFor("fk")}
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
                        {laneFor("buyume")}
                      </td>
                      <td className="numeral hidden px-3 py-3 text-right text-read text-body sm:table-cell">
                        {m.netProfitMarginTTM !== null
                          ? formatPercent(m.netProfitMarginTTM, locale, 1)
                          : NO_VALUE}
                        {laneFor("marj")}
                      </td>
                      <td className="numeral hidden px-3 py-3 text-right text-read text-body md:table-cell">
                        {m.roeTTM !== null ? formatPercent(m.roeTTM, locale, 1) : NO_VALUE}
                        {laneFor("roe")}
                      </td>
                      <td className="numeral hidden px-3 py-3 text-right text-read text-body lg:table-cell">
                        {formatRatio(
                          m.debtToEquity !== null && m.debtToEquity >= 0 ? m.debtToEquity : null,
                          locale,
                        )}
                        {laneFor("borc")}
                      </td>
                      <td className="numeral py-3 pl-1 pr-3 text-right text-small font-semibold text-body sm:px-3 sm:pr-5 sm:text-base">
                        {row.cap ? (
                          <>
                            {formatMoneyCompact(row.cap, locale)}
                            <SizeBar ratio={row.cap / peakCap} />
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
          <p className={visual.laneLegend}>{t.toolVisuals.screener.laneLegend}</p>
          </>
        )}

        {hasMore && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3 sm:px-5">
            <div className="min-w-0">
              <p className="numeral text-small text-muted">
                {L.showing.replace("{n}", String(shown.length)).replace("{total}", String(total))}
              </p>
              <span
                aria-hidden
                className="mt-1.5 block h-[var(--lane-h,5px)] w-28 overflow-hidden rounded-full bg-(--line-soft)"
              >
                <span
                  data-motion-draw="line"
                  className={cn("block h-full rounded-full", visual.progressFill)}
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

/**
 * Etkin süzgeç çipleri — sektör, alt sektör grubu, kârlılık ve sayısal
 * koşullar; her çip TEK süzgeç ve tıklayınca o süzgeç kalkar. Adresten
 * çizilir: cümleden de gelse elle yazılmış adresten de gelse aynı çipler.
 * Hazır süzgeç burada yok — kendi şeridinde zaten seçili görünüyor.
 *
 * SAKİN (24 Ekim düzeltmesi): çipler dolu mavi tonla (`primary-tint`) hazır
 * süzgeç şeridindeki SEÇİLİ çiple aynı görünüyor, üç satır üst üste aynı
 * vurguyla bağırıyordu. Etkin süzgeç bir DURUM, eylem değil: çökük zemin,
 * ince çizgi, koyu metin; kaldırma imi soluk, üzerine gelince koyulaşır.
 * Mavi yalnız hazır süzgeç şeridinde, seçilide kalıyor.
 */
function ActiveFilters({
  filters,
  paramsFor,
  locale,
  t,
}: {
  filters: ScreenFilters;
  paramsFor: (over: ParamsOver) => string;
  locale: Locale;
  t: Dictionary;
}) {
  const Q = t.screenQuery;
  const sectorName = filters.sector ? GICS_SECTORS.find((name) => sectorSlug(name) === filters.sector) ?? null : null;
  const group = sectorGroupByKey(filters.group);
  const chips: { key: string; label: string; href: string }[] = [];
  if (sectorName) {
    chips.push({ key: "sector", label: sectorLabel(sectorName, locale) ?? sectorName, href: paramsFor({ sector: null }) });
  }
  if (group) {
    chips.push({
      key: "group",
      label: sectorGroupLabel(group, locale),
      href: paramsFor({ filters: withoutFilter(filters, { kind: "group" }) }),
    });
  }
  if (filters.profitable) {
    chips.push({
      key: "profitable",
      label: Q.profitable,
      href: paramsFor({ filters: withoutFilter(filters, { kind: "profitable" }) }),
    });
  }
  for (const c of filters.conditions) {
    chips.push({
      key: `${c.field}:${c.op}`,
      label: `${Q.fields[c.field]} ${c.op === "min" ? "≥" : "≤"} ${conditionValue(c, locale)}`,
      href: paramsFor({ filters: withoutFilter(filters, { kind: "condition", field: c.field, op: c.op }) }),
    });
  }
  if (chips.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
        <span className="mr-1 text-tiny font-semibold text-muted">{Q.activeLabel}</span>
        {chips.map((chip) => (
          <Link
            key={chip.key}
            href={chip.href}
            scroll={false}
            aria-label={Q.remove.replace("{label}", chip.label)}
            className="group inline-flex min-h-11 items-center gap-1.5 whitespace-nowrap rounded-full border border-line bg-surface-sunken pl-3.5 pr-2.5 text-small font-semibold text-strong transition-colors hover:border-line-strong sm:min-h-[34px]"
          >
            <span className="numeral">{chip.label}</span>
            <X aria-hidden size={13} weight="bold" className="text-muted transition-colors group-hover:text-strong" />
          </Link>
        ))}
        {chips.length > 1 && (
          <Link
            href={paramsFor({ sector: null, filters: EMPTY_FILTERS })}
            scroll={false}
            className="inline-flex min-h-11 items-center px-2 text-small font-semibold text-muted transition-colors hover:text-primary sm:min-h-[34px]"
          >
            {Q.clearAll}
          </Link>
        )}
      </div>
      {filters.conditions.length > 0 && <p className="text-tiny leading-relaxed text-muted">{Q.periodNote}</p>}
    </div>
  );
}

/** Süzgeç değişiminde anında görünen iskelet. */
function ScreenerSkeleton() {
  /* Özet paneli de iskelette (25 Ekim): yalnız tablo iskeleti basılınca
     gelen özet (~420 piksel) tabloyu aşağı itiyordu. */
  return (
    <>
    <Panel>
      <div className="flex min-h-12 items-center justify-between gap-4 px-4 py-3.5 sm:px-5">
        <Skeleton className="h-3 w-36" />
        <Skeleton className="h-2.5 w-24" />
      </div>
      <div className={visual.summarySkeleton}>
        <Skeleton className="h-4 w-full max-w-xl" />
        <Skeleton className="h-4 w-2/3 max-w-md" />
        <Skeleton className="mt-3 h-11 w-full" />
      </div>
    </Panel>
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
    </>
  );
}

/** Ölçünün satırdaki yazımı — tablo hücresiyle aynı biçim. */
function formatMetric(row: Row, key: SortKey, locale: Locale): string {
  const m = row.metrics;
  switch (key) {
    case "fk":
      return formatRatio(row.fk, locale);
    case "buyume":
      return formatPercent(m.revenueGrowthTTMYoy, locale, 1);
    case "marj":
      return formatPercent(m.netProfitMarginTTM, locale, 1);
    case "roe":
      return formatPercent(m.roeTTM, locale, 1);
    case "borc":
      return formatRatio(m.debtToEquity !== null && m.debtToEquity >= 0 ? m.debtToEquity : null, locale);
    default:
      return row.cap ? formatMoneyCompact(row.cap, locale) : NO_VALUE;
  }
}

/**
 * Kart / tablo anahtarı (25 Ekim). "auto"da iki düğme de seçili GÖRÜNMEZ:
 * hangisinin seçili olduğu ekrana bağlı ve onu CSS işaretliyor (telefonda
 * kart, genişte tablo); `aria-current` yalnız açık seçimde.
 */
function ViewSwitch({
  view,
  paramsFor,
  labels,
}: {
  view: ViewKey;
  paramsFor: (over: ParamsOver) => string;
  labels: Dictionary["toolVisuals"]["screener"];
}) {
  const items = [
    { key: "kart" as const, label: labels.viewCards, Icon: SquaresFour },
    { key: "tablo" as const, label: labels.viewTable, Icon: Rows },
  ];
  return (
    <div className={visual.viewSwitch} role="group" aria-label={labels.viewLabel} data-view={view}>
      {items.map(({ key, label, Icon }) => (
        <Link
          key={key}
          href={paramsFor({ view: key })}
          scroll={false}
          className={visual.viewButton}
          data-key={key}
          aria-current={view === key ? "true" : undefined}
        >
          <Icon aria-hidden size={16} weight="bold" />
          <span>{label}</span>
        </Link>
      ))}
    </div>
  );
}

/**
 * KART GÖRÜNÜMÜ (25 Ekim). Telefonda tablo dört sütuna sıkışıyor, marj/ROE/
 * borç gizli kalıyordu; kart her hisseyi bir bakışta okutuyor: sıralanan
 * ölçü büyük puntoyla ve evren içindeki yeriyle, öteki ölçüler altta ızgara,
 * piyasa değeri büyüklük çubuğuyla. Kartın tamamı hissenin bağlantısı.
 */
function ScreenerCards({
  rows,
  sort,
  auto,
  peakCap,
  laneOf,
  sortLabels,
  locale,
  t,
}: {
  rows: Row[];
  sort: SortKey;
  auto: boolean;
  peakCap: number;
  laneOf: (row: Row) => { p: number; title: string } | null;
  sortLabels: Record<SortKey, string>;
  locale: Locale;
  t: Dictionary;
}) {
  /* Izgarada sıralanan ölçü tekrar edilmez; dört hücre her zaman dolu. */
  const figures = (["fk", "buyume", "marj", "roe", "borc"] as SortKey[]).filter((key) => key !== sort).slice(0, 3);
  return (
    <ul className={cn(visual.cards, auto && visual.autoCards)} data-motion-stagger>
      {rows.map((row) => {
        const lane = laneOf(row);
        const growth = row.metrics.revenueGrowthTTMYoy;
        /* Yön rengi öznitelikle: modül CSS'i katmansız ve `text-up` gibi
           yardımcıları eziyor (CLAUDE.md, Tailwind v4 katman notu). */
        const growthDir = growth === null || growth === 0 ? undefined : growth > 0 ? "up" : "down";
        return (
          <li key={row.symbol}>
            <Link href={`/hisse/${row.symbol}`} prefetch={false} className={visual.card}>
              <span className={visual.cardHead}>
                <LogoTile symbol={row.symbol} logoUrl={row.company.logoUrl} className="size-[34px]" />
                <span className="min-w-0">
                  <b className={visual.cardSymbol}>{row.symbol}</b>
                  <span className={visual.cardName}>{row.company.name}</span>
                </span>
                <span className={visual.cardSector}>{sectorLabel(row.sector, locale) ?? row.sector}</span>
              </span>
              <span className={visual.cardMain}>
                <span className={visual.cardLabel}>{sortLabels[sort]}</span>
                <span className={cn("numeral", visual.cardValue)} data-dir={sort === "buyume" ? growthDir : undefined}>
                  {formatMetric(row, sort, locale)}
                </span>
                {sort === "cap"
                  ? row.cap
                    ? <SizeBar ratio={row.cap / peakCap} className={visual.cardLane} />
                    : null
                  : lane && <UniverseLane position={lane.p} title={lane.title} className={visual.cardLane} />}
              </span>
              <span className={visual.cardFigures}>
                {figures.map((key) => (
                  <span key={key}>
                    <span className={visual.cardLabel}>{sortLabels[key]}</span>
                    <b className="numeral" data-dir={key === "buyume" ? growthDir : undefined}>
                      {formatMetric(row, key, locale)}
                    </b>
                  </span>
                ))}
                {sort !== "cap" && (
                  <span>
                    <span className={visual.cardLabel}>{t.screener.colCap}</span>
                    <b className="numeral">{formatMetric(row, "cap", locale)}</b>
                    {row.cap ? <SizeBar ratio={row.cap / peakCap} className={visual.cardBar} /> : null}
                  </span>
                )}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
