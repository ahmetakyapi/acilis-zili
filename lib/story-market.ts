import type { MarketStatus } from "@/lib/market-hours";

export type StoryClose = { price: number; date: string };

/** Daily bars can include today's unfinished candle. Only a completed
 * session can be called a closing price; allow the delayed feed to finish
 * after an ordinary or early close. Existing provider cache guards apply. */
export function lastStoryClose(
  bars: readonly { time: number; close: number }[] | undefined,
  status: Pick<MarketStatus, "etDate" | "etMinutes" | "closeMinutes" | "tradingToday">,
): StoryClose | null {
  if (!bars) return null;
  const todayComplete = status.tradingToday && status.etMinutes >= status.closeMinutes + 15;
  let latest: StoryClose | null = null;
  for (const bar of bars) {
    if (!Number.isFinite(bar.time) || !Number.isFinite(bar.close) || bar.close <= 0) continue;
    const date = new Date(bar.time * 1000).toISOString().slice(0, 10);
    if (date > status.etDate || (date === status.etDate && !todayComplete)) continue;
    if (!latest || date > latest.date) latest = { price: bar.close, date };
  }
  return latest;
}
