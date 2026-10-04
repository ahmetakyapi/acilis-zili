import { MotionExperience, ScrollProgress } from "@/components/motion/PremiumMotion";
import polish from "@/components/motion/UtilityExperience.module.css";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import {
  Bell,
  BookOpen,
  Buildings,
  CalendarBlank,
  ChartBar,
  ChartLineUp,
  Envelope,
  FileText,
  Gear,
  Heart,
  Briefcase,
  Receipt,
  SquaresFour,
  TextAa,
  Newspaper,
  Percent,
  Scroll,
  ShieldCheck,
  SignIn,
  SignOut,
  TrendUp,
  UsersThree,
} from "@phosphor-icons/react/dist/ssr";
import type { CSSProperties } from "react";
import { auth } from "@/auth";
import { AvatarTile } from "@/components/brand/AvatarIcon";
import { getUserAvatar } from "@/lib/avatar-data";
import { signOutAction } from "@/app/actions/auth";
import { PageHeader, Panel, ButtonLink } from "@/components/ui/primitives";
import { getI18n } from "@/lib/i18n";
import { withLocale } from "@/lib/i18n/routing";
import { pageMetadata } from "@/lib/page-meta";

/**
 * Menü — mobilde ürünün tam dizini.
 *
 * Alt çubukta dört yer var, ürünün on bir ekranı. Diğerlerine eskiden yalnızca
 * masaüstü masthead'inden ya da ana sayfadaki kartlardan ulaşılabiliyordu; bu
 * sayfa o boşluğu kapatıyor. Masaüstünde de çalışır ama oraya bir sekme
 * koymadık — masthead zaten aynı işi yapıyor.
 *
 * Bölümler ürünün kendi mantığıyla ayrılıyor: önce ölçüm ekranları, sonra
 * okunacak metin, sonra kişisel olan. Her satır tek dokunuşluk bir hedef
 * (min 52px) — sekme çubuğundan sonra en çok kullanılacak ekran burası.
 */

/* Dizine girmez ama bağlantıları İZLENİR: sayfanın kendi içeriği yok, bütün
   değeri gösterdiği ekranlarda. */
export const generateMetadata = pageMetadata({
  path: "/menu",
  robots: { index: false, follow: true },
  tr: {
    title: "Menü",
    description:
      "Bütün ekranlar tek listede.",
  },
  en: {
    title: "Menu",
    description:
      "Every screen in one list.",
  },
});

type Entry = {
  href: string;
  icon: typeof Bell;
  title: string;
  hint: string;
};

