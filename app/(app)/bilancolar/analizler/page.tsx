import Image from "next/image";
import Link from "next/link";
import { GuideHint } from "@/components/article/GuideHint";
import { auth } from "@/auth";
import {
  EmptyState,
  FilterChip,
  PageHeader,
  Panel,
  Segment,
  SegmentItem,
  SymbolBadge,
} from "@/components/ui/primitives";
import { AddToCalendar } from "@/components/earnings/AddToCalendar";
import { AnalysisTable } from "@/components/earnings/AnalysisTable";
import { EarningsTabs } from "@/components/earnings/EarningsTabs";
import { ScoreRing } from "@/components/earnings/ScoreRing";
import {
  getAnalyses,
  getEarningsBetween,
  getSymbolNames,
  getUserSymbols,
  type AnalysisIndexRow,
  type AnalysisSort,
} from "@/lib/data";
import { addEtDays, todayEt } from "@/lib/market-hours";
import { getI18n, type Dictionary, type Locale } from "@/lib/i18n";
import {
  analysisHref,
  analysisTableLabels,
  toAnalysisRowView,
  verdictLabel,
  verdictOf,
  verdictTextClass,
} from "@/lib/analysis";
import { sectorGroupLabel, sectorGroupOf, type SectorGroup } from "@/lib/sectors";
import {
  cn,
  formatEtDateCompact,
  formatEtDateLong,
  formatPercent,
  formatPercentPlain,
  formatPrice,
} from "@/lib/utils";

/**
 * Bilançolar · Analizler sekmesi.
 *
 * Takvim "ne zaman", bu ekran "ne çıktı" sorusunu yanıtlıyor. Üst sıra tek
 * bakışta günün hikâyesini veriyor, altındaki tablo arşivin tamamı.
 *
 * Sektör filtresi analizin kendi `sector` metninden DEĞİL, sembolün
 * `industry` alanından türeyen mevcut sektör taksonomisinden geliyor
 * (`lib/sectors.ts`): analiz metnindeki serbest tanım ("Yarı İletken · NAND /
 * Flash Depolama") okuyucuya hitap ediyor ama filtre anahtarı olamaz.
 */

const SORTS: readonly AnalysisSort[] = ["tarih", "skor", "tepki"];

function isSort(value: string | undefined): value is AnalysisSort {
  return SORTS.includes(value as AnalysisSort);
}

