import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { PuzzleScreen } from "@/components/puzzle/PuzzleScreen";
import { getI18n } from "@/lib/i18n";
import { withLocale } from "@/lib/i18n/routing";
import { pageAlternates } from "@/lib/site";
import { isArchiveDay, puzzleDayKey, puzzleNumber } from "@/lib/stock-puzzle";

/**
 * Arşiv günü — geçmiş bir günün bulmacası (25 Ekim). Bugün `/bulmaca`ya
 * yönlenir; ilk bulmacadan önceki, geçersiz ve GELECEK günler 404 (yarının
 * bulmacası açılmaz, `isArchiveDay`). Cevap günlükteki kuralla: yalnız
 * bitmiş bulmacada.
 *
 * DİZİNE GİRMEZ (`noindex, follow`): her gün aynı oyunun bir kopyası; arama
 * sonucunda tek giriş `/bulmaca` ve arşiv listesi.
 */
export async function generateMetadata(props: PageProps<"/bulmaca/[gun]">): Promise<Metadata> {
  const { gun } = await props.params;
  const { locale, t } = await getI18n();
  if (!isArchiveDay(gun, puzzleDayKey())) return { robots: { index: false, follow: false } };
  return {
    title: `${t.stockPuzzle.title} #${puzzleNumber(gun)}`,
    description: t.stockPuzzle.archiveSubtitle,
    alternates: pageAlternates(`/bulmaca/${gun}`, locale),
    robots: { index: false, follow: true },
  };
}

export default async function ArchivePuzzlePage(props: PageProps<"/bulmaca/[gun]">) {
  const { gun } = await props.params;
  const today = puzzleDayKey();
  if (gun === today) {
    const { locale } = await getI18n();
    redirect(withLocale("/bulmaca", locale));
  }
  if (!isArchiveDay(gun, today)) notFound();
  return <PuzzleScreen day={gun} archive />;
}
