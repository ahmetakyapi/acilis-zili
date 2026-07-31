import Image from "next/image";
import Link from "next/link";
import { ChangePill, DataStamp, EmptyState, Panel } from "@/components/ui/primitives";
import { getCompanies, getStatus } from "@/lib/data";
import { getI18n } from "@/lib/i18n";
import { getQuotes } from "@/lib/providers";
import { cn, formatCompact, formatPrice, formatVolume } from "@/lib/utils";

/**
 * Şirketler — sektör kategorileri + kolon başlığından sıralama.
 * Sıralama URL'de yaşar (?sirala=cap&yon=desc): sunucuda çözülür, JS gerekmez;
 * aynı kolona ikinci tıklama yönü çevirir.
 */

const SORT_KEYS = ["cap", "hacim", "fiyat", "degisim"] as const;
type SortKey = (typeof SORT_KEYS)[number];
type SortDir = "asc" | "desc";

/**
 * Kategori şeridinin öncelik sırası — takip edilen evrenin ağırlık merkezi
 * (yarı iletken, teknoloji, enerji...) önde durur; listede olmayan sektörler
 * alfabetik olarak arkaya eklenir.
 */
const SECTOR_PRIORITY = [
  "Semiconductors",
  "Technology",
  "Media",
  "Energy",
  "Financial Services",
  "Banking",
  "Retail",
  "Automobiles",
  "Pharmaceuticals",
  "Health Care",
  "Biotechnology",
  "Aerospace & Defense",
] as const;

function orderSectors(sectors: string[]): string[] {
  const rank = new Map<string, number>(
    SECTOR_PRIORITY.map((name, index) => [name.toLowerCase(), index]),
  );
  return [...sectors].sort((a, b) => {
    const ra = rank.get(a.toLowerCase()) ?? Infinity;
    const rb = rank.get(b.toLowerCase()) ?? Infinity;
    if (ra !== rb) return ra - rb;
    return a.localeCompare(b);
  });
}

