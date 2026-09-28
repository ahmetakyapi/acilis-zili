import type { CSSProperties } from "react";
import { ArrowUpRight } from "@phosphor-icons/react/dist/ssr";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { RollingFigure } from "@/components/themes/RollingFigure";
import { LogoTile } from "@/components/ui/primitives";
import type { SymbolMeta } from "@/lib/data";
import type { Dictionary } from "@/lib/i18n";
import type { CongressCard, FundCard } from "@/lib/investor-data";
import { investorFirm, type Investor } from "@/lib/investors";
import { cn, formatEtDateCompact, formatMoneyCompact } from "@/lib/utils";
import { amountRange, asOfLabel, filedLabel, formatWeight, txLabel, txTone } from "./format";
import { Portrait } from "./Portrait";
import styles from "./Investors.module.css";

/**
 * Dizinin yatırımcı kartı — iki tür, aynı iskelet.
 *
 * Üstte portre ve kimlik (kartın gerçek bir parçası, küçük bir avatar
 * değil), ortada tek büyük sayı, altta o sayının İÇİ: 13F kartında en
 * büyük pozisyonların ağırlık şeridi ve logo mozaiği, Kongre kartında son
 * işlemler. Dipte künye: hangi dönem, ne zaman bildirildi.
 *
 * Kart bir bağlantı; içindeki logolar bağlantı değil (iç içe bağlantı yok).
 * Büyük sayı görünüme girince yuvarlanıyor (`themes/RollingFigure`); ilk
 * ekrandaki kartta kıpırdamıyor.
 */
export function InvestorCard({
  card,
  investor,
  known,
  locale,
  t,
}: {
  card: FundCard | CongressCard;
  investor: Investor;
  known: Record<string, SymbolMeta>;
  locale: string;
  t: Dictionary["investors"];
}) {
  const closed = investor.status === "closed";
  return (
    <Link href={`/yatirimcilar/${investor.slug}`} prefetch={false} className={styles.card} data-closed={closed || undefined}>
      <div className={styles.cardHead}>
        <Portrait investor={investor} size="card" className={styles.cardPortrait} />
        <div className={styles.cardId}>
          <h3 className={styles.cardName}>{investor.name}</h3>
          <p className={styles.cardFirm}>{investorFirm(investor, locale)}</p>
          {(closed || card.kind === "congress") && (
            <span className={styles.badge} data-tone={closed ? "closed" : "congress"}>
              {closed ? t.fundClosed : t.congressBadge}
            </span>
          )}
        </div>
        <ArrowUpRight weight="bold" size={16} className={styles.cardArrow} aria-hidden />
      </div>
      {card.kind === "13f" ? (
        <FundBody card={card} known={known} locale={locale} t={t} />
      ) : (
        <CongressBody card={card} known={known} locale={locale} t={t} />
      )}
    </Link>
  );
}

