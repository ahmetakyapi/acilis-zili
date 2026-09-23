"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { TabBar, TabItem } from "@/components/ui/primitives";
import { ADMIN_SECTIONS, ADMIN_TAB_ORDER } from "@/lib/admin-sections";

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

const TABS = ADMIN_TAB_ORDER.map((key) => ({
  href: ADMIN_SECTIONS[key].href,
  label: ADMIN_SECTIONS[key].tab,
}));

export function AdminTabs() {
  const pathname = usePathname();
  const kap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const etkin = kap.current?.querySelector('[aria-current="page"]');
    etkin?.scrollIntoView({ inline: "center", block: "nearest" });
  }, [pathname]);

  return (
    /* ÇİZGİ BANDIN, ÇUBUĞUN DEĞİL: sekme bandı (layout) kendi alt
       çizgisini pencerenin bir ucundan öbür ucuna taşıyor.
       DAR EKRANDA KENAR SOLUYOR. Altı sekme 390'da sığmıyor (428 > 386)
       ve "Sistem" kenardan kesiliyordu, kaydırılabileceğine dair hiçbir
       işaret yoktu. Maske kesilen ucu soldurup "devamı var" diyor. */
    <div ref={kap}>
      <TabBar
        label="Yönetim bölümleri"
        className="border-b-0 max-sm:[mask-image:linear-gradient(90deg,transparent,var(--text-strong)_16px,var(--text-strong)_calc(100%-28px),transparent)]"
      >
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
