import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isBot } from "@/lib/analytics";
import { getAdvisorReport } from "@/lib/portfolio-advisor";
import { rateLimit } from "@/lib/rate-limit";

/**
 * Portföy danışmanı (11 Kasım) — `?ufuk=gunluk|aylik&dil=tr|en`. YALNIZ
 * site sahibi (lib/portfolio-advisor.ts → getAdmin); başka okura
 * `owner-only` döner. Botlara kapalı, dakikada 6. Yanıt kişisel:
 * önbelleğe alınmaz.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const respond = (data: unknown, status = 200) =>
  NextResponse.json(data, { status, headers: { "Cache-Control": "private, no-store" } });

export async function GET(request: Request) {
  if (isBot(request.headers.get("user-agent") ?? "")) return respond({ ok: false, reason: "bot" }, 403);
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return respond({ ok: false, reason: "auth" }, 401);
  if (session.user.role !== "admin") return respond({ ok: false, reason: "owner-only" }, 403);
  if (!rateLimit(`portfoy-danisman:${userId}`, 6, 60_000).allowed) return respond({ ok: false, reason: "rate" }, 429);
  const params = new URL(request.url).searchParams;
  const locale = params.get("dil") === "en" ? "en" : "tr";
  const horizon = params.get("ufuk") === "aylik" ? "monthly" : "daily";
  const report = await getAdvisorReport(userId, horizon, locale);
  return respond(report ? { ok: true, report } : { ok: false, reason: "unavailable" });
}
