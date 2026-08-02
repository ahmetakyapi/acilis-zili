import { timingSafeEqual } from "node:crypto";

/**
 * Bearer belirteci doğrulama — yetki isteyen bütün uçların tek kapısı.
 *
 * İki şeyi düzeltiyor:
 *
 * 1. ZAMAN SIZINTISI. `a === b` ilk farklı karakterde döner, yani karşılaştırma
 *    süresi doğru ön ekin uzunluğunu ele verir. Uzaktan ölçülmesi zordur ama
 *    imkânsız değildir ve doğrusunu yazmanın maliyeti bir satır.
 *
 * 2. AÇIK KALMA. `/api/cron/daily` şöyle yazılmıştı:
 *        if (secret && auth !== `Bearer ${secret}`) → 401
 *    CRON_SECRET tanımsızsa koşul hiç çalışmıyor ve uç HERKESE AÇIK oluyordu.
 *    O uç sağlayıcılardan veri çekip veritabanına yazıyor; açık bırakılması
 *    hem kota tüketimi hem yazma yüzeyi demek. Artık üretimde anahtar yoksa
 *    istek reddediliyor — yanlış yapılandırma, sessiz bir açık kapıya değil
 *    görünür bir hataya dönüşüyor.
 */

/** Sabit süreli karşılaştırma. Uzunluk farkı zaten sızıntı değil. */
function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export type AuthOutcome =
  | { ok: true }
  | { ok: false; status: 401 | 503; error: string };

export function checkBearer(
  request: Request,
  secret: string | undefined,
): AuthOutcome {
  if (!secret) {
    // Geliştirmede anahtarsız çalışmak rahatlık; üretimde açık kapı.
    if (process.env.NODE_ENV !== "production") return { ok: true };
    return { ok: false, status: 503, error: "secret-not-configured" };
  }

  const header = request.headers.get("authorization") ?? "";
  if (!header.startsWith("Bearer ")) {
    return { ok: false, status: 401, error: "unauthorized" };
  }

  return safeEqual(header.slice(7), secret)
    ? { ok: true }
    : { ok: false, status: 401, error: "unauthorized" };
}
