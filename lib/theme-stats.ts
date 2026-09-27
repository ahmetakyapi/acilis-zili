import type { QuoteBasis } from "@/lib/market-hours";

/**
 * Tema tablosunun GÜN HAREKETİ — hangi yüzdeler aynı seansı anlatıyor.
 *
 * CLAUDE.md "Veri dürüstlüğü" 4: bir yüzde hangi seansı anlattığını
 * kanıtlamalı. Tema bir sepet ve sepetin medyanı ancak AYNI GÜNÜN
 * yüzdelerinden kurulursa bir şey söyler: açılış öncesinde üyelerin bir
 * kısmı bu sabah işlem görmüş (yüzde bugünü anlatıyor), bir kısmı görmemiş
 * (yüzde dünkü kapanışı anlatıyor). İkisinin medyanı hiçbir günün hareketi
 * değil.
 *
 * Kural:
 *   - Bu seansa ait yüzdesi olan üye en az `MIN_SESSION_ROWS` ise yalnızca
 *     onlar kullanılır ve künye "bu seans" der.
 *   - Hiçbir üyede bu seansa ait işlem yoksa (hafta sonu değil — o zaman
 *     seans günü cuma ve cumanın işlemleri seansa ait sayılıyor; asıl hâl
 *     açılış öncesinin ilk dakikaları) hepsi aynı önceki seansı anlatıyor;
 *     medyan onlardan kurulur ve künye "son kapanış" der.
 *   - Arada kalan karışık hâlde medyan HİÇ basılmaz: iki ayrı günden bir
 *     sayı üretmek, sayı göstermemekten kötü.
 *
 * Saf modül; `tests/theme-stats.test.ts` ölçüyor.
 */

/** Bu seansın yüzdesinden medyan kurmak için gereken en az üye. İki
    üyenin medyanı bir ortalama; üç, bir sepetin ortasını göstermeye başlar. */
export const MIN_SESSION_ROWS = 3;

export type MoveRow = {
  changePct: number | null;
  basis: QuoteBasis | null;
};

export type MoveSet = {
  /** Hangi satırların yüzdesi bu kümede — ölçek çubuğu yalnızca onlara. */
  included: boolean[];
  values: number[];
  basis: "session" | "lastClose";
};

export function sameSessionMoves(rows: readonly MoveRow[]): MoveSet | null {
  const known = rows.map(
    (row) => row.changePct !== null && Number.isFinite(row.changePct) && row.basis !== null,
  );
  const fresh = rows.map((row, i) => known[i] && row.basis !== "lastClose");
  const freshCount = fresh.filter(Boolean).length;

  if (freshCount >= MIN_SESSION_ROWS) {
    return {
      included: fresh,
      values: rows.filter((_, i) => fresh[i]).map((row) => row.changePct!),
      basis: "session",
    };
  }
  const knownCount = known.filter(Boolean).length;
  if (freshCount === 0 && knownCount >= MIN_SESSION_ROWS) {
    return {
      included: known,
      values: rows.filter((_, i) => known[i]).map((row) => row.changePct!),
      basis: "lastClose",
    };
  }
  return null;
}

export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}
