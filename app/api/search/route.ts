import { NextResponse } from "next/server";
import { ilike, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { symbols } from "@/lib/schema";
import { searchSymbols } from "@/lib/providers/finnhub";
import { clientKey, rateLimit } from "@/lib/rate-limit";

export type SearchHit = {
  symbol: string;
  name: string;
  industry?: string | null;
};

/**
 * Sembol arama.
 * Önce yerel tablo (anında, sağlayıcı kotası harcamaz), sonuç azsa Finnhub
 * ile genişletilir.
 */
/* Sitedeki tek yetkisiz uç ve hem veritabanına hem Finnhub'a gidiyor —
   yani kotayı harcayan yüzey burası. Dakikada 40 istek, tuşa basarak arayan
   bir insanın çok üstünde; kazara kurulmuş bir döngünün çok altında. */
const SEARCH_LIMIT = 40;
const SEARCH_WINDOW_MS = 60_000;

/** Sağlayıcıya giden en uzun sorgu — daha uzunu anlamlı sonuç üretmiyor. */
const MAX_QUERY_LENGTH = 64;

export async function GET(request: Request) {
  const limited = rateLimit(
    clientKey(request, "search"),
    SEARCH_LIMIT,
    SEARCH_WINDOW_MS,
  );
  if (!limited.allowed) {
    return NextResponse.json(
      { hits: [] satisfies SearchHit[], error: "rate-limited" },
      { status: 429, headers: { "Retry-After": String(limited.retryAfter) } },
    );
  }

  const query = (new URL(request.url).searchParams.get("q")?.trim() ?? "").slice(
    0,
    MAX_QUERY_LENGTH,
  );

  if (query.length < 1) {
    return NextResponse.json({ hits: [] satisfies SearchHit[] });
  }

  const hits: SearchHit[] = [];
  const seen = new Set<string>();

  try {
    const pattern = `%${query}%`;
    const local = await db
      .select({
        symbol: symbols.symbol,
        name: symbols.name,
        industry: symbols.industry,
      })
      .from(symbols)
      .where(or(ilike(symbols.symbol, pattern), ilike(symbols.name, pattern)))
      // Sembolün kendisiyle başlayan eşleşmeler önce gelsin
      .orderBy(sql`case when ${symbols.symbol} ilike ${query + "%"} then 0 else 1 end`)
      .limit(8);

    for (const row of local) {
      seen.add(row.symbol);
      hits.push(row);
    }
  } catch {
    // Veritabanı yoksa arama yine de sağlayıcı üzerinden çalışsın.
  }

  if (hits.length < 6 && query.length >= 2) {
    const remote = await searchSymbols(query);
    if (remote.ok) {
      for (const item of remote.data) {
        if (seen.has(item.symbol) || hits.length >= 10) continue;
        seen.add(item.symbol);
        hits.push({ symbol: item.symbol, name: item.description });
      }
    }
  }

  return NextResponse.json({ hits });
}
