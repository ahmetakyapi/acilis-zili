import { cache } from "react";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { notificationPrefs } from "@/lib/schema";

/**
 * Hesap genelindeki bildirim tercihleri — gerekçe lib/schema.ts →
 * notificationPrefs. Satır yoksa her tercih KAPALI; tablo yokken
 * `available: false` ve Ayarlar'daki anahtar hiç basılmıyor
 * (lib/price-alerts.ts kalıbı — açılamayacak bir anahtar göstermemek için).
 */
export const getNotificationPrefs = cache(
  async (userId: string): Promise<{ available: boolean; earningsReminder: boolean }> => {
    try {
      const [row] = await db
        .select({ earningsReminder: notificationPrefs.earningsReminder })
        .from(notificationPrefs)
        .where(eq(notificationPrefs.userId, userId))
        .limit(1);
      return { available: true, earningsReminder: row?.earningsReminder === true };
    } catch {
      return { available: false, earningsReminder: false };
    }
  },
);
