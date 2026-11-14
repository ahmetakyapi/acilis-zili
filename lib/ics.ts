/**
 * iCalendar (RFC 5545) üretimi — SAF katman: girdi olay listesi, çıktı metin.
 *
 * NEDEN AYRI MODÜL (14 Kasım 2026). Üretici `app/api/takvim/route.ts`
 * içindeydi ve yalnız tek olayı yazıyordu ("Takvime Ekle"). Takvim aboneliği
 * (`app/api/takvim/akis/route.ts`) aynı kuralları çok olayla istiyor:
 * kaçış, 75 oktetlik katlama, tüm gün olayı. İki uç aynı fonksiyonları
 * çağırıyor; kopya olsaydı Türkçe oktet düzeltmesi (aşağıda) ya da CR
 * süzgeci birinde kalır, ötekinde bayatlardı. Veritabanı, saat dilimi ve
 * sözlük burada YOK: olayın metnini ve anını çağıran kurar
 * (`lib/calendar-feed.ts`), testi `tests/ics.test.ts`.
 */

/** Takvim uygulamaları CRLF bekler; LF ile bazı istemciler dosyayı reddediyor. */
export const CRLF = "\r\n";

/* YALNIZ CR DE SATIR SONU (20 Ekim). `\r?\n` tek başına duran CR'yi
   geçiriyordu; Outlook gibi hoşgörülü okuyucular onu satır sonu sayıyor ve
   sağlayıcıdan gelen bir şirket adındaki CR, DESCRIPTION'ı bölüp dosyaya
   yeni bir özellik (URL, DTSTART…) sokabiliyordu. Öteki C0 denetim
   karakterleri RFC 5545'te TEXT değerinde yasak; atılıyor. */
export function escapeIcsText(value: string): string {
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\r|\n/g, "\\n");
}

/** UTC damgası: 20260827T203000Z */
export function stampUtc(date: Date): string {
  return `${date.toISOString().replace(/[-:]/g, "").split(".")[0]}Z`;
}

/** Tüm gün etkinliği için tarih damgası: 20260827 */
export function stampDate(isoDate: string): string {
  return isoDate.replace(/-/g, "");
}

/** Ertesi gün — tüm gün etkinliğinin DTEND'i dışlayıcıdır. */
export function nextDayStamp(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return stampDate(d.toISOString().slice(0, 10));
}

/**
 * 75 oktetlik satır sınırı (RFC 5545 § 3.1). Uzun bir SUMMARY tek satırda
 * gönderilince bazı istemciler (özellikle Outlook) dosyayı bozuk sayıyor.
 *
 * OKTET SAYILIYOR, KARAKTER DEĞİL — ve bu fark bu depoda teoriden ibaret
 * değil. Fonksiyon `line.length` ile UTF-16 kod birimi sayıyordu; Türkçe
 * metinde ç, ğ, ı, ö, ş, ü harflerinin her biri UTF-8'de İKİ oktet.
 * Ölçüldü: gerçek bir bilanço açıklaması ("…çeyrek sonuçlarını açıklıyor.
 * Sağlayıcı kesin saat vermiyor; açıklama kapanış sonrası bekleniyor.")
 * 74 karakterlik satırlara katlanıyor ama o satırlar 80 ve 83 oktet
 * tutuyordu. Yani sınırı aşmayı önlemek için yazılmış fonksiyon, Türkçe
 * üreten HER satırda sınırı aşıyordu.
 *
 * `for..of` kod NOKTASI geziyor: vekil çift (emoji gibi) ortadan bölünmez.
 * Devam satırı bir boşlukla başlıyor ve o boşluk da bütçeden düşüyor.
 */
export const FOLD_LIMIT = 75;

/* Kod noktasının UTF-8 boyu (14 Kasım). Eski hâl her karakterde
   `Buffer.byteLength(current + ch)` ile o ana dek biriken satırı yeniden
   ölçüyordu; tek olayda fark etmiyordu, yüzlerce olaylı akışta gereksiz.
   Eşsiz vekil (U+D800–DFFF) Node'da U+FFFD olarak üç oktet yazılır; buradaki
   aralık da üç veriyor, yani sayım gövdenin gerçek baytlarıyla aynı
   (`tests/ics.test.ts` bunu `Buffer.byteLength` ile karşılaştırıyor). */
function utf8Length(ch: string): number {
  const code = ch.codePointAt(0) ?? 0;
  if (code < 0x80) return 1;
  if (code < 0x800) return 2;
  if (code < 0x10000) return 3;
  return 4;
}

