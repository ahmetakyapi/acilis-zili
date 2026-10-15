import { cache } from "react";
import { and, count, desc, eq, isNull, lt } from "drizzle-orm";
import { db } from "@/lib/db";
import { notifications, users } from "@/lib/schema";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { sendToUser } from "@/lib/push";

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

export type NotificationText = {
  title: string;
  body: string;
  /** Dilsiz yerel yol — "/hisse/NVDA". */
  path: string;
  /** Push etiketi: aynı etiket öncekinin yerine geçer. */
  tag?: string;
};

export type InboxItem = {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  url: string;
  createdAt: Date;
  read: boolean;
};

/** Gelen kutusu tavanı — liste ve 90 günlük temizlik birlikte boyu sınırlar. */
export const INBOX_LIMIT = 50;
const RETENTION_DAYS = 90;

async function accountLocale(userId: string): Promise<Locale> {
  try {
    const [row] = await db.select({ locale: users.locale }).from(users).where(eq(users.id, userId)).limit(1);
    return row && isLocale(row.locale) ? row.locale : "tr";
  } catch {
    return "tr";
  }
}

/** Gelen kutusuna yazar (hesabın diliyle) ve push gönderir (cihazın diliyle). */
export async function notifyUser(
  userId: string,
  kind: NotificationKind,
  text: (locale: Locale) => NotificationText,
  withLocalePath: (path: string, locale: Locale) => string,
): Promise<number> {
  const locale = await accountLocale(userId);
  const inbox = text(locale);
  try {
    await db.insert(notifications).values({
      userId,
      kind,
      title: inbox.title.slice(0, 200),
      body: inbox.body.slice(0, 500),
      url: inbox.path,
    });
  } catch {
    /* tablo yok (migration 0035) — push yine gider */
  }
  return sendToUser(userId, (deviceLocale) => {
    const push = text(deviceLocale);
    return {
      title: push.title,
      body: push.body,
      url: withLocalePath(push.path, deviceLocale),
      tag: push.tag ?? `${kind}-${Date.now()}`,
    };
  });
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
      return {
        available: true,
        items: rows.map((row) => ({
          id: row.id,
          kind: row.kind as NotificationKind,
          title: row.title,
          body: row.body,
          url: row.url,
          createdAt: row.createdAt,
          read: row.readAt !== null,
        })),
      };
    } catch {
      return { available: false, items: [] };
    }
  },
);

export async function markAllRead(userId: string): Promise<void> {
  try {
    await db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
  } catch {
    /* tablo yok */
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