function FundBody({
  card,
  known,
  locale,
  t,
}: {
  card: FundCard;
  known: Record<string, SymbolMeta>;
  locale: string;
  t: Dictionary["investors"];
}) {
  const topWeight = card.top.reduce((sum, top) => sum + top.weight, 0);
  const moves = [
    { key: "new", count: card.counts.new, label: t.moveNew, tone: "up" },
    { key: "increased", count: card.counts.increased, label: t.moveIncreased, tone: "up" },
    { key: "decreased", count: card.counts.decreased, label: t.moveDecreased, tone: "down" },
    { key: "soldOut", count: card.counts.soldOut, label: t.moveSoldOut, tone: "down" },
  ] as const;
  return (
    <>
      <div className={styles.cardFigure}>
        <span className={styles.cardFigureLabel}>{t.portfolioValue}</span>
        <strong className={cn("numeral", styles.cardValue)}>
          <RollingFigure value={formatMoneyCompact(card.longValue, locale)} />
        </strong>
        <span className={cn("numeral", styles.cardFigureMeta)}>
          {t.positions.replace("{count}", String(card.positionCount))}
        </span>
      </div>

      {/* Ağırlık şeridi: en büyük altı pozisyon soldan sağa kendi payı kadar,
          kalanı tek soluk parça. Şerit portföyün BİÇİMİNİ veriyor: Li Lu'da
          iki parça şeridin yarısı, Dalio'da altı parça bir kenarda. */}
      <div className={styles.weightStrip} data-motion-draw="line" aria-hidden>
        {card.top.map((top, index) => (
          <i
            key={top.cusip}
            className={styles.weightSeg}
            style={{ width: `${top.weight * 100}%`, "--seg": index } as CSSProperties}
          />
        ))}
        {topWeight < 1 && <i className={styles.weightRest} style={{ width: `${(1 - topWeight) * 100}%` }} />}
      </div>

      <ul className={styles.mosaic} aria-label={t.topHoldings}>
        {card.top.map((top, index) => {
          const meta = top.ticker ? known[top.ticker] : undefined;
          return (
            <li key={top.cusip} className={styles.mosaicItem} style={{ "--seg": index } as CSSProperties}>
              {top.ticker ? (
                <LogoTile symbol={top.ticker} logoUrl={meta?.logoUrl} size="sm" card={Boolean(meta)} />
              ) : (
                <span className={styles.noLogo} aria-hidden />
              )}
              <span className={styles.mosaicText}>
                <b className="numeral">{top.ticker ?? top.issuer}</b>
                <small className="numeral">{formatWeight(top.weight, locale)}</small>
              </span>
            </li>
          );
        })}
      </ul>

      {card.compared && (
        <div className={styles.cardMoves}>
          {moves.map((move) => (
            <span key={move.key} data-tone={move.count > 0 ? move.tone : "flat"}>
              <b className="numeral">{move.count}</b> {move.label}
            </span>
          ))}
        </div>
      )}
      <p className={styles.cardFoot}>
        <span>{asOfLabel(card.period, locale, t)}</span>
        <span>{filedLabel(card.filedAt, locale, t)}</span>
      </p>
    </>
  );
}

function CongressBody({
  card,
  known,
  locale,
  t,
}: {
  card: CongressCard;
  known: Record<string, SymbolMeta>;
  locale: string;
  t: Dictionary["investors"];
}) {
  return (
    <>
      <div className={styles.cardFigure}>
        <span className={styles.cardFigureLabel}>{t.recentTrades}</span>
        <strong className={cn("numeral", styles.cardValue)}>
          <RollingFigure value={String(card.total)} />
        </strong>
        <span className={cn("numeral", styles.cardFigureMeta)}>
          <span className="text-up">{t.buys.replace("{count}", String(card.buys))}</span>
          {" · "}
          <span className="text-down">{t.sells.replace("{count}", String(card.sells))}</span>
        </span>
      </div>
      <ul className={styles.tradeList}>
        {card.trades.map((trade) => {
          const meta = trade.ticker ? known[trade.ticker] : undefined;
          return (
            <li key={`${trade.docId}-${trade.rowNo}`} className={styles.tradeRow}>
              <span className={cn("numeral", styles.tradeDate)}>{formatEtDateCompact(trade.txDate, locale)}</span>
              {trade.ticker ? (
                <LogoTile symbol={trade.ticker} logoUrl={meta?.logoUrl} size="xs" card={Boolean(meta)} />
              ) : (
                <span className={styles.noLogoXs} aria-hidden />
              )}
              <b className={cn("numeral", styles.tradeTicker)}>{trade.ticker ?? trade.asset}</b>
              <span className={styles.txChip} data-tone={txTone(trade.txType)}>
                {txLabel(trade.txType, t)}
                {trade.assetType === "OP" ? ` · ${t.optionShort}` : ""}
              </span>
              <span className={cn("numeral", styles.tradeAmount)}>
                {amountRange(trade.amountLow, trade.amountHigh, locale, t)}
              </span>
            </li>
          );
        })}
      </ul>
      <p className={styles.cardFoot}>
        {card.lastFiled && <span>{filedLabel(card.lastFiled, locale, t)}</span>}
      </p>
    </>
  );
}
