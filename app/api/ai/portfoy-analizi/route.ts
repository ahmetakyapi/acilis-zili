import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isBot } from "@/lib/analytics";
import { getAnalysisNote } from "@/lib/portfolio-analysis-note";
import { rateLimit } from "@/lib/rate-limit";
import { insightsConfigured } from "@/lib/stock-insights";

/**
 * Claude'un portföy risk okuması (24 Ekim) — `?dil=tr|en`. Gerekçe,
 * sayı ve tavsiye denetimi lib/portfolio-analysis-note.ts. Oturum ister
 * (okurun kendi pozisyonları), botlara kapalı; okur başına dakikada 6.
 * Yanıt kişisel: önbelleğe alınmaz. Kalıp `/api/ai/portfoy-notu`.
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
  if (!rateLimit(`portfoy-analizi:${userId}`, 6, 60_000).allowed) return respond({ ok: false, reason: "rate" }, 429);
  const locale = new URL(request.url).searchParams.get("dil") === "en" ? "en" : "tr";
  const note = await getAnalysisNote(userId, locale);
  return respond(note ? { ok: true, note } : { ok: false, reason: "unavailable" });
}
