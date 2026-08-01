import { NextResponse } from "next/server";
import {
  getEventsBetween,
  getHolidays,
  getMacroRows,
  getSymbolNames,
  getEarningsBetween,
} from "@/lib/data";
import { getQuotes } from "@/lib/providers";
import {
  addEtDays,
  getMarketStatus,
  todayEt,
} from "@/lib/market-hours";
import { INDEX_STRIP } from "@/db/seed/symbols";

/**
 * Günlük özet için ham veri paketi.
 * Kullanıcının kendi Claude ajanı bu ucu çeker, yazıyı yazar ve
 * POST /api/brief ile geri gönderir. Bu uç veri sunar, yorum içermez.
 */

function authorized(request: Request): boolean {
  const secret = process.env.BRIEF_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const today = todayEt();
  const holidays = await getHolidays();
  const status = getMarketStatus(new Date(), holidays);

  const [events, weekEvents, earnings, macro, quotesResult] = await Promise.all([
    getEventsBetween(today, today),
    getEventsBetween(addEtDays(today, 1), addEtDays(today, 7)),
    getEarningsBetween(today, today),
    getMacroRows(),
    getQuotes([...INDEX_STRIP], status),
  ]);

  const meta = await getSymbolNames([
    ...new Set(earnings.map((row) => row.symbol)),
  ]);

  // Bilançolarda öne çıkanlar (piyasa değerine göre) + toplam sayı
  const notable = earnings
    .filter((row) => meta[row.symbol]?.marketCap)
    .sort(
      (a, b) =>
        (meta[b.symbol]?.marketCap ?? 0) - (meta[a.symbol]?.marketCap ?? 0),
    )
    .slice(0, 12)
    .map((row) => ({
      symbol: row.symbol,
      name: meta[row.symbol]?.name ?? null,
      market_cap_usd: meta[row.symbol]?.marketCap ?? null,
      timing: row.hour,
      eps_estimate: row.epsEstimate,
      revenue_estimate: row.revenueEstimate,
    }));

  return NextResponse.json({
    date_et: today,
    market: {
      session: status.session,
      is_holiday: Boolean(status.holiday),
      holiday_name: status.holiday?.nameTr ?? null,
      next_open_utc: status.nextOpen.toISOString(),
    },
    economic_events_today: events.map((event) => ({
      time_et: event.eventTimeEt,
      title_tr: event.titleTr,
      title_en: event.titleEn,
      importance: event.importance,
      forecast: event.forecast,
      previous: event.previous,
      actual: event.actual,
      unit: event.unit,
    })),
    economic_events_this_week: weekEvents
      .filter((event) => event.importance === "high")
      .map((event) => ({
        date_et: event.eventDate,
        time_et: event.eventTimeEt,
        title_tr: event.titleTr,
        importance: event.importance,
      })),
    earnings_today: {
      total_count: earnings.length,
      notable,
    },
    indices: INDEX_STRIP.map((symbol) => {
      const quote = quotesResult.ok ? quotesResult.data[symbol] : null;
      return {
        symbol,
        price: quote?.price ?? null,
        change_pct: quote?.changePct ?? null,
      };
    }),
    macro_latest: macro
      .filter((row) => row.latestValue !== null)
      .map((row) => ({
        title_tr: row.titleTr,
        latest: row.latestValue,
        previous: row.prevValue,
        unit: row.unit,
        period: row.periodLabel,
        next_release: row.nextReleaseAt,
      })),
  });
}
