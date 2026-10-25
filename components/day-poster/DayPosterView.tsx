import { CaretLeft, CaretRight } from "@phosphor-icons/react/dist/ssr";
import { GuideHint } from "@/components/article/GuideHint";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { MotionExperience, ScrollProgress } from "@/components/motion/PremiumMotion";
import polish from "@/components/motion/UtilityExperience.module.css";
import { DataStamp, PageHeader, Panel, PanelLink } from "@/components/ui/primitives";
import type { DayPoster } from "@/lib/day-poster";
import type { SceneStock } from "@/lib/day-poster-scene";
import type { Dictionary, Locale } from "@/lib/i18n";
import { formatEtDateLong } from "@/lib/utils";
import { PosterBoard } from "./PosterBoard";
import styles from "./DayPoster.module.css";

/**
 * GÜNÜN POSTERİ — `/gun/[tarih]` sayfasının gövdesi (24 Ekim; 25 Ekim'de
 * yeniden kuruldu).
 *
 * Ekran düzeni CLAUDE.md sırasıyla: başlık (sağda tek denetim: önceki /
 * sonraki seans) → tek panelde posterin panosu (günün cümlesi, genişlik,
 * her hissenin noktası sektör sektör, künye kartı, künyeler; gerekçe
 * `PosterBoard.tsx`) → damga → rehber.
 *
 * İLK SÜRÜMÜN AYRI TABLOSU KALKTI (25 Ekim): sahnenin yanında sektör ve
 * endeks tablosu duruyordu, çünkü sahnedeki kulvarların adı yoktu. Artık
 * her kulvar kendi adını ve değerini taşıyor; tablo aynı on beş sayının
 * ikinci kopyası olurdu.
 */
export function DayPosterView({
  poster,
  scene,
  fetchedAt,
  prevHref,
  nextHref,
  locale,
  t,
}: {
  poster: DayPoster;
  scene: { stocks: SceneStock[]; unplaced: number; sized: boolean };
  fetchedAt: string;
  prevHref: string | null;
  nextHref: string | null;
  locale: Locale;
  t: Dictionary;
}) {
  const L = t.daySignature.poster;
  const dateLong = formatEtDateLong(poster.date, locale);

  return (
    <MotionExperience className={polish.page}>
      <ScrollProgress />
      <PageHeader
        className={styles.masthead}
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

      <Panel className={styles.panel}>
        <PosterBoard
          poster={poster}
          stocks={scene.stocks}
          sized={scene.sized}
          unplaced={scene.unplaced}
          locale={locale}
          t={t}
          action={<PanelLink href="/gun">{L.archiveLink}</PanelLink>}
        />
      </Panel>

      <DataStamp source="alpaca" at={fetchedAt} locale={locale} labels={t.data} />
      <GuideHint label={t.guide.contextLabel} locale={locale} slugs={["sektor-rotasyonu", "endeks", "etf"]} className="pt-1" />
    </MotionExperience>
  );
}
