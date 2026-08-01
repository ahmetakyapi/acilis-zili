import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { Star } from "lucide-react";
import { and, eq, inArray } from "drizzle-orm";
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
import { news, watchlistItems, watchlists } from "@/lib/schema";
import {
  getEarningsForSymbol,
  getNextEarnings,
  getStatus,
  getSymbolNames,
} from "@/lib/data";
import { getI18n, type Dictionary, type Locale } from "@/lib/i18n";
import { getCompanyProfile, getQuote, getQuotes } from "@/lib/providers";
import { COMPLIANCE_THRESHOLD, screenCompliance } from "@/lib/compliance";
import { indexMemberOf, peersOf } from "@/db/seed/indices";
import { subIndustryName } from "@/db/seed/sub-industries";
import {
  getCompanyNews,
  getEarningsCalendar,
  getEarningsSurprises,
  getKeyMetrics,
  getRecommendations,
} from "@/lib/providers/finnhub";
import { addEtDays, todayEt } from "@/lib/market-hours";
import { describeSymbol } from "@/db/seed/descriptions";
import {
  cn,
  directionOf,
  formatChange,
  formatCompact,
  formatEtDateLong,
  formatEtDateShort,
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
        <div className="flex min-w-0 flex-col gap-5 lg:col-span-2">
          <Panel className="p-4 sm:p-5">
            <Suspense fallback={<Skeleton className="h-80 w-full" />}>
              <ChartSection symbol={symbol} locale={locale} t={t} />
            </Suspense>
          </Panel>

          <Panel>
            <PanelHeader title={t.stock.pastEarnings} />
            <Suspense fallback={<ListSkeleton rows={4} />}>
              <PastEarnings symbol={symbol} locale={locale} t={t} />
            </Suspense>
          </Panel>
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          <Panel>
            <PanelHeader title={t.stock.profile} />
            <Suspense fallback={<ListSkeleton rows={5} />}>
              <ProfileCard symbol={symbol} locale={locale} t={t} />
            </Suspense>
          </Panel>

          <Suspense fallback={<Skeleton className="h-24 w-full rounded-(--radius-xl)" />}>
            <UpcomingEarnings symbol={symbol} locale={locale} t={t} />
          </Suspense>

          <Panel>
            <PanelHeader title={t.stock.metrics} />
            <Suspense fallback={<ListSkeleton rows={5} />}>
              <MetricsCard symbol={symbol} locale={locale} t={t} />
            </Suspense>
          </Panel>

          <Panel>
            <PanelHeader title={t.stock.analysts} />
            <Suspense fallback={<ListSkeleton rows={3} />}>
              <AnalystCard symbol={symbol} locale={locale} t={t} />
            </Suspense>
          </Panel>

          <Suspense fallback={<Skeleton className="h-40 w-full rounded-(--radius-xl)" />}>
            <ComplianceCard symbol={symbol} locale={locale} t={t} />
          </Suspense>

          <Suspense fallback={<Skeleton className="h-56 w-full rounded-(--radius-xl)" />}>
            <PeersCard symbol={symbol} locale={locale} t={t} />
          </Suspense>
        </div>
      </div>

      {/* Haberler en altta — mobilde de masaüstünde de son durak */}
      <Panel>
        <PanelHeader title={t.stock.companyNews} />
        <Suspense fallback={<ListSkeleton rows={4} />}>
          <CompanyNews symbol={symbol} locale={locale} t={t} />
        </Suspense>
      </Panel>
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
            width={56}
            height={56}
            className="rounded-(--radius-lg) border border-line bg-white object-contain p-1.5 shadow-(--shadow-card)"
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
        sessionPre: t.chart.sessionPre,
        sessionRegular: t.chart.sessionRegular,
        sessionAfter: t.chart.sessionAfter,
        sessionOvernight: t.chart.sessionOvernight,
        sessionOvernightNote: t.chart.sessionOvernightNote,
      }}
    />
  );
}

