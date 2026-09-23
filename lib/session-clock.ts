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

/**
 * Birincil saatin yanında küçük puntoyla duran ÖTEKİ saat dilimi.
 * `displayZone`un tersi: TR okuyucu için New York, EN okuyucu için İstanbul.
 * Ana sayfanın zil künyesi her zili iki saatle yazıyor; sıra `zoneTag` ile
 * aynı kaynaktan geliyor ki künye ile saat etiketi hiçbir zaman çelişmesin.
 */
export function secondaryZone(locale: Locale): string {
  return locale === "tr" ? ET_ZONE : TR_ZONE;
}

/**
 * Verilen dilimde, `nowMs`ten sonraki İLK 00:00 anı.
 *
 * NEDEN VAR: ana sayfa "Bugün / Yarın" ve üst şeritteki tarihi OKUYUCUNUN
 * günüyle yazıyor, ama `SessionRefresh` yalnızca New York'un seans
 * sınırlarında (ve ET gece yarısında) tazeliyordu. TR okuyucu için gün
 * 00:00 TR'de değişiyor; bir sonraki ET sınırı ise akşam seansının bitişi
 * (03:00 TR) ya da ön seans açılışı (11:00 TR). Arada üç ila on bir saat
 * boyunca ekran dünün tarihini ve "Yarın 16:30" gibi artık yanlış olan bir
 * etiketi taşıyordu. Tazeleme artık iki anın erkenine kuruluyor.
 *
 * SABİT FARK YOK: dilimin kayması o günün tarihiyle `zoneOffsetSeconds`ten
 * okunuyor ve bir kez düzeltiliyor — yaz saati sınırında gece yarısı
 * kaymanın değiştiği güne denk gelirse ilk tahmin bir saat şaşabilir.
 */
export function nextZoneMidnight(nowMs: number, zone: string): Date {
  /* `zoneOffsetSeconds` dakikaya kadar okuyor ve anın saniyesini kaymaya
     katıyor; dilim kaymaları tam dakika olduğu için dakikaya yuvarlanıyor. */
  const offsetMs = (at: number) =>
    Math.round(zoneOffsetSeconds(Math.floor(at / 1000), zone) / 60) * 60_000;
  const offsetNow = offsetMs(nowMs);
  const local = new Date(nowMs + offsetNow);
  const midnightLocal = Date.UTC(
    local.getUTCFullYear(),
    local.getUTCMonth(),
    local.getUTCDate() + 1,
  );
  return new Date(midnightLocal - offsetMs(midnightLocal - offsetNow));
}

const KEYS = new Map<string, Intl.DateTimeFormat>();

/**
 * O anın okuyucu dilimindeki takvim günü, "YYYY-MM-DD".
 * Göreli gün ("Bugün", "Yarın") iki anın BU anahtarlarının farkından çıkar;
 * 24 saatlik fark değil — kışın 16:00 ET kapanışı 00:00 TR, yani ertesi gün.
 */
export function zoneDateKey(date: Date, zone: string): string {
  let parts = KEYS.get(zone);
  if (!parts) {
    parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: zone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    KEYS.set(zone, parts);
  }
  return parts.format(date);
}

/**
 * Bir ET kaydının okuyucu gününe göre uzaklığı: 0 "Bugün", 1 "Yarın", eksi
 * geçmiş.
 *
 * TEK TANIM. Ana sayfanın zil künyesi uzaklığı okuyucunun takvim gününden
 * sayıyordu; takvim, sıradaki açıklama kartı ve yaklaşan bilançolar ise ET
 * gününden (`daysBetweenEt(todayEt(), …)`). Her gece TR'de 00:00–07:00
 * arası aynı okuyucu çelişen etiketler görüyordu: zil "Bugün 16:30"
 * derken takvim aynı günün 15:30 açıklamasına "Yarın" diyordu (ölçüldü,
 * 24 Eylül 00:30 TR). Artık hepsi buradan sayıyor.
 *
 * Saatli kayıtta hedef gün, ET anının okuyucu dilimindeki günü (20:00 ET
 * açıklaması TR'de ertesi güne düşer). Saatsiz kayıtta (gün grubu, saati
 * belirsiz bilanço) ET tarihinin kendisi. Gruplama, çapa ve veri anahtarı
 * ET tarihinde kalır; yalnızca göreli etiket okuyucuya göre.
 */
