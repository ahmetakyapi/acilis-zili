/**
 * Yönetim panelinin bölüm haritası — sekme adı, sayfa başlığı, tek
 * cümlelik açıklama ve tarayıcı sekmesinin başlığı TEK YERDE.
 *
 * Düz modül, `"use client"` DEĞİL: sekmeler (AdminTabs) istemci bileşeni
 * ve oradan dışa aktarılan bir değer sunucu sayfasına gerçek değer olarak
 * gelmez (CLAUDE.md, istemci–sunucu sınırı). Sayfalar ve sekmeler bu
 * dosyadan okuyor; bir bölümün adı değişirse iki yerde ayrı düşmüyor.
 */

const BRAND = "Yönetim · Açılış Zili";

export const ADMIN_SECTIONS = {
  overview: {
    href: "/admin",
    tab: "Özet",
    title: "Özet",
    subtitle: "Son yedi günün okur trafiği, üyeler ve dikkat isteyen işler.",
  },
  traffic: {
    href: "/admin/trafik",
    tab: "Trafik",
    title: "Trafik",
    subtitle: "Sayfa görüntülemeleri, okurun nereden geldiği, cihazı ve dili.",
  },
  members: {
    href: "/admin/uyeler",
    tab: "Üyeler",
    title: "Üyeler",
    subtitle: "Kaç kişi, ne zaman geldi, neyi takip ediyor. E-posta adresleri gösterilmez.",
  },
  content: {
    href: "/admin/icerik",
    tab: "İçerik",
    title: "İçerik",
    subtitle: "Yazıların sağlığı: eksik çeviriler, grafiksiz analizler ve yayın ritmi.",
  },
  writing: {
    href: "/admin/yazilar",
    tab: "Yazılar",
    title: "Yazılar",
    subtitle: "Yayındaki mercek yazılarını ve bültenleri düzelt; yeni kayıt burada açılmaz.",
  },
  system: {
    href: "/admin/sistem",
    tab: "Sistem",
    title: "Sistem",
    subtitle: "Rutinlerin, verinin ve anahtarların durumu.",
  },
} as const;

export type AdminSectionKey = keyof typeof ADMIN_SECTIONS;

/** Sekme sırası — Özet, Trafik, Üyeler, İçerik, Yazılar, Sistem. */
export const ADMIN_TAB_ORDER: readonly AdminSectionKey[] = [
  "overview",
  "traffic",
  "members",
  "content",
  "writing",
  "system",
] as const;

/**
 * Mutlak sekme başlığı. Kökün şablonu dile göre marka ekliyordu ve
 * İngilizce çerezle "Yönetim · Opening Bell" çıkıyordu; altı bölüm de aynı
 * başlığı paylaşıyordu (tarayıcı sekmesi, geçmiş ve ekran okuyucu bölümleri
 * ayıramıyordu).
 */
export function adminDocTitle(...parts: string[]): { absolute: string } {
  return { absolute: [...parts, BRAND].join(" · ") };
}
