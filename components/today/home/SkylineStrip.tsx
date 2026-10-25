import type { CSSProperties } from "react";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { PosterAct } from "@/components/day-poster/PosterAct";
import { SkyDefs, SkyLabels } from "@/components/day-poster/SkyMarks";
import { posterName, posterStoryOf, posterStoryText } from "@/components/day-poster/story";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { Skeleton } from "@/components/ui/primitives";
import { POSTER_ANCHOR, bellEnergy } from "@/lib/day-poster";
import { getDayPoster, getLatestPosterDate, getPosterSkyline } from "@/lib/day-poster-data";
import { buildingPath, clipMark, skylineLayout, type SkyLayout, type SkyStock } from "@/lib/day-skyline";
import type { Dictionary, Locale } from "@/lib/i18n";
import { logoSrc } from "@/lib/logos";
import type { MarketStatus } from "@/lib/market-hours";
import { cn, directionOf, directionText, formatEtDateCompact, formatPercent } from "@/lib/utils";
import { BellEnergySource } from "../BellEnergySource";
import { tileFeedsBell } from "../day-tile";
import styles from "./SkylineStrip.module.css";

/**
 * SON SEANSIN SİLUETİ — ana sayfada kahramanın hemen altında, tam genişlik
 * ince bir şerit (25 Ekim).
 *
 * KAHRAMANDAN ÇIKTI. Son seans 24 Ekim'den beri kahramanın içinde, seans
 * çipinin altında bir karoydu (gri kutuda nokta minyatürü, günün cümlesi,
 * kırmızı/yeşil şerit). Sahibi: "Kötü gözüküyor; daha farklı bir yere
 * taşıyalım ya da daha az göz yoran, görsel bütünlüğü bozmayan, daha
 * premium hissettiren bir şekle alalım." İkisi birden: kahraman yalnız
 * geri sayımı taşıyor (sayaç nefes alıyor), son seans kendi panelinde ve
 * kendi diliyle — Günün Posteri'nin siluetinin alçak hâli (aynı yerleşim,
 * `lib/day-skyline.ts`, `strip*` düzenleri; büyük şirketlerin çatısında
 * yalnız logo). Panelin tamamı posterin bağlantısı.
 *
 * HER SEANSTA en yeni TAMAMLANMIŞ seans (`getLatestPosterDate`); künye
 * tarihi söylüyor ("23 Eki Kapanışı"), seans sürerken bile hangi günü
 * anlattığı belli (CLAUDE.md "Veri dürüstlüğü" 4). Zilin şiddeti yalnız
 * bitmiş seansın kendi şeridinden (`tileFeedsBell`, gerekçe day-tile.ts).
 *
 * VERİ DÜRÜSTLÜĞÜ: kaynak Günün Posteri (`getDayPoster`), posterle aynı
 * çağrı; şeritteki "38 Yükseldi" ile posterdeki aynı sayı. Poster yoksa
 * (veri eksik, sağlayıcı düştü) şerit hiç basılmıyor.
 *
 * Kendi Suspense sınırında (page.tsx); yer tutucu şeridin ölçüsünü
 * ayırıyor (`SkylineStripSkeleton`), sayfa kaymıyor.
 */

/** Şeridin iki düzeni — SkylineStrip.module.css'teki kap sorgusuyla. */
const STRIP_MODES = ["stripNarrow", "stripWide"] as const;
const PERCENT_DIGITS = 2;

