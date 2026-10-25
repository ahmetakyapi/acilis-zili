import type { ReactNode } from "react";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { RollingFigure } from "@/components/ui/RollingFigure";
import { advanceShare, posterScale, type DayPoster } from "@/lib/day-poster";
import {
  posterActs,
  swarmDomain,
  swarmExtremes,
  type SceneStock,
} from "@/lib/day-poster-scene";
import type { Dictionary, Locale } from "@/lib/i18n";
import { withLocale } from "@/lib/i18n/routing";
import {
  cn,
  directionOf,
  directionText,
  formatEtDateCompact,
  formatPercent,
  formatPercentPlain,
  tieFigures,
} from "@/lib/utils";
import { PosterAct } from "./PosterAct";
import { MiniLane, PosterLanes } from "./PosterLanes";
import { BreadthStrip } from "./PosterMarks";
import { PosterStage } from "./PosterStage";
import { posterName, posterStoryText } from "./story";
import styles from "./PosterBoard.module.css";

/**
 * POSTERİN PANOSU — `/gun/[tarih]` ve `/gun`un en son seansı (25 Ekim,
 * üçüncü kurulum).
 *
 * SAHİBİNİN İSTEĞİ (canlıdaki ikinci sürümün ekran görüntüsü üzerine):
 * "Burası hiç görsel değil; çok daha görsel, çok daha iyi ve çok daha
 * anlaşılır." İkinci sürüm düzgün bir panoydu (dört ölçü, etiketli
 * kulvarlar, oran noktaları) ama poster değildi: ekranın en büyük öğesi
 * 28 piksellik bir başlıktı, sahne hissenin kendisini göstermiyordu.
 *
 * Şimdi okuma sırası bir posterin sırası:
 *   1. GÜNÜN CÜMLESİ — panelin `h2`si, display ölçekte: kısa başlık degrade
 *      ("Geniş Satış"), ayrıntı düz. Veriden kurallarla
 *      (`lib/day-poster-story.ts`).
 *   2. PERDE 1, GENİŞLİK — "130 Yükseldi / 363 Düştü" iri, aralarında şerit.
 *   3. SAHNE — her hisse bir nokta, sektör sektör (`PosterStage`): perde 2
 *      satırlar, perde 3 uç hisselerin etiketleri.
 *   4. KÜNYE KARTI (perde 4) — sahnenin kenarında: S&P 500, yükselen payı,
 *      endeksler, günün uçları, paylaşım görseli. Geniş ekranda sahnenin
 *      sağında, dar ekranda altında.
 *   5. Künyeler panelin içinde, hairline ile (CLAUDE.md ekran düzeni 6).
 *
 * İkinci sürümün sektör kulvarları kalktı: her sektörün değişimi artık
 * satırının başında ve satırda fonun işareti var; kulvar listesi aynı on
 * bir sayının ikinci kopyası olurdu.
 */

/** Yüzde basamağı — ana sayfanın endeks kartları ve sektör siluetiyle aynı. */
const PERCENT_DIGITS = 2;
/** Yükselen payı tam sayı: "%26". */
const SHARE_DIGITS = 0;
/** Eksen künyesi tek ondalık. */
const SCALE_DIGITS = 1;
/** İki sayaç sırayla dönsün. */
const FIGURE_STAGGER_MS = 120;

