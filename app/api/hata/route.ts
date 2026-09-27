import { NextResponse } from "next/server";
import { z } from "zod";
import { normalizePath, routeTemplate } from "@/lib/analytics";
import { recordError } from "@/lib/error-log";
import { ERROR_MESSAGE_MAX } from "@/lib/error-log-core";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { sameSite } from "@/lib/same-site";

/**
 * İstemci hatası toplayıcısı (28 Eylül).
 *
 * Hata sınırları (`app/(app)/error.tsx`, `app/admin/error.tsx`,
 * `app/global-error.tsx`) tarayıcıda doğan bir hatayı buraya
 * `sendBeacon` ile bildiriyor (lib/error-report.ts). Sunucuda doğan hata
 * buraya GELMİYOR: onu `instrumentation.ts` zaten yazdı ve istemciye
 * `digest`iyle ulaşıyor — ikinci kez saymak sayıyı ikiye katlardı.
 *
 * KALIP `/api/olcum`un: aynı site kapısı, IP başına süreç belleğinde oran
 * sınırı (IP HİÇBİR YERE YAZILMIYOR, yalnızca sayacın anahtarı), her
 * durumda gövdesiz 204 — "reddedildin" demek yalnızca kapıyı yoklayana
 * bilgi verir.
 *
 * YOL İSTEMCİDEN GELİYOR ve güvenilmez: `normalizePath`ten geçmeyen istek
 * düşüyor, geçen yol ŞABLONA iniyor (`/hisse/AAPL` → `/hisse/[symbol]`).
 * Yığın hiç kabul edilmiyor: küçültülmüş paket satırları okunmuyor ve
 * tabloya yalnızca sunucu yığını giriyor.
 */

const BODY = z.object({
  path: z.string().min(1).max(300),
  message: z.string().min(1).max(ERROR_MESSAGE_MAX * 4),
});

/**
 * Bir IP on dakikada bu kadar hata bildirebilir. Döngüye giren bir hata
 * sınırı saniyede birkaç kez tetiklenebiliyor; gerçek bir okuyucunun on
 * dakikada yirmiden fazla AYRI hatası olmuyor.
 */
const LIMIT = 20;
const WINDOW_MS = 10 * 60 * 1000;

const NO_CONTENT = () => new NextResponse(null, { status: 204 });

export async function POST(request: Request) {
  if (!sameSite(request)) return NO_CONTENT();
  if (!rateLimit(clientKey(request, "hata"), LIMIT, WINDOW_MS).allowed) return NO_CONTENT();
  /* Geliştirmede kayıt yok — gerekçe instrumentation.ts'te. */
  if (process.env.NODE_ENV !== "production") return NO_CONTENT();

  let payload: z.infer<typeof BODY>;
  try {
    payload = BODY.parse(await request.json());
  } catch {
    return NO_CONTENT();
  }

  const path = normalizePath(payload.path);
  if (!path) return NO_CONTENT();

  await recordError({
    kind: "client",
    route: routeTemplate(path),
    digest: null,
    message: payload.message,
    stack: null,
  });
  return NO_CONTENT();
}