/* ==========================================================================
   Profil / metrikler / analistler / bilançolar / haberler
   ========================================================================== */

/** Bilanço kayıtlarının ortak biçimi — DB satırı da sağlayıcı girdisi de buna iner. */
type EarningsItem = {
  reportDate: string;
  hour: string | null;
  epsEstimate: number | null;
  epsActual: number | null;
  revenueEstimate: number | null;
  revenueActual: number | null;
  quarter: number | null;
  year: number | null;
  /** Çeyreğin bittiği tarih — dönem etiketi bunu kullanır (varsa). */
  periodEnd?: string;
};

/**
 * Sembolün bilanço geçmişi + geleceği. Yerel takvim tablosu yalnızca yakın
 * aralığı tutar; kapsam dışı kalan sembollerde Finnhub'ın sembol bazlı
 * takvimi devreye girer (geçmiş ~13 ay, gelecek ~4 ay — 6 saat önbellekli).
 */
async function symbolEarnings(symbol: string): Promise<EarningsItem[]> {
  const today = todayEt();
  const result = await getEarningsCalendar(
    addEtDays(today, -400),
    addEtDays(today, 120),
    symbol,
  );
  return result.ok ? result.data : [];
}

/**
 * Yaklaşan bilanço — sağ kolonun tepesinde pirinç vurgulu kart.
 * Tarih, seans zamanı ve analistlerin EPS + gelir beklentisi bir arada.
 */
async function UpcomingEarnings({
  symbol,
  locale,
  t,
}: {
  symbol: string;
  locale: Locale;
  t: Dictionary;
}) {
  let next: EarningsItem | null = await getNextEarnings(symbol);
  if (!next) {
    const today = todayEt();
    next =
      (await symbolEarnings(symbol))
        .filter((row) => row.reportDate >= today)
        .sort((a, b) => a.reportDate.localeCompare(b.reportDate))[0] ?? null;
  }
  if (!next) return null;

  const earningsHourLabel: Record<string, string> = {
    bmo: t.earnings.beforeOpen,
    amc: t.earnings.afterClose,
    dmh: t.earnings.duringMarket,
  };

  return (
    <Panel className="border-l-2 border-l-brass p-4 sm:p-5">
      <p className="plate text-[9px]">{t.stock.nextEarnings}</p>
      <p className="numeral mt-1.5 text-lg font-bold text-strong">
        {formatEtDateLong(next.reportDate, locale)}
      </p>
      <p className="mt-0.5 text-xs text-soft">
        {next.hour
          ? (earningsHourLabel[next.hour] ?? t.earnings.timeUnknown)
          : t.earnings.timeUnknown}
      </p>
      {(next.epsEstimate !== null || next.revenueEstimate !== null) && (
        <dl className="mt-3 grid grid-cols-2 gap-3 border-t border-line-soft pt-3">
          {next.epsEstimate !== null && (
            <div>
              <dt className="text-[10px] uppercase tracking-wider text-muted">
                {t.earnings.epsEstimate}
              </dt>
              <dd className="numeral mt-0.5 text-sm font-semibold text-strong">
                {formatPrice(next.epsEstimate, locale, { currency: true })}
              </dd>
            </div>
          )}
          {next.revenueEstimate !== null && (
            <div>
              <dt className="text-[10px] uppercase tracking-wider text-muted">
                {t.earnings.revenueEstimate}
              </dt>
              <dd className="numeral mt-0.5 text-sm font-semibold text-strong">
                ${formatCompact(next.revenueEstimate, locale)}
              </dd>
            </div>
          )}
        </dl>
      )}
    </Panel>
  );
}

