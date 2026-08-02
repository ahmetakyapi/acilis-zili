import type { MetadataRoute } from "next";
import { SITE_URL, INDEXABLE } from "@/lib/site";

/**
 * Arama motoru kuralları.
 *
 * API uçları ve kişisel ekranlar taranmaz: /api altında zaten yetki isteyen
 * uçlar var ve tarayıcının oraya girmesinin bir faydası yok; /ayarlar ve
 * /favoriler ise oturum gerektiriyor, taranırsa yalnızca giriş sayfasına
 * yönlenir. /giris ve /kayit de arama sonucunda görünmesi anlamsız sayfalar.
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
        disallow: ["/api/", "/ayarlar", "/favoriler", "/giris", "/kayit"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
