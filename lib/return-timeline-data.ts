import { cache } from "react";
import { getStatus } from "@/lib/data";
import { etDateOf } from "@/lib/fx";
import { addEtDays, todayEt } from "@/lib/market-hours";
import { getPortfolioPositions } from "@/lib/portfolio-data";
import { closeOnOrAfter } from "@/lib/profile-showcase";
import { getChartBars, getChartBarsMulti, getQuotes } from "@/lib/providers";
import type { Bar } from "@/lib/providers/types";
import { buildReturnTimeline, spyAnchorDay, type DayClose, type Timeline } from "@/lib/return-timeline";

/**
 * "Alıştan Bugüne" çizgisinin verisi (25 Ekim). Hesap saf çekirdekte
 * (`lib/return-timeline.ts`); burada yalnız toplama.
 *
 * KOTASYON ANAHTARI ÇAĞIRANA GÖRE — aynı sayı aynı paketten (CLAUDE.md →
 * getQuotes notu):
 * - `/portfoy`: Getiri paneli `loadPortfolio`nun kotasyonuyla yazıyor ve o
 *   anahtar yalnız pozisyon sembolleri. Çizginin ucu aynı paketten okunur;
 *   SPY'ın fiyatı ayrı istek (sayfada başka yerde basılmıyor).
 * - Profil: vitrin (`loadShowcase`) pozisyonlar + SPY'ı TEK anahtarda
 *   soruyor; çizgi de öyle, yani "−%16,0 / SPY +%0,7" ile çizginin iki ucu
 *   aynı sayı.
 *
 * GEÇMİŞ: en eski alış son bir yıl içindeyse günlük kapanış, değilse
 * haftalık (5 yıl; RANGE_SPECS tavanı). SPY tabanı vitrinin kuralıyla
 * (`closeOnOrAfter`, önce günlük sonra haftalık) ve alış AYININ ilk
 * kapanışından (`spyAnchorDay`, gizlilik gerekçesi orada).
 */

/** Günlük seriye inen en eski alış — 1Y barın geriye bakışı (370 gün) payıyla. */
const DAILY_LOOKBACK_DAYS = 360;

export type TimelineQuoteKey = "portfolio" | "showcase";

export const loadReturnTimeline = cache(
  async (userId: string, key: TimelineQuoteKey): Promise<(Timeline & { stale: boolean; weekly: boolean }) | null> => {
    const data = await getPortfolioPositions(userId);
    if (!data.ok || data.positions.length === 0) return null;

    const status = await getStatus();
    const symbols = [...new Set(data.positions.map((p) => p.symbol))];
    const today = todayEt();
    const since = data.positions.reduce((min, p) => (p.boughtAt < min ? p.boughtAt : min), data.positions[0].boughtAt);
    const weekly = since < addEtDays(today, -DAILY_LOOKBACK_DAYS);

    const [quotes, spyQuote, bars, spyDaily, spyWeekly] = await Promise.all([
      key === "showcase" ? getQuotes([...symbols, "SPY"], status) : getQuotes(symbols, status),
      key === "showcase" ? Promise.resolve(null) : getQuotes(["SPY"], status),
      getChartBarsMulti(symbols, weekly ? "5Y" : "1Y", status),
      getChartBars("SPY", "1Y", status),
      getChartBars("SPY", "5Y", status),
    ]);
    if (!quotes.ok) return null;

    const spyPrice =
      key === "showcase"
        ? (quotes.data.SPY?.price ?? null)
        : spyQuote?.ok
          ? (spyQuote.data.SPY?.price ?? null)
          : null;
    const daily = spyDaily.ok ? spyDaily.data : [];
    const weeklySpy = spyWeekly.ok ? spyWeekly.data : [];
    const toDays = (list: readonly Bar[]): DayClose[] =>
      list.map((bar) => ({ day: etDateOf(bar.time), close: bar.close }));

    const series: Record<string, DayClose[]> = {};
    for (const symbol of symbols) series[symbol] = toDays(bars[symbol] ?? []);

    const timeline = buildReturnTimeline({
      lots: data.positions.map((p) => ({
        symbol: p.symbol,
        quantity: p.quantity,
        costUsd: p.costUsd,
        boughtAt: p.boughtAt,
        spyBase:
          closeOnOrAfter(daily, spyAnchorDay(p.boughtAt), spyPrice, 0) ??
          closeOnOrAfter(weeklySpy, spyAnchorDay(p.boughtAt), spyPrice, 6),
      })),
      series,
      spy: toDays(weekly ? weeklySpy : daily),
      prices: Object.fromEntries(symbols.map((s) => [s, quotes.data[s]?.price ?? null])),
      spyPrice,
      today,
    });
    if (timeline.points.length < 2) return null;
    return { ...timeline, stale: quotes.stale === true, weekly };
  },
);