async function ProfileCard({
  symbol,
  locale,
  t,
}: {
  symbol: string;
  locale: Locale;
  t: Dictionary;
}) {
  const result = await getCompanyProfile(symbol);
  if (!result.ok) {
    return <DataError message={t.data.failed} hint={t.data.failedHint} />;
  }
  const profile = result.data;
  const member = indexMemberOf(symbol);
  const about = await describeSymbol(symbol, locale);

  const rows: [string, React.ReactNode][] = [
    // GICS sınıflandırması varsa o gösterilir — sağlayıcının serbest metinli
    // sektör alanından daha tutarlıdır.
    [t.stock.sector, member?.sector ?? profile.industry ?? "—"],
    ...(member?.sub
      ? ([[t.stock.industry, subIndustryName(member.sub, locale)]] as [
          string,
          React.ReactNode,
        ][])
      : []),
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
      profile.ipoDate ? (
        <span className="numeral">
          {formatEtDateShort(profile.ipoDate, locale)}
        </span>
      ) : (
        "—"
      ),
    ],
  ];

  return (
    <div className="px-4 py-3 sm:px-5">
      {/* Şirket ne iş yapar — sektör satırından önce düz cümleyle anlatılır */}
      {about && (
        <p className="border-b border-line-soft pb-3 text-[13px] leading-relaxed text-body">
          {about}
        </p>
      )}
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

async function AnalystCard({
  symbol,
  locale,
  t,
}: {
  symbol: string;
  locale: Locale;
  t: Dictionary;
}) {
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
      <p className="numeral mt-2 text-[10px] text-muted">
        {new Intl.DateTimeFormat(locale === "tr" ? "tr-TR" : "en-US", {
          month: "long",
          year: "numeric",
          timeZone: "UTC",
        }).format(new Date(`${latest.period}T12:00:00Z`))}
      </p>
    </div>
  );
}

/**
 * Geçmiş bilançolar — dönem başına EPS beklentisi/gerçekleşeni ve sapma;
 * gelir verisi varsa ikinci satırda okunur. Açıklanmamış (gelecek) kayıtlar
 * bu listede yer almaz, onlar Yaklaşan Bilanço kartındadır.
 */
