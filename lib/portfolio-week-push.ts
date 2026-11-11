import type { Locale } from "@/lib/i18n/config";
import { addEtDays, isTradingDay, prevTradingDay, settledAt, todayEt, type MarketHoliday } from "@/lib/market-hours";
import { weekPct, type PortfolioWeek } from "@/lib/portfolio-weekly";
import { formatInZone, TR_ZONE, zoneDateKey, zoneWallTime } from "@/lib/session-clock";

/**
 * CUMA PORTFÖY ÖZETİ — saf zamanlama ve metin (11 Kasım, sahibinin isteği).
 * Hesap lib/portfolio-weekly.ts → portfolioWeek (pazar postasının karnesiyle
 * AYNI ölçü: kapanıştan kapanışa, hafta içinde alınan lot dışarıda);
 * gönderen app/api/cron/portfoy-ozeti; tercih lib/push-prefs-model.ts.
 *
 * NE ZAMAN — haftanın SON İŞLEM GÜNÜNÜN barı kesinleşince (`settledAt`:
 * kendi kapanışı, yarım günde erken + besleme gecikmesi). Cuma tatilse
 * (Good Friday, 4 Temmuz) perşembe; yarım günde 13:00 ET kapanışından.
 * Ama Türkiye'de GECE GÖNDERİLMEZ: normal kapanış yazın 23:20, kışın 00:20
 * TR'de kesinleşiyor ve push `urgency: high` ile telefonu uyandırır
 * (lib/push.ts → deliverPush). 23:00–08:00 TR arasına düşen an ertesi
 * 08:00 TR'ye kayar. Yarım günde (yazın 20:20, kışın 21:20 TR) aynı akşam
 * gider. Saat TR önce (CLAUDE.md "Saat"): ET↔UTC lib/market-hours.ts'te,
 * TR duvar saati lib/session-clock.ts'te.
 *
 * TUTAR YOK, YALNIZ ORAN — bildirim kilit ekranında görünür.
 */

export const PUSH_QUIET_START_TR = 23;
export const PUSH_QUIET_END_TR = 8;

export type PushWeek = {
  /** Haftanın pazartesisi (ET) — tekrar anahtarı ve hesap başlangıcı. */
  monday: string;
  /** Haftanın cumasi (ET) — hesap penceresinin sonu (weeklyMoves). */
  friday: string;
  /** Haftanın son işlem günü (ET). */
  lastSession: string;
  /** Gönderimin en erken anı. */
  dueAt: Date;
};

/** Gece sessizliği: 23:00–08:00 TR arasındaki an ertesi (ya da aynı) sabah 08:00 TR'ye kayar. */
export function outsideQuietHours(at: Date): Date {
  const hour = Number(formatInZone(at, TR_ZONE).slice(0, 2));
  if (hour >= PUSH_QUIET_END_TR && hour < PUSH_QUIET_START_TR) return at;
  const day = zoneDateKey(at, TR_ZONE);
  const morningDay = hour >= PUSH_QUIET_START_TR ? addEtDays(day, 1) : day;
  return zoneWallTime(morningDay, `${String(PUSH_QUIET_END_TR).padStart(2, "0")}:00`, TR_ZONE);
}

/**
 * İçinde bulunulan ET haftası (pazartesi–pazar; cumartesi ve pazar biten
 * haftaya sayılır). Haftada hiç işlem günü yoksa null.
 */
export function portfolioPushWeek(now: Date, holidays: MarketHoliday[]): PushWeek | null {
  const today = todayEt(now);
  const weekday = new Date(`${today}T00:00:00Z`).getUTCDay();
  const monday = addEtDays(today, -((weekday + 6) % 7));
  const friday = addEtDays(monday, 4);
  const lastSession = isTradingDay(friday, holidays) ? friday : prevTradingDay(friday, holidays);
  if (lastSession < monday) return null;
  return { monday, friday, lastSession, dueAt: outsideQuietHours(settledAt(lastSession, holidays)) };
}

/** Bu hafta gönderim zamanı geldi mi — geldiyse haftası. */
export function portfolioPushDue(now: Date, holidays: MarketHoliday[]): PushWeek | null {
  const week = portfolioPushWeek(now, holidays);
  return week && now.getTime() >= week.dueAt.getTime() ? week : null;
}

/** Tekrar anahtarı: okur başına haftada bir (lib/schema.ts → pushSends). */
export const portfolioPushKey = (monday: string) => `portfolio-week:${monday}`;

export type PortfolioPushLabels = {
  weeklyTitle: string;
  /** {change} haftalık yüzde, {symbol} en çok taşıyan. */
  weeklyBodyLifted: string;
  weeklyBodyDragged: string;
  /** Katkısı sıfır olan tek pozisyonda yalnız yüzde. */
  weeklyBodyPlain: string;
};

/**
 * Bildirim metni. En çok katkı = mutlak katkısı en büyük pozisyon
 * (`movers[0]`); katkı artıysa "taşıdı", eksiyse "geriletti". Yuvarlanınca
 * sıfır görünen katkıda pozisyon anılmaz.
 */
export function portfolioPushText(
  week: PortfolioWeek,
  locale: Locale,
  labels: PortfolioPushLabels,
): { title: string; body: string } {
  const change = weekPct(week.changePct, locale);
  const top = week.movers[0];
  const visible = top && Math.abs(top.contribution) >= 0.05;
  const template = !visible ? labels.weeklyBodyPlain : top.contribution > 0 ? labels.weeklyBodyLifted : labels.weeklyBodyDragged;
  return {
    title: labels.weeklyTitle,
    body: template.replace("{change}", change).replace("{symbol}", top?.symbol ?? ""),
  };
}
