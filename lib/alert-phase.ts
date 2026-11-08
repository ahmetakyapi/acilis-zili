/**
 * ALARMIN EVRESİ — tek saf karar (8 Kasım). Fiyat ve yüzde alarmı aynı
 * makineden geçer:
 *
 *   sleeping ──(armedAt ?? createdAt ≤ şimdi)──▶ armed ──(tetik yazıldı)──▶ triggered
 *
 * "Uykuda" yalnız yüzde alarmında olur: aynı seansta yeniden kurulan alarmın
 * devreye giriş anı seansın bittiği âna ileri çekiliyor (app/actions/alerts.ts
 * → rearmPercentAlert). 8 Kasım (migration 0043): o an kendi sütununda,
 * `armedAt` (lib/alert-state.ts); boşsa — tablo yok ya da alarm hiç
 * ertelenmedi — eski anlam, `createdAt`. Kuruluş tarihi (liste sırası,
 * "{date}'den beri") artık kaymıyor. Bu evre iki yerde ayrı ayrı hesaplanıyordu — istemcide
 * `createdAt > nowMs`, taramada SQL'de `lte(createdAt, now)`; biri
 * değişince öteki sessizce ayrışırdı. Şimdi alarm düğmesi
 * (components/alerts/PriceAlertButton.tsx), tarama
 * (app/api/cron/alarmlar/route.ts) ve sayfadaki değerlendirme
 * (lib/alert-settle.ts) bu fonksiyonu okur. İlk sürümde şema değişmemişti:
 * `createdAt` hem kuruluş hem devreye giriş anını taşıyordu; ayrım 0043 ile
 * geldi (yukarıda).
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
  /** Devreye giriş; yoksa `createdAt` (lib/alert-state.ts → readArmedAt). */
  armedAt?: Date | string | null;
  triggeredAt: Date | string | null;
};

const ms = (value: Date | string | number): number =>
  typeof value === "number" ? value : value instanceof Date ? value.getTime() : Date.parse(value);

export function alertPhase(row: PhaseInput, now: Date | number): AlertPhase {
  if (row.triggeredAt != null) return "triggered";
  /* Okunamayan tarih uyutmaz: NaN > şimdi yanlış, alarm devrede kalır —
     bozuk bir satır alarmı sonsuza kadar susturmasın. */
  return ms(row.armedAt ?? row.createdAt) > ms(now) ? "sleeping" : "armed";
}
