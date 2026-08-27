import { GuideHint } from "@/components/article/GuideHint";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import {
  WatchlistBoard,
  type BoardLabels,
  type BoardQuote,
} from "@/components/watchlist/WatchlistBoard";
import { DataStamp, PageHeader } from "@/components/ui/primitives";
import { getStatus, getSymbolNames, getUserWatchlists } from "@/lib/data";
import { getI18n } from "@/lib/i18n";
import { getQuotes } from "@/lib/providers";

import { pageMetadata } from "@/lib/page-meta";

/* KİŞİSEL/OTURUM SAYFASI — DİZİNE GİRMEZ. robots.txt'te `Disallow` vardı ama
   o yalnızca taramayı engelliyor, indekslemeyi değil; üstelik engellenen bir
   sayfanın `noindex` etiketi hiç okunamıyordu. Engel kaldırıldı, etiket
   buraya kondu. */
export const generateMetadata = pageMetadata({
  path: "/favoriler",
  robots: { index: false, follow: false },
  tr: { title: "Favorilerim", description: "Kategorilere ayrılmış takip listelerin." },
  en: { title: "My Watchlists", description: "Your watchlists, grouped the way you want." },
});

export default async function WatchlistPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/giris?devam=/favoriler");

  const { locale, t } = await getI18n();
  const lists = await getUserWatchlists(session.user.id);

  const allSymbols = [
    ...new Set(lists.flatMap((l) => l.items.map((i) => i.symbol))),
  ];
  const status = await getStatus();
  const [quotesResult, names] = await Promise.all([
    allSymbols.length > 0
      ? getQuotes(allSymbols, status)
      : Promise.resolve(null),
    getSymbolNames(allSymbols),
  ]);

  const quotes: Record<string, BoardQuote> = {};
  if (quotesResult?.ok) {
    for (const [symbol, quote] of Object.entries(quotesResult.data)) {
      if (quote) {
        quotes[symbol] = { price: quote.price, changePct: quote.changePct };
      }
    }
  }

  const nameMap: Record<string, string> = {};
  /* Logo, favori satırını sitedeki diğer listelerle aynı dile sokuyor:
     şirketler tablosu, endeks bileşenleri ve yaklaşan bilançolar hep
     `symbols.logo_url`'den besleniyordu, favoriler tek istisnaydı ve
     bu yüzden düz bir sembol sütunu gibi duruyordu. */
  const logoMap: Record<string, string> = {};
  for (const symbol of allSymbols) {
    const meta = names[symbol];
    if (meta?.name) nameMap[symbol] = meta.name;
    if (meta?.logoUrl) logoMap[symbol] = meta.logoUrl;
  }

  const labels: BoardLabels = {
    newList: t.watchlist.newList,
    newListName: t.watchlist.newListName,
    listNamePlaceholder: t.watchlist.listNamePlaceholder,
    createList: t.watchlist.createList,
    deleteList: t.watchlist.deleteList,
    removeSymbol: t.watchlist.removeSymbol,
    colorLegend: t.watchlist.colorLegend,
    colorNames: t.watchlist.colorNames,
    deleteListConfirm: t.watchlist.deleteListConfirm,
    addSymbol: t.watchlist.addSymbol,
    symbolPlaceholder: t.watchlist.symbolPlaceholder,
    empty: t.watchlist.empty,
    emptyAll: t.watchlist.emptyAll,
    emptyAllHint: t.watchlist.emptyAllHint,
    noResults: t.stock.notFound,
    moveUp: t.watchlist.moveUp,
    moveDown: t.watchlist.moveDown,
    cancel: t.common.cancel,
    alreadyInList: t.watchlist.alreadyInList,
    renameList: t.watchlist.renameList,
    save: t.common.save,
    dragHint: t.watchlist.dragHint,
  };

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title={t.watchlist.title} subtitle={t.watchlist.subtitle} />

      <WatchlistBoard
        lists={lists.map((list) => ({
          id: list.id,
          name: list.name,
          color: list.color,
          items: list.items.map((item) => ({ id: item.id, symbol: item.symbol })),
        }))}
        quotes={quotes}
        names={nameMap}
        logos={logoMap}
        locale={locale}
        labels={labels}
      />

      {quotesResult?.ok && allSymbols.length > 0 && (
        <DataStamp
          labels={t.data}
          source={quotesResult.source}
          at={quotesResult.fetchedAt}
          stale={quotesResult.stale}
          locale={locale}
        />
      )}

      <GuideHint
        label={t.guide.contextLabel}
        locale={locale}
        slugs={["risk-yonetimi", "cesitlendirme"]}
        className="pt-1"
      />
    </div>
  );
}
