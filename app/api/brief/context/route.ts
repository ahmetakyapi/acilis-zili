import { NextResponse } from "next/server";
import {
  getEventsBetween,
  getHolidays,
  getMacroRows,
  getSymbolNames,
  getEarningsBetween,
  weekAnchor,
} from "@/lib/data";
import { getChartBars, getQuotes } from "@/lib/providers";
import { addEtDays, getMarketStatus, todayEt } from "@/lib/market-hours";
import { INDEX_STRIP } from "@/db/seed/symbols";
import type { Bar } from "@/lib/providers/types";

/**
 * Bülten için ham veri paketi.
 *
 * Kullanıcının kendi Claude ajanı bu ucu çeker, yazıyı yazar ve
 * POST /api/brief ile geri gönderir. Bu uç veri sunar, yorum içermez.
 *
 * Parametreler:
 *   ?date=YYYY-MM-DD   dönemin tarihi (yoksa bugünün ET tarihi)
 *   ?period=weekly     o tarihi kapsayan haftanın (Pzt–Cum) paketi
 *
 * Geçmiş bir tarih istendiğinde endeks hareketi CANLI kotasyondan değil, o
 * güne/haftaya ait bar kapanışlarından türetilir — arşiv yazısının rakamı
 * bugünün fiyatı olamaz. `retrospective: true` ajana metnin sesini söyler.
 */

function authorized(request: Request): boolean {
  const secret = process.env.BRIEF_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function dayOf(bar: Bar): string {
  return new Date(bar.time * 1000).toISOString().slice(0, 10);
}

/** Aralıktaki barlardan dönem getirisi — ilk açılış → son kapanış. */
function periodChangePct(bars: Bar[]): number | null {
  if (bars.length === 0) return null;
  const base = bars[0].open || bars[0].close;
  if (!base) return null;
  return ((bars[bars.length - 1].close - base) / base) * 100;
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const periodParam = url.searchParams.get("period");
  const period = periodParam === "weekly" ? "weekly" : "daily";
  const dateParam = url.searchParams.get("date");
  const today = todayEt();
  const date = dateParam && DATE_RE.test(dateParam) ? dateParam : today;

  const anchor = period === "weekly" ? weekAnchor(date) : date;
  const from = anchor;
  const to = period === "weekly" ? addEtDays(anchor, 4) : anchor;
  // Bugünü kapsamayan her dönem geçmiştir; ses "olacak" değil "oldu".
  const retrospective = to < today;

  const holidays = await getHolidays();
  const status = getMarketStatus(new Date(), holidays);

  const [events, earnings, macro] = await Promise.all([
    getEventsBetween(from, to),
    getEarningsBetween(from, to),
    getMacroRows(),
  ]);

  // Endeks hareketi: güncel dönemde canlı kotasyon, geçmişte bar.
  let indices: {
    symbol: string;
    price: number | null;
    change_pct: number | null;
  }[];

  if (!retrospective && period === "daily") {
    const quotes = await getQuotes([...INDEX_STRIP], status);
    indices = INDEX_STRIP.map((symbol) => {
      const quote = quotes.ok ? quotes.data[symbol] : null;
      return {
        symbol,
        price: quote?.price ?? null,
        change_pct: quote?.changePct ?? null,
      };
    });
  } else {
    indices = await Promise.all(
      INDEX_STRIP.map(async (symbol) => {
        const result = await getChartBars(symbol, "3M", status);
        const window = result.ok
          ? result.data.filter((bar) => dayOf(bar) >= from && dayOf(bar) <= to)
          : [];
        return {
          symbol,
          price: window.length > 0 ? window[window.length - 1].close : null,
          change_pct: periodChangePct(window),
        };
      }),
    );
  }

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
    .slice(0, period === "weekly" ? 20 : 12)
    .map((row) => ({
      symbol: row.symbol,
      name: meta[row.symbol]?.name ?? null,
      report_date: row.reportDate,
      market_cap_usd: meta[row.symbol]?.marketCap ?? null,
      timing: row.hour,
      eps_estimate: row.epsEstimate,
      eps_actual: row.epsActual,
      revenue_estimate: row.revenueEstimate,
      revenue_actual: row.revenueActual,
    }));

  const weekEvents =
    period === "daily" && !retrospective
      ? await getEventsBetween(addEtDays(date, 1), addEtDays(date, 7))
      : [];

  return NextResponse.json({
    period,
    /** Haftalıkta dönemin pazartesisi — POST'a bu tarih gönderilmeli. */
    brief_date: anchor,
    range_et: { from, to },
    retrospective,
    market: {
      session: status.session,
      is_holiday: Boolean(status.holiday),
      holiday_name: status.holiday?.nameTr ?? null,
      next_open_utc: status.nextOpen.toISOString(),
    },
    economic_events: events.map((event) => ({
      date_et: event.eventDate,
      time_et: event.eventTimeEt,
      title_tr: event.titleTr,
      title_en: event.titleEn,
      importance: event.importance,
      forecast: event.forecast,
      previous: event.previous,
      actual: event.actual,
      unit: event.unit,
    })),
    economic_events_next_week: weekEvents
      .filter((event) => event.importance === "high")
      .map((event) => ({
        date_et: event.eventDate,
        time_et: event.eventTimeEt,
        title_tr: event.titleTr,
        importance: event.importance,
      })),
    earnings: {
      total_count: earnings.length,
      notable,
    },
    indices,
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