export function PosterBoard({
  poster,
  stocks,
  sized,
  unplaced,
  locale,
  t,
  action,
}: {
  poster: DayPoster;
  stocks: SceneStock[];
  sized: boolean;
  unplaced: number;
  locale: Locale;
  t: Dictionary;
  /** Başlığın sağındaki bağlantı (Poster Arşivi / Posteri Aç). */
  action?: ReactNode;
}) {
  const L = t.daySignature.poster;
  const S = t.daySignature.seal;
  const G = t.daySignature.stage;
  const story = posterStoryText(poster, locale, t);
  const name = (symbol: string) => posterName(symbol, locale);
  const pct = (value: number) => formatPercent(value, locale, PERCENT_DIGITS);
  const breadth = poster.breadth;
  const share = breadth ? advanceShare(breadth) : null;
  const anchor = poster.indices.find((move) => move.symbol === "SPY");
  const scale = posterScale(poster);
  const scaleText = formatPercentPlain(scale, locale, SCALE_DIGITS);
  const acts = posterActs({
    breadth: breadth !== null,
    stocks: stocks.length,
    indices: poster.indices.length,
  });
  const extremes = swarmExtremes(stocks);
  const domain =
    stocks.length > 0 ? swarmDomain(stocks.map((stock) => stock.change)) : null;
  const signedPct = (value: number) =>
    value === 0
      ? "0"
      : `${value > 0 ? "+" : "−"}${formatPercentPlain(value, locale, value % 1 === 0 ? 0 : 1)}`;
  const stripLabel = breadth
    ? S.stripLabel
        .replace("{adv}", String(breadth.advancing))
        .replace("{dec}", String(breadth.declining))
        .replace("{flat}", String(breadth.unchanged))
    : "";
  const sectors = poster.sectors.map((move) => ({
    symbol: move.symbol,
    name: name(move.symbol),
    change: move.change,
  }));
  const imageHref = (query = "") =>
    withLocale(`/gun/${poster.date}/gorsel${query}`, locale);
  const dateShort = formatEtDateCompact(poster.date, locale);

  return (
    <div className={styles.board}>
      {/* Geniş ekranda cümle ile genişlik yan yana: sahne ilk ekrana
          giriyor (1440×900'de sahnenin üstü 795 → 623; PosterBoard.module.css). */}
      <div className={styles.top}>
        <header className={styles.head}>
          {/* `data-ink="plain"`: sitenin `main h2` degradesi bütün kutuya
            yayılıp ayrıntıyı da maviye boyuyordu. Degrade yalnız kısa
            başlıkta (`display-ink`), ayrıntı düz. */}
          <h2 className={styles.story} data-ink="plain" data-poster-story="">
            <span className={cn("display-ink", styles.storyTitle)}>
              {story.title}
            </span>
            <span className="sr-only">: </span>
            <span className={styles.storyDetail}>
              {tieFigures(story.detail)}
            </span>
          </h2>
          <div className={styles.headMeta}>
            <span>{S.close.replace("{date}", dateShort)}</span>
            {action}
          </div>
        </header>

        {acts.includes("breadth") && breadth && (
          <PosterAct act="breadth" className={styles.breadth}>
            <div className={styles.breadthFigures} aria-hidden>
              <span className={styles.breadthSide}>
                <span className={cn(styles.breadthNumber, "text-up")}>
                  <RollingFigure value={String(breadth.advancing)} />
                </span>
                <span className={styles.breadthWord}>{G.axisUp}</span>
              </span>
              <span className={cn(styles.breadthSide, styles.breadthRight)}>
                <span className={styles.breadthWord}>{G.axisDown}</span>
                <span className={cn(styles.breadthNumber, "text-down")}>
                  <RollingFigure
                    value={String(breadth.declining)}
                    delayMs={FIGURE_STAGGER_MS}
                  />
                </span>
              </span>
            </div>
            <BreadthStrip
              breadth={breadth}
              label={stripLabel}
              animate
              className={styles.breadthStrip}
            />
            {breadth.unchanged > 0 && (
              <span className={styles.breadthFlat} aria-hidden>
                {L.flatCount.replace("{n}", String(breadth.unchanged))}
              </span>
            )}
          </PosterAct>
        )}
      </div>

      <div className={styles.scene}>
        <section
          className={styles.stageCol}
          aria-labelledby={`${poster.date}-stage`}
        >
          <div className={styles.stageHead}>
            <h3 id={`${poster.date}-stage`}>{G.title}</h3>
            <p>{G.hint}</p>
          </div>
          {stocks.length > 0 ? (
            <PosterStage
              stocks={stocks}
              sectors={sectors}
              locale={locale}
              text={G}
              sized={sized}
            />
          ) : (
            <p className={styles.empty}>{L.breadthMissing}</p>
          )}
        </section>

        <PosterAct act="indices" className={styles.card}>
          <h3 className={styles.cardTitle}>
            {S.close.replace("{date}", dateShort)}
          </h3>
          <dl className={styles.figures}>
            {anchor && (
              <div className={styles.measure}>
                <dt>{name("SPY")}</dt>
                <dd className={directionText(directionOf(anchor.change))}>
                  <RollingFigure value={pct(anchor.change)} />
                </dd>
                <dd className={styles.figVisual}>
                  <MiniLane change={anchor.change} scale={scale} />
                </dd>
              </div>
            )}
            {breadth && share !== null && (
              <div className={styles.measure}>
                <dt>{L.figBreadth}</dt>
                <dd className={styles.neutral}>
                  <RollingFigure
                    value={formatPercentPlain(
                      share * 100,
                      locale,
                      SHARE_DIGITS,
                    )}
                    delayMs={FIGURE_STAGGER_MS}
                  />
                </dd>
                <dd className={styles.figVisual}>
                  <BreadthStrip breadth={breadth} label={stripLabel} />
                </dd>
              </div>
            )}
          </dl>

          {acts.includes("indices") && (
            <div className={styles.cardBlock}>
              <h4>{L.indicesTitle}</h4>
              <PosterLanes
                moves={poster.indices}
                scale={scale}
                name={name}
                percent={pct}
                axis={[`−${scaleText}`, "0", `+${scaleText}`]}
                ranked={false}
                label={L.indicesTitle}
              />
            </div>
          )}

          {acts.includes("extremes") &&
            (extremes.up.length > 0 || extremes.down.length > 0) && (
              <div className={styles.cardBlock}>
                <h4>{G.extremesTitle}</h4>
                <ul className={styles.extremes}>
                  {[...extremes.up, ...extremes.down].map((i) => {
                    const stock = stocks[i];
                    return (
                      <li key={stock.symbol}>
                        <Link
                          href={`/hisse/${stock.symbol}`}
                          className={styles.extreme}
                        >
                          <span className={styles.extremeSymbol}>
                            {stock.symbol}
                          </span>
                          <span className={styles.extremeName}>
                            {stock.name}
                          </span>
                          <span
                            className={cn(
                              styles.extremeValue,
                              directionText(directionOf(stock.change)),
                            )}
                          >
                            {pct(stock.change)}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

          <div className={styles.share}>
            <span>{G.shareTitle}</span>
            <a href={imageHref()} target="_blank" rel="noopener">
              {G.shareWide}
            </a>
            <a href={imageHref("?bicim=dikey")} target="_blank" rel="noopener">
              {G.shareTall}
            </a>
          </div>
        </PosterAct>
      </div>

      <div className={styles.notes}>
        <p>{L.storyNote}</p>
        <p>
          {L.basisNote
            .replace("{date}", dateShort)
            .replace("{prev}", formatEtDateCompact(poster.prevDate, locale))}
        </p>
        {stocks.length > 0 && (
          <p>
            {sized ? G.sizeNote.replace("{date}", dateShort) : G.sizeMissing}
          </p>
        )}
        {domain && (
          <p>
            {G.clipNote
              .replace("{lo}", signedPct(domain.lo))
              .replace("{hi}", signedPct(domain.hi))}
          </p>
        )}
        {unplaced > 0 && (
          <p>{G.unplacedNote.replace("{n}", String(unplaced))}</p>
        )}
        <p>{L.proxyNote}</p>
        {breadth && <p>{L.breadthNote}</p>}
      </div>
    </div>
  );
}
