/**
 * ABD resesyonları, 1980'den bu yana (25 Ekim, ikinci görsel tur).
 *
 * Sahibinin sözü: resesyon kartı "çok boş (tek düz çizgi + büyük boş
 * alan)". Olasılığın yanına uydurma olmayan tek bağlam: resesyonu ilan
 * eden kurumun kendi tarihlemesi. Kaynak NBER Business Cycle Dating
 * Committee, "US Business Cycle Expansions and Contractions"
 * (https://www.nber.org/research/data/us-business-cycle-expansions-and-contractions):
 * zirve (peak) ayı resesyonun başı, dip (trough) ayı sonu. Süre NBER
 * tablosundaki gibi zirveden dibe ay sayısı (6, 16, 8, 8, 18, 2).
 *
 * Elle tutulan liste: NBER yeni bir zirve ilan ederse buraya eklenir
 * (ilan aylar sonra gelir; kartın künyesi bunu söylüyor). Sayfa bu
 * listeden yalnız şerit ve özet basar, olasılık hesaplamaz.
 *
 * Düz modül ("use client" değil): sunucu bileşeni değer olarak okuyor.
 */

export type Recession = { peak: string; trough: string };

/** "YYYY-MM" — zirve ve dip ayı (NBER aylık tarihleme). */
export const NBER_RECESSIONS: readonly Recession[] = [
  { peak: "1980-01", trough: "1980-07" },
  { peak: "1981-07", trough: "1982-11" },
  { peak: "1990-07", trough: "1991-03" },
  { peak: "2001-03", trough: "2001-11" },
  { peak: "2007-12", trough: "2009-06" },
  { peak: "2020-02", trough: "2020-04" },
];

/** Şeridin başladığı ay (1980 Ocak) — 1980 resesyonu tam görünsün. */
export const HISTORY_FROM = "1980-01";

function monthIndex(ym: string): number {
  const [year, month] = ym.split("-").map(Number);
  return year * 12 + (month - 1);
}

/** Zirveden dibe ay sayısı (NBER'in "contraction" süresi). */
export function recessionMonths(r: Recession): number {
  return monthIndex(r.trough) - monthIndex(r.peak);
}

/** Ortalama süre, tam aya yuvarlı; liste boşsa null. */
export function averageMonths(list: readonly Recession[]): number | null {
  if (list.length === 0) return null;
  return Math.round(list.reduce((sum, r) => sum + recessionMonths(r), 0) / list.length);
}

/**
 * Şeritteki yerler, 0–100 (saf). Eksen `from` ayından `to` ayının SONUNA
 * kadar; dip ayı resesyona dahil sayılır (bloğun sağ kenarı dip ayının
 * sonu), yoksa iki aylık 2020 resesyonu bir aylık görünürdü.
 */
export function timelineSpans(
  list: readonly Recession[],
  from: string,
  to: string,
): { left: number; width: number; recession: Recession }[] {
  const start = monthIndex(from);
  const total = monthIndex(to) + 1 - start;
  if (total <= 0) return [];
  return list
    .filter((r) => monthIndex(r.trough) >= start)
    .map((r) => {
      const a = Math.max(monthIndex(r.peak), start);
      const b = monthIndex(r.trough) + 1;
      return { left: ((a - start) / total) * 100, width: ((b - a) / total) * 100, recession: r };
    });
}

/** Bir ayın eksendeki yeri (0–100), ayın BAŞI. */
export function timelineAt(ym: string, from: string, to: string): number {
  const start = monthIndex(from);
  const total = monthIndex(to) + 1 - start;
  return total <= 0 ? 0 : ((monthIndex(ym) - start) / total) * 100;
}
