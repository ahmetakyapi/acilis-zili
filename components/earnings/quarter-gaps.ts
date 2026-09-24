/**
 * Çeyrek etiketlerinden zaman ekseni — gelir sütunlarında EKSİK çeyrek.
 *
 * NEDEN (24 Eylül): sütun grafikleri kaydın sırasını zaman ekseni sayıyordu
 * ve SPCX'in serisi 2Ç25, 1Ç26, 2Ç26 üç eşit aralıklı sütun olarak
 * çiziliyordu — ardışık çeyrekler gibi. Arada iki çeyrek yok. Etiketler
 * kayıttan geliyor ve biçimleri değişiyor ("3Ç25", "1Ç FY26", "2Ç 2026",
 * "Q3 FY26", "Q3'25"); hepsi aynı iki parçayı taşıyor: çeyrek ve yıl.
 *
 * Etiket çözülemezse o adım için kırılma basılmıyor (eski davranış): bir
 * etiketi yanlış okuyup olmayan bir boşluk çizmek, var olanı göstermemekten
 * kötü.
 */
const QUARTER_LABEL = /(?:([1-4])\s?Ç|Q([1-4]))\s?'?\s?(?:FY)?\s?(\d{4}|\d{2})/i;

/** Etiketin çeyrek sırası (yıl × 4 + çeyrek) ya da çözülemezse `null`. */
export function quarterOrdinal(label: string): number | null {
  const match = label.match(QUARTER_LABEL);
  if (!match) return null;
  const quarter = Number(match[1] ?? match[2]);
  const rawYear = Number(match[3]);
  const year = rawYear < 100 ? 2000 + rawYear : rawYear;
  return year * 4 + (quarter - 1);
}

/**
 * Her sütun için: kendinden önceki sütunla arasında çeyrek eksik mi?
 * İlk sütun her zaman `false`. İki etiketten biri çözülemezse `false`.
 */
export function quarterGaps(labels: readonly string[]): boolean[] {
  const ordinals = labels.map(quarterOrdinal);
  return ordinals.map((current, index) => {
    const previous = ordinals[index - 1];
    return index > 0 && current !== null && previous != null && current - previous > 1;
  });
}

/**
 * Ardışık iki çeyrek mi? Büyüme şeridi yalnızca ardışık çeyrekler arasında
 * değişim yazıyor; boşluğun üstünden hesaplanan bir oran "çeyreklik" değil.
 */
export function consecutiveQuarters(previous: string, current: string): boolean {
  const a = quarterOrdinal(previous);
  const b = quarterOrdinal(current);
  return a !== null && b !== null && b - a === 1;
}

/** Bir yıl önceki aynı çeyreğin dizideki yeri, yoksa -1. */
export function yearAgoIndex(labels: readonly string[], index: number): number {
  const current = quarterOrdinal(labels[index] ?? "");
  if (current === null) return -1;
  return labels.findIndex((label) => quarterOrdinal(label) === current - 4);
}
