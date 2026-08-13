import { createHash } from "node:crypto";
import { db } from "./db";
import { pageViews } from "./schema";
import { todayEt } from "./market-hours";

/**
 * Birinci taraf sayfa ölçümü.
 *
 * Toplanan tek şey "hangi sayfa, ne zaman, hangi dilde, nereden gelindi".
 * IP adresi ve tarayıcı künyesi hiçbir sütuna yazılmaz; ikisi de yalnızca
 * günlük dönen özetin GİRDİSİ olarak kullanılır ve özet geri döndürülemez.
 * Ayrıntı `lib/schema.ts` içindeki `pageViews` yorumunda.
 */

/* --------------------------------------------------------------------------
   Rota şablonu
   -------------------------------------------------------------------------- */

/**
 * "/hisse/AAPL" → "/hisse/[symbol]".
 *
 * Ham yol da saklanıyor (hangi hisse okundu sorusu onunla cevaplanıyor) ama
 * "en çok okunan bölüm" sorusu şablon olmadan cevaplanamıyor: 600 ayrı hisse
 * sayfası tek tek sayıldığında hiçbiri listeye giremiyor, oysa toplamı ana
 * sayfayı geçebilir.
 *
 * Sıra ÖNEMLİ: uzun desen önce denenir. "/bilancolar/analizler" sabit bir
 * sayfa, "/bilancolar/AAPL/2026Q2" ise dinamik — kısa desen önce eşleşseydi
 * ikisi karışırdı.
 */
const ROUTE_PATTERNS: [RegExp, string][] = [
  [/^\/bilancolar\/(analizler|takip)$/, "/bilancolar/$1"],
  [/^\/bilancolar\/[^/]+\/[^/]+$/, "/bilancolar/[symbol]/[period]"],
  [/^\/hisse\/[^/]+$/, "/hisse/[symbol]"],
  [/^\/mercek\/[^/]+$/, "/mercek/[slug]"],
  [/^\/rehber\/[^/]+$/, "/rehber/[slug]"],
  [/^\/haberler\/[^/]+$/, "/haberler/[id]"],
];

export function routeTemplate(path: string): string {
  for (const [pattern, template] of ROUTE_PATTERNS) {
    if (pattern.test(path)) return path.replace(pattern, template);
  }
  return path;
}

/* --------------------------------------------------------------------------
   Ziyaretçi özeti
   -------------------------------------------------------------------------- */

/**
 * Tuz. `AUTH_SECRET` next-auth'un zaten üretimde şart koştuğu değer, yani
 * ayrı bir env değişkeni eklemeden gerçek bir sır elde ediliyor.
 * `ANALYTICS_SALT` tanımlıysa o kazanır — ölçüm tuzunu oturum sırrından
 * ayırmak isteyen kurulum için.
 *
 * Yerelde ikisi de boş olabilir; o zaman sabit bir geliştirme dizesi
 * kullanılır. Üretimde bu dala düşülmez ve düşülse bile özet yine
 * geri döndürülemez — yalnızca tahmin edilebilir olur.
 */
function salt(): string {
  return (
    process.env.ANALYTICS_SALT ||
    process.env.AUTH_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    "gelistirme-tuzu"
  );
}

/**
 * Aynı ziyaretçi gün içinde aynı özeti üretir, ertesi gün başkasını.
 * Tarih girdide olduğu için tuz değişmese bile özet her gün döner.
 */
export function visitorHash(
  ip: string,
  userAgent: string,
  dayEt: string,
): string {
  return createHash("sha256")
    .update(`${ip}|${userAgent}|${dayEt}|${salt()}`)
    .digest("hex")
    .slice(0, 16);
}

/* --------------------------------------------------------------------------
   Cihaz ve yönlendiren
   -------------------------------------------------------------------------- */

export type Device = "mobile" | "tablet" | "desktop";

