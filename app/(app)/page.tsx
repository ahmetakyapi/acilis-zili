import { Suspense } from "react";
import Link from "next/link";
import { auth } from "@/auth";
import { DayRail, type RailEvent } from "@/components/today/DayRail";
import { LiveClock } from "@/components/today/LiveClock";
import {
  ChangePill,
  DataError,
  DataStamp,
  EmptyState,
  Panel,
  PanelHeader,
  Skeleton,
} from "@/components/ui/primitives";
import {
  getDailyBrief,
  getEventsBetween,
  getLatestNews,
  getStatus,
  getTodayEvents,
  getEarningsBetween,
  getUserSymbols,
} from "@/lib/data";
import {
  addEtDays,
  etDateTimeToUtc,
  formatCountdown,
  todayEt,
} from "@/lib/market-hours";
import { getQuotes } from "@/lib/providers";
import { INDEX_STRIP, WORLD_MARKETS } from "@/db/seed/symbols";
import { getI18n, type Dictionary, type Locale } from "@/lib/i18n";
import {
  cn,
  directionOf,
  dualTime,
  formatEtDateLong,
  formatPercent,
  formatPrice,
  timeAgo,
} from "@/lib/utils";
import { Sparkline } from "@/components/ui/Sparkline";
import { getChartBars } from "@/lib/providers";

export default async function TodayPage() {
  const { locale, t } = await getI18n();
  const status = await getStatus();

  const sessionLabel: Record<string, string> = {
    regular: t.market.open,
    "pre-market": t.market.preMarket,
    "after-hours": t.market.afterHours,
    closed: status.holiday
      ? t.market.holiday
      : status.isWeekend
        ? t.market.weekend
        : t.market.closed,
  };

  const countdownTarget =
    status.session === "regular" ? status.nextClose : status.nextOpen;
  const countdownLabel =
    status.session === "regular" ? t.market.closesIn : t.market.opensIn;

  return (
    <div className="flex flex-col gap-5">
      {/* ---- Durum başlığı ---- */}
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="plate">{t.today.title} · New York</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">
            {formatEtDateLong(status.etDate, locale)}
          </h1>
        </div>
        <div className="flex flex-col items-start gap-1.5 sm:items-end">
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 rounded-full border border-line bg-surface px-3.5 py-1.5 text-sm shadow-(--shadow-card)">
            <span className="flex items-center gap-2">
              <span
                aria-hidden
                className={cn(
                  "size-2 rounded-full",
                  status.session === "regular"
                    ? "bg-brass pulse-live"
                    : status.session === "closed"
                      ? "bg-flat"
                      : "bg-primary",
                )}
              />
              <span className="font-medium text-strong">
                {sessionLabel[status.session]}
              </span>
            </span>
            <span aria-hidden className="hidden text-line-strong sm:inline">
              |
            </span>
            <span className="whitespace-nowrap text-muted">
              {countdownLabel}{" "}
              <span className="numeral font-semibold text-strong">
                {formatCountdown(countdownTarget, new Date(), locale)}
              </span>
            </span>
          </div>
          <LiveClock />
        </div>
      </header>

      {/* ---- Gün Şeridi ---- */}
      <Panel className="px-4 pb-3 pt-5 sm:px-6">
        <Suspense fallback={<Skeleton className="h-36 w-full" />}>
          <RailSection t={t} status={{ trading: status.session !== "closed" || (!status.isWeekend && !status.holiday), closeMinutes: status.closeMinutes, nowMinutes: status.etMinutes }} locale={locale} />
        </Suspense>
      </Panel>

      {/* ---- Endeksler ---- */}
      <section aria-label={t.today.indices}>
        <Suspense fallback={<IndexSkeleton />}>
          <IndexStrip locale={locale} t={t} />
        </Suspense>
      </section>

      {/* ---- Dünya piyasaları ---- */}
      <Suspense fallback={<Skeleton className="h-28 w-full rounded-(--radius-xl)" />}>
        <WorldStrip locale={locale} t={t} />
      </Suspense>

      <div className="grid gap-5 lg:grid-cols-5">
        <div className="flex flex-col gap-5 lg:col-span-3">
          {/* ---- Günün özeti ---- */}
          <Suspense fallback={<Skeleton className="h-40 w-full rounded-(--radius-lg)" />}>
            <BriefCard locale={locale} t={t} />
          </Suspense>

          {/* ---- Bugünün takvimi ---- */}
          <Panel>
            <PanelHeader title={t.today.schedule} />
            <Suspense fallback={<ListSkeleton rows={3} />}>
              <ScheduleList locale={locale} t={t} />
            </Suspense>
          </Panel>

          {/* ---- Bugün bilanço açıklayanlar ---- */}
          <Panel>
            <PanelHeader
              title={t.today.earningsToday}
              action={
                <Link href="/bilancolar" className="text-xs text-primary hover:underline">
                  {t.common.showAll}
                </Link>
              }
            />
            <Suspense fallback={<ListSkeleton rows={3} />}>
              <EarningsToday locale={locale} t={t} />
            </Suspense>
          </Panel>
        </div>

        <div className="flex flex-col gap-5 lg:col-span-2">
          {/* ---- Haftaya bakış — önümüzdeki 7 günün önemli olayları ---- */}
          <Panel>
            <PanelHeader
              title={t.today.weekAhead}
              action={
                <Link href="/takvim" className="text-xs text-primary hover:underline">
                  {t.common.showAll}
                </Link>
              }
            />
            <Suspense fallback={<ListSkeleton rows={3} />}>
              <WeekAhead locale={locale} t={t} />
            </Suspense>
          </Panel>

          {/* ---- Favori özeti ---- */}
          <Suspense fallback={<Skeleton className="h-48 w-full rounded-(--radius-lg)" />}>
            <WatchlistSummary locale={locale} t={t} />
          </Suspense>

          {/* ---- Öne çıkan haberler ---- */}
          <Panel>
            <PanelHeader
              title={t.today.topNews}
              action={
                <Link href="/haberler" className="text-xs text-primary hover:underline">
                  {t.common.showAll}
                </Link>
              }
            />
            <Suspense fallback={<ListSkeleton rows={4} />}>
              <TopNews locale={locale} t={t} />
            </Suspense>
          </Panel>
        </div>
      </div>
    </div>
  );
}

