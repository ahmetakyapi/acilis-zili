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
 */
export function sameSite(request: Request): boolean {
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite) return fetchSite === "same-origin" || fetchSite === "none";

  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}
