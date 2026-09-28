import { Suspense } from "react";
import { ArrowSquareOut } from "@phosphor-icons/react/dist/ssr";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { CompanyCards } from "@/components/ui/CompanyCards";
import { LogoTile, Panel, PanelHeader } from "@/components/ui/primitives";
import type { SymbolMeta } from "@/lib/data";
import type { Dictionary } from "@/lib/i18n";
import { isBuy, isSell, type CongressDetail as CongressDetailData, type TradeRow } from "@/lib/investor-data";
import { parseTradeDetail } from "@/lib/investor-view";
import { ptrUrl } from "@/lib/providers/house-ptr";
import { cn, formatEtDateMedium, plural } from "@/lib/utils";
import { amountRange, ownerLabel, tradeDetailText, txLabel, txTone } from "./format";
import styles from "./Investors.module.css";

/**
 * Kongre üyesinin detay gövdesi — tekil işlemler (28 Eylül).
 *
 * 13F'ten farklı bir belge: portföy fotoğrafı değil, işlem listesi; tutar
 * kesin değil ARALIK. Ana görsel bu yüzden harita değil "hisse bazında"
 * satırlar: her şirket için alış ve satış SAYISI yan yana iki çizgi (tutar
 * aralıklarını toplamak uydurma bir toplam verirdi). Altında tam liste,
 * her satırda işlem tarihi VE bildirim tarihi.
 */

type Labels = Dictionary["investors"];

export function CongressStrip({ detail, locale, t }: { detail: CongressDetailData; locale: string; t: Labels }) {
  const latest = detail.filings[0];
  return (
    <dl className={styles.strip}>
      <div>
        <dt>{t.stripTrades}</dt>
        <dd className="numeral">{detail.trades.length}</dd>
      </div>
      <div>
        <dt>{t.stripBuys}</dt>
        <dd className="numeral text-up">{detail.trades.filter((trade) => isBuy(trade.txType)).length}</dd>
      </div>
      <div>
        <dt>{t.stripSells}</dt>
        <dd className="numeral text-down">{detail.trades.filter((trade) => isSell(trade.txType)).length}</dd>
      </div>
      {latest && (
        <div>
          <dt>{t.stripLastFiled}</dt>
          <dd className="numeral">{formatEtDateMedium(latest.filedAt, locale)}</dd>
        </div>
      )}
      {latest && (
        <div>
          <dt>{t.stripSource}</dt>
          <dd>
            <a
              href={ptrUrl(Number(latest.filedAt.slice(0, 4)), latest.docId)}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.stripLink}
            >
              {t.sourcePdf}
              <ArrowSquareOut size={13} weight="bold" aria-hidden />
            </a>
          </dd>
        </div>
      )}
    </dl>
  );
}

export function CongressBody({
  detail,
  known,
  locale,
  t,
}: {
  detail: CongressDetailData;
  known: Record<string, SymbolMeta>;
  locale: string;
  t: Labels;
}) {
  /* Hisse bazında: sembolü olan işlemler şirkete, olmayanlar varlık adına. */
  const groups = new Map<string, { ticker: string | null; asset: string; buys: number; sells: number; last: string }>();
  for (const trade of detail.trades) {
    const key = trade.ticker ?? trade.asset;
    const group = groups.get(key) ?? { ticker: trade.ticker, asset: trade.asset, buys: 0, sells: 0, last: trade.txDate };
    if (isBuy(trade.txType)) group.buys += 1;
    if (isSell(trade.txType)) group.sells += 1;
    if (trade.txDate > group.last) group.last = trade.txDate;
    groups.set(key, group);
  }
  const rows = [...groups.values()].sort((a, b) => b.last.localeCompare(a.last));
  const peak = Math.max(1, ...rows.map((row) => Math.max(row.buys, row.sells)));

  return (
    <>
      <Panel>
        <PanelHeader title={t.byTickerTitle} />
        <p className="border-t border-line px-4 pt-3 text-small text-body sm:px-5">{t.byTickerHint}</p>
        <ul className={styles.tickerRows} data-motion-stagger>
          {rows.map((row) => {
            const meta = row.ticker ? known[row.ticker] : undefined;
            const body = (
              <>
                {row.ticker ? (
                  <LogoTile symbol={row.ticker} logoUrl={meta?.logoUrl} size="md" />
                ) : (
                  <span className={styles.noLogo} aria-hidden />
                )}
                <span className={styles.moveId}>
                  <b className="numeral">{row.ticker ?? row.asset}</b>
                  <small>{meta?.name ?? row.asset}</small>
                </span>
                <span className={styles.tickerBars}>
                  {/* Sıfır olan taraf basılmıyor: "0 Satış" satırı bilgi değil gürültü. */}
                  {row.buys > 0 && (
                    <span data-tone="up">
                      <i data-motion-draw="line" style={{ width: `${(row.buys / peak) * 100}%` }} aria-hidden />
                      <b className="numeral">{plural(row.buys, t.buysOne, t.buys).replace("{count}", String(row.buys))}</b>
                    </span>
                  )}
                  {row.sells > 0 && (
                    <span data-tone="down">
                      <i data-motion-draw="line" style={{ width: `${(row.sells / peak) * 100}%` }} aria-hidden />
                      <b className="numeral">{plural(row.sells, t.sellsOne, t.sells).replace("{count}", String(row.sells))}</b>
                    </span>
                  )}
                </span>
                <small className={cn("numeral", styles.tickerLast)}>{formatEtDateMedium(row.last, locale)}</small>
              </>
            );
            return (
              <li key={row.ticker ?? row.asset} className="min-w-0">
                {row.ticker && meta ? (
                  <Link href={`/hisse/${row.ticker}`} prefetch={false} className={styles.tickerRow} data-cc={row.ticker}>
                    {body}
                  </Link>
                ) : (
                  <div className={styles.tickerRow}>{body}</div>
                )}
              </li>
            );
          })}
        </ul>
      </Panel>

      <Panel className={styles.tablePanel}>
        <PanelHeader title={t.tradesTitle} meta={plural(detail.trades.length, t.tradesCountOne, t.tradesCount).replace("{count}", String(detail.trades.length))} />
        <TradeTable trades={detail.trades} known={known} locale={locale} t={t} />
      </Panel>

      {/* Şirket kartı — sembolü tabloda bilinen satırlar; kotasyonu kart
          kendisi soruyor, akışla iniyor. */}
      <Suspense fallback={null}>
        <CompanyCards symbols={rows.flatMap((row) => (row.ticker && known[row.ticker] ? [row.ticker] : []))} names={known} />
      </Suspense>
    </>
  );
}