/* ==========================================================================
   Parçalar
   ========================================================================== */

async function RailSection({
  t,
  status,
  locale,
}: {
  t: Dictionary;
  status: { trading: boolean; closeMinutes: number; nowMinutes: number };
  locale: Locale;
}) {
  const events = await getTodayEvents();

  const railEvents: RailEvent[] = events
    .filter((e) => e.eventTimeEt)
    .map((e) => ({
      id: e.id,
      timeEt: e.eventTimeEt as string,
      title: locale === "tr" ? e.titleTr : e.titleEn,
      importance: (e.importance as RailEvent["importance"]) ?? "medium",
    }));

  return (
    <>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="plate">{t.dayRail.title}</h2>
        <span className="text-[10px] text-muted">{t.calendar.allTimesET}</span>
      </div>
      <DayRail
        events={railEvents}
        initialNowMinutes={status.nowMinutes}
        tradingDay={status.trading}
        closeMinutes={status.closeMinutes}
        labels={{
          bell: t.dayRail.bell,
          close: t.dayRail.closingBell,
          now: t.dayRail.now,
          noEvents: t.dayRail.noEvents,
        }}
      />
    </>
  );
}

const INDEX_LABEL: Record<string, string> = {
  QQQ: "Nasdaq 100",
  SPY: "S&P 500",
  DIA: "Dow Jones",
  IWM: "Russell 2000",
};

