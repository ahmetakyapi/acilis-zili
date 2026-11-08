import { cache } from "react";
import { asc, eq } from "drizzle-orm";
import { readArmedAt } from "@/lib/alert-state";
import { db } from "@/lib/db";
import { isPercentDirection, type PercentAlert } from "@/lib/percent-alerts-core";
import { percentAlerts } from "@/lib/schema";

/**
 * Yüzde alarmları — okuma ve saf değerlendirme. Yazma `app/actions/alerts.ts`,
 * tarama `app/api/cron/alarmlar`. Gerekçe şemada (lib/schema.ts →
 * percentAlerts): günlük değişim eşiği, tek seferlik, yalnızca sunucu
 * taramasında değerlendirilir.
 *
 * SUNUCU TARAFI: tipler, eşik aralığı ve değerlendirici
 * lib/percent-alerts-core.ts'te, buradan yeniden dışa aktarılıyor; istemci
 * çekirdeği içe aktarır (20 Ekim — lib/price-alerts.ts ile aynı sınır kararı).
 */

export * from "@/lib/percent-alerts-core";

function toAlert(row: typeof percentAlerts.$inferSelect, armedAt: Date | undefined): PercentAlert | null {
  if (!isPercentDirection(row.direction)) return null;
  const thresholdPct = Number(row.thresholdPct);
  if (!Number.isFinite(thresholdPct) || thresholdPct <= 0) return null;
  return {
    id: row.id,
    symbol: row.symbol,
    direction: row.direction,
    thresholdPct,
    createdAt: row.createdAt.toISOString(),
    armedAt: armedAt ? armedAt.toISOString() : null,
    triggeredAt: row.triggeredAt ? row.triggeredAt.toISOString() : null,
    triggeredPct: row.triggeredPct == null ? null : Number(row.triggeredPct),
  };
}

/**
 * Hesabın yüzde alarmları. `available: false` tablo yok demek (migration
 * 0033 uygulanmamış) — arayüz bölümü hiç basmaz (lib/price-alerts.ts kalıbı).
 *
 * Devreye giriş anı AYRI sorguda (8 Kasım, lib/alert-state.ts): durum
 * tablosu (0043) yokken birleştirme bütün okumayı düşürürdü; ayrı sorgu
 * düşerse `armedAt` boş kalır ve evre eskisi gibi `createdAt`ten okunur.
 */
export const getUserPercentAlerts = cache(
  async (userId: string): Promise<{ available: boolean; alerts: PercentAlert[] }> => {
    try {
      const rows = await db
        .select()
        .from(percentAlerts)
        .where(eq(percentAlerts.userId, userId))
        .orderBy(asc(percentAlerts.createdAt));
      const armed = await readArmedAt("percent", rows.map((row) => row.id));
      return {
        available: true,
        alerts: rows
          .map((row) => toAlert(row, armed?.get(row.id)))
          .filter((alert): alert is PercentAlert => alert !== null),
      };
    } catch {
      return { available: false, alerts: [] };
    }
  },
);
