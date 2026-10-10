"use server";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";
import { aiAnalysisAccess, aiAnalysisAudit, users } from "@/lib/schema";

export type AccessState = { ok: boolean; message: string };
export async function setAnalysisAccess(_state: AccessState, form: FormData): Promise<AccessState> {
  const admin = await requireAdmin();
  const parsed = z.uuid().safeParse(form.get("userId"));
  if (!parsed.success) return { ok: false, message: "Kullanıcı geçersiz." };
  const userId = parsed.data;
  const enabled = form.get("enabled") === "on";
  try {
    const [user] = await db.select({ username: users.username, role: users.role }).from(users).where(eq(users.id, userId)).limit(1);
    if (!user) return { ok: false, message: "Kullanıcı bulunamadı." };
    const owner = user.username === "ahmetakyapi" && user.role === "admin";
    const quota = z.coerce.number().int().min(1).max(1000).safeParse(form.get("dailyLimit"));
    const unlimited = owner || form.get("unlimited") === "on";
    if (!unlimited && !quota.success) return { ok: false, message: "Günlük kota 1–1000 arasında olmalı." };
    const dailyLimit = unlimited ? null : quota.data!;
    // Yetki ve denetim kaydı aynı veritabanı işlemi içinde değişir.
    await db.batch([
      db.insert(aiAnalysisAccess).values({ userId, enabled, dailyLimit, updatedBy: admin.userId }).onConflictDoUpdate({
        target: aiAnalysisAccess.userId, set: { enabled, dailyLimit, updatedBy: admin.userId, updatedAt: new Date() },
      }),
      db.insert(aiAnalysisAudit).values({ userId, adminId: admin.userId, enabled, dailyLimit }),
    ]);
    revalidatePath("/admin/ai");
    return { ok: true, message: `${user.username} için analiz erişimi güncellendi.` };
  } catch { return { ok: false, message: "Değişiklik kaydedilemedi. Biraz sonra tekrar dene." }; }
}