async function IndexStrip({ locale, t }: { locale: Locale; t: Dictionary }) {
  const status = await getStatus();
  const [result, ...barResults] = await Promise.all([
    getQuotes([...INDEX_STRIP], status),
    ...INDEX_STRIP.map((symbol) => getChartBars(symbol, "1D", status)),
  ]);

  if (!result.ok) {
    return (
      <Panel>
        <DataError message={t.data.failed} hint={t.data.failedHint} />
      </Panel>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {INDEX_STRIP.map((symbol, index) => {
        const quote = result.data[symbol];
        if (!quote) {
          return (
            <Panel key={symbol} className="p-4">
              <p className="numeral text-sm font-semibold text-strong">{symbol}</p>
              <p className="mt-1 text-xs text-muted">{t.common.noData}</p>
            </Panel>
          );
        }
        const bars = barResults[index];
        const points = bars.ok
          ? bars.data.map((bar) => ({ value: bar.close }))
          : [];
        const tone = directionOf(quote.changePct);
        return (
          <Link key={symbol} href={`/hisse/${symbol}`} className="group">
            <Panel className="panel-hover flex h-full flex-col p-4">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-xs font-semibold text-strong">
                  {INDEX_LABEL[symbol] ?? symbol}
                </p>
                <p className="numeral text-[10px] text-muted">{symbol}</p>
              </div>
              <div className="mt-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <p className="tote text-xl">
                  {formatPrice(quote.price, locale)}
                </p>
                <ChangePill changePct={quote.changePct} locale={locale} size="sm" />
              </div>
              {points.length > 1 && (
                <Sparkline
                  points={points}
                  title={`${INDEX_LABEL[symbol] ?? symbol} · 1D`}
                  tone={tone}
                  height={44}
                  showLastDot={false}
                  strokeWidth={1.5}
                  className="mt-2.5 h-11 w-full opacity-90"
                />
              )}
            </Panel>
          </Link>
        );
      })}
      <div className="col-span-2 lg:col-span-4">
        <DataStamp
          source={result.source}
          at={result.fetchedAt}
          stale={result.stale}
          locale={locale}
          note={locale === "tr" ? "Endeksler ETF üzerinden izlenir" : "Indices tracked via ETFs"}
        />
      </div>
    </div>
  );
}

/**
 * Dünya piyasaları şeridi — ülke fonları üzerinden.
 * Yerel endeksin kendisi değil; kartın altındaki künye bunu açıkça söyler.
 */
async function WorldStrip({ locale, t }: { locale: Locale; t: Dictionary }) {
  const status = await getStatus();
  const result = await getQuotes(
    WORLD_MARKETS.map((market) => market.symbol),
    status,
  );
  if (!result.ok) return null;

  const shown = WORLD_MARKETS.filter((market) => result.data[market.symbol]);
  if (shown.length === 0) return null;

  return (
    <Panel>
      <PanelHeader title={t.today.worldMarkets} />
      <ul className="grid grid-cols-2 divide-line-soft sm:grid-cols-3 lg:grid-cols-6">
        {shown.map((market) => {
          const quote = result.data[market.symbol];
          const tone = directionOf(quote.changePct);
          return (
            <li
              key={market.symbol}
              className="border-b border-r border-line-soft px-4 py-3 last:border-r-0"
            >
              <Link href={`/hisse/${market.symbol}`} className="block">
                <p className="flex items-center gap-1.5 text-xs font-semibold text-strong">
                  <span aria-hidden>{market.flag}</span>
                  {locale === "tr" ? market.nameTr : market.nameEn}
                </p>
                <p className="tote mt-1 text-base">
                  {formatPrice(quote.price, locale)}
                </p>
                <p
                  className={cn(
                    "numeral text-xs font-semibold",
                    tone === "up"
                      ? "text-up"
                      : tone === "down"
                        ? "text-down"
                        : "text-muted",
                  )}
                >
                  {formatPercent(quote.changePct, locale)}
                </p>
                <p className="mt-1 text-[10px] leading-tight text-muted">
                  {locale === "tr" ? market.tracksTr : market.tracksEn}
                </p>
              </Link>
            </li>
          );
        })}
      </ul>
      <p className="px-4 py-2.5 text-[11px] leading-relaxed text-muted sm:px-5">
        {t.today.worldMarketsHint}
      </p>
    </Panel>
  );
}

function IndexSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-24 rounded-(--radius-lg)" />
      ))}
    </div>
  );
}

