import "server-only";
import { cache } from "react";
import { and, desc, eq, gte } from "drizzle-orm";
import { db } from "./db";
import { analystTargets } from "./schema";
import { addEtDays, todayEt } from "./market-hours";

/**
 * Şirketin güncel ortalama analist hedefi — en yeni kayıt, en çok on günlük.
 *
 * Yazma yedi günden eski sayıyı kabul etmiyor (`lib/analyst-targets.ts`);
 * okuma on güne kadar gösteriyor ki uzun bir hafta sonu ya da tatil
 * rutinin bir iki atladığı günde kaydı düşürmesin. Daha eskisi "güncel"
 * değil — ekran o zaman bilanço analizindeki hedefe döner (tarihiyle).
 *
 * TABLO YOKSA NULL. Migration deploy'da uygulanmıyor (CLAUDE.md); tablo
 * gelene kadar sorgu düşüyor ve ekran eskisi gibi çalışıyor.
 */
export type ConsensusTarget = {
  mean: number;
  median: number | null;
  high: number | null;
  low: number | null;
  analystCount: number | null;
  source: string;
  sourceUrl: string | null;
  asOf: string;
};

const SHOW_MAX_AGE_DAYS = 10;

export const getConsensusTarget = cache(async function getConsensusTarget(
  symbol: string,
): Promise<ConsensusTarget | null> {
  try {
    const rows = await db
      .select()
      .from(analystTargets)
      .where(
        and(
          eq(analystTargets.symbol, symbol.toUpperCase()),
          gte(analystTargets.asOf, addEtDays(todayEt(), -SHOW_MAX_AGE_DAYS)),
        ),
      )
      .orderBy(desc(analystTargets.asOf))
      .limit(1);
    const row = rows[0];
    if (!row) return null;
    return {
      mean: row.mean,
      median: row.median,
      high: row.high,
      low: row.low,
      analystCount: row.analystCount,
      source: row.source,
      sourceUrl: row.sourceUrl,
      asOf: row.asOf,
    };
  } catch {
    return null;
  }
});
