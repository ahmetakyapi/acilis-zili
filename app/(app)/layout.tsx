import { auth } from "@/auth";
import {
  Masthead,
  type DatelineData,
  type MastheadLabels,
} from "@/components/layout/Masthead";
import { LocaleToggle } from "@/components/layout/LocaleToggle";
import { SearchCommand } from "@/components/layout/SearchCommand";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { NAV_ITEMS } from "@/components/layout/nav-items";
import { getStatus } from "@/lib/data";
import { getI18n, getTheme } from "@/lib/i18n";
import { formatEtDateLong } from "@/lib/utils";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [{ locale, t }, theme, session, status] = await Promise.all([
    getI18n(),
    getTheme(),
    auth(),
    getStatus(),
  ]);

  const labels: MastheadLabels = {
    brandName: t.brand.name,
    nav: Object.fromEntries(
      NAV_ITEMS.map((item) => [item.href, item.label(t)]),
    ),
    search: t.nav.search,
    settings: t.nav.settings,
    signIn: t.nav.signIn,
    menu: t.nav.menu,
    clockNy: t.nav.clockNy,
    clockIst: t.nav.clockIst,
  };

  /* Tarih rayı — gazetenin künye satırı. Seans durumu ve geri sayım hedefi
     sunucuda hesaplanır (tatil takvimi orada), saatler istemcide işler. */
  const sessionNames: Record<string, string> = {
    regular: t.market.open,
    "pre-market": t.market.preMarket,
    "after-hours": t.market.afterHours,
    closed: status.holiday
      ? t.market.holiday
      : status.isWeekend
        ? t.market.weekend
        : t.market.closed,
  };
  const sessionLabel = sessionNames[status.session] ?? t.market.closed;

  /* `nextOpen` hafta sonunu ve tatili atlar; geri sayım her gün doludur. */
  const countdownTarget =
    status.session === "regular" ? status.nextClose : status.nextOpen;

  const dateline: DatelineData = {
    dateLong: formatEtDateLong(status.etDate, locale),
    dateShort: new Intl.DateTimeFormat(locale === "tr" ? "tr-TR" : "en-US", {
      day: "numeric",
      month: "short",
      weekday: "long",
      timeZone: "UTC",
    }).format(new Date(`${status.etDate}T12:00:00Z`)),
    sessionLabel,
    countdownLabel:
      status.session === "regular" ? t.market.closesIn : t.market.opensIn,
    countdownTargetIso: countdownTarget ? countdownTarget.toISOString() : null,
    sources: "Alpaca IEX · Finnhub · FRED",
    locale,
  };

  return (
    <Masthead
      labels={labels}
      dateline={dateline}
      signedIn={Boolean(session?.user)}
      username={session?.user?.name ?? null}
      themeToggle={<ThemeToggle initial={theme} label={t.settings.theme} />}
      localeToggle={<LocaleToggle initial={locale} label={t.settings.language} />}
      searchTrigger={
        <SearchCommand
          placeholder={t.nav.searchPlaceholder}
          label={t.nav.search}
          emptyLabel={t.stock.notFound}
          popularLabel={t.nav.searchPopular}
        />
      }
    >
      {children}
    </Masthead>
  );
}
