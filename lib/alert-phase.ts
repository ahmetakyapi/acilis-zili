/**
 * ALARMIN EVRESİ — tek saf karar (8 Kasım). Fiyat ve yüzde alarmı aynı
 * makineden geçer:
 *
 *   sleeping ──(createdAt ≤ şimdi)──▶ armed ──(tetik yazıldı)──▶ triggered
 *
 * "Uykuda" yalnız yüzde alarmında olur: aynı seansta yeniden kurulan alarmın
 * `createdAt`i seansın bittiği âna ileri çekiliyor (app/actions/alerts.ts →
 * rearmPercentAlert). Bu evre iki yerde ayrı ayrı hesaplanıyordu — istemcide
 * `createdAt > nowMs`, taramada SQL'de `lte(createdAt, now)`; biri
 * değişince öteki sessizce ayrışırdı. Şimdi alarm düğmesi
 * (components/alerts/PriceAlertButton.tsx), tarama
 * (app/api/cron/alarmlar/route.ts) ve sayfadaki değerlendirme
 * (lib/alert-settle.ts) bu fonksiyonu okur. Şema değişmedi: `createdAt`
 * hâlâ hem kuruluş hem devreye giriş anını taşıyor (ayrı `armedAt` sütunu
 * migration ister — açık iş).
 *
 * DÜZ MODÜL: `"use client"` taşımaz, `db` ya da şema içe aktarmaz — istemci
 * paketine de sunucuya da gerçek değer olarak girer (CLAUDE.md → istemci/
 * sunucu sınırı; gerekçe lib/price-alerts-core.ts).
 *
 * Saat ÇAĞIRANIN: istemci kendi saatini, sunucu kendi saatini verir. Sınır
 * anında (createdAt = şimdi) alarm devrededir — taramanın eski `lte`siyle
 * aynı.
 */

export type AlertPhase = "sleeping" | "armed" | "triggered";

type PhaseInput = {
  createdAt: Date | string;
  triggeredAt: Date | string | null;
};

const ms = (value: Date | string | number): number =>
  typeof value === "number" ? value : value instanceof Date ? value.getTime() : Date.parse(value);

export function alertPhase(row: PhaseInput, now: Date | number): AlertPhase {
  if (row.triggeredAt != null) return "triggered";
  /* Okunamayan tarih uyutmaz: NaN > şimdi yanlış, alarm devrede kalır —
     bozuk bir satır alarmı sonsuza kadar susturmasın. */
  return ms(row.createdAt) > ms(now) ? "sleeping" : "armed";
}
