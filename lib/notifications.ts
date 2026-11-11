import { cache } from "react";
import { and, count, desc, eq, isNull, lt } from "drizzle-orm";
import { db } from "@/lib/db";
import { notifications, users } from "@/lib/schema";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { sendToUser } from "@/lib/push";
import { pushKindEnabled } from "@/lib/push-prefs";
import { sendAlertEmail } from "@/lib/alert-email";
import type { AlertEmailInput } from "@/lib/notify-emails";

/**
 * Bildirim merkezi — gerekçe lib/schema.ts → notifications.
 *
 * TEK GİRİŞ `notifyUser`: olay hem gelen kutusuna yazılır hem (açık cihaz
 * varsa) Web Push ile gönderilir. İki yol ayrı ayrı çağrılsaydı biri er geç
 * unutulurdu — push'u açmamış okuyucu bildirimi hiç görmezdi.
 *
 * Her şey EN İYİ ÇABA: tablo yoksa ya da yazma düşerse olayın kendisi
 * (alarm tetiği, moderasyon kararı) etkilenmez.
 */

export type NotificationKind = "alert" | "percent" | "earnings" | "post_approved" | "post_rejected";

/** "Fiyat Alarmları" push tercihine bağlı türler (lib/push-prefs-model.ts). */
const PRICE_KINDS: ReadonlySet<NotificationKind> = new Set(["alert", "percent"]);

type NotificationText = {
  title: string;
  body: string;
  /** Dilsiz yerel yol — "/hisse/NVDA". */
  path: string;
  /** Push etiketi: aynı etiket öncekinin yerine geçer. */
  tag?: string;
};

type InboxItem = {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  url: string;
  createdAt: Date;
  read: boolean;
};

/** Gelen kutusu tavanı — liste ve 90 günlük temizlik birlikte boyu sınırlar. */
const INBOX_LIMIT = 50;
const RETENTION_DAYS = 90;

async function accountLocale(userId: string): Promise<Locale> {
  try {
    const [row] = await db.select({ locale: users.locale }).from(users).where(eq(users.id, userId)).limit(1);
    return row && isLocale(row.locale) ? row.locale : "tr";
  } catch {
    return "tr";
  }
}

const INBOX_RETRY_MS = 500;

/**
 * `notifyUser`ın fırlattığı hatanın günlüğü — tarama ve sayfadaki
 * değerlendirme `.catch(() => 0)` ile hatayı yutuyordu (8 Kasım): tetik
 * yazılmış, bildirim gitmemişti ve hiçbir iz kalmıyordu. Yeniden deneme
 * BURADA yapılmaz: hata yük kurucudan (deterministik) gelir ya da gelen
 * kutusu yazıldıktan sonra fırlar; bütün bildirimi tekrarlamak aynı satırı
 * ve push'u ikinci kez gönderirdi. Kanal başına tekrar kanalın içinde.
 */
export function logNotifyFailure(error: unknown): number {
  console.error("[alarm] bildirim gönderilemedi", error);
  return 0;
}

/**
 * Kanal başına teslim sonucu — alarm durumunun "bildirildi" kaydı bundan
 * türer (lib/alert-state.ts → deliveredAny). `push` teslim edilen cihaz
 * sayısı; `email` yalnız postanın KESİN gittiği an (`"sent"`) doğru:
 * belirsiz sonuç ("unknown") teslim sayılmaz, ama defter satırı kaldığı
 * için yeniden deneme o postayı ikinci kez göndermez (dedupeKey).
 */
export type NotifyReport = { inbox: boolean; push: number; email: boolean };

/**
 * Gelen kutusuna yazar (hesabın diliyle), push gönderir (cihazın diliyle)
 * ve `email` verildiyse alarm postasını dener (16 Ekim; tercih ve onay
 * lib/email-notify.ts'te — kapalıysa sessizce gitmez).
 *
 * 8 Kasım: kanal sonuçları ayrı ayrı döner (`notifyUserReport`); alarm
 * taraması "en az bir kanal teslim etti mi" diye bakıp tetiği bildirildi
 * diye işaretliyor. `notifyUser` eski sözleşmeyi (push sayısı) koruyor.
 */
