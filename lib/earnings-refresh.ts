import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { addEtDays } from "@/lib/market-hours";
import { getEarningsCalendar } from "@/lib/providers/finnhub";
import type { EarningsEntry } from "@/lib/providers/types";
import { earningsCalendar } from "@/lib/schema";

/**
 * Bilanço takviminin YAZMA yolu — günlük cron ve pazar özeti aynı upsert'i
 * kullanır (17 Ekim). Beklenti ve gerçekleşen her yazımda ÜZERİNE YAZILIR
 * (gerekçe app/api/cron/daily → adım 1).
 */
export async function upsertEarnings(entries: readonly EarningsEntry[], runAt: Date): Promise<void> {
  const rows = entries.map((entry) => ({
    symbol: entry.symbol,
    reportDate: entry.reportDate,
    hour: entry.hour,
    epsEstimate: entry.epsEstimate,
    epsActual: entry.epsActual,
    revenueEstimate: entry.revenueEstimate,
    revenueActual: entry.revenueActual,
    quarter: entry.quarter,
    year: entry.year,
  }));
  for (let i = 0; i < rows.length; i += 200) {
    await db
      .insert(earningsCalendar)
      .values(rows.slice(i, i + 200))
      .onConflictDoUpdate({
        target: [earningsCalendar.symbol, earningsCalendar.reportDate],
        set: {
          hour: sql`excluded.hour`,
          epsEstimate: sql`excluded.eps_estimate`,
          epsActual: sql`excluded.eps_actual`,
          revenueEstimate: sql`excluded.revenue_estimate`,
          revenueActual: sql`excluded.revenue_actual`,
          updatedAt: runAt,
        },
      });
  }
}

/**
 * Bir aralığın GERÇEKLEŞENLERİNİ sağlayıcıdan yeniden çeker ve yazar.
 *
 * NEDEN (17 Ekim): pazar özeti 10:00 TR'de gidiyor, ama günlük eşitleme
 * yalnız hafta içi 13:30 TR'de (06:30 ET) koşuyor — cuma açılış öncesi
 * (bankaların bilanço günü) ve cuma kapanış sonrası sonuçlar pazartesiye
 * kadar tabloya düşmüyordu; posta onları "açıklanmadı" diye listeden
 * atardı. Beş gün = beş istek; Finnhub kotasına (dakikada 60) dokunmuyor.
 *
 * Silme YOK: revize tarihin ölü satırını temizlemek günlük koşunun işi,
 * orada tüm ileri pencere taranıyor. Burada yalnız geçmiş günler.
 */
export async function refreshEarningsResults(from: string, to: string): Promise<{ ok: boolean; rows: number }> {
  const entries = new Map<string, EarningsEntry>();
  let anyOk = false;
  for (let day = from; day <= to; day = addEtDays(day, 1)) {
    const result = await getEarningsCalendar(day, day, undefined, "results");
    if (!result.ok) continue;
    anyOk = true;
    for (const entry of result.data) entries.set(`${entry.symbol}|${entry.reportDate}`, entry);
  }
  if (!anyOk) return { ok: false, rows: 0 };
  try {
    await upsertEarnings([...entries.values()], new Date());
    return { ok: true, rows: entries.size };
  } catch (error) {
    console.error(`[bilanço tazeleme] yazılamadı: ${error instanceof Error ? error.message : String(error)}`);
    return { ok: false, rows: 0 };
  }
}
