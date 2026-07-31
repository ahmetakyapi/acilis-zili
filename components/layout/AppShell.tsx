"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Settings, LogIn } from "lucide-react";
import { BellMark } from "@/components/brand/BellMark";
import { NAV_ITEMS } from "./nav-items";
import { cn } from "@/lib/utils";

export type ShellLabels = {
  brandName: string;
  nav: Record<string, string>;
  search: string;
  settings: string;
  signIn: string;
  menu: string;
};

type AppShellProps = {
  labels: ShellLabels;
  signedIn: boolean;
  username: string | null;
  themeToggle: React.ReactNode;
  localeToggle: React.ReactNode;
  searchTrigger: React.ReactNode;
  children: React.ReactNode;
};

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname.startsWith(href);
}

export function AppShell({
  labels,
  signedIn,
  username,
  themeToggle,
  localeToggle,
  searchTrigger,
  children,
}: AppShellProps) {
  const pathname = usePathname();
  const bottomItems = NAV_ITEMS.filter((item) => item.inBottomBar);

  return (
    <div className="flex min-h-dvh">
      {/* ---- Masaüstü kenar çubuğu ---- */}
      <aside className="chrome sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r lg:flex">
        <Link
          href="/"
          className="flex items-center gap-2.5 px-5 py-5"
          aria-label={labels.brandName}
        >
          <BellMark size={26} />
          <span
            className="font-mono text-[13px] font-semibold uppercase tracking-[0.14em] text-strong"
          >
            {labels.brandName}
          </span>
        </Link>

        <nav className="flex flex-1 flex-col gap-0.5 px-3 py-2">
          {NAV_ITEMS.map((item) => {
            const active = isActive(pathname, item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex items-center gap-3 rounded-(--radius-md) px-3 py-2 text-sm transition-colors duration-200",
                  active
                    ? "bg-primary-wash font-medium text-primary"
                    : "text-soft hover:bg-surface-elevated hover:text-strong",
                )}
              >
                {/* Aktif satırın pirinç işareti — markanın ölçek çentiği */}
                {active && (
                  <span
                    aria-hidden
                    className="absolute left-0 top-1/2 h-4 w-[2.5px] -translate-y-1/2 rounded-r-full bg-brass"
                  />
                )}
                <Icon size={17} strokeWidth={active ? 2.2 : 1.8} />
                {labels.nav[item.href]}
              </Link>
            );
          })}
        </nav>

        <div className="flex flex-col gap-1 border-t border-line-soft px-3 py-3">
          <div className="flex items-center gap-1 px-1 pb-1">
            {themeToggle}
            {localeToggle}
          </div>
          {signedIn ? (
            <Link
              href="/ayarlar"
              className="flex items-center gap-3 rounded-(--radius-md) px-3 py-2 text-sm text-soft transition-colors hover:bg-surface-elevated hover:text-strong"
            >
              <Settings size={17} strokeWidth={1.8} />
              <span className="truncate">{username ?? labels.settings}</span>
            </Link>
          ) : (
            <Link
              href="/giris"
              className="flex items-center gap-3 rounded-(--radius-md) px-3 py-2 text-sm text-soft transition-colors hover:bg-surface-elevated hover:text-strong"
            >
              <LogIn size={17} strokeWidth={1.8} />
              {labels.signIn}
            </Link>
          )}
        </div>
      </aside>

      {/* ---- İçerik ---- */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobil başlık */}
        <header className="chrome sticky top-0 z-30 flex items-center justify-between gap-2 border-b px-4 py-3 lg:hidden">
          <Link href="/" className="flex items-center gap-2" aria-label={labels.brandName}>
            <BellMark size={22} notches={false} />
            <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-strong">
              {labels.brandName}
            </span>
          </Link>
          <div className="flex items-center gap-1">
            {searchTrigger}
            {themeToggle}
            {localeToggle}
          </div>
        </header>

        {/* Masaüstü üst şerit — arama buraya oturur */}
        <div className="chrome sticky top-0 z-30 hidden items-center justify-end gap-2 border-b px-6 py-2.5 lg:flex">
          {searchTrigger}
        </div>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-24 pt-5 sm:px-6 lg:pb-10">
          {children}
        </main>

        {/* Mobil alt gezinme */}
        <nav
          className="chrome fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t pb-[env(safe-area-inset-bottom)] lg:hidden"
          aria-label={labels.menu}
        >
          {bottomItems.map((item) => {
            const active = isActive(pathname, item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-[56px] flex-col items-center justify-center gap-1 px-1 py-2 text-[10px] transition-colors",
                  active ? "text-primary" : "text-muted",
                )}
              >
                <Icon size={19} strokeWidth={active ? 2.2 : 1.7} />
                <span className="truncate">{labels.nav[item.href]}</span>
                {active && (
                  <span aria-hidden className="h-[2px] w-4 rounded-full bg-brass" />
                )}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
