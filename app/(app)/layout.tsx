import { Suspense } from "react";
import { auth } from "@/auth";
import { AccountMenu } from "@/components/layout/AccountMenu";
import { AppShell, type ShellLabels } from "@/components/layout/AppShell";
import { LocaleToggle } from "@/components/layout/LocaleToggle";
import { SearchCommand } from "@/components/layout/SearchCommand";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { TickerFeed } from "@/components/layout/TickerFeed";
import { ViewBeacon } from "@/components/layout/ViewBeacon";
import { NAV_ITEMS } from "@/components/layout/nav-items";
import { getI18n, getTheme } from "@/lib/i18n";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [{ locale, t }, theme, session] = await Promise.all([
    getI18n(),
    getTheme(),
    auth(),
  ]);

  const labels: ShellLabels = {
    brandName: t.brand.name,
    tagline: t.brand.marketTagline,
    nav: Object.fromEntries(
      NAV_ITEMS.map((item) => [item.href, item.label(t)]),
    ),
    navShort: Object.fromEntries(
      NAV_ITEMS.filter((item) => item.shortLabel).map((item) => [
        item.href,
        item.shortLabel!(t),
      ]),
    ),
    settings: t.nav.settings,
    signIn: t.nav.signIn,
    menu: t.nav.menu,
    mainNav: t.nav.mainNav,
    bottomNav: t.nav.bottomNav,
    skipToContent: t.nav.skipToContent,
    loading: t.common.loading,
  };

  return (
    <AppShell
      labels={labels}
      signedIn={Boolean(session?.user)}
      username={session?.user?.name ?? null}
      themeToggle={<ThemeToggle initial={theme} label={t.settings.theme} />}
      localeToggle={<LocaleToggle initial={locale} label={t.settings.language} />}
      searchTrigger={
        <SearchCommand
          placeholder={t.nav.searchPlaceholder}
          placeholderShort={t.nav.searchTrigger}
          label={t.nav.search}
          emptyLabel={t.stock.notFound}
          rateLimitedLabel={t.nav.searchRateLimited}
          failedLabel={t.nav.searchFailed}
          popularLabel={t.nav.searchPopular}
          companiesLabel={t.nav.companies}
          writingsLabel={t.nav.searchWritings}
          closeLabel={t.common.close}
          hints={{ move: t.nav.searchHintMove, open: t.nav.searchHintOpen }}
        />
      }
      accountMenu={
        <AccountMenu
          signedIn={Boolean(session?.user)}
          username={session?.user?.name ?? null}
          /* Oturum token'ındaki rol yalnızca BAĞLANTIYI göstermek için
             yeterli; panelin kendisi yetkiyi veritabanından doğruluyor
             (lib/admin.ts). Burada sorgu yapmak her sayfada bir gidiş-dönüş
             daha demek olurdu. */
          isAdmin={session?.user?.role === "admin"}
          initialTheme={theme}
          initialLocale={locale}
          labels={{
            account: t.nav.account,
            settings: t.nav.settings,
            signIn: t.nav.signIn,
            signUp: t.nav.signUp,
            guest: t.menu.guestTitle,
            guestHint: t.menu.guestHint,
            watchlist: t.nav.watchlist,
            theme: t.settings.theme,
            themeLight: t.settings.themeLight,
            themeDark: t.settings.themeDark,
            language: t.settings.language,
          }}
          className="lg:hidden"
        />
      }
      ticker={
        <Suspense fallback={null}>
          <TickerFeed />
        </Suspense>
      }
      footer={<SiteFooter />}
    >
      {/* Sayfa ölçümü — çerezsiz, kimliksiz, hiçbir şey çizmez. */}
      <ViewBeacon locale={locale} />
      {children}
    </AppShell>
  );
}
