import { NextResponse } from "next/server";
import { isBot } from "@/lib/analytics";
import { briefingFailure, getNewsBriefing, getNewsExplainer } from "@/lib/news-insights";
import { getSymbolNames } from "@/lib/data";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { insightsConfigured } from "@/lib/stock-insights";

/**
 * Haber notları (17 Ekim) — `?tur=gundem` (Günün Gündemi) ya da
 * `?id=<haber>` (Bu Haber Ne Anlatıyor). Gerekçe lib/news-insights.ts.
 * Hisse notlarıyla aynı kapı (app/api/ai/hisse-notu): istemciden, panel
 * görünüme girince; bot ve geçersiz kimlik geri çevrilir; IP başına dakikada 20.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 90;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const respond = (data: unknown, status = 200) =>
  NextResponse.json(data, { status, headers: { "Cache-Control": "private, no-store" } });

export async function GET(request: Request) {
  if (!insightsConfigured()) return respond({ ok: false, reason: "off" });
  if (isBot(request.headers.get("user-agent") ?? "")) return respond({ ok: false, reason: "bot" }, 403);
  if (!rateLimit(clientKey(request, "haber-notu"), 20, 60_000).allowed) return respond({ ok: false, reason: "rate" }, 429);
  const params = new URL(request.url).searchParams;
  if (params.get("tur") === "gundem") {
    const briefing = await getNewsBriefing(new Date(), params.get("kapsam") === "hafta" ? "week" : "day");
    if (briefing) {
      /* Kartın logo şeridi (18 Ekim): sembol başına logo, gündem önbelleğinin
         dışında — logo tablosu değişince eski gündem de yeni logoyu alır. */
      const symbols = [...new Set(briefing.themes.flatMap((theme) => theme.items.flatMap((item) => item.symbols)))].slice(0, 40);
      const names = symbols.length ? await getSymbolNames(symbols).catch(() => ({}) as Awaited<ReturnType<typeof getSymbolNames>>) : {};
      briefing.logos = Object.fromEntries(symbols.filter((s) => names[s]).map((s) => [s, names[s]?.logoUrl ?? null]));
    }
    return respond(briefing ? { ok: true, insight: briefing } : { ok: false, reason: "unavailable", cause: briefingFailure() });
  }
  const id = params.get("id") ?? "";
  if (!UUID.test(id)) return respond({ ok: false, reason: "bad-request" }, 400);
  const explainer = await getNewsExplainer(id);
  return respond(explainer ? { ok: true, insight: explainer } : { ok: false, reason: "unavailable" });
}
