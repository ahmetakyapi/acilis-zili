import { cache } from "react";
import { and, eq, inArray, lt } from "drizzle-orm";
import { db } from "@/lib/db";
import { pushPreferences, pushSends, pushSubscriptions, users } from "@/lib/schema";
import { defaultPushPref, resolvePushPrefs, type PushKind, type PushPrefs } from "@/lib/push-prefs-model";

/**
 * Push tür tercihlerinin okuması ve yazması (11 Kasım). Varsayılanlar ve
 * gerekçe lib/push-prefs-model.ts; tablolar lib/schema.ts →
 * pushPreferences, pushSends.
 *
 * TABLO YOKKEN (migration 0044 uygulanmadan): Ayarlar anahtarları basmaz
 * (`available: false`), alarm push'u varsayılanla (açık) eskisi gibi gider,
 * cuma özeti hiç gitmez. Hata yutulur, kalıp lib/avatar-data.ts.
 */

async function roleOf(userId: string): Promise<string | null> {
  const [row] = await db.select({ role: users.role }).from(users).where(eq(users.id, userId)).limit(1);
  return row?.role ?? null;
}

/** Ayarlar ve veri dökümü için bütün türler; istek içinde tek sorgu. */
export const getPushPrefs = cache(async (userId: string): Promise<{ available: boolean; prefs: PushPrefs }> => {
  try {
    const [rows, role] = await Promise.all([
      db.select({ kind: pushPreferences.kind, enabled: pushPreferences.enabled }).from(pushPreferences).where(eq(pushPreferences.userId, userId)),
      roleOf(userId),
    ]);
    return { available: true, prefs: resolvePushPrefs(rows, role) };
  } catch {
    return { available: false, prefs: resolvePushPrefs([], null) };
  }
});

/**
 * Tek türün değeri — gönderim yolunun sorusu (lib/notifications.ts).
 * Okunamazsa VARSAYILAN: alarm push'u veritabanı hıçkırığında kesilmesin.
 */
export async function pushKindEnabled(userId: string, kind: PushKind): Promise<boolean> {
  try {
    const [row] = await db
      .select({ enabled: pushPreferences.enabled })
      .from(pushPreferences)
      .where(and(eq(pushPreferences.userId, userId), eq(pushPreferences.kind, kind)))
      .limit(1);
    if (row) return row.enabled === true;
    /* Rol yalnız varsayılanı rolden okunan tür için sorulur. */
    return kind === "price" ? true : defaultPushPref(kind, await roleOf(userId));
  } catch {
    return kind === "price";
  }
}

export async function setPushPref(userId: string, kind: PushKind, enabled: boolean): Promise<boolean> {
  try {
    await db
      .insert(pushPreferences)
      .values({ userId, kind, enabled })
      .onConflictDoUpdate({
        target: [pushPreferences.userId, pushPreferences.kind],
        set: { enabled, updatedAt: new Date() },
      });
    return true;
  } catch {
    return false;
  }
}

/**
 * Cuma özetinin alıcı adayları: en az bir abone cihazı olan ve tercihi
 * (satır ya da varsayılan) AÇIK hesaplar. Portföy süzgeci çağıranda
 * (lib/portfolio-weekly-note.ts → portfolioLots). Okunamazsa null — uç
 * bunu 503 diye söyler.
 */
export async function weeklyPushCandidates(): Promise<string[] | null> {
  try {
    const subscribed = await db.selectDistinct({ userId: pushSubscriptions.userId, role: users.role }).from(pushSubscriptions).innerJoin(users, eq(users.id, pushSubscriptions.userId));
    if (subscribed.length === 0) return [];
    const ids = subscribed.map((row) => row.userId);
    const rows = await db
      .select({ userId: pushPreferences.userId, enabled: pushPreferences.enabled })
      .from(pushPreferences)
      .where(and(eq(pushPreferences.kind, "weekly"), inArray(pushPreferences.userId, ids)));
    const stored = new Map(rows.map((row) => [row.userId, row.enabled === true]));
    return subscribed.filter((row) => stored.get(row.userId) ?? defaultPushPref("weekly", row.role)).map((row) => row.userId);
  } catch (error) {
    console.error("[push özeti] alıcılar okunamadı", error);
    return null;
  }
}

/**
 * Gönderimden ÖNCE deftere satır açar; açtıysa true. Satır zaten varsa
 * (bu hafta gitti) ya da tablo yoksa false — ikisinde de gönderilmez.
 */
export async function claimPushSend(userId: string, key: string): Promise<boolean> {
  try {
    const rows = await db.insert(pushSends).values({ userId, key }).onConflictDoNothing().returning({ key: pushSends.key });
    return rows.length > 0;
  } catch {
    return false;
  }
}

/** Hiçbir cihaza ulaşmayan gönderimin satırını geri alır: sonraki koşu yeniden dener. */
export async function releasePushSend(userId: string, key: string): Promise<void> {
  try {
    await db.delete(pushSends).where(and(eq(pushSends.userId, userId), eq(pushSends.key, key)));
  } catch {
    /* silinemezse o hafta o okura gitmez — ikinci bildirimden iyi */
  }
}

/** Defter budaması — 60 günden eskiler (hafta anahtarı bir daha sorulmaz). */
export async function prunePushSends(now: Date = new Date()): Promise<void> {
  try {
    await db.delete(pushSends).where(lt(pushSends.sentAt, new Date(now.getTime() - 60 * 24 * 3600_000)));
  } catch {
    /* tablo yok */
  }
}
