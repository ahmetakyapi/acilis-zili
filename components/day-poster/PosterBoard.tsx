import type { ReactNode } from "react";
import { RollingFigure } from "@/components/ui/RollingFigure";
import { POSTER_ANCHOR, type DayPoster } from "@/lib/day-poster";
import type { PosterSkyline } from "@/lib/day-poster-data";
import { skyDomain } from "@/lib/day-skyline";
import type { Dictionary, Locale } from "@/lib/i18n";
import { withLocale } from "@/lib/i18n/routing";
import { logoSrc } from "@/lib/logos";
import { cn, directionOf, directionText, formatEtDateCompact, formatPercent, formatPercentPlain, tieFigures } from "@/lib/utils";
import { BreadthStrip } from "./PosterMarks";
import { Skyline } from "./Skyline";
import { posterName, posterStoryText } from "./story";
import styles from "./PosterBoard.module.css";

/**
 * POSTERİN PANOSU — `/gun/[tarih]` ve `/gun`un en son seansı (25 Ekim,
 * dördüncü kurulum: Günün Silueti).
 *
 * SAHİBİNİN İTİRAZI (canlıdaki "S&P 500, Hisse Hisse" sahnesi): "Çok kötü
 * gözüküyor; noktaların ne olduğunu insan anlamaz. Daha görsel, daha
 * anlaşılabilir ve benzersiz bir tasarım." Pano artık Nasdaq 100'ün
 * silüetini anlatıyor; okuma sırası CLAUDE.md ekran düzeni:
 *   1. GÜNÜN CÜMLESİ — panelin `h2`si, display ölçekte (kısa başlık
 *      degrade, ayrıntı düz); yanında tek büyük künye, Nasdaq 100'ün
 *      değişimi (künye şeridi).
 *   2. ANA GÖRSEL — siluet (`Skyline`), üstünde ne anlattığını söyleyen
 *      üç parçalı lejant: genişlik, yükseklik, ufuk.
 *   3. ÖLÇÜ IZGARASI — yükselen/düşen (genişlik şeridiyle), en güçlü ve en
 *      zayıf sektör, öteki endeksler. Hepsi aynı hatta biter.
 *   4. Paylaşım görseli ve künyeler panelin içinde, hairline ile.
 *
 * Eski sahnenin "Günün Uçları" listesi ayrıca basılmıyor: uç hisseler
 * siluette logolarıyla etiketli, tam liste "Tüm Şirketler"de.
 */

/** Yüzde basamağı — ana sayfanın endeks kartlarıyla aynı. */
const PERCENT_DIGITS = 2;
/** Ölçek künyesi tek ondalık. */
const SCALE_DIGITS = 1;
/** İki sayaç sırayla dönsün. */
const FIGURE_STAGGER_MS = 120;
/** Öteki endeksler — posterin endeksi dışındakiler, `INDEX_STRIP` sırası. */
const OTHER_INDICES = ["SPY", "DIA", "IWM"] as const;