export function readerDayOffset(
  dateEt: string,
  timeEt: string | null,
  locale: Locale,
  now: Date = new Date(),
): number {
  const zone = displayZone(locale);
  const target = timeEt ? zoneDateKey(etDateTimeToUtc(dateEt, timeEt), zone) : dateEt;
  return Math.round(
    (Date.parse(`${target}T00:00:00Z`) - Date.parse(`${zoneDateKey(now, zone)}T00:00:00Z`)) /
      86_400_000,
  );
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

/**
 * Bir dilimin DUVAR SAATİNİ gerçek bir ana çevirir: "2026-09-23" + "16:10"
 * İstanbul'da → UTC `Date`.
 *
 * NEDEN VAR: yönetim panelinin rutin beklentileri Türkiye saatiyle
 * yazılı (`BRIEF_PUBLISH_TR`: günlük 16:10, haftalık 09:30) ve "gecikti mi"
 * sorusu bir ANLA cevaplanıyor: şimdi, o gün 16:10 TR'nin otuz dakika
 * ötesinde mi. Karşılaştırma bir dönem saat dizesiyle yapılıyordu
 * (`"01:00" >= "16:10"`) ve gün sınırını hiç görmüyordu — gece yarısını
 * geçince kaçırılan bülten yeniden "bekleniyor"a dönüyordu.
 *
 * SABİT FARK YOK: kayma o anın tarihiyle `zoneOffsetSeconds`ten okunuyor ve
 * `etToUtc` gibi bir kez düzeltiliyor — dilim yaz saati uygularsa da doğru.
 */
export function zoneWallTime(dateStr: string, time: string, zone: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const wall = Date.UTC(year, month - 1, day, hour, minute);
  const offsetMs = (at: number) =>
    Math.round(zoneOffsetSeconds(Math.floor(at / 1000), zone) / 60) * 60_000;
  const firstGuess = wall - offsetMs(wall);
  return new Date(wall - offsetMs(firstGuess));
}

/**
 * ET gününün Türkiye saatiyle döndüğü an — "07:00" (yaz), "08:00" (kış).
 *
 * Panelin günü ET takvim günü (`viewedOn`, lib/admin-data.ts dosya başı) ve
 * künye bunu yalnızca "ET Takvim Günü" diye söylüyordu: Türkiye'den bakan
 * yönetici için "Bugün · Sürüyor" sütununun sabah 07:00'ye kadar DÜNÜ
 * anlattığı hiçbir yerde yazmıyordu. Saat sabit yazılamaz — ABD yaz saatiyle
 * bir saat kayıyor — o yüzden bir sonraki New York gece yarısından
 * hesaplanıyor.
 */
export function etDayRolloverTr(now: Date = new Date()): string {
  return formatInZone(nextZoneMidnight(now.getTime(), ET_ZONE), TR_ZONE);
}

/**
 * Gün sınırının künyesi: "Gün 07:00 TR'de Döner (New York Gece Yarısı)".
 *
 * EK SAATE DEĞİL "TR"YE BİTİŞİYOR. "07:00'de" yazılsaydı ünlü uyumu saatin
 * okunuşuna bağlı olurdu (yedide, altıda); ek sabit yazılamaz — Trafik
 * sayfasının Üyelik notundaki kuralın aynısı. "TR" her zaman "TR'de".
 */
export function dayBoundaryNote(now: Date = new Date()): string {
  return `Gün ${etDayRolloverTr(now)} TR'de Döner (New York Gece Yarısı)`;
}

/* `railSpan` burada dururdu: şerit başlığının sağına "11:00 — 03:00 TR"
   yazan tek satırlık pencere. Aynı iki saat artık eksenin uçlarında
   basıldığı için (`components/today/DayFlow.tsx` → `.axisFoot`) kaldırıldı. */
