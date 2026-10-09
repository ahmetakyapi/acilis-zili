import webpush from "web-push";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { pushSubscriptions } from "@/lib/schema";
import type { Locale } from "@/lib/i18n/config";

/**
 * WEB PUSH — gönderici. Gerekçe `lib/schema.ts` → pushSubscriptions.
 *
 * ANAHTARLAR ORTAMDA: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` (üret:
 * `npx web-push generate-vapid-keys`) ve isteğe bağlı `VAPID_SUBJECT`
 * (bildirim servisinin sorun olduğunda yazacağı adres; yoksa sitenin
 * adresi). İkisi de yoksa `pushConfigured()` false: ayarlardaki panel
 * "bu sunucuda kapalı" diyor, gönderici hiçbir şey yapmıyor — yarım kurulu
 * bir özellik tıklamayı yutmuyor.
 *
 * Genel anahtar istemciye sunucu bileşeninden prop olarak gidiyor
 * (`NEXT_PUBLIC_` değil): derleme anında gömülürse anahtar değişince yeniden
 * derleme gerekirdi.
 */

export type PushPayload = {
  title: string;
  body: string;
  /** Bildirime basınca açılacak yol ("/hisse/NVDA"). */
  url: string;
  /** Aynı etiketli bildirim öncekinin yerine geçer (tekrar yığılmasın). */
  tag?: string;
};

let configured: boolean | null = null;

export function pushConfigured(): boolean {
  if (configured !== null) return configured;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return (configured = false);
  const subject =
    process.env.VAPID_SUBJECT || process.env.NEXT_PUBLIC_SITE_URL || "https://aciliszili.com";
  try {
    webpush.setVapidDetails(subject, publicKey, privateKey);
    configured = true;
  } catch {
    configured = false;
  }
  return configured;
}

export function pushPublicKey(): string | null {
  return pushConfigured() ? process.env.VAPID_PUBLIC_KEY ?? null : null;
}

export type DeviceSubscription = {
  id: string;
  device: string | null;
  locale: string;
  createdAt: string;
  lastSentAt: string | null;
};

/**
 * Hesabın abonelikleri — `available: false` tablo yok (migration 0028).
 * Uç adres ve anahtarlar BİLEREK dışarıda: ekranda ve veri dökümünde
 * yalnızca cihazı tanıtan alanlar dolaşıyor.
 */
export async function getUserSubscriptions(
  userId: string,
): Promise<{ available: boolean; subscriptions: DeviceSubscription[] }> {
  try {
    const rows = await db
      .select({
        id: pushSubscriptions.id,
        device: pushSubscriptions.device,
        locale: pushSubscriptions.locale,
        createdAt: pushSubscriptions.createdAt,
        lastSentAt: pushSubscriptions.lastSentAt,
      })
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.userId, userId));
    return {
      available: true,
      subscriptions: rows.map((row) => ({
        ...row,
        createdAt: row.createdAt.toISOString(),
        lastSentAt: row.lastSentAt?.toISOString() ?? null,
      })),
    };
  } catch {
    return { available: false, subscriptions: [] };
  }
}

/**
 * Bir hesabın bütün cihazlarına gönderir. Ölü abonelik (404/410: kullanıcı
 * izni geri aldı ya da tarayıcı verisini sildi) siliniyor; geçici hata
 * (ağ, 5xx) satırı yerinde bırakıyor. Dönen sayı başarılı teslim.
 *
 * Yük cihazın DİLİNE göre kuruluyor: aynı hesabın telefonu Türkçe,
 * bilgisayarı İngilizce açılmış olabilir ve dil hesapta değil sayfada
 * (aboneliği açan sayfanın dili satırda duruyor).
 */
export async function sendToUser(
  userId: string,
  payload: PushPayload | ((locale: Locale) => PushPayload),
): Promise<number> {
  if (!pushConfigured()) return 0;
  let rows: (typeof pushSubscriptions.$inferSelect)[];
  try {
    rows = await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, userId));
  } catch {
    return 0;
  }
  const dead: string[] = [];
  const delivered: string[] = [];
  const bodyFor = (locale: string) =>
    JSON.stringify(typeof payload === "function" ? payload(locale === "en" ? "en" : "tr") : payload);
  await Promise.all(
    rows.map(async (row) => {
      try {
        await webpush.sendNotification(
          { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
          bodyFor(row.locale),
          /* Bir saat içinde teslim edilemeyen fiyat bildirimi artık haber
             değil; servis onu tutmasın. `urgency` telefonu uykudan
             uyandırmaya izin veriyor. */
          { TTL: 3600, urgency: "high" },
        );
        delivered.push(row.id);
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) dead.push(row.id);
      }
    }),
  );
  try {
    if (dead.length > 0) await db.delete(pushSubscriptions).where(inArray(pushSubscriptions.id, dead));
    if (delivered.length > 0) {
      await db.update(pushSubscriptions).set({ lastSentAt: new Date() }).where(inArray(pushSubscriptions.id, delivered));
    }
  } catch {
    // Bakım yazması düşerse bir sonraki gönderim yeniden dener.
  }
  return delivered.length;
}

export async function saveSubscription(
  userId: string,
  input: { endpoint: string; p256dh: string; auth: string; device: string | null; locale: Locale },
): Promise<boolean> {
  try {
    await db
      .insert(pushSubscriptions)
      .values({ userId, ...input })
      .onConflictDoUpdate({
        target: pushSubscriptions.endpoint,
        set: { userId, p256dh: input.p256dh, auth: input.auth, device: input.device, locale: input.locale, createdAt: new Date() },
      });
    return true;
  } catch {
    return false;
  }
}

export async function removeSubscription(userId: string, endpoint: string): Promise<void> {
  try {
    await db
      .delete(pushSubscriptions)
      .where(and(eq(pushSubscriptions.userId, userId), eq(pushSubscriptions.endpoint, endpoint)));
  } catch {
    // Tablo yoksa silinecek bir şey de yok.
  }
}