export function PosterBoard({
  poster,
  skyline,
  locale,
  t,
  action,
}: {
  poster: DayPoster;
  skyline: PosterSkyline;
  locale: Locale;
  t: Dictionary;
  /** Başlığın sağındaki bağlantı (Poster Arşivi / Posteri Aç). */
  action?: ReactNode;
}) {
  const L = t.daySignature.poster;
  const S = t.daySignature.seal;
  const K = t.daySignature.skyline;
  const { stocks, districts, sized } = skyline;
  const story = posterStoryText(poster, districts, locale, t);
  const pct = (value: number) => formatPercent(value, locale, PERCENT_DIGITS);
  const breadth = poster.breadth;
  const anchor = poster.indices.find((move) => move.symbol === POSTER_ANCHOR);
  const others = OTHER_INDICES.flatMap((symbol) => poster.indices.filter((move) => move.symbol === symbol));
  const strongest = districts[0];
  const weakest = districts[districts.length - 1];
  const names = Object.fromEntries(districts.map((district) => [district.key, posterName(district.key, locale)]));
  const logos = Object.fromEntries(
    stocks.flatMap((stock) => {
      const src = logoSrc(stock.symbol, null);
      return src ? [[stock.symbol, src] as const] : [];
    }),
  );
  const domain = skyDomain(stocks.map((stock) => stock.change));
  const clipped = stocks.some((stock) => Math.abs(stock.change) > domain.hi);
  const stripLabel = breadth
    ? S.stripLabel
        .replace("{adv}", String(breadth.advancing))
        .replace("{dec}", String(breadth.declining))
        .replace("{flat}", String(breadth.unchanged))
    : "";
  const imageHref = (query = "") => withLocale(`/gun/${poster.date}/gorsel${query}`, locale);
  const dateShort = formatEtDateCompact(poster.date, locale);

  return (
    <div className={styles.board}>
      <header className={styles.head}>
        <div className={styles.headText}>
          {/* `data-ink="plain"`: sitenin `main h2` degradesi bütün kutuya
              yayılıp ayrıntıyı da maviye boyuyordu. Degrade yalnız kısa
              başlıkta (`display-ink`), ayrıntı düz. */}
          <h2 className={styles.story} data-ink="plain" data-poster-story="">
            <span className={cn("display-ink", styles.storyTitle)}>{story.title}</span>
            <span className="sr-only">: </span>
            <span className={styles.storyDetail}>{tieFigures(story.detail)}</span>
          </h2>
          <div className={styles.headMeta}>
            <span>{S.close.replace("{date}", dateShort)}</span>
            {action}
          </div>
        </div>
        {anchor && (
          <p className={styles.anchor}>
            <span className={styles.anchorName}>{K.figIndex}</span>
            <span className={cn(styles.anchorValue, directionText(directionOf(anchor.change)))}>
              <RollingFigure value={pct(anchor.change)} />
            </span>
          </p>
        )}
      </header>

      <section className={styles.stage} aria-labelledby={`${poster.date}-skyline`}>
        <div className={styles.stageHead}>
          <h3 id={`${poster.date}-skyline`}>{K.title}</h3>
          <ul className={styles.legend}>
            <li>
              <span aria-hidden className={cn(styles.key, styles.keyWidth)} />
              {K.legendWidth}
            </li>
            <li>
              <span aria-hidden className={cn(styles.key, styles.keyHeight)} />
              {K.legendHeight}
            </li>
            <li>
              <span aria-hidden className={cn(styles.key, styles.keyHorizon)} />
              {K.legendHorizon}
            </li>
          </ul>
          <p className={styles.hint}>{K.hint}</p>
        </div>
        {stocks.length > 0 && breadth && (
          <Skyline
            stocks={stocks}
            districts={districts}
            names={names}
            logos={logos}
            sized={sized}
            locale={locale}
            text={K}
            adv={breadth.advancing}
            dec={breadth.declining}
          />
        )}
      </section>

      <dl className={styles.figures}>
        {breadth && (
          <div className={styles.measure}>
            <dt>{K.figBreadth}</dt>
            <dd className={styles.counts}>
              <span className="text-up">
                <RollingFigure value={String(breadth.advancing)} />
              </span>
              <span className={styles.slash} aria-hidden>
                /
              </span>
              <span className="text-down">
                <RollingFigure value={String(breadth.declining)} delayMs={FIGURE_STAGGER_MS} />
              </span>
            </dd>
            <dd className={styles.figVisual}>
              <BreadthStrip breadth={breadth} label={stripLabel} />
              {breadth.unchanged > 0 && <span className={styles.flatCount}>{L.flatCount.replace("{n}", String(breadth.unchanged))}</span>}
            </dd>
          </div>
        )}
        {strongest && (
          <div className={styles.measure}>
            <dt>{K.figStrongest}</dt>
            <dd className={cn(styles.figValue, directionText(directionOf(strongest.change)))}>{pct(strongest.change)}</dd>
            <dd className={styles.figName}>{names[strongest.key]}</dd>
          </div>
        )}
        {weakest && weakest !== strongest && (
          <div className={styles.measure}>
            <dt>{K.figWeakest}</dt>
            <dd className={cn(styles.figValue, directionText(directionOf(weakest.change)))}>{pct(weakest.change)}</dd>
            <dd className={styles.figName}>{names[weakest.key]}</dd>
          </div>
        )}
        {others.length > 0 && (
          <div className={styles.measure}>
            <dt>{K.otherIndices}</dt>
            <dd className={styles.indexList}>
              {others.map((move) => (
                <span key={move.symbol} className={styles.indexRow}>
                  <span>{posterName(move.symbol, locale)}</span>
                  <span className={directionText(directionOf(move.change))}>{pct(move.change)}</span>
                </span>
              ))}
            </dd>
          </div>
        )}
      </dl>

      <div className={styles.share}>
        <span>{K.shareTitle}</span>
        <a href={imageHref()} target="_blank" rel="noopener">
          {K.shareWide}
        </a>
        <a href={imageHref("?bicim=dikey")} target="_blank" rel="noopener">
          {K.shareTall}
        </a>
      </div>

      <div className={styles.notes}>
        <p>{L.storyNote}</p>
        <p>{L.basisNote.replace("{date}", dateShort).replace("{prev}", formatEtDateCompact(poster.prevDate, locale))}</p>
        <p>{sized ? K.sizeNote.replace("{date}", dateShort) : K.sizeMissing}</p>
        {clipped && <p>{K.clipNote.replace("{hi}", formatPercentPlain(domain.hi, locale, SCALE_DIGITS))}</p>}
        <p>{K.districtNote}</p>
        <p>{L.proxyNote}</p>
        <p>{L.breadthNote}</p>
      </div>
    </div>
  );
}
