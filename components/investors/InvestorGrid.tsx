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
 * yön rozette, kadro ızgaranın kendisi. Sermayenin dağılımı kapakta
 * (25 Ekim tek satırlık şerit `CapitalStrip`; 6 Kasım'dan beri kapağın
 * sağ kolonundaki pano, `CapitalBoard.tsx`).
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
 * 6 KASIM (sahibinin isteği: "içerikleri iyileştirelim").
 *   - BEŞ SABİT SATIR, SUBGRID. Kart her zaman beş çocuk basıyor (kimlik,
 *     ölçü, çeyreğin yönü, ilk üç pozisyon, en büyük hamle; Kongre kartı
 *     aynı beş yuvaya kendi içeriğini koyuyor, eksik olan boş yuva). Izgara
 *     `grid-template-rows: subgrid` ile komşu kartların aynı satırlarını
 *     AYNI HATTA tutuyor: önce her kart kendi içinde akıyordu; adı iki
 *     satıra kırılan (telefonda "Stanley Druckenmiller") ya da rozeti alta
 *     inen kartta altındaki her şey komşusundan kayıyordu.
 *   - ÖLÇÜNÜN KÜNYESİ SAYININ ÜSTÜNDE. "Sermayedeki Payı" pay çizgisinin
 *     ALTINDA, sayıdan kopuk duruyordu; şimdi iki ölçü iki künyesiyle aynı
 *     satırda: solda "Sermayedeki Payı" / %61, sağda "Hisse Portföyü" /
 *     299 Mr $, altında çizgi. Künye–sayı–çizgi tek blok.
 *   - "ÇEYREĞİN EN BÜYÜK HAMLESİ". En alttaki tek hisse + "Artırdı %45"
 *     hapı ne olduğunu söylemiyordu (sahibinin itirazı). Satırın üstünde
 *     künyesi, hisse sembolün yanında adıyla, hap neyin değiştiğini
 *     söylüyor ("Adedi %45 Artırdı": yüzde fiyat değil ADET değişimi).
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

export function gridEntries(overview: Overview): {
  entries: Entry[];
  capital: ReturnType<typeof capitalShares>;
} {
  const period = overview.movers.period;
  const cardOf = new Map(overview.cards.map((card) => [card.slug, card]));
  const listed = INVESTORS.flatMap((investor) => {
    const card = cardOf.get(investor.slug);
    return card ? [{ investor, card }] : [];
  });
  const capital = capitalShares(
    listed.flatMap(({ investor, card }) =>
      card.kind === "13f"
        ? [
            {
              slug: investor.slug,
              value: card.longValue,
              current: card.period === period && investor.status !== "closed",
            },
          ]
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
          <li key={entry.investor.slug} className="min-w-0">
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

function InvestorTile({ entry, known, locale, t }: { entry: Entry; known: Record<string, SymbolMeta>; locale: string; t: Labels }) {
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
      /* `aria-label` YOK (6 Kasım, inceleme): "Ad, Kurum" etiketi kartın
         bütün içeriğini (pay, yön rozeti, ilk hisseler) ekran okuyucudan
         eziyordu. Bağlantının adı artık içeriğin kendisi; okuma sırası ad →
         kurum → ölçüler, yani ilk duyulan yine kimlik. */
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
            {/* İki ölçü, ikisi de künyesi ÜSTÜNDE (6 Kasım; 31 Ekim'de
                künye kulvarın altındaydı ve sayıdan kopuk okunuyordu). */}
            <span className={styles.measures}>
              <span className={styles.measure}>
                <small>{t.shareLabel}</small>
                <strong className="numeral">{formatPercentPlain(share, locale, share >= 10 ? 0 : 1)}</strong>
              </span>
              <span className={styles.measure} data-end>
                <small>{t.portfolioLabel}</small>
                <b className="numeral">{formatMoneyCompact(card.longValue, locale)}</b>
              </span>
            </span>
            {/* Aynı ölçek bütün kartlarda: %0-100 takip edilen sermaye. Ton
                kapaktaki sermaye şeridiyle aynı (`--bar-soft`): Buffett'ın
                kapaktaki parçası ile kartındaki çizgisi aynı büyüklük. */}
            <span className={styles.lane} aria-hidden>
              <i data-motion-draw="line" style={{ width: `${Math.max(share, 0.6)}%` }} />
            </span>
          </>
        ) : (
          <span className={styles.measures}>
            <span className={styles.measure}>
              <small>{t.periodOld.replace("{quarter}", quarterLabel(card.period, t))}</small>
              <strong className="numeral">{formatMoneyCompact(card.longValue, locale)}</strong>
            </span>
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
            <span className={styles.badge} data-tone="closed">
              {t.fundClosed}
            </span>
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
            <small className="numeral">
              {plural(card.positionCount, t.positionsOne, t.positions).replace("{count}", number.format(card.positionCount))}
            </small>
          )}
        </span>
        {!closed && lean && buy + sell > 0 && (
          <span className={styles.split} aria-hidden>
            {buy > 0 && <i data-tone="up" data-motion-draw="line" style={{ flexGrow: buy }} />}
            {sell > 0 && <i data-tone="down" data-motion-draw="line" style={{ flexGrow: sell }} />}
          </span>
        )}
      </span>

      {top.length > 0 ? (
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
          {/* Ad içerikten okunuyor (kartın `aria-label`ı kalktı); rolsüz
              span'in `aria-label`ı bu okumada listeyi ezerdi — künye
              `sr-only` metin (6 Kasım, inceleme). */}
          <span className={styles.holdingList}>
            <span className="sr-only">{t.topHoldings}: </span>
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
      ) : (
        <span aria-hidden />
      )}

      {highlight ? (
        <span className={styles.highlight}>
          <small className={styles.highlightLabel}>{t.highlightLabel}</small>
          <span className={styles.highlightRow}>
            {highlight.ticker ? (
              <LogoTile symbol={highlight.ticker} logoUrl={known[highlight.ticker]?.logoUrl} size="xs" />
            ) : (
              <span className={styles.noLogo} aria-hidden />
            )}
            <span className={styles.highlightId}>
              <b className="numeral">{highlight.ticker ?? highlight.issuer}</b>
              {/* Ad yalnız sitede biliniyorsa: SEC'in büyük harfli ihraççı
                  adı ("UNITEDHEALTH GROUP INC") sembolün yanında gürültü. */}
              {highlight.ticker && known[highlight.ticker]?.name && <small>{known[highlight.ticker].name}</small>}
            </span>
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
        </span>
      ) : (
        <span aria-hidden />
      )}
    </>
  );
}

