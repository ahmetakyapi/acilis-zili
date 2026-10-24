import "server-only";

import { and, gte, lte } from "drizzle-orm";
import { db } from "@/lib/db";
import { guncelBilanco } from "@/lib/data";
import { earningsCalendar } from "@/lib/schema";

/**
 * Takvimde [from, to] aralığında raporu olan semboller — site haritasının
 * şirket bazlı bilanço sayfaları için (`app/sitemap.ts`). Revize tarihin
 * ölü satırı sayılmıyor (`guncelBilanco`). Hata yutuluyor: harita
 * veritabanı düşse de üretilir, yalnız bu bölüm eksik kalır.
 */
export async function getReportingSymbols(from: string, to: string): Promise<Set<string>> {
  try {
    const rows = await db
      .selectDistinct({ symbol: earningsCalendar.symbol })
      .from(earningsCalendar)
      .where(and(gte(earningsCalendar.reportDate, from), lte(earningsCalendar.reportDate, to), guncelBilanco));
    return new Set(rows.map((row) => row.symbol));
  } catch {
    return new Set();
  }
}
