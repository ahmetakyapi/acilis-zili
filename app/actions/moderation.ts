"use server";

import { refresh, revalidatePath } from "next/cache";
import { and, eq, sql } from "drizzle-orm";
import { requireAdmin } from "@/lib/admin";
import { db } from "@/lib/db";
import { userPosts } from "@/lib/schema";
import { getDictionary } from "@/lib/i18n";
import { withLocale } from "@/lib/i18n/routing";
import { notifyUser } from "@/lib/notifications";

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
      .returning({ slug: userPosts.slug, userId: userPosts.userId, title: userPosts.title });
    /* EŞLEŞMEZSE SAYFA TAZELENİR (20 Ekim denetimi). Yalnızca `return`
       vardı: tazeleme ya da yönlendirme yapmayan eylem sayfayı yeniden
       çizdirmiyor, eski metin ekranda kalıyor ve her yeni tık sessizce
       boşa düşüyordu — "sayfa yenilenip yeniden okunur" sözü tutmuyordu. */
    if (!row) {
      refresh();
      return;
    }
    slug = row.slug;
    /* Yazar sonucu /yazilarim'a girmeden öğrensin — zil + push. Bildirim
       düşerse onay yazıldı ve sayfalar yine tazelenmeli (20 Ekim). */
    await notifyUser(
      row.userId,
      "post_approved",
      (locale) => {
        const t = getDictionary(locale).inbox;
        /* Başlık İŞLEVLE yerleşir (20 Ekim): dize olarak verilince
           `replace` içindeki `$'`/`$&` kalıplarını açıyordu ve "Altın
           4000$'ı aştı" bildirimde paramparça görünüyordu. */
        return { title: t.approvedTitle, body: t.approvedBody.replace("{title}", () => row.title), path: `/topluluk/${row.slug}`, tag: `post-${id}` };
      },
      withLocale,
    ).catch(() => 0);
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
  const seen = String(formData.get("seen") ?? "");
  /* Gerekçesiz red yok: yazar neyi düzelteceğini bilmeli. */
  if (!id || !note || !seen) return;
  const seenAt = new Date(seen);
  if (Number.isNaN(seenAt.getTime())) return;
  try {
    /* RED DE OKUNAN SÜRÜME (20 Ekim denetimi) — onaydaki damga denetiminin
       aynısı. Yalnız kimlik ve durum aranıyordu: yazar metni düzeltirken
       verilen red, A sürümü için yazılmış notu kimsenin okumadığı B
       sürümüne iliştiriyordu. Eşleşmezse yazılmaz, sayfa tazelenir. */
    const rejected = await db
      .update(userPosts)
      .set({ status: "rejected", reviewNote: note, updatedAt: new Date() })
      .where(
        and(
          eq(userPosts.id, id),
          eq(userPosts.status, "pending"),
          eq(userPosts.updatedAt, seenAt),
        ),
      )
      .returning({ userId: userPosts.userId, title: userPosts.title });
    const row = rejected[0];
    if (!row) {
      refresh();
      return;
    }
    await notifyUser(
      row.userId,
      "post_rejected",
      (locale) => {
        const t = getDictionary(locale).inbox;
        return { title: t.rejectedTitle, body: t.rejectedBody.replace("{title}", () => row.title), path: `/yazilarim/${id}`, tag: `post-${id}` };
      },
      withLocale,
    ).catch(() => 0);
  } catch {
    return;
  }
  revalidatePath("/topluluk");
  revalidatePath("/yazilarim");
  revalidatePath("/admin/moderasyon");
}
