import { NextResponse } from "next/server";
import { desc, inArray } from "drizzle-orm";
import { checkBearer } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { analystTargets } from "@/lib/schema";
import { getStatus, getSymbolNames } from "@/lib/data";
import { todayEt } from "@/lib/market-hours";
import { getQuotes } from "@/lib/providers";
import { TECHNICAL_SYMBOLS } from "@/lib/technical";
import { SPOTLIGHT_SYMBOLS } from "@/lib/spotlight";

/**
 * Ortalama hedef rutininin aday listesi (docs/claude-rutinler.md § 1, adım 1c).
 *
 * Takip edilen hisseler: teknik analiz listesi ve öne çıkanlar — sitenin
 * en çok okunan şirket sayfaları. Her aday için canlı fiyat (makullük
 * kontrolü) ve son kayıt (bugün yazıldıysa rutin atlayabilir).
 */
export async function GET(request: Request) {
  const auth = checkBearer(request, process.env.BRIEF_SECRET);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const symbols = [...new Set([...TECHNICAL_SYMBOLS, ...SPOTLIGHT_SYMBOLS])];
  const status = await getStatus();
  const [quotes, names] = await Promise.all([getQuotes(symbols, status), getSymbolNames(symbols)]);
  /* Tablo yoksa (migration uygulanmadı) son kayıtlar boş — rutin yine yazar,
     yazma ucu da tabloyu bekler; hata yanıtı rutini uyarır. */
  const latest = new Map<string, { mean: number; as_of: string; source: string }>();
  try {
    const rows = await db
      .select({ symbol: analystTargets.symbol, mean: analystTargets.mean, asOf: analystTargets.asOf, source: analystTargets.source })
      .from(analystTargets)
      .where(inArray(analystTargets.symbol, symbols))
      .orderBy(desc(analystTargets.asOf));
    for (const row of rows) if (!latest.has(row.symbol)) latest.set(row.symbol, { mean: row.mean, as_of: row.asOf, source: row.source });
  } catch {
    /* tablo henüz yok */
  }
  return NextResponse.json({
    today_et: todayEt(),
    candidates: symbols.map((symbol) => ({
      symbol,
      name: names[symbol]?.name ?? null,
      price: quotes.ok ? quotes.data[symbol]?.price ?? null : null,
      last: latest.get(symbol) ?? null,
    })),
  });
}
