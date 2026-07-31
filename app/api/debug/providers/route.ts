import { NextResponse } from "next/server";
import { getStatus } from "@/lib/data";
import { providerStatus, getQuotes } from "@/lib/providers";
import { getProfile, getEarningsCalendar } from "@/lib/providers/finnhub";
import { MACRO_SERIES, getSeries } from "@/lib/providers/fred";
import { addEtDays, todayEt } from "@/lib/market-hours";

/**
 * Sağlayıcı sağlık kontrolü — yalnızca geliştirme ortamında.
 * Her sağlayıcıdan küçük bir gerçek istek atar; anahtarların çalışıp
 * çalışmadığını tek bakışta gösterir.
 */
export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "not-found" }, { status: 404 });
  }

  const configured = providerStatus();
  const status = await getStatus();
  const today = todayEt();

  const [quotes, profile, earnings, macro] = await Promise.all([
    getQuotes(["AAPL", "QQQ"], status),
    getProfile("AAPL"),
    getEarningsCalendar(today, addEtDays(today, 7)),
    getSeries(MACRO_SERIES[0], 3),
  ]);

  return NextResponse.json({
    configured,
    market: {
      session: status.session,
      etDate: status.etDate,
      etTime: status.etTime,
    },
    alpaca: quotes.ok
      ? { ok: true, source: quotes.source, sample: quotes.data }
      : { ok: false, reason: quotes.reason, message: quotes.message },
    finnhubProfile: profile.ok
      ? { ok: true, name: profile.data.name, industry: profile.data.industry }
      : { ok: false, reason: profile.reason, message: profile.message },
    finnhubEarnings: earnings.ok
      ? { ok: true, count: earnings.data.length, sample: earnings.data.slice(0, 3) }
      : { ok: false, reason: earnings.reason, message: earnings.message },
    fred: macro.ok
      ? { ok: true, seriesId: macro.data.seriesId, latest: macro.data.latestValue, period: macro.data.periodLabel }
      : { ok: false, reason: macro.reason, message: macro.message },
  });
}
