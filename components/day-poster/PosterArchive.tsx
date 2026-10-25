import Image from "next/image";
import { Suspense } from "react";
import { GuideHint } from "@/components/article/GuideHint";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { MotionExperience, ScrollProgress } from "@/components/motion/PremiumMotion";
import polish from "@/components/motion/UtilityExperience.module.css";
import { DataError, DataStamp, EmptyState, PageHeader, Panel, PanelHeader, PanelLink, Skeleton } from "@/components/ui/primitives";
import { CARD_INDEX_NAMES } from "@/lib/day-card";
import { POSTER_ANCHOR, type DayPoster } from "@/lib/day-poster";
import { getPosterArchive, getPosterSkyline, type PosterSkyline } from "@/lib/day-poster-data";
import type { Dictionary, Locale } from "@/lib/i18n";
import { cn, directionOf, directionText, formatEtDateLong, formatPercent } from "@/lib/utils";
import { PosterBoard } from "./PosterBoard";
import { BreadthStrip } from "./PosterMarks";
import { posterName, posterStoryText } from "./story";
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
 * ARŞİV KARTI POSTERİN KÜÇÜK HÂLİ (25 Ekim): günün silüetinin minyatürü
 * — Nasdaq 100'ün yüz binası, posterle aynı yerleşim — ve genişlik
 * şeridi. Minyatür statik bir SVG dosyası (`/gun/[tarih]/minyatur`,
 * gerekçesi orada): kartlar `img` ile tembel yükleniyor, sayfanın HTML'i
 * otuz siluetin 3.000 binasını taşımıyor. Kutunun oranı sabit
 * (`object-fit: contain`), yani dosya gelince kart kaymıyor. Siluetin
 * hareketli hâli yalnız en üstteki seansta oynuyor.
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
/** Minyatürün kutusu (sahne birimi; `mini` düzeni 320 en). Siluetin boyu
 *  güne göre değişiyor (en çok 2 × 52 + pay), kutu sabit ve dosya içine
 *  sığıyor. */
const MINI_W = 320;
const MINI_H = 110;

function ArchiveSkeleton() {
  return (
    <>
      <Panel aria-hidden>
        <div className={styles.skeleton}>
          <Skeleton className="h-16 w-3/4" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-[26rem] w-full" />
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

function stripLabel(poster: DayPoster, t: Dictionary) {
  const b = poster.breadth;
  if (!b) return "";
  return t.daySignature.seal.stripLabel
    .replace("{adv}", String(b.advancing))
    .replace("{dec}", String(b.declining))
    .replace("{flat}", String(b.unchanged));
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
  /* Kartın cümlesi ve en güçlü/zayıf sektörü mahallelerden; sembol
     tablosu istek başına bir kez okunuyor (`getSymbolNames` önbellekli). */
  const [skyline, ...skylines] = await Promise.all(read.posters.map((poster) => getPosterSkyline(poster)));

  return (
    <>
      {/* En son seans posterin kendi panosuyla: günün cümlesi, ölçüler,
          etiketli sahne (`PosterBoard`). İlk kurulumda burada sahne ile
          yanında ayrı bir okuma vardı; pano ikisini tek dilde birleştiriyor. */}
      <Panel className={styles.latest}>
        <PosterBoard
          poster={latest}
          skyline={skyline}
          locale={locale}
          t={t}
          action={<PanelLink href={`/gun/${latest.date}`}>{A.openPoster}</PanelLink>}
        />
      </Panel>

      {rest.length > 0 && (
        <Panel>
          <PanelHeader title={A.title} meta={A.listMeta.replace("{n}", String(rest.length))} />
          <ul className={styles.grid}>
            {rest.map((poster, index) => (
              <li key={poster.date}>
                <ArchiveCard poster={poster} skyline={skylines[index]} locale={locale} t={t} />
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <DataStamp source="alpaca" at={read.fetchedAt} locale={locale} labels={t.data} />
    </>
  );
}

function ArchiveCard({ poster, skyline, locale, t }: { poster: DayPoster; skyline: PosterSkyline; locale: Locale; t: Dictionary }) {
  const A = t.daySignature.archive;
  const S = t.daySignature.seal;
  const sectorName = (symbol: string) => posterName(symbol, locale);
  const story = posterStoryText(poster, skyline.districts, locale, t);
  const anchor = poster.indices.find((move) => move.symbol === POSTER_ANCHOR);
  const strongest = skyline.districts[0];
  const weakest = skyline.districts[skyline.districts.length - 1];
  const date = formatEtDateLong(poster.date, locale);
  const pct = (value: number) => formatPercent(value, locale);
  return (
    <Link
      href={`/gun/${poster.date}`}
      className={styles.card}
      aria-label={A.cardLabel.replace("{date}", date).replace("{sentence}", story.sentence)}
    >
      <span className={styles.cardHead}>
        <span className={styles.cardDate}>{date}</span>
        {anchor && (
          <span className={styles.cardAnchor}>
            <span className={styles.cardAnchorName}>{CARD_INDEX_NAMES[POSTER_ANCHOR]}</span>
            <span className={directionText(directionOf(anchor.change))}>{pct(anchor.change)}</span>
          </span>
        )}
      </span>
      {/* Günün cümlesinin kısa hâli: kart önce NE OLDUĞUNU söylüyor. */}
      <span className={styles.cardStory}>{story.title}</span>
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
      {/* Günün silueti, küçük ve durağan. İki tema iki dosya; görünmeyen
          `display: none` ve tembel olduğu için hiç inmiyor. Kartın adı
          `aria-label`da, minyatür süs (`alt=""`). */}
      <span className={styles.cardScene}>
        {(["acik", "koyu"] as const).map((theme) => (
          /* `unoptimized`: dosya zaten küçük bir SVG; optimize edici SVG'yi
             işlemiyor. Tembel yükleme `next/image`in varsayılanı. */
          <Image
            key={theme}
            src={`/gun/${poster.date}/minyatur/${theme}`}
            alt=""
            width={MINI_W}
            height={MINI_H}
            unoptimized
            className={theme === "koyu" ? styles.sceneDark : styles.sceneLight}
          />
        ))}
      </span>
      {strongest && weakest && (
        <span className={styles.cardFoot}>
          <span>
            <span className={styles.footLabel}>{A.strongest}</span> {sectorName(strongest.key)}{" "}
            <span className={cn(styles.footValue, directionText(directionOf(strongest.change)))}>{pct(strongest.change)}</span>
          </span>
          <span>
            <span className={styles.footLabel}>{A.weakest}</span> {sectorName(weakest.key)}{" "}
            <span className={cn(styles.footValue, directionText(directionOf(weakest.change)))}>{pct(weakest.change)}</span>
          </span>
        </span>
      )}
    </Link>
  );
}
