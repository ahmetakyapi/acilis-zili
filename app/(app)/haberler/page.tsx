import Link from "next/link";
import { EmptyState, Panel } from "@/components/ui/primitives";
import { NewsImage } from "@/components/news/NewsImage";
import { getGenericImageUrls, getLatestNews, getSymbolNames } from "@/lib/data";
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

  /* Kaynak logoları elenir; kalan makale görselleri küçük resim olarak durur.
     Görseli olmayan habere şirketin logosu konuyor — künye kutusunda sembol
     yazmaktansa haberin konusu olan şirketi göstermek listeyi taranabilir
     kılıyor. */
  const [genericImages, logos] = await Promise.all([
    getGenericImageUrls(items.map((item) => item.imageUrl)),
    getSymbolNames([
      ...new Set(
        items.map((item) => item.symbols?.[0]).filter((s): s is string => Boolean(s)),
      ),
    ]),
  ]);

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="display-ink w-fit text-[26px] font-bold tracking-[-0.03em] sm:text-[34px]">
          {t.news.title}
        </h1>
        <p className="mt-2 text-sm text-soft">{t.news.subtitle}</p>
      </header>

      {symbolFilter && (
        <div className="flex items-center gap-2">
          <span className="numeral rounded-full bg-primary-wash px-3 py-1 text-sm font-medium text-primary">
            {symbolFilter}
          </span>
          <Link href="/haberler" className="text-xs text-muted hover:text-soft">
            {t.common.all}
          </Link>
        </div>
      )}

      <Panel>
        {items.length === 0 ? (
          <EmptyState title={t.news.empty} />
        ) : (
          <ul className="divide-y divide-line-soft">
            {items.map((item) => (
              <li key={item.id}>
                <Link
                  href={`/haberler/${item.id}`}
                  className="flex gap-3.5 px-4 py-3.5 transition-colors hover:bg-primary-tint sm:gap-4 sm:px-5"
                >
                  <span className="min-w-0 flex-1">
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
                                "numeral rounded bg-surface-sunken px-1.5 py-0.5 text-[10px] font-medium text-soft",
                              )}
                            >
                              {symbol}
                            </span>
                          ))}
                        </span>
                      </>
                    )}
                  </p>
                  </span>

                  {/* Mobilde de görünür. Ana sayfadaki haber listesi küçük
                      resmi telefonda zaten gösteriyordu; burada gizlemek iki
                      listeyi birbirinden farklı kılıyordu ve küçük resim
                      listeyi taranabilir yapan asıl şey. */}
                  <NewsImage
                    src={
                      item.imageUrl && !genericImages.has(item.imageUrl)
                        ? item.imageUrl
                        : null
                    }
                    symbol={item.symbols?.[0] ?? null}
                    logoUrl={
                      item.symbols?.[0]
                        ? (logos[item.symbols[0]]?.logoUrl ?? null)
                        : null
                    }
                    sizeClass="size-16 sm:size-20"
                  />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
