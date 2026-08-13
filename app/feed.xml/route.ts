import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { dailyBriefs, stories } from "@/lib/schema";
import { headers } from "next/headers";
import { DEFAULT_LOCALE } from "@/lib/i18n/config";
import { LOCALE_HEADER, localeFromHeader } from "@/lib/i18n/routing";
import { SITE_URL, INDEXABLE } from "@/lib/site";

/**
 * RSS beslemesi — `/feed.xml`.
 *
 * NEDEN VAR. Site her gün bir bülten, düzenli olarak da mercek yazısı
 * yayımlıyor ve `/bulten` altında bunların arşivi duruyordu; ama abone
 * olmanın hiçbir yolu yoktu. Günlük brief türü tam olarak böyle tüketiliyor:
 * okuyucu siteyi hatırlamak zorunda kalmadan, kendi okuyucusunda görüyor.
 * Tek dosya, sunucuda ek maliyet yok.
 *
 * İÇERİK İKİ KAYNAKTAN. Mercek yazıları (uzun anlatım) ve günlük/haftalık
 * bültenler. İkisi de TARİHLİ ve yayımlandıktan sonra değişmiyor — beslemeye
 * ait olan tam olarak bu. Rehber yazıları dışarıda: onlar durağan ve
 * güncellendiklerinde beslemede yeniden "yeni" görünürlerdi.
 *
 * DİLE GÖRE. Besleme okuyucunun çerezindeki dile göre üretiliyor; TR okuyan
 * Türkçe, EN okuyan İngilizce kayıtları görüyor. Ayrı iki adres açmak yerine
 * bu tercih edildi çünkü sitenin geri kalanı da aynı çerezle çalışıyor ve
 * adres tek: `/feed.xml`.
 */

/** Beslemede taşınan en yeni kayıt sayısı — okuyucular zaten geçmişi tutar. */
const FEED_LIMIT = 30;

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** RSS pubDate RFC 822 ister; ISO kabul edilmiyor. */
function rfc822(date: Date): string {
  return date.toUTCString();
}

type Item = {
  title: string;
  link: string;
  description: string;
  date: Date;
  guid: string;
};

export async function GET() {
  /* DİL YALNIZCA ADRESTEN — çerezden DEĞİL.
     Besleme `public, s-maxage=1800` ile önbelleğe alınıyor ve `Vary: Cookie`
     yok: çerezle dil seçilseydi CDN ilk isteyenin dilini herkese servis
     ederdi. Üstelik gerçek RSS istemcileri (Feedly, NetNewsWire, Inoreader)
     çerez taşımıyor — hepsi varsayılana düşüyordu. Türkçe `/feed.xml`,
     İngilizce `/en/feed.xml`; iki ayrı adres, iki ayrı önbellek. */
  const headerStore = await headers();
  const locale = localeFromHeader(headerStore.get(LOCALE_HEADER)) ?? DEFAULT_LOCALE;
  const tr = locale === "tr";

  /* Yayına kapalı ortamda (önizleme dağıtımları) besleme de kapalı: robots
     zaten her şeyi engelliyor, besleme onu delerdi. */
  if (!INDEXABLE) {
    return new Response("not-found", { status: 404 });
  }

  const [storyRows, briefRows] = await Promise.all([
    db
      .select({
        slug: stories.slug,
        title: stories.title,
        dek: stories.dek,
        eventDate: stories.eventDate,
        publishedAt: stories.publishedAt,
      })
      .from(stories)
      .where(eq(stories.locale, locale))
      .orderBy(desc(stories.publishedAt))
      .limit(FEED_LIMIT),
    db
      .select({
        briefDate: dailyBriefs.briefDate,
        period: dailyBriefs.period,
        headline: dailyBriefs.headline,
        bodyMd: dailyBriefs.bodyMd,
        generatedAt: dailyBriefs.generatedAt,
      })
      .from(dailyBriefs)
      .where(eq(dailyBriefs.locale, locale))
      .orderBy(desc(dailyBriefs.briefDate))
      .limit(FEED_LIMIT),
  ]);

  const items: Item[] = [
    ...storyRows.map((row) => ({
      title: row.title,
      link: `${SITE_URL}/mercek/${row.slug}`,
      description: row.dek,
      date: row.publishedAt ?? new Date(`${row.eventDate}T12:00:00Z`),
      guid: `mercek-${row.slug}-${locale}`,
    })),
    ...briefRows.map((row) => ({
      title: row.headline,
      link:
        row.period === "weekly"
          ? `${SITE_URL}/bulten?tur=haftalik`
          : `${SITE_URL}/bulten`,
      /* Gövde markdown; beslemede ilk paragraf yeterli. Tamamını göndermek
         işaretlemeyi de taşımak demek ve okuyucular onu ham gösteriyor. */
      description: row.bodyMd.split("\n").find((line) => line.trim()) ?? "",
      date: row.generatedAt ?? new Date(`${row.briefDate}T12:00:00Z`),
      guid: `bulten-${row.period}-${row.briefDate}-${locale}`,
    })),
  ]
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .slice(0, FEED_LIMIT);

  const title = tr
    ? "Açılış Zili — Piyasa Yazıları ve Bülten"
    /* Marka adı İngilizce beslemede de İngilizce: sitenin EN tarafı kendini
       "Opening Bell" diye tanıtıyor, besleme başka bir ad kullanınca aynı
       ürünün iki adı oluyordu. */
    : "Opening Bell — Market Writing and Briefs";
  const description = tr
    ? "ABD borsalarını Türkçe takip eden bir sitenin mercek yazıları ve günlük bülteni."
    : "Long reads and the daily brief from a site tracking US markets.";

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(title)}</title>
    <link>${SITE_URL}</link>
    <description>${escapeXml(description)}</description>
    <language>${tr ? "tr" : "en"}</language>
    <lastBuildDate>${rfc822(items[0]?.date ?? new Date())}</lastBuildDate>
    <atom:link href="${SITE_URL}/feed.xml" rel="self" type="application/rss+xml" />
${items
  .map(
    (item) => `    <item>
      <title>${escapeXml(item.title)}</title>
      <link>${escapeXml(item.link)}</link>
      <guid isPermaLink="false">${escapeXml(item.guid)}</guid>
      <pubDate>${rfc822(item.date)}</pubDate>
      <description>${escapeXml(item.description)}</description>
    </item>`,
  )
  .join("\n")}
  </channel>
</rss>
`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      // Yarım saat: bülten günde bir, mercek günde en çok bir kez yazılıyor.
      "Cache-Control": "public, max-age=1800, s-maxage=1800",
    },
  });
}
