import type { StockPuzzleLabels } from "@/lib/i18n/dictionaries/stock-puzzle";

/* ANA SAYFA KARTINA YALNIZ OKUDUĞU METİNLER (14 Kasım 2026, performans
   denetimi). `PuzzleTeaser` bir istemci bileşeni ve ona `t.stockPuzzle`
   ad alanının TAMAMI gidiyordu: bulmaca sayfasının ipuçları, kurallar,
   paylaşım metinleri dahil ~8 KB, her ana sayfa yanıtının RSC yükünde
   ikinci kez. Kart bunlardan yirmi ikisini okuyor. Liste burada, düz
   modülde: sunucu (app/(app)/page.tsx) süzer, istemci tipini kullanır.
   Yeni bir metin okuyan kart, anahtarı buraya ekler (tip denetimi eksik
   anahtarı derlemede yakalar). */
export const PUZZLE_TEASER_KEYS = [
  "countdown",
  "distribution",
  "grade",
  "guessCount",
  "homeClues",
  "homeContinue",
  "homeFirstClue",
  "homeIdle",
  "homeLast",
  "homeLeft",
  "homeLost",
  "homePlay",
  "homePlaying",
  "homeResult",
  "homeTitle",
  "homeWaiting",
  "homeWon",
  "next",
  "noData",
  "statsNote",
  "streak",
  "tile",
] as const satisfies readonly (keyof StockPuzzleLabels)[];

export type PuzzleTeaserLabels = Pick<StockPuzzleLabels, (typeof PUZZLE_TEASER_KEYS)[number]>;

export function puzzleTeaserLabels(labels: StockPuzzleLabels): PuzzleTeaserLabels {
  return Object.fromEntries(PUZZLE_TEASER_KEYS.map((key) => [key, labels[key]])) as PuzzleTeaserLabels;
}
