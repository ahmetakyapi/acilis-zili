import {
  AFTER_HOURS_MINUTES,
  ET_ZONE,
  SESSION_BOUNDS,
  closeMinutesFor,
  daysBetweenEt,
  etDateTimeToUtc,
  isTradingDay,
  nextTradingDay,
  type MarketHoliday,
} from "./market-hours";
import {
  TR_ZONE,
  clockOf,
  displayZone,
  formatInZone,
  zoneDateKey,
  zoneOffsetSeconds,
} from "./session-clock";
import type { Locale } from "./i18n/config";

/**
 * "Kaçta açılıyor", "bugün açık mı", "hangi günler tatil" sorularının SAF
 * hesapları (14 Kasım 2026, SEO denetimi).
 *
 * `/abd-borsasi-saatleri` ve `/abd-borsasi-tatil-gunleri` sayfalarının ilk
 * cümlesi bir soruya güncel değerle cevap veriyor; o cümlenin hangi dala
 * düştüğü, sıradaki tatil, yarım günün Türkiye saatiyle kapanışı ve yaz saati
 * geçiş tarihleri burada hesaplanır ve test edilir (`tests/market-answers.test.ts`).
 * Sayfa yalnız dizer.
 *
 * SABİT SAAT YOK (`.claude/rules/veri-ve-onbellek.md` → "Saat: TR Önce").
 * Bu dosyada tek bir "16:30" ya da "17:30" yazmıyor: her saat o günün
 * tarihiyle `etDateTimeToUtc` (ET↔UTC, yalnız `lib/market-hours.ts`) ve
 * `formatInZone` (`lib/session-clock.ts`) üzerinden çıkar. Yaz saati geçiş
 * GÜNLERİ de elle yazılmıyor: dilimin kayması günden güne `zoneOffsetSeconds`
 * ile okunup değiştiği gün bulunuyor — ABD kuralı değişirse (kalıcı yaz saati
 * tartışması) tablo ICU verisiyle birlikte kendiliğinden düzelir.
 */

/** Aynı anın iki saati: Türkiye ve New York. Hangisinin önce yazılacağını
 *  sayfa dile göre seçer (`zoneTag`). */
export type ClockPair = { tr: string; ny: string };

/** ET gün içi dakikasını o günün tarihiyle iki saate açar. */
export function clockPair(dateEt: string, minutesEt: number): ClockPair {
  const ny = clockOf(minutesEt);
  return { tr: formatInZone(etDateTimeToUtc(dateEt, ny), TR_ZONE), ny };
}

/** O günün asıl seansı: açılış ve (yarım günde erken) kapanış. */
export function regularHours(
  dateEt: string,
  holidays: MarketHoliday[],
): { open: ClockPair; close: ClockPair; halfDay: boolean } {
  const closeMinutes = closeMinutesFor(dateEt, holidays);
  return {
    open: clockPair(dateEt, SESSION_BOUNDS.regularOpen),
    close: clockPair(dateEt, closeMinutes),
    halfDay: closeMinutes !== SESSION_BOUNDS.regularClose,
  };
}

/* --------------------------------------------------------------------------
   Tatiller
   -------------------------------------------------------------------------- */

/** Tohumdaki adlar yarım günü parantezle taşıyor ("Noel arifesi (yarım
 *  gün)"); tabloda durum ayrı sütunda yazıldığı için ek iki kez okunurdu. */
const HALF_DAY_SUFFIX = /\s*\((?:yarım gün|early close)\)\s*$/i;
/** Hafta sonuna denk geldiği için kaydırılmış tatilin veri izi. */
const OBSERVED_MARK = /\((?:gözlem|observed)\)/i;

export function holidayName(holiday: MarketHoliday, locale: Locale): string {
  return (locale === "tr" ? holiday.nameTr : holiday.nameEn).replace(HALF_DAY_SUFFIX, "");
}

/** Tatil hafta sonuna denk geldiği için başka güne mi alınmış — yalnız veri
 *  bunu söylüyorsa doğru (ad "(gözlem)" / "(observed)" taşıyorsa). */
export function isObservedHoliday(holiday: MarketHoliday): boolean {
  return OBSERVED_MARK.test(holiday.nameTr) || OBSERVED_MARK.test(holiday.nameEn);
}

export type HolidayRow = {
  holiday: MarketHoliday;
  /** "closed" tam gün kapalı, "early" yarım gün. */
  kind: "closed" | "early";
  /** Yarım günde kapanış zili, iki saatle; tam tatilde `null`. */
  close: ClockPair | null;
  /** Gün geride kaldı (ET takvimiyle) — tabloda soluk basılır. */
  past: boolean;
};

/** Tatil satırları, tarihe göre sıralı. Yarım günün Türkiye saati o günün
 *  tarihiyle hesaplanır (kasım sonu kış, temmuz başı yaz farkı). */
