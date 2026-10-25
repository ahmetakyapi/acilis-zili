import { cache } from "react";
import { getStatus } from "@/lib/data";
import { etDateOf } from "@/lib/fx";
import { getChartBarsMulti } from "@/lib/providers";
import type { DayClose } from "@/lib/return-timeline";
import {
  buildThemeTimeline,
  THEME_TIMELINE_RANGES,
  type ThemeTimelineRange,
  type ThemeTimelineSeries,
} from "@/lib/theme-timeline";

/**
 * Temanın zaman çizgisinin verisi — TEK İSTEK (25 Ekim).
 *
 * Üç aralık (1A/3A/YBB) aynı günlük seriden kesiliyor: bir yıllık günlük
 * bar (RANGE_SPECS "1Y", 370 gün) YBB'yi de kapsıyor. Aralık değişimi bu
 * yüzden istemcide AĞSIZ — sunucu üç seriyi birden hesaplayıp küçük bir
 * nokta listesi olarak gönderiyor; ham barlar istemciye inmiyor.
 *
 * Üyeler ve ölçüt fonu aynı `getChartBarsMulti` çağrısında: iki ayrı
 * istek iki ayrı ana düşebilirdi (CLAUDE.md, aynı sayı aynı kaynaktan).
 */
export const loadThemeTimeline = cache(
  async (
    memberKey: string,
    benchmark: string | null,
  ): Promise<Record<ThemeTimelineRange, ThemeTimelineSeries> | null> => {
    const members = memberKey ? memberKey.split(",") : [];
    if (members.length === 0) return null;
    const status = await getStatus();
    const bars = await getChartBarsMulti(benchmark ? [...members, benchmark] : members, "1Y", status);
    const toDays = (symbol: string): DayClose[] =>
      (bars[symbol] ?? []).map((bar) => ({ day: etDateOf(bar.time), close: bar.close }));
    const memberSeries = Object.fromEntries(members.map((symbol) => [symbol, toDays(symbol)]));
    const benchSeries = benchmark ? toDays(benchmark) : null;
    const out = {} as Record<ThemeTimelineRange, ThemeTimelineSeries>;
    for (const range of THEME_TIMELINE_RANGES) {
      out[range] = buildThemeTimeline({ members: memberSeries, bench: benchSeries, range });
    }
    return Object.values(out).some((series) => series.points.length >= 2) ? out : null;
  },
);
