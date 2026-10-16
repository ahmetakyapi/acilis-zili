import { cache } from "react";
import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { isSessionTrade, type MarketStatus } from "@/lib/market-hours";
import type { Quote } from "@/lib/providers/types";
import { priceAlerts } from "@/lib/schema";

/**
 * Fiyat alarmları — okuma ve saf değerlendirme. Yazma `app/actions/alerts.ts`,
 * sayfada tetik lib/alert-settle.ts, tarama app/api/cron/alarmlar.
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

/** Değerlendirmenin bir kotasyondan okuduğu üç alan. */
export type SessionQuote = Pick<Quote, "price" | "changePct" | "tradedAt">;

/**
 * SEMBOL BAŞINA SEANS KAPISI (16 Ekim) — alarm yalnız BU seansın işlemini
 * taşıyan kotasyonla değerlendirilir.
 *
 * Tazelik paketin geneline soruluyordu (`packCurrent`, paketteki EN YENİ
 * işlem). Tarama bütün bekleyen sembolleri tek pakette istiyor: ön seansta
 * NVDA işlem görünce paket "güncel" sayılıyor, henüz işlem görmemiş bir
 * hissenin kotasyonu ise hâlâ DÜNÜN işlemini ve dünün yüzdesini taşıyor.
 * "Bugün %5 düşerse haber ver" alarmı sabah dünkü düşüşle tetikleniyor ve
 * okuyucunun telefonuna yanlış bir haber gidiyordu. 04:00–04:15 ET arasında
 * paket kuralı işlemlere hiç bakmıyor (`closedResponseCurrent`) — o pencerede
 * de her kotasyon önceki seansındı.
 *
 * Tek ölçü ekranla aynı: `isSessionTrade` (CLAUDE.md "Veri dürüstlüğü" 4).
 * Seansa ait olmayan sembol atlanır; ilk işlemi gelince değerlendirilir.
 */
export function sessionReadings(
  quotes: Record<string, SessionQuote | null | undefined>,
  status: MarketStatus,
): { prices: Record<string, number>; changes: Record<string, number | null> } {
  const prices: Record<string, number> = {};
  const changes: Record<string, number | null> = {};
  for (const [symbol, quote] of Object.entries(quotes)) {
    if (!quote || !isSessionTrade(quote.tradedAt, status)) continue;
    prices[symbol] = quote.price;
    changes[symbol] = quote.changePct;
  }
  return { prices, changes };
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

/* Sayfada değerlendirme (`settleAlerts`) sunucuya özel modülde: lib/alert-settle.ts. */
