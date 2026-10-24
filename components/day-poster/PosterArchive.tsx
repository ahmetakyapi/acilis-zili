import { Suspense } from "react";
import { GuideHint } from "@/components/article/GuideHint";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { MotionExperience, ScrollProgress } from "@/components/motion/PremiumMotion";
import polish from "@/components/motion/UtilityExperience.module.css";
import { DataError, DataStamp, EmptyState, PageHeader, Panel, PanelHeader, PanelLink, Skeleton } from "@/components/ui/primitives";
import { SECTOR_FUNDS } from "@/db/seed/symbols";
import { CARD_INDEX_NAMES } from "@/lib/day-card";
import { posterScale, type DayPoster } from "@/lib/day-poster";
import { getPosterArchive } from "@/lib/day-poster-data";
import type { Dictionary, Locale } from "@/lib/i18n";
import { cn, directionOf, directionText, formatEtDateLong, formatPercent } from "@/lib/utils";
import { DayPosterCanvas } from "./DayPosterCanvas";
import { posterSceneData } from "./DayPosterView";
import { BreadthStrip, SectorLanes } from "./PosterMarks";
import styles from "./PosterArchive.module.css";

/**
 * GÜNÜN POSTERİ — en son seans ve arşiv, `/gun` (24 Ekim; 25 Ekim'de
 * yeniden kuruldu).
 *
 * İLK SÜRÜM JENERİK BİR TABLOYDU: adı "Posterler" ama sayfada poster yoktu;
 * her satırda on bir dolu bloklu histogram ("tablo programı" görünümü,
 * sahibinin 10 Ekim itirazı) ve 1280'de satırın iki yanında ~600 piksel
 * boşluk. Şimdi sayfa kardeşi Günün Grafiği'nin düzeninde
 * (`app/(app)/gunun-grafigi/page.tsx`): başlık → ana görsel (en son
 * seansın mürekkep sahnesi, yanında okunan karşılığı) → arşiv ızgarası →
 * damga → rehber (CLAUDE.md ekran sırası).
 *
 * ARŞİV KARTI POSTERİN KÜÇÜK HÂLİ: genişlik şeridi (künyedekiyle aynı
 * çizim, `BreadthStrip`) ve on bir sektör kulvarı (`SectorLanes`, sahneyle
 * aynı sıra ve aynı ölçek). Kart tuval DEĞİL, sunucuda çizilen HTML:
 * otuz tuval otuz ayrı istemci etkisi ve sayfa açılırken otuz sahne
 * demekti; kulvarlar zaten sahnenin statik son karesi. Sahnenin kendisi
 * yalnız en üstteki seansta oynuyor.
 *
 * AD TEK: menü ve sayfa "Günün Posteri", arşiv bölümü ve posterden dönüş
 * bağlantısı "Poster Arşivi".
 *
 * Kabuk veri beklemez; gövde kendi Suspense sınırında akıyor.
 */
export function PosterArchive({ locale, t }: { locale: Locale; t: Dictionary }) {
  return (
    <MotionExperience className={polish.page}>
      <ScrollProgress />
      <PageHeader title={t.daySignature.poster.title} subtitle={t.daySignature.archive.subtitle} />
      <Suspense fallback={<ArchiveSkeleton />}>
        <ArchiveBody locale={locale} t={t} />
      </Suspense>
      <GuideHint label={t.guide.contextLabel} locale={locale} slugs={["sektor-rotasyonu", "endeks", "etf"]} className="pt-1" />
    </MotionExperience>
  );
}

const SKELETON_CARDS = 6;

function ArchiveSkeleton() {
  return (
    <>
      <Panel aria-hidden>
        <div className={styles.latest}>
          <Skeleton className="aspect-[360/334] w-full max-w-[520px]" />
          <Skeleton className="h-40 w-full" />
        </div>
      </Panel>
      <Panel aria-hidden>
        <ul className={styles.grid}>
          {Array.from({ length: SKELETON_CARDS }, (_, index) => (
            <li key={index}>
              <Skeleton className="h-48 w-full" />
            </li>
          ))}
        </ul>
      </Panel>
    </>
  );
}

function sectorNamer(locale: Locale) {
  return (symbol: string) => {
    const fund = SECTOR_FUNDS.find((entry) => entry.symbol === symbol);
    return fund ? (locale === "tr" ? fund.nameTr : fund.nameEn) : symbol;
  };
}

function stripLabel(poster: DayPoster, t: Dictionary) {
  const b = poster.breadth;
  if (!b) return "";
  return t.daySignature.seal.stripLabel
    .replace("{adv}", String(b.advancing))
    .replace("{dec}", String(b.declining))
    .replace("{flat}", String(b.unchanged));
}

function lanesLabel(poster: DayPoster, t: Dictionary) {
  const up = poster.sectors.filter((move) => move.change > 0).length;
  const down = poster.sectors.filter((move) => move.change < 0).length;
  return t.daySignature.archive.sectorsLabel.replace("{up}", String(up)).replace("{down}", String(down));
}

