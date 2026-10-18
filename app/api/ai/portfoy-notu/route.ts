import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isBot } from "@/lib/analytics";
import { getPortfolioNote } from "@/lib/portfolio-note";
import { rateLimit } from "@/lib/rate-limit";
import { insightsConfigured } from "@/lib/stock-insights";

/**
 * Portföy notu (18 Ekim) — `?dil=tr|en`. Gerekçe ve doğruluk kuralları
 * lib/portfolio-note.ts. Oturum ister (not okurun kendi pozisyonlarından);
 * okur başına dakikada 6. Yanıt kişisel: önbelleğe alınmaz.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 90;

const respond = (data: unknown, status = 200) =>
  NextResponse.json(data, { status, headers: { "Cache-Control": "private, no-store" } });

export async function GET(request: Request) {
  if (!insightsConfigured()) return respond({ ok: false, reason: "off" });
  if (isBot(request.headers.get("user-agent") ?? "")) return respond({ ok: false, reason: "bot" }, 403);
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return respond({ ok: false, reason: "auth" }, 401);
  if (!rateLimit(`portfoy-notu:${userId}`, 6, 60_000).allowed) return respond({ ok: false, reason: "rate" }, 429);
  const locale = new URL(request.url).searchParams.get("dil") === "en" ? "en" : "tr";
  const note = await getPortfolioNote(userId, locale);
  return respond(note ? { ok: true, note } : { ok: false, reason: "unavailable" });
}
