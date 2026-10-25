import { barDate } from "@/lib/period-returns";
import type { Bar } from "@/lib/providers/types";

/**
 * Haftanın verisi — "Bu Hafta Neden Hareket Etti" kartının SAYILARI (25 Ekim).
 *
 * Kart Bu Hisseye Sor'un yanına küçülünce (gerekçe
 * app/(app)/hisse/[symbol]/_panels/AskMovePanel.tsx) sayılar Claude notunu
 * BEKLEMİYOR: sunucu son beş tamamlanmış seansı kendisi hesaplayıp basıyor,
 * not yalnız metni getiriyor. Not yoksa (Claude anahtarı yok, not
 * yazılamadı, bot) kart yine haftanın verisini gösteriyor.
 *
 * HESAP NOTUNKİYLE BİREBİR (veri dürüstlüğü 3). lib/stock-insights.ts →
 * `buildMove` aynı barlardan (`completedDailyBars`) aynı pencereyi alıyor:
 * son altı kapanış, beş adım; S&P 500 yalnız son barı aynı güne düşüyorsa.
 * Kartta notun sayıları değil bunlar duruyor, notun metni ancak penceresi
 * (`to`) bununla aynıysa basılıyor — iki ayrı haftayı yan yana anlatmasın.
 */

export type WeekStep = { date: string; changePct: number; volumeRatio: number | null };

export type WeekMove = {
  symbol: string;
  from: string;
  to: string;
  /** Beş seansın kapanıştan kapanışa toplam değişimi. */
  changePct: number;
  /** S&P 500 (SPY) aynı beş seansta; seriler hizalı değilse null. */
  marketPct: number | null;
  sessions: WeekStep[];
  marketSessions: { date: string; changePct: number }[] | null;
};

/** Pencere: beş adım için altı kapanış. */
const WINDOW_CLOSES = 6;
/** Hacim ortalamasının seans sayısı (notla aynı). */
const VOLUME_BASE_SESSIONS = 20;

const step = (bar: Bar, prev: Bar) => ((bar.close - prev.close) / prev.close) * 100;

export function weekMoveFromBars(symbol: string, bars: Bar[] | null, spy: Bar[] | null): WeekMove | null {
  if (!bars || bars.length < WINDOW_CLOSES) return null;
  const window = bars.slice(-WINDOW_CLOSES);
  const base = window[0]!.close;
  if (!(base > 0) || window.some((bar) => !(bar.close > 0))) return null;
  const to = barDate(window[WINDOW_CLOSES - 1]!);
  const volumeBase = bars.slice(-(WINDOW_CLOSES + VOLUME_BASE_SESSIONS), -WINDOW_CLOSES);
  const avgVolume = volumeBase.reduce((sum, bar) => sum + bar.volume, 0) / Math.max(1, volumeBase.length);
  const spyWindow =
    spy && spy.length >= WINDOW_CLOSES && barDate(spy[spy.length - 1]!) === to ? spy.slice(-WINDOW_CLOSES) : null;
  const spyBase = spyWindow?.[0]?.close ?? 0;
  return {
    symbol,
    from: barDate(window[1]!),
    to,
    changePct: ((window[WINDOW_CLOSES - 1]!.close - base) / base) * 100,
    marketPct: spyWindow && spyBase > 0 ? ((spyWindow[WINDOW_CLOSES - 1]!.close - spyBase) / spyBase) * 100 : null,
    sessions: window.slice(1).map((bar, i) => ({
      date: barDate(bar),
      changePct: step(bar, window[i]!),
      volumeRatio: avgVolume > 0 ? bar.volume / avgVolume : null,
    })),
    marketSessions: spyWindow && spyBase > 0 ? spyWindow.slice(1).map((bar, i) => ({ date: barDate(bar), changePct: step(bar, spyWindow[i]!) })) : null,
  };
}

/** Beş adımın birikimli yolu, sıfırdan başlar: [0, a1, a1∘a2, …]. */
export function cumulativePath(steps: readonly { changePct: number }[]): number[] {
  const out = [0];
  let level = 1;
  for (const s of steps) {
    level *= 1 + s.changePct / 100;
    out.push((level - 1) * 100);
  }
  return out;
}

/** En sert seansın sırası (mutlak değişimi en büyük); boşta -1. */
export function loudestSession(steps: readonly { changePct: number }[]): number {
  let best = -1;
  steps.forEach((s, i) => {
    if (best < 0 || Math.abs(s.changePct) > Math.abs(steps[best]!.changePct)) best = i;
  });
  return best;
}