export function holidayRows(holidays: MarketHoliday[], today: string): HolidayRow[] {
  return [...holidays]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((holiday) => {
      const early = holiday.earlyCloseEt;
      return {
        holiday,
        kind: early ? ("early" as const) : ("closed" as const),
        close: early
          ? { tr: formatInZone(etDateTimeToUtc(holiday.date, early), TR_ZONE), ny: early }
          : null,
        past: holiday.date < today,
      };
    });
}

/** Satırları takvim yılına böler; yıllar VERİDEN gelir. */
export function holidayYearGroups(rows: HolidayRow[]): { year: number; rows: HolidayRow[] }[] {
  const groups = new Map<number, HolidayRow[]>();
  for (const row of rows) {
    const year = Number(row.holiday.date.slice(0, 4));
    const list = groups.get(year);
    if (list) list.push(row);
    else groups.set(year, [row]);
  }
  return [...groups.entries()].sort((a, b) => a[0] - b[0]).map(([year, list]) => ({ year, rows: list }));
}

/**
 * Sayfanın ve başlığın anlattığı yıllar: veride bulunan, bu yıl ve sonrası.
 *
 * Başlık "2026 ve 2027" diyorsa tabloda da o iki yıl vardır; tohum 2028'i
 * taşımaya başladığında ya da 2026 geride kaldığında başlık kendiliğinden
 * kayar. Veri okunamadıysa (boş liste) yıl uydurulmaz: liste boş döner ve
 * başlık yılsız kurulur.
 */
export function coveredYears(holidays: MarketHoliday[], today: string, limit = 2): number[] {
  const thisYear = Number(today.slice(0, 4));
  const years = new Set<number>();
  for (const holiday of holidays) {
    const year = Number(holiday.date.slice(0, 4));
    if (year >= thisYear) years.add(year);
  }
  return [...years].sort((a, b) => a - b).slice(0, limit);
}

/** Sıradaki TAM tatil (bugün dahil). */
export function nextClosure(holidays: MarketHoliday[], today: string): MarketHoliday | null {
  return (
    [...holidays]
      .sort((a, b) => a.date.localeCompare(b.date))
      .find((h) => h.date >= today && h.earlyCloseEt === null) ?? null
  );
}

/** Sıradaki yarım gün (bugün dahil). */
export function nextEarlyClose(holidays: MarketHoliday[], today: string): MarketHoliday | null {
  return (
    [...holidays]
      .sort((a, b) => a.date.localeCompare(b.date))
      .find((h) => h.date >= today && h.earlyCloseEt !== null) ?? null
  );
}

/* --------------------------------------------------------------------------
   Yaz saati geçişleri
   -------------------------------------------------------------------------- */

export type ClockShift = {
  /** Saatin değiştiği yerel takvim günü, "YYYY-MM-DD". */
  date: string;
  /** "start" saatler ileri (yaz saati başlar), "end" geri. */
  kind: "start" | "end";
};

const DAY_MS = 86_400_000;

/**
 * Bir dilimin o yıl içindeki saat değişiklikleri.
 *
 * Kayma her günün 12:00 UTC anında okunur (New York'ta sabah, İstanbul'da
 * öğleden sonra: ikisinde de aynı takvim günü ve 02:00'deki değişikliğin
 * ardı). Bir önceki günden farklıysa değişiklik o gün olmuştur. Yaz saati
 * uygulamayan dilimde (Türkiye, 2016'dan beri) liste boş döner — sayfa
 * "Türkiye uygulamıyor" cümlesini bu boşluktan kurar, ezberden değil.
 */
export function clockShifts(year: number, zone: string): ClockShift[] {
  const shifts: ClockShift[] = [];
  const offsetAt = (ms: number) => zoneOffsetSeconds(Math.floor(ms / 1000), zone);
  let cursor = Date.UTC(year, 0, 1, 12);
  let previous = offsetAt(cursor - DAY_MS);
  while (new Date(cursor).getUTCFullYear() === year) {
    const current = offsetAt(cursor);
    if (current !== previous) {
      shifts.push({
        date: new Date(cursor).toISOString().slice(0, 10),
        kind: current > previous ? "start" : "end",
      });
    }
    previous = current;
    cursor += DAY_MS;
  }
  return shifts;
}

/** O gün Türkiye'nin New York'tan kaç saat ileride olduğu (yazın 7, kışın 8). */
export function trLeadHours(dateEt: string): number {
  const noon = Math.floor(etDateTimeToUtc(dateEt, "12:00").getTime() / 1000);
  return (zoneOffsetSeconds(noon, TR_ZONE) - zoneOffsetSeconds(noon, ET_ZONE)) / 3600;
}

