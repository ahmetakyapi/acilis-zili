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
 * Panelin bütün satırları için TEK ölçek. Satır başına ölçek her satırı
 * rayın ucuna götürür ve kıyas kaybolur (CLAUDE.md "karşılaştırılan büyüklük
 * bir de ÇİZGİ olarak okunur"). Bilinmeyen değer (null) hesaba girmez.
 *
 * KARAR GEÇMİŞİ. 8 Kasım: en büyük mutlak değer ya da taban. 10 Kasım
 * (telefon turu): TEK UÇ DEĞER ÖLÇEĞİ BELİRLEMEZ — tabloların kuralı
 * (`lib/market-scales.ts` → `laneSpan`: ölçek uçtan İKİNCİ değerden, aşan
 * çubuk kola dayanır ve kesik uç taşır). Eski hâlde tek uç değerli günde
 * (−%6,93 · −%1,54 · −%1,20 …) öteki beş çubuk 13 piksele iniyordu
 * (390, kol 135 piksel) ve panel "bir satır + beş çizgi" gibi okunuyordu.
 * Uç değer: en büyük mutlak değer ikincinin `LANE_OUTLIER_RATIO` katını
 * aşıyorsa. O gün ölçek ikinci değerdir (tabandan küçük olmaz); uç satır
 * kola dayanır (`laneOverflows`), büyüklüğünü yanındaki sayı söyler. Olağan
 * günde (en büyük ikinciye yakın) ölçek eskisi gibi en büyük değer: hiçbir
 * çubuk kesik taşımaz. Üçten az değerde "uç" tanımsız, en büyük değer.
 */
export const LANE_OUTLIER_RATIO = 1.5;

export function sharedLaneScale(values: readonly (number | null | undefined)[], floor: number): number {
  const sizes: number[] = [];
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) sizes.push(Math.abs(value));
  }
  sizes.sort((a, b) => b - a);
  const [top = 0, second = 0] = sizes;
  const outlier = sizes.length >= 3 && top > second * LANE_OUTLIER_RATIO;
  return Math.max(floor, outlier ? second : top);
}

/** Değer ortak ölçeği aşıyor mu — çubuk kola dayanır, ucunda kesik taşır. */
export function laneOverflows(value: number | null | undefined, scale: number): boolean {
  return typeof value === "number" && Number.isFinite(value) && scale > 0 && Math.abs(value) > scale + 1e-9;
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
