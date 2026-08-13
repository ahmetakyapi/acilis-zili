import { config } from "dotenv";

config({ path: ".env.local" });

/**
 * Bir kullanıcıyı yönetici yapar ya da yetkisini geri alır.
 *
 *   npx tsx scripts/make-admin.mts ahmet
 *   npx tsx scripts/make-admin.mts ahmet --kaldir
 *
 * NEDEN ARAYÜZDE DEĞİL: yetki yükseltmeyi bir ekrana koymak, o ekranın
 * kendisini korumak zorunda olduğun ikinci bir kapı açar — ve ilk yöneticiyi
 * kim yapacak sorusu zaten arayüzle cevaplanamıyor. Yılda birkaç kez
 * çalıştırılan bir işlem için doğru yer komut satırı.
 *
 * Betik `DATABASE_URL` okur; üretim veritabanına koşturmak için o değişkeni
 * üretim değeriyle geçmek yeterli.
 */

const [username, ...flags] = process.argv.slice(2);
const remove = flags.includes("--kaldir") || flags.includes("--remove");

if (!username) {
  console.error("Kullanım: npx tsx scripts/make-admin.mts <kullanıcıadı> [--kaldir]");
  process.exit(1);
}

const { db } = await import("../lib/db");
const { users } = await import("../lib/schema");
const { eq } = await import("drizzle-orm");

const key = username.trim().toLowerCase();
const role = remove ? "user" : "admin";

const updated = await db
  .update(users)
  .set({ role })
  .where(eq(users.username, key))
  .returning({ username: users.username, role: users.role });

if (updated.length === 0) {
  console.error(`Kullanıcı bulunamadı: ${key}`);
  process.exit(1);
}

console.log(`${updated[0].username} → ${updated[0].role}`);
console.log(
  remove
    ? "Yetki alındı. Kullanıcının açık oturumu bir gün içinde yenilenene kadar menüde bağlantı görebilir; /admin yine de 404 döner — kapıyı tutan kontrol veritabanına bakıyor."
    : "Yetki verildi. Kullanıcının ÇIKIP TEKRAR GİRMESİ gerekiyor: rol oturum token'ına giriş anında yazılıyor.",
);
process.exit(0);
