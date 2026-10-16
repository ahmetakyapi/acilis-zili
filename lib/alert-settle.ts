import { after } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { alertPayload } from "@/lib/alert-sweep";
import { db } from "@/lib/db";
import { getDictionary } from "@/lib/i18n";
import { withLocale } from "@/lib/i18n/routing";
import type { MarketStatus } from "@/lib/market-hours";
import { notifyUser } from "@/lib/notifications";
import { alertCrossed, sessionReadings, type PriceAlert, type SessionQuote } from "@/lib/price-alerts";
import { priceAlerts } from "@/lib/schema";

/**
 * SAYFADA DEĞERLENDİRME — fiyat alarmının okuyucunun açtığı sayfadaki eşi.
 * Tarama `app/api/cron/alarmlar` (beş dakikada bir); bu, iki tarama arasında
 * sayfa açılırsa hedefin geçildiğini hemen gösteriyor.
 *
 * SUNUCUYA ÖZEL MODÜL (16 Ekim). Fonksiyon `lib/price-alerts.ts`teydi ve o
 * dosya istemci bileşeninden de okunuyor (hisse sayfasındaki alarm düğmesi);
 * tetikte bildirim göndermek `notifyUser` → web-push demek ve bu zincir
 * istemci paketine girmemeli. Saf parçalar orada kaldı.
 *
 * TETİK BİLDİRİMSİZ KAPANIYORDU. Sayfa alarmı `triggeredAt` ile sahipleniyor,
 * tarama ise yalnız `triggeredAt IS NULL` satırları okuyordu: iki tarama
 * arasında sayfayı açan okuyucunun alarmı sessizce kapanıyor — telefona push
 * gitmiyor, başlıktaki zilin kutusuna satır düşmüyordu. Şimdi koşullu yazma
 * `returning`li; satırı GERÇEKTEN sahiplenen (sayfa ya da tarama, hangisi
 * önce) bildirimi tek girişten gönderiyor. Yanıt beklemesin diye `after`.
 *
 * `fresh: false` gelirse hiçbir şey yazılmıyor: bayat paket alarmı tetiklemez
 * (CLAUDE.md "Veri dürüstlüğü" 4). Paket güncel olsa da SEMBOL kendi seansını
 * kanıtlamalı (`sessionReadings`). Yazma düşerse liste yine işaretli döner;
 * bir sonraki kontrol (ya da tarama) yazmayı ve bildirimi yeniden dener.
 */
export async function settleAlerts(
  userId: string,
  alerts: PriceAlert[],
  quotes: Record<string, SessionQuote | null | undefined>,
  status: MarketStatus,
  fresh: boolean,
): Promise<PriceAlert[]> {
  if (!fresh) return alerts;
  const { prices } = sessionReadings(quotes, status);
  const now = new Date();
  const hits = alerts.filter((alert) => {
    const price = prices[alert.symbol];
    return !alert.triggeredAt && price != null && price > 0 && alertCrossed(alert, price);
  });
  if (hits.length === 0) return alerts;

  const claimed: PriceAlert[] = [];
  await Promise.all(
    hits.map(async (alert) => {
      const rows = await db
        .update(priceAlerts)
        .set({ triggeredAt: now, triggeredPrice: String(prices[alert.symbol]) })
        .where(
          and(
            eq(priceAlerts.id, alert.id),
            eq(priceAlerts.userId, userId),
            isNull(priceAlerts.triggeredAt),
          ),
        )
        .returning({ id: priceAlerts.id })
        .catch(() => []);
      if (rows.length > 0) claimed.push(alert);
    }),
  );

  if (claimed.length > 0) {
    after(async () => {
      for (const alert of claimed) {
        const price = prices[alert.symbol]!;
        await notifyUser(
          userId,
          "alert",
          (locale) => {
            const p = alertPayload({ ...alert, userId, price }, locale, getDictionary(locale).notifications);
            return { title: p.title, body: p.body, path: `/hisse/${alert.symbol}`, tag: p.tag };
          },
          withLocale,
          { alertId: alert.id, kind: "price", symbol: alert.symbol, direction: alert.direction, target: alert.target, price, firedAt: now },
        ).catch(() => 0);
      }
    });
  }

  const hitIds = new Set(hits.map((alert) => alert.id));
  return alerts.map((alert) =>
    hitIds.has(alert.id)
      ? { ...alert, triggeredAt: now.toISOString(), triggeredPrice: prices[alert.symbol] ?? null }
      : alert,
  );
}