export default async function MenuPage() {
  const { t, locale } = await getI18n();
  const session = await auth();
  const username = session?.user?.name ?? null;
  const avatar = session?.user?.id ? await getUserAvatar(session.user.id) : null;

  const groups: { title: string; entries: Entry[] }[] = [
    {
      title: t.menu.groupMarket,
      entries: [
        { href: "/piyasalar", icon: TrendUp, title: t.nav.markets, hint: t.menu.hintMarkets },
        { href: "/teknik", icon: ChartLineUp, title: t.technical.title, hint: t.menu.hintTechnical },
        /* Portföy Teknik Analiz'in hemen ardında (4 Ekim): en alttaki Hesap
           grubundaydı ve okuyucu onu yalnız profil menüsünde buluyordu.
           Teknik planı da orada okuduğu için ikisi yan yana. */
        { href: "/portfoy", icon: Briefcase, title: t.lira.portfolio.title, hint: t.menu.hintPortfolio },
        { href: "/sirketler", icon: Buildings, title: t.nav.companies, hint: t.menu.hintCompanies },
        { href: "/makro", icon: Percent, title: t.nav.macro, hint: t.menu.hintMacro },
        { href: "/bilancolar", icon: FileText, title: t.nav.earnings, hint: t.menu.hintEarnings },
        { href: "/takvim", icon: CalendarBlank, title: t.nav.calendar, hint: t.menu.hintCalendar },
        { href: "/karsilastir", icon: ChartBar, title: t.compare.title, hint: t.menu.hintCompare },
        { href: "/tema", icon: SquaresFour, title: t.themes.eyebrow, hint: t.menu.hintThemes },
        { href: "/yatirimcilar", icon: UsersThree, title: t.investors.eyebrow, hint: t.menu.hintInvestors },
      ],
    },
    {
      title: t.menu.groupRead,
      entries: [
        /* Mercek başta: sitenin kendi yazdığı ve başka hiçbir yerde
           bulunmayan içerik bu. Rehber durağan bir müfredat — bir kez
           okunuyor, sonra referans kalıyor. */
        { href: "/mercek", icon: Scroll, title: t.nav.stories, hint: t.menu.hintStories },
        { href: "/rehber", icon: BookOpen, title: t.nav.guide, hint: t.menu.hintGuide },
        { href: "/sozluk", icon: TextAa, title: t.glossary.title, hint: t.menu.hintGlossary },
        { href: "/vergi", icon: Receipt, title: t.nav.taxTool, hint: t.menu.hintTax },
        { href: "/haberler", icon: Newspaper, title: t.nav.news, hint: t.menu.hintNews },
        { href: "/bulten", icon: Envelope, title: t.footer.briefArchive, hint: t.menu.hintBrief },
      ],
    },
    {
      title: t.menu.groupAccount,
      entries: [
        { href: "/favoriler", icon: Heart, title: t.nav.watchlist, hint: t.menu.hintWatchlist },
        { href: "/ayarlar", icon: Gear, title: t.nav.settings, hint: t.menu.hintSettings },
        { href: "/kvkk", icon: ShieldCheck, title: t.footer.privacy, hint: t.menu.hintPrivacy },
      ],
    },
  ];

  return (
    <MotionExperience className={`${polish.page} ${polish.menu}`}>
      <ScrollProgress />
      <PageHeader
        eyebrow={t.menu.eyebrow}
        title={t.menu.title}
        subtitle={t.menu.subtitle}
      />

      {/* Oturum kartı en üstte: mobilde giriş ve çıkış başka hiçbir yerde tek
          dokunuşta değil. */}
      <Panel className="flex items-center gap-3.5 p-4 sm:p-5">
        {avatar ? (
          <AvatarTile
            icon={avatar.icon}
            color={avatar.color}
            initials={username?.slice(0, 2).toLocaleUpperCase(locale === "tr" ? "tr-TR" : "en-US")}
            className="size-11 rounded-lg text-base"
          />
        ) : (
        <span
          aria-hidden
          className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary-wash text-base font-bold text-primary-ink"
        >
          {/* Baş harfler KODDA büyütülüyor, CSS `uppercase` ile değil:
              tarayıcı Türkçe `i`yi `I` yapıyor, `İ` değil. */}
          {username ? (
            username.slice(0, 2).toLocaleUpperCase(locale === "tr" ? "tr-TR" : "en-US")
          ) : (
            <SignIn size={20} weight="duotone" />
          )}
        </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-read font-bold text-strong">
            {username ?? t.menu.guestTitle}
          </span>
          <span className="mt-0.5 block text-small leading-snug text-muted">
            {username ? t.menu.signedInHint : t.menu.guestHint}
          </span>
        </span>
        {username ? (
          <form action={signOutAction}>
            <button
              type="submit"
              className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md border border-line bg-surface px-3 text-small font-semibold text-body transition-colors hover:border-line-strong hover:text-strong"
            >
              <SignOut weight="duotone" size={15} />
              {t.nav.signOut}
            </button>
          </form>
        ) : (
          <ButtonLink href={withLocale("/giris", locale)} variant="primary" className="shrink-0">
            {t.nav.signIn}
          </ButtonLink>
        )}
      </Panel>

      {/* KARO IZGARASI, LİSTE DEĞİL (29 Eylül, sahibinin isteği: "görsel
          revizyon, çok daha kullanışlı"). On dokuz satırlık liste telefonda
          ~1.250 piksel kaydırılıyordu ve her satır aynı ağırlıktaydı: bir
          ekranı bulmak için satırları tek tek okumak gerekiyordu. Karolarda
          göz önce ikonu ve adı yakalıyor, iki sütun listeyi yarıya indiriyor.
          İpucu satırı kalıyor (iki satıra kadar) — ekranın NE olduğunu
          söyleyen tek yer o. Grup başlıkları kutu değil, düz h2.

          The server-resolved locale also owns these destinations. An /en/menu
          visit without a preference cookie previously linked back to Turkish. */}
      <div className={polish.menuGroups}>
        {groups.map((group, groupIndex) => (
          <section key={group.title} aria-labelledby={`menu-group-${groupIndex}`}>
            <h2 id={`menu-group-${groupIndex}`} className={polish.menuGroupTitle}>
              {group.title}
            </h2>
            <ul className={polish.menuTiles}>
              {group.entries.map((entry, entryIndex) => {
                const Icon = entry.icon;
                /* Karonun sayfadaki sırası: beliriş gruplar boyunca TEK
                   akış (menu-tile-in). */
                const order =
                  groups.slice(0, groupIndex).reduce((sum, g) => sum + g.entries.length, 0) +
                  entryIndex;
                return (
                  <li key={entry.href} style={{ "--row": order } as CSSProperties}>
                    <Link
                      href={withLocale(entry.href, locale)}
                      prefetch={false}
                      data-featured={entry.href === "/teknik" || undefined}
                      className={polish.menuTile}
                    >
                      <span className={polish.menuIcon} aria-hidden>
                        <Icon weight="duotone" size={20} />
                      </span>
                      <span className={polish.menuTileText}>
                        <b>{entry.title}</b>
                        <small>{entry.hint}</small>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>

      {/* GitHub bandı burada YOK — sayfanın hemen altındaki alt bilgi zaten
          aynı bandı taşıyor ve iki kez göstermek gereksiz tekrar oluyordu. */}
    </MotionExperience>
  );
}
