import { cache } from "react";
import { unstable_cache } from "next/cache";
import { desc, inArray, sql } from "drizzle-orm";
import { db } from "./db";
import { arkHoldings } from "./schema";
import { arkDay, type ArkDay, type ArkHolding } from "./ark-view";
import { INVESTORS_TAG } from "./investor-data";

/**
 * ARK'ın son işlemleri — okuma katmanı (28 Eylül).
 *
 * Son `ARK_DAYS + 1` dosya tarihi okunuyor ve ardışık her çift bir işlem
 * günü oluyor. Tek dosya varsa (senkronun ilk günü) `days` boş ve ekran
 * "ilk karşılaştırma bir sonraki dosyada" diyor; olmayan bir farkı
 * uydurmuyor.
 *
 * Tablo yokken sessiz (migration elle uygulanıyor): hata yakalanıp `null`.
 * Önbellek yatırımcı ekranlarıyla aynı etiketi paylaşıyor; cron yeni dosya
 * yazınca `INVESTORS_TAG` tazeleniyor.
 */

/** Ekranda gösterilen en fazla işlem günü. */
export const ARK_DAYS = 5;
const REVALIDATE_SECONDS = 3_600;

export type ArkActivity = {
  /** En yeni dosyanın tarihi. */
  latest: string;
  /** Yeniden eskiye. */
  days: ArkDay[];
};

const loadArkActivity = unstable_cache(
  async (): Promise<ArkActivity | null> => {
    const dates = await db
      .selectDistinct({ asOf: arkHoldings.asOf })
      .from(arkHoldings)
      .orderBy(desc(arkHoldings.asOf))
      .limit(ARK_DAYS + 1);
    if (dates.length === 0) return null;
    const wanted = dates.map((row) => row.asOf);
    const rows = await db
      .select({
        asOf: arkHoldings.asOf,
        fund: arkHoldings.fund,
        cusip: arkHoldings.cusip,
        ticker: arkHoldings.ticker,
        company: arkHoldings.company,
        shares: arkHoldings.shares,
        marketValue: arkHoldings.marketValue,
      })
      .from(arkHoldings)
      .where(inArray(arkHoldings.asOf, wanted))
      .orderBy(sql`${arkHoldings.asOf} desc`);
    const byDate = new Map<string, ArkHolding[]>();
    for (const { asOf, ...row } of rows) {
      const list = byDate.get(asOf) ?? [];
      list.push(row);
      byDate.set(asOf, list);
    }
    const days: ArkDay[] = [];
    for (let i = 0; i + 1 < wanted.length; i += 1) {
      days.push(arkDay(wanted[i + 1], wanted[i], byDate.get(wanted[i + 1]) ?? [], byDate.get(wanted[i]) ?? []));
    }
    return { latest: wanted[0], days };
  },
  ["ark-activity-v1"],
  { revalidate: REVALIDATE_SECONDS, tags: [INVESTORS_TAG] },
);

export const getArkActivity = cache(async function getArkActivity(): Promise<ArkActivity | null> {
  try {
    return await loadArkActivity();
  } catch (error) {
    console.error(`[yatirimcilar] ARK okunamadı: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
});
