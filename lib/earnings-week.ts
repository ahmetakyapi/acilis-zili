import type { Locale } from "@/lib/i18n/config";
import {
  addEtDays,
  closeMinutesFor,
  SESSION_BOUNDS,
  type MarketHoliday,
} from "@/lib/market-hours";
import { clockOf, timePair, type TimePair } from "@/lib/session-clock";

/**
 * Haftalık Bilanço Takvimi — saf mantık (hafta seçimi, şirket süzgeci,
 * yaklaşık saatler). Veri okuması `lib/earnings-week-data.ts`te; bu dosya
 * veritabanına dokunmuyor, `tests/earnings-week.test.ts` onu doğrudan sınıyor.
 */

/**
 * Görselin ve sayfanın taşıyabileceği en fazla şirket.
 *
 * Bilanço sezonunun yoğun bir haftasında takvimde 1.500'ü aşkın satır
 * var; paylaşılan bir görselde okunabilecek olan birkaç düzine. Otuz, dikey
 * görselde gün başına altı karo demek — telefonda sembolün hâlâ okunduğu
 * sınır.
 */
export const WEEK_MAX_NAMES = 30;

/**
 * "Kayda değer" eşiği — piyasa değeri, dolar.
 *
 * Endeks üyeliği (S&P 500, Nasdaq-100, Dow) tek başına yetiyor; bu eşik
 * endekste olmayan büyükleri (ADR'ler, yeni halka arzlar) içeri alıyor.
 * Takvimin görünür katmanı 100 milyar $'dan başlıyor (`HERO_MIN_CAP`) ama
 * o eşik sezon dışı bir haftada görseli boş bırakırdı.
 */
export const NOTABLE_MIN_CAP = 10e9;

/**
 * Açılış öncesi bilançoların TEMSİLİ saati: ana seanstan 90 dakika önce,
 * yani 08:00 ET.
 *
 * Sağlayıcı dakika vermiyor, yalnızca pencereyi (bmo/amc) veriyor; ekranda
 * bu yüzden "~" ile yazılıyor (CLAUDE.md "Veri dürüstlüğü" 1). Sayı ana
 * sayfanın gün akışıyla AYNI (`lib/day-flow-data.ts` → `windows.bmo`,
 * 08:00 ET): aynı bilanço iki ekranda iki farklı yaklaşık saatle durmasın.
 * TR karşılığı ABD yaz saatiyle kayıyor (yazın 15:00, kışın 16:00); o
 * yüzden sabit yazılmıyor, `timePair` o günün tarihiyle çeviriyor.
 */
export const BMO_LEAD_MINUTES = 90;
export const BMO_TYPICAL_MINUTES = SESSION_BOUNDS.regularOpen - BMO_LEAD_MINUTES;

