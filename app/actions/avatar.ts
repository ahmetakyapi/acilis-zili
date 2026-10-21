"use server";

import { refresh } from "next/cache";
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

  /* Kova (15 Ekim taraması): o gün aşağıdaki tazeleme
     `revalidatePath("/", "layout")` idi ve kökten aşağı TÜM rotaların
     önbelleğini boşaltıyordu — sınırsız bir döngü siteyi kalıcı
     cache-miss'te çizdirebiliyordu. 20 Ekim'den beri tazeleme `refresh()`
     (aşağıda) ve önbelleğe dokunmuyor; kova artık yazma tavanı: döngü
     Neon'a sınırsız UPSERT yollamasın. 30/dk seçicide gezinen gerçek
     kullanıcıya bol; sınırda kayıt da düşmez, seçici hatayı gösterir. */
  if (!rateLimit(`avatar:${userId}`, 30, 60_000).allowed) return { status: "failed" };

  const rawIcon = formData.has("next-icon") ? formData.get("next-icon") : formData.get("icon");
  const rawColor = formData.has("next-color") ? formData.get("next-color") : formData.get("color");
  const icon = rawIcon === "" || rawIcon === null ? null : rawIcon;
  if (icon !== null && !isAvatarKey(icon)) return { status: "failed" };
  if (!isAvatarColor(rawColor)) return { status: "failed" };

  try {
    /* Aynı değere ikinci basış bir yazmaya ve sayfanın yeniden çizimine
       mal olmasın: satır zaten bu hâldeyse yazmadan ve TAZELEMEDEN dön. */
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
  /* Başlıktaki hesap düğmesi her sayfanın düzeninde; yeni karo gezinmeden
     görünsün diye istemci yönlendiricisi tazeleniyor. `refresh()`, düzen
     katmanı `revalidatePath`i DEĞİL (20 Ekim): o, sunucudaki bütün veri
     önbelleğini düşürüyordu; avatar zaten istek içi okunuyor ve düzen
     dinamik — gerekçe app/actions/inbox.ts. */
  refresh();
  return { status: "saved" };
}
