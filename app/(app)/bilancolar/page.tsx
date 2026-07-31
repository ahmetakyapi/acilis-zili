import Link from "next/link";
import { auth } from "@/auth";
import { EmptyState, Panel } from "@/components/ui/primitives";
import { getEarningsBetween, getSymbolNames, getUserSymbols } from "@/lib/data";
import { addEtDays, todayEt } from "@/lib/market-hours";
import { getI18n } from "@/lib/i18n";
import { cn, formatPrice } from "@/lib/utils";
import type { EarningsRow } from "@/lib/schema";

export default async function EarningsPage(
  props: PageProps<"/bilancolar">,
) {
  const search = await props.searchParams;
  const onlyWatchlist = search.f === "favoriler";

  const { locale, t } = await getI18n();
  const session = await auth();
  const today = todayEt();

  let rows = await getEarningsBetween(today, addEtDays(today, 13));

  let userSymbols: string[] = [];
  if (session?.user?.id) {
    userSymbols = await getUserSymbols(session.user.id);
  }
  if (onlyWatchlist && userSymbols.length > 0) {
    const set = new Set(userSymbols);
    rows = rows.filter((row) => set.has(row.symbol));
  }

  const names = await getSymbolNames([...new Set(rows.map((r) => r.symbol))]);
  const watchSet = new Set(userSymbols);

  const byDay = new Map<string, EarningsRow[]>();
  for (const row of rows) {
    const list = byDay.get(row.reportDate) ?? [];
    list.push(row);
    byDay.set(row.reportDate, list);
  }

  const hourLabel: Record<string, string> = {
    bmo: t.earnings.beforeOpen,
    amc: t.earnings.afterClose,
    dmh: t.earnings.duringMarket,
  };
  const hourOrder: Record<string, number> = { bmo: 0, dmh: 1, amc: 2 };

  const dayFormatter = new Intl.DateTimeFormat(locale === "tr" ? "tr-TR" : "en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="notched inline-block text-2xl font-semibold sm:text-3xl">
            {t.earnings.title}
          </h1>
          <p className="mt-2 text-sm text-soft">{t.earnings.subtitle}</p>
        </div>
        {session?.user && (
          <Link
            href={onlyWatchlist ? "/bilancolar" : "/bilancolar?f=favoriler"}
            className={cn(
              "min-h-[36px] rounded-(--radius-sm) border px-3 py-1.5 text-sm transition-colors",
              onlyWatchlist
                ? "border-transparent bg-primary-wash font-medium text-primary"
                : "border-line text-soft hover:border-line-strong hover:text-strong",
            )}
          >
            {t.earnings.onlyWatchlist}
          </Link>
        )}
      </header>

      {byDay.size === 0 ? (
        <Panel>
          <EmptyState title={t.earnings.empty} />
        </Panel>
      ) : (
        [...byDay.entries()].map(([date, dayRows]) => (
          <Panel key={date}>
            <div className="flex items-baseline justify-between border-b border-line-soft px-4 py-3 sm:px-5">
              <h2 className="text-sm font-semibold text-strong">
                {dayFormatter.format(new Date(`${date}T00:00:00Z`))}
              </h2>
              <span className="numeral text-[11px] text-muted">{date}</span>
            </div>
            <ul className="divide-y divide-line-soft">
              {dayRows
                .sort(
                  (a, b) =>
                    (hourOrder[a.hour ?? ""] ?? 3) - (hourOrder[b.hour ?? ""] ?? 3),
                )
                .map((row) => (
                  <li key={row.id}>
                    <Link
                      href={`/hisse/${row.symbol}`}
                      className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-elevated sm:px-5"
                    >
                      <span className="numeral w-16 shrink-0 text-sm font-semibold text-strong">
                        {row.symbol}
                        {watchSet.has(row.symbol) && (
                          <span aria-hidden className="ml-1 text-brass">
                            ★
                          </span>
                        )}
                      </span>
                      <span className="hidden min-w-0 flex-1 truncate text-sm text-soft sm:block">
                        {names[row.symbol]?.name ?? ""}
                      </span>
                      <span
                        className={cn(
                          "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium",
                          row.hour === "bmo"
                            ? "bg-brass-wash text-impact-med"
                            : row.hour === "amc"
                              ? "bg-primary-wash text-primary"
                              : "bg-surface-sunken text-muted",
                        )}
                      >
                        {row.hour ? (hourLabel[row.hour] ?? t.earnings.timeUnknown) : t.earnings.timeUnknown}
                      </span>
                      {row.epsEstimate !== null && (
                        <span className="numeral hidden shrink-0 text-xs text-muted sm:block">
                          EPS {formatPrice(row.epsEstimate, locale)}
                        </span>
                      )}
                    </Link>
                  </li>
                ))}
            </ul>
          </Panel>
        ))
      )}
    </div>
  );
}