async function PastEarnings({
  symbol,
  locale,
  t,
}: {
  symbol: string;
  locale: Locale;
  t: Dictionary;
}) {
  const today = todayEt();

  // Takvim satırları (yerel tablo, yoksa sağlayıcı) — gelir alanlarını taşır.
  let calRows: EarningsItem[] = (await getEarningsForSymbol(symbol, 12)).filter(
    (row) => row.reportDate < today || row.epsActual !== null,
  );
  if (calRows.length === 0) {
    calRows = (await symbolEarnings(symbol)).filter(
      (row) => row.reportDate < today || row.epsActual !== null,
    );
  }

  /* Kanonik EPS kaynağı earnings surprises'tır: çeyrek başına TEK kayıt ve
     rapor günündeki nihai beklentiyi taşır. Takvim beslemesi aynı çeyrek için
     revizyon kopyaları düşürebiliyor (AAPL'da iki farklı beklenti görüldü) —
     bu yüzden takvim yalnızca gelir/rapor-tarihi zenginleştirmesi yapar. */
  let rows: EarningsItem[];
  const surprises = await getEarningsSurprises(symbol);
  if (surprises.ok) {
    rows = surprises.data.map((s) => {
      const periodMs = new Date(`${s.period}T12:00:00Z`).getTime();
      // Rapor, çeyrek bitiminden ~2-10 hafta sonra gelir; o penceredeki takvim
      // kaydı bu çeyreğe aittir.
      const cal = calRows.find((row) => {
        const diffDays =
          (new Date(`${row.reportDate}T12:00:00Z`).getTime() - periodMs) /
          86400000;
        return diffDays > 0 && diffDays <= 100;
      });
      return {
        reportDate: cal?.reportDate ?? s.period,
        hour: cal?.hour ?? null,
        epsEstimate: s.epsEstimate,
        epsActual: s.epsActual,
        revenueEstimate: cal?.revenueEstimate ?? null,
        revenueActual: cal?.revenueActual ?? null,
        quarter: s.quarter,
        year: s.year,
        periodEnd: s.period,
      };
    });
  } else {
    // Surprises yoksa takvimden devam: aynı güne düşen kopyaları tekille.
    const byDate = new Map<string, EarningsItem>();
    for (const row of calRows) {
      const current = byDate.get(row.reportDate);
      if (!current || (row.epsActual !== null && current.epsActual === null)) {
        byDate.set(row.reportDate, row);
      }
    }
    rows = [...byDate.values()];
  }
  rows.sort((a, b) => b.reportDate.localeCompare(a.reportDate));

  if (rows.length === 0) {
    return <EmptyState title={t.common.noData} />;
  }

  // Dönem etiketi çeyreğin bittiği ayı söyler — mali yıl etiketleri (ör.
  // NVDA'nın FY2027'si) okuyucuyu yanıltır, ay+yıl yanıltmaz.
  const periodLabel = new Intl.DateTimeFormat(
    locale === "tr" ? "tr-TR" : "en-US",
    { month: "short", year: "numeric", timeZone: "UTC" },
  );

  const hasRevenue = rows.some(
    (row) => row.revenueActual !== null || row.revenueEstimate !== null,
  );

  return (
    <div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line-soft text-left text-[10px] uppercase tracking-wider text-muted">
            <th className="px-4 py-2.5 font-medium sm:px-5">
              {t.earnings.period}
            </th>
            <th className="px-2 py-2.5 text-right font-medium sm:px-3">
              EPS · {t.calendar.forecast}
            </th>
            <th className="px-2 py-2.5 text-right font-medium sm:px-3">
              EPS · {t.calendar.actual}
            </th>
            <th className="px-2 py-2.5 text-right font-medium sm:px-3">
              {t.earnings.surprise}
            </th>
            {hasRevenue && (
              // Dar ekranda gelir kolonu gizlenir — tablo yatay kaydırmadan sığar
              <th className="hidden px-4 py-2.5 text-right font-medium sm:table-cell sm:px-5">
                {t.earnings.revenueShort}
              </th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-line-soft">
          {rows.slice(0, 8).map((row) => {
            const surprise =
              row.epsActual !== null &&
              row.epsEstimate !== null &&
              row.epsEstimate !== 0
                ? ((row.epsActual - row.epsEstimate) /
                    Math.abs(row.epsEstimate)) *
                  100
                : null;
            return (
              <tr key={row.reportDate}>
                <td className="px-4 py-2.5 sm:px-5">
                  <span className="numeral block text-sm font-semibold text-strong">
                    {periodLabel.format(
                      new Date(`${row.periodEnd ?? row.reportDate}T12:00:00Z`),
                    )}
                  </span>
                  <span className="numeral block text-[11px] text-muted">
                    {formatEtDateShort(row.reportDate, locale)}
                  </span>
                </td>
                <td className="numeral px-2 py-2.5 text-right text-muted sm:px-3">
                  {row.epsEstimate !== null
                    ? formatPrice(row.epsEstimate, locale, { currency: true })
                    : "—"}
                </td>
                <td className="numeral px-2 py-2.5 text-right font-semibold text-strong sm:px-3">
                  {row.epsActual !== null
                    ? formatPrice(row.epsActual, locale, { currency: true })
                    : "—"}
                </td>
                <td className="px-2 py-2.5 text-right sm:px-3">
                  {surprise !== null ? (
                    <ChangePill changePct={surprise} locale={locale} size="sm" />
                  ) : (
                    <span className="text-xs text-muted">—</span>
                  )}
                </td>
                {hasRevenue && (
                  <td className="numeral hidden px-4 py-2.5 text-right text-body sm:table-cell sm:px-5">
                    {row.revenueActual !== null ? (
                      <span className="font-semibold">
                        ${formatCompact(row.revenueActual, locale)}
                      </span>
                    ) : row.revenueEstimate !== null ? (
                      <span className="text-muted">
                        ~${formatCompact(row.revenueEstimate, locale)}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Katılım taraması — faaliyet alanı + AAOIFI finansal eşikleri.
 * Sonuç bir fetva değil, ön elemedir; kartın altındaki not bunu söyler.
 */
async function ComplianceCard({
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

  const metrics = metricsResult.ok ? metricsResult.data : null;
  const price = quoteResult.ok ? quoteResult.data.price : null;

  const result = screenCompliance({
    symbol,
    price,
    bookValuePerShare: metrics?.bookValuePerShare ?? null,
    debtToEquity: metrics?.debtToEquity ?? null,
    cashPerShare: metrics?.cashPerShare ?? null,
  });

  const verdictLabel =
    result.verdict === "pass"
      ? t.stock.compliancePass
      : result.verdict === "fail"
        ? t.stock.complianceFail
        : t.stock.complianceReview;

  const verdictClass =
    result.verdict === "pass"
      ? "bg-up-wash text-up"
      : result.verdict === "fail"
        ? "bg-down-wash text-down"
        : "bg-brass-wash text-brass";

  const ratios: [string, number | null][] = [
    [t.stock.complianceDebt, result.debtRatio],
    [t.stock.complianceCash, result.cashRatio],
  ];

  return (
    <Panel>
      <PanelHeader title={t.stock.compliance} />
      <div className="px-4 py-4 sm:px-5">
        <span
          className={cn(
            "inline-flex rounded-full px-3 py-1 text-xs font-semibold",
            verdictClass,
          )}
        >
          {verdictLabel}
        </span>

        {result.businessReasonKey && (
          <p className="mt-2.5 text-xs leading-relaxed text-body">
            {t.stock.complianceReasons[result.businessReasonKey]}
          </p>
        )}

        {result.ratiosKnown ? (
          <dl className="mt-3 flex flex-col gap-2.5">
            {ratios.map(([label, value]) => {
              const over = value !== null && value >= COMPLIANCE_THRESHOLD;
              const width =
                value === null
                  ? 0
                  : Math.min((value / COMPLIANCE_THRESHOLD) * 100, 100);
              return (
                <div key={label}>
                  <div className="flex items-baseline justify-between gap-2">
                    <dt className="text-[11px] leading-tight text-muted">
                      {label}
                    </dt>
                    <dd
                      className={cn(
                        "numeral shrink-0 text-xs font-semibold",
                        over ? "text-down" : "text-strong",
                      )}
                    >
                      {value !== null
                        ? `${formatPrice(value, locale, { digits: 1 })}%`
                        : "—"}
                    </dd>
                  </div>
                  {/* Eşiğe ne kadar yakın — çubuk %33'te dolar */}
                  <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-surface-sunken">
                    <div
                      className={cn("h-full", over ? "bg-down" : "bg-up")}
                      style={{ width: `${width}%` }}
                    />
                  </div>
                </div>
              );
            })}
            <p className="numeral text-[10px] text-muted">
              {t.stock.complianceLimit}: %{COMPLIANCE_THRESHOLD}
            </p>
          </dl>
        ) : (
          <p className="mt-3 text-xs text-muted">{t.stock.complianceUnknown}</p>
        )}

        <p className="mt-3 border-t border-line-soft pt-2.5 text-[10px] leading-relaxed text-muted">
          {t.stock.complianceMissing}
        </p>
        <p className="mt-1.5 text-[10px] leading-relaxed text-muted">
          {t.stock.complianceDisclaimer}
        </p>
      </div>
    </Panel>
  );
}

/**
 * Aynı alt sektördeki şirketler — piyasa değerine göre en büyük altı isim.
 * Sınıflandırma GICS'ten gelir; fiyatlar canlı.
 */
async function PeersCard({
  symbol,
  locale,
  t,
}: {
  symbol: string;
  locale: Locale;
  t: Dictionary;
}) {
  const member = indexMemberOf(symbol);
  const peers = peersOf(symbol);
  if (peers.length === 0) return null;

  const meta = await getSymbolNames(peers.map((peer) => peer.symbol));
  const ranked = [...peers]
    .sort(
      (a, b) =>
        (meta[b.symbol]?.marketCap ?? 0) - (meta[a.symbol]?.marketCap ?? 0),
    )
    .slice(0, 6);

  const status = await getStatus();
  const result = await getQuotes(
    ranked.map((peer) => peer.symbol),
    status,
  );
  const quotes = result.ok ? result.data : {};

  return (
    <Panel>
      <PanelHeader title={t.stock.peers} />
      {member?.sub && (
        <p className="border-b border-line-soft px-4 py-2 text-[11px] text-muted sm:px-5">
          {t.stock.peersHint}:{" "}
          <span className="text-soft">
            {subIndustryName(member.sub, locale)}
          </span>
        </p>
      )}
      <ul className="divide-y divide-line-soft">
        {ranked.map((peer) => {
          const quote = quotes[peer.symbol];
          return (
            <li key={peer.symbol}>
              <Link
                href={`/hisse/${peer.symbol}`}
                className="flex items-center justify-between gap-3 px-4 py-2.5 transition-colors hover:bg-primary-tint sm:px-5"
              >
                <span className="flex min-w-0 flex-col">
                  <span className="numeral text-sm font-semibold text-strong">
                    {peer.symbol}
                  </span>
                  <span className="truncate text-[11px] text-muted">
                    {peer.name}
                  </span>
                </span>
                {quote ? (
                  <span className="flex shrink-0 items-center gap-2">
                    <span className="numeral text-xs text-body">
                      {formatPrice(quote.price, locale)}
                    </span>
                    <ChangePill
                      changePct={quote.changePct}
                      locale={locale}
                      size="sm"
                    />
                  </span>
                ) : (
                  <span className="text-xs text-muted">—</span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </Panel>
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

  const shown = result.data.slice(0, 8);

  /* Haber önce SİTE İÇİNDE okunur; kaynak bağlantısı detay sayfasındadır.
     Şirket haberleri canlı uçtan gelir ve genel akış tablosunda olmayabilir —
     görüntülendiği anda tabloya işlenir, bağlantı kalıcı id ile kurulur. */
  let idByProvider = new Map<string, string>();
  try {
    await db
      .insert(news)
      .values(
        shown.map((item) => ({
          providerId: item.providerId,
          headline: item.headline,
          summary: item.summary,
          url: item.url,
          imageUrl: item.imageUrl,
          source: item.source,
          category: item.category,
          symbols: item.symbols,
          publishedAt: item.publishedAt,
        })),
      )
      .onConflictDoNothing();
    const rows = await db
      .select({ id: news.id, providerId: news.providerId })
      .from(news)
      .where(
        inArray(
          news.providerId,
          shown.map((item) => item.providerId),
        ),
      );
    idByProvider = new Map(rows.map((row) => [row.providerId, row.id]));
  } catch {
    // DB yazılamazsa haberler kaynağa bağlanır — liste yine çalışır.
  }

  return (
    <ul className="divide-y divide-line-soft">
      {shown.map((item) => {
        const newsId = idByProvider.get(item.providerId);
        const inner = (
          <>
            <p className="line-clamp-2 text-sm font-medium leading-snug text-strong">
              {item.headline}
            </p>
            <p className="mt-1 flex items-center gap-1.5 text-[11px] text-muted">
              {item.source && <span>{item.source}</span>}
              <span aria-hidden>·</span>
              <span>{timeAgo(item.publishedAt, locale)}</span>
            </p>
          </>
        );
        return (
          <li key={item.providerId}>
            {newsId ? (
              <Link
                href={`/haberler/${newsId}`}
                className="block px-4 py-3 transition-colors hover:bg-primary-tint sm:px-5"
              >
                {inner}
              </Link>
            ) : (
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block px-4 py-3 transition-colors hover:bg-surface-elevated sm:px-5"
              >
                {inner}
              </a>
            )}
          </li>
        );
      })}
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
