import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { db } from "./db";
import { economicEvents, earningsCalendar, earningsAnalyses, watchlistItems, watchlists } from "./schema";
import { getStatus, getSymbolNames, guncelBilanco } from "./data";
import { etDateTimeToUtc } from "./market-hours";
import { displayOffsets, zoneTag } from "./session-clock";
import { getDictionary, type Locale } from "./i18n";
import { withLocale } from "./i18n/routing";
import { analysisHref } from "./analysis";
import { formatEventValue, formatMoneyCompact, formatPrice } from "./utils";
import { isSpotlight } from "./spotlight";
import { getEarningsCalendar } from "./providers/finnhub";
import { getReleasedObservation } from "./providers/fred";
import { earningsStatus, groupStatus, hasActual, type DayFlowSnapshot, type FlowEvent, type FlowMember } from "./day-flow";

/** One source for SSR and polling. GET reads providers, never mutates the DB. */
export async function loadDayFlow(locale: Locale, userId?: string): Promise<DayFlowSnapshot> {
  const status = await getStatus();
  const date = status.etDate;
  const now = new Date();
  const t = getDictionary(locale);
  // Critical DB errors propagate: the client retains its last successful
  // snapshot rather than replacing real events with a false empty day.
  const [events, earnings, analyses, watched] = await Promise.all([
    db.select().from(economicEvents).where(eq(economicEvents.eventDate, date)).orderBy(asc(economicEvents.eventTimeEt)),
    db.select().from(earningsCalendar).where(and(eq(earningsCalendar.reportDate, date), guncelBilanco)),
    db.select({ symbol: earningsAnalyses.symbol, period: earningsAnalyses.period, locale: earningsAnalyses.locale, reportDate: earningsAnalyses.reportDate, timing: earningsAnalyses.timing }).from(earningsAnalyses).where(eq(earningsAnalyses.reportDate, date)),
    // getUserSymbols diğer paneller için hatada [] döndürür. Burada bu,
    // takip edilen küçük şirketleri gün akışından sessizce kaldırırdı.
    // Yalnız gereken sembolleri oku; sorgu hatası tüm snapshot'ı reddetsin.
    userId
      ? db.selectDistinct({ symbol: watchlistItems.symbol })
        .from(watchlistItems)
        .innerJoin(watchlists, eq(watchlists.id, watchlistItems.watchlistId))
        .where(eq(watchlists.userId, userId))
      : Promise.resolve([]),
  ]);
  const watchedSet = new Set(watched.map((row) => row.symbol));
  const analysisMap = new Map<string, (typeof analyses)[number]>();
  for (const row of analyses) if (!analysisMap.has(row.symbol) || row.locale === locale) analysisMap.set(row.symbol, row);
  const meta = await getSymbolNames(
    [...new Set([...earnings.map((row) => row.symbol), ...analyses.map((row) => row.symbol)])],
    { throwOnError: true },
  );
  // One shared request for the entire day, never one request per company.
  // On closed empty days there is no provider traffic.
  const provider = earnings.length && status.etMinutes >= 240
    ? await getEarningsCalendar(date, date, undefined, "results") : null;
  const live = new Map(provider?.ok ? provider.data.filter((row) => row.reportDate === date).map((row) => [row.symbol, row]) : []);
  const eventItems: FlowEvent[] = await Promise.all(events.map(async (event) => {
    const scheduledAt = event.eventTimeEt ? etDateTimeToUtc(date, event.eventTimeEt).toISOString() : null;
    const fresh = !hasActual(event.actual) && event.fredSeriesId && scheduledAt && new Date(scheduledAt) <= now
      ? await getReleasedObservation(event.fredSeriesId, date) : null;
    const actual = fresh?.actual ?? event.actual;
    return {
      id: event.id, timeEt: event.eventTimeEt, scheduledAt,
      title: locale === "tr" ? event.titleTr : event.titleEn,
      importance: event.importance === "high" || event.importance === "low" ? event.importance : "medium",
      kind: "event", status: hasActual(actual) ? "released" : "scheduled",
      actual: formatEventValue(actual, event.unit, locale) || undefined,
      forecast: formatEventValue(event.forecast, event.unit, locale) || undefined,
      previous: formatEventValue(fresh?.previous ?? event.previous, event.unit, locale) || undefined,
      href: withLocale("/takvim?g=day", locale),
      source: fresh ? "FRED" : event.source === "seed" ? t.dayFlow.calendarSource : event.source === "bls-schedule" ? "BLS" : event.source,
      updatedAt: (fresh?.fetchedAt ?? event.updatedAt).toISOString(),
    };
  }));
  const byWindow = new Map<string, FlowMember[]>();
  const combined = new Map(earnings.map((row) => [row.symbol, row]));
  // Published reports can precede the calendar import: keep those actionable.
  for (const row of analyses) if (!combined.has(row.symbol)) combined.set(row.symbol, {
    id: row.symbol, symbol: row.symbol, reportDate: date, hour: row.timing,
    epsActual: null, epsEstimate: null, revenueActual: null, revenueEstimate: null,
    quarter: null, year: null, updatedAt: now,
  });
  for (const row of combined.values()) {
    const analysis = analysisMap.get(row.symbol);
    const info = meta[row.symbol];
    if (!analysis && !watchedSet.has(row.symbol) && !isSpotlight(row.symbol) && (info?.marketCap ?? 0) < 50e9) continue;
    const providerRow = live.get(row.symbol);
    // A missing value never erases an already confirmed database result.
    const eps = providerRow?.epsActual ?? row.epsActual;
    const revenue = providerRow?.revenueActual ?? row.revenueActual;
    const hour = providerRow?.hour ?? row.hour ?? "unknown";
    const member: FlowMember = {
      symbol: row.symbol, logoUrl: info?.logoUrl ?? null, watched: watchedSet.has(row.symbol),
      status: earningsStatus(eps, revenue, !!analysis),
      href: withLocale(analysis ? analysisHref(row.symbol, analysis.period) : `/hisse/${row.symbol}`, locale),
      eps: hasActual(eps) ? formatPrice(eps!, locale, { currency: true }) : undefined,
      revenue: hasActual(revenue) ? formatMoneyCompact(revenue!, locale) : undefined,
    };
    byWindow.set(hour, [...(byWindow.get(hour) ?? []), member]);
  }
  const windows: Record<string, { time: string | null; title: string }> = {
    bmo: { time: "08:00", title: t.earnings.beforeOpen },
    amc: { time: `${Math.floor(status.closeMinutes / 60)}`.padStart(2, "0") + ":" + String(status.closeMinutes % 60).padStart(2, "0"), title: t.earnings.afterClose },
    dmh: { time: "12:00", title: t.earnings.duringMarket },
    unknown: { time: null, title: t.dayFlow.timeUnknown },
  };
  const earningsItems: FlowEvent[] = [...byWindow].map(([hour, members]) => {
    const window = windows[hour] ?? windows.unknown;
    members.sort((a, b) => Number(b.watched) - Number(a.watched) || (meta[b.symbol]?.marketCap ?? 0) - (meta[a.symbol]?.marketCap ?? 0));
    return {
      id: `earnings-${hour}`, timeEt: window.time,
      scheduledAt: window.time ? etDateTimeToUtc(date, window.time).toISOString() : null,
      title: members.slice(0, 3).map((member) => member.symbol).join(" · ") + (members.length > 3 ? ` +${members.length - 3}` : ""),
      importance: "medium", kind: "earnings", status: groupStatus(members), approx: !!window.time,
      detail: window.title, members,
      href: withLocale("/bilancolar", locale), source: "Finnhub",
      updatedAt: provider?.ok ? provider.fetchedAt.toISOString() : now.toISOString(),
    };
  });
  return {
    dateEt: date, asOf: now.toISOString(),
    events: [...eventItems, ...earningsItems].sort((a, b) => (a.timeEt ?? "99:99").localeCompare(b.timeEt ?? "99:99") || a.id.localeCompare(b.id)),
    initialNowMinutes: status.etMinutes, tradingDay: status.tradingToday, closeMinutes: status.closeMinutes,
    offsets: displayOffsets(date, locale), tags: zoneTag(locale), pollAfterMs: 30_000,
    sourceDelayed: !!provider && !provider.ok,
  };
}
