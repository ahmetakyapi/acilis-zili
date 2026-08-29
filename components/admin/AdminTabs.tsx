"use client";

import { useEffect, useRef } from "react";
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
 *
 * ETKİN SEKME GÖRÜNÜR ALANA KAYDIRILIYOR. Çubuk dar ekranda kayıyor ve altı
 * sekme 390 pikselde sığmıyor; kaydırma her zaman başta durduğu için
 * "Sistem" sayfasındayken ETKİN SEKME ekranın dışında kalıyordu — okuyucu
 * hangi bölümde olduğunu göremiyor, üstelik oraya nasıl geldiğini de.
 * `inline: "center"` kaydırma aralığına kırpılıyor: ilk sekme zaten
 * görünürse hiçbir şey olmuyor. `block: "nearest"` de sayfanın dikey olarak
 * zıplamasını engelliyor.
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
  const kap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const etkin = kap.current?.querySelector('[aria-current="page"]');
    etkin?.scrollIntoView({ inline: "center", block: "nearest" });
  }, [pathname]);

  return (
    <div ref={kap}>
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
    </div>
  );
}
