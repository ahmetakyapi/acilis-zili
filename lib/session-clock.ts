import {
  AFTER_HOURS_MINUTES,
  ET_ZONE,
  SESSION_BOUNDS,
  etDateTimeToUtc,
} from "./market-hours";
import type { Locale } from "./i18n/config";

/**
 * Okuyucunun saati.
 *
 * `lib/market-hours.ts` seansın KENDİ saatini tutar: kaynakların tamamı
 * (BLS, Fed, Finnhub, Alpaca) New York saatiyle yayınlar ve o dosya tek
 * doğruluk kaynağıdır. Burası bambaşka bir soruyu cevaplıyor: bu an EKRANDA
 * hangi saatle yazılmalı?
 *
 * Türkçe okuyan biri için cevap Türkiye saatidir. "09:30 açılış" doğrudur ama
 * okuyucunun duvar saatinde bir karşılığı yoktur; "16:30" vardır. Bu yüzden
 * TR dilinde birincil saat İstanbul, ikincil saat New York olur; EN dilinde
 * sıra tersine döner — kaynak saati öne geçer.
 *
 * FARK SABİT DEĞİL. Türkiye yaz saati uygulamıyor, ABD uyguluyor: açılış
 * yazın 16:30, kışın 17:30 TR'ye denk gelir. Bu yüzden hiçbir yerde sabit
 * saat yazılmaz, hepsi o günün tarihiyle hesaplanır.
 */

export const TR_ZONE = "Europe/Istanbul";

/** O dilde okuyanın duvar saati. */
export function displayZone(locale: Locale): string {
  return locale === "tr" ? TR_ZONE : ET_ZONE;
}

/** Birincil saatin yanına yazılan künye — "16:30 TR", "09:30 NY". */
export function zoneTag(locale: Locale): { primary: "TR" | "NY"; secondary: "TR" | "NY" } {
  return locale === "tr"
    ? { primary: "TR", secondary: "NY" }
    : { primary: "NY", secondary: "TR" };
}

const CLOCKS = new Map<string, Intl.DateTimeFormat>();

