import type { MetadataRoute } from "next";
import { SITE_URL, INDEXABLE } from "@/lib/site";

/**
 * Arama motoru kuralları.
 *
 * YALNIZCA /api ENGELLİ. Kişisel ekranlar (/ayarlar, /favoriler, /giris,
 * /kayit, /bilancolar/takip) burada da listeliydi ama `Disallow`
 * İNDEKSLEMEYİ ENGELLEMEZ, yalnızca taramayı: bu adresler her sayfadaki
 * gezinmeden bağlantılı olduğu için arama sonuçlarında içeriksiz birer URL
 * kaydı olarak görünebiliyordu. Doğru araç sayfanın kendi `noindex`
 * etiketi ve o etiket ancak sayfa TARANABİLİRSE okunabilir — yani ikisi
 * birlikte çalışmıyor. Engel kaldırıldı, etiket sayfalara kondu.
 *
 * /api'de durum farklı: orada okunacak bir HTML yok, dolayısıyla taşınacak
 * bir etiket de yok; engel doğru araç.
 *
 * TEK İSTİSNA `/api/takvim` (22 Ekim). Takvim dosyası (.ics) her hisse
 * sayfasından ve ekonomik takvimden düz `<a href>` ile bağlı; Search
 * Console bu adreslerden birini "robots.txt tarafından engelleniyor olsa da
 * dizine eklendi" diye raporladı — yukarıdaki tuzağın ta kendisi: engel
 * yüzünden yanıttaki `X-Robots-Tag: noindex` (next.config.ts, bütün /api)
 * hiç okunmuyor. Bu uç yalnız herkese açık bir dosya üretiyor, gizli bir şey
 * taşımıyor; taranabilir kılınca başlık okunuyor ve adres dizinden düşüyor.
 * Bağlantılar ayrıca `rel="nofollow"` taşıyor ki tarama bütçesi yüzlerce
 * .ics'e harcanmasın (`AddToCalendar`, takvim sayfası). Daha uzun kural
 * kazandığı için `Allow` `Disallow: /api/`un önüne geçiyor. Kural `?` ile
 * bitiyor: yalnız sorgulu GET adresi açılır, `/api/takvim/bilanco` ve
 * `/api/takvim/beklenti` (rutinin yazma uçları) kapalı kalır.
 */
export default function robots(): MetadataRoute.Robots {
  if (!INDEXABLE) {
    return { rules: [{ userAgent: "*", disallow: "/" }] };
  }

  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/api/takvim?"],
        disallow: ["/api/"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