async function BriefCard({ locale, t }: { locale: Locale; t: Dictionary }) {
  const brief = await getDailyBrief(locale);

  return (
    <Panel>
      <PanelHeader title={t.today.briefTitle} />
      {brief ? (
        <div className="px-4 py-4 sm:px-5">
          <h3 className="display text-[1.4rem] leading-[1.2] sm:text-[1.6rem]">
            {brief.headline}
          </h3>
          <div className="mt-2.5 text-[15px] leading-relaxed text-body">
            <BriefBody markdown={brief.bodyMd} />
          </div>
          <DataStamp
            source={brief.generatedBy === "claude" ? "Claude" : "seed"}
            at={brief.generatedAt}
            locale={locale}
            className="mt-3"
          />
        </div>
      ) : (
        <EmptyState title={t.today.briefEmpty} />
      )}
    </Panel>
  );
}

async function ScheduleList({ locale, t }: { locale: Locale; t: Dictionary }) {
  const events = await getTodayEvents();

  if (events.length === 0) {
    return <EmptyState title={t.today.scheduleEmpty} />;
  }

  return (
    <ul className="divide-y divide-line-soft">
      {events.map((event) => {
        const times = event.eventTimeEt
          ? dualTime(
              etDateTimeToUtc(event.eventDate, event.eventTimeEt),
              event.eventTimeEt,
            )
          : null;
        return (
        <li key={event.id} className="flex items-center gap-3 px-4 py-2.5 sm:px-5">
          <span className="w-14 shrink-0">
            {times ? (
              <>
                <span className="numeral block text-sm font-semibold leading-tight text-strong">
                  {times.et}
                  <span className="ml-1 text-[9px] font-normal text-muted">NY</span>
                </span>
                <span className="numeral block text-[11px] leading-tight text-muted">
                  {times.tr}
                  <span className="ml-1 text-[9px]">TR</span>
                </span>
              </>
            ) : (
              <span className="numeral text-sm text-muted">—</span>
            )}
          </span>
          <span
            aria-hidden
            className={cn(
              "size-1.5 shrink-0 rounded-full",
              event.importance === "high"
                ? "bg-impact-high"
                : event.importance === "medium"
                  ? "bg-impact-med"
                  : "bg-impact-low",
            )}
          />
          <span className="min-w-0 flex-1 truncate text-sm text-body">
            {locale === "tr" ? event.titleTr : event.titleEn}
          </span>
          {event.actual && (
            <span className="numeral shrink-0 text-sm font-semibold text-strong">
              {event.actual}
              {event.unit === "%" ? "%" : ""}
            </span>
          )}
          {!event.actual && event.forecast && (
            <span className="numeral shrink-0 text-xs text-muted">
              {t.calendar.forecast}: {event.forecast}
              {event.unit === "%" ? "%" : ""}
            </span>
          )}
        </li>
        );
      })}
    </ul>
  );
}

