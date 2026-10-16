import { cache } from "react";
import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { percentAlerts } from "@/lib/schema";

/**
 * Yüzde alarmları — okuma ve saf değerlendirme. Yazma `app/actions/alerts.ts`,
 * tarama `app/api/cron/alarmlar`. Gerekçe şemada (lib/schema.ts →
 * percentAlerts): günlük değişim eşiği, tek seferlik, yalnızca sunucu
 * taramasında değerlendirilir.
 *
 * `"use client"` DEĞİL: değerlendirici sunucuda, tipler istemcideki satır
 * bileşeninde okunuyor (lib/price-alerts.ts ile aynı sınır kararı).
 */

export type PercentDirection = "up" | "down";

export type PercentAlert = {
  id: string;
  symbol: string;
  direction: PercentDirection;
  thresholdPct: number;
  createdAt: string;
  triggeredAt: string | null;
  triggeredPct: number | null;
};

/** Eşiğin makul aralığı — %0,5 altı gürültü, %90 üstü yazım hatası. */
export const MIN_THRESHOLD_PCT = 0.5;
export const MAX_THRESHOLD_PCT = 90;

/**
 * Eşiğin GÖSTERİM hanesi — kayıtlı hassasiyet kadar (16 Ekim). Sabit bir
 * hane "2,25" eşiğini "2,3" basıyordu; −%2,26'da gelen bildirim "−%2,3
 * eşiği aşıldı" diyerek kendisiyle çelişiyordu. 0, 1 ya da 2 hane.
 */
export function thresholdDigits(value: number): number {
  const near = (x: number) => Math.abs(x - Math.round(x)) < 1e-6;
  return near(value) ? 0 : near(value * 10) ? 1 : 2;
}

export function isPercentDirection(value: unknown): value is PercentDirection {
  return value === "up" || value === "down";
}

/**
 * Günlük değişim eşiği geçti mi — eşitlik de geçmiş sayılır.
 * `changePct` null ise ÇAĞIRANIN atlaması gerekir: null "sıfır" değil
 * "önceki kapanış bilinmiyor" demek (lib/providers/alpaca.ts notu).
 */
export function percentCrossed(
  alert: Pick<PercentAlert, "direction" | "thresholdPct">,
  changePct: number,
): boolean {
  return alert.direction === "up"
    ? changePct >= alert.thresholdPct
    : changePct <= -alert.thresholdPct;
}

function toAlert(row: typeof percentAlerts.$inferSelect): PercentAlert | null {
  if (!isPercentDirection(row.direction)) return null;
  const thresholdPct = Number(row.thresholdPct);
  if (!Number.isFinite(thresholdPct) || thresholdPct <= 0) return null;
  return {
    id: row.id,
    symbol: row.symbol,
    direction: row.direction,
    thresholdPct,
    createdAt: row.createdAt.toISOString(),
    triggeredAt: row.triggeredAt ? row.triggeredAt.toISOString() : null,
    triggeredPct: row.triggeredPct == null ? null : Number(row.triggeredPct),
  };
}

/**
 * Hesabın yüzde alarmları. `available: false` tablo yok demek (migration
 * 0033 uygulanmamış) — arayüz bölümü hiç basmaz (lib/price-alerts.ts kalıbı).
 */
export const getUserPercentAlerts = cache(
  async (userId: string): Promise<{ available: boolean; alerts: PercentAlert[] }> => {
    try {
      const rows = await db
        .select()
        .from(percentAlerts)
        .where(eq(percentAlerts.userId, userId))
        .orderBy(asc(percentAlerts.createdAt));
      return {
        available: true,
        alerts: rows.map(toAlert).filter((alert): alert is PercentAlert => alert !== null),
      };
    } catch {
      return { available: false, alerts: [] };
    }
  },
);