/** Tarayıcı künyesinden yalnızca üç değerden biri türetilir, metin saklanmaz. */
export function deviceOf(userAgent: string): Device {
  const ua = userAgent.toLowerCase();
  if (/ipad|tablet|playbook|silk|(android(?!.*mobile))/.test(ua)) return "tablet";
  if (/mobi|iphone|ipod|android|blackberry|iemobile|opera mini/.test(ua)) {
    return "mobile";
  }
  return "desktop";
}

/**
 * Yalnızca alan adı kalır: yol ve sorgu dizesi atılır.
 * Arama terimleri ve özel bağlantı kimlikleri yönlendiren adresin O
 * kısmında taşınıyor — saklamak istemediğimiz tam olarak orası.
 * Site içi gezinme null döner; kendi kendimizin kaynağı değiliz.
 */
export function referrerHostOf(
  referrer: string | null,
  selfHost: string | null,
): string | null {
  if (!referrer) return null;
  try {
    const host = new URL(referrer).hostname.replace(/^www\./, "");
    if (!host) return null;
    if (selfHost && host === selfHost.replace(/^www\./, "")) return null;
    return host.slice(0, 120);
  } catch {
    return null;
  }
}

/* --------------------------------------------------------------------------
   Bot elemesi
   -------------------------------------------------------------------------- */

/**
 * Tarama botları sayılmaz. Liste tam değil ve olamaz — amaç mükemmel
 * filtreleme değil, panelin "1.200 ziyaret" derken 900'ünün Googlebot
 * olmadığından emin olmak. Kendini gizleyen bir botu yakalamaya çalışmıyoruz.
 */
const BOT_PATTERN =
  /bot|crawl|spider|slurp|bingpreview|facebookexternalhit|embedly|quora link preview|pinterest|vercel-screenshot|lighthouse|headlesschrome|monitoring|uptime|curl|wget|python-requests|axios|go-http-client|node-fetch/i;

export function isBot(userAgent: string): boolean {
  return !userAgent || BOT_PATTERN.test(userAgent);
}

/* --------------------------------------------------------------------------
   Yazma
   -------------------------------------------------------------------------- */

export type ViewInput = {
  path: string;
  referrer: string | null;
  locale: string;
  signedIn: boolean;
  ip: string;
  userAgent: string;
  selfHost: string | null;
};

/**
 * Bir görüntülemeyi yazar. Hata YUTULUR ve `false` döner: ölçümün
 * başarısızlığı okuyucunun sayfasını etkilememeli, ve bu uç zaten
 * kullanıcıya hiçbir şey göstermiyor.
 */
export async function recordPageView(input: ViewInput): Promise<boolean> {
  if (isBot(input.userAgent)) return false;

  const day = todayEt();
  const path = normalizePath(input.path);
  if (!path) return false;

  try {
    await db.insert(pageViews).values({
      path,
      route: routeTemplate(path),
      locale: input.locale === "en" ? "en" : "tr",
      referrerHost: referrerHostOf(input.referrer, input.selfHost),
      device: deviceOf(input.userAgent),
      signedIn: input.signedIn,
      visitorHash: visitorHash(input.ip, input.userAgent, day),
      viewedOn: day,
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Yolu temizler: sorgu dizesi ve çapa atılır, sondaki eğik çizgi düşer,
 * uzunluk sınırlanır. İstemciden gelen her şey gibi bu da güvenilmez veri —
 * doğrudan tabloya yazılmaz.
 */
export function normalizePath(raw: string): string | null {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return null;
  const clean = raw.split(/[?#]/)[0].replace(/\/+$/, "") || "/";
  if (clean.length > 200) return null;
  /* Yol yalnızca URL'de geçerli karakterlerden oluşsun; panelde ham metin
     olarak basılıyor ve garip girdi oraya kadar gitmesin. */
  if (!/^\/[\w\-./%[\]]*$/.test(clean)) return null;
  return clean;
}
