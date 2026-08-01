import { NextResponse } from "next/server";
import { getStatus } from "@/lib/data";
import { getChartBars, getQuote } from "@/lib/providers";
import { isChartRange, type Bar } from "@/lib/providers/types";
import { isValidSymbol } from "@/lib/utils";

export type ChartResponse =
  | {
      ok: true;
      bars: Bar[];
      source: string;
      stale: boolean;
      fetchedAt: string;
      /**
       * Önceki seansın kapanışı — yalnızca 1G için gönderilir. Günlük yüzde
       * TradingView/Midas konvansiyonuyla buna göre hesaplanır; açılış boşluğu
       * (gap) kaybolmaz.
       */
      prevClose?: number;
    }
  | { ok: false; reason: string };

export async function GET(
  request: Request,
  context: RouteContext<"/api/chart/[symbol]">,
) {
  const { symbol: rawSymbol } = await context.params;
  const symbol = rawSymbol.toUpperCase();
  const range = new URL(request.url).searchParams.get("range") ?? "1D";

  if (!isValidSymbol(symbol)) {
    return NextResponse.json<ChartResponse>(
      { ok: false, reason: "invalid-symbol" },
      { status: 400 },
    );
  }
  if (!isChartRange(range)) {
    return NextResponse.json<ChartResponse>(
      { ok: false, reason: "invalid-range" },
      { status: 400 },
    );
  }

  const status = await getStatus();
  const [result, quoteResult] = await Promise.all([
    getChartBars(symbol, range, status),
    range === "1D" ? getQuote(symbol, status) : Promise.resolve(null),
  ]);

  if (!result.ok) {
    return NextResponse.json<ChartResponse>(
      { ok: false, reason: result.reason },
      { status: result.reason === "not-found" ? 404 : 502 },
    );
  }

  const prevClose =
    quoteResult?.ok && typeof quoteResult.data.prevClose === "number"
      ? quoteResult.data.prevClose
      : undefined;

  return NextResponse.json<ChartResponse>({
    ok: true,
    bars: result.data,
    source: result.source,
    stale: Boolean(result.stale),
    fetchedAt: result.fetchedAt.toISOString(),
    ...(prevClose !== undefined ? { prevClose } : {}),
  });
}