function SortHead({
  col,
  label,
  href,
  active,
  dir,
  className,
}: {
  col: SortKey;
  label: string;
  href: string;
  active: boolean;
  dir: SortDir;
  className?: string;
}) {
  return (
    <th
      key={col}
      className={cn("px-3 py-2.5 text-right font-medium", className)}
    >
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

export default async function CompaniesPage(props: PageProps<"/sirketler">) {
  const search = await props.searchParams;
  const sort: SortKey = SORT_KEYS.includes(search.sirala as SortKey)
    ? (search.sirala as SortKey)
    : "cap";
  const dir: SortDir = search.yon === "asc" ? "asc" : "desc";
  const sectorFilter = typeof search.sektor === "string" ? search.sektor : null;

  const { locale, t } = await getI18n();
  const companies = await getCompanies();

  // Sektör → şirket sayısı; şerit önem sırasına göre dizilir.
  const sectorCounts = new Map<string, number>();
  for (const company of companies) {
    if (!company.industry) continue;
    sectorCounts.set(
      company.industry,
      (sectorCounts.get(company.industry) ?? 0) + 1,
    );
  }
  const sectors = orderSectors([...sectorCounts.keys()]);

  let rows = sectorFilter
    ? companies.filter((c) => c.industry === sectorFilter)
    : companies;

  const status = await getStatus();
  const quotesResult = await getQuotes(
    rows.map((r) => r.symbol),
    status,
  );
  const quotes = quotesResult.ok ? quotesResult.data : {};

  const valueOf = (row: (typeof rows)[number]): number => {
    const quote = quotes[row.symbol];
    switch (sort) {
      case "fiyat":
        return quote?.price ?? -Infinity;
      case "degisim":
        return quote?.changePct ?? -Infinity;
      case "hacim":
        return quote?.volume ?? row.volume ?? -Infinity;
      default:
        return row.marketCap ?? -Infinity;
    }
  };

  rows = [...rows].sort((a, b) =>
    dir === "asc" ? valueOf(a) - valueOf(b) : valueOf(b) - valueOf(a),
  );

  const sortHref = (key: SortKey) => {
    // Aynı kolona tekrar tıklanınca yön değişir; yeni kolonda desc başlar.
    const nextDir: SortDir = sort === key && dir === "desc" ? "asc" : "desc";
    const params = new URLSearchParams({ sirala: key, yon: nextDir });
    if (sectorFilter) params.set("sektor", sectorFilter);
    return `/sirketler?${params.toString()}`;
  };

  const sectorHref = (value: string | null) => {
    const params = new URLSearchParams({ sirala: sort, yon: dir });
    if (value) params.set("sektor", value);
    return `/sirketler?${params.toString()}`;
  };

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="notched inline-block text-2xl font-semibold sm:text-3xl">
          {t.companies.title}
        </h1>
        <p className="mt-2 text-sm text-soft">{t.companies.subtitle}</p>
      </header>

      {/* Kategori şeridi — kaydırılabilir olduğu kenar solmasıyla belli olur */}
      {sectors.length > 0 && (
        <div className="relative">
          <div className="scroll-x-hint flex items-center gap-1.5 pb-1 pr-12">
            <Link
              href={sectorHref(null)}
              className={cn(
                "min-h-[34px] shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors",
                !sectorFilter
                  ? "bg-primary text-white shadow-sm"
                  : "border border-line bg-surface text-soft hover:border-line-strong hover:text-strong",
              )}
            >
              {t.companies.allSectors}
              <span
                className={cn(
                  "numeral ml-1.5",
                  !sectorFilter ? "text-white/70" : "text-muted",
                )}
              >
                {companies.length}
              </span>
            </Link>
            {sectors.map((sector) => {
              const active = sector === sectorFilter;
              return (
                <Link
                  key={sector}
                  href={sectorHref(active ? null : sector)}
                  className={cn(
                    "min-h-[34px] shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors",
                    active
                      ? "bg-primary text-white shadow-sm"
                      : "border border-line bg-surface text-soft hover:border-line-strong hover:text-strong",
                  )}
                >
                  {sector}
                  <span
                    className={cn(
                      "numeral ml-1.5",
                      active ? "text-white/70" : "text-muted",
                    )}
                  >
                    {sectorCounts.get(sector)}
                  </span>
                </Link>
              );
            })}
          </div>
          {/* Sağ kenar solması — devamı olduğunu söyler */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 right-0 w-14 bg-gradient-to-l from-(--page-bg) to-transparent"
          />
        </div>
      )}

      <Panel>
        {rows.length === 0 ? (
          <EmptyState title={t.companies.empty} hint={t.companies.emptyHint} />
        ) : (
          <div className="scroll-x">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-line-soft text-left text-[10px] uppercase tracking-wider text-muted">
                  <th className="w-10 px-4 py-2.5 font-medium sm:px-5">#</th>
                  <th className="px-3 py-2.5 font-medium">{t.companies.company}</th>
                  <th className="hidden px-3 py-2.5 font-medium md:table-cell">
                    {t.companies.sector}
                  </th>
                  <SortHead
                    col="fiyat"
                    label={t.companies.price}
                    href={sortHref("fiyat")}
                    active={sort === "fiyat"}
                    dir={dir}
                  />
                  <SortHead
                    col="degisim"
                    label={t.companies.change}
                    href={sortHref("degisim")}
                    active={sort === "degisim"}
                    dir={dir}
                  />
                  <SortHead
                    col="cap"
                    label={t.market.marketCap}
                    href={sortHref("cap")}
                    active={sort === "cap"}
                    dir={dir}
                  />
                  <SortHead
                    col="hacim"
                    label={t.market.volume}
                    href={sortHref("hacim")}
                    active={sort === "hacim"}
                    dir={dir}
                    className="hidden sm:table-cell sm:px-5"
                  />
                </tr>
              </thead>
              <tbody className="divide-y divide-line-soft">
                {rows.map((company, index) => {
                  const quote = quotes[company.symbol];
                  return (
                    <tr
                      key={company.symbol}
                      className="transition-colors hover:bg-primary-tint"
                    >
                      <td className="numeral px-4 py-2.5 text-xs text-muted sm:px-5">
                        {index + 1}
                      </td>
                      <td className="px-3 py-2.5">
                        <Link
                          href={`/hisse/${company.symbol}`}
                          className="flex items-center gap-2.5"
                        >
                          {company.logoUrl ? (
                            <Image
                              src={company.logoUrl}
                              alt=""
                              width={26}
                              height={26}
                              className="rounded-md border border-line-soft bg-white object-contain p-0.5"
                            />
                          ) : (
                            <span
                              aria-hidden
                              className="numeral flex size-[26px] items-center justify-center rounded-md bg-primary-wash text-[9px] font-bold text-primary"
                            >
                              {company.symbol.slice(0, 2)}
                            </span>
                          )}
                          <span className="min-w-0">
                            <span className="numeral block font-semibold text-strong">
                              {company.symbol}
                            </span>
                            <span className="block max-w-44 truncate text-xs text-soft">
                              {company.name}
                            </span>
                          </span>
                        </Link>
                      </td>
                      <td className="hidden max-w-40 truncate px-3 py-2.5 text-xs text-soft md:table-cell">
                        {company.industry ?? "—"}
                      </td>
                      <td className="numeral px-3 py-2.5 text-right text-body">
                        {quote ? formatPrice(quote.price, locale) : "—"}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        {quote ? (
                          <ChangePill
                            changePct={quote.changePct}
                            locale={locale}
                            size="sm"
                          />
                        ) : (
                          <span className="text-xs text-muted">—</span>
                        )}
                      </td>
                      <td className="numeral px-3 py-2.5 text-right text-body">
                        {company.marketCap
                          ? `$${formatCompact(company.marketCap, locale)}`
                          : "—"}
                      </td>
                      <td className="numeral hidden px-4 py-2.5 text-right text-soft sm:table-cell sm:px-5">
                        {formatVolume(quote?.volume ?? company.volume, locale)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {quotesResult.ok && (
        <DataStamp
          source={quotesResult.source}
          at={quotesResult.fetchedAt}
          stale={quotesResult.stale}
          locale={locale}
        />
      )}
    </div>
  );
}
