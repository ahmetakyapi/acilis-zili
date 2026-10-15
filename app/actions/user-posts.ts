"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, sql } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { userPosts } from "@/lib/schema";
import {
  MAX_USER_POSTS,
  postInputSchema,
  postSlug,
  type PostStatus,
} from "@/lib/user-posts";
import { getLocale } from "@/lib/i18n";
import { isValidSymbol } from "@/lib/utils";

/**
 * Kullanıcı yazısı eylemleri — gerekçe lib/schema.ts → userPosts.
 *
 * Durum makinesi KAYDETTE şöyle döner (karar şemada):
 * - yeni yazı → draft;
 * - draft → draft, pending → pending (içerik güncellenir, sıra kaybolmaz);
 * - published → PENDING'e geri düşer: herkese açık içerik her an
 *   "onaylanmış son hâl" olmalı, onaysız fark yayında duramaz;
 * - rejected → draft (düzeltilen yazı yeniden gönderilmeden kuyruğa girmez)
 *   ve red notu temizlenir.
 *
 * Kimlik HEP oturumdan; her yazma `userId` koşuluyla — başkasının yazısına
 * verilen id sessizce 0 satır günceller.
 */

export type PostActionState = {
  status: "idle" | "ok" | "error";
  error?: "auth" | "input" | "limit" | "unavailable" | "notFound";
  /** Alan bazlı hata — kutuyu işaretlemek için. */
  field?: "title" | "dek" | "body" | "symbols";
  at: number;
};

function revalidatePost(slug: string | null) {
  revalidatePath("/yazilarim");
  revalidatePath("/topluluk");
  if (slug) revalidatePath(`/topluluk/${slug}`);
}

/** Virgülle ayrılmış sembol listesi; bilinmeyen biçim hata. */
function parseSymbols(raw: string): string[] | null {
  const items = raw
    .split(",")
    .map((item) => item.trim().toUpperCase())
    .filter(Boolean);
  if (items.length > 12) return null;
  for (const item of items) if (!isValidSymbol(item)) return null;
  return [...new Set(items)];
}

