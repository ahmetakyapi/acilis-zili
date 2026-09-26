"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { userAvatars } from "@/lib/schema";
import { isAvatarKey } from "@/lib/avatars";

export type AvatarActionState = { status: "idle" | "saved" | "failed" };

/**
 * Profil ikonunu yazar. `icon` boşsa seçim kalkar ve baş harfler döner.
 *
 * Anahtar SUNUCUDA doğrulanıyor: istemciden gelen değer yalnızca
 * `AVATAR_KEYS` listesindeyse yazılıyor. Kimlik oturumdan, formdan değil.
 * Yazma düşerse (ör. tablo henüz yok) okuyucuya kısa bir hata dönüyor;
 * seçici iyimser durumunu geri sarıyor.
 */
export async function setAvatarAction(
  _prev: AvatarActionState,
  formData: FormData,
): Promise<AvatarActionState> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { status: "failed" };

  const icon = formData.get("icon");
  try {
    if (icon === "" || icon === null) {
      await db.delete(userAvatars).where(eq(userAvatars.userId, userId));
    } else if (isAvatarKey(icon)) {
      await db
        .insert(userAvatars)
        .values({ userId, icon })
        .onConflictDoUpdate({
          target: userAvatars.userId,
          set: { icon, updatedAt: new Date() },
        });
    } else {
      return { status: "failed" };
    }
  } catch {
    return { status: "failed" };
  }
  /* Başlıktaki hesap düğmesi her sayfanın düzeninde: düzen katmanından
     tazeleniyor ki yeni ikon gezinmeden görünsün. */
  revalidatePath("/", "layout");
  return { status: "saved" };
}
