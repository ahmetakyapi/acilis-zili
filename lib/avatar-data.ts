import { cache } from "react";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { userAvatars } from "@/lib/schema";
import { isAvatarKey, type AvatarKey } from "@/lib/avatars";

/**
 * Hesabın seçtiği profil ikonu — yoksa `null` (arayüz baş harfleri basar).
 *
 * İstek içinde önbellekli: başlıktaki hesap düğmesi ve /menu aynı istekte
 * soruyor, veritabanına bir kez gidiliyor.
 *
 * HATA YUTULUYOR ve bu bilinçli. Tablo migration'la geliyor ve
 * migration'lar elle uygulanıyor (gerekçe `lib/schema.ts` → userAvatars):
 * tablo henüz yokken bu sorgu her sayfanın başlığında düşerdi. Profil ikonu
 * bir süs; düşerse yerine baş harfler geliyor, sayfa etkilenmiyor.
 */
export const getUserAvatar = cache(async (userId: string): Promise<AvatarKey | null> => {
  try {
    const [row] = await db
      .select({ icon: userAvatars.icon })
      .from(userAvatars)
      .where(eq(userAvatars.userId, userId))
      .limit(1);
    return isAvatarKey(row?.icon) ? row.icon : null;
  } catch {
    return null;
  }
});
