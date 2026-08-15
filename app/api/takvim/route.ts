import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { earningsCalendar, economicEvents, symbols } from "@/lib/schema";
import { etDateTimeToUtc } from "@/lib/market-hours";
import { getDictionary, getLocale } from "@/lib/i18n";
import { SITE_URL } from "@/lib/site";

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

/** Takvim uygulamaları CRLF bekler; LF ile bazı istemciler dosyayı reddediyor. */
const CRLF = "\r\n";

/** Bilanço penceresi → başlıkta okunan ad. */
const WINDOW_LABEL: Record<string, { tr: string; en: string }> = {
  bmo: { tr: "açılış öncesi", en: "before the open" },
  amc: { tr: "kapanış sonrası", en: "after the close" },
  dmh: { tr: "seans içinde", en: "during the session" },
};

function escapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/** UTC damgası: 20260827T203000Z */
function stampUtc(date: Date): string {
  return `${date.toISOString().replace(/[-:]/g, "").split(".")[0]}Z`;
}

/** Tüm gün etkinliği için tarih damgası: 20260827 */
function stampDate(isoDate: string): string {
  return isoDate.replace(/-/g, "");
}

/** Ertesi gün — tüm gün etkinliğinin DTEND'i dışlayıcıdır. */
function nextDay(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return stampDate(d.toISOString().slice(0, 10));
}

/**
 * 75 oktetlik satır sınırı. Uzun bir SUMMARY tek satırda gönderilince bazı
 * istemciler (özellikle Outlook) dosyayı bozuk sayıyor.
 */
function fold(line: string): string {
  if (line.length <= 74) return line;
  const parts = [line.slice(0, 74)];
  let rest = line.slice(74);
  while (rest.length > 73) {
    parts.push(` ${rest.slice(0, 73)}`);
    rest = rest.slice(73);
  }
  if (rest) parts.push(` ${rest}`);
  return parts.join(CRLF);
}

function buildIcs(event: {
  uid: string;
  summary: string;
  description: string;
  url: string;
  /** Zamanlı etkinlik; yoksa `date` ile tüm gün yazılır. */
  start?: Date;
  date?: string;
  durationMinutes?: number;
}): string {
  const now = stampUtc(new Date());
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Acilis Zili//TR//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${event.uid}`,
    `DTSTAMP:${now}`,
  ];

  if (event.start) {
    const end = new Date(
      event.start.getTime() + (event.durationMinutes ?? 30) * 60_000,
    );
    lines.push(`DTSTART:${stampUtc(event.start)}`, `DTEND:${stampUtc(end)}`);
  } else if (event.date) {
    lines.push(
      `DTSTART;VALUE=DATE:${stampDate(event.date)}`,
      `DTEND;VALUE=DATE:${nextDay(event.date)}`,
    );
  }

  lines.push(
    fold(`SUMMARY:${escapeText(event.summary)}`),
    fold(`DESCRIPTION:${escapeText(event.description)}`),
    fold(`URL:${event.url}`),
    "END:VEVENT",
    "END:VCALENDAR",
  );

  return lines.join(CRLF) + CRLF;
}

function icsResponse(body: string, filename: string): Response {
  return new Response(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}.ics"`,
      "Cache-Control": "no-store",
    },
  });
}

/** Ham `importance` değeri sözlükteki karşılığına çevrilir. */
function impactLabel(
  importance: string | null,
  t: ReturnType<typeof getDictionary>,
): string {
  if (importance === "high") return t.calendar.impactHigh;
  if (importance === "medium") return t.calendar.impactMedium;
  if (importance === "low") return t.calendar.impactLow;
  return importance ?? "-";
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const tip = params.get("tip");
  const locale = await getLocale();
  const t = getDictionary(locale);
  const tr = locale === "tr";

  if (tip === "bilanco") {
    const symbol = (params.get("sembol") ?? "").toUpperCase().slice(0, 12);
    const date = params.get("tarih") ?? "";
    if (!/^[A-Z.\-]{1,12}$/.test(symbol) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return new Response("bad-request", { status: 400 });
    }

    const [row] = await db
      .select({ hour: earningsCalendar.hour })
      .from(earningsCalendar)
      .where(
        and(
          eq(earningsCalendar.symbol, symbol),
          eq(earningsCalendar.reportDate, date),
        ),
      )
      .limit(1);
    if (!row) return new Response("not-found", { status: 404 });

    const [meta] = await db
      .select({ name: symbols.name })
      .from(symbols)
      .where(eq(symbols.symbol, symbol))
      .limit(1);

    const company = meta?.name ?? symbol;
    const win = row.hour ? WINDOW_LABEL[row.hour] : undefined;
    const window = win ? (tr ? win.tr : win.en) : null;

    const summary = tr
      ? `${symbol} bilanço${window ? ` · ${window}` : ""}`
      : `${symbol} earnings${window ? ` · ${window}` : ""}`;
    const description = tr
      ? `${company} ${date} tarihinde çeyrek sonuçlarını açıklıyor.${
          window
            ? ` Sağlayıcı kesin saat vermiyor; açıklama ${window} bekleniyor.`
            : " Sağlayıcı açıklama saatini vermiyor."
        }`
      : `${company} reports quarterly results on ${date}.${
          window
            ? ` No exact time is published; the release is expected ${window}.`
            : " No release time is published."
        }`;

    return icsResponse(
      buildIcs({
        uid: `bilanco-${symbol}-${date}@acilis-zili`,
        summary,
        description,
        url: `${SITE_URL}/hisse/${symbol}`,
        // Saat yok: tüm gün. Gerekçe dosyanın başındaki notta.
        date,
      }),
      `${symbol.toLowerCase()}-${date}`,
    );
  }

  if (tip === "olay") {
    const slug = (params.get("slug") ?? "").slice(0, 120);
    if (!/^[a-z0-9-]+$/.test(slug)) {
      return new Response("bad-request", { status: 400 });
    }

    const [row] = await db
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
    if (!row) return new Response("not-found", { status: 404 });

    const title = tr ? row.titleTr : row.titleEn;
    /* Saat ET olarak duruyor; UTC'ye çevrimi tek yerden geçiyor
       (`lib/market-hours.ts`) — burada elle aritmetik yapılmıyor. */
    const start = row.eventTimeEt
      ? etDateTimeToUtc(row.eventDate, row.eventTimeEt)
      : null;

    return icsResponse(
      buildIcs({
        uid: `olay-${slug}@acilis-zili`,
        summary: title,
        /* ÖNEM DEĞERİ ÇEVRİLİYOR. Ham veritabanı değeri basılıyordu:
           Türkçe kayıtta "Önem: high" çıkıyor, üstelik bu, kullanıcının
           takvim uygulamasında — sitenin DIŞINDA — gördüğü tek metin.
           Sözlükte karşılığı zaten vardı. */
        description: tr
          ? `Ekonomik veri açıklaması. Önem: ${impactLabel(row.importance, t)}.`
          : `Economic data release. Importance: ${impactLabel(row.importance, t)}.`,
        url: `${SITE_URL}/takvim`,
        ...(start ? { start } : { date: row.eventDate }),
      }),
      slug,
    );
  }

  return new Response("bad-request", { status: 400 });
}
