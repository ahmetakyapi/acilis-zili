import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isBot } from "@/lib/analytics";
import { rateLimit } from "@/lib/rate-limit";
import { getWatchlistToday } from "@/lib/watchlist-today";

/**
 * Takip Listem Bugün (24 Ekim) — `?dil=tr|en`. Gerekçe ve doğruluk
 * kuralları lib/watchlist-today.ts. Oturum ister (not okurun kendi
 * listesinden); okur başına dakikada 6, bot geri çevrilir. Yanıt kişisel:
 * önbelleğe alınmaz. Claude anahtarı yoksa da veri kısmı döner (`note: null`).
 */
export const dynamic = "force-dynamic";
export const maxDuration = 90;

const respond = (data: unknown, status = 200) =>
  NextResponse.json(data, { status, headers: { "Cache-Control": "private, no-store" } });

export async function GET(request: Request) {
  if (isBot(request.headers.get("user-agent") ?? "")) return respond({ ok: false, reason: "bot" }, 403);
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return respond({ ok: false, reason: "auth" }, 401);
  if (!rateLimit(`takip-notu:${userId}`, 6, 60_000).allowed) return respond({ ok: false, reason: "rate" }, 429);
  const locale = new URL(request.url).searchParams.get("dil") === "en" ? "en" : "tr";
  const today = await getWatchlistToday(userId, locale).catch(() => null);
  return respond(today ? { ok: true, today } : { ok: false, reason: "unavailable" });
}