export function TradeTable({
  trades,
  known,
  locale,
  t,
}: {
  trades: TradeRow[];
  known: Record<string, SymbolMeta>;
  locale: string;
  t: Labels;
}) {
  return (
    <div className={styles.tableScroll}>
      <table className={cn(styles.table, styles.tradeTable)}>
        <thead>
          <tr>
            <th scope="col">{t.colDate}</th>
            <th scope="col">{t.colAsset}</th>
            <th scope="col">{t.colType}</th>
            <th scope="col" className={styles.num}>{t.colAmount}</th>
            <th scope="col">{t.colOwner}</th>
            <th scope="col">{t.colDetail}</th>
            <th scope="col">{t.colNotified}</th>
          </tr>
        </thead>
        <tbody>
          {trades.map((trade) => {
            const meta = trade.ticker ? known[trade.ticker] : undefined;
            const detail = tradeDetailText(parseTradeDetail(trade.description), locale, t);
            const company = (
              <>
                {trade.ticker ? (
                  <LogoTile symbol={trade.ticker} logoUrl={meta?.logoUrl} size="sm" />
                ) : (
                  <span className={styles.noLogo} aria-hidden />
                )}
                <span className={styles.companyText}>
                  <b className="numeral">{trade.ticker ?? trade.asset}</b>
                  <small>{trade.asset}</small>
                </span>
              </>
            );
            return (
              <tr key={`${trade.docId}-${trade.rowNo}`}>
                <td className="numeral whitespace-nowrap">{formatEtDateMedium(trade.txDate, locale)}</td>
                <th scope="row" className={styles.companyCell}>
                  {trade.ticker && meta ? (
                    <Link href={`/hisse/${trade.ticker}`} prefetch={false} className={styles.company} data-cc={trade.ticker}>
                      {company}
                    </Link>
                  ) : (
                    <span className={styles.company}>{company}</span>
                  )}
                </th>
                <td>
                  <span className={styles.moveChip} data-tone={txTone(trade.txType)}>
                    {txLabel(trade.txType, t)}
                  </span>
                  {trade.assetType === "OP" && <small className={styles.cellNote}>{t.optionShort}</small>}
                </td>
                <td className={cn("numeral whitespace-nowrap", styles.num)}>
                  {amountRange(trade.amountLow, trade.amountHigh, locale, t)}
                </td>
                <td className="whitespace-nowrap">{ownerLabel(trade.owner, t)}</td>
                <td className={styles.detailCell}>
                  {detail ? (
                    detail.original ? (
                      <span lang="en" title={t.detailOriginal}>
                        {detail.text}
                      </span>
                    ) : (
                      detail.text
                    )
                  ) : null}
                </td>
                <td className="numeral whitespace-nowrap text-muted">
                  {trade.notifiedDate ? formatEtDateMedium(trade.notifiedDate, locale) : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
