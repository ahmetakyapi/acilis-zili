"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Settings, LogIn } from "lucide-react";
import { BellMark } from "@/components/brand/BellMark";
import { NAV_ITEMS } from "./nav-items";
import { useDualClock } from "./useDualClock";
import { cn } from "@/lib/utils";

export type ShellLabels = {
  brandName: string;
  nav: Record<string, string>;
  groupMarket: string;
  groupFollow: string;
  clockNy: string;
  clockIst: string;
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

function SidebarClock({ nyLabel, istLabel }: { nyLabel: string; istLabel: string }) {
  const { ny, ist } = useDualClock();
  return (
    <div className="border-t border-line-soft px-4 py-2.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="plate text-[9px]">{nyLabel}</span>
        <span className="numeral text-[13px] font-semibold text-strong">{ny}</span>
      </div>
      <div className="mt-1 flex items-baseline justify-between gap-2">
        <span className="plate text-[9px]">{istLabel}</span>
        <span className="numeral text-[13px] font-semibold text-strong">{ist}</span>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------------------
   Kabuk
   -------------------------------------------------------------------------- */

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

  const groups: { key: "market" | "follow"; label: string }[] = [
    { key: "market", label: labels.groupMarket },
    { key: "follow", label: labels.groupFollow },
  ];

  return (
    <div className="flex min-h-dvh">
      {/* ---- Masaüstü kenar çubuğu — dar, yoğun, alet paneli ---- */}
      <aside className="chrome sticky top-0 hidden h-dvh w-52 shrink-0 flex-col border-r lg:flex">
        <Link
          href="/"
          className="flex items-center gap-2 border-b border-line-soft px-4 py-3.5"
          aria-label={labels.brandName}
        >
          <BellMark size={22} />
          <span className="font-mono text-xs font-semibold uppercase tracking-[0.13em] text-strong">
            {labels.brandName}
          </span>
        </Link>

        <nav className="flex flex-1 flex-col overflow-y-auto px-2.5 pt-3">
          {groups.map((group, groupIndex) => (
            <div key={group.key} className={cn(groupIndex > 0 && "mt-4")}>
              <p className="plate px-2 pb-1.5 text-[9px]">{group.label}</p>
              <div className="flex flex-col gap-px">
                {NAV_ITEMS.filter((item) => item.group === group.key).map(
                  (item) => {
                    const active = isActive(pathname, item.href);
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "relative flex h-9 items-center gap-2.5 rounded-(--radius-md) px-2 text-[13px] transition-colors duration-150",
                          active
                            ? "bg-primary-wash font-semibold text-primary"
                            : "text-soft hover:bg-surface-elevated hover:text-strong",
                        )}
                      >
                        {/* Aktif satırın pirinç işareti — markanın ölçek çentiği */}
                        {active && (
                          <span
                            aria-hidden
                            className="absolute -left-2.5 top-1/2 h-4 w-[2.5px] -translate-y-1/2 rounded-r-full bg-brass"
                          />
                        )}
                        <Icon size={16} strokeWidth={active ? 2.2 : 1.8} />
                        {labels.nav[item.href]}
                      </Link>
                    );
                  },
                )}
              </div>
            </div>
          ))}
        </nav>

        <SidebarClock nyLabel={labels.clockNy} istLabel={labels.clockIst} />

        {/* Hesap satırı — avatar solda, ayarlar oraya götürür */}
        <div className="border-t border-line-soft px-2 py-2">
          {signedIn ? (
            <Link
              href="/ayarlar"
              title={username ?? labels.settings}
              className="flex items-center gap-2 rounded-(--radius-md) px-2 py-1.5 transition-colors hover:bg-surface-elevated"
            >
              <span
                aria-hidden
                className="numeral flex size-7 shrink-0 items-center justify-center rounded-full bg-primary-wash text-[11px] font-bold uppercase text-primary"
              >
                {(username ?? "?").slice(0, 2)}
              </span>
              <span className="min-w-0 flex-1 truncate text-xs font-medium text-body">
                {username ?? labels.settings}
              </span>
              <Settings size={14} strokeWidth={1.8} className="shrink-0 text-muted" />
            </Link>
          ) : (
            <Link
              href="/giris"
              className="flex items-center gap-2 rounded-(--radius-md) px-2 py-2 text-xs font-semibold text-primary transition-colors hover:bg-primary-wash"
            >
              <LogIn size={15} strokeWidth={1.9} />
              {labels.signIn}
            </Link>
          )}

          <div className="mt-0.5 flex items-center gap-0.5 border-t border-line-soft pt-1.5">
            {themeToggle}
            {localeToggle}
          </div>
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
