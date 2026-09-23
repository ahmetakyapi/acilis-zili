import type { StatTone } from "@/components/admin/AdminUI";
import { TR_ZONE, formatInZone, zoneDateKey } from "./session-clock";
import { addEtDays } from "./market-hours";
import { formatEtDateCompact, formatEtDateMedium } from "./utils";

/**
 * Yönetim panelinin SÖZLÜĞÜ — tarih, damga, göreli zaman ve ölçü adları.
 *
 * DÖRT BİÇİM, İKİ SAAT DİLİMİ VARDI (23 Eylül denetimi). Aynı panelde ham
 * ISO ("2026-09-22"), rakamsal ("22.09.2026"), okunur ("22 Eyl") tarih ve
 * sunucunun saat diliminde saniyeli damgalar ("23.09.2026 01:39:38")
 * yan yana duruyordu; göreli zaman "0 Saat Önce", "47 Saat Önce" yazıyordu.
 * Kural artık burada: okunur tarih (`adminDay`), yıl gerekiyorsa
 * `adminDayYear`, an için İstanbul saatiyle `adminStamp`. Rakamsal tarih
 * yalnızca yoğun tablo hücrelerinde kalıyor (lib/utils.ts →
 * `formatEtDateShort`).
 */

/**
 * İki dönemin karşılaştırması.
 *
 * ÖNCEKİ DÖNEM SIFIRSA DEĞİŞİM YAZILMAZ. "0'dan 40'a" bir yüzdeyle
 * anlatılamaz — sonsuz artıştır ve ekranda "%∞" ya da "%4000" yazmak
 * uydurma kesinliğin ta kendisi. Ölçüm yeni kurulduğunda ilk hafta boyunca
 * tam olarak bu durum geçerli: satır hiç çizilmiyor, yerine ham sayı
 * duruyor.
 *
 * ÖNCEKİ DÖNEM EKSİK ÖLÇÜLDÜYSE DE YAZILMAZ (23 Eylül denetimi). Sıfır
 * koruması yetmiyordu: 30 günlük pencerede önceki dönem 25 Tem–23 Ağu idi
 * ve ölçüm 13 Ağustos'ta başlamıştı — otuz günün on biri ölçülmüş bir
 * dönemle karşılaştırılan kutular "+%222", "+%343" diye sayfanın en büyük
 * yeşilini taşıyordu. `trackingFrom` ölçümün ilk günü, `previousFrom` önceki
 * pencerenin ilk günü: ölçüm pencereden sonra başladıysa kıyas yok.
 */
