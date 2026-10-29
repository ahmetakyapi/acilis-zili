import { MotionExperience } from "@/components/motion/PremiumMotion";
import polish from "@/components/motion/UtilityExperience.module.css";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { BreadcrumbJsonLd } from "@/components/seo/JsonLd";
import { GameNav } from "@/components/puzzle/GameNav";
import { PuzzleArchive, type ArchiveItem } from "@/components/puzzle/PuzzleArchive";
import { EmptyState, PageHeader } from "@/components/ui/primitives";
import { getI18n } from "@/lib/i18n";
import { pageMetadata } from "@/lib/page-meta";
import { PUZZLE_ZONE, archiveDays, puzzleDayKey, puzzleNumber } from "@/lib/stock-puzzle";
import { dailySilhouette } from "@/lib/stock-puzzle-data";

export const generateMetadata = pageMetadata({
  path: "/bulmaca/arsiv",
  tr: {
    title: "Hisseyi Bil Arşivi",
    description: "Geçmiş günlerin hisse bulmacaları: kaçırdığın günleri oyna, arşivden çözdüklerin serini bozmaz.",
  },
  en: {
    title: "Guess the Stock Archive",
    description: "Past daily stock puzzles: play the days you missed; archive solves never break your streak.",
  },
});

/** Izgaradaki gün sayısı — her kart bir siluet hesabı (gün başına önbellekli). */
const ARCHIVE_PAGE_DAYS = 30;

/**
 * Arşiv (25 Ekim): bugün ve geçmiş günler, yeniden eskiye. Sunucu yalnız
 * gün, numara ve siluet minyatürü (herkese açık ilk ipucu) basar; okurun
 * durumu ve çözülen günün logosu tarayıcıdaki geçmişten (`PuzzleArchive`).
 */
export default async function PuzzleArchivePage() {
  const { locale, t } = await getI18n();
  const L = t.stockPuzzle;
  const today = puzzleDayKey();
  const days = [today, ...archiveDays(today, ARCHIVE_PAGE_DAYS - 1)];
  const format = new Intl.DateTimeFormat(locale === "en" ? "en-US" : "tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: PUZZLE_ZONE,
  });
  const silhouettes = await Promise.all(days.map((day) => dailySilhouette(day)));
  const items: ArchiveItem[] = days.map((day, i) => ({
    day,
    number: puzzleNumber(day),
    dateLabel: format.format(new Date(`${day}T12:00:00Z`)),
    points: silhouettes[i],
    today: day === today,
  }));

  return (
    <MotionExperience className={polish.page}>
      <BreadcrumbJsonLd locale={locale} items={[{ name: L.title, path: "/bulmaca" }, { name: L.archiveLink, path: "/bulmaca/arsiv" }]} />
      <PageHeader title={L.archiveTitle} subtitle={L.archiveSubtitle} />
      <GameNav active="archive" labels={L} />
      <PuzzleArchive items={items} labels={L} />
      {items.length === 1 && (
        <EmptyState compact title={L.archiveLink} hint={L.archiveEmpty} action={<Link href="/bulmaca" className="font-semibold text-primary-ink">{L.backToToday}</Link>} />
      )}
    </MotionExperience>
  );
}
