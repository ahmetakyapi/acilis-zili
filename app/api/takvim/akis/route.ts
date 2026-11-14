import { createHash } from "node:crypto";
import {
  EARNINGS_FEED_DAYS,
  earningsIcsEvent,
  economicIcsEvent,
  FEED_REFRESH_HOURS,
  impactLabel,
  MACRO_FEED_DAYS,
  parseFeedQuery,
  type FeedQuery,
} from "@/lib/calendar-feed";
import { getEventsBetweenResult, getSymbolNames } from "@/lib/data";
import { getEarningsWithOverrides } from "@/lib/earnings-overrides";
import { getDictionary } from "@/lib/i18n";
import { buildIcs, type IcsEvent } from "@/lib/ics";
import { addEtDays, todayEt } from "@/lib/market-hours";
import { clientKey, rateLimit } from "@/lib/rate-limit";

/**
 * Takvim ABONELİĞİ — canlı `.ics` akışı (14 Kasım 2026).
 *
 * NEDEN VAR. `/api/takvim` tek olayı indiriyor ("Takvime Ekle"): okur her
 * bilançoyu, her veri açıklamasını tek tek eklemek zorunda ve eklediği
 * etkinlik tarih revize edilince eski günde kalıyor. Abonelikte okur
 * Google/Apple Takvim'e adresi bir kez verir; olaylar kendiliğinden gelir,
 * değişen saat orada da değişir.
 *
 * `?tur=makro[&onem=high|medium|low]&dil=tr|en`
 * `?tur=bilanco&semboller=NVDA,AAPL&dil=tr|en`  (en çok 40 sembol)
 *
 * HERKESE AÇIK, ADRESLE TANIMLI. Kullanıcıya özel belirteç, şema ve
 * migration yok (gerekçe `lib/calendar-feed.ts`). Bu yüzden yanıt kimseye
 * özel değil ve paylaşılan önbelleğe girebilir; dil de çerezden değil
 * adresten okunur (akışı takvim sağlayıcısının sunucusu çeker).
 *
 * VERİ VAR OLAN YÜKLEYİCİLERDEN. Makro: takvim ekranının okuması
 * (`getEventsBetweenResult`). Bilanço: sağlayıcı satırları + elle düzeltme
 * (`getEarningsWithOverrides`) — "bilanço yarın" hatırlatmasıyla aynı yol.
 * Takvim hatırlatmanın kendisi; rutinin şirket sayfasından doğruladığı
 * tarih varken sağlayıcının yanlışını okurun takvimine yazmak olmaz.
 * Sorgu sembolle süzülü, yani 120 günlük bütün tabloyu çekmiyor.
 *
 * OKUNAMAYAN TAKVİM BOŞ TAKVİM DEĞİLDİR. Veritabanı düşerse 503: abone
 * istemci akışı her çekişte bütünüyle değiştirir; 200 + boş gövde okurun
 * takvimindeki bütün olayları silerdi. 503'te istemci elindekini korur.
 *
 * SAAT. Ekonomik olayın saati gerçek (`event_time_et`), UTC'ye
 * `lib/market-hours.ts` çevirir. Bilançoda sağlayıcı dakika vermez: tüm gün
 * etkinliği, pencere adı başlıkta (veri dürüstlüğü 1).
 */

/* Uç yetkisiz ve her istek bir-üç veritabanı sorgusu koşuyor. Tavan tek
   olay ucuyla aynı ama ayrı kovada: takvim ekranında satırları tek tek
   ekleyen okur, abonelik çekişlerinin payını yemesin. Takvim sağlayıcıları
   aboneliği saatler arayla çeker; dakikada altmış, aynı çıkış adresini
   paylaşan çok sayıda abone için bile bol. */
const FEED_LIMIT = 60;
const FEED_WINDOW_MS = 60_000;

