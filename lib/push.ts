import { ECDH } from "node:crypto";
import webpush from "web-push";
import { z } from "zod";
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

/**
 * Uç adres kabul edilebilir mi — https, alan adı, standart port.
 *
 * Web Push standardı keyfi uca izin veriyor ve allowlist UnifiedPush gibi
 * meşru dağıtıcıları kırardı (gerekçe aşağıda, MAX_PUSH_DEVICES). Ama hiçbir
 * gerçek push servisi IP adresiyle ya da `localhost`la abone vermiyor (FCM,
 * Mozilla, Apple, WNS, UnifiedPush hep alan adı): IP-literal uç yalnızca
 * sunucuyu kendi iç ağına ya da makinesine POST attırmaya yarar. Reddedilir.
 */
export function pushEndpointAllowed(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" || url.username || url.password) return false;
  if (url.port && url.port !== "443") return false;
  const host = url.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost") || !host.includes(".")) return false;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.startsWith("[")) return false;
  return true;
}

/**
 * Anahtarlar şifrelemeye yarar mı — 65 baytlık, P-256 eğrisi üstünde
 * sıkıştırılmamış nokta ve en az 16 baytlık `auth` (20 Ekim taraması).
 *
 * Biçim denetimi (base64url + uzunluk) tek başına "AAAA"yı geçiriyordu;
 * web-push böyle bir anahtarla şifrelerken EŞZAMANLI fırlatıyor ve hata
 * `deliverPush` → `sendToUser` → `notifyUser` üzerinden alarm taramasını
 * yarıda kesiyordu — her hesap kendi satırıyla herkesin alarmını
 * geciktirebilirdi. Eğri denetimi `ECDH.convertKey` ile (eğri dışı nokta
 * fırlatır; çağrı başına ~15 µs).
 */
export function pushKeysValid(p256dh: string, auth: string): boolean {
  const key = Buffer.from(p256dh, "base64url");
  if (key.length !== 65 || key[0] !== 0x04) return false;
  if (Buffer.from(auth, "base64url").length < 16) return false;
  try {
    ECDH.convertKey(key, "prime256v1");
    return true;
  } catch {
    return false;
  }
}

/**
 * Tarayıcıdan gelen abonelik nesnesi — güvenilmez. Ayarlar eylemi
 * (app/actions/notifications.ts) ve service worker'ın yenileme ucu
 * (app/api/push/yenile) AYNI şemadan geçer.
 */
export const pushSubscriptionSchema = z.object({
  endpoint: z.string().url().max(1000).refine(pushEndpointAllowed),
  keys: z
    .object({
      p256dh: z.string().regex(/^[A-Za-z0-9_-]+=*$/).max(200),
      auth: z.string().regex(/^[A-Za-z0-9_-]+=*$/).max(100),
    })
    .refine((keys) => pushKeysValid(keys.p256dh, keys.auth)),
});

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
 * TEK TESLİM — kesin süreli, yönlendirmesiz, gövdesiz (16 Ekim).
 *
 * `webpush.sendNotification` çıplak `https.request` açıyor: süre yalnızca
 * istenirse ve BOŞTA kalma süresi (bayt bayt damlatan sunucu onu da
 * atlatıyor), yanıt gövdesi ise sınırsız biriktiriliyor (`responseText +=
 * chunk`). Uç adres okuyucudan geliyor; kendi sunucusunu abone eden biri
 * "201" deyip sonsuz bir gövde akıtarak üretim sürecinin belleğini
 * doldurabiliyor ya da isteği asılı tutup alarm taramasını durdurabiliyordu.
 * Kütüphane yalnız şifreleme ve VAPID başlıkları için kalıyor; isteği biz
 * atıyoruz: toplam süre tavanı, `redirect: "manual"` (iç adrese yönlendirme
 * izlenmez) ve gövde OKUNMADAN kapatılıyor — durum kodu yeterli.
 *
 * Dönen değer HTTP durum kodu; ağ hatası ya da süre aşımı 0 (geçici sayılır).
 *
 * HİÇ FIRLATMAZ (20 Ekim taraması). Şifreleme `try`ın dışındaydı: bozuk
 * anahtarlı tek satır `generateRequestDetails`te fırlatıyor, `sendToUser`ın
 * `Promise.all`ı ölü satır temizliğini atlıyor ve hata cron döngüsüne kadar
 * çıkıp taramanın geri kalanını durduruyordu; satır silinmediği için her
 * bildirimde yeniden. Anahtarı kullanılamaz satır 410 sayılır (sendToUser
 * siler); başka bir şifreleme hatası 0 — o bizim ayarımız da olabilir ve
 * körü körüne silmek bütün cihazları düşürürdü (aşağıdaki 401/403 notu).
 */
const PUSH_TIMEOUT_MS = 10_000;

export async function deliverPush(
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
  body: string,
): Promise<number> {
  if (!pushEndpointAllowed(subscription.endpoint)) return 410;
  if (!pushKeysValid(subscription.keys.p256dh, subscription.keys.auth)) return 410;
  try {
    const details = webpush.generateRequestDetails(subscription, body, {
      /* Bir saat içinde teslim edilemeyen fiyat bildirimi artık haber değil;
         servis onu tutmasın. `urgency` telefonu uykudan uyandırmaya izin
         veriyor. */
      TTL: 3600,
      urgency: "high",
    });
    const headers: Record<string, string> = {};
    for (const [key, value] of Object.entries(details.headers)) {
      if (key.toLowerCase() !== "content-length" && value != null) headers[key] = String(value);
    }
    const response = await fetch(details.endpoint, {
      method: details.method,
      headers,
      body: details.body ? new Uint8Array(details.body) : undefined,
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.timeout(PUSH_TIMEOUT_MS),
    });
    await response.body?.cancel().catch(() => undefined);
    return response.status;
  } catch {
    return 0;
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
const STALE_MS = 30 * 24 * 3600_000;
const stale = (row: { lastSentAt: Date | null; createdAt: Date }) =>
  Date.now() - (row.lastSentAt ?? row.createdAt).getTime() > STALE_MS;

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
      const status = await deliverPush(
        { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
        bodyFor(row.locale),
      );
      if (status >= 200 && status < 300) delivered.push(row.id);
      else if (status === 404 || status === 410) dead.push(row.id);
      /* 401/403 KALICI RET (17 Ekim denetimi): VAPID anahtarı değişince FCM
         ve Mozilla eski aboneliği hep reddediyor; satır sonsuza kadar kalıp
         her gönderimde boşuna istek açıyordu. Ama aynı kod bizim anahtar
         ayarımız bozulduğunda da gelir — o zaman HER satır reddedilir ve
         körü körüne silmek bütün cihazları düşürürdü. Bu yüzden yalnız 30
         gündür hiç teslim edilmemiş satır silinir. */
      else if ((status === 401 || status === 403) && stale(row)) dead.push(row.id);
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

/**
 * Kullanıcı başına cihaz TAVANI. Öteki yazma yollarının hepsi tavanlı
 * (MAX_ALERTS, watchlist, portföy) ama abonelikte yoktu: dakikada 10 farklı
 * uç adres sınırı günde ~14.400 satır biriktirmeye yetiyor ve her gönderim
 * satırların TAMAMINA istek açıyordu — hesap, sunucuyu keyfi adreslere POST
 * yağdıran bir röleye dönüyordu (15 Ekim taraması). Uç adres doğrulaması
 * bilinçli olarak https+uzunlukta kalıyor (Web Push standardı keyfi uca
 * izin verir; allowlist UnifiedPush gibi meşru dağıtıcıları kırar) — kötüye
 * kullanımın sınırı bu tavan. 12 cihaz: telefon + tablet + birkaç tarayıcı
 * profiline bol bol yeter.
 */
const MAX_PUSH_DEVICES = 12;

/**
 * Kaydet ya da tazele. `changed`: satır bu hesaba YENİ geldi (ilk kayıt ya da
 * başka hesaptan taşındı) — ekrandaki cihaz sayısı ancak o zaman değişir.
 */
export async function saveSubscription(
  userId: string,
  input: { endpoint: string; p256dh: string; auth: string; device: string | null; locale: Locale },
): Promise<{ ok: boolean; changed: boolean }> {
  try {
    const existing = await db
      .select({ endpoint: pushSubscriptions.endpoint })
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.userId, userId));
    const known = existing.some((row) => row.endpoint === input.endpoint);
    if (!known && existing.length >= MAX_PUSH_DEVICES) return { ok: false, changed: false };
    await db
      .insert(pushSubscriptions)
      .values({ userId, ...input })
      .onConflictDoUpdate({
        target: pushSubscriptions.endpoint,
        set: { userId, p256dh: input.p256dh, auth: input.auth, device: input.device, locale: input.locale, createdAt: new Date() },
      });
    return { ok: true, changed: !known };
  } catch {
    return { ok: false, changed: false };
  }
}

/**
 * Tarayıcı aboneliği kendisi yeniledi (`pushsubscriptionchange`, public/sw.js).
 * Eski satır BU hesabınsa yerinde güncellenir (cihaz adı ve dil korunur);
 * değilse yeni satır olarak kaydedilir. Yenilenmezse sunucu eski adrese
 * göndermeye devam ediyor, 410 alıp satırı siliyor ve okuyucu sessizce
 * bildirimsiz kalıyordu.
 */
export async function replaceSubscription(
  userId: string,
  oldEndpoint: string | null,
  input: { endpoint: string; p256dh: string; auth: string; device: string | null; locale: Locale },
): Promise<boolean> {
  if (oldEndpoint && oldEndpoint !== input.endpoint) {
    try {
      const moved = await db
        .update(pushSubscriptions)
        .set({ endpoint: input.endpoint, p256dh: input.p256dh, auth: input.auth })
        .where(and(eq(pushSubscriptions.userId, userId), eq(pushSubscriptions.endpoint, oldEndpoint)))
        .returning({ id: pushSubscriptions.id });
      if (moved.length > 0) return true;
    } catch {
      /* yeni uç başka bir satırda zaten varsa (benzersiz dizin) aşağıdaki upsert halleder */
    }
  }
  return (await saveSubscription(userId, input)).ok;
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
