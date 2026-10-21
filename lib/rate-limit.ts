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
    /* Taşmada EKLEME SIRASINA göre değil, süresi EN YAKIN dolanlardan
       silinir (15 Ekim). Eski hâli Map sırasıyla siliyordu: dakikada on
       binlerce tek kullanımlık anahtar üreten biri, henüz DOLU bir giriş
       sayacını tablodan düşürüp sınırı sıfırlatabiliyordu. Süresine en az
       kalan kayıt, kaybı en ucuz olandır. */
    const excess = buckets.size - MAX_KEYS;
    const byExpiry = [...buckets.entries()].sort((a, b) => a[1].resetAt - b[1].resetAt);
    for (let i = 0; i < excess; i++) buckets.delete(byExpiry[i][0]);
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

/**
 * Hesap silmede şifre denemesi — kullanıcı başına.
 *
 * Giriş sınırından dar: kendi hesabını silen biri şifresini bilir, beş
 * deneme fazlasıyla yeter. Sayaç IP'ye değil kullanıcıya bağlı; uç zaten
 * oturum istiyor ve IP değiştirmek kaçış yolu olmamalı.
 */
export const DELETE_ACCOUNT_LIMIT = 5;
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
 * Sayaçtan bir hak GERİ verir (20 Ekim) — `rateLimit`in aldığı hak işe
 * yaramadıysa. Claude bütçesi için var (lib/claude-budget.ts → `refundCall`):
 * sunucunun reddettiği, ücretlenmeyen çağrı istemcinin günlük payından da
 * düşmesin. Süresi dolmuş ya da boş kovaya dokunmaz.
 */
export function refundRateLimit(key: string): void {
  const bucket = buckets.get(key);
  if (bucket && bucket.resetAt > Date.now() && bucket.count > 0) bucket.count -= 1;
}

/**
 * İstemci kimliği.
 *
 * Vercel `x-forwarded-for` başlığını kendisi yazar ve istemcinin gönderdiği
 * değeri ezer, yani bu ortamda güvenilir. Başka bir yerde çalışıyorsa en
 * kötü ihtimalle sınır paylaşılır — sahte bir güvenlik iddiası yok.
 */
export function clientKey(request: Request, scope: string): string {
  return forwardedKey(scope, request.headers.get("x-forwarded-for"));
}

/**
 * Aynı kimlik, elinde `Request` olmayan yerler için: sayfalar ve server
 * action'lar. Üçüncü bir yerde daha aynı üç satırı yazmamak için burada.
 */
export async function requestKey(scope: string): Promise<string> {
  const store = await headers();
  return forwardedKey(scope, store.get("x-forwarded-for"));
}

/**
 * Anahtarın TEK kurucusu — ham `x-forwarded-for` değerinden. Dışa açık
 * (20 Ekim): giriş sayacı (`auth.ts` → `signInKey`) anahtarı kendisi
 * kuruyordu ve aşağıdaki IPv6 /64 indirgemesini atlıyordu. Sayacın tek
 * arttığı yer orası olduğu için IPv6'da kova yine adres başınaydı, form da
 * hiç artmayan /64 kovasını okuyup "çok fazla deneme" yerine "şifre
 * hatalı" diyordu.
 */
export function forwardedKey(scope: string, forwarded: string | null): string {
  return `${scope}:${ipFrom(forwarded)}`;
}

function ipFrom(forwarded: string | null): string {
  const ip = forwarded?.split(",")[0]?.trim() || "";
  if (!ip) return "bilinmeyen";
  /* IPv6 /64'E İNDİRİLİR (15 Ekim). Sıradan bir IPv6 aboneliği /64 = 2^64
     adres verir; tam adres anahtar olunca her istekte yeni adresle sınırsız
     kova açılıyor, SIGN_IN_LIMIT fiilen kalkıyordu. /64 bir abonenin tipik
     tahsisi — aynı ev/sunucu tek sayaçta toplanır, komşu aboneler ayrışır.
     IPv4 (ve "::ffff:1.2.3.4" gibi IPv4 gömülü adresler — nokta içerir)
     olduğu gibi kalır; "::" sıkıştırması ilk dört grup sayılabilsin diye
     sıfırlarla açılır, yoksa "2a01:db8::5" ile "::6" ayrı kova olurdu. */
  if (!ip.includes(":") || ip.includes(".")) return ip;
  const [head, tail = ""] = ip.split("::");
  const headGroups = head ? head.split(":") : [];
  if (!ip.includes("::")) return headGroups.slice(0, 4).join(":");
  const tailGroups = tail ? tail.split(":") : [];
  const missing = Math.max(8 - headGroups.length - tailGroups.length, 0);
  return [...headGroups, ...Array<string>(missing).fill("0"), ...tailGroups]
    .slice(0, 4)
    .join(":");
}
