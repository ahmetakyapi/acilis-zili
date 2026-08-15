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
 */
export default function robots(): MetadataRoute.Robots {
  if (!INDEXABLE) {
    return { rules: [{ userAgent: "*", disallow: "/" }] };
  }

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
