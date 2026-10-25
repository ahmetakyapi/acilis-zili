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
import { AlertRow, PercentAlertRow } from "@/components/alerts/PriceAlertButton";
import alertStyles from "@/components/alerts/PriceAlerts.module.css";
import { getUserPercentAlerts } from "@/lib/percent-alerts";
import { getUserAlerts } from "@/lib/price-alerts";
import { settleAlerts } from "@/lib/alert-settle";
import { getUserSubscriptions, pushPublicKey } from "@/lib/push";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { getStatus, getSymbolNames, getUserWatchlists } from "@/lib/data";
import { getI18n } from "@/lib/i18n";
import { getChartBarsMulti, getQuotes } from "@/lib/providers";
import type { Bar } from "@/lib/providers/types";
import { isSessionTrade } from "@/lib/market-hours";
import { listPulse, yearRange } from "@/lib/watchlist-visuals";
import { formatPercent } from "@/lib/utils";
import { getUsdTry } from "@/lib/providers/tcmb";
import { formatIsoDate, formatRate } from "@/lib/fx";

import { pageMetadata } from "@/lib/page-meta";
import { WatchlistToday } from "@/components/watchlist/WatchlistToday";
import pulseStyles from "@/components/watchlist/WatchlistVisuals.module.css";
import { insightsConfigured } from "@/lib/stock-insights";
import { WATCH_TODAY_MIN_COVERED } from "@/lib/watchlist-today-core";

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

/** Liste boşken bar isteği yok; boş eşleme aynı tipte. */
const NO_BARS: Record<string, Bar[]> = {};

