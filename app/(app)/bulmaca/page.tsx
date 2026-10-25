import { PuzzleScreen } from "@/components/puzzle/PuzzleScreen";
import { pageMetadata } from "@/lib/page-meta";
import { puzzleDayKey } from "@/lib/stock-puzzle";

export const generateMetadata = pageMetadata({
  path: "/bulmaca",
  tr: {
    title: "Hisseyi Bil: Günlük Hisse Bulmacası",
    description:
      "Günlük hisse bulmacası: grafiğin siluetinden, sektöründen ve piyasa değerinden günün ABD hissesini altı tahminde bul.",
  },
  en: {
    title: "Guess the Stock: Daily Stock Puzzle",
    description:
      "A daily stock puzzle: find the day's US stock in six guesses from its chart silhouette, sector and market cap.",
  },
});

/**
 * "Hisseyi Bil" — günlük hisse bulmacası (24 Ekim). Ekran
 * `components/puzzle/PuzzleScreen.tsx`; arşiv günü aynı ekranı
 * `/bulmaca/[gun]`den basar. Gerekçeler `lib/stock-puzzle.ts` ve
 * `lib/stock-puzzle-data.ts` başında.
 */
export default async function StockPuzzlePage() {
  return <PuzzleScreen day={puzzleDayKey()} archive={false} />;
}
