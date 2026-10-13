import { NextResponse } from "next/server";
import { and, asc, gte, lte } from "drizzle-orm";
import { checkBearer } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { dailyBriefs } from "@/lib/schema";
import { BRIEF_DATE } from "@/lib/brief";
import { addEtDays, todayEt } from "@/lib/market-hours";

/**
 * Bülten listesi — `?from=YYYY-MM-DD&to=YYYY-MM-DD`.
 *
 * Rutinlerin "hangi gün yazılmış, hangi dili eksik" sorusu (gerekçe
 * `/api/brief` GET'inde). Tarih başına TEK satır, dönem ayrı: aynı
 * pazartesiye hem günlük hem haftalık düşebilir. Varsayılan son 14 gün;
 * aralık en çok 400 gün.
 */
const DEFAULT_SPAN = 14;
const MAX_SPAN = 400;

export async function GET(request: Request) {
  const auth = checkBearer(request, process.env.BRIEF_SECRET);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const url = new URL(request.url);
  const toParam = url.searchParams.get("to");
  const fromParam = url.searchParams.get("from");
  const to = toParam && BRIEF_DATE.test(toParam) ? toParam : todayEt();
  const from = fromParam && BRIEF_DATE.test(fromParam) ? fromParam : addEtDays(to, -DEFAULT_SPAN);
  if (from > to || from < addEtDays(to, -MAX_SPAN)) {
    return NextResponse.json(
      { error: "invalid-range", detail: `from ≤ to ve aralık en çok ${MAX_SPAN} gün` },
      { status: 400 },
    );
  }

  const rows = await db
    .select({ date: dailyBriefs.briefDate, period: dailyBriefs.period, locale: dailyBriefs.locale })
    .from(dailyBriefs)
    .where(and(gte(dailyBriefs.briefDate, from), lte(dailyBriefs.briefDate, to)))
    .orderBy(asc(dailyBriefs.briefDate), asc(dailyBriefs.period), asc(dailyBriefs.locale));

  const grouped = new Map<string, { date: string; period: string; locales: string[] }>();
  for (const row of rows) {
    const key = `${row.date}|${row.period}`;
    const held = grouped.get(key);
    if (held) held.locales.push(row.locale);
    else grouped.set(key, { date: row.date, period: row.period, locales: [row.locale] });
  }

  /* Yanıt düz dizi — sözleşme bu (13 Ekim isteği); aralık yanıt başlığında. */
  return NextResponse.json([...grouped.values()], {
    headers: { "X-Range": `${from}..${to}` },
  });
}