function CongressTile({ card, known, locale, t }: { card: CongressCard; known: Record<string, SymbolMeta>; locale: string; t: Labels }) {
  const trades = card.trades.slice(0, CARD_TRADES);
  const counted = card.buys + card.sells;
  const last = card.trades[0];
  return (
    <>
      <span className={styles.tileFigure}>
        <span className={styles.measures}>
          <span className={styles.measure}>
            <small>{t.congressBadge}</small>
            <strong className="numeral">
              {card.total} <span className={styles.measureUnit}>{t.stripTrades}</span>
            </strong>
          </span>
        </span>
      </span>
      {/* Kongre kartının yön yuvası: alış ve satış SAYISI (künye ölçünün
          üstünde "Kongre Bildirimi"; rozet olarak ikinci kez basılmıyor). */}
      <span className={styles.quarter}>
        <span className={styles.tileBadges}>
          <small className={cn("numeral", styles.moveCounts)}>
            <span className="text-up">
              <ArrowUp size={10} weight="bold" aria-hidden />
              {plural(card.buys, t.buysOne, t.buys).replace("{count}", String(card.buys))}
            </span>
            <span className="text-down">
              <ArrowDown size={10} weight="bold" aria-hidden />
              {plural(card.sells, t.sellsOne, t.sells).replace("{count}", String(card.sells))}
            </span>
          </small>
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
      {trades.length > 0 ? (
        <span className={styles.holdings}>
          <span className={styles.holdingsHead} aria-hidden>
            <span>{t.recentTrades}</span>
          </span>
          {/* Ad içerikten okunuyor (kartın `aria-label`ı kalktı); rolsüz
              span'in `aria-label`ı bu okumada listeyi ezerdi — künye
              `sr-only` metin (6 Kasım, inceleme). */}
          <span className={styles.holdingList}>
            <span className="sr-only">{t.recentTrades}: </span>
            {trades.map((trade) => (
              <span key={`${trade.docId}-${trade.rowNo}`} className={styles.holding}>
                {trade.ticker ? (
                  <LogoTile symbol={trade.ticker} logoUrl={trade.ticker ? known[trade.ticker]?.logoUrl : null} size="xs" />
                ) : (
                  <span className={styles.noLogo} aria-hidden />
                )}
                <span className={styles.holdingText}>
                  <b className="numeral">{trade.ticker ?? trade.asset}</b>
                  <small
                    className={cn(txTone(trade.txType) === "up" ? "text-up" : txTone(trade.txType) === "down" ? "text-down" : undefined)}
                  >
                    {txLabel(trade.txType, t)}
                  </small>
                </span>
              </span>
            ))}
          </span>
        </span>
      ) : (
        <span aria-hidden />
      )}
      {last ? (
        <span className={cn(styles.highlight, styles.highlightMuted)}>
          {t.lastTrade.replace("{date}", formatEtDateMedium(last.txDate, locale))}
        </span>
      ) : (
        <span aria-hidden />
      )}
    </>
  );
}
