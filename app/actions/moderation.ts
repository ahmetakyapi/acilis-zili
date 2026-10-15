"use server";

import { revalidatePath } from "next/cache";
import { and, eq, sql } from "drizzle-orm";
import { requireAdmin } from "@/lib/admin";
import { db } from "@/lib/db";
import { userPosts } from "@/lib/schema";

/**
 * Moderasyon eylemleri — /admin/moderasyon. Her eylemin İLK SATIRI
 * requireAdmin: sunucu eylemleri kendi uç noktaları, sayfanın kapısına
 * güvenilmez (app/actions/content.ts kuralı). Yetki token'dan değil
 * veritabanından doğrulanır (lib/admin.ts).
 *
 * Onay `publishedAt`i yalnızca İLK yayında yazar: düzeltme turu yayın
 * tarihini değiştirmez (content-write'ın "düzeltme künyeyi ezmez" kuralı).
 */

export async function approvePostAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const seen = String(formData.get("seen") ?? "");
  if (!id || !seen) return;
  const seenAt = new Date(seen);
  if (Number.isNaN(seenAt.getTime())) return;
  let slug: string | null = null;
  try {
    /* ONAY, OKUNAN SÜRÜME: yazar onay kuyruğundayken metni değiştirebilir
       (kaydetme pending'de içerik günceller). `updated_at` ekrandaki hâlin
       damgası — eşleşmiyorsa hiçbir satır güncellenmez ve moderatör
       yenileyip YENİ metni okur (15 Ekim incelemesi, TOCTOU). */
    const [row] = await db
      .update(userPosts)
      .set({
        status: "published",
        reviewNote: null,
        /* İlk yayında damgalanır; düzeltme turunun onayı tarihi ezmez. */
        publishedAt: sql`coalesce(${userPosts.publishedAt}, now())`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(userPosts.id, id),
          eq(userPosts.status, "pending"),
          eq(userPosts.updatedAt, seenAt),
        ),
      )
      .returning({ slug: userPosts.slug });
    if (!row) return;
    slug = row.slug;
  } catch {
    return;
  }
  revalidatePath("/topluluk");
  if (slug) revalidatePath(`/topluluk/${slug}`);
  revalidatePath("/yazilarim");
  revalidatePath("/admin/moderasyon");
}

export async function rejectPostAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const note = String(formData.get("note") ?? "").trim().slice(0, 500);
  /* Gerekçesiz red yok: yazar neyi düzelteceğini bilmeli. */
  if (!id || !note) return;
  try {
    await db
      .update(userPosts)
      .set({ status: "rejected", reviewNote: note, updatedAt: new Date() })
      .where(and(eq(userPosts.id, id), eq(userPosts.status, "pending")));
  } catch {
    return;
  }
  revalidatePath("/topluluk");
  revalidatePath("/yazilarim");
  revalidatePath("/admin/moderasyon");
}
