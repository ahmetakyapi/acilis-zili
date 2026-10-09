"use server";

import { z } from "zod";
import { auth } from "@/auth";
import { getLocale, getDictionary } from "@/lib/i18n";
import { withLocale } from "@/lib/i18n/routing";
import { rateLimit } from "@/lib/rate-limit";
import { pushConfigured, removeSubscription, saveSubscription, sendToUser } from "@/lib/push";

/**
 * Bildirim aboneliği eylemleri — Ayarlar → Bildirimler
 * (components/notifications/PushSettings.tsx). Gerekçe lib/push.ts.
 *
 * Abonelik nesnesi tarayıcıdan geliyor ve güvenilmez: uç adres yalnızca
 * https ve makul uzunlukta, anahtarlar base64url. Satır OTURUMUN hesabına
 * yazılıyor, formdan gelen kimliğe değil.
 */

const SubscriptionInput = z.object({
  endpoint: z.string().url().max(1000).refine((value) => value.startsWith("https://")),
  keys: z.object({
    p256dh: z.string().regex(/^[A-Za-z0-9_-]+=*$/).max(200),
    auth: z.string().regex(/^[A-Za-z0-9_-]+=*$/).max(100),
  }),
});

async function userId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}

export async function subscribePushAction(
  subscription: unknown,
  device: string,
): Promise<{ ok: boolean }> {
  const id = await userId();
  if (!id || !pushConfigured()) return { ok: false };
  if (!rateLimit(`push-sub:${id}`, 10, 60_000).allowed) return { ok: false };
  const parsed = SubscriptionInput.safeParse(subscription);
  if (!parsed.success) return { ok: false };
  const ok = await saveSubscription(id, {
    endpoint: parsed.data.endpoint,
    p256dh: parsed.data.keys.p256dh,
    auth: parsed.data.keys.auth,
    device: device.slice(0, 60) || null,
    locale: await getLocale(),
  });
  return { ok };
}

export async function unsubscribePushAction(endpoint: string): Promise<{ ok: boolean }> {
  const id = await userId();
  if (!id || typeof endpoint !== "string") return { ok: false };
  await removeSubscription(id, endpoint);
  return { ok: true };
}

/** "Deneme Bildirimi Gönder" — dakikada üç; kendi cihazlarına. */
export async function sendTestPushAction(): Promise<{ ok: boolean; delivered: number }> {
  const id = await userId();
  if (!id) return { ok: false, delivered: 0 };
  if (!rateLimit(`push-test:${id}`, 3, 60_000).allowed) return { ok: false, delivered: 0 };
  const delivered = await sendToUser(id, (locale) => {
    const t = getDictionary(locale).notifications;
    return { title: t.testTitle, body: t.testBody, url: withLocale("/ayarlar", locale), tag: "test" };
  });
  return { ok: delivered > 0, delivered };
}
