import { MotionExperience } from "@/components/motion/PremiumMotion";
import polish from "@/components/motion/UtilityExperience.module.css";
import { BreadcrumbJsonLd } from "@/components/seo/JsonLd";
import { BiggerGame } from "@/components/puzzle/BiggerGame";
import { GameNav } from "@/components/puzzle/GameNav";
import { EmptyState, PageHeader } from "@/components/ui/primitives";
import { getI18n } from "@/lib/i18n";
import { pageMetadata } from "@/lib/page-meta";
import { absoluteUrl } from "@/lib/site";
import { puzzleDayKey } from "@/lib/stock-puzzle";
import { biggerPool } from "@/lib/stock-puzzle-data";

export const generateMetadata = pageMetadata({
  path: "/bulmaca/hangisi-buyuk",
  tr: {
    title: "Hangisi Büyük? Piyasa Değeri Oyunu",
    description: "İki ABD şirketi, tek soru: hangisinin piyasa değeri daha büyük? Bildikçe zorlaşan seri, en iyi skorunu geç.",
  },
  en: {
    title: "Which Is Bigger? Market Cap Game",
    description: "Two US companies, one question: which has the larger market cap? A streak that gets harder as you go.",
  },
});

/**
 * "Hangisi Büyük?" — Hisseyi Bil'in yanındaki ikinci oyun (29 Ekim).
 * Kurallar `lib/bigger-game.ts`, ekran `components/puzzle/BiggerGame.tsx`,
 * havuz `biggerPool` (Hisseyi Bil'in 200 şirketi). Oyun şeridi
 * (`GameNav`) iki oyunu ve arşivi bağlıyor.
 *
 * Piyasa değeri son fiyat × hisse sayısı (`getCompanies`); künye panelin
 * altında. Havuz okunamazsa boş durum — oyun uydurma değerle açılmaz.
 */
export default async function BiggerGamePage() {
  const { locale, t } = await getI18n();
  const L = t.stockPuzzle;
  const G = L.games;
  const pool = await biggerPool(locale);
  const path = "/bulmaca/hangisi-buyuk";
  return (
    <MotionExperience className={polish.page}>
      <BreadcrumbJsonLd locale={locale} items={[{ name: L.title, path: "/bulmaca" }, { name: G.biggerTitle, path }]} />
      <PageHeader title={G.biggerTitle} subtitle={G.biggerSubtitle} />
      <GameNav active="bigger" labels={L} />
      {pool.length >= 2 ? (
        <>
          <BiggerGame pool={pool} labels={L} locale={locale} shareUrl={absoluteUrl(path, locale)} seed={puzzleDayKey()} />
          <p className="text-small text-muted">{G.biggerNote}</p>
        </>
      ) : (
        <EmptyState title={L.unavailableTitle} hint={G.biggerUnavailable} />
      )}
    </MotionExperience>
  );
}