/** "HH:mm" — 24 saat, gece yarısı 00:00 (bazı ICU sürümleri 24:00 basıyor). */
export function formatInZone(date: Date, zone: string): string {
  let clock = CLOCKS.get(zone);
  if (!clock) {
    clock = new Intl.DateTimeFormat("en-GB", {
      timeZone: zone,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
    CLOCKS.set(zone, clock);
  }
  return clock.format(date);
}

const PARTS = new Map<string, Intl.DateTimeFormat>();

/**
 * Verilen anda bir saat diliminin UTC'ye göre kayması (saniye).
 * Grafik ekseni bunu kullanıyor: lightweight-charts zaman değerlerini UTC
 * sanıyor, biz de barları gösterilecek dilimin duvar saatine kaydırıyoruz.
 */
export function zoneOffsetSeconds(unixSeconds: number, zone: string): number {
  let parts = PARTS.get(zone);
  if (!parts) {
    parts = new Intl.DateTimeFormat("en-US", {
      timeZone: zone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
    PARTS.set(zone, parts);
  }
  const date = new Date(unixSeconds * 1000);
  const read = parts.formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(read.find((p) => p.type === type)?.value ?? 0);
  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour") % 24,
    get("minute"),
  );
  return Math.round((asUtc - date.getTime()) / 1000);
}

export type TimePair = {
  /** Okuyucunun dilinde önce yazılan saat. */
  primary: string;
  /** Parantezde ya da alt satırda duran diğer saat. */
  secondary: string;
};

/**
 * Bir ET saatini (o günün tarihiyle birlikte) iki saate açar.
 * Tarih gerekiyor: ET↔TR farkı ABD yaz saatiyle kayıyor.
 */
export function timePair(
  dateEt: string,
  timeEt: string,
  locale: Locale,
): TimePair {
  const utc = etDateTimeToUtc(dateEt, timeEt);
  const tr = formatInZone(utc, TR_ZONE);
  return locale === "tr"
    ? { primary: tr, secondary: timeEt }
    : { primary: timeEt, secondary: tr };
}

/** O gün Türkiye saatinin New York saatinden farkı (dakika): yazın 420. */
export function trOffsetMinutes(dateEt: string): number {
  // Gün ortası referans alınır: DST sınırının hangi tarafına düşerse düşsün
  // seans saatleri o günün farkıyla yazılır.
  const noonUtc = etDateTimeToUtc(dateEt, "12:00");
  const [hour, minute] = formatInZone(noonUtc, TR_ZONE).split(":").map(Number);
  return hour * 60 + minute - 12 * 60;
}

/**
 * ET gün içi dakikasına eklenecek farklar.
 * Gün Şeridi eksenini ET dakikasıyla konumlandırıyor ama etiketleri okuyucunun
 * saatiyle yazıyor; ikisi arasındaki köprü bu. İki saat de gösterildiği için
 * fark çift geliyor: birincil satır ve altındaki künye satırı.
 */
export function displayOffsets(
  dateEt: string,
  locale: Locale,
): { primary: number; secondary: number } {
  const tr = trOffsetMinutes(dateEt);
  return locale === "tr"
    ? { primary: tr, secondary: 0 }
    : { primary: 0, secondary: tr };
}

/** Dakikayı "HH:mm" yazar; gün taşması başa sarar (03:00 ertesi gün olsa da). */
export function clockOf(minutes: number): string {
  const wrapped = ((minutes % 1440) + 1440) % 1440;
  return `${String(Math.floor(wrapped / 60)).padStart(2, "0")}:${String(
    wrapped % 60,
  ).padStart(2, "0")}`;
}

export type SessionKey = "pre" | "regular" | "after" | "overnight";

export type SessionWindow = {
  key: SessionKey;
  /** Okuyucunun saatiyle "16:30–23:00". */
  primary: string;
  /** Diğer saatle "09:30–16:00". */
  secondary: string;
};

const DASH = "–";

/**
 * Günün dört penceresi — ön seans, ana seans, akşam seansı, gece.
 * Kapanış saati parametre: yarım günlerde borsa 13:00'te kapanır.
 */
/**
 * O günün seans pencereleri.
 *
 * `closeMinutes` GÜNÜN KENDİ KAPANIŞI — yarım günlerde 13:00. Parametre bir
 * "HH:mm" dizesiydi ve yalnızca ana seansın bitişini kaydırıyordu: akşam
 * seansının bitişi sabit 20:00 kalıyordu. Böylece 27 Kasım 2026 gibi bir
 * yarım günde lejant "Akşam Seansı 13:00–20:00" yazıyordu — yedi saatlik
 * bir uzatılmış seans, gerçeği dört saat. Üstelik grafiğin hemen üstündeki
 * gölgeler aynı günü doğru çiziyordu, yani ekranın iki yarısı çelişiyordu.
 * Dakika alınca pencere kapanıştan türetilebiliyor.
 */
export function sessionWindows(
  dateEt: string,
  locale: Locale,
  closeMinutes: number = SESSION_BOUNDS.regularClose,
): SessionWindow[] {
  const closeEt = clockOf(closeMinutes);
  const afterEnd = clockOf(closeMinutes + AFTER_HOURS_MINUTES);
  const bounds: [SessionKey, string, string][] = [
    ["pre", clockOf(SESSION_BOUNDS.preMarketOpen), clockOf(SESSION_BOUNDS.regularOpen)],
    ["regular", clockOf(SESSION_BOUNDS.regularOpen), closeEt],
    ["after", closeEt, afterEnd],
    ["overnight", afterEnd, clockOf(SESSION_BOUNDS.preMarketOpen)],
  ];

  return bounds.map(([key, from, to]) => {
    const start = timePair(dateEt, from, locale);
    const end = timePair(dateEt, to, locale);
    return {
      key,
      primary: `${start.primary}${DASH}${end.primary}`,
      secondary: `${start.secondary}${DASH}${end.secondary}`,
    };
  });
}

/* `railSpan` burada dururdu: şerit başlığının sağına "11:00 — 03:00 TR"
   yazan tek satırlık pencere. Aynı iki saat artık eksenin uçlarında
   basıldığı için (components/today/DayRail.tsx) kaldırıldı. */
