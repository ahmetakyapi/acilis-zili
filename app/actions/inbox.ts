"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { markAllRead } from "@/lib/notifications";
import { rateLimit } from "@/lib/rate-limit";

/**
 * Gelen kutusunu okundu sayar. /bildirimler açılınca istemci bir kez
 * çağırır (GET'te yan etki yok — sayfa çizimi veriyi değiştirmez); düğme
 * de aynı eylem. Tazeleme düzen katmanından: başlıktaki zilin sayısı her
 * sayfanın düzeninde duruyor.
 */
export async function markInboxReadAction(): Promise<void> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return;
  if (!rateLimit(`inbox:${userId}`, 20, 60_000).allowed) return;
  await markAllRead(userId);
  revalidatePath("/", "layout");
}