async function EarningsToday({ locale, t }: { locale: Locale; t: Dictionary }) {
  const today = todayEt();
  const rows = await getEarningsBetween(today, today);

  if (rows.length === 0) {
    return <EmptyState title={t.earnings.empty} />;
  }

  const hourLabel: Record<string, string> = {
    bmo: t.earnings.beforeOpen,
    amc: t.earnings.afterClose,
    dmh: t.earnings.duringMarket,
  };

  return (
    <ul className="divide-y divide-line-soft">
      {rows.slice(0, 8).map((row) => (
        <li key={row.id}>
          <Link
            href={`/hisse/${row.symbol}`}
            className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-surface-elevated sm:px-5"
          >
            <span className="numeral w-16 shrink-0 text-sm font-semibold text-strong">
              {row.symbol}
            </span>
            <span className="min-w-0 flex-1 truncate text-xs text-soft">
              {row.hour ? (hourLabel[row.hour] ?? t.earnings.timeUnknown) : t.earnings.timeUnknown}
            </span>
            {row.epsEstimate !== null && (
              <span className="numeral shrink-0 text-xs text-muted">
                {t.earnings.epsEstimate}:{" "}
                <span className="text-soft">{formatPrice(row.epsEstimate, locale)}</span>
              </span>
            )}
          </Link>
        </li>
      ))}
    </ul>
  );
}

