import Link from "next/link";
import { auth } from "@/auth";
import {
  EmptyState,
  PageHeader,
  Segmented,
} from "@/components/ui/primitives";
import { getEarningsBetween, getSymbolNames, getUserSymbols } from "@/lib/data";
import { addEtDays, todayEt } from "@/lib/market-hours";
import { getI18n, type Dictionary, type Locale } from "@/lib/i18n";
import { cn, formatCompact, formatEtDateLong, formatPrice } from "@/lib/utils";
import { indexMemberOf } from "@/db/seed/indices";
import { subIndustryName } from "@/db/seed/sub-industries";
import type { EarningsRow } from "@/lib/schema";
import type { SymbolMeta } from "@/lib/data";

/**
 * Bilanço takvimi — gazetenin şirket fihristi.
 *
 * Üstte iki haftanın yoğunluk histogramı (hangi gün kaç bilanço), altında
 * gün gün tablolar. Kart yok: her gün bir `.sheet` tablosudur, satırlar
 * piyasa değerine göre sıralı — en büyük şirket üstte, kalabalık altta.
 */

/** Bir günde tabloda açık duran satır sayısı; fazlası katlanır. */
const VISIBLE_PER_DAY = 8;
const RANGE_DAYS = 13;

type Filter = "all" | "sp500" | "watchlist";

