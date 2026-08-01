import Link from "next/link";
import {
  DataStamp,
  EmptyState,
  PageHeader,
  Panel,
  PanelHeader,
} from "@/components/ui/primitives";
import {
  DOW_MEMBERS,
  INDEX_COMPOSITION_DATE,
  NDX_MEMBERS,
  SPX_MEMBERS,
  type IndexMember,
} from "@/db/seed/indices";
import { getStatus } from "@/lib/data";
import { getI18n, type Dictionary, type Locale } from "@/lib/i18n";
import { getQuotes } from "@/lib/providers";
import { getSeries } from "@/lib/providers/fred";
import type { Quote } from "@/lib/providers/types";
import {
  cn,
  directionOf,
  formatEtDateShort,
  formatPercent,
  formatPrice,
} from "@/lib/utils";

/**
 * Piyasalar — nabız ekranı.
 * Üstte ABD tahvil faizleri (2Y/10Y/30Y + 10Y−2Y farkı), altında üç büyük
 * endeksin TAM bileşen listesi. Üyelik statik (kaynak: Wikipedia bileşen
 * tabloları), kotasyonlar canlı; günün en çok hareket edenleri üstte başlar.
 */

const INDEX_TABS = [
  { key: "dow", label: "Dow Jones", members: DOW_MEMBERS },
  { key: "nasdaq", label: "Nasdaq 100", members: NDX_MEMBERS },
  { key: "sp500", label: "S&P 500", members: SPX_MEMBERS },
] as const;

type TabKey = (typeof INDEX_TABS)[number]["key"];

const SORT_KEYS = ["degisim", "fiyat", "ad"] as const;
type SortKey = (typeof SORT_KEYS)[number];
type SortDir = "asc" | "desc";

/** ABD Hazine tahvili serileri — FRED sabit vadeli getiriler. */
const YIELD_SERIES = [
  { seriesId: "DGS2", slug: "yield-2y", units: "lin", labelKey: "yieldY2" },
  { seriesId: "DGS10", slug: "yield-10y", units: "lin", labelKey: "yieldY10" },
  { seriesId: "DGS30", slug: "yield-30y", units: "lin", labelKey: "yieldY30" },
] as const;

/** Alpaca snapshot çağrısı sembol listesini paketler halinde alır. */
async function quotesFor(
  symbols: string[],
  status: Awaited<ReturnType<typeof getStatus>>,
): Promise<{ quotes: Record<string, Quote>; stampAt: Date | null }> {
  const chunks: string[][] = [];
  for (let i = 0; i < symbols.length; i += 100) {
    chunks.push(symbols.slice(i, i + 100));
  }
  const results = await Promise.all(
    chunks.map((chunk) => getQuotes(chunk, status)),
  );
  const quotes: Record<string, Quote> = {};
  let stampAt: Date | null = null;
  for (const result of results) {
    if (!result.ok) continue;
    Object.assign(quotes, result.data);
    if (!stampAt || result.fetchedAt > stampAt) stampAt = result.fetchedAt;
  }
  return { quotes, stampAt };
}