export default async function AnalysesPage(
  props: PageProps<"/bilancolar/analizler">,
) {
  const search = await props.searchParams;
  const sortParam = typeof search.sirala === "string" ? search.sirala : undefined;
  const sort: AnalysisSort = isSort(sortParam) ? sortParam : "tarih";
  const filter = typeof search.filtre === "string" ? search.filtre : null;

  const { locale, t } = await getI18n();
  const session = await auth();
  const today = todayEt();

  const [all, userSymbols] = await Promise.all([
    getAnalyses(locale, { limit: 60, sort }),
    session?.user?.id ? getUserSymbols(session.user.id) : Promise.resolve([]),
  ]);

  const meta = await getSymbolNames([
    ...new Set(all.map((row) => row.symbol)),
  ]);

  /* Filtre çipleri yalnızca ELDE OLAN sektörleri gösterir: hiçbir analizi
     olmayan bir sektör çipi tıklanınca boş ekran veriyordu. */
  const groups = new Map<string, SectorGroup>();
  for (const row of all) {
    const group = sectorGroupOf(meta[row.symbol]?.industry);
    groups.set(group.key, group);
  }

  const weekAgo = addEtDays(today, -7);
  const watchSet = new Set(userSymbols);

  const rows = all.filter((row) => {
    if (!filter) return true;
    if (filter === "hafta") return row.reportDate >= weekAgo;
    if (filter === "takip") return watchSet.has(row.symbol);
    return sectorGroupOf(meta[row.symbol]?.industry).key === filter;
  });

  const featured = all[0] ?? null;
  const thisWeek = all.filter((row) => row.reportDate >= weekAgo).slice(0, 5);

  const upcoming = await getEarningsBetween(today, addEtDays(today, 30));
  const upcomingMeta = await getSymbolNames([
    ...new Set(upcoming.map((row) => row.symbol)),
  ]);
  /* Sağlayıcı aynı sembol için birden çok tarih yazabiliyor (tahmin
     güncellenince eski satır kalıyor); panelde aynı şirketi iki kez
     görmek hata gibi okunuyordu. */
  const seenUpcoming = new Set<string>();
  const upcomingTop = upcoming
    .filter((row) => {
      if (seenUpcoming.has(row.symbol)) return false;
      seenUpcoming.add(row.symbol);
      return true;
    })
    .sort((a, b) => {
      const watchDelta =
        Number(watchSet.has(b.symbol)) - Number(watchSet.has(a.symbol));
      if (watchDelta !== 0) return watchDelta;
      return (
        (upcomingMeta[b.symbol]?.marketCap ?? 0) -
        (upcomingMeta[a.symbol]?.marketCap ?? 0)
      );
    })
    .slice(0, 5);

  const tableRows = rows.map((analysis) =>
    toAnalysisRowView(analysis, meta[analysis.symbol], locale, t),
  );

  const filterHref = (key: string | null) => {
    const params = new URLSearchParams();
    if (key) params.set("filtre", key);
    if (sort !== "tarih") params.set("sirala", sort);
    const query = params.toString();
    return query ? `/bilancolar/analizler?${query}` : "/bilancolar/analizler";
  };
  const sortHref = (key: AnalysisSort) => {
    const params = new URLSearchParams();
    if (filter) params.set("filtre", filter);
    if (key !== "tarih") params.set("sirala", key);
    const query = params.toString();
    return query ? `/bilancolar/analizler?${query}` : "/bilancolar/analizler";
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t.analysis.title} subtitle={t.analysis.subtitle} />

      <EarningsTabs active="analyses" t={t} className="-mt-1" />

      {all.length === 0 ? (
        <Panel>
          <EmptyState title={t.analysis.empty} hint={t.analysis.emptyHint} />
        </Panel>
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-[1.7fr_minmax(0,1fr)_minmax(0,1fr)]">
            {featured && (
              <FeaturedAnalysis
                row={featured}
                logoUrl={meta[featured.symbol]?.logoUrl ?? null}
                locale={locale}
                t={t}
              />
            )}

            <Panel className="flex min-w-0 flex-col gap-3 p-[18px] sm:p-5">
              <h2 className="text-[13px] font-bold text-strong">
                {t.analysis.thisWeekAnalyzed}
              </h2>
              <div className="flex flex-1 flex-col justify-between">
                {thisWeek.length === 0 ? (
                  <p className="text-xs text-muted">{t.analysis.emptyFilter}</p>
                ) : (
                  thisWeek.map((row) => {
                    const verdict = verdictOf(row.verdict);
                    return (
                      <Link
                        key={`${row.symbol}-${row.period}`}
                        href={analysisHref(row.symbol, row.period)}
                        prefetch={false}
                        className="flex items-center gap-2.5 border-b border-line-soft py-[7px] last:border-b-0 hover:opacity-75"
                      >
                        <PanelLogo
                          logoUrl={meta[row.symbol]?.logoUrl ?? null}
                          symbol={row.symbol}
                        />
                        <span className="w-[46px] shrink-0 text-[12.5px] font-bold text-strong">
                          {row.symbol}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-[11.5px] text-body">
                          {row.periodLabel}
                        </span>
                        <span
                          className={cn(
                            "figure shrink-0 text-[11px] font-bold",
                            verdictTextClass(verdict),
                          )}
                        >
                          {verdictLabel(verdict, t)} · {row.score}
                        </span>
                      </Link>
                    );
                  })
                )}
              </div>
              <Link
                href={filterHref("hafta")}
                className="-my-2 inline-flex min-h-10 items-center py-2 text-[11.5px] font-semibold text-primary hover:text-primary-hover sm:-my-1 sm:min-h-0 sm:py-1"
              >
                {t.analysis.showAll}
              </Link>
            </Panel>

            <Panel className="flex min-w-0 flex-col gap-3 p-[18px] sm:p-5">
              <h2 className="text-[13px] font-bold text-strong">
                {t.analysis.upcomingEarnings}
              </h2>
              <div className="flex flex-1 flex-col justify-between">
                {upcomingTop.length === 0 ? (
                  <p className="text-xs text-muted">{t.earnings.empty}</p>
                ) : (
                  upcomingTop.map((row) => (
                    /* Satır kutu, içindeki mutlak bağlantı yüzeyi kaplıyor —
                       takvim düğmesi kendi bağlantısını taşıdığı için iç içe
                       <a> olamaz. */
                    <div
                      key={row.id}
                      className="relative flex items-center gap-2.5 border-b border-line-soft py-[7px] last:border-b-0 hover:opacity-75"
                    >
                      <Link
                        href={`/hisse/${row.symbol}`}
                        prefetch={false}
                        aria-label={row.symbol}
                        className="absolute inset-0"
                      />
                      <PanelLogo
                        logoUrl={upcomingMeta[row.symbol]?.logoUrl ?? null}
                        symbol={row.symbol}
                      />
                      <span className="w-[46px] shrink-0 text-[12.5px] font-bold text-strong">
                        {row.symbol}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[11.5px] text-body">
                        {formatEtDateCompact(row.reportDate, locale)}
                        {row.hour === "bmo"
                          ? ` · ${t.earnings.beforeOpenShort}`
                          : row.hour === "amc"
                            ? ` · ${t.earnings.afterCloseShort}`
                            : ""}
                      </span>
                      {watchSet.has(row.symbol) ? (
                        <span className="shrink-0 rounded-full bg-primary-wash px-2 py-[2px] text-[10.5px] font-bold text-primary">
                          ★
                        </span>
                      ) : (
                        <span className="figure shrink-0 text-[10.5px] text-muted">
                          {row.epsEstimate !== null
                            ? formatPrice(row.epsEstimate, locale, {
                                currency: true,
                              })
                            : "—"}
                        </span>
                      )}
                      <AddToCalendar
                        symbol={row.symbol}
                        date={row.reportDate}
                        label={t.earnings.addToCalendar}
                        compact
                        className="-mr-1"
                      />
                    </div>
                  ))
                )}
              </div>
              <Link
                href="/bilancolar"
                className="-my-2 inline-flex min-h-10 items-center py-2 text-[11.5px] font-semibold text-primary hover:text-primary-hover sm:-my-1 sm:min-h-0 sm:py-1"
              >
                {t.analysis.goToCalendar}
              </Link>
            </Panel>
          </div>

          {/* Bütün denetimler tablonun üstünde tek bir yerde: filtre çipleri
              sayfa başlığının içinde duruyordu ve on bir çip başlığı ikinci
              satıra itiyordu. Üçü de aynı listeyi daraltıyor, bir arada
              durmaları gerekiyordu. */}
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
              <h2 className="display-ink display-ink-tight w-fit text-base font-bold">
                {t.analysis.listTitle}
              </h2>
              {/* Dar ekranda çipler kırılmak yerine kayar. */}
              <div className="no-scrollbar -mx-4 flex max-w-full gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
                <FilterChip href={filterHref(null)} active={!filter}>
                  {t.analysis.filterAll}
                </FilterChip>
                <FilterChip href={filterHref("hafta")} active={filter === "hafta"}>
                  {t.analysis.filterThisWeek}
                </FilterChip>
                {session?.user && (
                  <FilterChip
                    href={filterHref("takip")}
                    active={filter === "takip"}
                  >
                    {t.analysis.filterWatchlist}
                  </FilterChip>
                )}
                {[...groups.values()].map((group) => (
                  <FilterChip
                    key={group.key}
                    href={filterHref(group.key)}
                    active={filter === group.key}
                  >
                    {sectorGroupLabel(group, locale)}
                  </FilterChip>
                ))}
              </div>
            </div>

            {rows.length === 0 ? (
              <Panel>
                <EmptyState
                  title={t.analysis.emptyFilter}
                  action={
                    <Link
                      href={filterHref(null)}
                      className="text-[12.5px] font-semibold text-primary"
                    >
                      {t.earnings.clearFilter}
                    </Link>
                  }
                />
              </Panel>
            ) : (
              <AnalysisTable
                rows={tableRows}
                labels={analysisTableLabels(t)}
                highlightFirst={!filter && sort === "tarih"}
                toolbar={
                  <Segment>
                    <SegmentItem href={sortHref("tarih")} active={sort === "tarih"}>
                      {t.analysis.sortDate}
                    </SegmentItem>
                    <SegmentItem href={sortHref("skor")} active={sort === "skor"}>
                      {t.analysis.sortScore}
                    </SegmentItem>
                    <SegmentItem href={sortHref("tepki")} active={sort === "tepki"}>
                      {t.analysis.sortReaction}
                    </SegmentItem>
                  </Segment>
                }
              />
            )}
          </div>
        </>
      )}

      <p className="border-t border-line pt-3.5 text-[11px] text-muted">
        {t.analysis.publishNote}
      </p>

      <GuideHint
        label={t.guide.contextLabel}
        locale={locale}
        slugs={["bilanco", "degerleme"]}
      />
    </div>
  );
}

