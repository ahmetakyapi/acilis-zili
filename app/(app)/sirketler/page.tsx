import Image from "next/image";
import Link from "next/link";
import { ChangePill, DataStamp, EmptyState, Panel } from "@/components/ui/primitives";
import { getCompanies, getStatus } from "@/lib/data";
import { getI18n } from "@/lib/i18n";
import { getQuotes } from "@/lib/providers";
import { cn, formatCompact, formatPrice, formatVolume } from "@/lib/utils";

const SORTS = ["cap", "hacim"] as const;
type Sort = (typeof SORTS)[number];

export default async function CompaniesPage(props: PageProps<"/sirketler">) {
  const search = await props.searchParams;
  const sort: Sort = search.sirala === "hacim" ? "hacim" : "cap";
  const sectorFilter = typeof search.sektor === "string" ? search.sektor : null;

  const { locale, t } = await getI18n();
  const companies = await getCompanies();

  // Sektör listesi filtre uygulanmadan çıkarılır — chip'ler hep tam görünür.
  const sectors = [
    ...new Set(companies.map((c) => c.industry).filter((v): v is string => !!v)),
  ].sort();

  let rows = sectorFilter
    ? companies.filter((c) => c.industry === sectorFilter)
    : companies;

  // Canlı fiyatlar — tek Alpaca çağrısı; hacim de buradan tazelenir.
  const status = await getStatus();
  const quotesResult = await getQuotes(
    rows.map((r) => r.symbol),
    status,
  );
  const quotes = quotesResult.ok ? quotesResult.data : {};

  rows = [...rows].sort((a, b) => {
    if (sort === "hacim") {
      const av = quotes[a.symbol]?.volume ?? a.volume ?? 0;
      const bv = quotes[b.symbol]?.volume ?? b.volume ?? 0;
      return bv - av;
    }
    return (b.marketCap ?? 0) - (a.marketCap ?? 0);
  });

  const sortHref = (value: Sort) =>
    `/sirketler?sirala=${value}${sectorFilter ? `&sektor=${encodeURIComponent(sectorFilter)}` : ""}`;
  const sectorHref = (value: string | null) =>
    value
      ? `/sirketler?sirala=${sort}&sektor=${encodeURIComponent(value)}`
      : `/sirketler?sirala=${sort}`;

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="notched inline-block text-2xl font-semibold sm:text-3xl">
          {t.companies.title}
        </h1>
        <p className="mt-2 text-sm text-soft">{t.companies.subtitle}</p>
      </header>

      {/* Sıralama + sektör kategorileri */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-1.5">
          <span className="mr-1 text-xs text-muted">{t.companies.sortBy}</span>
          {SORTS.map((value) => (
            <Link
              key={value}
              href={sortHref(value)}
              className={cn(
                "min-h-[36px] rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
                sort === value
                  ? "bg-primary text-white"
                  : "border border-line text-soft hover:border-line-strong hover:text-strong",
              )}
            >
              {value === "cap" ? t.companies.byCap : t.companies.byVolume}
            </Link>
          ))}
        </div>

        {sectors.length > 0 && (
          <div className="scroll-x flex items-center gap-1.5">
            <Link
              href={sectorHref(null)}
              className={cn(
                "min-h-[32px] shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors",
                !sectorFilter
                  ? "bg-primary-wash text-primary"
                  : "text-muted hover:bg-surface-elevated hover:text-soft",
              )}
            >
              {t.companies.allSectors}
            </Link>
            {sectors.map((sector) => (
              <Link
                key={sector}
                href={sectorHref(sector === sectorFilter ? null : sector)}
                className={cn(
                  "min-h-[32px] shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors",
                  sector === sectorFilter
                    ? "bg-primary-wash text-primary"
                    : "text-muted hover:bg-surface-elevated hover:text-soft",
                )}
              >
                {sector}
              </Link>
            ))}
          </div>
        )}
      </div>

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
                  <th className="px-3 py-2.5 text-right font-medium">
                    {t.companies.price}
                  </th>
                  <th className="px-3 py-2.5 text-right font-medium">
                    {t.companies.change}
                  </th>
                  <th className="px-3 py-2.5 text-right font-medium">
                    {t.market.marketCap}
                  </th>
                  <th className="hidden px-4 py-2.5 text-right font-medium sm:table-cell sm:px-5">
                    {t.market.volume}
                  </th>
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
