"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Gear, SignIn } from "@phosphor-icons/react/dist/ssr";
import { BellMark, BrandLockup } from "@/components/brand/BellMark";
import { NAV_ITEMS } from "./nav-items";
import { cn } from "@/lib/utils";

export type ShellLabels = {
  brandName: string;
  tagline: string;
  nav: Record<string, string>;
  navShort: Record<string, string>;
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
  ticker: React.ReactNode;
  children: React.ReactNode;
};

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname.startsWith(href);
}

/* --------------------------------------------------------------------------
   Kabuk — masaüstünde masthead, mobilde başlık + alt sekme çubuğu.

   Kenar çubuğu kaldırıldı: yeni tasarımda gezinme sayfanın üstünde yatay
   duruyor ve içerik tam genişliği alıyor.
   -------------------------------------------------------------------------- */

export function AppShell({
  labels,
  signedIn,
  username,
  themeToggle,
  localeToggle,
  searchTrigger,
  ticker,
  children,
}: AppShellProps) {
  const pathname = usePathname();
  const bottomItems = NAV_ITEMS.filter((item) => item.inBottomBar);

  return (
    <div className="flex min-h-dvh flex-col">
      {/* ---- Masaüstü masthead ---- */}
      <header className="chrome sticky top-0 z-30 hidden items-center gap-7 border-b px-6 py-3.5 lg:flex xl:px-10">
        <Link href="/" className="shrink-0" aria-label={labels.brandName}>
          <BrandLockup
            name={labels.brandName}
            tagline={labels.tagline}
            size={34}
          />
        </Link>

        <nav className="flex min-w-0 gap-[3px] text-[13.5px]">
          {NAV_ITEMS.filter((item) => item.href !== "/haberler").map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "rounded-lg px-3.5 py-[7px] transition-colors duration-150",
                  active
                    ? "bg-surface-elevated font-semibold"
                    : "hover:bg-surface",
                )}
              >
                {/* Etiketler manşet mürekkebiyle yazılır; bulunulan sayfa
                    dolgulu pill ve kalın ağırlıkla ayrışır, renkle değil. */}
                <span className="display-ink">{labels.nav[item.href]}</span>
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-2.5">
          {searchTrigger}
          {themeToggle}
          {localeToggle}
          {signedIn ? (
            <Link
              href="/ayarlar"
              title={username ?? labels.settings}
              className="flex items-center gap-2 rounded-[9px] border border-line bg-surface px-2.5 py-[7px] text-[13px] text-body transition-colors hover:border-line-strong hover:text-strong"
            >
              <span
                aria-hidden
                className="flex size-[22px] shrink-0 items-center justify-center rounded-full bg-primary-wash text-[10px] font-bold uppercase text-primary"
              >
                {(username ?? "?").slice(0, 2)}
              </span>
              <span className="max-w-28 truncate">
                {username ?? labels.settings}
              </span>
              <Gear weight="duotone" size={15} className="shrink-0" />
            </Link>
          ) : (
            <Link
              href="/giris"
              className="rounded-[9px] bg-primary px-4 py-2 text-[13.5px] font-semibold text-on-primary transition-colors hover:bg-primary-hover"
            >
              {labels.signIn}
            </Link>
          )}
        </div>
      </header>

      {/* ---- Mobil başlık ---- */}
      <header className="chrome sticky top-0 z-30 flex items-center gap-2.5 border-b px-[18px] py-2.5 lg:hidden">
        <Link
          href="/"
          className="flex items-center gap-2.5"
          aria-label={labels.brandName}
        >
          <BellMark size={26} />
          <span className="display-ink w-fit text-[15.5px] font-bold tracking-[-0.03em]">
            {labels.brandName}
          </span>
        </Link>
        <div className="ml-auto flex items-center gap-2">
          {searchTrigger}
          {themeToggle}
          {localeToggle}
          {!signedIn && (
            <Link
              href="/giris"
              aria-label={labels.signIn}
              title={labels.signIn}
              className="flex size-[30px] items-center justify-center rounded-lg bg-primary text-on-primary"
            >
              <SignIn weight="duotone" size={16} />
            </Link>
          )}
        </div>
      </header>

      {/* Alt şerit sabit durduğu için içerik onun yüksekliği kadar boşluk
          bırakır; mobilde ayrıca sekme çubuğu var. */}
      <main className="mx-auto w-full max-w-[1400px] flex-1 px-[18px] pb-32 pt-4 sm:px-6 lg:pb-20 lg:pt-6 xl:px-10">
        {children}
      </main>

      {ticker}

      {/* ---- Mobil alt gezinme — 5 sekme, dokunma hedefi min 64px ---- */}
      <nav
        className="chrome fixed inset-x-0 bottom-0 z-30 flex justify-between border-t px-3 pb-[env(safe-area-inset-bottom)] lg:hidden"
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
                "flex min-w-16 flex-col items-center gap-[5px] px-1 pb-2.5 pt-3 text-[10px] tracking-[0.03em] transition-colors",
                active ? "font-semibold text-primary" : "text-muted",
              )}
            >
              <Icon weight="duotone" size={21} />
              <span className="truncate">
                {labels.navShort[item.href] ?? labels.nav[item.href]}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
