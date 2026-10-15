import { unstable_cache } from "next/cache";
import { auth } from "@/auth";
import { loadDayFlow } from "@/lib/day-flow-data";
import { getLocale } from "@/lib/i18n";
import { isLocale } from "@/lib/i18n/config";
import { clientKey, rateLimit } from "@/lib/rate-limit";

const headers = { "Cache-Control": "private, no-store", Vary: "Cookie" };

/* OTURUMSUZ YANIT PAYLAŞIMLI (15 Ekim taraması). Bu uç, sitenin en sık
   çağrılan ucu: açık her sekme 30 saniyede bir yokluyor ve kullanıcıya özel
   tek parça favori işaretleri — oturumsuz yanıt locale başına birebir aynı.
   Yine de her anonim istek 4 paralel DB sorgusu + sembol adları + (seans
   içinde) sağlayıcı yolunu baştan koşuyordu. Oturumsuz dal artık locale
   başına 30 saniyelik `unstable_cache`te — tazelik yoklama aralığına eşit,
   yani ekrandaki veri eskimiyor (veri dürüstlüğüyle çelişmez). HATA
   ÖNBELLEĞİN DIŞINDA: `loadDayFlow` fırlatırsa boş sonuç saklanmaz, kural
   CLAUDE.md "İstekler arası önbellek". Oturumlu istek eski yoldan geçer. */
const sharedDayFlow = (locale: "tr" | "en") =>
  unstable_cache(() => loadDayFlow(locale, undefined), ["day-flow", locale], {
    revalidate: 30,
  })();

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
      : await sharedDayFlow(locale);
    return Response.json({ ok: true, snapshot }, { headers });
  } catch {
    // Never expose connection strings or provider errors in a public response.
    return Response.json({ ok: false, reason: "unavailable" }, { status: 503, headers });
  }
}
