"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin";
import { db } from "@/lib/db";
import { riskAccess, users } from "@/lib/schema";

/**
 * Risk Masası erişimi (25 Ekim) — yalnız yönetici açar ve kapatır.
 * `requireAdmin` rolü veritabanından doğrular; zod kullanıcı adını ve
 * kimliği süzer. Yöneticinin kendisi zaten her zaman erişir, satır
 * açılmaz. Tablo yokken (migration uygulanmadı) eylem bunu söyler.
 */

export type RiskAccessState = { ok: boolean; message: string };

const Username = z.string().trim().min(2).max(40);

export async function grantRiskAccess(_state: RiskAccessState, form: FormData): Promise<RiskAccessState> {
  const admin = await requireAdmin();
  const name = Username.safeParse(form.get("username"));
  if (!name.success) return { ok: false, message: "Kullanıcı adı geçersiz." };
  try {
    const [user] = await db.select({ id: users.id, role: users.role, username: users.username }).from(users).where(eq(users.username, name.data)).limit(1);
    if (!user) return { ok: false, message: "Bu adla bir üye bulunamadı." };
    if (user.role === "admin") return { ok: true, message: `${user.username} yönetici; masaya zaten erişiyor.` };
    await db.insert(riskAccess).values({ userId: user.id, grantedBy: admin.userId }).onConflictDoNothing({ target: riskAccess.userId });
    revalidatePath("/admin/uyeler");
    return { ok: true, message: `${user.username} için Risk Masası açıldı.` };
  } catch {
    return { ok: false, message: "Kaydedilemedi: erişim tablosu henüz kurulmamış olabilir." };
  }
}

export async function revokeRiskAccess(form: FormData): Promise<void> {
  await requireAdmin();
  const id = z.uuid().safeParse(form.get("userId"));
  if (!id.success) return;
  try {
    await db.delete(riskAccess).where(eq(riskAccess.userId, id.data));
  } catch {
    return;
  }
  revalidatePath("/admin/uyeler");
}