export async function savePostAction(
  _prev: PostActionState,
  formData: FormData,
): Promise<PostActionState> {
  const at = Date.now();
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { status: "error", error: "auth", at };

  if (!rateLimit(`posts:${userId}`, 20, 60_000).allowed)
    return { status: "error", error: "unavailable", at };

  const symbols = parseSymbols(String(formData.get("symbols") ?? ""));
  if (symbols === null) return { status: "error", error: "input", field: "symbols", at };
  const parsed = postInputSchema.safeParse({
    title: String(formData.get("title") ?? ""),
    dek: String(formData.get("dek") ?? ""),
    body_md: String(formData.get("body") ?? ""),
    symbols,
  });
  if (!parsed.success) {
    const first = parsed.error.issues[0]?.path[0];
    const field = first === "title" ? "title" : first === "dek" ? "dek" : first === "body_md" ? "body" : undefined;
    return { status: "error", error: "input", field, at };
  }
  const input = parsed.data;
  const id = String(formData.get("id") ?? "");
  const now = new Date();

  try {
    if (!id) {
      const [{ total }] = await db
        .select({ total: sql<number>`count(*)::int` })
        .from(userPosts)
        .where(eq(userPosts.userId, userId));
      if (total >= MAX_USER_POSTS) return { status: "error", error: "limit", at };

      /* Çakışma eki kriptografik rastgele: iki "NVDA Üzerine" yazısı aynı
         saniyede gelse de slug çakışmaz; çakışırsa unique index yakalar ve
         okuyucu bir kez daha dener. */
      const suffix = randomBytes(3).toString("hex");
      const slug = postSlug(input.title, suffix);
      /* Yazının dili arayüzün o anki dili: İngilizce arayüzde yazan birinin
         yazısı en kaydıyla açılır (lang/hreflang doğru çıkar). */
      const locale = await getLocale();
      const [row] = await db
        .insert(userPosts)
        .values({
          userId,
          slug,
          locale,
          title: input.title,
          dek: input.dek,
          bodyMd: input.body_md,
          symbols: input.symbols ?? [],
          status: "draft",
        })
        .returning({ id: userPosts.id });
      revalidatePost(null);
      redirect(`/yazilarim/${row.id}`);
    }

    const [current] = await db
      .select({
        status: userPosts.status,
        slug: userPosts.slug,
        title: userPosts.title,
        dek: userPosts.dek,
        bodyMd: userPosts.bodyMd,
        symbols: userPosts.symbols,
      })
      .from(userPosts)
      .where(and(eq(userPosts.id, id), eq(userPosts.userId, userId)))
      .limit(1);
    if (!current) return { status: "error", error: "notFound", at };

    /* DEĞİŞMEYEN KAYIT YAZILMAZ — yayındaki yazıda Enter'a takılan bir
       kaydetme, içerik aynıyken yazıyı yayından düşürüyordu (15 Ekim
       incelemesi). Kıyas sunucunun yazacağı normalize hâlle. */
    const sameSymbols =
      JSON.stringify(input.symbols ?? []) ===
      JSON.stringify(Array.isArray(current.symbols) ? current.symbols : []);
    if (
      current.title === input.title &&
      current.dek === input.dek &&
      current.bodyMd === input.body_md &&
      sameSymbols
    ) {
      return { status: "ok", at };
    }

    const nextStatus: PostStatus =
      current.status === "published"
        ? "pending"
        : current.status === "rejected"
          ? "draft"
          : (current.status as PostStatus);

    await db
      .update(userPosts)
      .set({
        title: input.title,
        dek: input.dek,
        bodyMd: input.body_md,
        symbols: input.symbols ?? [],
        status: nextStatus,
        /* Yayından pending'e dönüş kuyruğa şimdi girer; red notu düzeltmeyle
           temizlenir — eski gerekçe yeni metni anlatmıyor. */
        submittedAt: current.status === "published" ? now : undefined,
        reviewNote: current.status === "rejected" ? null : undefined,
        updatedAt: now,
      })
      .where(and(eq(userPosts.id, id), eq(userPosts.userId, userId)));
    revalidatePost(current.slug);
    return { status: "ok", at };
  } catch (error) {
    /* redirect() fırlatışı hata değil — Next'e geri verilmeli. */
    if (error && typeof error === "object" && "digest" in error) throw error;
    return { status: "error", error: "unavailable", at };
  }
}

/** Taslağı (ya da düzeltilmiş reddi) moderasyon kuyruğuna gönderir. */
export async function submitPostAction(formData: FormData) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return;
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  if (!rateLimit(`posts:${userId}`, 20, 60_000).allowed) return;
  try {
    await db
      .update(userPosts)
      .set({ status: "pending", submittedAt: new Date(), reviewNote: null, updatedAt: new Date() })
      .where(
        and(
          eq(userPosts.id, id),
          eq(userPosts.userId, userId),
          sql`${userPosts.status} in ('draft', 'rejected')`,
        ),
      );
  } catch {
    return;
  }
  revalidatePath("/yazilarim");
  revalidatePath(`/yazilarim/${id}`);
}

/** Kuyruktaki yazıyı geri çeker — taslağa döner. */
export async function withdrawPostAction(formData: FormData) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return;
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  if (!rateLimit(`posts:${userId}`, 20, 60_000).allowed) return;
  try {
    await db
      .update(userPosts)
      .set({ status: "draft", updatedAt: new Date() })
      .where(and(eq(userPosts.id, id), eq(userPosts.userId, userId), eq(userPosts.status, "pending")));
  } catch {
    return;
  }
  revalidatePath("/yazilarim");
  revalidatePath(`/yazilarim/${id}`);
}

/** Yazıyı siler — yayındaysa adresi de düşer ("sildim" demek silmek demek). */
export async function deletePostAction(formData: FormData) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return;
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  if (!rateLimit(`posts:${userId}`, 20, 60_000).allowed) return;
  try {
    const [row] = await db
      .delete(userPosts)
      .where(and(eq(userPosts.id, id), eq(userPosts.userId, userId)))
      .returning({ slug: userPosts.slug });
    if (row) revalidatePost(row.slug);
  } catch {
    return;
  }
  redirect("/yazilarim");
}
