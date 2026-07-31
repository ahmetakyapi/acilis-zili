import Image from "next/image";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { auth } from "@/auth";
import { EmptyState, Panel } from "@/components/ui/primitives";
import { getEarningsBetween, getSymbolNames, getUserSymbols } from "@/lib/data";
import { addEtDays, todayEt } from "@/lib/market-hours";
import { getI18n, type Dictionary, type Locale } from "@/lib/i18n";
import { cn, formatCompact, formatEtDateLong, formatPrice } from "@/lib/utils";
import type { EarningsRow } from "@/lib/schema";
import type { SymbolMeta } from "@/lib/data";

/**
 * Bilanço takvimi — dikkat hiyerarşisi üç katmanlıdır:
 *   1. Dev şirketler (≥$100Mr) gün başında büyük yatay kartlarda
 *   2. Büyükler (piyasa değeri bilinen sonraki 6) orta kart ızgarasında
 *   3. Kalan yüzlerce sembol varsayılan KAPALI bir açılır bölümde —
 *      kalabalık ilk bakışta görünmez, isteyen açar (native <details>).
 */

const HERO_MIN_CAP = 100e9;
const HERO_COUNT = 2;
const MID_COUNT = 6;

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
    <div className="flex flex-col gap-6">
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

function hourBadge(hour: string | null, t: Dictionary) {
  const label =
    hour === "bmo"
      ? t.earnings.beforeOpen
      : hour === "amc"
        ? t.earnings.afterClose
        : hour === "dmh"
          ? t.earnings.duringMarket
          : t.earnings.timeUnknown;
  const cls =
    hour === "bmo"
      ? "bg-brass-wash text-impact-med"
      : hour === "amc"
        ? "bg-primary-wash text-primary"
        : "bg-surface-sunken text-muted";
  return { label, cls };
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
  const known = rows
    .filter((row) => meta[row.symbol]?.marketCap)
    .sort(
      (a, b) =>
        (meta[b.symbol]?.marketCap ?? 0) - (meta[a.symbol]?.marketCap ?? 0),
    );

  const heroes = known
    .filter((row) => (meta[row.symbol]?.marketCap ?? 0) >= HERO_MIN_CAP)
    .slice(0, HERO_COUNT);
  const heroSet = new Set(heroes.map((row) => row.symbol));

  const mid = known
    .filter((row) => !heroSet.has(row.symbol))
    .slice(0, MID_COUNT);
  const midSet = new Set(mid.map((row) => row.symbol));

  const rest = rows.filter(
    (row) => !heroSet.has(row.symbol) && !midSet.has(row.symbol),
  );
  const bmo = rest.filter((row) => row.hour === "bmo");
  const amc = rest.filter((row) => row.hour === "amc");
  const other = rest.filter((row) => row.hour !== "bmo" && row.hour !== "amc");

  return (
    <section aria-label={date} className="flex flex-col gap-3">
      <div className="flex items-baseline gap-3">
        <h2 className="text-lg font-semibold text-strong">
          {formatEtDateLong(date, locale)}
        </h2>
        <span className="numeral text-xs text-muted">
          {rows.length} {t.earnings.companiesCount}
        </span>
      </div>

      {/* Katman 1 — dev şirketler, tam genişlik */}
      {heroes.map((row) => {
        const m = meta[row.symbol];
        const badge = hourBadge(row.hour, t);
        return (
          <Link key={row.id} href={`/hisse/${row.symbol}`} className="group block">
            <Panel className="panel-hover flex items-center gap-4 border-l-[3px] border-l-brass p-4 sm:gap-5 sm:p-5">
              {m?.logoUrl ? (
                <Image
                  src={m.logoUrl}
                  alt=""
                  width={52}
                  height={52}
                  className="rounded-(--radius-md) border border-line-soft bg-white object-contain p-1"
                />
              ) : (
                <span
                  aria-hidden
                  className="numeral flex size-[52px] items-center justify-center rounded-(--radius-md) bg-primary-wash text-sm font-bold text-primary"
                >
                  {row.symbol.slice(0, 2)}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2">
                  <span className="numeral text-lg font-bold text-strong">
                    {row.symbol}
                  </span>
                  {watchSet.has(row.symbol) && (
                    <span aria-hidden className="text-brass">★</span>
                  )}
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[10px] font-medium",
                      badge.cls,
                    )}
                  >
                    {badge.label}
                  </span>
                </p>
                <p className="truncate text-sm text-soft">{m?.name ?? ""}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="numeral text-base font-bold text-strong">
                  ${formatCompact(m?.marketCap ?? 0, locale)}
                </p>
                {row.epsEstimate !== null && (
                  <p className="numeral text-xs text-muted">
                    {t.earnings.epsEstimate}{" "}
                    <span className="text-soft">
                      {formatPrice(row.epsEstimate, locale)}
                    </span>
                  </p>
                )}
              </div>
            </Panel>
          </Link>
        );
      })}

      {/* Katman 2 — büyükler, kart ızgarası */}
      {mid.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {mid.map((row) => {
            const m = meta[row.symbol];
            const badge = hourBadge(row.hour, t);
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
                        badge.cls,
                      )}
                    >
                      {badge.label}
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
                    <span className="numeral text-muted">
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

      {/* Katman 3 — kalanlar, varsayılan kapalı */}
      {rest.length > 0 && (
        <details className="group/details">
          <summary className="flex min-h-[40px] cursor-pointer list-none items-center gap-2 rounded-(--radius-md) px-1 py-1.5 text-sm text-muted transition-colors hover:text-soft [&::-webkit-details-marker]:hidden">
            <ChevronDown
              size={15}
              className="transition-transform group-open/details:rotate-180"
            />
            {t.earnings.alsoReporting}
            <span className="numeral">({rest.length})</span>
          </summary>
          <Panel className="mt-1 px-4 py-3.5 sm:px-5">
            <div className="flex flex-col gap-3">
              {[
                { label: t.earnings.beforeOpen, list: bmo, dot: "bg-brass" },
                { label: t.earnings.afterClose, list: amc, dot: "bg-primary" },
                { label: t.earnings.timeUnknown, list: other, dot: "bg-flat" },
              ]
                .filter((group) => group.list.length > 0)
                .map((group) => (
                  <div key={group.label} className="flex flex-col gap-1.5">
                    <p className="flex items-center gap-1.5 text-[11px] font-medium text-muted">
                      <span
                        aria-hidden
                        className={cn("size-1.5 rounded-full", group.dot)}
                      />
                      {group.label}
                      <span className="numeral">({group.list.length})</span>
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {group.list.map((row) => (
                        <Link
                          key={row.id}
                          href={`/hisse/${row.symbol}`}
                          className={cn(
                            "numeral rounded-md border border-line-soft bg-surface px-2 py-1 text-xs font-medium text-soft transition-colors hover:border-primary-faint hover:bg-primary-tint hover:text-primary",
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
        </details>
      )}
    </section>
  );
}
