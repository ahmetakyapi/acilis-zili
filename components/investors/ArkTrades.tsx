import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { Suspense } from "react";
import { cardKey } from "@/lib/company-card-key";
import { CompanyCards } from "@/components/ui/CompanyCards";
import { LogoTile, Panel, PanelHeader } from "@/components/ui/primitives";
import type { ArkActivity } from "@/lib/ark-data";
import type { ArkTrade } from "@/lib/ark-view";
import { getSymbolNames } from "@/lib/data";
import type { Dictionary } from "@/lib/i18n";
import { formatEtDateMedium, formatMoneyCompact } from "@/lib/utils";
import { formatShares } from "./format";
import styles from "./Investors.module.css";

/** Son günün her tarafında gösterilen satır; fazlası "+N Daha". */
const SIDE_ROWS = 8;
/** Kart anahtarı: aynı sayfada `FundBody`nin kaydı aynı sembole portföy
    satırları ekliyor; ARK'ın günlük işlem satırı onları taşımıyor. */
const CARD_SET = "ark";
/** Önceki günlerin satırında taraf başına sembol. */
const EARLIER_TICKERS = 3;

/**
 * Cathie Wood sayfası: ARK'ın ETF'lerindeki son alım ve satımlar.
 *
 * 13F çeyreklik ve 45 gün geriden geliyor; bu bölüm dünü anlatıyor, o
 * yüzden kahramanın hemen altında, 13F bölümlerinden ÖNCE. Son gün iki
 * sütun (alımlar · satışlar, tutara göre), önceki günler birer satırlık
 * özet. Şirket adı kendi sembol tablomuzdan; ARK'ın büyük harfli adı
 * yalnızca tablomuzda olmayan sembolde duruyor.
 *
 * Tek dosya varken (senkronun ilk günü) fark yok ve bölüm bunu söylüyor;
 * boş iki sütun "ARK dün hiçbir şey yapmadı" diye okunurdu.
 */
export async function ArkTrades({ activity, locale, t }: { activity: ArkActivity; locale: string; t: Dictionary }) {
  const ta = t.ark;
  const [latest, ...earlier] = activity.days;
  const tickers = latest ? latest.trades.map((trade) => trade.ticker) : [];
  const known = await getSymbolNames(tickers);
  const date = (value: string) => formatEtDateMedium(value, locale);

  const side = (direction: "buy" | "sell") => {
    const trades = latest?.trades.filter((trade) => trade.direction === direction) ?? [];
    return (
      <section className={styles.moveGroup} data-tone={direction === "buy" ? "up" : "down"}>
        <h3 className={styles.moveGroupTitle}>
          <span>{direction === "buy" ? ta.buys : ta.sells}</span>
          <b className="numeral">{trades.length}</b>
        </h3>
        {trades.length === 0 ? (
          <p className={styles.moveEmpty}>{ta.empty}</p>
        ) : (
          <ol className={styles.moveList} data-motion-stagger>
            {trades.slice(0, SIDE_ROWS).map((trade) => (
              <li key={trade.cusip} className="min-w-0">
                <TradeRow trade={trade} meta={known[trade.ticker]} locale={locale} t={t} />
              </li>
            ))}
            {trades.length > SIDE_ROWS && (
              <li className={styles.moveMore}>{t.investors.more.replace("{count}", String(trades.length - SIDE_ROWS))}</li>
            )}
          </ol>
        )}
      </section>
    );
  };

  return (
    <Panel>
      <PanelHeader
        title={ta.title}
        meta={latest ? ta.dayMeta.replace("{from}", date(latest.from)).replace("{to}", date(latest.to)) : ta.meta}
      />
      {latest ? (
        <div className={styles.arkSides}>
          {side("buy")}
          {side("sell")}
        </div>
      ) : (
        <p className="border-t border-line px-4 py-4 text-small text-muted sm:px-5">
          {ta.first.replace("{date}", date(activity.latest))}
        </p>
      )}
      {earlier.length > 0 && (
        <div className={styles.arkEarlier}>
          <h3 className={styles.arkEarlierTitle}>{ta.earlierTitle}</h3>
          <ol>
            {earlier.map((day) => {
              const pick = (direction: "buy" | "sell") =>
                day.trades
                  .filter((trade) => trade.direction === direction)
                  .slice(0, EARLIER_TICKERS)
                  .map((trade) => trade.ticker)
                  .join(", ");
              return (
                <li key={day.to} className={styles.arkEarlierRow}>
                  <span className="numeral">{date(day.to)}</span>
                  <span className="numeral">
                    {day.trades.length === 0
                      ? ta.noTrades
                      : ta.dayCounts.replace("{buys}", String(day.buys)).replace("{sells}", String(day.sells))}
                  </span>
                  <span className={styles.arkEarlierTickers}>
                    {day.buys > 0 && <b data-tone="up">{pick("buy")}</b>}
                    {day.sells > 0 && <b data-tone="down">{pick("sell")}</b>}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      )}
      <p className={styles.note}>{ta.note}</p>
      <p className={styles.note}>{ta.noteValue}</p>
      <Suspense fallback={null}>
        <CompanyCards
          symbols={(["buy", "sell"] as const).flatMap((direction) =>
            (latest?.trades ?? [])
              .filter((trade) => trade.direction === direction && known[trade.ticker])
              .slice(0, SIDE_ROWS)
              .map((trade) => trade.ticker),
          )}
          names={known}
          set={CARD_SET}
        />
      </Suspense>
    </Panel>
  );
}

function TradeRow({
  trade,
  meta,
  locale,
  t,
}: {
  trade: ArkTrade;
  meta: { name: string; logoUrl: string | null } | undefined;
  locale: string;
  t: Dictionary;
}) {
  const ta = t.ark;
  const body = (
    <>
      <LogoTile symbol={trade.ticker} logoUrl={meta?.logoUrl ?? null} size="sm" />
      <span className={styles.moveId}>
        <b className="numeral">{trade.ticker}</b>
        <small>{meta?.name ?? trade.company}</small>
        <span className={styles.arkFunds}>
          {trade.funds.map((fund) => (
            <i key={fund}>{fund}</i>
          ))}
          {trade.opened && <i data-tone="up">{ta.opened}</i>}
          {trade.closed && <i data-tone="down">{ta.closed}</i>}
        </span>
      </span>
      <span className={styles.moveFigures}>
        <b className="numeral">{formatMoneyCompact(trade.value, locale)}</b>
        <small className="numeral">{ta.shares.replace("{count}", formatShares(trade.shares, locale))}</small>
      </span>
    </>
  );
  return meta ? (
    <Link href={`/hisse/${trade.ticker}`} prefetch={false} className={styles.moveRow} data-cc={cardKey(trade.ticker, CARD_SET)}>
      {body}
    </Link>
  ) : (
    <div className={styles.moveRow}>{body}</div>
  );
}