/* Paylaşılan önbellekte bir saat, okurun kendi istemcisinde on beş dakika.
   Takvim günde birkaç kez değişir (cron, rutin düzeltmeleri); dosyanın
   içindeki yenileme isteği altı saat (`FEED_REFRESH_HOURS`).

   BUGÜN ETKİSİZ, bilerek dokunulmadı (14 Kasım 2026, 3122'de ölçüldü):
   `next.config.ts` bütün `/api/*` yanıtlarına `no-store, max-age=0` yazıyor
   ve yapılandırma başlığı buradakini eziyor — istemciye giden başlık
   `no-store`. O kural sitenin önbellek güvencesi ("fiyatın ya da yetkili
   bir ucun eski kopyası servis edilmesin"); ona istisna açmak bu ucun
   değil sahibinin kararı. Akış `no-store` ile de doğru çalışır (takvim
   sağlayıcıları kendi aralığında çeker, koşullu istek yine 304 alır).
   İstisna açılırsa değişecek tek yer o kuralın `source` kalıbı. */
const CACHE_CONTROL = "public, max-age=900, s-maxage=3600";

function plain(body: string, status: number, headers: Record<string, string> = {}): Response {
  return new Response(body, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", ...headers },
  });
}

async function loadEvents(query: FeedQuery): Promise<IcsEvent[] | null> {
  const t = getDictionary(query.locale);
  const today = todayEt();

  if (query.kind === "makro") {
    const result = await getEventsBetweenResult(
      addEtDays(today, -MACRO_FEED_DAYS.back),
      addEtDays(today, MACRO_FEED_DAYS.ahead),
    );
    if (!result.ok) return null;
    return result.rows
      .filter((row) => query.impact === null || row.importance === query.impact)
      .map((row) =>
        economicIcsEvent(row, impactLabel(row.importance, t.calendar), query.locale, t.calendarFeed),
      );
  }

  let rows;
  try {
    rows = await getEarningsWithOverrides(
      addEtDays(today, -EARNINGS_FEED_DAYS.back),
      addEtDays(today, EARNINGS_FEED_DAYS.ahead),
      query.symbols,
    );
  } catch {
    return null;
  }
  /* Ad okunamazsa etkinlik sembolle yazılır (`getSymbolNames` hatayı boş
     tabloya çevirir); tarih elde, akışı bunun için düşürmeye değmez. */
  const names = await getSymbolNames(query.symbols);
  return rows.map((row) =>
    earningsIcsEvent(row, names[row.symbol]?.name ?? null, query.locale, t.calendarFeed),
  );
}

export async function GET(request: Request) {
  const limited = rateLimit(clientKey(request, "takvim-akis"), FEED_LIMIT, FEED_WINDOW_MS);
  if (!limited.allowed) {
    return plain("rate-limited", 429, { "Retry-After": String(limited.retryAfter) });
  }

  const query = parseFeedQuery(new URL(request.url).searchParams);
  if (!query) return plain("bad-request", 400);

  const events = await loadEvents(query);
  if (!events) return plain("unavailable", 503, { "Retry-After": "300" });

  const t = getDictionary(query.locale).calendarFeed;
  const body = buildIcs(events, {
    now: new Date(),
    calendar:
      query.kind === "makro"
        ? { name: t.macroName, description: t.macroDescription, refreshHours: FEED_REFRESH_HOURS }
        : { name: t.earningsName, description: t.earningsDescription, refreshHours: FEED_REFRESH_HOURS },
  });

  /* ETAG GÖVDEDEN. Her etkinliğin DTSTAMP'i kaydın `updated_at`i, "şimdi"
     değil; veri değişmedikçe gövde bayt bayt aynı kalır ve istemcinin
     koşullu isteği gövdesiz 304 alır. Zayıf etiket: sıkıştırma katmanı
     baytları değiştirebilir. */
  const etag = `W/"${createHash("sha1").update(body).digest("base64url")}"`;
  const headers = {
    "Cache-Control": CACHE_CONTROL,
    ETag: etag,
    /* Akış arama dizinine girmesin; sayfaların kendisi zaten dizinde. */
    "X-Robots-Tag": "noindex",
  };
  if (request.headers.get("if-none-match") === etag) {
    return new Response(null, { status: 304, headers });
  }

  return new Response(body, {
    headers: {
      ...headers,
      "Content-Type": "text/calendar; charset=utf-8",
      /* `inline`: abonelik bir indirme değil; ad yine de veriliyor ki
         adresi tarayıcıda açan okur anlamlı adlı bir dosya görsün. */
      "Content-Disposition": `inline; filename="acilis-zili-${query.kind}.ics"`,
    },
  });
}
