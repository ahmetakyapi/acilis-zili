import { CaretLeft, CaretRight } from "@phosphor-icons/react/dist/ssr";
import { GuideHint } from "@/components/article/GuideHint";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { MotionExperience, ScrollProgress } from "@/components/motion/PremiumMotion";
import polish from "@/components/motion/UtilityExperience.module.css";
import { DataStamp, PageHeader, Panel, PanelHeader, PanelLink } from "@/components/ui/primitives";
import { BreadthStrip } from "./PosterMarks";
import { SECTOR_FUNDS } from "@/db/seed/symbols";
import { CARD_INDEX_NAMES } from "@/lib/day-card";
import { posterScale, posterSeed, type DayPoster } from "@/lib/day-poster";
import type { Dictionary, Locale } from "@/lib/i18n";
import type { PosterSceneData } from "@/lib/ink/poster";
import { cn, directionOf, directionText, formatEtDateCompact, formatEtDateLong, formatPercent, formatPercentPlain } from "@/lib/utils";
import { DayPosterCanvas } from "./DayPosterCanvas";
import styles from "./DayPoster.module.css";

/**
 * GÜNÜN POSTERİ — `/gun/[tarih]` sayfasının gövdesi (24 Ekim).
 *
 * Ekran düzeni CLAUDE.md sırasıyla: başlık (sağda tek denetim: önceki /
 * sonraki seans) → ana görsel (mürekkep sahnesi; altında genişliğin
 * sayısı ve lejant) ve yanında OKUNAN karşılığı: sektör ve endeks
 * tablosu, kulvarlarla aynı sırada → künyeler panelin içinde hairline ile
 * → damga → rehber.
 *
 * TEKRAR YOK (25 Ekim): sahnenin altındaki "Endeksler" ve "Genişlik"
 * panelleri kaldırıldı. Endeksler tablonun son dört satırının, genişlik
 * sahnedeki noktaların kopyasıydı; genişliğin SAYISI (noktalar sayılmaz)
 * sahnenin hemen altına, şeridiyle birlikte indi.
 *
 * SAHNE SÜS DEĞİL, VERİ. Tuvaldeki her iz lejantta bir satıra, tablodaki
 * her satır bir kulvara karşılık geliyor; tuval `aria-hidden`, ekran
 * okuyucu tabloyu okuyor. Sahnenin kuralları `lib/ink/poster.ts` başında.
 */

/** Yüzde basamağı — ana sayfanın endeks kartları ve sektör siluetiyle aynı. */
const PERCENT_DIGITS = 2;
/** Ölçek künyesi tek ondalık: "±%1,8" — kulvar ucunun yaklaşık değeri. */
const SCALE_DIGITS = 1;

export function posterSceneData(poster: DayPoster): PosterSceneData {
  return {
    seed: posterSeed(poster.date),
    scale: posterScale(poster),
    sectors: poster.sectors.map((move) => move.change),
    indices: poster.indices.map((move) => move.change),
    breadth: poster.breadth
      ? { advancing: poster.breadth.advancing, unchanged: poster.breadth.unchanged, declining: poster.breadth.declining }
      : null,
  };
}

