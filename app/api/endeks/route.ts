import { getStatus } from "@/lib/data";
import { loadIndexFeed } from "@/components/today/index-feed";
import { clientKey, rateLimit } from "@/lib/rate-limit";

/* --------------------------------------------------------------------------
   Kahramanın endeks paketi — YALNIZCA OKUMA.

   Ana sayfanın endeks kartları seans açıkken dakikada bir buradan tazeleniyor
   (`components/today/IndexLive.tsx`). Yanıt sunucu çiziminin kullandığı
   paketin birebir aynısı (`loadIndexFeed`): aynı dört sembol, aynı
   `getQuotes` anahtarı, yüzdenin hangi seansı anlattığı (`basis`) da
   sunucuda hesaplanmış hâliyle. Kullanıcıya özel hiçbir şey yok.

   ÖNBELLEK 30 SANİYE. Besleme zaten 15 dakika gecikmeli ve istemci dakikada
   bir soruyor; aynı yarım dakika içinde gelen okuyucuların hepsi aynı
   yanıtı alabilir, sağlayıcıya her sekme için ayrı gidilmez. Oran sınırı
   gün akışı ucuyla aynı kalıpta: kazara döngülerin önünde ucuz bir set.
   -------------------------------------------------------------------------- */

const LIMIT = 60;
const WINDOW_MS = 60_000;
const CACHE_SECONDS = 30;

export async function GET(request: Request) {
  const limit = rateLimit(clientKey(request, "endeks"), LIMIT, WINDOW_MS);
  if (!limit.allowed) {
    return Response.json(
      { ok: false },
      { status: 429, headers: { "Cache-Control": "no-store", "Retry-After": String(limit.retryAfter) } },
    );
  }
  try {
    const feed = await loadIndexFeed(await getStatus());
    return Response.json(feed, {
      status: feed.ok ? 200 : 503,
      headers: {
        "Cache-Control": feed.ok
          ? `public, s-maxage=${CACHE_SECONDS}, stale-while-revalidate=${CACHE_SECONDS}`
          : "no-store",
      },
    });
  } catch {
    // Sağlayıcı ayrıntısı herkese açık bir yanıta sızmaz.
    return Response.json({ ok: false }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
