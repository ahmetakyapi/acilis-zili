import { alertCrossed, type AlertDirection } from "@/lib/price-alerts";
import { formatPrice } from "@/lib/utils";
import { withLocale } from "@/lib/i18n/routing";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n";
import type { PushPayload } from "@/lib/push";

/**
 * ALARM TARAMASI (9 Ekim) — saf kısım. Uç `app/api/cron/alarmlar/route.ts`.
 *
 * Alarm bir dönem yalnızca okuyucu bir sayfayı açtığında değerlendiriliyordu
 * (lib/price-alerts.ts → settleAlerts); siteyi açmayan okuyucu hedefin
 * geçildiğini hiç öğrenmiyordu ve bildirim göndermenin anlamı yoktu.
 * Tarama aynı kuralı (`alertCrossed`) sunucuda, seans boyunca beş dakikada
 * bir çalıştırıyor; tetik anı yine "hedefin geçildiğinin GÖRÜLDÜĞÜ kontrol".
 */

export type PendingAlert = {
  id: string;
  userId: string;
  symbol: string;
  direction: AlertDirection;
  target: number;
};

export type AlertHit = PendingAlert & { price: number };

/** Elimizdeki fiyatlarla hedefi geçen bekleyen alarmlar. Fiyatı olmayan atlanır. */
export function findHits(alerts: readonly PendingAlert[], prices: Record<string, number | undefined>): AlertHit[] {
  const hits: AlertHit[] = [];
  for (const alert of alerts) {
    const price = prices[alert.symbol];
    if (price == null || !(price > 0)) continue;
    if (alertCrossed(alert, price)) hits.push({ ...alert, price });
  }
  return hits;
}

/**
 * Bildirimin metni. Etiket alarm başına: aynı alarm (yeniden kurulup tekrar
 * tetiklenirse) öncekinin yerine geçer, iki ayrı alarm üst üste yığılır.
 */
export function alertPayload(hit: AlertHit, locale: Locale, t: Dictionary["notifications"]): PushPayload {
  const money = (value: number) => formatPrice(value, locale, { currency: true });
  const body = (hit.direction === "above" ? t.alertAbove : t.alertBelow)
    .replace("{symbol}", hit.symbol)
    .replace("{target}", money(hit.target))
    .replace("{price}", money(hit.price));
  return {
    title: t.alertTitle.replace("{symbol}", hit.symbol),
    body,
    url: withLocale(`/hisse/${hit.symbol}`, locale),
    tag: `alert-${hit.id}`,
  };
}
