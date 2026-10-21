import { SITE_URL } from "@/lib/site";

/* Olcum ucundan taşındı (28 Eylül): hata toplayıcı `/api/hata` da aynı
   kapıyı kullanıyor ve iki kopya er geç birbirinden ayrı düşerdi. Yorum
   ölçüm ucu için yazıldı; hata ucu için de aynen geçerli. */

/**
 * İstek BU siteden mi geliyor?
 *
 * Uç yetkisiz ve gövdesi tamamen istemciden: başka bir site kendi
 * ziyaretçilerinin tarayıcısından buraya istek yağdırıp panelin sayılarını
 * şişirebilir ya da uydurma yollarla listeyi kirletebilirdi. Tarayıcı
 * `Sec-Fetch-Site` başlığını istemcinin yazması mümkün değil; onu
 * desteklemeyen eski tarayıcılar için `Origin` karşılaştırması yedek.
 *
 * Başlıkların İKİSİ DE yoksa istek geçiyor: `sendBeacon` bazı ortamlarda
 * `Origin` göndermiyor ve ölçümü tamamen kapatmak, kirlenmeye izin
 * vermekten daha kötü bir sonuç.
 *
 * `Origin` TARAYICININ GÖRDÜĞÜ adla karşılaştırılır (20 Ekim taraması).
 * `request.url`le karşılaştırılıyordu; ters vekil arkasında o iç adresi
 * taşıyor (`next start -H 127.0.0.1 -p 3000` → `127.0.0.1:3000`) ve yedek
 * üretimde HİÇ eşleşmiyordu: `Sec-Fetch-Site` göndermeyen eski Safari ve
 * Firefox'un ölçümü, hata bildirimi ve abonelik yenilemesi sessizce
 * düşüyordu. Ad `x-forwarded-host`/`host`tan (Caddy istemcinin adını
 * geçiriyor; olcum'un `selfHost`u da aynı kaynak), kanonik alan adı her
 * zaman kabul. Kapı gevşemiyor: tarayıcıdaki bir sayfa `Origin`i de
 * `Host`u da yazamaz.
 */
export function sameSite(request: Request): boolean {
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite) return fetchSite === "same-origin" || fetchSite === "none";

  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    const originHost = new URL(origin).host;
    const seen = (request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "")
      .split(",")[0]
      .trim();
    return originHost === seen || originHost === new URL(SITE_URL).host;
  } catch {
    return false;
  }
}
