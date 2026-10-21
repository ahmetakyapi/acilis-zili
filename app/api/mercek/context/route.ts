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
        publishedAt: stories.publishedAt,
        updatedAt: stories.updatedAt,
      })
      .from(stories)
      /* SINIR YOK (20 Ekim denetimi). `.limit(400)` SATIR sayıyordu — iki
         dille ~200 yazı — ve arşiv onu aşınca eski slug'lar rutine
         görünmez oluyordu: geçen yılın "fed-faiz-karari-eylul"u listede
         yokken aynı slug'la gelen POST onu sessizce eziyordu, pencere
         sınırında dillerinden biri kesilen yazı da gereksiz çeviriye
         düşüyordu. İzdüşüm küçük; yük büyürse KISALTILIR (eski yazıda
         yalnız slug + gün + diller), kesilmez. */
      .orderBy(desc(stories.eventDate)),
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
    {
      slug: string;
      title: string;
      event_date: string;
      locales: string[];
      /* İlk yazılış anı (dillerin en erkeni) ve son düzeltme. `published_at`
         upsert'te bilerek korunuyor (`lib/content-write.ts`), yani satırın
         doğum anı; Bekçi aynı günün iki koşusunu buradan ayırıyor. */
      created_at: string;
      updated_at: string;
    }
  >();
  for (const row of existing) {
    const held = grouped.get(row.slug);
    const created = row.publishedAt.toISOString();
    const updated = row.updatedAt.toISOString();
    if (held) {
      if (!held.locales.includes(row.locale)) held.locales.push(row.locale);
      if (row.locale === "tr") held.title = row.title;
      if (created < held.created_at) held.created_at = created;
      if (updated > held.updated_at) held.updated_at = updated;
    } else {
      grouped.set(row.slug, {
        slug: row.slug,
        title: row.title,
        event_date: row.eventDate,
        locales: [row.locale],
        created_at: created,
        updated_at: updated,
      });
    }
  }

  return NextResponse.json({
    today_et: todayEt(),
    session: status.session,
    /* BAYAT KOTASYON YAZIYA GİRMEZ — gerekçesi `/api/brief/context` içinde
       ve kuralın kaynağı `lib/technical-data.ts`: bu paketten çıkan sayı
       rutinin yazdığı metne geçip `stories` tablosunda kalıcı duruyor.
       Sağlayıcı düştüğünde `getQuotes` önbelleğe düşüyor ve orada ÖNCEKİ
       seansın yüzdeleri var. Değer null'a iniyor, `indices_stale` sebebini
       söylüyor; rutin o cümleyi kurmuyor. */
    indices:
      quotes.ok && !quotes.stale
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
        : INDEX_STRIP.map((symbol) => ({
            symbol,
            price: null,
            change_pct: null,
          })),
    indices_stale: !quotes.ok || Boolean(quotes.stale),
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
