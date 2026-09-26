import { cache } from "react";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { userAvatars } from "@/lib/schema";
import { AVATAR_DEFAULT_COLOR, isAvatarColor, isAvatarKey, type Avatar } from "@/lib/avatars";

/**
 * Hesabın profil karosu — satır yoksa `null` (arayüz mavi karoda baş
 * harfleri basar).
 *
 * İstek içinde önbellekli: başlıktaki hesap düğmesi ve /menu aynı istekte
 * soruyor, veritabanına bir kez gidiliyor.
 *
 * HATA YUTULUYOR ve bu bilinçli. Tablo migration'la geliyor ve
 * migration'lar elle uygulanıyor (gerekçe `lib/schema.ts` → userAvatars):
 * tablo yokken bu sorgu her sayfanın başlığında düşerdi. Profil karosu bir
 * süs; düşerse yerine baş harfler geliyor, sayfa etkilenmiyor.
 */
export const getUserAvatar = cache(async (userId: string): Promise<Avatar | null> => {
  try {
    const [row] = await db
      .select({ icon: userAvatars.icon, color: userAvatars.color })
      .from(userAvatars)
      .where(eq(userAvatars.userId, userId))
      .limit(1);
    if (!row) return null;
    const icon = isAvatarKey(row.icon) ? row.icon : null;
    const color = isAvatarColor(row.color) ? row.color : icon ? AVATAR_DEFAULT_COLOR[icon] : "blue";
    return { icon, color };
  } catch {
    return null;
  }
});