export type ShiftRow = ClockShift & {
  /** Geçişten SONRA geçerli olağan seans saatleri. */
  open: ClockPair;
  close: ClockPair;
  leadHours: number;
  past: boolean;
};

/** Verilen yılların ABD saat değişiklikleri ve her birinden sonra açılış ile
 *  kapanışın Türkiye saatinde nereye düştüğü. */
export function shiftRows(years: number[], today: string): ShiftRow[] {
  return years
    .flatMap((year) => clockShifts(year, ET_ZONE))
    .map((shift) => ({
      ...shift,
      /* Geçiş günü pazar; saatler o günün tarihiyle hesaplanınca 02:00'deki
         değişikliğin SONRASINI verir (09:30 ET geçişten sonra). */
      open: clockPair(shift.date, SESSION_BOUNDS.regularOpen),
      close: clockPair(shift.date, SESSION_BOUNDS.regularClose),
      leadHours: trLeadHours(shift.date),
      past: shift.date < today,
    }));
}

/**
 * Yaz ve kış dönemlerinin olağan seans saatleri — künye açıklaması bunlardan
 * kurulur ("yazın …, kışın …"). Yıl içinde iki geçiş de bulunamazsa `null`:
 * çağıran tek dönemlik cümleye düşer, saat uydurmaz.
 */
export function seasonHours(
  year: number,
): { summer: { open: ClockPair; close: ClockPair }; winter: { open: ClockPair; close: ClockPair } } | null {
  const shifts = clockShifts(year, ET_ZONE);
  const start = shifts.find((s) => s.kind === "start");
  const end = shifts.find((s) => s.kind === "end");
  if (!start || !end) return null;
  const hours = (date: string) => ({
    open: clockPair(date, SESSION_BOUNDS.regularOpen),
    close: clockPair(date, SESSION_BOUNDS.regularClose),
  });
  return { summer: hours(start.date), winter: hours(end.date) };
}

/* --------------------------------------------------------------------------
   Günün cevabı — "ABD borsası bugün açık mı, kaçta açılıyor"
   -------------------------------------------------------------------------- */

/**
 * İlk cümlenin dalı:
 *
 *   `weekend`     bugün hafta sonu
 *   `holiday`     bugün tam tatil
 *   `beforeOpen`  işlem günü, ön seans da başlamadı
 *   `preMarket`   ön seans sürüyor, açılış zili çalmadı
 *   `open`        asıl seans açık
 *   `afterHours`  kapanış zili çaldı, akşam seansı sürüyor
 *   `closed`      akşam seansı da bitti
 */
export type DayAnswerKind =
  | "weekend"
  | "holiday"
  | "beforeOpen"
  | "preMarket"
  | "open"
  | "afterHours"
  | "closed";

export type DayAnswer = {
  kind: DayAnswerKind;
  /** Cümlenin "bugün" dediği gün — OKUYUCUNUN takvim günü. */
  dayDate: string;
  /** Bugün işlem varsa asıl seans saatleri. */
  today: { open: ClockPair; close: ClockPair } | null;
  /** Bugün yarım gün mü (işlem var, erken kapanış). */
  halfDay: boolean;
  /** Bugüne ait tatil kaydı: tam tatilde kapalılığın, yarım günde erken
   *  kapanışın nedeni. */
  holiday: MarketHoliday | null;
  /** Sıradaki açılış zili: bugün henüz çalmadıysa bugün, yoksa sıradaki
   *  işlem günü. */
  next: {
    date: string;
    /** `dayDate`e uzaklık: 0 bugün, 1 yarın. */
    dayOffset: number;
    open: ClockPair;
    close: ClockPair;
    halfDay: boolean;
  };
};

/**
 * Günün durumu, OKUYUCUNUN GÜNÜNDEN sorulur.
 *
 * `getMarketStatus` New York takvim gününü anlatır; Türkiye'de 00:00 ile
 * 07:00/08:00 arası New York hâlâ dündedir. O saatlerde "bugün" demek için
 * ET günü kullanılsaydı salı 01:00'de okura pazartesi seansı "bugün" diye
 * anlatılırdı. Sayfanın sorusu "BUGÜN kaçta açılıyor" olduğu için gün,
 * okuyucunun dilimindeki takvim günüdür (`displayZone`); seans o tarihin ET
 * seansıdır (TR'de açılış her zaman aynı takvim gününe düşer) ve durum
 * gerçek anların karşılaştırmasından çıkar. Kışın kapanış TR'de tam gece
 * yarısına düştüğü için "bugün kapandı" dalları TR'de yalnız yazın (23:00–
 * 00:00) görülür; kışın gece yarısından sonra cümle yeni günü anlatır.
 */