export default async function MarketsPage(props: PageProps<"/piyasalar">) {
  const search = await props.searchParams;
  const tab: TabKey = INDEX_TABS.some((t) => t.key === search.endeks)
    ? (search.endeks as TabKey)
    : "dow";
  const sort: SortKey = SORT_KEYS.includes(search.sirala as SortKey)
    ? (search.sirala as SortKey)
    : "degisim";
  const dir: SortDir = search.yon === "asc" ? "asc" : "desc";

  const { locale, t } = await getI18n();
  const active = INDEX_TABS.find((entry) => entry.key === tab)!;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        eyebrow={locale === "tr" ? "ABD Piyasası" : "US Market"}
        title={t.markets.title}
        subtitle={t.markets.subtitle}
      />

      <YieldStrip locale={locale} t={t} />

      {/* Endeks seçici */}
      <div className="flex flex-wrap items-center gap-1.5">
        {INDEX_TABS.map((entry) => {
          const activeTab = entry.key === tab;
          return (
            <Link
              key={entry.key}
              href={`/piyasalar?endeks=${entry.key}`}
              className={cn(
                "flex min-h-[38px] items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold transition-colors",
                activeTab
                  ? "bg-primary text-white shadow-sm"
                  : "border border-line bg-surface text-soft hover:border-line-strong hover:text-strong",
              )}
            >
              {entry.label}
              <span
                className={cn(
                  "numeral text-xs font-normal",
                  activeTab ? "text-white/70" : "text-muted",
                )}
              >
                {entry.members.length}
              </span>
            </Link>
          );
        })}
        <span className="numeral ml-auto text-[10px] text-muted">
          {t.markets.asOf}: {formatEtDateShort(INDEX_COMPOSITION_DATE, locale)}
        </span>
      </div>

      <MembersTable
        tab={tab}
        members={active.members}
        sort={sort}
        dir={dir}
        locale={locale}
        t={t}
      />
    </div>
  );
}

/* ==========================================================================
   Tahvil faizleri
   ========================================================================== */

async function YieldStrip({ locale, t }: { locale: Locale; t: Dictionary }) {
  const results = await Promise.all(
    YIELD_SERIES.map((series) => getSeries(series, 10)),
  );

  const values = YIELD_SERIES.map((series, index) => {
    const result = results[index];
    return {
      label: t.markets[series.labelKey],
      latest: result.ok ? result.data.latestValue : null,
      prev: result.ok ? result.data.prevValue : null,
      date: result.ok
        ? (result.data.observations.at(-1)?.date ?? null)
        : null,
    };
  });

  const y2 = values[0].latest;
  const y10 = values[1].latest;
  const spread = y2 !== null && y10 !== null ? y10 - y2 : null;

  if (values.every((v) => v.latest === null)) return null;

  return (
    <Panel>
      <PanelHeader
        title={t.markets.yields}
        action={
          spread !== null ? (
            <span
              className={cn(
                "numeral rounded-full px-2.5 py-1 text-xs font-semibold",
                spread >= 0 ? "bg-up-wash text-up" : "bg-down-wash text-down",
              )}
            >
              {t.markets.spread}: {spread >= 0 ? "+" : "−"}
              {formatPrice(Math.abs(spread), locale)} pp
            </span>
          ) : undefined
        }
      />
      <div className="grid grid-cols-3 divide-x divide-line-soft">
        {values.map((value) => {
          const delta =
            value.latest !== null && value.prev !== null
              ? value.latest - value.prev
              : null;
          return (
            <div key={value.label} className="px-4 py-3.5 sm:px-5">
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted">
                {value.label}
              </p>
              <p className="tote mt-1 text-xl sm:text-2xl">
                {value.latest !== null ? (
                  <>
                    {formatPrice(value.latest, locale)}
                    <span className="ml-1 text-sm text-soft">%</span>
                  </>
                ) : (
                  "—"
                )}
              </p>
              {delta !== null && Math.abs(delta) > 0.001 && (
                <p className="numeral mt-0.5 text-[11px] text-muted">
                  {delta > 0 ? "▲" : "▼"} {formatPrice(Math.abs(delta), locale)}
                </p>
              )}
            </div>
          );
        })}
      </div>
      {values[0].date && (
        <p className="border-t border-line-soft px-4 py-2 text-[10px] text-muted sm:px-5">
          FRED · {formatEtDateShort(values[0].date, locale)}
        </p>
      )}
    </Panel>
  );
}

/* ==========================================================================
   Bileşen tablosu
   ========================================================================== */

function sortHref(tab: TabKey, key: SortKey, sort: SortKey, dir: SortDir) {
  const nextDir: SortDir = sort === key && dir === "desc" ? "asc" : "desc";
  return `/piyasalar?endeks=${tab}&sirala=${key}&yon=${nextDir}`;
}

