import { DataError, DataStamp, EmptyState, Panel, PanelHeader } from "@/components/ui/primitives";
import { ScrollEdges } from "@/components/ui/ScrollEdges";
import type { Dictionary, Locale } from "@/lib/i18n";
import { addEtDays, todayEt } from "@/lib/market-hours";
import { getStatus } from "@/lib/data";
import { getQuote } from "@/lib/providers";
import { getInsiderSentiment, getInsiderTransactions } from "@/lib/providers/finnhub-depth";
import {
  groupInsiderRows,
  isInsiderCode,
  isOpenMarket,
  openMarketSummary,
  sanitizeTradePrices,
  sentimentSeries,
  type InsiderTrade,
} from "@/lib/insider";
import {
  cn,
  directionOf,
  directionText,
  formatEtDateMedium,
  formatMoneyCompact,
  formatPrice,
  formatVolume,
  NO_VALUE,
  plural,
} from "@/lib/utils";
import styles from "./depth.module.css";

/** Pencere — Form 4 iki iş günü içinde dosyalanıyor; 90 gün bir çeyrek. */
const INSIDER_WINDOW_DAYS = 90;
/** MSPR serisi kaç ay — bir yıl, çubuklar 390 pikselde 24 piksel kalıyor. */
const SENTIMENT_MONTHS = 12;
/** Serinin başı: bir yıl + bir ay pay (içinde bulunulan ay yarım). */
const SENTIMENT_LOOKBACK_DAYS = 400;
/** Tabloda kaç işlem — gerisi "N İşlem Daha" künyesinde sayılıyor. */
const INSIDER_ROWS = 10;
/** MSPR'nin mutlak tavanı — çubuk bu değerde dolu. */
const MSPR_MAX = 100;

function codeLabel(code: string, t: Dictionary): string {
  const labels = t.stockDepth.insiderCodes;
  return isInsiderCode(code) ? labels[code] : t.stockDepth.insiderCodeOther.replace("{code}", code);
}

function monthLabel(month: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === "tr" ? "tr-TR" : "en-US", {
    month: "short",
    year: "2-digit",
    timeZone: "UTC",
  }).format(new Date(`${month}-15T12:00:00Z`));
}

/**
 * İçeriden işlemler — son 90 günün Form 4 kayıtları ve aylık MSPR serisi.
 *
 * SIRA EKRAN KURALINDA: önce ölçü (açık piyasa alım, satım, net), sonra
 * çizim (MSPR), sonra kayıtlar (tablo), en altta künye ve kaynak. Özet
 * yalnızca açık piyasa işlemlerini sayıyor; gerekçesi lib/insider.ts başında.
 */
