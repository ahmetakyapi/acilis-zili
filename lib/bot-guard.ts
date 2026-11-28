/**
 * AĞIR SAYFALARA IP BAŞINA SINIR (28 Kasım, sahibinin isteği: "bot korumasını
 * açmamıza gerek var mı, mantıklıysa ekle").
 *
 * 26 Kasım'dan beri günde ~44.000 görüntüleme geliyor (önceki günler ~400):
 * hepsi masaüstü, yönlendiricisiz, oturumsuz; ziyaretçi başı sayfa 1,0;
 * hedef `/karsilastir`, `/giris`, `/kayit` ve haber detayları (page_views,
 * 26–27 Kasım: 87.918 satırın 87.918'i). Ziyaret JS'ten bildiriliyor ve
 * bilinen bot kalıpları (`HeadlessChrome` dahil, lib/analytics.ts) zaten
 * eleniyor: bot gerçek bir tarayıcı kimliğiyle ve her istekte başka IP /
 * kimlikle geliyor. Uygulama içinden tam koruma yok; kalıcı çözüm önde bir
 * WAF (sahibinin kararı). Buradaki katman ucuz ve güvenli olanı yapar:
 * - Ağır sayfalara (karşılaştırma: sağlayıcıdan çok sembollü bar; giriş ve
 *   kayıt: kimlik denemesi yüzeyi) tek IP'den `HEAVY_LIMIT_PER_MINUTE`
 *   üstü istek 429 alır. İnsan okuru bu hıza ulaşmaz.
 * - robots.txt sorgulu karşılaştırma ve giriş/kayıt adreslerini taramaya
 *   kapatır (app/robots.ts); saygılı tarayıcılar için.
 * Saf modül; testler tests/bot-guard.test.ts.
 */

export type HeavyKind = "compare" | "auth";

/** Tek IP'den dakikada izin verilen ağır sayfa isteği. */
export const HEAVY_LIMIT_PER_MINUTE = 40;
export const HEAVY_WINDOW_MS = 60_000;

/**
 * Yalnız TAM SAYFA yüklemesi sayılır (28 Kasım, duman testi düştü):
 * her sayfanın gezinme bağlantıları oturumsuz okur için `/giris?devam=…`e
 * gidiyor ve Next onları arka planda önceden yüklüyor (prefetch); sayfa
 * içi gezinme de RSC isteği atıyor. Bunlar sayılınca birkaç sayfa gezen
 * gerçek misafir 429'a düşüyordu. Bot dalgası tam sayfa yüklüyor.
 */
export function isDocumentRequest(headers: { get(name: string): string | null }): boolean {
  if (headers.get("rsc") === "1" || headers.get("next-router-prefetch") !== null) return false;
  const purpose = `${headers.get("purpose") ?? ""} ${headers.get("sec-purpose") ?? ""}`.toLowerCase();
  if (purpose.includes("prefetch")) return false;
  const dest = headers.get("sec-fetch-dest");
  return dest === null || dest === "document";
}

/** Dil öneki atılmış yol ağır sayfaysa türü; değilse null. Küratörlü çift sayfaları (`/karsilastir/nvda-amd`) hafif. */
export function heavyKind(path: string): HeavyKind | null {
  const clean = path.replace(/\/+$/, "") || "/";
  if (clean === "/karsilastir") return "compare";
  if (clean === "/giris" || clean === "/kayit") return "auth";
  return null;
}
