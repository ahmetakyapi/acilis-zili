import { Suspense } from "react";
import Image from "next/image";
import { Star } from "lucide-react";
import { and, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { toggleSymbolFavorite } from "@/app/actions/watchlist";
import { PriceChart } from "@/components/stock/PriceChart";
import {
  ChangePill,
  DataError,
  DataStamp,
  EmptyState,
  Panel,
  PanelHeader,
  Skeleton,
} from "@/components/ui/primitives";
import { db } from "@/lib/db";
import { watchlistItems, watchlists } from "@/lib/schema";
import { getEarningsForSymbol, getNextEarnings, getStatus } from "@/lib/data";
import { getI18n, type Dictionary, type Locale } from "@/lib/i18n";
import { getCompanyProfile, getQuote } from "@/lib/providers";
import {
  getCompanyNews,
  getKeyMetrics,
  getRecommendations,
} from "@/lib/providers/finnhub";
import { addEtDays, todayEt } from "@/lib/market-hours";
import {
  cn,
  directionOf,
  formatChange,
  formatCompact,
  formatEtDateLong,
  formatPrice,
  formatVolume,
  isValidSymbol,
  timeAgo,
} from "@/lib/utils";

export default async function StockPage(
  props: PageProps<"/hisse/[symbol]">,
) {
  const { symbol: raw } = await props.params;
  const symbol = decodeURIComponent(raw).toUpperCase();
  const { locale, t } = await getI18n();

  if (!isValidSymbol(symbol)) {
    return (
      <EmptyState title={t.stock.notFound} hint={t.stock.notFoundHint} />
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <Suspense fallback={<HeaderSkeleton />}>
        <StockHeader symbol={symbol} locale={locale} t={t} />
      </Suspense>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="flex flex-col gap-5 lg:col-span-2">
          <Panel className="p-4 sm:p-5">
            <Suspense fallback={<Skeleton className="h-80 w-full" />}>
              <ChartSection symbol={symbol} locale={locale} t={t} />
            </Suspense>
          </Panel>

          <Panel>
            <PanelHeader title={t.stock.companyNews} />
            <Suspense fallback={<ListSkeleton rows={4} />}>
              <CompanyNews symbol={symbol} locale={locale} t={t} />
            </Suspense>
          </Panel>
        </div>

        <div className="flex flex-col gap-5">
          <Panel>
            <PanelHeader title={t.stock.profile} />
            <Suspense fallback={<ListSkeleton rows={5} />}>
              <ProfileCard symbol={symbol} locale={locale} t={t} />
            </Suspense>
          </Panel>

          <Panel>
            <PanelHeader title={t.stock.metrics} />
            <Suspense fallback={<ListSkeleton rows={5} />}>
              <MetricsCard symbol={symbol} locale={locale} t={t} />
            </Suspense>
          </Panel>

          <Panel>
            <PanelHeader title={t.stock.analysts} />
            <Suspense fallback={<ListSkeleton rows={3} />}>
              <AnalystCard symbol={symbol} t={t} />
            </Suspense>
          </Panel>

          <Panel>
            <PanelHeader title={t.stock.pastEarnings} />
            <Suspense fallback={<ListSkeleton rows={3} />}>
              <PastEarnings symbol={symbol} locale={locale} t={t} />
            </Suspense>
          </Panel>
        </div>
      </div>
    </div>
  );
}

/* ==========================================================================
   Başlık: fiyat + favori yıldızı
   ========================================================================== */

async function StockHeader({
  symbol,
  locale,
  t,
}: {
  symbol: string;
  locale: Locale;
  t: Dictionary;
}) {
  const status = await getStatus();
  const [quoteResult, profileResult, session] = await Promise.all([
    getQuote(symbol, status),
    getCompanyProfile(symbol),
    auth(),
  ]);

  const profile = profileResult.ok ? profileResult.data : null;

  let isFavorite = false;
  if (session?.user?.id) {
    try {
      const rows = await db
        .select({ id: watchlistItems.id })
        .from(watchlistItems)
        .innerJoin(watchlists, eq(watchlistItems.watchlistId, watchlists.id))
        .where(
          and(
            eq(watchlists.userId, session.user.id),
            eq(watchlistItems.symbol, symbol),
          ),
        )
        .limit(1);
      isFavorite = rows.length > 0;
    } catch {
      // veri yoksa yıldız pasif kalır
    }
  }

  return (
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex items-center gap-3">
        {profile?.logoUrl && (
          <Image
            src={profile.logoUrl}
            alt=""
            width={44}
            height={44}
            className="rounded-(--radius-md) border border-line bg-white object-contain p-1"
          />
        )}
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="numeral text-2xl font-bold tracking-tight text-strong">
              {symbol}
            </h1>
            {session?.user && (
              <form action={toggleSymbolFavorite}>
                <input type="hidden" name="symbol" value={symbol} />
                <button
                  type="submit"
                  aria-label={
                    isFavorite ? t.stock.removeFromWatchlist : t.stock.addToWatchlist
                  }
                  title={
                    isFavorite ? t.stock.removeFromWatchlist : t.stock.addToWatchlist
                  }
                  className={cn(
                    "inline-flex size-8 items-center justify-center rounded-(--radius-sm) transition-colors",
                    isFavorite
                      ? "text-brass hover:bg-brass-wash"
                      : "text-muted hover:bg-surface-elevated hover:text-soft",
                  )}
                >
                  <Star size={17} fill={isFavorite ? "currentColor" : "none"} />
                </button>
              </form>
            )}
          </div>
          <p className="text-sm text-soft">{profile?.name ?? ""}</p>
        </div>
      </div>

      {quoteResult.ok ? (
        <div className="text-right">
          <p className="tote text-3xl">
            {formatPrice(quoteResult.data.price, locale, { currency: true })}
          </p>
          <div className="mt-1 flex items-center justify-end gap-2">
            <span
              className={cn(
                "numeral text-sm",
                directionOf(quoteResult.data.change) === "up"
                  ? "text-up"
                  : directionOf(quoteResult.data.change) === "down"
                    ? "text-down"
                    : "text-muted",
              )}
            >
              {formatChange(quoteResult.data.change, locale)}
            </span>
            <ChangePill changePct={quoteResult.data.changePct} locale={locale} />
          </div>
          <DataStamp
            source={quoteResult.source}
            at={quoteResult.fetchedAt}
            stale={quoteResult.stale}
            locale={locale}
            className="mt-1.5 justify-end"
          />
        </div>
      ) : (
        <div className="text-right">
          <p className="text-sm text-muted">{t.data.failed}</p>
        </div>
      )}
    </header>
  );
}

function HeaderSkeleton() {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex items-center gap-3">
        <Skeleton className="size-11 rounded-(--radius-md)" />
        <div className="flex flex-col gap-2">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-4 w-40" />
        </div>
      </div>
      <div className="flex flex-col items-end gap-2">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-5 w-24" />
      </div>
    </div>
  );
}

/* ==========================================================================
   Grafik — yön rengi günün değişiminden gelir
   ========================================================================== */

function ChartSection({
  symbol,
  locale,
  t,
}: {
  symbol: string;
  locale: Locale;
  t: Dictionary;
}) {
  return (
    <PriceChart
      symbol={symbol}
      locale={locale}
      labels={{
        ranges: t.chart.ranges,
        rangeLabels: t.chart.rangeLabels,
        area: t.chart.area,
        candles: t.chart.candles,
        periodReturn: t.chart.periodReturn,
        periodHigh: t.chart.periodHigh,
        periodLow: t.chart.periodLow,
        noData: t.chart.noChartData,
        failed: t.data.failed,
      }}
    />
  );
}

/* ==========================================================================
   Profil / metrikler / analistler / bilançolar / haberler
   ========================================================================== */

async function ProfileCard({
  symbol,
  locale,
  t,
}: {
  symbol: string;
  locale: Locale;
  t: Dictionary;
}) {
  const [result, nextEarnings] = await Promise.all([
    getCompanyProfile(symbol),
    getNextEarnings(symbol),
  ]);
  if (!result.ok) {
    return <DataError message={t.data.failed} hint={t.data.failedHint} />;
  }
  const profile = result.data;

  const earningsHourLabel: Record<string, string> = {
    bmo: t.earnings.beforeOpen,
    amc: t.earnings.afterClose,
    dmh: t.earnings.duringMarket,
  };

  const rows: [string, React.ReactNode][] = [
    [t.stock.sector, profile.industry ?? "—"],
    [t.stock.exchange, profile.exchange ?? "—"],
    [
      t.market.marketCap,
      profile.marketCap ? (
        <span className="numeral">${formatCompact(profile.marketCap, locale)}</span>
      ) : (
        "—"
      ),
    ],
    [
      t.stock.ipoDate,
      profile.ipoDate ? <span className="numeral">{profile.ipoDate}</span> : "—",
    ],
  ];

  if (nextEarnings) {
    rows.unshift([
      t.stock.nextEarnings,
      <span key="next" className="text-right">
        <span className="numeral block font-semibold text-brass">
          {formatEtDateLong(nextEarnings.reportDate, locale)}
        </span>
        <span className="block text-[11px] text-muted">
          {nextEarnings.hour
            ? (earningsHourLabel[nextEarnings.hour] ?? t.earnings.timeUnknown)
            : t.earnings.timeUnknown}
          {nextEarnings.epsEstimate !== null &&
            ` · EPS ${formatPrice(nextEarnings.epsEstimate, locale)}`}
        </span>
      </span>,
    ]);
  }

  return (
    <div className="px-4 py-3 sm:px-5">
      <dl className="divide-y divide-line-soft">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between gap-3 py-2">
            <dt className="text-xs text-muted">{label}</dt>
            <dd className="text-right text-sm text-body">{value}</dd>
          </div>
        ))}
        {profile.weburl && (
          <div className="flex items-center justify-between gap-3 py-2">
            <dt className="text-xs text-muted">{t.stock.website}</dt>
            <dd className="min-w-0 text-right text-sm">
              <a
                href={profile.weburl}
                target="_blank"
                rel="noopener noreferrer"
                className="block truncate text-primary hover:underline"
              >
                {profile.weburl.replace(/^https?:\/\/(www\.)?/, "")}
              </a>
            </dd>
          </div>
        )}
      </dl>
      <DataStamp
        source={result.source}
        at={result.fetchedAt}
        stale={result.stale}
        locale={locale}
        className="mt-2"
      />
    </div>
  );
}

