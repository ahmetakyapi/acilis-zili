import { hasActual } from "@/lib/day-flow";
import type { EconomicEventRow } from "@/lib/schema";

/**
 * "Son Açıklanan Veriler" ve veri notunun saf hesabı — düz modül.
 *
 * NEDEN AYRI DOSYA: takvim sayfası (sunucu), veri notunun yazma katmanı
 * (lib/release-notes.ts, `server-only`) ve testler aynı seçimi ve aynı
 * karşılaştırmayı okuyor. Panelde "Beklentinin Üstünde" yazan rozet ile
 * Claude'a verilen `vsForecast` aynı fonksiyondan gelmezse ekran ile not
 * birbirine ters düşebilirdi (CLAUDE.md "aynı sayı iki yerde").
 */

/** Panelin geriye baktığı gün sayısı (bugün dahil değil). */
export const RELEASED_WINDOW_DAYS = 10;
/** Panelde en çok kaç açıklama. */
export const RELEASED_LIMIT = 4;

const PLAIN = /^-?\d+(\.\d+)?$/;

/**
 * Düz sayı dizgesi ("4.2", "-0.3") → sayı; ekli metin ("250K", "4.25-4.50")
 * → null. Takvim satırının değer çubuğuyla (`valueRatios`) aynı kural.
 */
export function plainNumber(value: string | null | undefined): number | null {
  const trimmed = value?.trim();
  return trimmed && PLAIN.test(trimmed) ? Number(trimmed) : null;
}

export type Comparison = "above" | "below" | "inline";

/**
 * Gerçekleşen değerin bir kıyas değerine göre yönü — EKRANDA GÖRÜNEN
 * hassasiyetle. Takvim değerleri en çok iki haneyle basılıyor
 * (`formatEventValue`); ham "3.461" ile "3.46" ham sayıyla kıyaslansa
 * "üstünde" çıkar ama ekranda ve notta ikisi de "3,46" yazar — not "3,46
 * beklentinin üstünde, beklenti 3,46" derdi. Kıyas yuvarlanmış sayıyla.
 * Biri düz sayı değilse yön yok (birimini bilmediğimiz metni kıyaslamıyoruz).
 */
export function compareReleased(actual: string | null | undefined, other: string | null | undefined): Comparison | null {
  const a = plainNumber(actual);
  const b = plainNumber(other);
  if (a === null || b === null) return null;
  const ra = Math.round(a * 100);
  const rb = Math.round(b * 100);
  return ra > rb ? "above" : ra < rb ? "below" : "inline";
}

/**
 * Panelin açıklamaları: son `RELEASED_WINDOW_DAYS` gün içinde (bugün dahil),
 * yüksek ya da orta etkili, `actual` taşıyan satırlar; en yeni önce, aynı
 * günde geç saat önce, saatsiz satır günün sonunda. `from` ve `today` ET
 * günleri. Girdi bozulmaz.
 *
 * `actual` VERİTABANINDAKİ değer: notun uç tarafı da satırı veritabanından
 * okuyor. Sayfanın bugünkü FRED tazelemesiyle gelen değer buraya girmez —
 * girse panel notu yazılamayan bir satırı gösterirdi.
 */
export function pickReleased(
  rows: EconomicEventRow[],
  { from, today, limit = RELEASED_LIMIT }: { from: string; today: string; limit?: number },
): EconomicEventRow[] {
  return rows
    .filter(
      (row) =>
        row.eventDate >= from &&
        row.eventDate <= today &&
        (row.importance === "high" || row.importance === "medium") &&
        hasActual(row.actual),
    )
    .sort(
      (a, b) =>
        b.eventDate.localeCompare(a.eventDate) ||
        (b.eventTimeEt ?? "").localeCompare(a.eventTimeEt ?? "") ||
        (a.importance === "high" ? -1 : 0) - (b.importance === "high" ? -1 : 0),
    )
    .slice(0, limit);
}

/**
 * Notun önbellek anahtarı: olay + üç değer. Gerçekleşen revize edilirse not
 * yeniden yazılır (istenen); beklenti ya da önceki değer sonradan dolarsa da
 * — notta geçen sayı ekrandaki çubukla aynı satırdan gelsin.
 */
export function releaseNoteKey(row: Pick<EconomicEventRow, "id" | "actual" | "forecast" | "previous">): string[] {
  return [row.id, row.actual?.trim() ?? "", row.forecast?.trim() ?? "", row.previous?.trim() ?? ""];
}
