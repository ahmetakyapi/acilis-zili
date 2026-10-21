import { auth } from "@/auth";
import { loadDayFlow, loadSharedDayFlow } from "@/lib/day-flow-data";
import { getLocale } from "@/lib/i18n";
import { isLocale } from "@/lib/i18n/config";
import { clientKey, rateLimit } from "@/lib/rate-limit";

const headers = { "Cache-Control": "private, no-store", Vary: "Cookie" };

/* OTURUMSUZ YANIT PAYLAŞIMLI (15 Ekim taraması): locale başına 30 saniyelik
   ortak görüntü, ana sayfanın sunucu çizimiyle aynı TÜRDEN not (20 Ekim:
   aynısı değil — uç ve sayfa ayrı Turbopack çalışma zamanında, her biri
   kendi notunu tutar). Gerekçe ve neden `unstable_cache` olmadığı
   `lib/day-flow-data.ts` → `loadSharedDayFlow`.
   Oturumlu istek eski yoldan geçer. */
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
    const userId = session?.user?.id;
    const snapshot = userId
      ? await loadDayFlow(locale, userId)
      : await loadSharedDayFlow(locale);
    return Response.json({ ok: true, snapshot }, { headers });
  } catch {
    // Never expose connection strings or provider errors in a public response.
    return Response.json({ ok: false, reason: "unavailable" }, { status: 503, headers });
  }
}
