import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { earningsCalendar, economicEvents, symbols } from "@/lib/schema";
import { earningsIcsEvent, economicIcsEvent, impactLabel } from "@/lib/calendar-feed";
import { buildIcs } from "@/lib/ics";
import { getDictionary, getLocale } from "@/lib/i18n";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { isIsoDate } from "@/lib/fx";

/**
 * Takvime Ekle — tek bir olayın `.ics` dosyası.
 *
 * NEDEN VAR. Ürünün belkemiği tarihli olaylar: bilanço günleri, Fed
 * toplantıları, veri açıklamaları. Ama hiçbiri okuyucunun kendi takvimine
 * geçmiyordu; tarihi öğrenmek için siteye geri gelmek gerekiyordu. Oysa asıl
 * değer o tarihte haberdar olmak.
 *
 * SAAT DİLİMİ SORUNU KENDİLİĞİNDEN ÇÖZÜLÜYOR. Site TR ve NY saatini yan yana
 * yazmak zorunda (`lib/session-clock.ts`), çünkü okuyucu Türkiye'de, kaynak
 * New York'ta. `.ics` ise saati UTC taşıyor: dosya okuyucunun takvim
 * uygulamasına düştüğünde onun kendi diliminde görünüyor. Yani burada ikili
 * saat yazmaya gerek yok, tek bir mutlak an yeterli.
 *
 * SAATİ BİLMİYORSAK TÜM GÜN. Bilanço satırlarında sağlayıcı dakika vermiyor,
 * yalnızca "açılış öncesi / kapanış sonrası" diyor (`hour` = bmo/amc/dmh).
 * Sahte bir saat yazmak (ör. amc için 16:30) takvimde ölçülmüş bir randevu
 * gibi görünürdü; oysa elimizde pencere var, an yok. Bu yüzden saati
 * bilinmeyen kayıt TÜM GÜN etkinliği olarak yazılıyor ve pencere adı başlıkta
 * geçiyor. Ekonomik olaylarda saat gerçek (`event_time_et`), orada zamanlı
 * etkinlik üretiliyor.
 *
 * `?tip=bilanco&sembol=NVDA&tarih=2026-08-27`
 * `?tip=olay&slug=cpi-2026-08-12`
 */

/* ÜRETİCİ ARTIK `lib/ics.ts`TE (14 Kasım 2026). Kaçış (yalnız CR de satır
   sonu), 75 OKTETLİK katlama ve tüm gün damgası buradaydı; takvim aboneliği
   (`./akis/route.ts`) aynı kuralları çok olayla istediği için karar
   yorumlarıyla birlikte oraya taşındı. Olayın kimliği ve metni de ortak
   (`lib/calendar-feed.ts`, sözlükte `calendarFeed`): tek tek eklenen
   etkinlik ile abonelikten gelen aynı UID'yi ve aynı cümleyi taşır.
   DTSTAMP burada dosyanın üretildiği an (indirilen tek dosya); akışta
   kaydın `updated_at`i. */

function icsResponse(body: string, filename: string): Response {
  return new Response(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}.ics"`,
      "Cache-Control": "no-store",
    },
  });
}

/* Uç YETKİSİZ ve her istek en az iki veritabanı sorgusu koşuyor (kayıt +
   şirket adı). Tavan cömert: bir okuyucu takvim ekranındaki bütün satırları
   tek tek eklese bile sınıra yaklaşmaz, ama aynı adresten saniyede yüzlerce
   istek gelmesi artık ücretsiz değil. Aynı sayaç ailesi arama ve grafik
   uçlarında da kullanılıyor. */
const ICS_LIMIT = 60;
const ICS_WINDOW_MS = 60_000;

export async function GET(request: Request) {
  const limited = rateLimit(clientKey(request, "takvim"), ICS_LIMIT, ICS_WINDOW_MS);
  if (!limited.allowed) {
    return new Response("rate-limited", {
      status: 429,
      headers: { "Retry-After": String(limited.retryAfter) },
    });
  }

  const params = new URL(request.url).searchParams;
  const tip = params.get("tip");
  const locale = await getLocale();
  const t = getDictionary(locale);

  if (tip === "bilanco") {
    const symbol = (params.get("sembol") ?? "").toUpperCase().slice(0, 12);
    const date = params.get("tarih") ?? "";
    /* TAKVİMDE OLAN GÜN (20 Ekim). Desen `2026-02-30`u geçiriyordu,
       Postgres `date` sütunu onu "date/time field value out of range" ile
       reddediyor ve yakalanmayan hata 500 + `app_errors` satırı oluyordu —
       tarayıcı ve bozuk bağlantı gürültüsü yönetim panelinin hata sayacına
       yazılıyordu. Doğrulama takvime bakan ortak yardımcıda. */
    if (!/^[A-Z.\-]{1,12}$/.test(symbol) || !isIsoDate(date)) {
      return new Response("bad-request", { status: 400 });
    }

    /* İki okuma birbirini beklemiyor; veritabanı düşerse 503 (aynı gürültü
       gerekçesi). Kayıt yoksa ad sorgusu boşa gidiyor — bulunan kayıtta
       kazanılan gidiş-dönüşün yanında ucuz. */
    let found;
    try {
      found = await Promise.all([
        db
          .select({ hour: earningsCalendar.hour })
          .from(earningsCalendar)
          .where(
            and(
              eq(earningsCalendar.symbol, symbol),
              eq(earningsCalendar.reportDate, date),
            ),
          )
          .limit(1),
        db
          .select({ name: symbols.name })
          .from(symbols)
          .where(eq(symbols.symbol, symbol))
          .limit(1),
      ]);
    } catch {
      return new Response("unavailable", { status: 503 });
    }
    const [[row], [meta]] = found;
    if (!row) return new Response("not-found", { status: 404 });

    return icsResponse(
      buildIcs(
        [earningsIcsEvent({ symbol, reportDate: date, hour: row.hour }, meta?.name ?? null, locale, t.calendarFeed)],
        { now: new Date() },
      ),
      `${symbol.toLowerCase()}-${date}`,
    );
  }

  if (tip === "olay") {
    const slug = (params.get("slug") ?? "").slice(0, 120);
    if (!/^[a-z0-9-]+$/.test(slug)) {
      return new Response("bad-request", { status: 400 });
    }

    let found;
    try {
      found = await db
        .select({
          eventDate: economicEvents.eventDate,
          eventTimeEt: economicEvents.eventTimeEt,
          titleTr: economicEvents.titleTr,
          titleEn: economicEvents.titleEn,
          importance: economicEvents.importance,
        })
        .from(economicEvents)
        .where(eq(economicEvents.slug, slug))
        .limit(1);
    } catch {
      return new Response("unavailable", { status: 503 });
    }
    const [row] = found;
    if (!row) return new Response("not-found", { status: 404 });

    /* ÖNEM DEĞERİ ÇEVRİLİYOR. Ham veritabanı değeri basılıyordu:
       Türkçe kayıtta "Önem: high" çıkıyor, üstelik bu, kullanıcının
       takvim uygulamasında — sitenin DIŞINDA — gördüğü tek metin.
       Sözlükte karşılığı zaten vardı. Saatin ET → UTC çevrimi ortak
       kurucuda, o da tek yerden geçiyor (`lib/market-hours.ts`). */
    return icsResponse(
      buildIcs(
        [economicIcsEvent({ ...row, slug }, impactLabel(row.importance, t.calendar), locale, t.calendarFeed)],
        { now: new Date() },
      ),
      slug,
    );
  }

  return new Response("bad-request", { status: 400 });
}