async function WatchlistSummary({ locale, t }: { locale: Locale; t: Dictionary }) {
  const session = await auth();

  if (!session?.user?.id) {
    return (
      <Panel>
        <PanelHeader title={t.today.watchlistSummary} />
        <EmptyState
          title={t.watchlist.emptyAll}
          hint={t.watchlist.emptyAllHint}
          action={
            <Link
              href="/giris"
              className="inline-flex h-9 items-center rounded-(--radius-md) bg-primary px-4 text-sm font-medium text-white transition-colors hover:bg-primary-hover"
            >
              {t.nav.signIn}
            </Link>
          }
        />
      </Panel>
    );
  }

  const userSymbols = await getUserSymbols(session.user.id);

  if (userSymbols.length === 0) {
    return (
      <Panel>
        <PanelHeader title={t.today.watchlistSummary} />
        <EmptyState
          title={t.today.watchlistEmpty}
          action={
            <Link href="/favoriler" className="text-sm text-primary hover:underline">
              {t.watchlist.addSymbol}
            </Link>
          }
        />
      </Panel>
    );
  }

  const status = await getStatus();
  const shown = userSymbols.slice(0, 8);
  const result = await getQuotes(shown, status);

  return (
    <Panel>
      <PanelHeader
        title={t.today.watchlistSummary}
        action={
          <Link href="/favoriler" className="text-xs text-primary hover:underline">
            {t.common.showAll}
          </Link>
        }
      />
      {result.ok ? (
        <>
          <ul className="divide-y divide-line-soft">
            {shown.map((symbol) => {
              const quote = result.data[symbol];
              return (
                <li key={symbol}>
                  <Link
                    href={`/hisse/${symbol}`}
                    className="flex items-center justify-between gap-3 px-4 py-2.5 transition-colors hover:bg-surface-elevated sm:px-5"
                  >
                    <span className="numeral text-sm font-semibold text-strong">
                      {symbol}
                    </span>
                    {quote ? (
                      <span className="flex items-center gap-3">
                        <span className="numeral text-sm text-body">
                          {formatPrice(quote.price, locale)}
                        </span>
                        <ChangePill changePct={quote.changePct} locale={locale} size="sm" />
                      </span>
                    ) : (
                      <span className="text-xs text-muted">{t.common.noData}</span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
          <DataStamp
            source={result.source}
            at={result.fetchedAt}
            stale={result.stale}
            locale={locale}
            className="px-4 pb-3 pt-2 sm:px-5"
          />
        </>
      ) : (
        <DataError message={t.data.failed} hint={t.data.failedHint} />
      )}
    </Panel>
  );
}

/**
 * Haftaya bakış — önümüzdeki 7 günün yüksek ve orta önemli olayları.
 * Gün adı + çift saat: kullanıcı haftayı tek bakışta planlar.
 */
async function WeekAhead({ locale, t }: { locale: Locale; t: Dictionary }) {
  const today = todayEt();
  const events = (
    await getEventsBetween(addEtDays(today, 1), addEtDays(today, 7))
  ).filter((event) => event.importance !== "low");

  if (events.length === 0) {
    return <EmptyState title={t.today.weekAheadEmpty} />;
  }

  return (
    <ul className="divide-y divide-line-soft">
      {events.slice(0, 6).map((event) => {
        const times = event.eventTimeEt
          ? dualTime(
              etDateTimeToUtc(event.eventDate, event.eventTimeEt),
              event.eventTimeEt,
            )
          : null;
        return (
          <li key={event.id} className="flex items-center gap-3 px-4 py-2.5 sm:px-5">
            <span className="w-24 shrink-0">
              <span className="block text-xs font-semibold leading-tight text-strong">
                {formatEtDateLong(event.eventDate, locale)}
              </span>
              {times && (
                <span className="numeral block text-[11px] leading-tight text-muted">
                  {times.et} NY · {times.tr} TR
                </span>
              )}
            </span>
            <span
              aria-hidden
              className={cn(
                "size-1.5 shrink-0 rounded-full",
                event.importance === "high" ? "bg-impact-high" : "bg-impact-med",
              )}
            />
            <span className="min-w-0 flex-1 text-sm leading-snug text-body">
              {locale === "tr" ? event.titleTr : event.titleEn}
            </span>
            {event.forecast && (
              <span className="numeral shrink-0 text-xs text-muted">
                {t.calendar.forecast}: {event.forecast}
                {event.unit === "%" ? "%" : ""}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

async function TopNews({ locale, t }: { locale: Locale; t: Dictionary }) {
  const items = await getLatestNews(6);

  if (items.length === 0) {
    return <EmptyState title={t.news.empty} />;
  }

  return (
    <ul className="divide-y divide-line-soft">
      {items.map((item) => (
        <li key={item.id}>
          <Link
            href={`/haberler/${item.id}`}
            className="block px-4 py-3 transition-colors hover:bg-primary-tint sm:px-5"
          >
            <p className="line-clamp-2 text-sm font-medium leading-snug text-strong">
              {locale === "tr" && item.headlineTr ? item.headlineTr : item.headline}
            </p>
            <p className="mt-1 flex items-center gap-1.5 text-[11px] text-muted">
              {item.source && <span>{item.source}</span>}
              <span aria-hidden>·</span>
              <span>{timeAgo(item.publishedAt, locale)}</span>
            </p>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/**
 * Özet gövdesi için mini biçimlendirici — tam markdown değil, brifingin
 * kullandığı alt küme: **kalın**, "- " madde imi, boş satır paragraf arası.
 */
function BriefBody({ markdown }: { markdown: string }) {
  const lines = markdown.split("\n");

  function renderInline(text: string, keyPrefix: string) {
    return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
      part.startsWith("**") && part.endsWith("**") ? (
        <strong key={`${keyPrefix}-${i}`} className="font-semibold text-strong">
          {part.slice(2, -2)}
        </strong>
      ) : (
        <span key={`${keyPrefix}-${i}`}>{part}</span>
      ),
    );
  }

  return (
    <div className="flex flex-col gap-1">
      {lines.map((line, index) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={index} className="h-1.5" />;
        if (trimmed.startsWith("- ")) {
          return (
            <p key={index} className="flex gap-2 pl-1">
              <span aria-hidden className="mt-[7px] size-1 shrink-0 rounded-full bg-brass" />
              <span>{renderInline(trimmed.slice(2), String(index))}</span>
            </p>
          );
        }
        return <p key={index}>{renderInline(trimmed, String(index))}</p>;
      })}
    </div>
  );
}

function ListSkeleton({ rows }: { rows: number }) {
  return (
    <div className="flex flex-col gap-2 px-4 py-3 sm:px-5">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-9 w-full" />
      ))}
    </div>
  );
}