/**
 * Panel satırındaki küçük logo — tabloyla aynı dil.
 *
 * Yan paneller yalnızca sembol + tarih listesiydi ve altındaki logolu
 * tablonun yanında sönük kalıyordu. Logo yoksa sembolün ilk iki harfi
 * aynı kutuya oturuyor; satırın hizası kaymıyor.
 */
function PanelLogo({
  logoUrl,
  symbol,
}: {
  logoUrl: string | null;
  symbol: string;
}) {
  if (logoUrl) {
    return (
      <Image
        src={logoUrl}
        alt=""
        width={22}
        height={22}
        className="size-[22px] shrink-0 rounded-[6px] bg-white object-contain"
      />
    );
  }
  return (
    <span
      aria-hidden
      className="flex size-[22px] shrink-0 items-center justify-center rounded-[6px] bg-primary-wash text-[9px] font-bold text-primary"
    >
      {symbol.slice(0, 2)}
    </span>
  );
}

/**
 * Günün Analizi — üst sıranın geniş kartı.
 *
 * Üç mini ölçü tek satırda: gelir büyümesi, beklentiye göre HBK ve hisse
 * tepkisi. Üçü birlikte "iyi çeyrek ama hisse düştü" gibi kartın tek
 * cümlesinin anlattığı gerilimi sayıyla gösteriyor.
 */