/** Pazartesi–Cuma: işlem haftası. */
export const WEEK_DAYS = 5;
const DAYS_IN_WEEK = 7;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function utcDay(dateStr: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

/** Tarihin haftasının pazartesisi ("YYYY-MM-DD", ET takvim günü). */
export function mondayOf(dateStr: string): string {
  const weekday = utcDay(dateStr).getUTCDay();
  /* Pazar 0: bir ÖNCEKİ pazartesiye değil, haftanın başına gider — pazar
     günü "bu hafta" dediğimizde okuyucu biten haftayı kastediyor. */
  const back = (weekday + DAYS_IN_WEEK - 1) % DAYS_IN_WEEK;
  return addEtDays(dateStr, -back);
}

/**
 * Varsayılan hafta: bugünden SONRAKİ pazartesi.
 *
 * Görselin işi "gelecek hafta kim açıklıyor" sorusu ve en çok hafta
 * sonunda paylaşılıyor. Pazartesi sabahı da aynı cevap verilseydi o haftanın
 * bilançoları görselden düşerdi; sayfanın "Bu Hafta" bağlantısı onu
 * karşılıyor.
 */
export function defaultWeekStart(todayEt: string): string {
  return addEtDays(mondayOf(todayEt), DAYS_IN_WEEK);
}

/**
 * `?hafta=` parametresi — geçerli bir tarih ise o haftanın pazartesisi.
 *
 * Biçim tutsa da takvimde olmayan gün ("2026-02-31") reddediliyor: `Date`
 * onu sessizce 3 Mart'a kaydırıyordu ve adres başka bir haftayı gösterirdi.
 */
export function parseWeekParam(value: string | null | undefined): string | null {
  if (!value || !ISO_DATE.test(value)) return null;
  const date = utcDay(value);
  const roundTrip = date.toISOString().slice(0, "YYYY-MM-DD".length);
  if (Number.isNaN(date.getTime()) || roundTrip !== value) return null;
  return mondayOf(value);
}

/** Pazartesiden cumaya beş gün. */
export function weekDates(monday: string): string[] {
  return Array.from({ length: WEEK_DAYS }, (_, index) => addEtDays(monday, index));
}

/* ---------------------------------------------------------------------------
   Seçim
   --------------------------------------------------------------------------- */

export type WeekLane = "bmo" | "amc" | "other";

export type WeekCandidate = {
  symbol: string;
  reportDate: string;
  hour: string | null;
  name: string | null;
  logoUrl: string | null;
  /** USD piyasa değeri; bilinmiyorsa null. */
  marketCap: number | null;
  /** S&P 500 / Nasdaq-100 / Dow üyesi mi. */
  indexMember: boolean;
  /** Adla seçilmiş takip listesi (`lib/spotlight.ts`). */
  spotlight: boolean;
};

export function laneOf(hour: string | null | undefined): WeekLane {
  if (hour === "bmo") return "bmo";
  if (hour === "amc") return "amc";
  return "other";
}

/**
 * Haftanın kayda değer şirketleri.
 *
 * Kapı: endeks üyeliği, `NOTABLE_MIN_CAP` ya da adla seçilmiş liste.
 * Sıra: önce adla seçilenler (takvimin görünür katmanındaki kuralın
 * aynısı: bu şirketler eşiğin altında ama çeyrekleri eşiğin üstündeki pek
 * çok şirketinkinden çok konuşuluyor), sonra piyasa değeri. Tavan
 * `WEEK_MAX_NAMES`.
 *
 * Aynı sembol haftada iki kez görünürse (sağlayıcı tarihi kaydırdı, eski
 * satır silinmedi) ilk tarih kalır — görselde aynı logo iki güne düşmesin.
 */
export function pickNotable(
  rows: WeekCandidate[],
  max: number = WEEK_MAX_NAMES,
): WeekCandidate[] {
  const seen = new Set<string>();
  const eligible = rows
    .filter(
      (row) =>
        row.spotlight ||
        row.indexMember ||
        (row.marketCap !== null && row.marketCap >= NOTABLE_MIN_CAP),
    )
    .sort((a, b) => a.reportDate.localeCompare(b.reportDate))
    .filter((row) => {
      if (seen.has(row.symbol)) return false;
      seen.add(row.symbol);
      return true;
    });
  return eligible
    .sort(
      (a, b) =>
        Number(b.spotlight) - Number(a.spotlight) ||
        (b.marketCap ?? 0) - (a.marketCap ?? 0) ||
        a.symbol.localeCompare(b.symbol),
    )
    .slice(0, max);
}

export type WeekDay = {
  date: string;
  /** Tam gün tatil — borsa kapalı. Yarım gün burada DEĞİL, kapanışı kayar. */
  closed: MarketHoliday | null;
  bmo: WeekCandidate[];
  amc: WeekCandidate[];
  other: WeekCandidate[];
  /** "~15:00" gibi — okuyucunun birincil saati ve öteki saat. */
  bmoClock: TimePair;
  amcClock: TimePair;
};

/**
 * Seçilen şirketleri beş güne ve üç şeride dağıtır; her şeritte piyasa
 * değeri büyükten küçüğe.
 *
 * Kapanış saati o GÜNÜN kapanışı: yarım günde (Şükran Günü ertesi) 13:00
 * ET, yani kapanış sonrası bilançolar TR'de 21:00 civarı — sabit "~23:00"
 * yazmak o gün iki saat yanlış olurdu.
 */
export function buildWeek(
  monday: string,
  picked: WeekCandidate[],
  holidays: MarketHoliday[],
  locale: Locale,
): WeekDay[] {
  return weekDates(monday).map((date) => {
    const holiday = holidays.find((item) => item.date === date) ?? null;
    const rows = picked
      .filter((row) => row.reportDate === date)
      .sort((a, b) => (b.marketCap ?? 0) - (a.marketCap ?? 0));
    return {
      date,
      closed: holiday && holiday.earlyCloseEt === null ? holiday : null,
      bmo: rows.filter((row) => laneOf(row.hour) === "bmo"),
      amc: rows.filter((row) => laneOf(row.hour) === "amc"),
      other: rows.filter((row) => laneOf(row.hour) === "other"),
      bmoClock: timePair(date, clockOf(BMO_TYPICAL_MINUTES), locale),
      amcClock: timePair(date, clockOf(closeMinutesFor(date, holidays)), locale),
    };
  });
}

/* ---------------------------------------------------------------------------
   Yazım
   --------------------------------------------------------------------------- */

function intl(locale: Locale, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat(locale === "tr" ? "tr-TR" : "en-US", {
    ...options,
    timeZone: "UTC",
  });
}

/**
 * Haftanın adı: "5–9 Ekim 2026" · "28 Eylül – 2 Ekim 2026"; İngilizcede
 * "Oct 5–9, 2026" · "Sep 28 – Oct 2, 2026". Ay değişmiyorsa bir kez yazılır.
 */
export function weekRangeLabel(monday: string, locale: Locale): string {
  const friday = addEtDays(monday, WEEK_DAYS - 1);
  const a = utcDay(monday);
  const b = utcDay(friday);
  const sameMonth = a.getUTCMonth() === b.getUTCMonth();
  const sameYear = a.getUTCFullYear() === b.getUTCFullYear();
  const year = b.getUTCFullYear();
  if (locale === "tr") {
    const dayMonth = intl(locale, { day: "numeric", month: "long" });
    if (sameMonth) {
      return `${a.getUTCDate()}–${dayMonth.format(b)} ${year}`;
    }
    const start = sameYear
      ? dayMonth.format(a)
      : intl(locale, { day: "numeric", month: "long", year: "numeric" }).format(a);
    return `${start} – ${dayMonth.format(b)} ${year}`;
  }
  const monthDay = intl(locale, { month: "short", day: "numeric" });
  if (sameMonth) {
    return `${monthDay.format(a)}–${b.getUTCDate()}, ${year}`;
  }
  const start = sameYear
    ? monthDay.format(a)
    : intl(locale, { month: "short", day: "numeric", year: "numeric" }).format(a);
  return `${start} – ${monthDay.format(b)}, ${year}`;
}

/** Gün başlığı: "Pazartesi" + "5 Eki" (İngilizce "Monday" + "Oct 5"). */
export function dayLabel(date: string, locale: Locale): { weekday: string; short: string; day: string } {
  const at = utcDay(date);
  return {
    weekday: intl(locale, { weekday: "long" }).format(at),
    short: intl(locale, { weekday: "short" }).format(at),
    day: intl(locale, { day: "numeric", month: "short" }).format(at),
  };
}

/**
 * Bir günün karo bütçesini şeritlere dağıtır — yatay görselin sütunu.
 *
 * Sütunun boyu sabit (630 piksellik kart) ve bilanço sezonunda bir gün
 * on iki kayda değer şirket taşıyabiliyor: tavan şerit başına sabit
 * olduğunda perşembe sütunu kartın altından taşıyordu (22 Ekim 2026
 * haftasında ölçüldü: dört açılış öncesi + "+3" + bir kapanış sonrası +
 * üç saati belirsiz, sütun 40 piksel dışarıda). Bütçe günün TAMAMINA
 * veriliyor: dolu her şerit en az bir karo alır, kalan karolar sırayla
 * (açılış öncesi, kapanış sonrası, belirsiz) ihtiyacı olana dağıtılır.
 * Kırpılan şerit "+N" yazar; sayfa hepsini gösteriyor.
 */
export function allocateSlots(counts: readonly number[], budget: number): number[] {
  const slots: number[] = counts.map((count) => (count > 0 ? 1 : 0));
  let left = budget - slots.reduce((sum, value) => sum + value, 0);
  while (left > 0) {
    let gave = false;
    for (let index = 0; index < counts.length && left > 0; index += 1) {
      if ((slots[index] ?? 0) < (counts[index] ?? 0)) {
        slots[index] = (slots[index] ?? 0) + 1;
        left -= 1;
        gave = true;
      }
    }
    if (!gave) break;
  }
  return slots;
}
