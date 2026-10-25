import type { DayClose } from "@/lib/return-timeline";

/**
 * TEMANIN ZAMAN ÇİZGİSİ — saf çekirdek (25 Ekim). Test
 * `tests/theme-timeline.test.ts`; veri `lib/theme-timeline-data.ts`.
 *
 * Tema detayı yalnız son kapanışı anlatıyordu ("bugün medyan +%0,4").
 * Bu çizgi aynı temanın 1A/3A/YBB seyrini, karşılaştırma ekranının
 * NORMALİZE dilinde (her seri pencerenin ilk gününe göre yüzde,
 * `components/markets/CompareChart.tsx`) kuruyor:
 *
 * - MEDYAN: her gün, üyelerin pencere başından bu yana getirilerinin
 *   medyanı. Ortalama değil — tek bir uçan hisse (bölünme, haber) temayı
 *   sürüklemesin; ana sayfa ve ölçü ızgarası da medyan okuyor.
 * - ÜYE PENCERENİN BAŞINDA İŞLEM GÖRMÜYORSA (sonradan halka arz) medyana
 *   girmez ve sayısı künyede söylenir: ortadan başlayan bir seri medyanı
 *   o gün sıfıra çekerdi.
 * - GÜNÜN EN İYİ / ZAYIF ÜYESİ: o günün kendi hareketi (bir önceki
 *   kapanışa göre), yalnız O GÜN barı olan üyelerden. Barı olmayan üye
 *   taşınmış kapanışla "%0" sayılmaz.
 */

export const THEME_TIMELINE_RANGES = ["1M", "3M", "YTD"] as const;
export type ThemeTimelineRange = (typeof THEME_TIMELINE_RANGES)[number];
export const DEFAULT_THEME_TIMELINE_RANGE: ThemeTimelineRange = "1M";

export function isThemeTimelineRange(value: unknown): value is ThemeTimelineRange {
  return typeof value === "string" && (THEME_TIMELINE_RANGES as readonly string[]).includes(value);
}

export type ThemeMove = { symbol: string; pct: number };

export type ThemeTimelinePoint = {
  day: string;
  median: number;
  bench: number | null;
  best: ThemeMove | null;
  worst: ThemeMove | null;
};

export type ThemeTimelineSeries = {
  points: ThemeTimelinePoint[];
  /** Medyana giren üye sayısı. */
  included: number;
  /** Pencere başında işlem görmediği ya da barı gelmediği için dışarıda kalan üyeler. */
  excluded: string[];
};

/** "YYYY-MM-DD"ye ay ekler; ay sonu taşarsa ayın son gününe kırpar. */
export function addMonths(day: string, months: number): string {
  const [y, m, d] = day.split("-").map(Number);
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, lastDay));
  return target.toISOString().slice(0, 10);
}

export function windowStart(range: ThemeTimelineRange, lastDay: string): string {
  if (range === "YTD") return `${lastDay.slice(0, 4)}-01-01`;
  return addMonths(lastDay, range === "1M" ? -1 : -3);
}

function medianOf(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Sıralı seride `day`e kadarki son kapanış (ikili arama). */
function closeAtOrBefore(series: readonly DayClose[], day: string): number | null {
  let lo = 0;
  let hi = series.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (series[mid].day <= day) {
      found = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return found >= 0 ? series[found].close : null;
}

export function buildThemeTimeline({
  members,
  bench,
  range,
}: {
  members: Readonly<Record<string, readonly DayClose[]>>;
  bench: readonly DayClose[] | null;
  range: ThemeTimelineRange;
}): ThemeTimelineSeries {
  const symbols = Object.keys(members);
  /* Izgara: ölçüt fonunun günleri (tek, kesintisiz takvim); yoksa üyelerin
     birleşimi. */
  const gridSource = bench && bench.length > 0 ? [bench] : symbols.map((s) => members[s]);
  const allDays = [...new Set(gridSource.flatMap((list) => list.map((bar) => bar.day)))].sort();
  if (allDays.length < 2) return { points: [], included: 0, excluded: symbols };
  const start = windowStart(range, allDays[allDays.length - 1]);
  const days = allDays.filter((day) => day >= start);
  if (days.length < 2) return { points: [], included: 0, excluded: symbols };

  const day0 = days[0];
  const bases = new Map<string, number>();
  const excluded: string[] = [];
  for (const symbol of symbols) {
    const series = members[symbol];
    /* Pencerenin ilk gününde (ya da öncesinde) barı olmalı. */
    const base = series.length > 0 && series[0].day <= day0 ? closeAtOrBefore(series, day0) : null;
    if (base !== null && base > 0) bases.set(symbol, base);
    else excluded.push(symbol);
  }
  if (bases.size === 0) return { points: [], included: 0, excluded };

  const exact = new Map<string, Map<string, number>>();
  for (const symbol of bases.keys()) exact.set(symbol, new Map(members[symbol].map((bar) => [bar.day, bar.close])));
  const benchBase = bench ? closeAtOrBefore(bench, day0) : null;

  const points: ThemeTimelinePoint[] = [];
  days.forEach((day, i) => {
    const returns: number[] = [];
    let best: ThemeMove | null = null;
    let worst: ThemeMove | null = null;
    for (const [symbol, base] of bases) {
      const close = closeAtOrBefore(members[symbol], day);
      if (close === null) continue;
      returns.push((close / base - 1) * 100);
      /* Günün hareketi: yalnız o gün gerçekten barı olan üye. Önceki
         kapanış serinin kendi bir önceki barı (ızgaranın önceki günü değil;
         o gün işlem görmediyse aradaki gün atlanır). */
      const today = exact.get(symbol)!.get(day);
      if (today === undefined) continue;
      const prevDay = i > 0 ? days[i - 1] : null;
      const prev = prevDay !== null ? closeAtOrBefore(members[symbol], prevDay) : previousClose(members[symbol], day);
      if (prev === null || !(prev > 0)) continue;
      const pct = (today / prev - 1) * 100;
      if (best === null || pct > best.pct) best = { symbol, pct };
      if (worst === null || pct < worst.pct) worst = { symbol, pct };
    }
    const median = medianOf(returns);
    if (median === null) return;
    const benchClose = bench && benchBase ? closeAtOrBefore(bench, day) : null;
    points.push({
      day,
      median,
      bench: benchClose !== null && benchBase ? (benchClose / benchBase - 1) * 100 : null,
      best,
      worst,
    });
  });
  return { points, included: bases.size, excluded };
}

/** `day`den önceki son kapanış — pencerenin ilk gününün hareketi için. */
function previousClose(series: readonly DayClose[], day: string): number | null {
  let prev: number | null = null;
  for (const bar of series) {
    if (bar.day >= day) break;
    prev = bar.close;
  }
  return prev;
}
