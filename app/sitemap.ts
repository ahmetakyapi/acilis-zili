import type { MetadataRoute } from "next";
import { GUIDE_SLUGS } from "@/content/guide";
import { getStories } from "@/lib/data";
import { SITE_URL } from "@/lib/site";

/**
 * Site haritası.
 *
 * Üç kaynaktan derlenir: durağan ekranlar, depodaki rehber yazıları ve
 * veritabanındaki mercek yazıları. Şirket sayfaları (/hisse/*) bilinçli
 * olarak YOK — beş yüzden fazla sayfa üretirdi, içerikleri neredeyse
 * tamamen sağlayıcı verisi ve her biri her gün değişiyor. Arama motoruna
 * gönderilecek asıl değer, yazılan metinler.
 *
 * Veritabanı düşerse harita yine üretilir; yalnızca mercek bölümü boş kalır.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticRoutes: {
    path: string;
    priority: number;
    frequency: MetadataRoute.Sitemap[number]["changeFrequency"];
  }[] = [
    { path: "/", priority: 1, frequency: "hourly" },
    { path: "/piyasalar", priority: 0.8, frequency: "hourly" },
    { path: "/bilancolar", priority: 0.8, frequency: "daily" },
    { path: "/takvim", priority: 0.8, frequency: "daily" },
    { path: "/makro", priority: 0.7, frequency: "daily" },
    { path: "/sirketler", priority: 0.6, frequency: "weekly" },
    { path: "/karsilastir", priority: 0.6, frequency: "weekly" },
    { path: "/haberler", priority: 0.6, frequency: "hourly" },
    { path: "/bulten", priority: 0.7, frequency: "daily" },
    { path: "/rehber", priority: 0.9, frequency: "weekly" },
    { path: "/mercek", priority: 0.9, frequency: "daily" },
    { path: "/menu", priority: 0.3, frequency: "monthly" },
    { path: "/kvkk", priority: 0.3, frequency: "monthly" },
  ];

  const entries: MetadataRoute.Sitemap = staticRoutes.map((route) => ({
    url: `${SITE_URL}${route.path}`,
    lastModified: now,
    changeFrequency: route.frequency,
    priority: route.priority,
  }));

  for (const slug of GUIDE_SLUGS) {
    entries.push({
      url: `${SITE_URL}/rehber/${slug}`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.7,
    });
  }

  try {
    const stories = await getStories("tr", 200);
    for (const story of stories) {
      entries.push({
        // eventDate olayın günü (YYYY-MM-DD); yazının yazıldığı gün değil ama
        // "bu içerik ne kadar taze" sorusuna verilecek en yakın cevap o.
        url: `${SITE_URL}/mercek/${story.slug}`,
        lastModified: new Date(story.eventDate),
        changeFrequency: "monthly",
        priority: 0.7,
      });
    }
  } catch {
    // Veritabanı yoksa harita durağan kısımla üretilsin, hata vermesin.
  }

  return entries;
}
