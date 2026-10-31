import type { CSSProperties } from "react";
import { ArrowDown, ArrowUp, Equals } from "@phosphor-icons/react/dist/ssr";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { LogoTile } from "@/components/ui/primitives";
import type { SymbolMeta } from "@/lib/data";
import type { Dictionary } from "@/lib/i18n";
import type { CongressCard, FundCard, Overview } from "@/lib/investor-data";
import { INVESTORS, investorFirm, type Investor } from "@/lib/investors";
import { cn, formatEtDateMedium, formatMoneyCompact, formatPercentPlain, plural } from "@/lib/utils";
import { capitalShares, leanTally } from "./card-view";
import { formatWeight, quarterLabel, quarterLean, txLabel, txTone, type MoveTone } from "./format";
import { Portrait } from "./Portrait";
import styles from "./InvestorsIndex.module.css";

/**
 * Dizinin ilk ekranı: YATIRIMCI KART IZGARASI (25 Ekim).
 *
 * NEDEN. Sayfa bir portre şeridi, ekranın yarısını kaplayan bir sermaye
 * haritası (Buffett'ın karosunda yalnız büyük bir portre, yüzde ve ad
 * görünmüyordu), bir hareket grafiği, bir denge paneli ve en dipte iki
 * sütunlu büyük kartlarla 8.200 piksel uzunluğundaydı; sahibi "çok saçma ve
 * büyük bazı yerler, ne anlattığından uzaklaşıyoruz" dedi. Şimdi ilk ekran
 * on altı kişinin KENDİSİ: her kart bir yatırımcı ve dört soruya cevap
 * veriyor — takip edilen sermayenin ne kadarı onda (büyük sayı + aynı
 * ölçekli çizgi), bu çeyrek alıcı mı satıcı mı (yön rozeti), parası nerede
 * (en büyük üç pozisyonun logosu, ağırlığı ve yığılı şeridi), çeyreğin en
 * büyük hamlesi ne (tek satır).
 *
 * Harita, kadro ve denge paneli bu kartların içinde eridi: pay kartta,
 * yön rozette, kadro ızgaranın kendisi. Sermayenin dağılımı kapakta tek
 * satırlık yığılı şerit olarak duruyor (`CapitalStrip`).
 *
 * SIRA PAYA GÖRE: en son çeyreği bildirmiş açık fonlar büyükten küçüğe,
 * sonra Kongre üyesi, sonra eski dönemi taşıyanlar (geç bildiren ya da
 * kapanan fon). Eski dönemin fonunda pay YOK (iki ayrı çeyreği aynı pastaya
 * koymak uydurma pay olurdu); yerinde portföy değeri ve hangi çeyreğin
 * bildirimi olduğu yazıyor.
 *
 * 31 EKİM (görsel tur, sahibinin isteği: "daha görsel, kolay anlaşılan").
 * Kart sitenin kart diline geçti: nötr zemin, yön tepedeki 3 piksellik
 * şeritte (rozetle aynı yön). Her çizim kendi etiketini taşıyor: pay
 * kulvarının altında "Sermayedeki Payı", yığılı şeridin üstünde "İlk Üç
 * Pozisyon" ve toplam payı; rozetin yanında alış/satış sayısı okla ve
 * yön renginde, altında ikisinin oranı tek çizgi. Büyüklük çizgileri
 * mavi DEĞİL, sitenin yumuşak büyüklük tonu `--bar-soft` (CompareScale
 * ile aynı); yön yalnız yeşil/kırmızı.
 *
 * Kart bir bağlantı; içindeki logolar bağlantı değil (iç içe bağlantı yok).
 */

type Labels = Dictionary["investors"];

/** Kartta gösterilen en büyük pozisyon sayısı. */
const CARD_HOLDINGS = 3;
/** Kongre kartında gösterilen son işlem sayısı. */
const CARD_TRADES = 3;

type Entry = {
  investor: Investor;
  card: FundCard | CongressCard;
  share: number | null;
  lean: MoveTone | null;
};

