import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getUnreadCount } from "@/lib/notifications";
import { rateLimit } from "@/lib/rate-limit";

/**
 * Başlıktaki zilin okunmamış sayısı (16 Ekim) — components/notifications/
 * NotificationBell.tsx görünürlük değişince, sayfa değişince ve beş dakikada
 * bir sorar. Sayı yalnız düzende hesaplanıyordu ve App Router düzeni
 * gezinmede yeniden çizmiyor: yarım saat dolaşan okuyucu o arada tetiklenen
 * alarmı zilde hiç görmüyordu — push'u açmamış okuyucunun tek işareti bu.
 * Tek COUNT sorgusu; yanıt `/api` başlıklarıyla önbelleksiz (next.config.ts).
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ unread: 0 }, { status: 401 });
  if (!rateLimit(`inbox-count:${userId}`, 30, 60_000).allowed) {
    return NextResponse.json({ error: "rate" }, { status: 429 });
  }
  return NextResponse.json({ unread: await getUnreadCount(userId) });
}
