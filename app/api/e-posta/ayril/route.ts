import { NextResponse } from "next/server";
import { isUnsubscribeScope, unsubscribe } from "@/lib/email-notify";
import { clientKey, rateLimit } from "@/lib/rate-limit";

/**
 * TEK TIKLA ÇIKIŞ (RFC 8058) — bildirim postalarının `List-Unsubscribe`
 * başlığı buraya bakar; Gmail ve Apple Mail kendi "Abonelikten Çık"
 * düğmesiyle POST eder (gövde `List-Unsubscribe=One-Click`). GET bilerek
 * YOK: bağlantıyı önceden açan tarayıcılar aboneliği kapatmasın — insanın
 * tıkladığı bağlantı sayfaya gider (app/(app)/e-posta/ayril).
 *
 * Girişsiz; anahtar tahmin edilemez (32 bayt). Kaba deneme için IP başına
 * dakikada 20.
 */
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!rateLimit(clientKey(request, "unsub"), 20, 60_000).allowed) {
    return NextResponse.json({ ok: false }, { status: 429 });
  }
  const url = new URL(request.url);
  const token = url.searchParams.get("anahtar") ?? "";
  const scope = url.searchParams.get("kapsam");
  if (!isUnsubscribeScope(scope)) return NextResponse.json({ ok: false }, { status: 400 });
  const ok = await unsubscribe(token, scope);
  return NextResponse.json({ ok }, { status: ok ? 200 : 404 });
}