export function foldIcsLine(line: string): string {
  const parts: string[] = [];
  let current = "";
  let used = 0;

  for (const ch of line) {
    const size = utf8Length(ch);
    if (used + size > FOLD_LIMIT) {
      parts.push(current);
      current = " ";
      used = 1;
    }
    current += ch;
    used += size;
  }
  if (current || parts.length === 0) parts.push(current);
  return parts.join(CRLF);
}

export type IcsEvent = {
  /** Olayın kimliğinden türeyen KARARLI ad: aynı olay her yayında aynı UID. */
  uid: string;
  summary: string;
  description: string;
  url: string;
  /** Zamanlı etkinlik; yoksa `date` ile tüm gün yazılır. */
  start?: Date;
  /** "YYYY-MM-DD" — saat bilinmiyorsa. Uydurma saat yazılmaz. */
  date?: string;
  durationMinutes?: number;
  /**
   * Kaydın son değiştiği an. Verilirse DTSTAMP ve LAST-MODIFIED bu olur ve
   * gövde, veri değişmedikçe bayt bayt aynı kalır (akışın ETag'i buna
   * dayanıyor). Verilmezse DTSTAMP dosyanın üretildiği an (tek olay indirme).
   */
  lastModified?: Date;
};

export type IcsCalendarMeta = {
  /** Takvim uygulamasının abonelik listesinde görünen ad. */
  name: string;
  description?: string;
  /** İstemcinin akışı kaç saatte bir yeniden çekmesini istediğimiz. */
  refreshHours?: number;
};

/* SEQUENCE YAZILMIYOR, bilerek. Alan "kaçıncı revizyon" sayacıdır ve
   tablolarımızda öyle bir sayaç yok; `updated_at`ten türetilen bir sayı
   cron'un içeriği değiştirmeyen her yazışında da artar, yani olmayan bir
   revizyonu ilan ederdi. Abone istemci akışı her çekişte bütün olarak
   değiştiriyor; değişikliği LAST-MODIFIED taşıyor. */
function eventLines(event: IcsEvent, generatedAt: Date): string[] {
  const lines = [
    "BEGIN:VEVENT",
    foldIcsLine(`UID:${event.uid}`),
    `DTSTAMP:${stampUtc(event.lastModified ?? generatedAt)}`,
  ];
  if (event.lastModified) lines.push(`LAST-MODIFIED:${stampUtc(event.lastModified)}`);

  if (event.start) {
    const end = new Date(
      event.start.getTime() + (event.durationMinutes ?? 30) * 60_000,
    );
    lines.push(`DTSTART:${stampUtc(event.start)}`, `DTEND:${stampUtc(end)}`);
  } else if (event.date) {
    lines.push(
      `DTSTART;VALUE=DATE:${stampDate(event.date)}`,
      `DTEND;VALUE=DATE:${nextDayStamp(event.date)}`,
    );
  }

  lines.push(
    foldIcsLine(`SUMMARY:${escapeIcsText(event.summary)}`),
    foldIcsLine(`DESCRIPTION:${escapeIcsText(event.description)}`),
    foldIcsLine(`URL:${event.url}`),
    /* Bilgi etkinliği: okurun takviminde o saati "meşgul" göstermesin
       (tüm gün bilanço satırı bütün günü dolu gösteriyordu). */
    "TRANSP:TRANSPARENT",
    "END:VEVENT",
  );
  return lines;
}

/**
 * Tek `VCALENDAR`. `calendar` verilirse bu bir ABONELİK akışıdır: ad,
 * açıklama ve yenileme aralığı yazılır (`X-WR-*` Apple/Google'ın,
 * `NAME`/`REFRESH-INTERVAL` RFC 7986'nın okuduğu eşleri; ikisi birlikte).
 * Saatler UTC (`Z`) olduğu için `VTIMEZONE` gerekmiyor.
 */
export function buildIcs(
  events: readonly IcsEvent[],
  options: { now: Date; calendar?: IcsCalendarMeta },
): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Acilis Zili//TR//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];

  const meta = options.calendar;
  if (meta) {
    const name = escapeIcsText(meta.name);
    lines.push(foldIcsLine(`NAME:${name}`), foldIcsLine(`X-WR-CALNAME:${name}`));
    if (meta.description) {
      const description = escapeIcsText(meta.description);
      lines.push(
        foldIcsLine(`DESCRIPTION:${description}`),
        foldIcsLine(`X-WR-CALDESC:${description}`),
      );
    }
    if (meta.refreshHours) {
      lines.push(
        `REFRESH-INTERVAL;VALUE=DURATION:PT${meta.refreshHours}H`,
        `X-PUBLISHED-TTL:PT${meta.refreshHours}H`,
      );
    }
  }

  for (const event of events) lines.push(...eventLines(event, options.now));
  lines.push("END:VCALENDAR");

  return lines.join(CRLF) + CRLF;
}