async function MetricsCard({
  symbol,
  locale,
  t,
}: {
  symbol: string;
  locale: Locale;
  t: Dictionary;
}) {
  const status = await getStatus();
  const [metricsResult, quoteResult] = await Promise.all([
    getKeyMetrics(symbol),
    getQuote(symbol, status),
  ]);

  if (!metricsResult.ok) {
    return <DataError message={t.data.failed} />;
  }
  const m = metricsResult.data;
  const quote = quoteResult.ok ? quoteResult.data : null;

  const rows: [string, string][] = [
    [t.stock.peRatio, m.peRatio ? formatPrice(m.peRatio, locale) : "—"],
    [t.stock.eps, m.eps ? formatPrice(m.eps, locale, { currency: true }) : "—"],
    [
      t.stock.dividend,
      m.dividendYield ? `${formatPrice(m.dividendYield, locale)}%` : "—",
    ],
    [t.stock.beta, m.beta ? formatPrice(m.beta, locale) : "—"],
    [
      t.stock.high52,
      m.high52 ? formatPrice(m.high52, locale, { currency: true }) : "—",
    ],
    [
      t.stock.low52,
      m.low52 ? formatPrice(m.low52, locale, { currency: true }) : "—",
    ],
    [t.market.volume, quote?.volume ? formatVolume(quote.volume, locale) : "—"],
  ];

  return (
    <div className="px-4 py-3 sm:px-5">
      <dl className="divide-y divide-line-soft">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between gap-3 py-2">
            <dt className="text-xs text-muted">{label}</dt>
            <dd className="numeral text-sm text-body">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

async function AnalystCard({ symbol, t }: { symbol: string; t: Dictionary }) {
  const result = await getRecommendations(symbol);
  if (!result.ok) {
    return <DataError message={t.common.noData} />;
  }

  const latest = result.data[0];
  const total =
    latest.strongBuy + latest.buy + latest.hold + latest.sell + latest.strongSell;
  if (total === 0) return <DataError message={t.common.noData} />;

  const segments = [
    { label: t.stock.strongBuy, value: latest.strongBuy, cls: "bg-up" },
    { label: t.stock.buy, value: latest.buy, cls: "bg-up/60" },
    { label: t.stock.hold, value: latest.hold, cls: "bg-flat" },
    { label: t.stock.sell, value: latest.sell, cls: "bg-down/60" },
    { label: t.stock.strongSell, value: latest.strongSell, cls: "bg-down" },
  ];

  return (
    <div className="px-4 py-4 sm:px-5">
      <div className="flex h-2.5 w-full gap-px overflow-hidden rounded-full">
        {segments.map(
          (segment) =>
            segment.value > 0 && (
              <span
                key={segment.label}
                className={segment.cls}
                style={{ width: `${(segment.value / total) * 100}%` }}
                title={`${segment.label}: ${segment.value}`}
              />
            ),
        )}
      </div>
      <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5">
        {segments.map((segment) => (
          <li
            key={segment.label}
            className="flex items-center justify-between gap-2 text-xs"
          >
            <span className="flex items-center gap-1.5 text-muted">
              <span aria-hidden className={cn("size-2 rounded-full", segment.cls)} />
              {segment.label}
            </span>
            <span className="numeral text-body">{segment.value}</span>
          </li>
        ))}
      </ul>
      <p className="numeral mt-2 text-[10px] text-muted">{latest.period}</p>
    </div>
  );
}

async function PastEarnings({
  symbol,
  locale,
  t,
}: {
  symbol: string;
  locale: Locale;
  t: Dictionary;
}) {
  const rows = await getEarningsForSymbol(symbol, 6);
  if (rows.length === 0) {
    return <EmptyState title={t.common.noData} />;
  }

  return (
    <ul className="divide-y divide-line-soft">
      {rows.map((row) => {
        const surprise =
          row.epsActual !== null && row.epsEstimate !== null && row.epsEstimate !== 0
            ? ((row.epsActual - row.epsEstimate) / Math.abs(row.epsEstimate)) * 100
            : null;
        return (
          <li
            key={row.id}
            className="flex items-center justify-between gap-3 px-4 py-2.5 sm:px-5"
          >
            <span className="numeral text-xs text-soft">
              {row.year && row.quarter ? `${row.year} Q${row.quarter}` : row.reportDate}
            </span>
            <span className="flex items-center gap-3 text-xs">
              <span className="numeral text-muted">
                {row.epsEstimate !== null ? formatPrice(row.epsEstimate, locale) : "—"}
              </span>
              <span className="numeral font-semibold text-strong">
                {row.epsActual !== null ? formatPrice(row.epsActual, locale) : "—"}
              </span>
              {surprise !== null && (
                <ChangePill changePct={surprise} locale={locale} size="sm" />
              )}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

async function CompanyNews({
  symbol,
  locale,
  t,
}: {
  symbol: string;
  locale: Locale;
  t: Dictionary;
}) {
  const to = todayEt();
  const from = addEtDays(to, -14);
  const result = await getCompanyNews(symbol, from, to);

  if (!result.ok || result.data.length === 0) {
    return <EmptyState title={t.news.empty} />;
  }

  return (
    <ul className="divide-y divide-line-soft">
      {result.data.slice(0, 8).map((item) => (
        <li key={item.providerId}>
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block px-4 py-3 transition-colors hover:bg-surface-elevated sm:px-5"
          >
            <p className="line-clamp-2 text-sm font-medium leading-snug text-strong">
              {item.headline}
            </p>
            <p className="mt-1 flex items-center gap-1.5 text-[11px] text-muted">
              {item.source && <span>{item.source}</span>}
              <span aria-hidden>·</span>
              <span>{timeAgo(item.publishedAt, locale)}</span>
            </p>
          </a>
        </li>
      ))}
    </ul>
  );
}

function ListSkeleton({ rows }: { rows: number }) {
  return (
    <div className="flex flex-col gap-2 px-4 py-3 sm:px-5">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-8 w-full" />
      ))}
    </div>
  );
}
