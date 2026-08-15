"use client";

import { usePathname } from "next/navigation";
import { TabBar, TabItem } from "@/components/ui/primitives";

/**
 * Panelin sekme çubuğu.
 *
 * Layout'ta duruyor, beş sayfada tekrarlanmıyor: bilançolar ekranındaki
 * sekmelerin aksine burada layout altında "sekme istemeyen" bir detay
 * sayfası yok — panelin bütün adresleri sekmelerden biri.
 */

const TABS = [
  { href: "/admin", label: "Özet" },
  { href: "/admin/trafik", label: "Trafik" },
  { href: "/admin/uyeler", label: "Üyeler" },
  { href: "/admin/icerik", label: "İçerik" },
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