export function gridEntries(overview: Overview): { entries: Entry[]; capital: ReturnType<typeof capitalShares> } {
  const period = overview.movers.period;
  const cardOf = new Map(overview.cards.map((card) => [card.slug, card]));
  const listed = INVESTORS.flatMap((investor) => {
    const card = cardOf.get(investor.slug);
    return card ? [{ investor, card }] : [];
  });
  const capital = capitalShares(
    listed.flatMap(({ investor, card }) =>
      card.kind === "13f"
        ? [{ slug: investor.slug, value: card.longValue, current: card.period === period && investor.status !== "closed" }]
        : [],
    ),
  );
  const entries = listed.map(({ investor, card }) => ({
    investor,
    card,
    share: capital.shareOf.get(investor.slug) ?? null,
    lean: quarterLean(card, period, investor.status === "closed"),
  }));
  const rank = (entry: Entry) => (entry.share !== null ? 0 : entry.card.kind === "congress" ? 1 : 2);
  entries.sort((a, b) => rank(a) - rank(b) || (b.share ?? 0) - (a.share ?? 0));
  return { entries, capital };
}

export function InvestorGrid({
  overview,
  known,
  locale,
  t,
}: {
  overview: Overview;
  known: Record<string, SymbolMeta>;
  locale: string;
  t: Labels;
}) {
  const { entries } = gridEntries(overview);
  const tally = leanTally(entries.map((entry) => entry.lean));
  const legend = [
    { tone: "up", label: t.leanUp, count: tally.up },
    { tone: "down", label: t.leanDown, count: tally.down },
    { tone: "flat", label: t.leanFlat, count: tally.flat },
  ] as const;

  return (
    <section className={styles.gridSection} aria-labelledby="investors-grid">
      <div className={styles.gridHead}>
        <h2 id="investors-grid" className={styles.gridTitle}>
          {t.cardsTitle}
          <span className="numeral">{entries.length}</span>
        </h2>
        {/* Lejant aynı zamanda çeyreğin özeti: rozetin anlamı ve kaç fonda. */}
        <ul className={styles.leanLegend}>
          {legend
            .filter((item) => item.count > 0)
            .map((item) => (
              <li key={item.tone} data-lean={item.tone}>
                <LeanIcon tone={item.tone} />
                {item.label}
                <b className="numeral">{item.count}</b>
              </li>
            ))}
        </ul>
      </div>
      <ul className={styles.grid} data-motion-stagger>
        {entries.map((entry) => (
          <li key={entry.investor.slug} className="flex min-w-0">
            <InvestorTile entry={entry} known={known} locale={locale} t={t} />
          </li>
        ))}
      </ul>
      <p className={styles.gridNote}>{t.cardNote}</p>
    </section>
  );
}

function LeanIcon({ tone }: { tone: MoveTone }) {
  const Icon = tone === "up" ? ArrowUp : tone === "down" ? ArrowDown : Equals;
  return <Icon size={12} weight="bold" aria-hidden />;
}

function InvestorTile({
  entry,
  known,
  locale,
  t,
}: {
  entry: Entry;
  known: Record<string, SymbolMeta>;
  locale: string;
  t: Labels;
}) {
  const { investor, card, share, lean } = entry;
  const closed = investor.status === "closed";
  const firm = investorFirm(investor, locale);
  return (
    <Link
      href={`/yatirimcilar/${investor.slug}`}
      prefetch={false}
      className={styles.tile}
      data-investor-card
      data-closed={closed || undefined}
      /* TEPE ŞERİDİ = ROZETİN YÖNÜ (31 Ekim; sitenin kart dili: nötr zemin,
         durum tepedeki 3 piksellik şeritte — bilanço, teknik, risk
         kartları). Net Alıcı yeşil, Net Satıcı kırmızı; dengede, kapanan
         fon ve Kongre kartında şerit yok (yön yok ya da rozet yok). */
      data-lean={!closed && card.kind === "13f" && lean && lean !== "flat" ? lean : undefined}
      aria-label={`${investor.name}, ${firm}`}
    >
      <span className={styles.tileHead}>
        <Portrait investor={investor} size="cast" />
        <span className={styles.tileId}>
          <b>{investor.name}</b>
          <small>{firm}</small>
        </span>
      </span>
      {card.kind === "13f" ? (
        <FundTile card={card} share={share} lean={lean} closed={closed} known={known} locale={locale} t={t} />
      ) : (
        <CongressTile card={card} known={known} locale={locale} t={t} />
      )}
    </Link>
  );
}

