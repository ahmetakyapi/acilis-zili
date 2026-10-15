"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { userAvatars } from "@/lib/schema";
import { isAvatarColor, isAvatarKey } from "@/lib/avatars";

export type AvatarActionState = { status: "idle" | "saved" | "failed" };

/**
 * Profil karosunu yazar: ikon ve renk.
 *
 * Form o anki hâli gizli alanlarda taşıyor (`icon`, `color`); basılan düğme
 * yalnızca DEĞİŞENİ gönderiyor (`next-icon` ya da `next-color`). Böylece
 * tek form iki seçimi de yapıyor ve JavaScript kapalıyken de doğru kayıt
 * düşüyor. Boş ikon "baş harfler" demek.
 *
 * Değerler SUNUCUDA doğrulanıyor: yalnızca `lib/avatars.ts` listelerindeki
 * anahtarlar yazılıyor. Kimlik oturumdan, formdan değil. Yazma düşerse
 * okuyucuya kısa bir hata dönüyor; seçici iyimser durumunu geri sarıyor.
 */
export async function setAvatarAction(
  _prev: AvatarActionState,
  formData: FormData,
): Promise<AvatarActionState> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { status: "failed" };

  /* Kova (15 Ekim taraması): aşağıdaki `revalidatePath("/", "layout")`
     kökten aşağı TÜM rotaların önbelleğini boşaltıyor — sınırsız bir döngü
     siteyi kalıcı cache-miss'te çizdirip Neon ve sağlayıcı yükünü her
     ziyaretçiye yansıtabiliyordu. 30/dk seçicide gezinen gerçek kullanıcıya
     bol; sınırda kayıt da düşmez, seçici hatayı gösterir. */
  if (!rateLimit(`avatar:${userId}`, 30, 60_000).allowed) return { status: "failed" };

  const rawIcon = formData.has("next-icon") ? formData.get("next-icon") : formData.get("icon");
  const rawColor = formData.has("next-color") ? formData.get("next-color") : formData.get("color");
  const icon = rawIcon === "" || rawIcon === null ? null : rawIcon;
  if (icon !== null && !isAvatarKey(icon)) return { status: "failed" };
  if (!isAvatarColor(rawColor)) return { status: "failed" };

  try {
    /* Aynı değere ikinci basış site genelinde bir purge'a mal olmasın:
       satır zaten bu hâldeyse yazmadan ve TAZELEMEDEN dön. */
    const [current] = await db
      .select({ icon: userAvatars.icon, color: userAvatars.color })
      .from(userAvatars)
      .where(eq(userAvatars.userId, userId))
      .limit(1);
    if (current && current.icon === icon && current.color === rawColor) {
      return { status: "saved" };
    }
    await db
      .insert(userAvatars)
      .values({ userId, icon, color: rawColor })
      .onConflictDoUpdate({
        target: userAvatars.userId,
        set: { icon, color: rawColor, updatedAt: new Date() },
      });
  } catch {
    return { status: "failed" };
  }
  /* Başlıktaki hesap düğmesi her sayfanın düzeninde: düzen katmanından
     tazeleniyor ki yeni karo gezinmeden görünsün. */
  revalidatePath("/", "layout");
  return { status: "saved" };
}
