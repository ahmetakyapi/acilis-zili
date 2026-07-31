import Link from "next/link";
import { redirect } from "next/navigation";
import { Trash2 } from "lucide-react";
import { auth } from "@/auth";
import {
  addSymbolToList,
  createWatchlist,
  deleteWatchlist,
  removeSymbolFromList,
} from "@/app/actions/watchlist";
import {
  Button,
  ChangePill,
  DataStamp,
  EmptyState,
  Panel,
  PanelHeader,
} from "@/components/ui/primitives";
import { getStatus, getSymbolNames, getUserWatchlists } from "@/lib/data";
import { getI18n } from "@/lib/i18n";
import { getQuotes } from "@/lib/providers";
import { cn, formatPrice } from "@/lib/utils";

const LIST_COLOR_CLASS: Record<string, string> = {
  primary: "bg-primary",
  brass: "bg-brass",
  up: "bg-up",
  down: "bg-down",
  flat: "bg-flat",
};

export default async function WatchlistPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/giris?devam=/favoriler");

  const { locale, t } = await getI18n();
  const lists = await getUserWatchlists(session.user.id);

  const allSymbols = [...new Set(lists.flatMap((l) => l.items.map((i) => i.symbol)))];
  const status = await getStatus();
  const [quotesResult, names] = await Promise.all([
    allSymbols.length > 0
      ? getQuotes(allSymbols, status)
      : Promise.resolve(null),
    getSymbolNames(allSymbols),
  ]);

  const quotes = quotesResult?.ok ? quotesResult.data : {};

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="notched inline-block text-2xl font-semibold sm:text-3xl">
            {t.watchlist.title}
          </h1>
          <p className="mt-2 text-sm text-soft">{t.watchlist.subtitle}</p>
        </div>
      </header>

      {/* Yeni liste */}
      <Panel className="p-4 sm:p-5">
        <form action={createWatchlist} className="flex flex-wrap items-end gap-3">
          <label className="flex min-w-48 flex-1 flex-col gap-1.5">
            <span className="text-xs font-medium text-soft">
              {t.watchlist.newListName}
            </span>
            <input
              name="name"
              required
              maxLength={40}
              placeholder={t.watchlist.listNamePlaceholder}
              className="h-10 rounded-(--radius-sm) border border-line bg-surface px-3 text-sm text-strong outline-none transition-colors placeholder:text-muted focus:border-line-focus"
            />
          </label>
          <fieldset className="flex items-center gap-1.5 pb-1">
            <legend className="sr-only">{t.watchlist.color}</legend>
            {Object.entries(LIST_COLOR_CLASS).map(([value, cls], index) => (
              <label key={value} className="cursor-pointer">
                <input
                  type="radio"
                  name="color"
                  value={value}
                  defaultChecked={index === 0}
                  className="peer sr-only"
                />
                <span
                  className={cn(
                    "block size-6 rounded-full border-2 border-transparent transition-all peer-checked:border-(--text-strong) peer-focus-visible:ring-2 peer-focus-visible:ring-(--line-focus)",
                    cls,
                  )}
                  title={value}
                />
              </label>
            ))}
          </fieldset>
          <Button type="submit">{t.watchlist.createList}</Button>
        </form>
      </Panel>

      {lists.length === 0 ? (
        <Panel>
          <EmptyState title={t.watchlist.emptyAll} hint={t.watchlist.emptyAllHint} />
        </Panel>
      ) : (
        lists.map((list) => (
          <Panel key={list.id}>
            <PanelHeader
              title={list.name}
              action={
                <div className="flex items-center gap-2">
                  <span
                    aria-hidden
                    className={cn(
                      "size-2.5 rounded-full",
                      LIST_COLOR_CLASS[list.color] ?? "bg-primary",
                    )}
                  />
                  <form action={deleteWatchlist}>
                    <input type="hidden" name="listId" value={list.id} />
                    <button
                      type="submit"
                      aria-label={`${t.watchlist.deleteList}: ${list.name}`}
                      title={t.watchlist.deleteList}
                      className="inline-flex size-7 items-center justify-center rounded-(--radius-sm) text-muted transition-colors hover:bg-down-wash hover:text-down"
                    >
                      <Trash2 size={14} />
                    </button>
                  </form>
                </div>
              }
            />

            {list.items.length === 0 ? (
              <EmptyState title={t.watchlist.empty} />
            ) : (
              <div className="scroll-x">
                <table className="w-full min-w-[480px] text-sm">
                  <thead>
                    <tr className="border-b border-line-soft text-left text-[10px] uppercase tracking-wider text-muted">
                      <th className="px-4 py-2 font-medium sm:px-5">Sembol</th>
                      <th className="px-3 py-2 font-medium" />
                      <th className="px-3 py-2 text-right font-medium">
                        {t.market.lastPrice}
                      </th>
                      <th className="px-3 py-2 text-right font-medium">
                        {t.market.change}
                      </th>
                      <th className="w-10 px-3 py-2" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line-soft">
                    {list.items.map((item) => {
                      const quote = quotes[item.symbol];
                      return (
                        <tr
                          key={item.id}
                          className="transition-colors hover:bg-surface-elevated"
                        >
                          <td className="px-4 py-2.5 sm:px-5">
                            <Link
                              href={`/hisse/${item.symbol}`}
                              className="numeral font-semibold text-strong hover:text-primary"
                            >
                              {item.symbol}
                            </Link>
                          </td>
                          <td className="max-w-40 truncate px-3 py-2.5 text-xs text-soft">
                            {names[item.symbol]?.name ?? ""}
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
                          <td className="px-3 py-2.5 text-right">
                            <form action={removeSymbolFromList}>
                              <input type="hidden" name="itemId" value={item.id} />
                              <button
                                type="submit"
                                aria-label={`${t.stock.removeFromWatchlist}: ${item.symbol}`}
                                className="inline-flex size-7 items-center justify-center rounded-(--radius-sm) text-muted transition-colors hover:bg-down-wash hover:text-down"
                              >
                                <Trash2 size={13} />
                              </button>
                            </form>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Sembol ekle */}
            <form
              action={addSymbolToList}
              className="flex items-center gap-2 border-t border-line-soft px-4 py-3 sm:px-5"
            >
              <input type="hidden" name="listId" value={list.id} />
              <input
                name="symbol"
                required
                placeholder={t.watchlist.symbolPlaceholder}
                pattern="[A-Za-z.\-]{1,10}"
                className="numeral h-9 w-40 rounded-(--radius-sm) border border-line bg-surface px-3 text-sm uppercase text-strong outline-none transition-colors placeholder:normal-case placeholder:text-muted focus:border-line-focus"
                autoComplete="off"
                spellCheck={false}
              />
              <Button type="submit" variant="ghost" size="sm">
                {t.common.add}
              </Button>
            </form>
          </Panel>
        ))
      )}

      {quotesResult && quotesResult.ok && allSymbols.length > 0 && (
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
