"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { db } from "@/lib/db";
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

  const rawIcon = formData.has("next-icon") ? formData.get("next-icon") : formData.get("icon");
  const rawColor = formData.has("next-color") ? formData.get("next-color") : formData.get("color");
  const icon = rawIcon === "" || rawIcon === null ? null : rawIcon;
  if (icon !== null && !isAvatarKey(icon)) return { status: "failed" };
  if (!isAvatarColor(rawColor)) return { status: "failed" };

  try {
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
