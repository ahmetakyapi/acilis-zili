import type { Dictionary, Locale } from "@/lib/i18n";
import { closeMinutesFor, type MarketHoliday } from "@/lib/market-hours";
import { clockOf, timePair, zoneTag } from "@/lib/session-clock";

/**
 * Bilanço penceresinin okunuşu — "~23:00 TR · Kapanış Sonrası".
 *
 * SAAT YALNIZCA KAPANIŞ SONRASINDA. Sağlayıcı dakika vermiyor, yalnızca
 * pencereyi (bmo/amc/dmh). Kapanış sonrası raporlar kapanış zilinin hemen
 * ardından geliyor, yani "~kapanış saati" dürüst bir yaklaşık; açılış
 * öncesi raporlar ise sabah 06:00 ile 09:00 ET arasında herhangi bir yerde
 * olabiliyor ve tek bir saat yazmak uydurma kesinlik olurdu (CLAUDE.md →
 * Veri dürüstlüğü 1). Orada yalnızca pencerenin adı.
 *
 * Kapanış saati o günün tarihiyle hesaplanıyor: yarım günde 13:00 ET, TR
 * karşılığı ABD yaz saatine göre kayıyor (sabit saat yazılmaz).
 */
export function earningsWindow(
  date: string,
  hour: string | null,
  holidays: readonly MarketHoliday[],
  locale: Locale,
  t: Dictionary,
): { window: string; clock: string | null; approx: string | null } {
  if (hour === "amc") {
    const pair = timePair(date, clockOf(closeMinutesFor(date, [...holidays])), locale);
    const clock = `~${pair.primary} ${zoneTag(locale).primary}`;
    return {
      window: t.earnings.afterClose,
      clock,
      approx: t.stockDepth.sumNextApprox.replace("{clock}", clock).replace("{window}", t.earnings.afterClose),
    };
  }
  if (hour === "bmo") return { window: t.earnings.beforeOpen, clock: null, approx: null };
  if (hour === "dmh") return { window: t.earnings.duringMarket, clock: null, approx: null };
  return { window: t.earnings.timeUnknown, clock: null, approx: null };
}
