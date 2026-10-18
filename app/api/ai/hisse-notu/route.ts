import { NextResponse } from "next/server";
import { isBot } from "@/lib/analytics";
import { isKnownSymbol } from "@/lib/data";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { getEarningsInsight, getMoveInsight, getPreviewInsight, insightsConfigured } from "@/lib/stock-insights";
import { isValidSymbol } from "@/lib/utils";

/**
 * Hisse sayfasının Claude notları (17 Ekim) — `?sembol=NVDA&tur=hareket|bilanco|onizleme`
 * (önizleme 18 Ekim: açıklanacak bilançoda neye bakılacak).
 * Gerekçe ve maliyet lib/stock-insights.ts.
 *
 * Sayfa notu İSTEMCİDEN, panel görünüme girince ister
 * (components/stocks/StockInsightCard.tsx): sunucu çiziminde istek olsaydı
 * her tarama botu her sembol için Claude çağrısı tetiklerdi. Uç da botu
 * (kullanıcı ajanı) ve bilinmeyen sembolü geri çeviriyor; IP başına
 * dakikada 20. Not önbellekte değilse yanıt birkaç saniye sürer.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 90;

const respond = (data: unknown, status = 200) =>
  NextResponse.json(data, { status, headers: { "Cache-Control": "private, no-store" } });

export async function GET(request: Request) {
  if (!insightsConfigured()) return respond({ ok: false, reason: "off" });
  if (isBot(request.headers.get("user-agent") ?? "")) return respond({ ok: false, reason: "bot" }, 403);
  if (!rateLimit(clientKey(request, "hisse-notu"), 20, 60_000).allowed) return respond({ ok: false, reason: "rate" }, 429);
  const params = new URL(request.url).searchParams;
  const symbol = (params.get("sembol") ?? "").toUpperCase();
  const kind = params.get("tur");
  if (!isValidSymbol(symbol) || (kind !== "hareket" && kind !== "bilanco" && kind !== "onizleme")) return respond({ ok: false, reason: "bad-request" }, 400);
  if (!(await isKnownSymbol(symbol))) return respond({ ok: false, reason: "unknown" }, 404);
  const insight = kind === "hareket" ? await getMoveInsight(symbol) : kind === "bilanco" ? await getEarningsInsight(symbol) : await getPreviewInsight(symbol);
  return respond(insight ? { ok: true, insight } : { ok: false, reason: "unavailable" });
}
