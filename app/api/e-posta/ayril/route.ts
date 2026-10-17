import { NextResponse } from "next/server";
import { isUnsubscribeScope, unsubscribeResult } from "@/lib/email-notify";
import { clientKey, rateLimit } from "@/lib/rate-limit";

/**
 * TEK TIKLA ÇIKIŞ (RFC 8058) — bildirim postalarının `List-Unsubscribe`
 * başlığı buraya bakar; Gmail ve Apple Mail kendi "Abonelikten Çık"
 * düğmesiyle POST eder (gövde `List-Unsubscribe=One-Click`). GET bilerek
 * YOK: bağlantıyı önceden açan tarayıcılar aboneliği kapatmasın — insanın
 * tıkladığı bağlantı sayfaya gider (app/(app)/e-posta/ayril).
 *
 * Girişsiz; anahtar tahmin edilemez (32 bayt), kaba deneme anlamsız.
 *
 * SINIR ANAHTAR BAŞINA (17 Ekim denetimi): Gmail ve Yahoo tek tıkla
 * çıkışı kendi az sayıdaki sunucu IP'lerinden POST ediyor; IP başına
 * dakikada 20, pazar postasının ardından gelen bir dalgada bazı okurlara
 * 429 döndürüyordu ve sağlayıcılar yeniden denemiyor. IP tavanı yalnız
 * kötüye kullanıma karşı geniş. Veritabanı hatası 503 (sağlayıcı
 * "abonelik yok" sanmasın), tanınmayan anahtar 404.
 */
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("anahtar") ?? "";
  const scope = url.searchParams.get("kapsam");
  if (!isUnsubscribeScope(scope)) return NextResponse.json({ ok: false }, { status: 400 });
  if (!rateLimit(clientKey(request, "unsub"), 600, 60_000).allowed || !rateLimit(`unsub-token:${token.slice(0, 64)}`, 10, 60_000).allowed) {
    return NextResponse.json({ ok: false }, { status: 429 });
  }
  const result = await unsubscribeResult(token, scope);
  return NextResponse.json({ ok: result === "ok" }, { status: result === "ok" ? 200 : result === "error" ? 503 : 404 });
}