export async function InsiderPanel({ symbol, locale, t }: { symbol: string; locale: Locale; t: Dictionary }) {
  const d = t.stockDepth;
  const today = todayEt();
  const status = await getStatus();
  const [txResult, sentimentResult, quote] = await Promise.all([
    getInsiderTransactions(symbol, addEtDays(today, -INSIDER_WINDOW_DAYS)),
    getInsiderSentiment(symbol, addEtDays(today, -SENTIMENT_LOOKBACK_DAYS), today),
    /* Fiyat denetimi için — başlıkla aynı istek-içi anahtar, ek tur yok. */
    getQuote(symbol, status),
  ]);

  const header = <PanelHeader title={d.insiderTitle} meta={d.insiderWindow} />;
  if (!txResult.ok) {
    return (
      <Panel className={styles.panel}>
        {header}
        <DataError message={t.data.failed} hint={t.data.failedHint} />
      </Panel>
    );
  }

  const trades = sanitizeTradePrices(groupInsiderRows(txResult.data), quote.ok ? quote.data.price : null);
  const dropped = trades.filter((trade) => trade.priceDropped).length;
  const summary = openMarketSummary(trades);
  const hasOpenMarket = summary.buyers + summary.sellers > 0;
  const series = sentimentResult.ok ? sentimentSeries(sentimentResult.data, today.slice(0, 7), SENTIMENT_MONTHS) : [];
  const hasSentiment = series.some((month) => month !== null);

  if (trades.length === 0 && !hasSentiment) {
    return (
      <Panel className={styles.panel}>
        {header}
        <EmptyState compact title={d.insiderEmpty} hint={d.insiderEmptyHint} />
      </Panel>
    );
  }

  const people = (n: number) => plural(n, d.insiderPersonOne, d.insiderPersonMany).replace("{n}", String(n));
  const shown = trades.slice(0, INSIDER_ROWS);

  return (
    <Panel className={styles.panel}>
      {header}
      <div className={styles.body}>
        {hasOpenMarket ? (
          <dl className={styles.readings}>
            <div className={styles.reading}>
              <dt>{d.insiderBuy}</dt>
              <dd className={cn("numeral", styles.readingValue)}>
                {summary.buyPriced > 0 || summary.buyUnpriced === 0 ? formatMoneyCompact(summary.buyValue, locale) : NO_VALUE}
              </dd>
              <dd className={styles.readingMeta}>{people(summary.buyers)}</dd>
            </div>
            <div className={styles.reading}>
              <dt>{d.insiderSell}</dt>
              <dd className={cn("numeral", styles.readingValue)}>
                {summary.sellPriced > 0 || summary.sellUnpriced === 0 ? formatMoneyCompact(summary.sellValue, locale) : NO_VALUE}
              </dd>
              <dd className={styles.readingMeta}>{people(summary.sellers)}</dd>
            </div>
            {/* Net ancak iki taraf da tam fiyatlıysa: fiyatı düşen bir işlem
                varken fark, eksik bir toplamdan kurulmuş olurdu. */}
            {summary.buyUnpriced + summary.sellUnpriced === 0 && (
            <div className={styles.reading}>
              <dt>{d.insiderNet}</dt>
              {/* Renk yalnızca işaretten: net alım artı, net satım eksi. */}
              <dd className={cn("numeral", styles.readingValue, directionText(directionOf(summary.netValue)))}>
                {summary.netValue > 0 ? "+" : summary.netValue < 0 ? "−" : ""}
                {formatMoneyCompact(Math.abs(summary.netValue), locale)}
              </dd>
            </div>
            )}
          </dl>
        ) : (
          trades.length > 0 && <p className="pb-3 text-small leading-relaxed text-body">{d.insiderNoOpenMarket}</p>
        )}

        {hasSentiment && (
          <div className={styles.sentiment}>
            <p className={styles.sentimentLabel}>{d.sentimentTitle}</p>
            {/* Çizim ARIA'dan gizli; en yeni ayın değeri künyede metin. */}
            <div aria-hidden className={styles.bars}>
              {series.map((month, index) => (
                <span key={month?.month ?? `bos-${index}`} className={styles.bar}>
                  {month ? (
                    <i
                      data-sign={month.mspr >= 0 ? "up" : "down"}
                      style={{ height: `${(Math.min(MSPR_MAX, Math.abs(month.mspr)) / MSPR_MAX) * 50}%` }}
                    />
                  ) : (
                    <b />
                  )}
                </span>
              ))}
            </div>
            <div className={cn("numeral", styles.barAxis)}>
              <span>{monthLabel(addMonths(today.slice(0, 7), 1 - SENTIMENT_MONTHS), locale)}</span>
              <span>{monthLabel(today.slice(0, 7), locale)}</span>
            </div>
          </div>
        )}

        {shown.length > 0 && (
          <ScrollEdges
            className="scroll-x mt-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--line-focus)"
            tabIndex={0}
            role="region"
            aria-label={d.insiderTitle}
          >
            <table className={cn(styles.table, styles.insiderTable)}>
              <thead>
                <tr>
                  <th scope="col">{d.insiderColName}</th>
                  <th scope="col">{d.insiderColDate}</th>
                  <th scope="col">{d.insiderColType}</th>
                  <th scope="col">{d.insiderColShares}</th>
                  <th scope="col">{d.insiderColPrice}</th>
                  <th scope="col">{d.insiderColValue}</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((trade) => (
                  <InsiderRow key={trade.key} trade={trade} locale={locale} t={t} />
                ))}
              </tbody>
            </table>
          </ScrollEdges>
        )}
        {trades.length > shown.length && (
          <p className="numeral mt-2 text-tiny text-muted">
            {d.insiderMore.replace("{n}", String(trades.length - shown.length))}
          </p>
        )}

        <p className={styles.note}>{d.insiderNote}</p>
        {dropped > 0 && (
          <p className={styles.note}>{d.insiderPriceDropped.replace("{n}", String(dropped))}</p>
        )}
        {hasSentiment && <p className={styles.note}>{d.sentimentNote}</p>}
        <DataStamp
          labels={t.data}
          source={txResult.source}
          at={txResult.fetchedAt}
          stale={txResult.stale}
          locale={locale}
          className={styles.stamp}
        />
      </div>
    </Panel>
  );
}

function InsiderRow({ trade, locale, t }: { trade: InsiderTrade; locale: Locale; t: Dictionary }) {
  const open = !trade.derivative && isOpenMarket(trade.code);
  return (
    <tr>
      <td>
        <span className={styles.nameCell} title={trade.name}>{trade.name}</span>
      </td>
      <td className="numeral text-body">{formatEtDateMedium(trade.date, locale)}</td>
      <td className={open ? "font-semibold text-strong" : "text-muted"}>
        {codeLabel(trade.code, t)}
        {trade.derivative && <span className={styles.tag}>{t.stockDepth.insiderDerivative}</span>}
      </td>
      {/* Pay işaretli: eksi elden çıkan. Renk yalnızca açık piyasada — ödülün
          "artısı" bir alım kararı değil, yeşil boyanmamalı. */}
      <td className={cn("numeral", open ? directionText(directionOf(trade.shares)) : "text-body")}>
        {trade.shares > 0 ? "+" : "−"}
        {formatVolume(Math.abs(trade.shares), locale)}
      </td>
      <td className="numeral text-body">
        {trade.price !== null ? formatPrice(trade.price, locale, { currency: true }) : NO_VALUE}
      </td>
      <td className="numeral font-semibold text-strong">
        {trade.value !== null ? formatMoneyCompact(trade.value, locale) : NO_VALUE}
      </td>
    </tr>
  );
}

/** "2026-09" + n ay. */
function addMonths(month: string, n: number): string {
  const [y, m] = month.split("-").map(Number);
  const total = y! * 12 + (m! - 1) + n;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
}
