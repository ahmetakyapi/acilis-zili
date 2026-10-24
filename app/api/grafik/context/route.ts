import { NextResponse } from "next/server";
import { checkBearer, type AuthOutcome } from "@/lib/api-auth";
import { getHolidays } from "@/lib/data";
import { isIsoDay } from "@/lib/date-input";
import { isTradingDay, todayEt } from "@/lib/market-hours";
import { lastCompletedSession } from "@/lib/daily-chart";
import { getDailyChart } from "@/lib/daily-chart-data";
import { loadDailyChartContext } from "@/lib/daily-chart-context";

/**
 * Günün Grafiği rutininin bağlam paketi — `?date=YYYY-MM-DD` (yoksa son
 * tamamlanmış seans). Veri sunar, yorum yapmaz; paketin kuralları
 * `lib/daily-chart-context.ts` başında.
 *
 * `complete: false` → endeks barları gelmedi; rutin YAZMAZ (POST zaten 503
 * döner). `existing_locales` o günün hangi dillerde yazıldığını söylüyor:
 * "tr" varsa ve "en" yoksa rutin yalnız çeviriyi yazar.
 */

function authorized(request: Request): AuthOutcome {
  return checkBearer(request, process.env.BRIEF_SECRET);
}

export async function GET(request: Request) {
  const auth = authorized(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const holidays = await getHolidays();
  const last = lastCompletedSession(new Date(), holidays);
  const dateParam = new URL(request.url).searchParams.get("date");
  if (dateParam !== null && !isIsoDay(dateParam)) {
    return NextResponse.json({ error: "invalid-date", detail: "?date=YYYY-MM-DD" }, { status: 400 });
  }
  const date = dateParam ?? last;
  if (date > last || !isTradingDay(date, holidays)) {
    return NextResponse.json(
      { error: "not-a-completed-session", date, last_completed_session: last },
      { status: 400 },
    );
  }

  const [{ context, complete }, existing] = await Promise.all([
    loadDailyChartContext(date),
    getDailyChart(date, "tr"),
  ]);

  return NextResponse.json({
    today_et: todayEt(),
    date,
    last_completed_session: last,
    complete,
    existing_locales: existing?.locales ?? [],
    ...context,
  });
}
