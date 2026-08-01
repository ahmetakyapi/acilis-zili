import { auth } from "@/auth";
import { AppShell, type ShellLabels } from "@/components/layout/AppShell";
import { LocaleToggle } from "@/components/layout/LocaleToggle";
import { SearchCommand } from "@/components/layout/SearchCommand";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
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
          popularLabel={t.nav.searchPopular}
          companiesLabel={t.nav.companies}
          hints={{ move: t.nav.searchHintMove, open: t.nav.searchHintOpen }}
        />
      }
    >
      {children}
    </AppShell>
  );
}