function FundTile({
  card,
  share,
  lean,
  closed,
  known,
  locale,
  t,
}: {
  card: FundCard;
  share: number | null;
  lean: MoveTone | null;
  closed: boolean;
  known: Record<string, SymbolMeta>;
  locale: string;
  t: Labels;
}) {
  const top = card.top.slice(0, CARD_HOLDINGS);
  const topWeight = top.reduce((sum, holding) => sum + holding.weight, 0);
  const buy = card.counts.new + card.counts.increased;
  const sell = card.counts.decreased + card.counts.soldOut;
  const highlight = share !== null ? card.highlight : null;
  const number = new Intl.NumberFormat(locale === "en" ? "en-US" : "tr-TR");
  const leanLabel = lean === "up" ? t.leanUp : lean === "down" ? t.leanDown : t.leanFlat;

  return (
    <>
      <span className={styles.tileFigure}>
        {share !== null ? (
          <>
            <span className={styles.tileFigureRow}>
              <strong className="numeral" aria-label={`${t.shareLabel} ${formatPercentPlain(share, locale, 1)}`}>
                {formatPercentPlain(share, locale, share >= 10 ? 0 : 1)}
              </strong>
              <small className="numeral">{formatMoneyCompact(card.longValue, locale)}</small>
            </span>
            {/* Aynı ölçek bütün kartlarda: %0-100 takip edilen sermaye.
                Etiket kulvarın altında (31 Ekim): etiketsiz kulvar "neyin
                çizgisi" sorusunu açık bırakıyordu. */}
            <span className={styles.lane} aria-hidden>
              <i data-motion-draw="line" style={{ width: `${Math.max(share, 0.6)}%` }} />
            </span>
            <small className={styles.figureCaption} aria-hidden>
              {t.shareLabel}
            </small>
          </>
        ) : (
          <span className={styles.tileFigureRow}>
            <strong className="numeral">{formatMoneyCompact(card.longValue, locale)}</strong>
            <small className="numeral">{t.periodOld.replace("{quarter}", quarterLabel(card.period, t))}</small>
          </span>
        )}
      </span>

      {/* ÇEYREĞİN YÖNÜ (31 Ekim). Rozetin yanında alış ve satış SAYISI yön
          renginde ve okla, altında ikisinin oranı yeşil-kırmızı tek çizgi
          (Kongre kartındaki çizginin aynısı). Eskiden yalnız rozet vardı;
          sayılar rozetin `title`ında saklıydı, dokunmatikte hiç okunmuyordu.
          Kapanan fonda yön yok: yerinde pozisyon sayısı. */}
      <span className={styles.quarter}>
        <span className={styles.tileBadges}>
          {closed ? (
            <span className={styles.badge} data-tone="closed">{t.fundClosed}</span>
          ) : lean ? (
            <span className={styles.badge} data-tone={lean}>
              <LeanIcon tone={lean} />
              {leanLabel}
            </span>
          ) : null}
          {!closed && lean && buy + sell > 0 ? (
            <small className={cn("numeral", styles.moveCounts)}>
              <span className="sr-only">
                {t.leanAria.replace("{lean}", leanLabel).replace("{buy}", number.format(buy)).replace("{sell}", number.format(sell))}
              </span>
              <span className="text-up" aria-hidden>
                <ArrowUp size={10} weight="bold" aria-hidden />
                {plural(buy, t.buysOne, t.buys).replace("{count}", number.format(buy))}
              </span>
              <span className="text-down" aria-hidden>
                <ArrowDown size={10} weight="bold" aria-hidden />
                {plural(sell, t.sellsOne, t.sells).replace("{count}", number.format(sell))}
              </span>
            </small>
          ) : (
            <small className="numeral">{plural(card.positionCount, t.positionsOne, t.positions).replace("{count}", number.format(card.positionCount))}</small>
          )}
        </span>
        {!closed && lean && buy + sell > 0 && (
          <span className={styles.split} aria-hidden>
            {buy > 0 && <i data-tone="up" data-motion-draw="line" style={{ flexGrow: buy }} />}
            {sell > 0 && <i data-tone="down" data-motion-draw="line" style={{ flexGrow: sell }} />}
          </span>
        )}
      </span>

      {top.length > 0 && (
        <span className={styles.holdings}>
          {/* Yığılı şerit portföyün BİÇİMİ: Li Lu'da üç parça şeridin çoğu,
              Dalio'da üç ince parça bir kenarda. Kalan tek açık parça.
              Üstünde etiketi ve üç pozisyonun toplam payı (31 Ekim). */}
          <span className={styles.holdingsHead} aria-hidden>
            <span>{t.topThree}</span>
            <b className="numeral">{formatWeight(topWeight, locale)}</b>
          </span>
          <span className={styles.stack} aria-hidden data-motion-draw="line">
            {top.map((holding, index) => (
              <i key={holding.cusip} data-seg={index} style={{ width: `${holding.weight * 100}%` }} />
            ))}
            {topWeight < 1 && <i data-rest style={{ width: `${(1 - topWeight) * 100}%` }} />}
          </span>
          <span className={styles.holdingList} aria-label={t.topHoldings}>
            {top.map((holding, index) => {
              const meta = holding.ticker ? known[holding.ticker] : undefined;
              return (
                <span key={holding.cusip} className={styles.holding} data-seg={index}>
                  {holding.ticker ? (
                    <LogoTile symbol={holding.ticker} logoUrl={meta?.logoUrl} size="xs" />
                  ) : (
                    <span className={styles.noLogo} aria-hidden />
                  )}
                  <span className={styles.holdingText}>
                    <b className="numeral">{holding.ticker ?? holding.issuer}</b>
                    <small className="numeral">{formatWeight(holding.weight, locale)}</small>
                  </span>
                </span>
              );
            })}
          </span>
        </span>
      )}

      {highlight && (
        <span className={styles.highlight} title={t.highlightLabel}>
          <span className="sr-only">{t.highlightLabel}: </span>
          {highlight.ticker ? (
            <LogoTile symbol={highlight.ticker} logoUrl={known[highlight.ticker]?.logoUrl} size="xs" />
          ) : (
            <span className={styles.noLogo} aria-hidden />
          )}
          <b className="numeral">{highlight.ticker ?? highlight.issuer}</b>
          <span className={styles.chip} data-tone={highlight.move === "new" || highlight.move === "increased" ? "up" : "down"}>
            {highlight.move === "new"
              ? t.highlightNew
              : highlight.move === "soldOut"
                ? t.highlightOut
                : (highlight.move === "increased" ? t.highlightUp : t.highlightDown).replace(
                    "{pct}",
                    formatPercentPlain(highlight.changePct, locale, 0),
                  )}
          </span>
        </span>
      )}
    </>
  );
}

