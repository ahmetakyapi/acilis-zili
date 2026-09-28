import { and, eq, lt, sql } from "drizzle-orm";
import { db } from "./db";
import { arkHoldings } from "./schema";
import { ARK_FUNDS, getArkHoldings } from "./providers/ark";

/**
 * ARK günlük dosyalarının senkronu — idempotent (28 Eylül).
 *
 * Altı CSV (toplam ~150 KB) çekiliyor; dosyanın tarihi o fon için zaten
 * yazılıysa hiçbir şey yazılmıyor. Hafta sonu ve tatilde ARK dosyayı
 * yenilemiyor, tarih aynı kalıyor, koşum boşa dönüyor — bu beklenen durum.
 *
 * Geçmiş kısa tutuluyor: ekran son birkaç işlem gününü gösteriyor, tablo
 * `ARK_KEEP_DAYS` günden eskisini siliyor. Next içe aktarmıyor; cron ve
 * ilk doldurma betiği aynı kodu koşuyor.
 */

/** Tabloda tutulan takvim günü. Ekran en fazla son beş işlem gününü okuyor. */
export const ARK_KEEP_DAYS = 21;
const INSERT_BATCH = 500;

/**
 * `deadline` (28 Eylül denetimi): altı CSV sırayla ve her biri 20 saniyelik
 * zaman aşımıyla çekiliyordu; ARK'ın sunucusu takılırsa adım tek başına iki
 * dakikaya uzayıp cron ucunun `maxDuration`ını (120 sn) aşabiliyordu. Süre
 * dolunca kalan fonlar ertesi koşuma kalıyor; o gün dosyası eksik fon
 * ekranda sahte işlem üretmiyor (`arkDay` iki günde de olan fonu sayıyor).
 */
export async function syncArk(options: { deadline?: number } = {}): Promise<{ changed: boolean; summary: string }> {
  const written: string[] = [];
  const failed: string[] = [];
  const skipped: string[] = [];
  for (const { fund, file } of ARK_FUNDS) {
    if (options.deadline !== undefined && Date.now() >= options.deadline) {
      skipped.push(fund);
      continue;
    }
    const result = await getArkHoldings(file);
    if (!result.ok) {
      failed.push(`${fund} ${result.message}`);
      continue;
    }
    const asOf = result.data[0].asOf;
    const exists = await db
      .select({ n: sql<number>`count(*)` })
      .from(arkHoldings)
      .where(and(eq(arkHoldings.fund, fund), eq(arkHoldings.asOf, asOf)));
    if (Number(exists[0]?.n ?? 0) > 0) continue;
    const rows = result.data
      .filter((row) => row.asOf === asOf)
      .map((row) => ({
        asOf: row.asOf,
        fund,
        cusip: row.cusip,
        ticker: row.ticker,
        company: row.company,
        shares: row.shares,
        marketValue: row.marketValue,
        weight: row.weight,
      }));
    for (let i = 0; i < rows.length; i += INSERT_BATCH) {
      await db.insert(arkHoldings).values(rows.slice(i, i + INSERT_BATCH)).onConflictDoNothing();
    }
    written.push(`${fund} ${asOf}`);
  }
  await db.delete(arkHoldings).where(lt(arkHoldings.asOf, sql`current_date - ${ARK_KEEP_DAYS}::int`));
  const parts = [written.length > 0 ? `+${written.join(", ")}` : "yeni dosya yok"];
  if (skipped.length > 0) parts.push(`süre doldu: ${skipped.join(", ")}`);
  if (failed.length > 0) parts.push(`hata: ${failed.slice(0, 3).join(" | ")}`);
  return { changed: written.length > 0, summary: parts.join(" · ") };
}
