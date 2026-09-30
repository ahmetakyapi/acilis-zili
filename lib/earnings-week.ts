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

/**
 * Haftalık SEKMENİN varsayılan haftası: içinde bulunulan iş haftası;
 * cumartesi ve pazar ise gelecek hafta.
 *
 * `defaultWeekStart` her zaman gelecek haftayı veriyor ve paylaşım
 * görselinin işi için doğru ("gelecek hafta kim açıklıyor"). Ama sayfa
 * artık bilançolar ekranının bir SEKMESİ (29 Eylül) ve sekmeye salı günü
 * gelen okuyucu önce bu haftanın takvimini arıyor: yarın açıklayacak MU
 * gelecek haftanın panosunda hiç görünmüyordu. Hafta sonu ise iş haftası
 * bitmiş sayılıyor — pazar akşamı "bu hafta" diye biten haftayı göstermek
 * geçmişe bakmak olurdu. Görsel ucu eski varsayılanda kalıyor; sayfa ona
 * haftayı her zaman açıkça veriyor.
 */
export function currentWeekStart(todayEt: string): string {
  const weekday = utcDay(todayEt).getUTCDay();
  const SATURDAY = 6;
  const SUNDAY = 0;
  if (weekday === SATURDAY || weekday === SUNDAY) return defaultWeekStart(todayEt);
  return mondayOf(todayEt);
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
export function pickNotable<T extends WeekCandidate>(
  rows: T[],
  max: number = WEEK_MAX_NAMES,
): T[] {
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

export type WeekDay<T extends WeekCandidate = WeekCandidate> = {
  date: string;
  /** Tam gün tatil — borsa kapalı. Yarım gün burada DEĞİL, kapanışı kayar. */
  closed: MarketHoliday | null;
  bmo: T[];
  amc: T[];
  other: T[];
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
export function buildWeek<T extends WeekCandidate>(
  monday: string,
  picked: T[],
  holidays: MarketHoliday[],
  locale: Locale,
): WeekDay<T>[] {
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

/* ---------------------------------------------------------------------------
   En Çok Beklenenler — karo boyu
   --------------------------------------------------------------------------- */

/**
 * Karo basamakları — piyasa değeri, dolar.
 *
 * "En çok beklenen" iddiası burada ÖLÇÜTÜ AÇIK bir iddia: şirketin
 * büyüklüğü. Earnings Whispers aynı ızgarayı kendi okuyucu ilgisinden
 * kuruyor ve ölçütünü söylemiyor; bizim elimizde dürüstçe ölçülebilen
 * bir ilgi puanı yok. Takip listesi sayımı düşünüldü ve ölçüldü (29
 * Eylül: 5 kullanıcı, 18 favori satırı, en çok takip edilen sembolde 2
 * kişi) — sıralama değil gürültü olurdu. Karo boyu bu yüzden piyasa
 * değerinden, eşikler künyede adıyla yazılı.
 *
 * Üç basamak, sürekli ölçek değil: 10 milyar ile 4 trilyon arası dört yüz
 * kat ve doğrusal bir alan ölçeğinde küçükler görünmez olurdu. Sürekli
 * büyüklüğü karonun altındaki çizgi taşıyor (haftanın en büyüğüne göre
 * uzunluk — CLAUDE.md "karşılaştırılan her büyüklük bir de çizgi").
 */
export const TILE_XL_CAP = 500e9;
export const TILE_LG_CAP = 100e9;

export type TileTier = "xl" | "lg" | "md";

export function tileTier(marketCap: number | null): TileTier {
  if (marketCap !== null && marketCap >= TILE_XL_CAP) return "xl";
  if (marketCap !== null && marketCap >= TILE_LG_CAP) return "lg";
  return "md";
}

/* ---------------------------------------------------------------------------
   Sürpriz — gerçekleşen EPS beklentiye göre
   --------------------------------------------------------------------------- */

/**
 * Yarım sent: EPS iki ondalıkla açıklanıyor, sağlayıcının beklentisi dört
 * ondalıkla geliyor (0,4444). 0,44 açıklayan şirkete "beklentinin altında"
 * demek, yuvarlamanın ürettiği bir kaybı olay gibi göstermek olurdu.
 */
export const EPS_INLINE_TOLERANCE = 0.005;

/** Yüzde sapma için beklentinin en küçük mutlak değeri: bir sent. */
export const EPS_RATIO_MIN_BASE = 0.01;

export type Surprise = {
  direction: "beat" | "miss" | "inline";
  /** Beklentiden sapma, oran (0.12 = %12). Beklenti bir sentin altındaysa null. */
  ratio: number | null;
};

export function epsSurprise(
  actual: number | null | undefined,
  estimate: number | null | undefined,
): Surprise | null {
  if (actual === null || actual === undefined || estimate === null || estimate === undefined) {
    return null;
  }
  const diff = actual - estimate;
  const direction =
    Math.abs(diff) < EPS_INLINE_TOLERANCE ? "inline" : diff > 0 ? "beat" : "miss";
  /* Oran NEGATİF beklentide mutlak değere bölünüyor: -0,72 beklenen ve
     -0,50 açıklayan şirket beklentiyi AŞTI; düz bölmede sapma eksi çıkardı.
     Beklenti bir sentin altındaysa (ekranda "0,00 $") oran YOK: 21 Eylül
     haftasında ANAB 0,0031 beklentiyle 5,11 açıkladı ve sütunda
     "+%164.738,7" yazıyordu — sıfıra yakın bir paydanın ürettiği, hiçbir
     şey söylemeyen bir sayı. Yön kalıyor, yüzde düşüyor. */
  const ratio =
    Math.abs(estimate) < EPS_RATIO_MIN_BASE || direction === "inline"
      ? null
      : diff / Math.abs(estimate);
  return { direction, ratio };
}

/**
 * Gelirde "beklentiye eşit" bandı: oran olarak binde yarım. Sürpriz ekranda
 * bir ondalıkla yazılıyor (`%0,0`); bu bandın içindeki sapma o yazımda
 * sıfıra yuvarlanıyor ve "+%0,0" diye yeşil basılması, yuvarlamanın
 * ürettiği bir farkı olay gibi göstermek olurdu. EPS'nin yarım sent
 * toleransının gelirdeki karşılığı bu.
 */
export const REVENUE_INLINE_RATIO = 0.0005;

/**
 * Gelir sürprizi — `epsSurprise`in gelir karşılığı.
 *
 * Ayrı bir fonksiyon, çünkü iki büyüklüğün "eşit" tanımı farklı: EPS sentle
 * açıklanıyor (mutlak tolerans), gelir milyarlarla (oransal tolerans). Gelir
 * beklentisi sıfır ya da negatifse oran anlamsız; o zaman sürpriz yok.
 */
export function revenueSurprise(
  actual: number | null | undefined,
  estimate: number | null | undefined,
): Surprise | null {
  if (actual === null || actual === undefined || estimate === null || estimate === undefined) {
    return null;
  }
  if (!(estimate > 0) || !Number.isFinite(actual)) return null;
  const ratio = (actual - estimate) / estimate;
  if (Math.abs(ratio) < REVENUE_INLINE_RATIO) return { direction: "inline", ratio: null };
  return { direction: ratio > 0 ? "beat" : "miss", ratio };
}

/* ---------------------------------------------------------------------------
   Haftanın takvimi — gün gün tam liste
   --------------------------------------------------------------------------- */

/** Takvim satırı — seçim adayı artı beklenti ve gerçekleşenler. */
export type ScheduleRow = WeekCandidate & {
  epsEstimate: number | null;
  epsActual: number | null;
  revenueEstimate: number | null;
  revenueActual: number | null;
  /** Tahminlerin para birimi (ana borsanın): USD dışı olabilir. */
  currency: string | null;
};

/**
 * Listede adıyla görünmek için piyasa değeri tabanı.
 *
 * Bilanço sezonunun yoğun bir gününde takvimde üç yüzü aşkın şirket var ve
 * çoğu kapalı uçlu fon ya da mikro ölçekli; beklentisi bile yok (28 Eylül
 * haftası: 96 satırın 31'inde EPS beklentisi). 1 milyar doların altı
 * günün açılır listesine iniyor — kaybolmuyor, sembolüyle orada.
 */
export const SCHEDULE_MIN_CAP = 1e9;

/**
 * Bir günde adıyla listelenen en fazla şirket. On iki satır ~620 piksel;
 * 22 Ekim gibi bir günde tabanın üstünde 60'ı aşkın şirket var ve hepsini
 * açmak haftayı on ekranlık bir listeye çevirirdi.
 */
export const SCHEDULE_DAY_MAX = 12;

export type ScheduleDay<T extends ScheduleRow = ScheduleRow> = {
  date: string;
  closed: MarketHoliday | null;
  /** Adıyla listelenenler — önce adla seçilenler, sonra piyasa değeri. */
  listed: T[];
  /** Kalanlar, pencereye göre — günün açılır listesi. */
  rest: { bmo: T[]; amc: T[]; other: T[] };
  total: number;
  bmoClock: TimePair;
  amcClock: TimePair;
};

/**
 * Günün tam listesini ikiye böler. Sıra `pickNotable`ın sırası: adla
 * seçilenler (takvim sekmesinin kuralı, gerekçesi orada), sonra piyasa
 * değeri. Aynı sembol aynı gün iki kez gelmez (`guncelBilanco` zaten
 * eliyor; burada ikinci savunma).
 */
export function splitScheduleDay<T extends ScheduleRow>(
  rows: T[],
  max: number = SCHEDULE_DAY_MAX,
): { listed: T[]; rest: T[] } {
  const seen = new Set<string>();
  const unique = rows.filter((row) => {
    if (seen.has(row.symbol)) return false;
    seen.add(row.symbol);
    return true;
  });
  const ordered = [...unique].sort(
    (a, b) =>
      Number(b.spotlight) - Number(a.spotlight) ||
      (b.marketCap ?? 0) - (a.marketCap ?? 0) ||
      a.symbol.localeCompare(b.symbol),
  );
  const eligible = ordered.filter(
    (row) => row.spotlight || (row.marketCap !== null && row.marketCap >= SCHEDULE_MIN_CAP),
  );
  const listed = eligible.slice(0, max);
  const listedSet = new Set(listed.map((row) => row.symbol));
  return { listed, rest: ordered.filter((row) => !listedSet.has(row.symbol)) };
}

export function buildSchedule<T extends ScheduleRow>(
  monday: string,
  rows: T[],
  holidays: MarketHoliday[],
  locale: Locale,
  max: number = SCHEDULE_DAY_MAX,
): ScheduleDay<T>[] {
  return weekDates(monday).map((date) => {
    const holiday = holidays.find((item) => item.date === date) ?? null;
    const { listed, rest } = splitScheduleDay(
      rows.filter((row) => row.reportDate === date),
      max,
    );
    return {
      date,
      closed: holiday && holiday.earlyCloseEt === null ? holiday : null,
      listed,
      rest: {
        bmo: rest.filter((row) => laneOf(row.hour) === "bmo"),
        amc: rest.filter((row) => laneOf(row.hour) === "amc"),
        other: rest.filter((row) => laneOf(row.hour) === "other"),
      },
      total: listed.length + rest.length,
      bmoClock: timePair(date, clockOf(BMO_TYPICAL_MINUTES), locale),
      amcClock: timePair(date, clockOf(closeMinutesFor(date, holidays)), locale),
    };
  });
}
