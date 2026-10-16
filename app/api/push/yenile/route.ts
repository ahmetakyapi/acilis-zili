import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { getLocale } from "@/lib/i18n";
import { pushConfigured, pushSubscriptionSchema, replaceSubscription } from "@/lib/push";
import { deviceLabel } from "@/lib/push-device";
import { rateLimit } from "@/lib/rate-limit";
import { sameSite } from "@/lib/same-site";

/**
 * ABONELİK YENİLEME (16 Ekim) — public/sw.js → `pushsubscriptionchange`.
 *
 * Tarayıcı aboneliği kendisi yenileyebiliyor (süre dolumu, anahtar dönüşü;
 * Firefox bunu yapıyor). Service worker sayfa açık olmadan çalıştığı için
 * sunucu eylemini çağıramıyor; bu uç onun tek yolu. Kimlik oturum çerezinden
 * (service worker'ın aynı köken isteği çerezi taşır), şema Ayarlar eylemiyle
 * aynı (lib/push.ts → pushSubscriptionSchema), kova da aynı (`push-sub:`).
 * Başka siteden atılan istek `sameSite` ile düşer.
 */

export const dynamic = "force-dynamic";

const Body = z.object({
  old: z.string().max(1000).nullable().optional(),
  subscription: pushSubscriptionSchema,
});

export async function POST(request: Request) {
  if (!sameSite(request)) return NextResponse.json({ ok: false }, { status: 403 });
  if (Number(request.headers.get("content-length") ?? 0) > 4096) {
    return NextResponse.json({ ok: false }, { status: 413 });
  }
  const session = await auth();
  const id = session?.user?.id;
  if (!id || !pushConfigured()) return NextResponse.json({ ok: false }, { status: 401 });
  if (!rateLimit(`push-sub:${id}`, 10, 60_000).allowed) {
    return NextResponse.json({ ok: false }, { status: 429 });
  }
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const parsed = Body.safeParse(json);
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });
  const { old, subscription } = parsed.data;
  const ok = await replaceSubscription(id, old ?? null, {
    endpoint: subscription.endpoint,
    p256dh: subscription.keys.p256dh,
    auth: subscription.keys.auth,
    device: deviceLabel(request.headers.get("user-agent") ?? "") || null,
    locale: await getLocale(),
  });
  return NextResponse.json({ ok }, { status: ok ? 200 : 409 });
}