export function dayAnswer(now: Date, holidays: MarketHoliday[], locale: Locale): DayAnswer {
  const dayDate = zoneDateKey(now, displayZone(locale));
  const holiday = holidays.find((h) => h.date === dayDate) ?? null;
  const trading = isTradingDay(dayDate, holidays);
  const at = (minutes: number) => etDateTimeToUtc(dayDate, clockOf(minutes)).getTime();
  const nowMs = now.getTime();

  const nextFor = (date: string) => {
    const hours = regularHours(date, holidays);
    return { date, dayOffset: daysBetweenEt(dayDate, date), ...hours };
  };

  if (!trading) {
    const weekday = new Date(`${dayDate}T12:00:00Z`).getUTCDay();
    return {
      /* Hafta sonuna denk gelen tatil kaydı olsa da neden hafta sonudur. */
      kind: weekday === 0 || weekday === 6 || !holiday ? "weekend" : "holiday",
      dayDate,
      today: null,
      halfDay: false,
      holiday,
      next: nextFor(nextTradingDay(dayDate, holidays)),
    };
  }

  const hours = regularHours(dayDate, holidays);
  const closeMinutes = closeMinutesFor(dayDate, holidays);
  const kind: DayAnswerKind =
    nowMs < at(SESSION_BOUNDS.preMarketOpen)
      ? "beforeOpen"
      : nowMs < at(SESSION_BOUNDS.regularOpen)
        ? "preMarket"
        : nowMs < at(closeMinutes)
          ? "open"
          : nowMs < at(closeMinutes + AFTER_HOURS_MINUTES)
            ? "afterHours"
            : "closed";
  const bellAhead = kind === "beforeOpen" || kind === "preMarket";

  return {
    kind,
    dayDate,
    today: { open: hours.open, close: hours.close },
    halfDay: hours.halfDay,
    holiday,
    next: bellAhead ? nextFor(dayDate) : nextFor(nextTradingDay(dayDate, holidays)),
  };
}

/* --------------------------------------------------------------------------
   Metin yardımcıları
   -------------------------------------------------------------------------- */

/** Sözlük kalıbındaki `{ad}` yer tutucularını doldurur; bilinmeyen yer
 *  tutucu olduğu gibi kalır (eksik değişken ekranda görünür, sessizce
 *  kaybolmaz). */
export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) =>
    key in values ? String(values[key]) : whole,
  );
}

/**
 * Düz gün damgasını ("YYYY-MM-DD") dile göre yazar: "26 Kasım 2026
 * Perşembe" / "Thursday, November 26, 2026". Damga saat taşımadığı için UTC
 * gece yarısından kurulur; yerel dilimle kurmak günü kaydırabilirdi.
 */
export function longDate(
  date: string,
  locale: Locale,
  options: { year?: boolean; weekday?: boolean } = {},
): string {
  return new Intl.DateTimeFormat(locale === "tr" ? "tr-TR" : "en-US", {
    timeZone: "UTC",
    day: "numeric",
    month: "long",
    ...(options.year === false ? {} : { year: "numeric" }),
    ...(options.weekday ? { weekday: "long" } : {}),
  }).format(new Date(`${date}T00:00:00Z`));
}

/** Günün adı: "Perşembe" / "Thursday". */
export function weekdayName(date: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === "tr" ? "tr-TR" : "en-US", {
    timeZone: "UTC",
    weekday: "long",
  }).format(new Date(`${date}T00:00:00Z`));
}

/* --------------------------------------------------------------------------
   Türkçe ek
   -------------------------------------------------------------------------- */

/**
 * Yıl sayısının bulunma eki: "2026'da", "2027'de", "2033'te".
 *
 * Künye açıklaması "{yıl} ve {yıl+1}'de" kalıbını istiyor ve ek sayının
 * OKUNUŞUNA bağlı: 2027 "yedi" → "de", 2029 "dokuz" → "da", 2033 "üç" →
 * "te". Sabit "'de" yazılsaydı 2028 başlığı ("2028 ve 2029'de") bozuk
 * çıkardı. Kural son okunan sözcükten: birler basamağı sıfırsa onlar,
 * o da sıfırsa yüzler ("yüz" → "de"), o da sıfırsa binler ("bin" → "de").
 */
export function trLocative(value: number): "de" | "da" | "te" | "ta" {
  const n = Math.abs(Math.trunc(value));
  const ones = ["", "de", "de", "te", "te", "te", "da", "de", "de", "da"] as const;
  const tens = ["", "da", "de", "da", "ta", "de", "ta", "te", "de", "da"] as const;
  if (n % 10 !== 0) return ones[n % 10] as "de" | "da" | "te";
  if (n % 100 !== 0) return tens[(n % 100) / 10] as "de" | "da" | "te" | "ta";
  /* "sıfır", "yüz", "bin": üçü de ince ünlü ve yumuşak ünsüzle biter. */
  return "de";
}
