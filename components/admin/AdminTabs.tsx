"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

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
    <nav aria-label="Yönetim bölümleri">
      {/* Dar ekranda kendi kabında kayar; sayfa gövdesi yatayda kilitli. */}
      <ul className="scroll-x flex gap-1 overflow-x-auto border-b border-line pb-px">
        {TABS.map((tab) => {
          const active =
            tab.href === "/admin"
              ? pathname === "/admin"
              : pathname.startsWith(tab.href);
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "-mb-px inline-flex h-10 items-center whitespace-nowrap border-b-2 px-3.5 text-[13.5px] font-semibold transition-colors",
                  active
                    ? "border-primary text-strong"
                    : "border-transparent text-muted hover:text-body",
                )}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
