import { NextResponse } from "next/server";
import { checkBearer, type AuthOutcome } from "@/lib/api-auth";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { news, stories } from "@/lib/schema";
import { getStatus } from "@/lib/data";
import { getQuotes } from "@/lib/providers";
import { INDEX_STRIP } from "@/db/seed/symbols";
import { todayEt } from "@/lib/market-hours";

/**
 * Mercek rutini için bağlam paketi.
 *
 * Rutin akşam bu ucu çeker ve şu iki soruyu cevaplar:
 *   1. Bugün gerçekten anlatmaya değer bir şey oldu mu?
 *   2. Daha önce hangi dosyaları yazdım — tekrara düşüyor muyum?
 *
 * İkincisi kritik: uç, var olan tüm slug'ları ve başlıkları döndürür. Rutin
 * aynı olayı ikinci kez yazmak yerine ya günü pas geçer ya da eski dosyayı
 * aynı slug ile günceller.
 *
 * Bu uç veri sunar, yorum yapmaz. Neyin "dosyalık" olduğuna rutin karar
 * verir; talimatı docs/claude-mercek-ajani.md içinde.
 */

function authorized(request: Request): AuthOutcome {
  return checkBearer(request, process.env.BRIEF_SECRET);
}

const NEWS_SAMPLE = 60;

export async function GET(request: Request) {
  const auth = authorized(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const url = new URL(request.url);
  const locale = url.searchParams.get("locale") === "en" ? "en" : "tr";

  const status = await getStatus();
  const quotes = await getQuotes([...INDEX_STRIP], status);

  const [existing, recentNews] = await Promise.all([
    db
      .select({
        slug: stories.slug,
        title: stories.title,
        eventDate: stories.eventDate,
      })
      .from(stories)
      .where(eq(stories.locale, locale))
      .orderBy(desc(stories.eventDate))
      .limit(200),
    db
      .select({
        headline: news.headline,
        summary: news.summary,
        source: news.source,
        url: news.url,
        symbols: news.symbols,
        publishedAt: news.publishedAt,
      })
      .from(news)
      .orderBy(desc(news.publishedAt))
      .limit(NEWS_SAMPLE),
  ]);

  return NextResponse.json({
    today_et: todayEt(),
    locale,
    session: status.session,
    indices: quotes.ok
      ? INDEX_STRIP.map((symbol) => {
          const quote = quotes.data[symbol];
          return quote
            ? {
                symbol,
                price: quote.price,
                change_pct: quote.changePct,
              }
            : { symbol, price: null, change_pct: null };
        })
      : [],
    /* Zaten yazılmış dosyalar — aynı olayı ikinci kez yazma. */
    existing_stories: existing,
    /* Son haber akışı: konuyu SEÇMEK için ipucu, kaynak olarak yeterli değil.
       Rutin yazmadan önce olayı kendi araştırmasıyla doğrulamalı. */
    recent_news: recentNews.map((item) => ({
      headline: item.headline,
      summary: item.summary,
      source: item.source,
      url: item.url,
      symbols: item.symbols,
      published_at: item.publishedAt,
    })),
  });
}