async function ArchiveBody({ locale, t }: { locale: Locale; t: Dictionary }) {
  const A = t.daySignature.archive;
  const read = await getPosterArchive();
  if (read.state === "error") {
    return (
      <Panel>
        <DataError message={t.data.failed} hint={t.data.failedHint} />
      </Panel>
    );
  }
  const [latest, ...rest] = read.posters;
  if (!latest) {
    return (
      <Panel>
        <EmptyState title={A.empty} scene="chart" />
      </Panel>
    );
  }

  const sectorName = sectorNamer(locale);
  const pct = (value: number) => formatPercent(value, locale);

  return (
    <>
      <Panel>
        <PanelHeader
          title={A.latestTitle}
          meta={formatEtDateLong(latest.date, locale)}
          action={<PanelLink href={`/gun/${latest.date}`}>{A.openPoster}</PanelLink>}
        />
        <div className={styles.latest}>
          <figure
            className={styles.figure}
            aria-label={t.daySignature.poster.sceneLabel.replace("{date}", formatEtDateLong(latest.date, locale))}
          >
            <DayPosterCanvas data={posterSceneData(latest)} />
          </figure>
          <div className={styles.readout}>
            <dl className={styles.indices}>
              {latest.indices.map((move) => (
                <div key={move.symbol} className={styles.measure}>
                  <dt>{CARD_INDEX_NAMES[move.symbol] ?? move.symbol}</dt>
                  <dd className={directionText(directionOf(move.change))}>{pct(move.change)}</dd>
                </div>
              ))}
            </dl>
            {latest.breadth && (
              <div className={styles.breadth}>
                <span className={styles.label}>{t.daySignature.seal.breadth}</span>
                <BreadthStrip animate breadth={latest.breadth} label={stripLabel(latest, t)} />
                <span className={styles.counts} aria-hidden>
                  {t.daySignature.seal.advancing.replace("{n}", String(latest.breadth.advancing))}
                  <span className={styles.sep}>·</span>
                  {t.daySignature.seal.declining.replace("{n}", String(latest.breadth.declining))}
                </span>
              </div>
            )}
            {/* Sektörlerin sırası, sahnedeki kulvarlarla aynı (güçlüden
                zayıfa). İlk kurulumda burada yalnız en güçlü ve en zayıf
                vardı ve sağ sütun sahnenin 482 pikselinin 284'ünde
                bitiyordu; on bir satır iki sütunda boşluğu dolduruyor
                (ölçüm PosterArchive.module.css'te). */}
            <div className={styles.sectors}>
              <span className={styles.label}>{A.sectorsTitle}</span>
              <ol className={styles.ranking}>
                {latest.sectors.map((move) => (
                  <li key={move.symbol}>
                    <span className={styles.rankName}>{sectorName(move.symbol)}</span>
                    <span className={cn(styles.rankValue, directionText(directionOf(move.change)))}>{pct(move.change)}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      </Panel>

      {rest.length > 0 && (
        <Panel>
          <PanelHeader title={A.title} meta={A.listMeta.replace("{n}", String(rest.length))} />
          <ul className={styles.grid}>
            {rest.map((poster) => (
              <li key={poster.date}>
                <ArchiveCard poster={poster} locale={locale} t={t} />
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <DataStamp source="alpaca" at={read.fetchedAt} locale={locale} labels={t.data} />
    </>
  );
}

function ArchiveCard({ poster, locale, t }: { poster: DayPoster; locale: Locale; t: Dictionary }) {
  const A = t.daySignature.archive;
  const S = t.daySignature.seal;
  const sectorName = sectorNamer(locale);
  const anchor = poster.indices.find((move) => move.symbol === "SPY");
  const strongest = poster.sectors[0];
  const weakest = poster.sectors[poster.sectors.length - 1];
  const date = formatEtDateLong(poster.date, locale);
  const pct = (value: number) => formatPercent(value, locale);
  return (
    <Link
      href={`/gun/${poster.date}`}
      className={styles.card}
      aria-label={A.cardLabel.replace("{date}", date).replace("{anchor}", anchor ? pct(anchor.change) : "")}
    >
      <span className={styles.cardHead}>
        <span className={styles.cardDate}>{date}</span>
        {anchor && (
          <span className={styles.cardAnchor}>
            <span className={styles.cardAnchorName}>{CARD_INDEX_NAMES.SPY}</span>
            <span className={directionText(directionOf(anchor.change))}>{pct(anchor.change)}</span>
          </span>
        )}
      </span>
      {poster.breadth && (
        <span className={styles.cardBreadth}>
          <BreadthStrip breadth={poster.breadth} label={stripLabel(poster, t)} />
          <span className={styles.counts}>
            {S.advancing.replace("{n}", String(poster.breadth.advancing))}
            <span className={styles.sep}>·</span>
            {S.declining.replace("{n}", String(poster.breadth.declining))}
          </span>
        </span>
      )}
      <SectorLanes sectors={poster.sectors} scale={posterScale(poster)} label={lanesLabel(poster, t)} />
      <span className={styles.cardFoot}>
        <span>
          <span className={styles.footLabel}>{A.strongest}</span> {sectorName(strongest.symbol)}{" "}
          <span className={cn(styles.footValue, directionText(directionOf(strongest.change)))}>{pct(strongest.change)}</span>
        </span>
        <span>
          <span className={styles.footLabel}>{A.weakest}</span> {sectorName(weakest.symbol)}{" "}
          <span className={cn(styles.footValue, directionText(directionOf(weakest.change)))}>{pct(weakest.change)}</span>
        </span>
      </span>
    </Link>
  );
}
