import { headers } from "next/headers";
import { changelogEntries, entryAnchor } from "@/lib/changelog";
import { DEFAULT_LOCALE } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n";
import { LOCALE_HEADER, localeFromHeader, withLocale } from "@/lib/i18n/routing";
import { INDEXABLE, SITE_URL, TELEGRAM_URL } from "@/lib/site";

/**
 * Yenilikler RSS akışı — `/yenilikler/feed.xml`, İngilizcesi
 * `/en/yenilikler/feed.xml` (25 Ekim).
 *
 * NEDEN AYRI AKIŞ, `/feed.xml`E EKLENMEDİ: o akış tarihli yazılar (Mercek,
 * bülten) taşıyor ve aboneleri piyasa okuru; sitenin sürüm notları her gün
 * gelen bültenin arasına karışınca iki kitle de gürültü alırdı. Burada
 * öğe bir GİRİŞ: başlık, özet ve maddeler; bağlantı sayfadaki çapası.
 *
 * Dil yalnız adresten, çerezden değil — gerekçe `app/feed.xml/route.ts`
 * (RSS istemcisi çerez taşımaz, CDN çerezle dil seçen akışı ilk isteyenin
 * diliyle herkese verirdi). Veritabanı yok: içerik depoda, akış hiç
 * düşmez. Kaçış kuralları o dosyanınkiyle aynı.
 */

/** Akıştaki giriş sayısı — okuyucular geçmişi kendisi tutar. */
const FEED_LIMIT = 20;

/* XML 1.0'ın izin verdiği karakterler dışındakiler atılır — `app/feed.xml`
   ile aynı küme (orada gerekçesi: tek bir denetim karakteri bütün akışı
   katı okuyucularda bozuyordu). */
const XML_ILLEGAL = /[^\t\n\r -퟿-�\u{10000}-\u{10FFFF}]/gu;

function escapeXml(value: string): string {
  return value
    .replace(XML_ILLEGAL, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function GET() {
  const headerStore = await headers();
  const locale = localeFromHeader(headerStore.get(LOCALE_HEADER)) ?? DEFAULT_LOCALE;
  const L = getDictionary(locale).changelog;
  const adres = (path: string) => `${SITE_URL}${withLocale(path, locale)}`;

  const entries = changelogEntries(locale, TELEGRAM_URL).slice(0, FEED_LIMIT);
  const items = entries.map((entry) => {
    /* Gövde düz metin: her madde bir satır, etiketiyle. HTML yok — bazı
       okuyucular CDATA'daki biçimi yarım çiziyor. */
    const lines = entry.items.map((item) => `${L.kind[item.kind]}: ${item.title}. ${item.body}`);
    return `    <item>
      <title>${escapeXml(entry.title)}</title>
      <link>${escapeXml(`${adres("/yenilikler")}#${entryAnchor(entry.date)}`)}</link>
      <guid isPermaLink="false">yenilikler-${entry.date}-${locale}</guid>
      <pubDate>${new Date(`${entry.date}T12:00:00Z`).toUTCString()}</pubDate>
      <description>${escapeXml([entry.summary, ...lines].join("\n"))}</description>
    </item>`;
  });

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(L.feedTitle)}</title>
    <link>${adres("/yenilikler")}</link>
    <description>${escapeXml(L.feedDescription)}</description>
    <language>${locale}</language>
    <lastBuildDate>${new Date(`${entries[0]?.date ?? "2026-08-01"}T12:00:00Z`).toUTCString()}</lastBuildDate>
    <atom:link href="${adres("/yenilikler/feed.xml")}" rel="self" type="application/rss+xml" />
${items.join("\n")}
  </channel>
</rss>
`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      // İçerik yalnız dağıtımla değişiyor; yarım saat `/feed.xml` ile aynı.
      "Cache-Control": "public, max-age=1800, s-maxage=1800",
      ...(INDEXABLE ? {} : { "X-Robots-Tag": "noindex, nofollow" }),
    },
  });
}
