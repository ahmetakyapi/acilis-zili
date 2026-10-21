"use server";

import { refresh } from "next/cache";
import { auth } from "@/auth";
import { markAllRead } from "@/lib/notifications";
import { rateLimit } from "@/lib/rate-limit";

/**
 * Gelen kutusunu okundu sayar. /bildirimler açılınca istemci bir kez
 * çağırır (GET'te yan etki yok — sayfa çizimi veriyi değiştirmez); düğme
 * de aynı eylem. Başlıktaki zilin sayısı her sayfanın düzeninde duruyor.
 *
 * `refresh()`, `revalidatePath("/", "layout")` DEĞİL (20 Ekim). Düzen
 * katmanı tazelemesi `_N_T_/layout` imini düşürüyordu; o im her sayfanın ve
 * her route handler'ın yumuşak imi, yani sunucudaki BÜTÜN `fetch` ve
 * `unstable_cache` girdileri (sağlayıcı yanıtları, sembol tablosu, ücretli
 * Claude notları) bir sonraki okumada ıskalıyordu — okunmamış bildirimi olan
 * her okuyucu /bildirimler'i açınca. Zilin sayısı da avatar da istek içi
 * okumalar, düzen dinamik: gereken yalnız istemci yönlendiricisinin yeniden
 * çizimi. `refresh()` tam bunu yapıyor, önbelleğe dokunmuyor. Hiçbir satır
 * değişmediyse tazeleme de yok.
 */
export async function markInboxReadAction(): Promise<void> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return;
  if (!rateLimit(`inbox:${userId}`, 20, 60_000).allowed) return;
  if ((await markAllRead(userId)) > 0) refresh();
}