export async function notifyUserReport(
  userId: string,
  kind: NotificationKind,
  text: (locale: Locale) => NotificationText,
  withLocalePath: (path: string, locale: Locale) => string,
  email?: AlertEmailInput & { alertId: string },
): Promise<NotifyReport> {
  const locale = await accountLocale(userId);
  const inbox = text(locale);
  const row = {
    userId,
    kind,
    title: inbox.title.slice(0, 200),
    body: inbox.body.slice(0, 500),
    url: inbox.path,
  };
  /* GELEN KUTUSU BİR KEZ YENİDEN DENENİR (8 Kasım). Yazma sessizce
     düşüyordu; alarm `triggeredAt` ile kapandığı için sonraki tarama onu
     bir daha okumaz ve push'u açmamış okuyucu tetiği hiç görmezdi. Satır
     yazılamadıysa (Neon kesintisi) kısa bir aradan sonra bir kez daha;
     yazılıp yanıtı kaybolan nadir durumda kutuda iki satır olur — eksik
     satırdan iyi. Push ve posta bu tekrara girmez (kendi kuralları:
     lib/push.ts → sendToUser, lib/email-notify.ts → sendStep). */
  let inboxWritten = false;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      await db.insert(notifications).values(row);
      inboxWritten = true;
      break;
    } catch (error) {
      /* tablo yok (migration 0035) — push yine gider */
      if (attempt === 2) console.error(`[bildirim] gelen kutusuna yazılamadı (${kind})`, error);
      else await new Promise((resolve) => setTimeout(resolve, INBOX_RETRY_MS));
    }
  }
  /* TÜR TERCİHİ (11 Kasım): okur "Fiyat Alarmları"nı kapattıysa alarm
     push'u gitmez; gelen kutusu ve (açıksa) posta yine yazılır — tercih
     yalnız cihaza giden kanalı susturur. Varsayılan açık, okunamazsa da
     açık (lib/push-prefs.ts → pushKindEnabled). */
  const pushAllowed = PRICE_KINDS.has(kind) ? await pushKindEnabled(userId, "price") : true;
  const delivered = !pushAllowed ? 0 : await sendToUser(userId, (deviceLocale) => {
    const push = text(deviceLocale);
    return {
      title: push.title,
      body: push.body,
      url: withLocalePath(push.path, deviceLocale),
      tag: push.tag ?? `${kind}-${Date.now()}`,
    };
  });
  const mailed = email ? (await sendAlertEmail(userId, email).catch(() => undefined)) === "sent" : false;
  return { inbox: inboxWritten, push: delivered, email: mailed };
}

export async function notifyUser(
  userId: string,
  kind: NotificationKind,
  text: (locale: Locale) => NotificationText,
  withLocalePath: (path: string, locale: Locale) => string,
  email?: AlertEmailInput & { alertId: string },
): Promise<number> {
  return (await notifyUserReport(userId, kind, text, withLocalePath, email)).push;
}

/** Okunmamış sayısı — başlıktaki zil her sayfada sorar; istek içinde tek sorgu. */
export const getUnreadCount = cache(async (userId: string): Promise<number> => {
  try {
    const [row] = await db
      .select({ n: count() })
      .from(notifications)
      .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
    return row?.n ?? 0;
  } catch {
    return 0;
  }
});

function inboxItemOf(row: typeof notifications.$inferSelect): InboxItem {
  return {
    id: row.id,
    kind: row.kind as NotificationKind,
    title: row.title,
    body: row.body,
    url: row.url,
    createdAt: row.createdAt,
    read: row.readAt !== null,
  };
}

/** Son bildirimler; `available: false` tablo yok. */
export const getInbox = cache(
  async (userId: string): Promise<{ available: boolean; items: InboxItem[] }> => {
    try {
      const rows = await db
        .select()
        .from(notifications)
        .where(eq(notifications.userId, userId))
        .orderBy(desc(notifications.createdAt))
        .limit(INBOX_LIMIT);
      return { available: true, items: rows.map(inboxItemOf) };
    } catch {
      return { available: false, items: [] };
    }
  },
);

/**
 * Hesabın TUTULAN bütün bildirimleri — KVKK dışa aktarımı için.
 *
 * TAVANSIZ (20 Ekim denetimi). Dışa aktarım ekranın okuyucusunu
 * (`getInbox`, 50 satır) kullanıyordu; satırlar ise 90 gün tutuluyor.
 * Doksan günde 50'den fazla alarm alan üyenin indirdiği "hesabın tuttuğu
 * her şey" dosyası, sunucuda duran satırların bir kısmını sessizce
 * dışarıda bırakıyordu. Boyu zaten 90 günlük temizlik sınırlıyor.
 */
export async function exportInbox(
  userId: string,
): Promise<{ available: boolean; items: InboxItem[] }> {
  try {
    const rows = await db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt));
    return { available: true, items: rows.map(inboxItemOf) };
  } catch {
    return { available: false, items: [] };
  }
}

/** Okundu sayılan satır sayısı (20 Ekim): sıfırsa eylem tazeleme istemez. */
export async function markAllRead(userId: string): Promise<number> {
  try {
    const rows = await db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)))
      .returning({ id: notifications.id });
    return rows.length;
  } catch {
    /* tablo yok */
    return 0;
  }
}

/** Günlük cron adımı: 90 günden eski satırları siler. */
export async function pruneNotifications(now: Date = new Date()): Promise<string> {
  try {
    const cutoff = new Date(now.getTime() - RETENTION_DAYS * 24 * 3600 * 1000);
    const rows = await db
      .delete(notifications)
      .where(lt(notifications.createdAt, cutoff))
      .returning({ id: notifications.id });
    return String(rows.length);
  } catch {
    return "atlandı: notifications tablosu yok";
  }
}