export async function SkylineStrip({ status, locale, t }: { status: MarketStatus; locale: Locale; t: Dictionary }) {
  const date = await getLatestPosterDate(status);
  const read = await getDayPoster(date);
  if (read.state !== "ok") return null;
  const poster = read.poster;
  const { stocks, districts } = await getPosterSkyline(poster);
  if (stocks.length === 0) return null;
  const T = t.daySignature.strip;
  const S = t.daySignature.seal;
  const story = posterStoryText(poster, districts, locale, t);
  const tone = posterStoryOf(poster, districts).tone;
  const close = S.close.replace("{date}", formatEtDateCompact(poster.date, locale));
  const anchor = poster.indices.find((move) => move.symbol === POSTER_ANCHOR);
  const breadth = poster.breadth;
  const pct = (value: number) => formatPercent(value, locale, PERCENT_DIGITS);
  const logos = Object.fromEntries(
    stocks.flatMap((stock) => {
      const src = logoSrc(stock.symbol, null);
      return src ? [[stock.symbol, src] as const] : [];
    }),
  );
  const names = Object.fromEntries(districts.map((district) => [district.key, posterName(district.key, locale)]));
  const layouts = STRIP_MODES.map((mode) => skylineLayout({ stocks, districts, mode }));

  return (
    <section className={cn("panel", styles.panel)} data-home-section="skyline" aria-labelledby="son-seans-silueti">
      <Link
        href={`/gun/${poster.date}`}
        className={styles.link}
        aria-label={T.label.replace("{close}", close).replace("{sentence}", story.sentence)}
      >
        <span className={styles.head}>
          <span className={styles.titleRow}>
            <h2 id="son-seans-silueti" className={cn("text-read", styles.title)}>
              {T.title}
            </h2>
            <span className={styles.meta}>
              <span>{close}</span>
              {anchor && (
                <span>
                  {posterName(POSTER_ANCHOR, locale)}{" "}
                  <span className={cn(styles.metaValue, directionText(directionOf(anchor.change)))}>{pct(anchor.change)}</span>
                </span>
              )}
              {breadth && (
                <span>
                  <span className="text-up">{S.advancing.replace("{n}", String(breadth.advancing))}</span>
                  {" · "}
                  <span className="text-down">{S.declining.replace("{n}", String(breadth.declining))}</span>
                </span>
              )}
            </span>
          </span>
          <span className={styles.story}>
            <span className={styles.storyTitle} data-tone={tone}>
              {story.title}
            </span>
            <span className={styles.storyDetail}>{story.detail}</span>
          </span>
          <span className={styles.open} aria-hidden>
            {T.open}
            <ArrowRight weight="bold" size={12} />
          </span>
        </span>

        <PosterAct act="strip" className={styles.scene}>
          {layouts.map((layout) => (
            <span key={layout.mode} className={styles.mode} data-mode={layout.mode} data-skyline="">
              {layout.rows.map((row, r) => (
                <StripRow key={r} layout={layout} rowIndex={r} stocks={stocks} logos={logos} names={names} pct={pct} />
              ))}
            </span>
          ))}
        </PosterAct>
      </Link>
      {tileFeedsBell(status, poster.date) && <BellEnergySource value={bellEnergy(poster.breadth)} />}
    </section>
  );
}

function StripRow({
  layout,
  rowIndex,
  stocks,
  logos,
  names,
  pct,
}: {
  layout: SkyLayout;
  rowIndex: number;
  stocks: SkyStock[];
  logos: Record<string, string>;
  names: Record<string, string>;
  pct: (value: number) => string;
}) {
  const row = layout.rows[rowIndex];
  const height = row.bottom - row.top;
  return (
    <span className={styles.row}>
      <svg viewBox={`0 ${row.top.toFixed(2)} ${layout.width} ${height.toFixed(2)}`} className={styles.svg} aria-hidden>
        <SkyDefs layout={layout} row={row} rowIndex={rowIndex} />
        <rect className={styles.water} x={0} y={0} width={layout.width} height={row.downH} />
        {row.buildings.map((b) => (
          <path
            key={b.i}
            d={buildingPath(b)}
            className={cn(styles.b, b.dir === 1 ? styles.up : b.dir === -1 ? styles.down : styles.flat)}
            data-sky-building=""
            data-dir={b.dir}
            style={{ "--d": `${b.delay.toFixed(3)}s` } as CSSProperties}
          />
        ))}
        {row.buildings
          .filter((b) => b.clip)
          .map((b) => {
            const m = clipMark(b);
            return <rect key={`c${b.i}`} className={styles.cut} x={m.x} y={m.y} width={m.w} height={m.h} />;
          })}
        <line className={styles.horizon} x1={0} x2={layout.width} y1={0} y2={0} />
        <SkyLabels layout={layout} row={row} rowIndex={rowIndex} stocks={stocks} logos={logos} className={styles.labels} />
      </svg>
      <span className={styles.districts} aria-hidden>
        {row.districts.map((span) => (
          <span
            key={span.key}
            className={styles.district}
            data-sky-district=""
            style={{ left: `${(span.x0 / layout.width) * 100}%`, width: `${((span.x1 - span.x0) / layout.width) * 100}%` }}
          >
            <span className={styles.districtName}>{names[span.key] ?? span.key}</span>
            <span className={cn(styles.districtValue, directionText(directionOf(span.change)))}>{pct(span.change)}</span>
          </span>
        ))}
      </span>
    </span>
  );
}

/** Yer tutucu: şeridin ölçüsünü ayırıyor (başlık + siluet + tabelalar). */
export function SkylineStripSkeleton() {
  return (
    <section className={cn("panel", styles.panel)} aria-hidden>
      <span className={styles.skeleton}>
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className={styles.skeletonScene} />
      </span>
    </section>
  );
}
