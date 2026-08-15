import { cache } from "react";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "./db";
import { users } from "./schema";

/**
 * Yönetim ekranının tek kapısı.
 *
 * İKİ AŞAMALI, bilerek. Oturum token'ında da rol var (auth.ts) ama yetki
 * kontrolü ona GÜVENMEZ: token giriş anında yazılıyor ve `updateAge: 1 gün`
 * ile yenileniyor, yani bir hesabın yöneticiliği alındıktan sonra elindeki
 * token bir gün daha "admin" demeye devam edebiliyor. Bir yönetim ekranı için
 * bu pencere kabul edilemez.
 *
 * Token yine de işe yarıyor: kullanıcı giriş yapmamışsa ya da token'ında rol
 * yoksa veritabanına HİÇ gidilmiyor. Sorgu yalnızca "admin olduğunu iddia
 * eden" istekler için koşuyor, yani sayfa başına en fazla bir kez ve yalnızca
 * yönetim ekranlarında.
 */

export type AdminSession = {
  userId: string;
  username: string;
};

/**
 * Yönetici mi — değilse null. Hiçbir yere yönlendirmez, karar çağırana ait.
 *
 * `cache()`: layout ve sayfa aynı istekte ikisi de soruyor (aşağıdaki
 * `requireAdmin` notu), sorgu bir kez koşsun.
 */
export const getAdmin = cache(async function getAdmin(): Promise<AdminSession | null> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return null;

  /* Token "admin" demiyorsa veritabanına bakmaya gerek yok: rol yalnızca
     yükseltmeyle değişir ve yükseltmeden sonra kullanıcı zaten yeniden
     giriş yapıyor. Yanlış yönde hata yapmıyoruz — bu kısayol yetkiyi
     GENİŞLETMİYOR, yalnızca gereksiz sorguyu atlıyor. */
  if (session.user.role !== "admin") return null;

  const [row] = await db
    .select({ id: users.id, username: users.username, role: users.role })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!row || row.role !== "admin") return null;
  return { userId: row.id, username: row.username };
});

/**
 * Kapı — yetkisizi 404'e düşürür.
 *
 * HER SAYFA KENDİ KONTROLÜNÜ YAPAR, layout'a güvenmez. Next App Router'da
 * kardeş rotalar arasında yumuşak gezinmede ORTAK LAYOUT YENİDEN
 * ÇALIŞMIYOR: yalnızca değişen segmentin RSC yükü isteniyor. Yani yetkisi
 * alınmış bir yönetici, elindeki sayfadan öteki sekmelere geçmeye devam
 * edebiliyordu — tam sayfa yenilenene kadar. Kontrolün maliyeti tek bir
 * sorgu ve `cache()` sayesinde istek başına bir kez koşuyor.
 */
export async function requireAdmin(): Promise<AdminSession> {
  const admin = await getAdmin();
  if (!admin) notFound();
  return admin;
}

/** Yönetici mi — yalnızca evet/hayır; menüde bağlantı gösterilecek mi. */
export async function isAdmin(): Promise<boolean> {
  return (await getAdmin()) !== null;
}