function CongressTile({
  card,
  known,
  locale,
  t,
}: {
  card: CongressCard;
  known: Record<string, SymbolMeta>;
  locale: string;
  t: Labels;
}) {
  const trades = card.trades.slice(0, CARD_TRADES);
  const counted = card.buys + card.sells;
  const last = card.trades[0];
  return (
    <>
      <span className={styles.tileFigure}>
        <span className={styles.tileFigureRow} data-tight>
          <strong className="numeral">{card.total}</strong>
          <small>{t.stripTrades}</small>
        </span>
        {/* Alış ve satış SAYISININ payı (tutar aralık olarak bildiriliyor,
            toplanamaz). Renk yalnız yön. */}
        {counted > 0 && (
          <span className={styles.split} aria-hidden>
            {card.buys > 0 && <i data-tone="up" data-motion-draw="line" style={{ flexGrow: card.buys }} />}
            {card.sells > 0 && <i data-tone="down" data-motion-draw="line" style={{ flexGrow: card.sells }} />}
          </span>
        )}
      </span>
      <span className={styles.tileBadges}>
        <span className={styles.badge} data-tone="congress">{t.congressBadge}</span>
        <small className="numeral">
          <span className="text-up">{plural(card.buys, t.buysOne, t.buys).replace("{count}", String(card.buys))}</span>
          {" · "}
          <span className="text-down">{plural(card.sells, t.sellsOne, t.sells).replace("{count}", String(card.sells))}</span>
        </small>
      </span>
      {trades.length > 0 && (
        <span className={styles.holdingList} aria-label={t.recentTrades}>
          {trades.map((trade) => (
            <span key={`${trade.docId}-${trade.rowNo}`} className={styles.holding}>
              {trade.ticker ? (
                <LogoTile symbol={trade.ticker} logoUrl={trade.ticker ? known[trade.ticker]?.logoUrl : null} size="xs" />
              ) : (
                <span className={styles.noLogo} aria-hidden />
              )}
              <span className={styles.holdingText}>
                <b className="numeral">{trade.ticker ?? trade.asset}</b>
                <small className={cn(txTone(trade.txType) === "up" ? "text-up" : txTone(trade.txType) === "down" ? "text-down" : undefined)}>
                  {txLabel(trade.txType, t)}
                </small>
              </span>
            </span>
          ))}
        </span>
      )}
      {last && (
        <span className={cn(styles.highlight, styles.highlightMuted)}>
          {t.lastTrade.replace("{date}", formatEtDateMedium(last.txDate, locale))}
        </span>
      )}
    </>
  );
}

