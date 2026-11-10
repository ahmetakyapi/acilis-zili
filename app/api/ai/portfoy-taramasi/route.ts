import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isBot } from "@/lib/analytics";
import { getPortfolioScan } from "@/lib/portfolio-scan";
import { rateLimit } from "@/lib/rate-limit";

/**
 * Günlük portföy taraması (10 Kasım; eski `/api/ai/portfoy-notu`nun yerini
 * aldı) — `?dil=tr|en`. Gerekçe ve doğruluk kuralları lib/portfolio-scan.ts.
 * Oturum ister (tarama okurun kendi pozisyonlarından); okur başına dakikada
 * 6. Yanıt kişisel: önbelleğe alınmaz. Claude kapalıyken de çizim döner
 * (`text: null`).
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
  if (!rateLimit(`portfoy-taramasi:${userId}`, 6, 60_000).allowed) return respond({ ok: false, reason: "rate" }, 429);
  const locale = new URL(request.url).searchParams.get("dil") === "en" ? "en" : "tr";
  const scan = await getPortfolioScan(userId, locale);
  return respond(scan ? { ok: true, scan } : { ok: false, reason: "unavailable" });
}
