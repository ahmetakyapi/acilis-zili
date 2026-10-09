import { MotionExperience, ScrollProgress } from "@/components/motion/PremiumMotion";
import polish from "@/components/motion/UtilityExperience.module.css";
import { GuideHint } from "@/components/article/GuideHint";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import {
  WatchlistBoard,
  type BoardLabels,
  type BoardQuote,
} from "@/components/watchlist/WatchlistBoard";
import { DataStamp, PageHeader, Panel, PanelHeader } from "@/components/ui/primitives";
import { AlertRow } from "@/components/alerts/PriceAlertButton";
import alertStyles from "@/components/alerts/PriceAlerts.module.css";
import { getUserAlerts, settleAlerts } from "@/lib/price-alerts";
import { getStatus, getSymbolNames, getUserWatchlists } from "@/lib/data";
import { getI18n } from "@/lib/i18n";
import { getQuotes } from "@/lib/providers";
import { getUsdTry } from "@/lib/providers/tcmb";
import { formatIsoDate, formatRate } from "@/lib/fx";

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
  const [lists, alertData] = await Promise.all([
    getUserWatchlists(session.user.id),
    getUserAlerts(session.user.id),
  ]);

  const listSymbols = [
    ...new Set(lists.flatMap((l) => l.items.map((i) => i.symbol))),
  ];
  /* ALARMLARIN SEMBOLLERİ AYNI İSTEKTE. Alarm favoride olmayan bir hisse
     için de kurulabiliyor; iki ayrı `getQuotes` iki ayrı anahtar ve iki
     ayrı paket demek — aynı hissenin iki farklı fiyatı yan yana durabilirdi
     (CLAUDE.md → getQuotes notu). */
  const allSymbols = [
    ...new Set([...listSymbols, ...alertData.alerts.map((alert) => alert.symbol)]),
  ];
  const status = await getStatus();
  const [quotesResult, names, fx] = await Promise.all([
    allSymbols.length > 0
      ? getQuotes(allSymbols, status)
      : Promise.resolve(null),
    getSymbolNames(allSymbols),
    /* LİRA KARŞILIĞI. Takip listesinde adet yok, yani "toplam" bir anlam
       taşımıyor (dört hissenin birer adedinin toplamı bir portföy değil);
       toplam `/portfoy`ta. Burada her fiyatın lira karşılığı var, bugünün
       TCMB döviz alış kuruyla — kur ve bülten günü sayfanın altında. */
    allSymbols.length > 0 ? getUsdTry() : Promise.resolve(null),
  ]);
  const usdTry = fx?.ok ? fx.data.buying : null;

  const quotes: Record<string, BoardQuote> = {};
  if (quotesResult?.ok) {
    for (const [symbol, quote] of Object.entries(quotesResult.data)) {
      if (quote) {
        quotes[symbol] = {
          price: quote.price,
          changePct: quote.changePct,
          priceTl: usdTry ? quote.price * usdTry : null,
        };
      }
    }
  }

  const prices: Record<string, number> = {};
  for (const [symbol, quote] of Object.entries(quotes)) prices[symbol] = quote.price;
  const alerts = await settleAlerts(
    session.user.id,
    alertData.alerts,
    prices,
    Boolean(quotesResult?.ok && !quotesResult.stale),
  );
  /* Hedefe ulaşanlar üstte: sayfaya gelme sebebi çoğu zaman onlar. */
  const sortedAlerts = [...alerts].sort(
    (a, b) => Number(Boolean(b.triggeredAt)) - Number(Boolean(a.triggeredAt)),
  );
  const alertHits = alerts.filter((alert) => alert.triggeredAt).length;

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
    searching: t.common.loading,
    searchFailed: t.common.error,
    moveUp: t.watchlist.moveUp,
    moveDown: t.watchlist.moveDown,
    cancel: t.common.cancel,
    alreadyInList: t.watchlist.alreadyInList,
    listFull: t.watchlist.listFull,
    renameList: t.watchlist.renameList,
    save: t.common.save,
    dragHint: t.watchlist.dragHint,
  };

  return (
    <MotionExperience className={`${polish.page} ${polish.watchlist}`}>
      <ScrollProgress />
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

      {alertData.available && (
        <Panel id="alarmlar" aria-label={t.priceAlerts.panelTitle} className="scroll-mt-28">
          <PanelHeader
            title={t.priceAlerts.panelTitle}
            meta={alertHits > 0 ? t.priceAlerts.hitBanner.replace("{n}", String(alertHits)) : undefined}
          />
          <div className={alertStyles.panelBody}>
            {sortedAlerts.length > 0 ? (
              <ul className={alertStyles.list}>
                {sortedAlerts.map((alert) => (
                  <AlertRow
                    key={alert.id}
                    alert={alert}
                    price={prices[alert.symbol] ?? null}
                    locale={locale}
                    labels={t.priceAlerts}
                    showSymbol
                  />
                ))}
              </ul>
            ) : (
              <p className={alertStyles.panelEmpty}>
                <strong className="text-strong">{t.priceAlerts.emptyTitle}.</strong> {t.priceAlerts.empty}
              </p>
            )}
            <p className={alertStyles.note}>{t.priceAlerts.note}</p>
          </div>
        </Panel>
      )}

      {quotesResult?.ok && fx && (
        <p className="numeral text-tiny leading-relaxed text-muted">
          {fx.ok
            ? t.lira.favorites.tlNote
                .replace("{rate}", formatRate(fx.data.buying, locale))
                .replace("{date}", formatIsoDate(fx.data.bulletinDate, locale, "long"))
            : t.lira.favorites.tlUnavailable}
        </p>
      )}

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
    </MotionExperience>
  );
}