export default async function EarningsPage(props: PageProps<"/bilancolar">) {
  const search = await props.searchParams;
  const filter: Filter =
    search.f === "favoriler"
      ? "watchlist"
      : search.f === "sp500"
        ? "sp500"
        : "all";

  const { locale, t } = await getI18n();
  const session = await auth();
  const today = todayEt();

  const allRows = await getEarningsBetween(today, addEtDays(today, RANGE_DAYS));

  let userSymbols: string[] = [];
  if (session?.user?.id) {
    userSymbols = await getUserSymbols(session.user.id);
  }
  const watchSet = new Set(userSymbols);

  let rows = allRows;
  if (filter === "watchlist" && userSymbols.length > 0) {
    rows = rows.filter((row) => watchSet.has(row.symbol));
  } else if (filter === "sp500") {
    rows = rows.filter((row) => indexMemberOf(row.symbol) !== null);
  }

  const meta = await getSymbolNames([...new Set(rows.map((r) => r.symbol))]);

  const byDay = new Map<string, EarningsRow[]>();
  for (const row of rows) {
    const list = byDay.get(row.reportDate) ?? [];
    list.push(row);
    byDay.set(row.reportDate, list);
  }
  const days = [...byDay.entries()];

  // Histogram yalnızca ilk yedi günü gösterir — iki haftanın tamamı okunmuyor.
  const histogram = Array.from({ length: 7 }, (_, offset) => {
    const date = addEtDays(today, offset);
    return { date, count: byDay.get(date)?.length ?? 0 };
  });
  const peak = Math.max(1, ...histogram.map((bar) => bar.count));

  const filterHref = (value: Filter) =>
    value === "all"
      ? "/bilancolar"
      : `/bilancolar?f=${value === "watchlist" ? "favoriler" : "sp500"}`;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <PageHeader
          eyebrow={t.earnings.title}
          title={`${t.earnings.thisFortnight} ${rows.length} ${t.earnings.companiesCount}`}
        />
        <Segmented
          className="shrink-0"
          options={[
            { href: filterHref("all"), label: t.common.all, active: filter === "all" },
            {
              href: filterHref("sp500"),
              label: "S&P 500",
              active: filter === "sp500",
            },
            ...(session?.user
              ? [
                  {
                    href: filterHref("watchlist"),
                    label: t.earnings.onlyWatchlist,
                    active: filter === "watchlist",
                  },
                ]
              : []),
          ]}
        />
      </div>

      {/* Yoğunluk histogramı — hangi gün kaç şirket açıklıyor */}
      {rows.length > 0 && (
        <section aria-hidden className="hidden sm:block">
          <div className="flex h-[110px] items-end gap-0.5 border-b border-ink">
            {histogram.map((bar) => {
              const isToday = bar.date === today;
              return (
                <div
                  key={bar.date}
                  className="flex h-full flex-1 flex-col justify-end px-1.5"
                >
                  <span
                    className={cn(
                      "numeral mb-1 text-center text-[12px]",
                      isToday ? "font-semibold text-up" : "text-faint",
                    )}
                  >
                    {bar.count || ""}
                  </span>
                  <div
                    className={cn(isToday ? "bg-up" : "bg-line-strong opacity-30")}
                    style={{ height: `${(bar.count / peak) * 82}%` }}
                  />
                </div>
              );
            })}
          </div>
          <div className="mt-2 flex">
            {histogram.map((bar) => (
              <span
                key={bar.date}
                className={cn(
                  "flex-1 text-center text-[12px] uppercase tracking-[0.07em]",
                  bar.date === today ? "font-semibold text-up" : "text-faint",
                )}
              >
                {shortDay(bar.date, locale)}
              </span>
            ))}
          </div>
        </section>
      )}

      {days.length === 0 ? (
        <EmptyState title={t.earnings.empty} />
      ) : (
        <div className="flex flex-col gap-12">
          {days.map(([date, dayRows]) => (
            <DayTable
              key={date}
              date={date}
              isToday={date === today}
              rows={dayRows}
              meta={meta}
              watchSet={watchSet}
              locale={locale}
              t={t}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* --------------------------------------------------------------------------
   Gün tablosu
   -------------------------------------------------------------------------- */

function DayTable({
  date,
  isToday,
  rows,
  meta,
  watchSet,
  locale,
  t,
}: {
  date: string;
  isToday: boolean;
  rows: EarningsRow[];
  meta: Record<string, SymbolMeta>;
  watchSet: Set<string>;
  locale: Locale;
  t: Dictionary;
}) {
  // Büyük şirket üstte: piyasa değeri bilinenler önce, kendi içinde azalan.
  const sorted = [...rows].sort(
    (a, b) =>
      (meta[b.symbol]?.marketCap ?? -1) - (meta[a.symbol]?.marketCap ?? -1),
  );
  const visible = sorted.slice(0, VISIBLE_PER_DAY);
  const rest = sorted.slice(VISIBLE_PER_DAY);

  return (
    <section aria-label={date}>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 pb-2">
        <h2
          className={cn(
            "text-[20px] font-semibold sm:text-[22px]",
            isToday ? "text-up" : "text-ink",
          )}
        >
          {isToday ? `${t.today.title} · ` : ""}
          {formatEtDateLong(date, locale)}
        </h2>
        <span className="numeral text-[12.5px] text-faint">
          {rows.length} {t.earnings.companiesCount}
        </span>
      </div>

      <div className="scroll-x">
        <table className="sheet min-w-[620px]">
          <thead>
            <tr>
              <th className="w-[84px]">{t.companies.company}</th>
              <th>{t.companies.name}</th>
              <th className="hidden w-[150px] md:table-cell">
                {t.companies.sector}
              </th>
              <th className="w-[132px]">{t.earnings.timing}</th>
              <th className="num w-[92px]">{t.earnings.epsEstimate}</th>
              <th className="num w-[80px]">{t.calendar.actual}</th>
              <th className="num w-[84px]">{t.earnings.surprise}</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <EarningsRowLine
                key={row.id}
                row={row}
                meta={meta[row.symbol]}
                watched={watchSet.has(row.symbol)}
                locale={locale}
                t={t}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Kalabalık katlanır — gün başlığının altındaki tablo okunur kalır. */}
      {rest.length > 0 && (
        <details className="group/details mt-3">
          <summary className="inline-flex min-h-[36px] cursor-pointer list-none items-center gap-1.5 text-[13px] text-dim transition-colors hover:text-ink [&::-webkit-details-marker]:hidden">
            <span aria-hidden className="transition-transform group-open/details:rotate-90">
              ›
            </span>
            {t.earnings.alsoReporting}
            <span className="numeral">({rest.length})</span>
          </summary>
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1.5">
            {rest.map((row) => (
              <Link
                key={row.id}
                href={`/hisse/${row.symbol}`}
                className={cn(
                  "numeral text-[13px] transition-colors hover:text-up",
                  watchSet.has(row.symbol)
                    ? "font-semibold text-ink"
                    : "text-dim",
                )}
              >
                {row.symbol}
              </Link>
            ))}
          </div>
        </details>
      )}
    </section>
  );
}

function EarningsRowLine({
  row,
  meta,
  watched,
  locale,
  t,
}: {
  row: EarningsRow;
  meta: SymbolMeta | undefined;
  watched: boolean;
  locale: Locale;
  t: Dictionary;
}) {
  const member = indexMemberOf(row.symbol);
  const sector = member?.sub
    ? subIndustryName(member.sub, locale)
    : (meta?.industry ?? "—");

  const timing =
    row.hour === "bmo"
      ? t.earnings.beforeOpen
      : row.hour === "amc"
        ? t.earnings.afterClose
        : row.hour === "dmh"
          ? t.earnings.duringMarket
          : t.earnings.timeUnknown;

  const surprise =
    row.epsActual !== null && row.epsEstimate !== null && row.epsEstimate !== 0
      ? ((row.epsActual - row.epsEstimate) / Math.abs(row.epsEstimate)) * 100
      : null;

  return (
    <tr>
      <td>
        <Link
          href={`/hisse/${row.symbol}`}
          className={cn(
            "numeral font-semibold transition-colors hover:text-up",
            watched ? "text-up" : "text-ink",
          )}
        >
          {row.symbol}
        </Link>
      </td>
      <td className="max-w-0">
        <span className="block truncate text-[14.5px] text-body">
          {meta?.name ?? "—"}
        </span>
        {meta?.marketCap ? (
          <span className="numeral block text-[11.5px] text-faint">
            ${formatCompact(meta.marketCap, locale)}
          </span>
        ) : null}
      </td>
      <td className="hidden max-w-0 md:table-cell">
        <span className="block truncate text-[12.5px] text-faint">{sector}</span>
      </td>
      <td className="text-[13px] text-faint">{timing}</td>
      <td className="num text-[14px] text-dim">
        {row.epsEstimate !== null
          ? formatPrice(row.epsEstimate, locale, { currency: true })
          : "—"}
      </td>
      <td className="num text-[14px] font-semibold text-ink">
        {row.epsActual !== null
          ? formatPrice(row.epsActual, locale, { currency: true })
          : "—"}
      </td>
      <td
        className={cn(
          "num numeral text-[13.5px]",
          surprise === null
            ? "text-faint"
            : surprise >= 0
              ? "text-up"
              : "text-down",
        )}
      >
        {surprise === null ? (
          "—"
        ) : (
          <>
            <span aria-hidden className="mr-0.5 text-[0.82em]">
              {surprise >= 0 ? "▲" : "▼"}
            </span>
            %{formatPrice(Math.abs(surprise), locale, { digits: 1 })}
          </>
        )}
      </td>
    </tr>
  );
}

function shortDay(dateStr: string, locale: string): string {
  const date = new Date(`${dateStr}T12:00:00Z`);
  const weekday = new Intl.DateTimeFormat(locale === "tr" ? "tr-TR" : "en-US", {
    weekday: "short",
    timeZone: "UTC",
  }).format(date);
  return `${weekday} ${dateStr.slice(8, 10)}`;
}
