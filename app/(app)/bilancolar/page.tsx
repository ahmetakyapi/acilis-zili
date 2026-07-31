import Image from "next/image";
import Link from "next/link";
import { auth } from "@/auth";
import { EmptyState, Panel } from "@/components/ui/primitives";
import { getEarningsBetween, getSymbolNames, getUserSymbols } from "@/lib/data";
import { addEtDays, todayEt } from "@/lib/market-hours";
import { getI18n, type Dictionary, type Locale } from "@/lib/i18n";
import { cn, formatCompact, formatEtDateLong, formatPrice } from "@/lib/utils";
import type { EarningsRow } from "@/lib/schema";
import type { SymbolMeta } from "@/lib/data";

/**
 * Bilanço takvimi.
 * Her gün iki katman: piyasa değeri bilinen büyük şirketler "Öne Çıkanlar"
 * kartlarında; kalan yüzlerce sembol açılış öncesi / kapanış sonrası
 * gruplarında kompakt chip bulutu olarak. Kalabalık liste yok.
 */

const SPOTLIGHT_COUNT = 6;

export default async function EarningsPage(props: PageProps<"/bilancolar">) {
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

  const meta = await getSymbolNames([...new Set(rows.map((r) => r.symbol))]);
  const watchSet = new Set(userSymbols);

  const byDay = new Map<string, EarningsRow[]>();
  for (const row of rows) {
    const list = byDay.get(row.reportDate) ?? [];
    list.push(row);
    byDay.set(row.reportDate, list);
  }

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
              "min-h-[36px] rounded-full border px-4 py-1.5 text-sm transition-colors",
              onlyWatchlist
                ? "border-transparent bg-primary font-medium text-white"
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
          <DaySection
            key={date}
            date={date}
            rows={dayRows}
            meta={meta}
            watchSet={watchSet}
            locale={locale}
            t={t}
          />
        ))
      )}
    </div>
  );
}

function DaySection({
  date,
  rows,
  meta,
  watchSet,
  locale,
  t,
}: {
  date: string;
  rows: EarningsRow[];
  meta: Record<string, SymbolMeta>;
  watchSet: Set<string>;
  locale: Locale;
  t: Dictionary;
}) {
  // Piyasa değeri bilinenler büyükten küçüğe; ilk N tanesi öne çıkar.
  const known = rows
    .filter((row) => meta[row.symbol]?.marketCap)
    .sort(
      (a, b) =>
        (meta[b.symbol]?.marketCap ?? 0) - (meta[a.symbol]?.marketCap ?? 0),
    );
  const spotlight = known.slice(0, SPOTLIGHT_COUNT);
  const spotlightSet = new Set(spotlight.map((row) => row.symbol));
  const rest = rows.filter((row) => !spotlightSet.has(row.symbol));

  const bmo = rest.filter((row) => row.hour === "bmo");
  const amc = rest.filter((row) => row.hour === "amc");
  const other = rest.filter((row) => row.hour !== "bmo" && row.hour !== "amc");

  const hourLabel: Record<string, string> = {
    bmo: t.earnings.beforeOpen,
    amc: t.earnings.afterClose,
    dmh: t.earnings.duringMarket,
  };

  return (
    <section aria-label={date}>
      {/* Gün başlığı — takvim yaprağı gibi */}
      <div className="mb-3 flex items-baseline gap-3">
        <h2 className="text-lg font-semibold text-strong">
          {formatEtDateLong(date, locale)}
        </h2>
        <span className="numeral rounded-full bg-primary-wash px-2.5 py-0.5 text-xs font-semibold text-primary">
          {rows.length} {t.earnings.companiesCount}
        </span>
      </div>

      {/* Öne çıkanlar — market cap kartları */}
      {spotlight.length > 0 && (
        <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {spotlight.map((row) => {
            const m = meta[row.symbol];
            return (
              <Link key={row.id} href={`/hisse/${row.symbol}`} className="group">
                <Panel className="panel-hover flex h-full flex-col gap-2 p-3.5">
                  <div className="flex items-start justify-between gap-2">
                    {m?.logoUrl ? (
                      <Image
                        src={m.logoUrl}
                        alt=""
                        width={30}
                        height={30}
                        className="rounded-md border border-line-soft bg-white object-contain p-0.5"
                      />
                    ) : (
                      <span
                        aria-hidden
                        className="numeral flex size-[30px] items-center justify-center rounded-md bg-primary-wash text-[10px] font-bold text-primary"
                      >
                        {row.symbol.slice(0, 2)}
                      </span>
                    )}
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-medium",
                        row.hour === "bmo"
                          ? "bg-brass-wash text-impact-med"
                          : "bg-primary-wash text-primary",
                      )}
                    >
                      {row.hour
                        ? (hourLabel[row.hour] ?? t.earnings.timeUnknown)
                        : t.earnings.timeUnknown}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="numeral text-sm font-bold text-strong">
                      {row.symbol}
                      {watchSet.has(row.symbol) && (
                        <span aria-hidden className="ml-1 text-brass">★</span>
                      )}
                    </p>
                    <p className="truncate text-[11px] leading-tight text-soft">
                      {m?.name ?? ""}
                    </p>
                  </div>
                  <div className="mt-auto flex items-baseline justify-between border-t border-line-soft pt-2 text-[11px]">
                    <span className="text-muted">
                      {m?.marketCap ? `$${formatCompact(m.marketCap, locale)}` : ""}
                    </span>
                    {row.epsEstimate !== null && (
                      <span className="numeral text-soft">
                        EPS {formatPrice(row.epsEstimate, locale)}
                      </span>
                    )}
                  </div>
                </Panel>
              </Link>
            );
          })}
        </div>
      )}

      {/* Kalanlar — BMO/AMC gruplu kompakt chip bulutu */}
      {rest.length > 0 && (
        <Panel className="px-4 py-3.5 sm:px-5">
          <div className="flex flex-col gap-3">
            {[
              { label: t.earnings.beforeOpen, list: bmo, tone: "brass" },
              { label: t.earnings.afterClose, list: amc, tone: "primary" },
              { label: t.earnings.timeUnknown, list: other, tone: "flat" },
            ]
              .filter((group) => group.list.length > 0)
              .map((group) => (
                <div key={group.label} className="flex flex-col gap-1.5">
                  <p className="flex items-center gap-1.5 text-[11px] font-medium text-muted">
                    <span
                      aria-hidden
                      className={cn(
                        "size-1.5 rounded-full",
                        group.tone === "brass"
                          ? "bg-brass"
                          : group.tone === "primary"
                            ? "bg-primary"
                            : "bg-flat",
                      )}
                    />
                    {spotlight.length > 0 ? t.earnings.alsoReporting : ""}{" "}
                    {group.label}
                    <span className="numeral">({group.list.length})</span>
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {group.list.map((row) => (
                      <Link
                        key={row.id}
                        href={`/hisse/${row.symbol}`}
                        className={cn(
                          "numeral rounded-md border border-line-soft bg-surface px-2 py-1 text-xs font-medium text-body transition-colors hover:border-primary-faint hover:bg-primary-tint hover:text-primary",
                          watchSet.has(row.symbol) &&
                            "border-brass/40 bg-brass-wash text-impact-med",
                        )}
                      >
                        {row.symbol}
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
          </div>
        </Panel>
      )}

      <div className="mt-5" />
    </section>
  );
}
