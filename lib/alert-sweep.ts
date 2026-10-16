import { alertCrossed, type AlertDirection } from "@/lib/price-alerts";
import { percentCrossed, thresholdDigits, type PercentDirection } from "@/lib/percent-alerts";
import { formatPercent, formatPrice } from "@/lib/utils";
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

/* --------------------------------------------------------------------------
   Yüzde alarmları (15 Ekim) — aynı tarama, ikinci alarm türü.
   Gerekçe lib/schema.ts → percentAlerts; değerlendirici lib/percent-alerts.ts.
   -------------------------------------------------------------------------- */

export type PendingPercentAlert = {
  id: string;
  userId: string;
  symbol: string;
  direction: PercentDirection;
  thresholdPct: number;
};

export type PercentHit = PendingPercentAlert & { changePct: number };

/**
 * Eşiği geçen bekleyen yüzde alarmları. `changePct`i null olan sembol
 * ATLANIR: null "önceki kapanış bilinmiyor" demek, "sıfır" değil.
 */
export function findPercentHits(
  alerts: readonly PendingPercentAlert[],
  changes: Record<string, number | null | undefined>,
): PercentHit[] {
  const hits: PercentHit[] = [];
  for (const alert of alerts) {
    const changePct = changes[alert.symbol];
    if (changePct == null || !Number.isFinite(changePct)) continue;
    if (percentCrossed(alert, changePct)) hits.push({ ...alert, changePct });
  }
  return hits;
}

export function percentPayload(
  hit: PercentHit,
  locale: Locale,
  t: Dictionary["notifications"],
): PushPayload {
  const body = (hit.direction === "up" ? t.percentUp : t.percentDown)
    .replace("{symbol}", hit.symbol)
    .replace(
      "{threshold}",
      formatPercent(hit.direction === "up" ? hit.thresholdPct : -hit.thresholdPct, locale, thresholdDigits(hit.thresholdPct)),
    )
    .replace("{change}", formatPercent(hit.changePct, locale, 2));
  return {
    title: t.alertTitle.replace("{symbol}", hit.symbol),
    body,
    url: withLocale(`/hisse/${hit.symbol}`, locale),
    tag: `percent-${hit.id}`,
  };
}
