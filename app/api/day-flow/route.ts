import { auth } from "@/auth";
import { loadDayFlow } from "@/lib/day-flow-data";
import { getLocale } from "@/lib/i18n";
import { isLocale } from "@/lib/i18n/config";
import { clientKey, rateLimit } from "@/lib/rate-limit";

const headers = { "Cache-Control": "private, no-store", Vary: "Cookie" };

export async function GET(request: Request) {
  const limit = rateLimit(clientKey(request, "day-flow"), 30, 60_000);
  if (!limit.allowed) return Response.json({ ok: false, reason: "rate-limited" }, {
    status: 429, headers: { ...headers, "Retry-After": String(limit.retryAfter) },
  });
  const requested = new URL(request.url).searchParams.get("locale");
  if (requested !== null && !isLocale(requested)) return Response.json({ ok: false, reason: "invalid-locale" }, { status: 400, headers });
  try {
    const locale = requested && isLocale(requested) ? requested : await getLocale();
    const session = await auth();
    return Response.json({ ok: true, snapshot: await loadDayFlow(locale, session?.user?.id) }, { headers });
  } catch {
    // Never expose connection strings or provider errors in a public response.
    return Response.json({ ok: false, reason: "unavailable" }, { status: 503, headers });
  }
}
