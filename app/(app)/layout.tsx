import { MotionProvider } from "@/components/motion/MotionProvider";
import { Suspense } from "react";
import { headers } from "next/headers";
import { auth } from "@/auth";
import { AccountMenu } from "@/components/layout/AccountMenu";
import { AppShell, type ShellLabels } from "@/components/layout/AppShell";
import { CompanyCardHost } from "@/components/ui/CompanyCard";
import { SearchCommand } from "@/components/layout/SearchCommand";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { TickerFeed } from "@/components/layout/TickerFeed";
import { ViewBeacon } from "@/components/layout/ViewBeacon";
import { NAV_ITEMS } from "@/components/layout/nav-items";
import { getI18n, getTheme } from "@/lib/i18n";
import { getUserAvatar } from "@/lib/avatar-data";
import { getUnreadCount } from "@/lib/notifications";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { hasAnalysisAccess } from "@/lib/ai-analysis-access";
import { LATEST_CHANGE_DATE } from "@/lib/changelog";

/* --------------------------------------------------------------------------
   BU SEGMENTTE `loading.tsx` YOK — ve bu bilinçli.

   Bir süre vardı: sayfa iskeleti basıyor, gezinmeye anında geri bildirim
   veriyordu. Ama `loading.tsx` bulunduğu segmentte bir Suspense sınırı
   açıyor ve Next yanıtı o sınıra kadar HEMEN akıtıyor — durum kodu da o an
   yazılıyor. Sonuç: `notFound()` çağıran her dinamik rota gövdesinde 404
   ekranını basıyor ama HTTP 200 dönüyordu. Ölçüldü — /rehber/olmayan,
   /mercek/olmayan, /haberler/999, /bilancolar/YOK/2026Q1: dördü de 200.
   Arama motorları için bu "soft 404": olmayan sayfalar taranıyor, tarama
   bütçesi ve dizin kalitesi yanıyor.

   Karşılığında kaybedilen şey küçük çıktı. Sayfaların yavaş parçaları zaten
   kendi `<Suspense>` adalarında; kabuk ölçüldüğünde 43-350 ms arasında
   akıyor (en yavaşı /bilancolar). Gezinme geri bildirimini de üstteki
   `RouteProgress` şeridi veriyor — tıklamayla birlikte başlıyor, sayfa
   hazır olunca kapanıyor.

   Yeniden eklenecekse: 404 dönebilen dinamik rotaların ÜSTÜNDE bir yükleme
   sınırı olmamalı.
   -------------------------------------------------------------------------- */

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  /* LOGONUN ALTINDAKİ SEANS SATIRI KALDIRILDI (29 Eylül, sahibinin
     isteği: telefonda logonun altında yazı "kötü" duruyordu, sonra her
     genişlikte istendi). Satır `SessionLine`dı ve kabuğun tek `getStatus`
     okumasıydı; onunla birlikte o okuma da kalktı. Seansın durumu ana
     sayfanın geri sayımında ve piyasa şeridinde yaşıyor. */
  const [{ locale, t }, theme, session, ua] = await Promise.all([
    getI18n(),
    getTheme(),
    auth(),
    headers().then((h) => h.get("user-agent") ?? ""),
  ]);
  /* Arama kısayolunun künyesi işletim sistemine göre (gerekçe
     SearchCommand → `shortcut`). iPadOS kendini Macintosh diye tanıtıyor;
     klavyeli iPad'de de ⌘ doğru tuş. */
  const searchShortcut = /Mac|iPhone|iPad|iPod/.test(ua) ? "⌘K" : "Ctrl K";
  /* Profil ikonu — giriş yapılmışsa tek küçük sorgu, istek içinde
     önbellekli (/menu aynı cevabı okuyor). Düşerse baş harfler. */
  const [avatar, analyses, unread] = session?.user?.id
    ? await Promise.all([
        getUserAvatar(session.user.id),
        hasAnalysisAccess(session.user.id),
        /* Zilin sayısı: tek COUNT, istek içinde önbellekli; tablo yokken 0. */
        getUnreadCount(session.user.id),
      ])
    : [null, false, 0];

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
    /* Etiketler sunucuda çözülüyor: sözlük istemciye inmiyor, kabuğa
       yalnızca metinler gidiyor. */
    strip: NAV_ITEMS.flatMap((item) =>
      item.strip
        ? [
            {
              href: item.href,
              label: (item.strip.label ?? item.label)(t),
              full: item.label(t),
              hint: item.hint?.(t) ?? "",
              rank: item.strip.rank,
            },
          ]
        : [],
    ),
    moreItems: NAV_ITEMS.flatMap((item) =>
      item.more
        ? [{ href: item.href, label: item.label(t), hint: item.hint?.(t) ?? "", group: item.more }]
        : [],
    ),
    more: t.nav.more,
    moreGroups: { tools: t.nav.moreGroupTools, daily: t.nav.moreGroupDaily, market: t.nav.moreGroupMarket, mine: t.nav.moreGroupMine, learn: t.nav.moreGroupLearn },
    /* "Her Gün" sütununda Hisseyi Bil satırının künyesi: bugünün bulmaca
       numarası istemcide, panel açılırken hesaplanıyor (MastheadNav). */
    puzzleNumber: t.stockPuzzle.number,
    /* Yenilikler (25 Ekim): panelin dibindeki satır ve rozet. En son giriş
       günü sunucudan — içerik demeti istemci paketine inmiyor. */
    changelog: {
      href: "/yenilikler",
      label: t.changelog.title,
      hint: t.changelog.menuHint,
      badge: t.changelog.badge,
      badgeLabel: t.changelog.badgeLabel,
      latest: LATEST_CHANGE_DATE,
    },
    mainNav: t.nav.mainNav,
    bottomNav: t.nav.bottomNav,
    skipToContent: t.nav.skipToContent,
    loading: t.common.loading,
  };

  /* MotionProvider KABUĞU SARIYOR, yalnızca sayfayı değil. Bir dönem
     yalnızca `children`ı sarıyordu: başlıktaki hesap paneli, "Daha Fazla"
     ve arama paleti `reducedMotion="user"` ayarının dışında kalıyor,
     "hareketi azalt" diyen okuyucuda da kayarak açılıyordu. */
  return (
    <MotionProvider>
      <AppShell
        labels={labels}
        locale={locale}
        searchTrigger={
          <SearchCommand
            placeholder={t.nav.searchPlaceholder}
            placeholderShort={t.nav.searchTrigger}
            label={t.nav.search}
            emptyLabel={t.stock.notFound}
            rateLimitedLabel={t.nav.searchRateLimited}
            failedLabel={t.nav.searchFailed}
            popularLabel={t.nav.searchPopular}
            recentLabel={t.nav.searchRecent}
            companiesLabel={t.nav.companies}
            technicalLabel={t.technical.title}
            writingsLabel={t.nav.searchWritings}
            closeLabel={t.common.close}
            hints={{ move: t.nav.searchHintMove, open: t.nav.searchHintOpen }}
            shortcut={searchShortcut}
          />
        }
        accountMenu={
          <>
          {/* Zil yalnız oturumluya: misafirin gelen kutusu yok. */}
          {session?.user && (
            <NotificationBell unread={unread} label={t.inbox.bell} unreadLabel={t.inbox.bellUnread} unreadOneLabel={t.inbox.bellUnreadOne} />
          )}
          <AccountMenu
            signedIn={Boolean(session?.user)}
            username={session?.user?.name ?? null}
            avatar={avatar}
            /* Oturum token'ındaki rol yalnızca BAĞLANTIYI göstermek için
               yeterli; panelin kendisi yetkiyi veritabanından doğruluyor
               (lib/admin.ts). Burada sorgu yapmak her sayfada bir gidiş-dönüş
               daha demek olurdu. */
            isAdmin={session?.user?.role === "admin"}
            analyses={analyses}
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
              analyses: t.aiAnalysis.page.title,
              portfolio: t.lira.portfolio.title,
              theme: t.settings.theme,
              themeLight: t.settings.themeLight,
              themeDark: t.settings.themeDark,
              language: t.settings.language,
            }}
            soundLabel={t.daySignature.sound.title}
          />
          </>
        }
        ticker={
          /* `key` ŞART — yalnız geliştirme uyarısı için ama her sayfada
             çıkıyordu (25 Ekim): "Each child in a list should have a unique
             key … Check the render method of `AppShell`. It was passed a
             child from AppLayout." Bu öğe AppShell'in kök `div`inin sabit
             (`jsxs`) çocuk listesinde duruyor; React o listeyi doğrulanmış
             sayıyor, ama RSC yükü büyüyünce (menüye /gun, dalda /bulmaca
             eklenince) bu Suspense öğesi ayrı bir parçaya çıkıp tembel
             (lazy) referans olarak geliyor ve çözülen öğenin doğrulama
             işareti 0 kalıyor. Anahtarsız + işaretsiz öğe uyarıyı
             tetikliyor (react-dom → `warnForMissingKey`, CDP günlük
             noktasıyla yakalandı: ana `div`in 8. çocuğu, tipi tembel). */
          <Suspense key="ticker" fallback={null}>
            <TickerFeed />
          </Suspense>
        }
        footer={<SiteFooter />}
      >
        {/* Sayfa ölçümü — çerezsiz, kimliksiz, hiçbir şey çizmez. */}
        <ViewBeacon locale={locale} />
        {/* Şirket kartının TEK sunucusu: sayfalar yalnızca veriyi
            (`CompanyCards`) ve logolar `data-cc` özniteliğini taşıyor. */}
        <CompanyCardHost
          labels={{
            sector: t.companyCard.sector,
            marketCap: t.companyCard.marketCap,
            price: t.companyCard.price,
          }}
        />
        {children}
      </AppShell>
    </MotionProvider>
  );
}
