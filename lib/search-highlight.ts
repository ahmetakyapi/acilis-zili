import { foldForSearch } from "@/lib/search-fold";

/**
 * Sonuç satırında eşleşen parçanın yeri — KATLANMIŞ metinde aranır, özgün
 * metnin konumuyla döner.
 *
 * Palet eşleşmeyi `toLocaleLowerCase("tr-TR")` + `indexOf` ile arıyordu;
 * arama ucu ise harfleri katlıyor (`lib/search-fold.ts`). "sozluk" yazan
 * okur "Sözlük" satırını buluyor ama satırda hiçbir şey vurgulanmıyordu:
 * sonuç neden geldiğini söylemiyordu. Burada her karakter tek tek katlanır
 * ve katlanmış dizinin her harfi özgün metindeki yerini hatırlar; "F/K"
 * gibi ayraçlı metinde "fk" araması `F/K`nın tamamını işaretler.
 *
 * AYRI VE KÜÇÜK DOSYADA: palet istemcide çalışır; sıralama ve katalog
 * (`lib/search-catalog.ts`, `lib/search-site.ts`) sunucuda kalır ve
 * istemci demetine girmez.
 */
export function highlightRange(text: string, term: string): [number, number] | null {
  const needle = foldForSearch(term, "tr");
  if (!needle) return null;
  let folded = "";
  /** Katlanmış dizideki her harfin özgün metindeki [başlangıç, bitiş) yeri. */
  const spans: [number, number][] = [];
  let at = 0;
  for (const ch of text) {
    const piece = foldForSearch(ch, "tr");
    for (let i = 0; i < piece.length; i++) spans.push([at, at + ch.length]);
    folded += piece;
    at += ch.length;
  }
  const found = folded.indexOf(needle);
  if (found < 0) return null;
  return [spans[found][0], spans[found + needle.length - 1][1]];
}