export default async function WatchlistPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/giris?devam=/favoriler");

  const { locale, t } = await getI18n();
  const [lists, alertData, percentData, push] = await Promise.all([
    getUserWatchlists(session.user.id),
    getUserAlerts(session.user.id),
    /* Yüzde alarmları yalnızca gösterim: değerlendirme sunucu taramasında
       (gerekçe lib/schema.ts → percentAlerts). */
    getUserPercentAlerts(session.user.id),
    getUserSubscriptions(session.user.id),
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
  const [quotesResult, names, fx, dayBars, yearBars] = await Promise.all([
    allSymbols.length > 0
      ? getQuotes(allSymbols, status)
      : Promise.resolve(null),
    getSymbolNames(allSymbols),
    /* LİRA KARŞILIĞI. Takip listesinde adet yok, yani "toplam" bir anlam
       taşımıyor (dört hissenin birer adedinin toplamı bir portföy değil);
       toplam `/portfoy`ta. Burada her fiyatın lira karşılığı var, bugünün
       TCMB döviz alış kuruyla — kur ve bülten günü sayfanın altında. */
    allSymbols.length > 0 ? getUsdTry() : Promise.resolve(null),
    /* SATIR GÖRSELLERİ (25 Ekim). Ana sayfanın takip listesi özeti
       (`WatchlistSummary`) aynı listeyi günün minyatür çizgisiyle çiziyordu;
       bu sayfa ise dokuz satırda yalnız fiyat ve rozet basıyordu. İki toplu
       istek: günün 5 dakikalık barları (çizgi) ve bir yıllık günlük barlar
       (52 hafta rayı). Yalnız LİSTE sembolleri; alarm sembolü satır değil. */
    listSymbols.length > 0 ? getChartBarsMulti(listSymbols, "1D", status) : Promise.resolve(NO_BARS),
    listSymbols.length > 0 ? getChartBarsMulti(listSymbols, "1Y", status) : Promise.resolve(NO_BARS),
  ]);
  const usdTry = fx?.ok ? fx.data.buying : null;

  /* Çizgi sayıyla AYNI SEANSI anlatmalı: bayat paketle günün çizgisi
     basılmıyor (gerekçe `WatchlistSummary` → `sparkOk`). */
  const sparkOk = Boolean(quotesResult?.ok && !quotesResult.stale);
  const quotes: Record<string, BoardQuote> = {};
  if (quotesResult?.ok) {
    for (const [symbol, quote] of Object.entries(quotesResult.data)) {
      if (quote) {
        const spark = sparkOk ? dayBars[symbol]?.map((bar) => bar.close) : undefined;
        quotes[symbol] = {
          price: quote.price,
          changePct: quote.changePct,
          priceTl: usdTry ? quote.price * usdTry : null,
          spark: spark && spark.length > 1 ? spark : null,
          range: yearRange(yearBars[symbol] ?? [], quote.price),
        };
      }
    }
  }

  /* TEPE CÜMLESİ — listenin bugünü tek cümlede, veriden. Yüzde hangi
     seansı anlattığını kanıtlıyor (`listPulse`, lib/watchlist-visuals.ts). */
  const pulse = listPulse(
    listSymbols,
    Object.fromEntries(
      listSymbols.flatMap((symbol) => {
        const quote = quotesResult?.ok ? quotesResult.data[symbol] : null;
        return quote ? [[symbol, { changePct: quote.changePct, session: isSessionTrade(quote.tradedAt, status) }]] : [];
      }),
    ),
  );
  const PV = t.personalVisuals.favorites;
  const pulseText =
    listSymbols.length === 0
      ? null
      : `${(pulse.total === 1 ? PV.totalOne : PV.total).replace("{n}", String(pulse.total))}; ${
          pulse.scope === "none"
            ? PV.none
            : /* "BUGÜN" YALNIZ SEANS BUGÜNSE: hafta sonu ve tatilde seans
                 günü cuma; yüzdeler onu anlatıyor ama "bugün" cumartesi. */
              (pulse.scope === "last" || status.sessionDate !== status.etDate
                ? PV.last
                : pulse.scope === "today"
                  ? PV.today
                  : PV.partial)
                .replace("{count}", String(pulse.counted))
                .replace("{down}", String(pulse.down))
                .replace("{up}", String(pulse.up))
        }.${
          pulse.lead
            ? ` ${(pulse.lead.direction === "down" ? PV.leadDown : PV.leadUp)
                .replace("{symbol}", pulse.lead.symbol)
                .replace("{pct}", formatPercent(pulse.lead.changePct, locale))}`
            : ""
        }`;

  const prices: Record<string, number> = {};
  for (const [symbol, quote] of Object.entries(quotes)) prices[symbol] = quote.price;
  const alerts = await settleAlerts(
    session.user.id,
    alertData.alerts,
    quotesResult?.ok ? quotesResult.data : {},
    status,
    Boolean(quotesResult?.ok && !quotesResult.stale),
  );
  /* Hedefe ulaşanlar üstte: sayfaya gelme sebebi çoğu zaman onlar. */
  const sortedAlerts = [...alerts].sort(
    (a, b) => Number(Boolean(b.triggeredAt)) - Number(Boolean(a.triggeredAt)),
  );
  const sortedPercentAlerts = [...percentData.alerts].sort(
    (a, b) => Number(Boolean(b.triggeredAt)) - Number(Boolean(a.triggeredAt)),
  );
  const alertHits =
    alerts.filter((alert) => alert.triggeredAt).length +
    sortedPercentAlerts.filter((alert) => alert.triggeredAt).length;

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
    deleteListQuestion: t.watchlist.deleteListQuestion,
    deleteListHint: t.watchlist.deleteListHint,
    deleteListHintEmpty: t.watchlist.deleteListHintEmpty,
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
    listsFull: t.watchlist.listsFull,
    listNameEmpty: t.watchlist.listNameEmpty,
    noteAdd: t.watchlist.noteAdd,
    noteEdit: t.watchlist.noteEdit,
    notePlaceholder: t.watchlist.notePlaceholder,
    noteSave: t.watchlist.noteSave,
    noteFailed: t.watchlist.noteFailed,
    actionFailed: t.watchlist.actionFailed,
    renameList: t.watchlist.renameList,
    save: t.common.save,
    dragHint: t.watchlist.dragHint,
    rangeTitle: PV.rangeTitle,
    sparkTitle: PV.sparkTitle,
    edit: PV.edit,
    editDone: PV.editDone,
    editLabel: PV.editLabel,
  };

  return (
    <MotionExperience className={`${polish.page} ${polish.watchlist}`}>
      <ScrollProgress />
      <PageHeader title={t.watchlist.title} subtitle={t.watchlist.subtitle} />

      {/* Listenin bugünü tek cümlede ve satır görsellerinin anahtarı —
          ekran düzeninde başlığın altındaki künye katmanı (CLAUDE.md, 2). */}
      {pulseText && (
        <div className={pulseStyles.pulse}>
          <p className={pulseStyles.pulseText}>{pulseText}</p>
          <p className={pulseStyles.legend} aria-hidden>
            <span><i data-key="spark" />{PV.legendSpark}</span>
            <span><i data-key="range" />{PV.legendRange}</span>
          </p>
        </div>
      )}

      <WatchlistBoard
        lists={lists.map((list) => ({
          id: list.id,
          name: list.name,
          color: list.color,
          items: list.items.map((item) => ({ id: item.id, symbol: item.symbol, note: item.note })),
        }))}
        quotes={quotes}
        names={nameMap}
        logos={logoMap}
        locale={locale}
        labels={labels}
      />

      {/* TAKİP LİSTEM BUGÜN (24 Ekim) listelerin hemen altında: önce
          liste, sonra onun son seans okuması (ekran düzeni: ölçü, sonra
          metin). Gerekçe lib/watchlist-today.ts. */}
      {listSymbols.length >= WATCH_TODAY_MIN_COVERED && insightsConfigured() && (
        <WatchlistToday locale={locale} labels={t.watchlistToday} variant="full" />
      )}

      {alertData.available && (
        <Panel id="alarmlar" aria-label={t.priceAlerts.panelTitle} className="scroll-mt-28">
          <PanelHeader
            title={t.priceAlerts.panelTitle}
            meta={alertHits > 0 ? t.priceAlerts.hitBanner.replace("{n}", String(alertHits)) : undefined}
          />
          <div className={alertStyles.panelBody}>
            {sortedAlerts.length > 0 || sortedPercentAlerts.length > 0 ? (
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
                {sortedPercentAlerts.map((alert) => (
                  <PercentAlertRow
                    key={alert.id}
                    alert={alert}
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
            {/* Not, sunucu taramasının (app/api/cron/alarmlar) varlığına göre:
                bildirim tablosu yoksa o sürüm henüz inmemiş demek ve alarm
                yalnızca sayfa açılınca kontrol ediliyor. Bildirimi açık
                cihazı olmayan okuyucuya ayarlara giden tek satırlık yol. */}
            <p className={alertStyles.note}>
              {push.available ? t.notifications.alarmNote : t.priceAlerts.note}
              {push.available && push.subscriptions.length === 0 && pushPublicKey() && (
                <>
                  {" "}
                  {t.notifications.alarmHint}{" "}
                  <Link href="/ayarlar#bildirimler" className="font-semibold text-primary hover:text-primary-hover">
                    {t.notifications.alarmHintLink}
                  </Link>
                  .
                </>
              )}
            </p>
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