/**
 * Kapaktaki sermaye şeridi — "Takip Edilen Sermaye Kimde" haritasının
 * yerine TEK SATIR (25 Ekim). Harita 1440'ta ~500 piksel yüksekliğindeydi
 * ve en büyük karo bir portreden ibaretti; şerit aynı payları 8 piksellik
 * yığılı bir çizgide veriyor, payı yüksek iki-üç fonun adı ve yüzdesi
 * altında. Payı `TAIL_SHARE` altındaki fonlar tek "Diğer" dilimi. Dilimler
 * bağlantı değil (8 piksel dokunma hedefi olamaz); kişinin kartı hemen
 * altta. Renk yalnız büyüklük (yumuşak mavi, `--bar-soft`), sıra dilimin
 * yerinden okunuyor.
 */
const TAIL_SHARE = 2.5;
/** Bu paydan büyük dilimin altında ad ve yüzde yazılıyor. */
const LABEL_SHARE = 8;

export function CapitalStrip({ overview, locale, t }: { overview: Overview; locale: string; t: Labels }) {
  const { capital } = gridEntries(overview);
  if (capital.total <= 0) return null;
  const named = capital.slices.filter((slice) => slice.share >= TAIL_SHARE);
  const tail = capital.slices.filter((slice) => slice.share < TAIL_SHARE);
  const tailShare = tail.reduce((sum, slice) => sum + slice.share, 0);
  const nameOf = (slug: string) => INVESTORS.find((investor) => investor.slug === slug)?.name ?? slug;
  /* Dilimin başladığı yer: kendinden önceki dilimlerin payı toplamı. */
  const placed = named.map((slice, index) => ({
    ...slice,
    at: named.slice(0, index).reduce((sum, before) => sum + before.share, 0),
  }));

  return (
    <div className={styles.capital}>
      <p className={styles.capitalHead}>
        <span>{t.capitalLabel}</span>
        <b className="numeral">{formatMoneyCompact(capital.total, locale)}</b>
        <small className="numeral">{t.capitalFundsCount.replace("{count}", String(capital.slices.length))}</small>
      </p>
      <div className={styles.capitalBar} role="img" aria-label={`${t.capitalStripAria}: ${placed
        .map((slice) => `${nameOf(slice.slug)} ${formatPercentPlain(slice.share, locale, 1)}`)
        .join(", ")}${tail.length > 0 ? `, ${t.capitalOther.replace("{count}", String(tail.length))} ${formatPercentPlain(tailShare, locale, 1)}` : ""}`}>
        {placed.map((slice, index) => (
          <i
            key={slice.slug}
            data-motion-draw="line"
            title={`${nameOf(slice.slug)} ${formatPercentPlain(slice.share, locale, 1)}`}
            style={{ flexGrow: slice.share, "--rank": Math.min(index, 3) } as CSSProperties}
          />
        ))}
        {tail.length > 0 && <i data-rest style={{ flexGrow: tailShare }} />}
      </div>
      <ul className={styles.capitalLabels} aria-hidden>
        {placed
          .filter((slice) => slice.share >= LABEL_SHARE)
          .map((slice) => (
            <li key={slice.slug} style={{ left: `${slice.at}%` }}>
              {lastName(nameOf(slice.slug))}
              <b className="numeral">{formatPercentPlain(slice.share, locale, slice.share >= 10 ? 0 : 1)}</b>
            </li>
          ))}
        {tail.length > 0 && (
          <li data-end>
            {t.capitalOther.replace("{count}", String(tail.length))}
            <b className="numeral">{formatPercentPlain(tailShare, locale, 1)}</b>
          </li>
        )}
      </ul>
    </div>
  );
}

function lastName(name: string): string {
  return name.split(" ").at(-1) ?? name;
}