function SortHead({
  label,
  href,
  active,
  dir,
  className,
}: {
  label: string;
  href: string;
  active: boolean;
  dir: SortDir;
  className?: string;
}) {
  return (
    <th className={cn("px-3 py-2.5 text-right font-medium", className)}>
      <Link
        href={href}
        className={cn(
          "inline-flex items-center gap-1 transition-colors hover:text-primary",
          active && "text-primary",
        )}
      >
        {label}
        <span aria-hidden className="numeral text-[8px]">
          {active ? (dir === "desc" ? "▼" : "▲") : "▽"}
        </span>
      </Link>
    </th>
  );
}

async function MembersTable({
  tab,
  members,
  sort,
  dir,
  locale,
  t,
}: {
  tab: TabKey;
  members: readonly IndexMember[];
  sort: SortKey;
  dir: SortDir;
  locale: Locale;
  t: Dictionary;
}) {
  const status = await getStatus();
  const { quotes, stampAt } = await quotesFor(
    members.map((m) => m.symbol),
    status,
  );

  const valueOf = (member: IndexMember): number | string => {
    const quote = quotes[member.symbol];
    switch (sort) {
      case "fiyat":
        return quote?.price ?? -Infinity;
      case "ad":
        return member.name;
      default:
        return quote?.changePct ?? -Infinity;
    }
  };

  const rows = [...members].sort((a, b) => {
    const va = valueOf(a);
    const vb = valueOf(b);
    if (typeof va === "string" || typeof vb === "string") {
      const cmp = String(va).localeCompare(String(vb), "en");
      return dir === "asc" ? cmp : -cmp;
    }
    return dir === "asc" ? va - vb : vb - va;
  });

  if (rows.length === 0) {
    return (
      <Panel>
        <EmptyState title={t.common.noData} />
      </Panel>
    );
  }

  return (
    <>
      <Panel>
        <div className="scroll-x">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-line-soft text-left text-[10px] uppercase tracking-wider text-muted">
                <th className="w-10 px-4 py-2.5 font-medium sm:px-5">#</th>
                <SortHead
                  label={t.companies.company}
                  href={sortHref(tab, "ad", sort, dir)}
                  active={sort === "ad"}
                  dir={dir}
                  className="text-left"
                />
                <SortHead
                  label={t.companies.price}
                  href={sortHref(tab, "fiyat", sort, dir)}
                  active={sort === "fiyat"}
                  dir={dir}
                />
                <SortHead
                  label={t.companies.change}
                  href={sortHref(tab, "degisim", sort, dir)}
                  active={sort === "degisim"}
                  dir={dir}
                  className="sm:pr-5"
                />
              </tr>
            </thead>
            <tbody className="divide-y divide-line-soft">
              {rows.map((member, index) => {
                const quote = quotes[member.symbol];
                const tone = directionOf(quote?.changePct);
                return (
                  <tr
                    key={member.symbol}
                    className="transition-colors hover:bg-primary-tint"
                  >
                    <td className="numeral px-4 py-2 text-xs text-muted sm:px-5">
                      {index + 1}
                    </td>
                    <td className="px-3 py-2">
                      <Link
                        href={`/hisse/${member.symbol}`}
                        className="flex min-w-0 items-baseline gap-2.5"
                      >
                        <span className="numeral w-16 shrink-0 font-semibold text-strong">
                          {member.symbol}
                        </span>
                        <span className="min-w-0 truncate text-xs text-soft">
                          {member.name}
                        </span>
                      </Link>
                    </td>
                    <td className="numeral px-3 py-2 text-right text-body">
                      {quote ? formatPrice(quote.price, locale) : "—"}
                    </td>
                    <td
                      className={cn(
                        "numeral px-3 py-2 text-right font-semibold sm:pr-5",
                        tone === "up"
                          ? "text-up"
                          : tone === "down"
                            ? "text-down"
                            : "text-muted",
                      )}
                    >
                      {quote ? formatPercent(quote.changePct, locale) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>

      {stampAt && (
        <DataStamp source="alpaca" at={stampAt} locale={locale} />
      )}
    </>
  );
}
