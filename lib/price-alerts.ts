import { cache } from "react";
import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { priceAlerts } from "@/lib/schema";

/**
 * Fiyat alarmları — okuma ve değerlendirme. Yazma `app/actions/alerts.ts`.
 *
 * Gerekçe ve tetik anlamı şemada (`lib/schema.ts` → priceAlerts). Kısaca:
 * alarm, okuyucunun güncel bir kotasyon gördüğü sayfada değerlendiriliyor
 * ve tetik anı "hedefin geçildiğinin GÖRÜLDÜĞÜ kontrol".
 *
 * Bu modül `"use client"` DEĞİL: `alertCrossed` ve `alertProgress` hem
 * sunucuda (değerlendirme) hem istemcide (hisse sayfasındaki düğmenin
 * listesi) okunuyor (CLAUDE.md → İstemci ile sunucu sınırı).
 */

export type AlertDirection = "above" | "below";

export type PriceAlert = {
  id: string;
  symbol: string;
  direction: AlertDirection;
  target: number;
  refPrice: number | null;
  createdAt: string;
  triggeredAt: string | null;
  triggeredPrice: number | null;
};

/** Hesap başına ve sembol başına tavan — gerekçe `app/actions/alerts.ts`. */
export const MAX_ALERTS = 50;
export const MAX_ALERTS_PER_SYMBOL = 5;

export function isDirection(value: unknown): value is AlertDirection {
  return value === "above" || value === "below";
}

/** Fiyat hedefi geçti mi — eşitlik de geçmiş sayılır. */
export function alertCrossed(
  alert: Pick<PriceAlert, "direction" | "target">,
  price: number,
): boolean {
  return alert.direction === "above" ? price >= alert.target : price <= alert.target;
}

/**
 * Hedefe kalan yol, yüzde olarak ve FİYATA göre: "hedefe %4,2". Negatif
 * değer yok; geçilmişse 0.
 */
export function alertDistancePct(
  alert: Pick<PriceAlert, "direction" | "target">,
  price: number,
): number {
  if (price <= 0) return 0;
  const gap = alert.direction === "above" ? alert.target - price : price - alert.target;
  return Math.max(0, (gap / price) * 100);
}

/**
 * Kurulduğu fiyattan hedefe giden yolun ne kadarı alındı (0–1). Kuruluş
 * fiyatı yoksa ya da fiyat ters yöne gittiyse 0.
 */
export function alertProgress(
  alert: Pick<PriceAlert, "direction" | "target" | "refPrice">,
  price: number,
): number {
  if (alert.refPrice == null || alert.refPrice === alert.target) return 0;
  const done = (price - alert.refPrice) / (alert.target - alert.refPrice);
  return Math.min(1, Math.max(0, done));
}

function toAlert(row: typeof priceAlerts.$inferSelect): PriceAlert | null {
  if (!isDirection(row.direction)) return null;
  const target = Number(row.target);
  if (!Number.isFinite(target)) return null;
  return {
    id: row.id,
    symbol: row.symbol,
    direction: row.direction,
    target,
    refPrice: row.refPrice == null ? null : Number(row.refPrice),
    createdAt: row.createdAt.toISOString(),
    triggeredAt: row.triggeredAt ? row.triggeredAt.toISOString() : null,
    triggeredPrice: row.triggeredPrice == null ? null : Number(row.triggeredPrice),
  };
}

/**
 * Hesabın bütün alarmları, eskiden yeniye.
 *
 * `available: false` TABLO YOK demek (migration henüz uygulanmamış):
 * arayüz o zaman alarm bölümünü hiç basmıyor — kurulamayacak bir alarm
 * düğmesi göstermek tıklamayı yutmak olurdu. Hata yutuluyor ve bu bilinçli
 * (aynı kalıp `lib/avatar-data.ts`).
 *
 * İstek içinde önbellekli: hisse sayfasında başlık ve alarm düğmesi aynı
 * istekte soruyor.
 */
export const getUserAlerts = cache(
  async (userId: string): Promise<{ available: boolean; alerts: PriceAlert[] }> => {
    try {
      const rows = await db
        .select()
        .from(priceAlerts)
        .where(eq(priceAlerts.userId, userId))
        .orderBy(asc(priceAlerts.createdAt));
      return {
        available: true,
        alerts: rows.map(toAlert).filter((alert): alert is PriceAlert => alert !== null),
      };
    } catch {
      return { available: false, alerts: [] };
    }
  },
);

/**
 * Bekleyen alarmları elimizdeki fiyatlarla değerlendirir; hedefi geçenleri
 * işaretler ve listenin GÜNCEL hâlini döndürür.
 *
 * `fresh: false` gelirse hiçbir şey yazılmıyor: bayat paket (önbellekteki
 * önceki seans) alarmı tetiklemez — CLAUDE.md "Veri dürüstlüğü" 4, yazma
 * katmanı bayat kotasyon kullanmaz. Yazma başarısız olursa liste yine
 * işaretli döner; bir sonraki kontrol aynı yazmayı yeniden dener.
 */
export async function settleAlerts(
  userId: string,
  alerts: PriceAlert[],
  prices: Record<string, number | undefined>,
  fresh: boolean,
): Promise<PriceAlert[]> {
  if (!fresh) return alerts;
  const now = new Date();
  const hits = alerts.filter((alert) => {
    const price = prices[alert.symbol];
    return !alert.triggeredAt && price != null && price > 0 && alertCrossed(alert, price);
  });
  if (hits.length === 0) return alerts;

  await Promise.all(
    hits.map((alert) =>
      db
        .update(priceAlerts)
        .set({ triggeredAt: now, triggeredPrice: String(prices[alert.symbol]) })
        .where(
          and(
            eq(priceAlerts.id, alert.id),
            eq(priceAlerts.userId, userId),
            isNull(priceAlerts.triggeredAt),
          ),
        )
        .catch(() => undefined),
    ),
  );

  const hitIds = new Set(hits.map((alert) => alert.id));
  return alerts.map((alert) =>
    hitIds.has(alert.id)
      ? { ...alert, triggeredAt: now.toISOString(), triggeredPrice: prices[alert.symbol] ?? null }
      : alert,
  );
}