export function deltaOf(
  current: number,
  previous: number,
  opts: { trackingFrom?: string | null; previousFrom?: string } = {},
): { text: string; tone: StatTone; srLabel: string } | null {
  if (previous <= 0) return null;
  if (opts.trackingFrom && opts.previousFrom && opts.trackingFrom > opts.previousFrom) {
    return null;
  }
  const change = ((current - previous) / previous) * 100;
  /* Yüzde bir puanın altındaki fark gürültüdür; okla göstermek yanlış bir
     hareket hissi verir. */
  if (Math.abs(change) < 1) {
    /* Künye Title Case: StatBox içinde Title Case bir `sub` künyesinin
       yanında duruyor. `srLabel` cümle olduğu için küçük kalıyor. */
    return { text: "Değişim Yok", tone: "neutral", srLabel: "değişim yok" };
  }
  const rounded = Math.round(change);
  /* İŞARET METİNDE. `Math.abs` eksiyi siliyordu ve düşüş de artış da
     "%12" diye yazılıyordu — yönü YALNIZCA renk taşıyordu. Panelin kendi
     kuralı bunun tersini söylüyor ("Renk tek başına bilgi taşımıyor");
     renk körü okuyucu, tek renk çıktı ve ekran okuyucu için iki durum
     ayırt edilemiyordu. Türkçe yazımda yüzde işareti önde olduğu için
     işaret onun da önüne geçiyor: "−%12".

     SESLETİM DE ÖYLE: "yüzde 222 arttı". "222 yüzde arttı" yazılıyordu —
     ekrandaki "%222" ile aynı sırada okunmuyordu. */
  return {
    text: `${rounded > 0 ? "+" : "−"}%${Math.abs(rounded)}`,
    tone: rounded > 0 ? "up" : "down",
    srLabel: `yüzde ${Math.abs(rounded)} ${rounded > 0 ? "arttı" : "azaldı"}`,
  };
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * "Az Önce" / "4 Saat Önce" / "Dün" / "3 Gün Önce" — panelin tazelik
 * künyeleri.
 *
 * TITLE CASE, çünkü bunlar cümle değil künye. Kural CLAUDE.md'de yazılı ve
 * bir dönem "ölçü altındaki mikro künyeler" muaf tutulduğunda sonuç
 * tutarsızlık olmuştu: aynı ekranda Title Case bir rozetin altında küçük
 * harfle başlayan bir künye duruyordu.
 *
 * SIFIR YAZILMAZ, KIRK YEDİ SAAT DE (23 Eylül denetimi). "0 Dakika Önce",
 * "0 Saat Önce" bir eksik veri gibi okunuyordu; "47 Saat Önce" ise okura
 * iki günü saate çevirtiyordu. Bir dakikanın altı "Az Önce", 24–48 saat
 * "Dün", ötesi gün.
 */
export function agoLabel(date: Date | null, now: Date = new Date()): string {
  if (!date) return "Hiç";
  const elapsed = Math.max(0, now.getTime() - date.getTime());
  if (elapsed < MINUTE) return "Az Önce";
  if (elapsed < HOUR) return `${Math.floor(elapsed / MINUTE)} Dakika Önce`;
  if (elapsed < DAY) return `${Math.floor(elapsed / HOUR)} Saat Önce`;
  if (elapsed < 2 * DAY) return "Dün";
  return `${Math.floor(elapsed / DAY)} Gün Önce`;
}

/** ET takvim günü, yılsız: "22 Eyl". Yıl bağlamdan belliyse bu. */
export function adminDay(day: string): string {
  return formatEtDateCompact(day, "tr");
}

/** ET takvim günü, yıllı: "22 Eyl 2026". Tek başına duran tarih için. */
export function adminDayYear(day: string): string {
  return formatEtDateMedium(day, "tr");
}

/**
 * Yıl YALNIZCA başka bir yılsa yazılır: `ref` ile aynı yıldaysa "22 Eki",
 * değilse "22 Oca 2027". Takvimin uzak ucu aralıkta yılı aşıyor ve "5 Oca"
 * geçen ocak gibi okunurdu.
 */
export function adminDayIn(day: string, ref: string): string {
  return day.slice(0, 4) === ref.slice(0, 4) ? adminDay(day) : adminDayYear(day);
}

/**
 * Haftalık bültenin kapsadığı hafta: "14–18 Eyl Haftası", ay sınırında iki
 * ay birden ("29 Eyl–3 Eki Haftası").
 *
 * Kayıt, KAPSADIĞI haftanın pazartesisine çapalı (lib/content-write.ts →
 * `saveBrief`, `weekAnchor`) ve rakamsal tarihle yazıldığında "14.09.2026"
 * bir pazartesi bülteni gibi okunuyordu — oysa o kayıt 21 Eylül'de, biten
 * haftayı anlatarak yazıldı. Aralık bunu tek bakışta söylüyor. Cuma
 * sınırı: bülten işlem haftasını anlatıyor.
 */
export function adminWeekRange(monday: string): string {
  const friday = addEtDays(monday, 4);
  const sameMonth = monday.slice(0, 7) === friday.slice(0, 7);
  const start = sameMonth ? String(Number(monday.slice(8, 10))) : adminDay(monday);
  return `${start}–${adminDay(friday)} Haftası`;
}

const STAMP_DAY = new Intl.DateTimeFormat("tr-TR", {
  timeZone: TR_ZONE,
  day: "numeric",
  month: "short",
});
const STAMP_DAY_YEAR = new Intl.DateTimeFormat("tr-TR", {
  timeZone: TR_ZONE,
  day: "numeric",
  month: "short",
  year: "numeric",
});

/**
 * Bir ANIN künyesi, İstanbul saatiyle: "Bugün 11:42", "Dün 23:40",
 * "21 Eyl 11:42", başka yılsa "21 Eyl 2025 11:42".
 *
 * SUNUCUNUN SAATİ DEĞİL (23 Eylül denetimi). Damgalar
 * `toLocaleString("tr-TR")` ile basılıyordu: saat dilimi verilmediği için
 * sunucunun dilimi (üretimde UTC, üç saat geride ve gece yarısından sonra
 * bir GÜN geride) ve saniyesiyle — "23.09.2026 01:39:38". Saniye bir
 * rutinin zamanında koşup koşmadığı sorusuna hiçbir şey eklemiyor.
 *
 * "Bugün/Dün" İSTANBUL TAKVİM GÜNÜNDEN, 24 saatten değil — `staleMark` ile
 * `DataStamp`in kuralı. Gece 02:30'da yazılan kayıt "Bugün 02:30"; UTC'de
 * hâlâ dün olması okuru ilgilendirmiyor.
 */
export function adminStamp(at: Date, now: Date = new Date()): string {
  const clock = formatInZone(at, TR_ZONE);
  const day = zoneDateKey(at, TR_ZONE);
  const today = zoneDateKey(now, TR_ZONE);
  if (day === today) return `Bugün ${clock}`;
  if (day === addEtDays(today, -1)) return `Dün ${clock}`;
  const date = day.slice(0, 4) === today.slice(0, 4) ? STAMP_DAY : STAMP_DAY_YEAR;
  return `${date.format(at)} ${clock}`;
}

/**
 * Ölçü adları — TEK YAZIM.
 *
 * Aynı `countDistinct(visitorHash)` dört adla basılıyordu (23 Eylül
 * denetimi): kutuda "Ziyaretçi Günü", listede "Ziyaretçi-Günü", grafikte
 * "Tekil Ziyaretçi", tabloda "Ziyaretçi". Özet her gün döndüğü için çok
 * günlük toplam KİŞİ değil ziyaretçi-günüdür (gerekçe lib/admin-data.ts →
 * `TrafficTotals`); tek günün sayısı ise o günün ziyaretçisi. İki ad, iki
 * anlam, başka yazım yok.
 */
export const METRIC = {
  views: "Görüntüleme",
  /** Çok günlük toplam — aynı kişi her gün yeniden sayılır. */
  visitorDays: "Ziyaretçi-Günü",
  /** Tek günün tekil ziyaretçisi. */
  dailyVisitors: "Ziyaretçi",
  entries: "Giriş",
} as const;

/**
 * Okunamayan panelin tek cümlesi — boş durum cümlelerinden AYRI.
 * "Henüz kayıt yok" ile "okunamadı" aynı görünürse sorgu hatası sakin bir
 * gün gibi okunur (bkz. lib/admin-data.ts → `AdminResult`).
 */
export const ADMIN_READ_ERROR = "Veri okunamadı; sayfayı yenile ya da Sistem sekmesine bak.";
