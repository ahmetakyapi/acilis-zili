"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { userProfiles } from "@/lib/schema";
import { BIO_MAX } from "@/lib/profiles";

export type ProfileActionState = { status: "idle" | "saved" | "failed" | "unavailable" };

/**
 * Herkese açık profil ayarlarını yazar: tanıtım + üç görünürlük anahtarı.
 *
 * `setAvatarAction` ile aynı omurga: kimlik OTURUMDAN (formdan değil),
 * sağlayıcıya/tazelemeye gitmeden ÖNCE oran sınırı, değerler sunucuda
 * doğrulanır, satır zaten aynı hâldeyse yazmadan ve tazelemeden dönülür.
 *
 * Tazeleme DAR: yalnızca /u/{kullanıcı} ve /ayarlar. Avatar'ın aksine bu
 * veri başlık düzeninde durmuyor; layout-genişliğinde purge gerekmiyor.
 *
 * Tablo yokken (migration 0032 uygulanmadan) yazma düşer ve okuyucuya
 * "şu an kaydedilemiyor" döner — portföyün "şu an açılamıyor" kalıbı.
 */
export async function saveProfileAction(
  _prev: ProfileActionState,
  formData: FormData,
): Promise<ProfileActionState> {
  const session = await auth();
  const userId = session?.user?.id;
  const username = session?.user?.name;
  if (!userId || !username) return { status: "failed" };

  if (!rateLimit(`profile:${userId}`, 30, 60_000).allowed) return { status: "failed" };

  const rawBio = formData.get("bio");
  if (typeof rawBio !== "string" || rawBio.length > BIO_MAX * 2) return { status: "failed" };
  /* Satır sonları kalır (iki satırlık tanıtım meşru), fazla boşluk kırpılır;
     sınır karakter sayısı. Boş kutu null yazar — "boş dize" diye bir hâl yok. */
  const bio = rawBio.trim().slice(0, BIO_MAX) || null;
  const isPublic = formData.get("public") === "on";
  const showWatchlists = formData.get("watchlists") === "on";
  const showPortfolio = formData.get("portfolio") === "on";

  try {
    const [current] = await db
      .select({
        bio: userProfiles.bio,
        isPublic: userProfiles.isPublic,
        showWatchlists: userProfiles.showWatchlists,
        showPortfolio: userProfiles.showPortfolio,
      })
      .from(userProfiles)
      .where(eq(userProfiles.userId, userId))
      .limit(1);
    if (
      current &&
      (current.bio ?? null) === bio &&
      current.isPublic === isPublic &&
      current.showWatchlists === showWatchlists &&
      current.showPortfolio === showPortfolio
    ) {
      return { status: "saved" };
    }
    await db
      .insert(userProfiles)
      .values({ userId, bio, isPublic, showWatchlists, showPortfolio })
      .onConflictDoUpdate({
        target: userProfiles.userId,
        set: { bio, isPublic, showWatchlists, showPortfolio, updatedAt: new Date() },
      });
  } catch {
    return { status: "unavailable" };
  }

  /* Dil öneki sunucuda sökülüyor: /en/u/... da bu yola düşer, ayrıca
     tazelenmez (diğer eylemlerle aynı sözleşme). */
  revalidatePath(`/u/${username}`);
  revalidatePath("/ayarlar");
  return { status: "saved" };
}
