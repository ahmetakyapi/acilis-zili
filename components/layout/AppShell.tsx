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
  mainNav: string;
  skipToContent: string;
};

type AppShellProps = {
  labels: ShellLabels;
  signedIn: boolean;
  username: string | null;
  themeToggle: React.ReactNode;
  localeToggle: React.ReactNode;
  searchTrigger: React.ReactNode;
  ticker: React.ReactNode;
  footer: React.ReactNode;
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
  footer,
  children,
}: AppShellProps) {
  const pathname = usePathname();

  /* Alt çubuk: Piyasa · Bilanço · Favoriler · Menü.
     Giriş yapmamış kullanıcıda Favoriler sekmesi ÇIKMAZ SOKAKTI — proxy onu
     doğrudan /giris'e atıyordu, yani dört sekmeden biri o kullanıcı için
     içerik değil bir duvardı. O yuvada artık adıyla "Giriş" duruyor.

     Bu aynı zamanda mobil başlıktan kaldırılan giriş düğmesinin yerini
     dolduruyor: oradaki SignIn ikonu kapıdan çıkan bir ok çizdiği için
     "çıkış" gibi okunuyordu. Aynı işlev, ikon yerine yazıyla ve doğru yerde. */
  const bottomItems = NAV_ITEMS.filter((item) => item.inBottomBar).map(
    (item) => {
      const swap = item.href === "/favoriler" && !signedIn;
      return {
        key: item.href,
        href: swap ? "/giris" : item.href,
        icon: swap ? SignIn : item.icon,
        text: swap
          ? labels.signIn
          : (labels.navShort[item.href] ?? labels.nav[item.href]),
      };
    },
  );

  return (
    <div className="flex min-h-dvh flex-col">
      {/* Klavyeyle gezen biri her sayfada sekiz sekmeyi geçmek zorunda
          kalmasın. Odaklanana kadar görünmez; odakta masthead'in üstüne
          oturur. */}
      <a
        href="#icerik"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-[9px] focus:bg-primary focus:px-4 focus:py-2.5 focus:text-[13.5px] focus:font-semibold focus:text-on-primary"
      >
        {labels.skipToContent}
      </a>

      {/* ---- Masaüstü masthead ---- */}
      <header className="chrome sticky top-0 z-30 hidden items-center gap-4 border-b px-5 py-3.5 lg:flex xl:gap-6 xl:px-10">
        <Link href="/" className="shrink-0" aria-label={labels.brandName}>
          <BrandLockup
            name={labels.brandName}
            tagline={labels.tagline}
            size={34}
            // Alt satır yalnızca çok geniş ekranda: dokuz sekmeyle birlikte
            // masthead 1536px altında sıkışıyor, marka adı zaten yeterli.
            taglineClassName="hidden 2xl:block"
          />
        </Link>

        {/* Her etiket degradesini KENDİ kutusunda çizer; şerit boyunca tek
            bir süpürme denendi ve istenmedi. Bulunulan sayfa dolgulu hap ve
            kalın ağırlıkla ayrışır, renkle değil.
            "Bugün" burada yok — logo zaten oraya götürüyor. */}
        <nav className="flex min-w-0 gap-[2px] text-[13.5px] xl:gap-[3px] xl:text-[14.5px]">
          {NAV_ITEMS.filter((item) => item.inMasthead).map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch
                aria-current={active ? "page" : undefined}
                className={cn(
                  "shrink-0 whitespace-nowrap rounded-lg px-2.5 py-[7px] transition-colors duration-150 xl:px-3.5",
                  item.wideOnly && "hidden xl:block",
                  active
                    ? "bg-surface-elevated font-bold"
                    : "font-medium hover:bg-surface",
                )}
              >
                <span className="display-ink display-ink-tight">
                  {labels.nav[item.href]}
                </span>
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
          className="-my-1 flex items-center gap-2.5 py-1"
          aria-label={labels.brandName}
        >
          <BellMark size={28} />
          <span className="display-ink display-ink-tight w-fit text-[16.5px] font-bold tracking-[-0.03em]">
            {labels.brandName}
          </span>
        </Link>
        {/* Giriş düğmesi burada YOK. Phosphor'un SignIn ikonu kapıdan çıkan
            bir ok çiziyor ve giriş yapmamış kullanıcıya "çıkış" gibi
            okunuyordu — henüz girmediği bir yerden çıkma daveti. Giriş
            zaten alt çubuktaki Menü sekmesinde, adıyla yazılı olarak
            duruyor; ikonla ikinci kez tekrarlamaya gerek yok. */}
        <div className="ml-auto flex items-center gap-2">
          {searchTrigger}
          {themeToggle}
          {localeToggle}
        </div>
      </header>

      {/* Alt şerit sabit durduğu için içerik onun yüksekliği kadar boşluk
          bırakır; mobilde ayrıca sekme çubuğu var. */}
      <main
        id="icerik"
        className="mx-auto w-full max-w-[1400px] flex-1 px-[18px] pt-4 sm:px-6 lg:pt-6 xl:px-10"
      >
        {children}
      </main>

      {/* Alt bilgi ana akışın parçası; sabit şerit ve mobil sekme çubuğu
          kadar boşluk kendi altında bırakır. */}
      <div className="mx-auto w-full max-w-[1400px] px-[18px] pb-32 pt-10 sm:px-6 lg:pb-20 xl:px-10">
        {footer}
      </div>

      {ticker}

      {/* ---- Mobil alt gezinme — 5 sekme, dokunma hedefi min 64px ---- */}
      <nav
        className="chrome fixed inset-x-0 bottom-0 z-30 flex justify-between border-t px-3 pb-[env(safe-area-inset-bottom)] lg:hidden"
        aria-label={labels.mainNav}
      >
        {bottomItems.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.key}
              href={item.href}
              prefetch
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex flex-1 flex-col items-center gap-[5px] px-1 pb-2.5 pt-3 text-[10px] tracking-[0.03em] transition-colors",
                active ? "font-semibold text-primary" : "text-muted",
              )}
            >
              <Icon weight="duotone" size={21} />
              <span className="truncate">{item.text}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
