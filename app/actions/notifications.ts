"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getLocale, getDictionary } from "@/lib/i18n";
import { withLocale } from "@/lib/i18n/routing";
import { rateLimit } from "@/lib/rate-limit";
import { pushConfigured, pushSubscriptionSchema, removeSubscription, saveSubscription, sendToUser } from "@/lib/push";
import { notificationPrefs } from "@/lib/schema";

/**
 * Bildirim aboneliği eylemleri — Ayarlar → Bildirimler
 * (components/notifications/PushSettings.tsx). Gerekçe lib/push.ts.
 *
 * Abonelik nesnesi tarayıcıdan geliyor ve güvenilmez: şema
 * lib/push.ts → pushSubscriptionSchema (https, alan adlı uç, base64url
 * anahtarlar). Satır OTURUMUN hesabına yazılıyor, formdan gelen kimliğe değil.
 */

async function userId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}

export async function subscribePushAction(
  subscription: unknown,
  device: string,
): Promise<{ ok: boolean; changed: boolean }> {
  const id = await userId();
  if (!id || !pushConfigured()) return { ok: false, changed: false };
  if (!rateLimit(`push-sub:${id}`, 10, 60_000).allowed) return { ok: false, changed: false };
  const parsed = pushSubscriptionSchema.safeParse(subscription);
  if (!parsed.success) return { ok: false, changed: false };
  return saveSubscription(id, {
    endpoint: parsed.data.endpoint,
    p256dh: parsed.data.keys.p256dh,
    auth: parsed.data.keys.auth,
    device: device.slice(0, 60) || null,
    locale: await getLocale(),
  });
}

export async function unsubscribePushAction(endpoint: string): Promise<{ ok: boolean }> {
  const id = await userId();
  if (!id || typeof endpoint !== "string") return { ok: false };
  await removeSubscription(id, endpoint);
  return { ok: true };
}

/**
 * Bilanço hatırlatması anahtarı (15 Ekim) — gerekçe lib/schema.ts →
 * notificationPrefs. Tercih HESAP genelinde; gönderim zaten hesabın tüm
 * abone cihazlarına gidiyor. Tablo yokken yazma düşer ve `ok: false`
 * döner; anahtar zaten `available` kapısının arkasında basılıyor.
 */
export async function setEarningsReminderAction(enabled: boolean): Promise<{ ok: boolean }> {
  const id = await userId();
  if (!id) return { ok: false };
  if (!rateLimit(`push-pref:${id}`, 10, 60_000).allowed) return { ok: false };
  try {
    await db
      .insert(notificationPrefs)
      .values({ userId: id, earningsReminder: enabled === true })
      .onConflictDoUpdate({
        target: notificationPrefs.userId,
        set: { earningsReminder: enabled === true, updatedAt: new Date() },
      });
    return { ok: true };
  } catch {
    return { ok: false };
  }
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
