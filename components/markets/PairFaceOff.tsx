import type { CSSProperties } from "react";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { LogoTile, Panel, PanelHeader } from "@/components/ui/primitives";
import type { ComparePair } from "@/content/compare-pairs";
import { seriesColorOf } from "@/lib/chart-series";
import { getStatus, getSymbolNames, liveMarketCap } from "@/lib/data";
import type { Dictionary, Locale } from "@/lib/i18n";
import { getQuotes } from "@/lib/providers";
import { industryLabel } from "@/lib/sectors";
import { cn, directionOf, directionText, formatMoneyCompact, formatPercent, formatPercentPlain } from "@/lib/utils";
import styles from "./PairFaceOff.module.css";

/**
 * Çift sayfasının "karşı karşıya" kahramanı — `/karsilastir/[pair]`.
 *
 * Tahtanın (`CompareBoard`) üstünde, başlığın hemen altında: iki şirketin
 * logosu, adı, alt sektörü ve bugünkü hareketi; ortada piyasa değerlerinin
 * paylaştırıldığı tek bir çubuk; altında "neden bu ikisi" paragrafı.
 * Paragraf eskiden tablonun altında ayrı bir paneldeydi ve sayfanın ilk
 * ekranında çiftin NEDEN çift olduğu yazmıyordu.
 *
 * YENİ BİR VERİ TURU YOK. `getSymbolNames` ve `getQuotes` istek içinde
 * sıralı sembol anahtarıyla önbellekli ve tahta aynı listeyi soruyor; bu
 * bileşen aynı paketi okuyor (CLAUDE.md "Veri dürüstlüğü" 3: şeritteki
 * günlük yüzde ile tablodaki aynı kaynaktan). Piyasa değeri de tablonun
 * kuralıyla canlı hesaplanıyor (`liveMarketCap`).
 *
 * RENKLER GRAFİĞİN RENKLERİ (`seriesColorOf`): sol şirket grafikte hangi
 * renkteyse çubukta da o. Yön rengi yalnızca günlük yüzdede.
 *
 * Piyasa değeri iki tarafta da bilinmiyorsa (fonlar: SPY, QQQ) çubuk hiç
 * basılmıyor — olmayan bir oranı varmış gibi göstermezdi.
 */
export async function PairFaceOff({
  pair,
  locale,
  t,
}: {
  pair: ComparePair;
  locale: Locale;
  t: Dictionary;
}) {
  const symbols = [...pair.symbols];
  const status = await getStatus();
  const [names, quotesResult] = await Promise.all([getSymbolNames(symbols), getQuotes(symbols, status)]);
  const quotes = quotesResult.ok ? quotesResult.data : {};

  const sides = symbols.map((symbol, index) => {
    const meta = names[symbol];
    const quote = quotes[symbol];
    return {
      symbol,
      label: pair.names[index] ?? symbol,
      name: meta?.name ?? null,
      logoUrl: meta?.logoUrl ?? null,
      industry: industryLabel(meta?.industry, locale),
      cap: liveMarketCap(meta, quote?.price),
      changePct: quote?.changePct ?? null,
      color: seriesColorOf(symbols, symbol),
    };
  });
  const caps = sides.map((side) => side.cap);
  const capTotal = caps.every((cap): cap is number => cap !== null && cap > 0)
    ? caps.reduce((sum, cap) => sum + cap, 0)
    : null;
  const [left, right] = sides;
  const twoSided = sides.length === 2;

  return (
    <Panel className={styles.panel}>
      <PanelHeader title={t.pairs.introTitle} />
      <div className={styles.stage} data-two={twoSided || undefined}>
        {sides.map((side, index) => (
          <div
            key={side.symbol}
            className={styles.side}
            data-side={twoSided ? (index === 0 ? "left" : "right") : undefined}
            style={{ "--i": index, "--series": side.color } as CSSProperties}
          >
            <Link href={`/hisse/${side.symbol}`} prefetch={false} className={styles.identity}>
              <LogoTile symbol={side.symbol} logoUrl={side.logoUrl} size="xl" className={styles.logo} />
              <span className={styles.identityText}>
                <span className={styles.symbol}>{side.symbol}</span>
                <span className={styles.name}>{side.name ?? side.label}</span>
              </span>
            </Link>
            <dl className={styles.facts}>
              {side.industry && (
                <div>
                  <dt>{t.stock.industry}</dt>
                  <dd>{side.industry}</dd>
                </div>
              )}
              {side.cap !== null && (
                <div>
                  <dt>{t.market.marketCap}</dt>
                  <dd className="figure">{formatMoneyCompact(side.cap, locale)}</dd>
                </div>
              )}
              <div>
                <dt>{t.compare.dayChange}</dt>
                <dd className={cn("figure", directionText(directionOf(side.changePct)))}>
                  {formatPercent(side.changePct, locale)}
                </dd>
              </div>
            </dl>
          </div>
        ))}
        {twoSided && (
          <span className={styles.versus} aria-hidden>
            {t.pairs.versus}
          </span>
        )}
      </div>

      {twoSided && capTotal !== null && left.cap !== null && right.cap !== null && (
        <div className={styles.balance}>
          <p className={styles.balanceTitle}>{t.pairs.capShare}</p>
          <span className={styles.balanceBar} aria-hidden>
            <span style={{ flexGrow: left.cap, background: left.color } as CSSProperties} />
            <span style={{ flexGrow: right.cap, background: right.color } as CSSProperties} />
          </span>
          <p className={styles.balanceLegend}>
            <span className="figure">
              {left.symbol} {formatPercentPlain((left.cap / capTotal) * 100, locale, 0)}
            </span>
            <span className="figure">
              {right.symbol} {formatPercentPlain((right.cap / capTotal) * 100, locale, 0)}
            </span>
          </p>
        </div>
      )}

      <p className={styles.intro}>{locale === "en" ? pair.introEn : pair.introTr}</p>
    </Panel>
  );
}

/**
 * Öteki çiftler — logolu geçiş kartları.
 *
 * Çiplerle dizili bir ad listesiydi; artık her çift kendi iki logosuyla
 * bir kart: okuyucu "peki şu ikisi" sorusunu adı okumadan tanıyor. Logo
 * sembolün depo dosyasından (`logoSrc`), yani burada bir veri turu yok.
 * İç bağlantı ağının bu ucu burası: bu adresler başka hiçbir yerden
 * bağlanmıyor.
 */
export function OtherPairs({
  pairs,
  joiner,
  t,
}: {
  pairs: readonly ComparePair[];
  joiner: string;
  t: Dictionary;
}) {
  return (
    <Panel>
      <PanelHeader title={t.pairs.others} />
      <nav aria-label={t.pairs.others} className={styles.others}>
        <ul className={styles.otherGrid}>
          {pairs.map((entry) => (
            <li key={entry.slug}>
              <Link href={`/karsilastir/${entry.slug}`} prefetch={false} className={styles.other}>
                <span className={styles.otherLogos} aria-hidden>
                  {entry.symbols.slice(0, 2).map((symbol) => (
                    <LogoTile key={symbol} symbol={symbol} size="md" className={styles.otherLogo} />
                  ))}
                </span>
                <span className={styles.otherName}>{entry.names.join(joiner)}</span>
                <ArrowRight size={14} weight="bold" aria-hidden className={styles.otherArrow} />
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </Panel>
  );
}