export function DayPosterView({
  poster,
  fetchedAt,
  prevHref,
  nextHref,
  locale,
  t,
}: {
  poster: DayPoster;
  fetchedAt: string;
  prevHref: string | null;
  nextHref: string | null;
  locale: Locale;
  t: Dictionary;
}) {
  const L = t.daySignature.poster;
  const dateLong = formatEtDateLong(poster.date, locale);
  const scene = posterSceneData(poster);
  const sectorName = (symbol: string) => {
    const fund = SECTOR_FUNDS.find((entry) => entry.symbol === symbol);
    return fund ? (locale === "tr" ? fund.nameTr : fund.nameEn) : symbol;
  };
  const pct = (value: number) => formatPercent(value, locale, PERCENT_DIGITS);
  const breadth = poster.breadth;

  return (
    <MotionExperience className={polish.page}>
      <ScrollProgress />
      <PageHeader
        title={L.title}
        subtitle={L.subtitle.replace("{date}", dateLong)}
        action={
          <nav className={styles.nav} aria-label={L.title}>
            {prevHref ? (
              <Link href={prevHref} scroll={false} className={styles.navLink} aria-label={L.prev} title={L.prev}>
                <CaretLeft weight="bold" size={16} aria-hidden />
              </Link>
            ) : (
              <span className={styles.navLink} aria-disabled="true">
                <CaretLeft weight="bold" size={16} aria-hidden />
              </span>
            )}
            {nextHref ? (
              <Link href={nextHref} scroll={false} className={styles.navLink} aria-label={L.next} title={L.next}>
                <CaretRight weight="bold" size={16} aria-hidden />
              </Link>
            ) : (
              <span className={styles.navLink} aria-disabled="true">
                <CaretRight weight="bold" size={16} aria-hidden />
              </span>
            )}
          </nav>
        }
      />

      <Panel>
        <PanelHeader
          title={L.sceneTitle}
          meta={t.daySignature.seal.close.replace("{date}", formatEtDateCompact(poster.date, locale))}
          action={<PanelLink href="/gun">{L.archiveLink}</PanelLink>}
        />
        <div className={styles.sceneGrid}>
          {/* SOL SÜTUN: sahne ve onu nasıl okuyacağın. SAĞ SÜTUN: sahnenin
              SAYILARI (tablo, altında genişlik). 1280'de ilk sürümde sahne
              y=837'de, tablo y=1021'de bitiyor, solda 184 piksel boşluk
              kalıyordu (lejant sağda tablonun üstündeydi). Lejant sahnenin
              altına, genişliğin sayısı tablonun altına inince iki sütun
              yakın boyda bitiyor (ölçüm DayPoster.module.css'te). */}
          <div className={styles.sceneCol}>
            <figure className={styles.figure} aria-label={L.sceneLabel.replace("{date}", dateLong)}>
              <DayPosterCanvas data={scene} />
            </figure>

            <div>
              <h3 className={styles.legendTitle}>{L.legendTitle}</h3>
              <ul className={styles.legend}>
                {breadth && (
                  <li><span aria-hidden className={cn(styles.mark, styles.markDots)} />{L.legendDots}</li>
                )}
                <li><span aria-hidden className={cn(styles.mark, styles.markLane)} />{L.legendLanes}</li>
                <li>
                  <span aria-hidden className={cn(styles.mark, styles.markBar)} />
                  {L.legendLength.replace("{scale}", `±${formatPercentPlain(scene.scale, locale, SCALE_DIGITS)}`)}
                </li>
                <li><span aria-hidden className={cn(styles.mark, styles.markBar)} />{L.legendColor}</li>
                {poster.indices.length > 0 && (
                  <li><span aria-hidden className={cn(styles.mark, styles.markIndex)} />{L.legendIndices}</li>
                )}
              </ul>
            </div>
          </div>

          {/* Tablo kulvarlarla aynı sırada. Endeksler yalnız burada (dört
              satır); ilk sürümde altındaki ayrı "Endeksler" paneli aynı dört
              sayıyı ikinci kez basıyordu, kaldırıldı. */}
          <div className={styles.sceneCol}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col" className={styles.rank}><span className="sr-only">#</span></th>
                  <th scope="col">{L.colSector}</th>
                  <th scope="col">{L.colFund}</th>
                  <th scope="col">{L.colChange}</th>
                </tr>
              </thead>
              <tbody>
                {poster.sectors.map((move, index) => (
                  <tr key={move.symbol}>
                    <td className={styles.rank}>{index + 1}</td>
                    <td className={styles.name}>{sectorName(move.symbol)}</td>
                    <td className={styles.fund}>{move.symbol}</td>
                    <td className={cn(styles.change, directionText(directionOf(move.change)))}>{pct(move.change)}</td>
                  </tr>
                ))}
                {poster.indices.map((move, index) => (
                  <tr key={move.symbol} className={index === 0 ? styles.groupStart : undefined}>
                    <td className={styles.rank} />
                    <td className={styles.name}>{CARD_INDEX_NAMES[move.symbol] ?? move.symbol}</td>
                    <td className={styles.fund}>{move.symbol}</td>
                    <td className={cn(styles.change, directionText(directionOf(move.change)))}>{pct(move.change)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {breadth ? (
              <div className={styles.breadth}>
                <h3 className={styles.legendTitle}>{t.daySignature.seal.breadth}</h3>
                <BreadthStrip
                  animate
                  breadth={breadth}
                  label={t.daySignature.seal.stripLabel
                    .replace("{adv}", String(breadth.advancing))
                    .replace("{dec}", String(breadth.declining))
                    .replace("{flat}", String(breadth.unchanged))}
                />
                <dl className={styles.figures}>
                  <div className={styles.measure}>
                    <dt>{L.breadthAdvancing}</dt>
                    <dd>{breadth.advancing}</dd>
                  </div>
                  <div className={styles.measure}>
                    <dt>{L.breadthDeclining}</dt>
                    <dd>{breadth.declining}</dd>
                  </div>
                  <div className={styles.measure}>
                    <dt>{L.breadthUnchanged}</dt>
                    <dd>{breadth.unchanged}</dd>
                  </div>
                </dl>
              </div>
            ) : (
              <p className={styles.breadthEmpty}>{L.breadthMissing}</p>
            )}

          </div>
        </div>
        <div className={styles.notes}>
          <p>
            {L.basisNote
              .replace("{date}", formatEtDateCompact(poster.date, locale))
              .replace("{prev}", formatEtDateCompact(poster.prevDate, locale))}
          </p>
          <p>{L.proxyNote}</p>
          {breadth && <p>{L.breadthNote}</p>}
        </div>
      </Panel>

      <DataStamp source="alpaca" at={fetchedAt} locale={locale} labels={t.data} />
      <GuideHint label={t.guide.contextLabel} locale={locale} slugs={["sektor-rotasyonu", "endeks", "etf"]} className="pt-1" />
    </MotionExperience>
  );
}
