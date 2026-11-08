import { hasActual } from "@/lib/day-flow";
import type { EconomicEventRow } from "@/lib/schema";

/**
 * Ana sayfanın üç ölçü panelinin saf hesabı — bülten kartının "Günün
 * Verileri" seçimi ve Dünya Piyasaları ile Günün Hareketleri'nin ortak
 * şerit ölçeği (6 Kasım görsel tur). Düz modül: sunucu bileşenleri ve
 * testler (tests/home-figures.test.ts) okuyor.
 */

/* --------------------------------------------------------------------------
   Ortak şerit ölçeği
   -------------------------------------------------------------------------- */

/**
 * Dünya Piyasaları tabanı (yüzde puan). Ülke fonlarının sakin günü ±%0,3;
 * taban olmasaydı %0,3'lük satır rayın ucuna kadar uzar ve sakin gün
 * "sert gün" gibi okunurdu. Bülten bandının tabanıyla aynı gerekçe
 * (`LEDGER_SCALE_FLOOR`, lib/brief-ledger.ts) ve aynı değer.
 */
export const WORLD_LANE_FLOOR = 1;

/**
 * Günün Hareketleri tabanı. Endeks üyelerinin en çok yükselen ve düşen beşi
 * sakin bir günde bile ±%3 civarında; %1'lik taban orada hiçbir şeyi
 * değiştirmezdi. %3: tek hissenin "dikkat çeken" hareketinin alt sınırı
 * gibi okunuyor — en büyük hareket %2,4 ise ray yarım dolu kalıyor ve gün
 * gerçekten sakin görünüyor.
 */
export const MOVERS_LANE_FLOOR = 3;

/**
 * Panelin bütün satırları için TEK ölçek: en büyük mutlak değer ya da taban.
 * Satır başına ölçek her satırı rayın ucuna götürür ve kıyas kaybolur
 * (CLAUDE.md "karşılaştırılan büyüklük bir de ÇİZGİ olarak okunur").
 * Bilinmeyen değer (null) hesaba girmez.
 */
export function sharedLaneScale(values: readonly (number | null | undefined)[], floor: number): number {
  let max = floor;
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) max = Math.max(max, Math.abs(value));
  }
  return max;
}

/* --------------------------------------------------------------------------
   Bülten kartının açıklanan verileri
   -------------------------------------------------------------------------- */

/** Kartta en çok kaç açıklama (endeks şeridinin altındaki ölçü sırası). */
const BRIEF_RELEASES_MAX = 2;

/**
 * Bültenin anlattığı açıklamalar: anlatılan seansın günü ile bültenin
 * yazıldığı gün arasında (ikisi dahil, ET), YÜKSEK etkili ve gerçekleşeni
 * gelmiş satırlar. Bültenin yazıldığı gün yalnız yayın saatinden önce
 * açıklananlar girer — 09:00 ET'de yazılan bülten 10:00'daki veriyi
 * anlatamaz ve kartta onun yanında durması "bülten bunu yazdı" gibi
 * okunurdu. Saatsiz satır yayın gününde girmez (ne zaman açıklandığı
 * bilinmiyor; uydurma kesinlik yok).
 *
 * Sıra: önce gün, sonra saat (okurun gördüğü olay sırası). Girdi bozulmaz.
 */
export function briefReleases(
  rows: readonly EconomicEventRow[],
  {
    from,
    briefDate,
    publishTimeEt,
    limit = BRIEF_RELEASES_MAX,
  }: { from: string; briefDate: string; publishTimeEt: string; limit?: number },
): EconomicEventRow[] {
  return rows
    .filter((row) => {
      if (row.importance !== "high" || !hasActual(row.actual)) return false;
      if (row.eventDate < from || row.eventDate > briefDate) return false;
      if (row.eventDate === briefDate) return !!row.eventTimeEt && row.eventTimeEt <= publishTimeEt;
      return true;
    })
    .sort(
      (a, b) => a.eventDate.localeCompare(b.eventDate) || (a.eventTimeEt ?? "99").localeCompare(b.eventTimeEt ?? "99"),
    )
    .slice(0, limit);
}
