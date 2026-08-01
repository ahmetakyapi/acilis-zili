"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";
import { NAV_ITEMS } from "./nav-items";
import { useDualClock } from "./useDualClock";
import { cn } from "@/lib/utils";
import { formatCountdown } from "@/lib/market-hours";

/**
 * Gazete manşeti — her sayfanın üstü, birebir aynı (HANDOFF §4).
 *
 * 1. Künye satırı: logo + yatay nav + sağda arama / TR-EN / tema / giriş
 * 2. Manşet çizgisi: 2px üst + 1px alt, arası 5px, sayfa kenarından içeride
 * 3. Tarih rayı: tarih · saatler (NY + İST) · seans durumu · kaynaklar
 * 4. İnce kapanış çizgisi
 *
 * Kenar çubuğu yok: gazetenin gezinmesi manşetin altındaki tek satırdır.
 */

export type MastheadLabels = {
  brandName: string;
  nav: Record<string, string>;
  search: string;
  settings: string;
  signIn: string;
  menu: string;
  clockNy: string;
  clockIst: string;
};

export type DatelineData = {
  /** Sunucuda biçimlenmiş uzun tarih — "7 Ağustos 2026 · Cuma" */
  dateLong: string;
  /** Mobil için kısa tarih — "7 Ağu · Cuma" */
  dateShort: string;
  /** Seans adı — "Seans öncesi", "Seans açık" ... */
  sessionLabel: string;
  /** "Açılışa" / "Kapanışa" — geri sayımın önüne gelir. */
  countdownLabel: string;
  /** Geri sayımın hedefi (ISO). Piyasa tamamen kapalıysa null. */
  countdownTargetIso: string | null;
  /** Veri kaynakları — "Alpaca IEX · Finnhub · FRED" */
  sources: string;
  locale: string;
};

/* Geri sayım dakikada bir yenilenir; sunucuda boş basılır. */
function subscribeMinute(onTick: () => void) {
  const id = window.setInterval(onTick, 20000);
  return () => window.clearInterval(id);
}

function useCountdown(targetIso: string | null, locale: string): string | null {
  const value = useSyncExternalStore(
    subscribeMinute,
    () =>
      targetIso ? formatCountdown(new Date(targetIso), new Date(), locale) : "",
    () => "",
  );
  return value || null;
}

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname.startsWith(href);
}

/* --------------------------------------------------------------------------
   Tarih rayı
   -------------------------------------------------------------------------- */

function Dateline({
  data,
  labels,
}: {
  data: DatelineData;
  labels: MastheadLabels;
}) {
  const { ny, ist } = useDualClock();
  const countdown = useCountdown(data.countdownTargetIso, data.locale);

  return (
    <>
      {/* Masaüstü — dört parça, aralarında esneyen boşluk */}
      <div className="hidden justify-between gap-6 px-5 py-2.5 text-[12.5px] uppercase tracking-[0.08em] text-dim sm:flex sm:px-8 lg:px-14">
        <span>{data.dateLong}</span>
        <span className="numeral">
          {labels.clockNy} {ny} · {labels.clockIst} {ist}
        </span>
        <span>
          {data.sessionLabel}
          {countdown && (
            <>
              {" · "}
              <span className="text-down">
                {data.countdownLabel} {countdown}
              </span>
            </>
          )}
        </span>
        <span className="hidden lg:inline">{data.sources}</span>
      </div>

      {/* Mobil — tarih solda, geri sayım sağda */}
      <div className="flex justify-between gap-3 px-5 py-2 text-[11px] uppercase tracking-[0.07em] text-dim sm:hidden">
        <span>{data.dateShort}</span>
        {countdown ? (
          <span className="text-down">
            {data.countdownLabel} {countdown}
          </span>
        ) : (
          <span>{data.sessionLabel}</span>
        )}
      </div>
    </>
  );
}

/* --------------------------------------------------------------------------
   Kabuk
   -------------------------------------------------------------------------- */

export function Masthead({
  labels,
  dateline,
  signedIn,
  username,
  themeToggle,
  localeToggle,
  searchTrigger,
  children,
}: {
  labels: MastheadLabels;
  dateline: DatelineData;
  signedIn: boolean;
  username: string | null;
  themeToggle: React.ReactNode;
  localeToggle: React.ReactNode;
  searchTrigger: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const bottomItems = NAV_ITEMS.filter((item) => item.inBottomBar);

  return (
    <div className="flex min-h-dvh flex-col">
      <header>
        {/* ---- Künye satırı ---- */}
        <div className="flex items-baseline gap-4 px-5 pb-3 pt-5 sm:px-8 lg:gap-6 lg:px-14">
          <Link
            href="/"
            className="shrink-0 text-[19px] font-semibold tracking-[-0.02em] text-ink sm:text-[21px]"
          >
            {labels.brandName}
          </Link>

          {/* Masaüstü gezinme — manşetin altındaki tek satır */}
          <nav className="ml-2 hidden gap-5 text-[14px] text-dim lg:flex">
            {NAV_ITEMS.filter((item) => item.inTopNav).map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "pb-px transition-colors hover:text-ink",
                    active && "border-b border-up text-up hover:text-up",
                  )}
                >
                  {labels.nav[item.href]}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex shrink-0 items-center gap-3 text-[13px] sm:gap-4">
            {searchTrigger}
            {localeToggle}
            {themeToggle}
            {signedIn ? (
              <Link
                href="/ayarlar"
                title={username ?? labels.settings}
                className="hidden max-w-32 truncate text-[13px] text-dim transition-colors hover:text-ink sm:block"
              >
                {username ?? labels.settings}
              </Link>
            ) : (
              <Link
                href="/giris"
                className="hidden whitespace-nowrap border border-rule px-3.5 py-1.5 text-[13px] text-ink transition-colors hover:bg-primary-tint sm:block"
              >
                {labels.signIn}
              </Link>
            )}
          </div>
        </div>

        {/* ---- Manşet çizgisi: kalın-ince çift kural ---- */}
        <div className="rule-head mx-5 sm:mx-8 lg:mx-14" />

        <Dateline data={dateline} labels={labels} />

        <div className="rule-thin mx-5 sm:mx-8 lg:mx-14" />
      </header>

      <main className="mx-auto w-full max-w-[1440px] flex-1 px-5 pb-24 pt-7 sm:px-8 lg:px-14 lg:pb-16">
        {children}
      </main>

      {/* ---- Mobil alt sekme çubuğu (HANDOFF §6) ----
          Beş sekme: Bugün · Takvim · Piyasa · Bilanço · Favoriler.
          Şirketler dizini burada yok — mobilde 500 satırlık alfabetik listeyi
          kimse kaydırmaz, sembol aramak asıl davranış; üstteki aramadan gelir. */}
      <nav
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-rule bg-page pb-[env(safe-area-inset-bottom)] lg:hidden"
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
                "flex min-h-[56px] min-w-[62px] flex-col items-center justify-center gap-1 px-1 py-2 text-[11px] transition-colors",
                active ? "text-up" : "text-faint",
              )}
            >
              <Icon size={20} strokeWidth={active ? 2 : 1.6} />
              <span className="truncate">{labels.nav[item.href]}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
