import { amountRange, formatShares, formatWeight, moveLabel, moveTone, quarterLabel, txLabel, txTone } from "@/components/investors/format";
import styles from "@/components/investors/Investors.module.css";
import { Portrait } from "@/components/investors/Portrait";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { Panel, PanelHeader, PanelLink } from "@/components/ui/primitives";
import type { Dictionary, Locale } from "@/lib/i18n";
import type { StockInvestors } from "@/lib/investor-data";
import { investorBySlug, investorFirm } from "@/lib/investors";
import { cn, formatEtDateMedium, formatMoneyCompact, formatPercent } from "@/lib/utils";
import type { CSSProperties } from "react";
import depth from "./depth.module.css";
import { FoldToggle } from "./FoldToggle";

/**
 * "Ünlü Yatırımcılar" — bu hisseyi son bildirimlerinde tutan yatırımcılar
 * ve son dönemdeki hareketleri, varsa Kongre işlemleri (28 Eylül).
 *
 * VERİ SAYFADAN GELİYOR, AKIŞTAN DEĞİL. "Panel basılacak mı" sorusu
 * sayfanın ön okumasında yanıtlanıyor (yerel, önbellekli bir sorgu;
 * mercek satırlarının gerekçesi): hiç kayıt yoksa panel HİÇ basılmıyor ve
 * geç gelen bir blok altındaki haberleri itmiyor.
 *
 * Yeri içeriden işlemlerin hemen altı: ikisi de "bu hisseyi kim alıp
 * satıyor" sorusu, biri yönetimin öteki ünlü yatırımcıların. Bir süre
 * Şirket Özeti'nin altındaydı; sahibi "çok üstte" buldu ve Gündem'e indi.
 *
 * KOMPAKT (28 Eylül): geniş ekranda sahipler ve Kongre işlemleri iki
 * sütun, dar ekranda ilk dört sahip açık, gerisi `FoldToggle` ile.
 */
const MAX_HOLDERS = 8;
/** Dar ekranda açık gelen sahip sayısı. */
const HOLDER_FOLD = 4;
/** Katlama anahtarının iç payı — satırların metin hattı (liste 10 + satır 8). */
const FOLD_INSET = "18px";

export function InvestorsPanel({ data, locale, t }: { data: StockInvestors; locale: Locale; t: Dictionary }) {
  const ti = t.investors;
  const holders = data.holders.slice(0, MAX_HOLDERS);
  return (
    <Panel>
      <PanelHeader title={ti.panelTitle} action={<PanelLink href="/yatirimcilar">{ti.panelAll}</PanelLink>} />
      {holders.length > 0 && (
        <div style={{ "--fold-inset": FOLD_INSET } as CSSProperties}>
        <FoldToggle
          id="investors-fold"
          hiddenCount={holders.length - HOLDER_FOLD}
          more={t.stockDepth.investorsShowMore.replace("{n}", String(holders.length - HOLDER_FOLD))}
          less={t.common.less}
        >
        <ul
          className={cn(styles.holderList, depth.holderGrid)}
          style={{ "--rows": Math.ceil(holders.length / 2) } as CSSProperties}
          data-motion-stagger
        >
          {holders.map((holder, index) => {
            const investor = investorBySlug(holder.slug);
            if (!investor) return null;
            const closed = investor.status === "closed";
            return (
              <li key={holder.slug} className="min-w-0" data-fold={index >= HOLDER_FOLD ? "" : undefined}>
                <Link href={`/yatirimcilar/${holder.slug}`} prefetch={false} className={styles.holderRow}>
                  <Portrait investor={investor} size="sm" />
                  <span className={styles.holderId}>
                    <b>{investor.name}</b>
                    <small>
                      {investorFirm(investor, locale)} · {quarterLabel(holder.period, ti)}
                      {closed ? ` · ${ti.fundClosed}` : ""}
                    </small>
                  </span>
                  <span className={styles.holderMove}>
                    <span className={styles.moveChip} data-tone={moveTone(holder.move)}>
                      {moveLabel(holder.move, ti)}
                      {holder.changePct !== null && holder.move !== "unchanged" && holder.move !== "soldOut" && (
                        <b className="numeral">{formatPercent(holder.changePct, locale, 0)}</b>
                      )}
                    </span>
                    <small className="numeral">
                      {holder.exited
                        ? ti.panelExited
                        : ti.panelWeight.replace("{weight}", formatWeight(holder.weight, locale))}
                    </small>
                  </span>
                  <span className={cn("numeral", styles.holderValue)}>
                    <b>{formatMoneyCompact(holder.value, locale)}</b>
                    <small>{formatShares(holder.amount, locale)}</small>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
        </FoldToggle>
        </div>
      )}
      {data.trades.length > 0 && (
        <div className={styles.holderTrades}>
          <h3 className={styles.holderTradesTitle}>{ti.panelCongress}</h3>
          <ul className={depth.tradeGrid}>
            {data.trades.map((trade) => {
              const investor = investorBySlug(trade.member);
              return (
                <li key={`${trade.docId}-${trade.rowNo}`}>
                  <Link href={`/yatirimcilar/${trade.member}`} prefetch={false} className={styles.holderTrade}>
                    {investor && <Portrait investor={investor} size="chip" />}
                    <span className="numeral text-muted">{formatEtDateMedium(trade.txDate, locale)}</span>
                    <span className={styles.txChip} data-tone={txTone(trade.txType)}>
                      {txLabel(trade.txType, ti)}
                      {trade.assetType === "OP" ? ` · ${ti.optionShort}` : ""}
                    </span>
                    <span className="numeral">{amountRange(trade.amountLow, trade.amountHigh, locale, ti)}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      <p className="border-t border-line px-4 py-3 text-small text-muted sm:px-5">{ti.note13f}</p>
    </Panel>
  );
}
