import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { recordPageView } from "@/lib/analytics";
import { clientKey, rateLimit } from "@/lib/rate-limit";

/**
 * Sayfa görüntüleme toplayıcısı.
 *
 * İstemci `navigator.sendBeacon` ile çağırır (components/layout/ViewBeacon.tsx).
 * Yanıt gövdesi YOK — 204 döner ve okuyucunun tarayıcısı beklemez.
 *
 * NEDEN İSTEMCİDEN, proxy'den değil: proxy her isteği görür ve o istekler
 * arasında ön yükleme (prefetch), RSC gezinme parçaları, robot taraması ve
 * görsel istekleri de var. Sayfa gerçekten AÇILDIĞINDA çalışan bir çağrı,
 * gerçek okumaya çok daha yakın bir sayı veriyor.
 *
 * Yol İSTEMCİDEN GELİYOR ve güvenilmez: doğrulaması `normalizePath` içinde,
 * oradan geçmeyen istek sessizce düşer.
 */

const BODY = z.object({
  path: z.string().min(1).max(300),
  referrer: z.string().max(500).nullish(),
  locale: z.string().max(8).nullish(),
});

/** Bir IP beş dakikada bu kadar görüntüleme bildirebilir. */
const LIMIT = 120;
const WINDOW_MS = 5 * 60 * 1000;

export async function POST(request: Request) {
  const limit = rateLimit(clientKey(request, "olcum"), LIMIT, WINDOW_MS);
  if (!limit.allowed) {
    /* Sınır aşıldığında da 204: bu uç istemciye hiçbir şey anlatmıyor ve
       "engellendin" demek yalnızca ölçümü atlatmak isteyene bilgi verir. */
    return new NextResponse(null, { status: 204 });
  }

  let payload: z.infer<typeof BODY>;
  try {
    payload = BODY.parse(await request.json());
  } catch {
    return new NextResponse(null, { status: 204 });
  }

  const headers = request.headers;
  const session = await auth();

  await recordPageView({
    path: payload.path,
    referrer: payload.referrer ?? null,
    locale: payload.locale ?? "tr",
    signedIn: Boolean(session?.user),
    /* Vercel `x-forwarded-for` başlığını kendisi yazıyor ve istemcinin
       gönderdiğini eziyor. Değer hiçbir yere KAYDEDİLMİYOR; yalnızca günlük
       dönen özetin girdisi. */
    ip: headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "bilinmeyen",
    userAgent: headers.get("user-agent") ?? "",
    selfHost: (() => {
      try {
        return new URL(request.url).hostname;
      } catch {
        return null;
      }
    })(),
  });

  return new NextResponse(null, { status: 204 });
}
