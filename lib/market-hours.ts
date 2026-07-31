/**
 * NYSE / Nasdaq seans saatleri.
 *
 * Kaynakların tamamı (BLS, Fed, Finnhub) ABD borsa saatini New York saatiyle
 * yayınlar. Bu dosya ET ile UTC arasındaki tüm dönüşümleri tek yerde toplar —
 * yaz saati geçişleri de dahil. Başka hiçbir yerde manuel saat aritmetiği
 * yapılmaz.
 */

export const ET_ZONE = "America/New_York";

/** Seans sınırları, ET dakika cinsinden (00:00'dan itibaren). */
export const SESSION_BOUNDS = {
  preMarketOpen: 4 * 60, // 04:00
  regularOpen: 9 * 60 + 30, // 09:30 — açılış zili
  regularClose: 16 * 60, // 16:00 — kapanış zili
  afterHoursClose: 20 * 60, // 20:00
} as const;

export type MarketSession =
  | "pre-market"
  | "regular"
  | "after-hours"
  | "closed";

export type MarketHoliday = {
  /** "YYYY-MM-DD" ET */
  date: string;
  nameTr: string;
  nameEn: string;
  /** "HH:mm" ET — yarım gün ise erken kapanış, tam tatilse null. */
  earlyCloseEt: string | null;
};

export type MarketStatus = {
  session: MarketSession;
  /** Ana seans açık mı — pre/after bunun dışındadır. */
  isRegularOpen: boolean;
  /** ET tarihi "YYYY-MM-DD" */
  etDate: string;
  /** ET saati "HH:mm" */
  etTime: string;
  /** Gün içi ET dakikası */
  etMinutes: number;
  isWeekend: boolean;
  holiday: MarketHoliday | null;
  /** Bugünün kapanış dakikası (yarım günlerde erken). */
  closeMinutes: number;
  /** Bir sonraki açılış zili — piyasa açıkken de dolu. */
  nextOpen: Date;
  /** Bugünün kapanış zili anı; piyasa kapalıysa bir sonraki seansın kapanışı. */
  nextClose: Date;
};

/* --------------------------------------------------------------------------
   ET ↔ UTC dönüşümü
   -------------------------------------------------------------------------- */

const ET_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: ET_ZONE,
  hour12: false,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  weekday: "short",
});

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

export type EtParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  weekday: number;
  /** "YYYY-MM-DD" */
  dateStr: string;
  /** Gün içi dakika */
  minutes: number;
};

/** Bir UTC anının New York'taki karşılığını parçalar. */
export function etParts(date: Date): EtParts {
  const parts = ET_FORMATTER.formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";

  const year = Number(get("year"));
  const month = Number(get("month"));
  const day = Number(get("day"));
  // Intl gece yarısını bazı ortamlarda "24" olarak verir.
  const hour = Number(get("hour")) % 24;
  const minute = Number(get("minute"));
  const second = Number(get("second"));

  return {
    year,
    month,
    day,
    hour,
    minute,
    second,
    weekday: WEEKDAY_INDEX[get("weekday")] ?? 0,
    dateStr: `${year}-${pad(month)}-${pad(day)}`,
    minutes: hour * 60 + minute,
  };
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/** Verilen anda ET'nin UTC'ye göre kayması (ms). EDT: -4s, EST: -5s. */
function etOffsetMs(date: Date): number {
  const p = etParts(date);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - date.getTime();
}

/**
 * New York yerel saatini UTC anına çevirir.
 * Yaz saati sınırlarında ikinci bir düzeltme turu yapılır.
 */
export function etToUtc(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
): Date {
  const target = Date.UTC(year, month - 1, day, hour, minute);
  const firstGuess = new Date(target - etOffsetMs(new Date(target)));
  const correctedOffset = etOffsetMs(firstGuess);
  return new Date(target - correctedOffset);
}

/** "2026-07-31" + "08:30" → UTC Date */
export function etDateTimeToUtc(dateStr: string, timeEt: string | null): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  if (!timeEt) return etToUtc(year, month, day, 0, 0);
  const [hour, minute] = timeEt.split(":").map(Number);
  return etToUtc(year, month, day, hour, minute);
}

/** ET gün başlangıcından itibaren dakika sayısını UTC anına çevirir. */
function etDateWithMinutes(dateStr: string, minutes: number): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  return etToUtc(year, month, day, Math.floor(minutes / 60), minutes % 60);
}

/** ET tarihine gün ekler, "YYYY-MM-DD" döner. */
export function addEtDays(dateStr: string, days: number): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const d = new Date(Date.UTC(year, month - 1, day));
  d.setUTCDate(d.getUTCDate() + days);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** ET takvimindeki bugünün tarihi. */
export function todayEt(now: Date = new Date()): string {
  return etParts(now).dateStr;
}

/* --------------------------------------------------------------------------
   Seans durumu
   -------------------------------------------------------------------------- */

