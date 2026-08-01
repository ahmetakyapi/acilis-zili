import Link from "next/link";
import { EmptyState } from "@/components/ui/primitives";
import { getLatestNews } from "@/lib/data";
import { getI18n } from "@/lib/i18n";
import { cn, timeAgo } from "@/lib/utils";

export default async function NewsPage(props: PageProps<"/haberler">) {
  const search = await props.searchParams;
  const symbolFilter =
    typeof search.sembol === "string" ? search.sembol.toUpperCase() : null;

  const { locale, t } = await getI18n();
  let items = await getLatestNews(60);

  if (symbolFilter) {
    items = items.filter((item) => item.symbols?.includes(symbolFilter));
  }

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          {t.news.title}
        </h1>
        <p className="mt-2 text-sm text-soft">{t.news.subtitle}</p>
      </header>

      {symbolFilter && (
        <div className="flex items-center gap-2">
          <span className="numeral text-[13px] text-faint">
            {symbolFilter}
          </span>
          <Link href="/haberler" className="text-xs text-muted hover:text-soft">
            {t.common.all}
          </Link>
        </div>
      )}

      <section>
        {items.length === 0 ? (
          <EmptyState title={t.news.empty} />
        ) : (
          <ul className="divide-y divide-line-soft">
            {items.map((item) => (
              <li key={item.id}>
                <Link
                  href={`/haberler/${item.id}`}
                  className="block px-4 py-3.5 transition-colors hover:bg-primary-tint sm:px-5"
                >
                  <p className="text-sm font-medium leading-snug text-strong">
                    {locale === "tr" && item.headlineTr ? item.headlineTr : item.headline}
                  </p>
                  {(item.summaryTr || item.summary) && (
                    <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-soft">
                      {locale === "tr" && item.summaryTr ? item.summaryTr : item.summary}
                    </p>
                  )}
                  <p className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] text-muted">
                    {item.source && <span>{item.source}</span>}
                    <span aria-hidden>·</span>
                    <span>{timeAgo(item.publishedAt, locale)}</span>
                    {item.symbols && item.symbols.length > 0 && (
                      <>
                        <span aria-hidden>·</span>
                        <span className="flex gap-1">
                          {item.symbols.slice(0, 4).map((symbol) => (
                            <span
                              key={symbol}
                              className={cn(
                                "numeral text-[11px] text-faint transition-colors hover:text-up",
                              )}
                            >
                              {symbol}
                            </span>
                          ))}
                        </span>
                      </>
                    )}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
