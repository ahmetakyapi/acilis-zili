import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Piyasa yönü — renk ve işaret kararları hep bunun üzerinden verilir. */
export type Direction = "up" | "down" | "flat";

export function directionOf(change: number | null | undefined): Direction {
  if (change === null || change === undefined || Number.isNaN(change)) return "flat";
  if (change > 0) return "up";
  if (change < 0) return "down";
  return "flat";
}

const DIRECTION_TEXT: Record<Direction, string> = {
  up: "text-up",
  down: "text-down",
  flat: "text-muted",
};

const DIRECTION_WASH: Record<Direction, string> = {
  up: "bg-up-wash text-up",
  down: "bg-down-wash text-down",
  flat: "bg-surface-sunken text-muted",
};

export function directionText(d: Direction) {
  return DIRECTION_TEXT[d];
}

export function directionWash(d: Direction) {
  return DIRECTION_WASH[d];
}

/** 1234.5 → "1.234,50" (tr) / "1,234.50" (en) */
export function formatPrice(
  value: number | null | undefined,
  locale: string,
  opts: { currency?: boolean; digits?: number } = {},
) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  const { currency = false, digits = 2 } = opts;
  const formatted = new Intl.NumberFormat(locale === "tr" ? "tr-TR" : "en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
  return currency ? `$${formatted}` : formatted;
}

/** Değişim yüzdesi — işaret her zaman gösterilir. */
export function formatPercent(value: number | null | undefined, locale: string) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  const formatted = new Intl.NumberFormat(locale === "tr" ? "tr-TR" : "en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(value));
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${formatted}%`;
}

/** Mutlak değişim — 2.41 → "+2,41" */
export function formatChange(value: number | null | undefined, locale: string) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  const formatted = new Intl.NumberFormat(locale === "tr" ? "tr-TR" : "en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(value));
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${formatted}`;
}

/** Piyasa değeri — 3210000000 → "3,21 T" */
export function formatCompact(
  value: number | null | undefined,
  locale: string,
): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  const abs = Math.abs(value);
  const units =
    locale === "tr"
      ? [
          { v: 1e12, s: "T" },
          { v: 1e9, s: "Mr" },
          { v: 1e6, s: "Mn" },
          { v: 1e3, s: "B" },
        ]
      : [
          { v: 1e12, s: "T" },
          { v: 1e9, s: "B" },
          { v: 1e6, s: "M" },
          { v: 1e3, s: "K" },
        ];
  const nf = new Intl.NumberFormat(locale === "tr" ? "tr-TR" : "en-US", {
    maximumFractionDigits: 2,
  });
  for (const unit of units) {
    if (abs >= unit.v) return `${nf.format(value / unit.v)} ${unit.s}`;
  }
  return nf.format(value);
}

/** Hacim — tam sayı, binlik ayraçlı */
export function formatVolume(value: number | null | undefined, locale: string) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat(locale === "tr" ? "tr-TR" : "en-US", {
    maximumFractionDigits: 0,
  }).format(value);
}

/** "az önce" / "3 dk önce" — veri tazeliği damgası için. */
export function timeAgo(date: Date | string, locale: string): string {
  const then = typeof date === "string" ? new Date(date) : date;
  const seconds = Math.floor((Date.now() - then.getTime()) / 1000);

  if (seconds < 45) return locale === "tr" ? "az önce" : "just now";
  const rtf = new Intl.RelativeTimeFormat(locale === "tr" ? "tr-TR" : "en-US", {
    numeric: "auto",
  });
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 31536000],
    ["month", 2592000],
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60],
  ];
  for (const [unit, secondsInUnit] of units) {
    if (seconds >= secondsInUnit) {
      return rtf.format(-Math.floor(seconds / secondsInUnit), unit);
    }
  }
  return rtf.format(-seconds, "second");
}

export function isValidSymbol(symbol: string): boolean {
  return /^[A-Z][A-Z.-]{0,9}$/.test(symbol);
}

/* --------------------------------------------------------------------------
   Tarih ve çift saat gösterimi
   Kaynaklar ET (New York) yayınlar; kullanıcı Türkiye'de okur. Tarihler
   Türkiye alışkanlığına göre ("6 Ağustos Perşembe"), saatler ET · TR çifti
   olarak gösterilir.
   -------------------------------------------------------------------------- */

/** "2026-08-06" → "6 Ağustos Perşembe" / "Thursday, August 6" */
export function formatEtDateLong(dateStr: string, locale: string): string {
  const date = new Date(`${dateStr}T12:00:00Z`);
  if (locale === "tr") {
    const day = new Intl.DateTimeFormat("tr-TR", {
      day: "numeric",
      month: "long",
      timeZone: "UTC",
    }).format(date);
    const weekday = new Intl.DateTimeFormat("tr-TR", {
      weekday: "long",
      timeZone: "UTC",
    }).format(date);
    return `${day} ${weekday}`;
  }
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(date);
}

/** "2026-08-06" → "06.08.2026" / "08/06/2026" */
export function formatEtDateShort(dateStr: string, locale: string): string {
  const [y, m, d] = dateStr.split("-");
  return locale === "tr" ? `${d}.${m}.${y}` : `${m}/${d}/${y}`;
}

const TR_TIME = new Intl.DateTimeFormat("tr-TR", {
  timeZone: "Europe/Istanbul",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/**
 * ET saatini Türkiye saatiyle eşler.
 * Dönüş: { et: "08:30", tr: "15:30" } — DST farkları utcDate üzerinden doğru.
 */
export function dualTime(utcDate: Date, etTime: string): { et: string; tr: string } {
  return { et: etTime, tr: TR_TIME.format(utcDate) };
}