function weekdayOf(dateStr: string): number {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

function holidayOn(
  dateStr: string,
  holidays: MarketHoliday[],
): MarketHoliday | null {
  return holidays.find((h) => h.date === dateStr) ?? null;
}

/** O gün işlem var mı — hafta sonu ve tam tatiller hariç. */
function isTradingDay(dateStr: string, holidays: MarketHoliday[]): boolean {
  const weekday = weekdayOf(dateStr);
  if (weekday === 0 || weekday === 6) return false;
  const holiday = holidayOn(dateStr, holidays);
  // Yarım günlerde işlem vardır, tam tatillerde yoktur.
  return !holiday || holiday.earlyCloseEt !== null;
}

function closeMinutesFor(dateStr: string, holidays: MarketHoliday[]): number {
  const holiday = holidayOn(dateStr, holidays);
  if (holiday?.earlyCloseEt) {
    const [hour, minute] = holiday.earlyCloseEt.split(":").map(Number);
    return hour * 60 + minute;
  }
  return SESSION_BOUNDS.regularClose;
}

/** Verilen tarihten sonraki ilk işlem gününü bulur (o gün dahil değil). */
function nextTradingDay(dateStr: string, holidays: MarketHoliday[]): string {
  let cursor = addEtDays(dateStr, 1);
  for (let i = 0; i < 14; i++) {
    if (isTradingDay(cursor, holidays)) return cursor;
    cursor = addEtDays(cursor, 1);
  }
  return cursor;
}

export function getMarketStatus(
  now: Date = new Date(),
  holidays: MarketHoliday[] = [],
): MarketStatus {
  const p = etParts(now);
  const dateStr = p.dateStr;
  const minutes = p.minutes;

  const isWeekend = p.weekday === 0 || p.weekday === 6;
  const holiday = holidayOn(dateStr, holidays);
  const tradingToday = isTradingDay(dateStr, holidays);
  const closeMinutes = closeMinutesFor(dateStr, holidays);
  // Yarım günlerde uzatılmış seans da erken biter.
  const afterHoursEnd = holiday?.earlyCloseEt
    ? closeMinutes + 60
    : SESSION_BOUNDS.afterHoursClose;

  let session: MarketSession = "closed";
  if (tradingToday) {
    if (minutes >= SESSION_BOUNDS.preMarketOpen && minutes < SESSION_BOUNDS.regularOpen) {
      session = "pre-market";
    } else if (minutes >= SESSION_BOUNDS.regularOpen && minutes < closeMinutes) {
      session = "regular";
    } else if (minutes >= closeMinutes && minutes < afterHoursEnd) {
      session = "after-hours";
    }
  }

  // Sonraki açılış zili
  let nextOpen: Date;
  if (tradingToday && minutes < SESSION_BOUNDS.regularOpen) {
    nextOpen = etDateWithMinutes(dateStr, SESSION_BOUNDS.regularOpen);
  } else {
    const next = nextTradingDay(dateStr, holidays);
    nextOpen = etDateWithMinutes(next, SESSION_BOUNDS.regularOpen);
  }

  // Sonraki kapanış zili
  let nextClose: Date;
  if (tradingToday && minutes < closeMinutes) {
    nextClose = etDateWithMinutes(dateStr, closeMinutes);
  } else {
    const next = nextTradingDay(dateStr, holidays);
    nextClose = etDateWithMinutes(next, closeMinutesFor(next, holidays));
  }

  return {
    session,
    isRegularOpen: session === "regular",
    etDate: dateStr,
    etTime: `${pad(p.hour)}:${pad(p.minute)}`,
    etMinutes: minutes,
    isWeekend,
    holiday,
    closeMinutes,
    nextOpen,
    nextClose,
  };
}

/* --------------------------------------------------------------------------
   Önbellek tazeliği — seans durumuna göre değişir.
   Piyasa kapalıyken fiyat sorgulamak sağlayıcı kotasını boşa harcar.
   -------------------------------------------------------------------------- */

export function quoteTtlSeconds(status: MarketStatus): number {
  switch (status.session) {
    case "regular":
      return 60;
    case "pre-market":
    case "after-hours":
      return 180;
    default:
      return 900;
  }
}

export function candleTtlSeconds(
  timeframe: string,
  status: MarketStatus,
): number {
  if (timeframe === "1D" || timeframe === "1W") {
    return status.session === "regular" ? 300 : 3600;
  }
  return 43200; // 12 saat — günlük barlar gün içinde değişmez
}

/** Formatlanmış geri sayım: 1s 28dk / 1h 28m */
export function formatCountdown(
  target: Date,
  now: Date,
  locale: string,
): string {
  const totalMinutes = Math.max(0, Math.round((target.getTime() - now.getTime()) / 60000));
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;

  const unit =
    locale === "tr"
      ? { d: "g", h: "s", m: "dk" }
      : { d: "d", h: "h", m: "m" };

  if (days > 0) return `${days}${unit.d} ${hours}${unit.h}`;
  if (hours > 0) return `${hours}${unit.h} ${minutes}${unit.m}`;
  return `${minutes}${unit.m}`;
}