function FeaturedAnalysis({
  row,
  logoUrl,
  locale,
  t,
}: {
  row: AnalysisIndexRow;
  logoUrl: string | null;
  locale: Locale;
  t: Dictionary;
}) {
  const verdict = verdictOf(row.verdict);
  const figures: { label: string; tone: "up" | "down" | "flat" }[] = [];

  if (row.revenueYoyPct !== null) {
    const up = row.revenueYoyPct >= 0;
    figures.push({
      label: `${up ? "▲" : "▼"} ${t.earnings.revenueShort} ${formatPercentPlain(row.revenueYoyPct, locale, 0)}`,
      tone: up ? "up" : "down",
    });
  }
  if (row.epsSurprisePct !== null) {
    const up = row.epsSurprisePct >= 0;
    figures.push({
      label: `EPS ${formatPercent(row.epsSurprisePct, locale, 0)}`,
      tone: up ? "up" : "down",
    });
  }
  if (row.reactionPct !== null) {
    const up = row.reactionPct >= 0;
    figures.push({
      label: `${up ? "▲" : "▼"} ${formatPercentPlain(row.reactionPct, locale, 1)}`,
      tone: up ? "up" : "down",
    });
  }

  return (
    <Link
      href={analysisHref(row.symbol, row.period)}
      prefetch={false}
      className="flex min-w-0 flex-col gap-4 rounded-[16px] border border-primary-faint bg-gradient-to-br from-primary-wash to-primary-tint p-5 transition-colors hover:border-primary sm:flex-row sm:gap-5"
    >
      <div className="flex min-w-0 flex-1 flex-col gap-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-primary-faint bg-primary-wash px-2.5 py-[3px] text-[10.5px] font-bold text-primary">
            {t.analysis.todaysAnalysis}
          </span>
          <span className="text-[11px] font-semibold text-muted">
            {formatEtDateLong(row.reportDate, locale)}
          </span>
        </div>
        <div className="flex items-center gap-2.5">
          {logoUrl ? (
            <Image
              src={logoUrl}
              alt=""
              width={40}
              height={40}
              className="size-10 shrink-0 rounded-[10px] bg-white object-contain"
            />
          ) : (
            <SymbolBadge symbol={row.symbol} size="sm" />
          )}
          <div className="min-w-0">
            <p className="truncate text-[17px] font-bold tracking-[-0.03em] text-strong">
              {row.company} · {row.periodLabel}
            </p>
            <p className="truncate text-[11.5px] font-medium text-muted">
              {row.symbol}
              {row.sector ? ` · ${row.sector}` : ""}
            </p>
          </div>
        </div>
        <p className="text-[12.5px] leading-[19px] text-body [text-wrap:pretty]">
          {row.headline}
        </p>
        <div className="mt-auto flex flex-wrap gap-x-3.5 gap-y-1 pt-1">
          {figures.map((figure) => (
            <span
              key={figure.label}
              className={cn(
                "figure text-xs font-bold",
                figure.tone === "up" ? "text-up" : "text-down",
              )}
            >
              {figure.label}
            </span>
          ))}
        </div>
      </div>
      {/* Dar ekranda halka metnin YANINA değil ALTINA geçer ve karar
          yazısıyla yan yana durur: 66px'lik halka + kenar dolgusu 390px
          genişlikte metin sütununu sıfıra indiriyordu. */}
      <div className="flex shrink-0 items-center gap-3 border-t border-primary-faint pt-3 sm:flex-col sm:justify-center sm:gap-2 sm:border-0 sm:pt-0">
        <ScoreRing score={row.score} verdict={verdict} size={66} />
        <span className={cn("text-base font-bold", verdictTextClass(verdict))}>
          {verdictLabel(verdict, t)}
        </span>
      </div>
    </Link>
  );
}
