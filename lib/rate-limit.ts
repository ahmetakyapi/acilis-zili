/**
 * Basit oran sınırlayıcı — sabit pencere, süreç belleğinde.
 *
 * NE OLMADIĞI konusunda dürüst olalım: bu bir dağıtık sınırlayıcı değil.
 * Vercel'de her sunucusuz örneğin kendi belleği var, yani gerçek sınır
 * "örnek sayısı × limit" kadar. Kararlı bir saldırganı durdurmaz.
 *
 * NE OLDUĞU: sağlayıcı kotasını tüketen kazara döngülerin, basit betiklerin
 * ve tek kaynaklı gürültünün önünde ucuz bir set. Redis bağımlılığı
 * eklemeden alınabilecek en iyi sonuç bu; ihtiyaç büyürse Upstash gibi bir
 * katmana geçmek tek dosyalık bir değişiklik.
 *
 * Bellek sızıntısı yok: her temizlik turunda süresi geçmiş kayıtlar
 * siliniyor ve tablo sert bir üst sınırda tutuluyor.
 */

import { headers } from "next/headers";

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

/** Tablo bu boyutu aşarsa en eskiler atılır — bellek sınırsız büyümesin. */
const MAX_KEYS = 10_000;

function sweep(now: number) {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
  if (buckets.size > MAX_KEYS) {
    const excess = buckets.size - MAX_KEYS;
    let removed = 0;
    for (const key of buckets.keys()) {
      buckets.delete(key);
      if (++removed >= excess) break;
    }
  }
}

/**
 * Giriş ve kayıt sınırları.
 *
 * Burada duruyorlar çünkü İKİ yerden okunuyorlar: form akışı
 * (`app/actions/auth.ts`) ve `authorize()` kapısı (`auth.ts`). Sayaç ikisinde
 * de aynı olmak zorunda — ayrı sabitler er geç birbirinden ayrı düşerdi.
 */
export const SIGN_IN_LIMIT = 10;
export const SIGN_UP_LIMIT = 5;
export const AUTH_WINDOW_MS = 10 * 60_000;

export type RateLimitResult = {
  allowed: boolean;
  /** Pencerede kalan hak. */
  remaining: number;
  /** Sınır aşıldıysa kaç saniye sonra tekrar denenebilir. */
  retryAfter: number;
};

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now();
  if (Math.random() < 0.02) sweep(now);

  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, retryAfter: 0 };
  }

  existing.count += 1;
  if (existing.count > limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfter: Math.ceil((existing.resetAt - now) / 1000),
    };
  }

  return { allowed: true, remaining: limit - existing.count, retryAfter: 0 };
}

/**
 * Sayacı ARTIRMADAN durumu okur.
 *
 * Giriş formu için var. Sayaç tek yerde tutuluyor (`authorize()` kapısında)
 * ama form, kullanıcıya "çok fazla deneme yaptın" diye doğru mesajı
 * gösterebilmek için o sayacı BİLMEK zorunda. Artırarak okusaydı her giriş
 * denemesi iki hak yiyecek ve sınır yarıya inecekti.
 */
export function peekRateLimit(key: string, limit: number): RateLimitResult {
  const now = Date.now();
  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    return { allowed: true, remaining: limit, retryAfter: 0 };
  }
  if (existing.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfter: Math.ceil((existing.resetAt - now) / 1000),
    };
  }
  return { allowed: true, remaining: limit - existing.count, retryAfter: 0 };
}

/**
 * İstemci kimliği.
 *
 * Vercel `x-forwarded-for` başlığını kendisi yazar ve istemcinin gönderdiği
 * değeri ezer, yani bu ortamda güvenilir. Başka bir yerde çalışıyorsa en
 * kötü ihtimalle sınır paylaşılır — sahte bir güvenlik iddiası yok.
 */
export function clientKey(request: Request, scope: string): string {
  return `${scope}:${ipFrom(request.headers.get("x-forwarded-for"))}`;
}

/**
 * Aynı kimlik, elinde `Request` olmayan yerler için: sayfalar ve server
 * action'lar. Üçüncü bir yerde daha aynı üç satırı yazmamak için burada.
 */
export async function requestKey(scope: string): Promise<string> {
  const store = await headers();
  return `${scope}:${ipFrom(store.get("x-forwarded-for"))}`;
}

function ipFrom(forwarded: string | null): string {
  return forwarded?.split(",")[0]?.trim() || "bilinmeyen";
}
