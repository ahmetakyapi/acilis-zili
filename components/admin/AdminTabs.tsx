"use client";

import { usePathname } from "next/navigation";
import { TabBar, TabItem } from "@/components/ui/primitives";

/**
 * Panelin sekme çubuğu.
 *
 * Layout'ta duruyor, altı sayfada tekrarlanmıyor.
 *
 * DETAY SAYFALARI DA SEKMENİN ALTINDA. Yazı editörleri
 * (`/admin/yazilar/mercek/...`, `/admin/yazilar/bulten/...`) bilançolar
 * ekranındaki detay sayfasının aksine sekme çubuğunu KORUYOR: orada sekme
 * paylaşılan bir layout'ta değil ve detay onu basmıyor, burada ise panelin
 * gezinmesi tek bir yerde ve editörden başka bir bölüme geçmenin yolu bu.
 * Etkin sekme `startsWith` ile bulunuyor, yani editör açıkken de "Yazılar"
 * vurgulu duruyor.
 *
 * İÇERİK VE YAZILAR AYRI İKİ SEKME: ilki ölçüyor (kaç yazı, hangi çeviri
 * eksik, ritim), ikincisi değiştiriyor. Bölünmenin gerekçesi
 * `app/admin/yazilar/page.tsx` başındaki yorumda.
 */

const TABS = [
  { href: "/admin", label: "Özet" },
  { href: "/admin/trafik", label: "Trafik" },
  { href: "/admin/uyeler", label: "Üyeler" },
  { href: "/admin/icerik", label: "İçerik" },
  { href: "/admin/yazilar", label: "Yazılar" },
  { href: "/admin/sistem", label: "Sistem" },
] as const;

export function AdminTabs() {
  const pathname = usePathname();

  return (
    <TabBar label="Yönetim bölümleri">
      {TABS.map((tab) => {
        const active =
          tab.href === "/admin"
            ? pathname === "/admin"
            : pathname.startsWith(tab.href);
        return (
          <TabItem key={tab.href} href={tab.href} active={active}>
            {tab.label}
          </TabItem>
        );
      })}
    </TabBar>
  );
}
