import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isBot } from "@/lib/analytics";
import { getEarningsDesk } from "@/lib/portfolio-earnings-desk";
import { rateLimit } from "@/lib/rate-limit";

/**
 * Bilanço Masası (11 Kasım) — `?dil=tr|en`. Gerekçe ve doğruluk kuralları
 * lib/portfolio-earnings-desk.ts. Portföy taraması ucunun kalıbı
 * (app/api/ai/portfoy-taramasi): oturum ister, botlara kapalı, okur başına
 * dakikada 6, yanıt kişisel ve önbelleğe alınmaz. Masa boşsa `desk: null`
 * (Claude çağrılmadı, bileşen hiçbir şey basmaz); Claude yazamazsa kartlar
 * yine döner (`text: null`).
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
  if (!rateLimit(`bilanco-masasi:${userId}`, 6, 60_000).allowed) return respond({ ok: false, reason: "rate" }, 429);
  const locale = new URL(request.url).searchParams.get("dil") === "en" ? "en" : "tr";
  const desk = await getEarningsDesk(userId, locale);
  return respond({ ok: true, desk: desk && desk.cards.length > 0 ? desk : null });
}
