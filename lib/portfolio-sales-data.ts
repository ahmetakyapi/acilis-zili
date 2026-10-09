import { cache } from "react";
import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { portfolioSales } from "@/lib/schema";
import { getUsdTryAt } from "@/lib/providers/fx-history";
import { saleViews, yearTotals, type SalePart, type SaleView, type YearTotal } from "@/lib/portfolio-sales";

/**
 * Portföy satışlarının okuması. Gerekçe `lib/schema.ts` → portfolioSales.
 *
 * `available: false` TABLO YOK demek (migration henüz uygulanmamış): ekran
 * o zaman Sat düğmesini ve Gerçekleşen panelini hiç basmıyor — kaydedilemeyen
 * bir satış formu göstermek tıklamayı yutmak olurdu (fiyat alarmlarıyla aynı
 * kalıp, `lib/price-alerts.ts`).
 */
export const getPortfolioSales = cache(
  async (userId: string): Promise<{ available: boolean; parts: (SalePart & { id: string; note: string | null })[] }> => {
    try {
      const rows = await db
        .select()
        .from(portfolioSales)
        .where(eq(portfolioSales.userId, userId))
        .orderBy(asc(portfolioSales.soldAt), asc(portfolioSales.createdAt));
      return {
        available: true,
        parts: rows.map((row) => ({
          id: row.id,
          saleId: row.saleId,
          symbol: row.symbol,
          quantity: Number(row.quantity),
          priceUsd: Number(row.priceUsd),
          soldAt: row.soldAt,
          costUsd: Number(row.costUsd),
          boughtAt: row.boughtAt,
          note: row.note,
        })),
      };
    } catch {
      return { available: false, parts: [] };
    }
  },
);

export type RealizedData = {
  available: boolean;
  views: SaleView[];
  years: YearTotal[];
  /** Satış partileri — vergi aktarımı alış ve satış satırlarını bunlardan kuruyor. */
  parts: SalePart[];
};

/**
 * Gerçekleşen kâr/zarar: satışlar ve her alış/satış gününün TCMB kuru.
 * Kur okumaları gün başına bir kez (aynı gün tekrarlanmıyor); düşen kur o
 * olayın lira tarafını boş bırakıyor, dolar tarafı yine yazılıyor.
 */
export const loadRealized = cache(async (userId: string): Promise<RealizedData> => {
  const { available, parts } = await getPortfolioSales(userId);
  if (!available || parts.length === 0) return { available, views: [], years: [], parts: [] };
  const days = [...new Set(parts.flatMap((part) => [part.boughtAt, part.soldAt]))];
  const rates = await Promise.all(days.map((day) => getUsdTryAt(day)));
  const byDay = new Map<string, number>();
  days.forEach((day, index) => {
    const result = rates[index];
    if (result.ok) byDay.set(day, result.data.buying);
  });
  const views = saleViews(parts, (day) => byDay.get(day) ?? null);
  return { available, views, years: yearTotals(views), parts };
});
