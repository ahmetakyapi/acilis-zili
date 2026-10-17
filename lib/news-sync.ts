import { db } from "@/lib/db";
import { getMarketNews } from "@/lib/providers/finnhub";
import { news } from "@/lib/schema";

/**
 * Piyasa haberlerini sağlayıcıdan çekip tabloya yazar (var olanı atlar).
 * Günlük cron ve /api/cron/haberler aynı adımı koşar (17 Ekim): haberler
 * yalnız hafta içi günde bir geliyordu; hafta sonu ve akşam haberleri
 * ertesi iş gününe kadar sitede yoktu.
 */
export async function syncMarketNews(): Promise<number | string> {
  const result = await getMarketNews("general");
  if (!result.ok) return `atlandı: ${result.message}`;
  const seen = new Set<string>();
  const rows = result.data
    .slice(0, 60)
    .filter((item) => {
      if (seen.has(item.providerId)) return false;
      seen.add(item.providerId);
      return true;
    })
    .map((item) => ({
      providerId: item.providerId,
      headline: item.headline,
      summary: item.summary,
      url: item.url,
      imageUrl: item.imageUrl,
      source: item.source,
      category: item.category,
      symbols: item.symbols,
      publishedAt: item.publishedAt,
    }));
  if (rows.length > 0) await db.insert(news).values(rows).onConflictDoNothing();
  return rows.length;
}
