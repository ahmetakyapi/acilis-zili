import { NextResponse } from "next/server";
import { checkBearer, type AuthOutcome } from "@/lib/api-auth";
import { desc } from "drizzle-orm";
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

  const status = await getStatus();
  const quotes = await getQuotes([...INDEX_STRIP], status);

  const [existing, recentNews] = await Promise.all([
    db
      .select({
        slug: stories.slug,
        title: stories.title,
        eventDate: stories.eventDate,
        locale: stories.locale,
      })
      .from(stories)
      .orderBy(desc(stories.eventDate))
      .limit(400),
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

  /* Aynı yazı iki dilde iki satır — rutin için slug başına TEK kayıt ve
     dillerin listesi daha kullanışlı: "hangi yazının İngilizcesi eksik"
     sorusu tek bakışta cevaplanır, geri doldurma da buradan beslenir. */
  const grouped = new Map<
    string,
    { slug: string; title: string; event_date: string; locales: string[] }
  >();
  for (const row of existing) {
    const held = grouped.get(row.slug);
    if (held) {
      if (!held.locales.includes(row.locale)) held.locales.push(row.locale);
      if (row.locale === "tr") held.title = row.title;
    } else {
      grouped.set(row.slug, {
        slug: row.slug,
        title: row.title,
        event_date: row.eventDate,
        locales: [row.locale],
      });
    }
  }

  return NextResponse.json({
    today_et: todayEt(),
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
    /* Zaten yazılmış dosyalar — aynı olayı ikinci kez yazma. `locales`
       hangi dillerin mevcut olduğunu söyler; "en" eksikse çevirisi bekleniyor. */
    existing_stories: [...grouped.values()],
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
