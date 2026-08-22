import Link from "next/link";
import {
  Bell,
  BookOpen,
  Buildings,
  CalendarBlank,
  CaretRight,
  ChartBar,
  Envelope,
  FileText,
  Gear,
  Heart,
  Newspaper,
  Percent,
  Scroll,
  ShieldCheck,
  SignIn,
  SignOut,
  TrendUp,
} from "@phosphor-icons/react/dist/ssr";
import { auth } from "@/auth";
import { signOutAction } from "@/app/actions/auth";
import { PageHeader, Panel, ButtonLink } from "@/components/ui/primitives";
import { getI18n } from "@/lib/i18n";
import { pageMetadata } from "@/lib/page-meta";

/**
 * Menü — mobilde ürünün tam dizini.
 *
 * Alt çubukta beş yer var, ürünün on bir ekranı. Diğerlerine eskiden yalnızca
 * masaüstü masthead'inden ya da ana sayfadaki kartlardan ulaşılabiliyordu; bu
 * sayfa o boşluğu kapatıyor. Masaüstünde de çalışır ama oraya bir sekme
 * koymadık — masthead zaten aynı işi yapıyor.
 *
 * Bölümler ürünün kendi mantığıyla ayrılıyor: önce ölçüm ekranları, sonra
 * okunacak metin, sonra kişisel olan. Her satır tek dokunuşluk bir hedef
 * (min 52px) — sekme çubuğundan sonra en çok kullanılacak ekran burası.
 */

export const generateMetadata = pageMetadata({
  path: "/menu",
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
  const { t } = await getI18n();
  const session = await auth();
  const username = session?.user?.name ?? null;

  const groups: { title: string; entries: Entry[] }[] = [
    {
      title: t.menu.groupMarket,
      entries: [
        { href: "/piyasalar", icon: TrendUp, title: t.nav.markets, hint: t.menu.hintMarkets },
        { href: "/sirketler", icon: Buildings, title: t.nav.companies, hint: t.menu.hintCompanies },
        { href: "/makro", icon: Percent, title: t.nav.macro, hint: t.menu.hintMacro },
        { href: "/bilancolar", icon: FileText, title: t.nav.earnings, hint: t.menu.hintEarnings },
        { href: "/takvim", icon: CalendarBlank, title: t.nav.calendar, hint: t.menu.hintCalendar },
        { href: "/karsilastir", icon: ChartBar, title: t.compare.title, hint: t.menu.hintCompare },
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
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow={t.menu.eyebrow}
        title={t.menu.title}
        subtitle={t.menu.subtitle}
      />

      {/* Oturum kartı en üstte: mobilde giriş ve çıkış başka hiçbir yerde tek
          dokunuşta değil. */}
      <Panel className="flex items-center gap-3.5 p-4 sm:p-5">
        <span
          aria-hidden
          className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary-wash text-base font-bold uppercase text-primary-ink"
        >
          {username ? (
            username.slice(0, 2)
          ) : (
            <SignIn size={20} weight="duotone" />
          )}
        </span>
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
          <ButtonLink href="/giris" variant="primary" className="shrink-0">
            {t.nav.signIn}
          </ButtonLink>
        )}
      </Panel>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {groups.map((group) => (
          <Panel key={group.title} className="flex flex-col">
            <p className="plate px-4 pb-3 pt-4 text-nano tracking-[0.09em] sm:px-5">
              {group.title}
            </p>
            <ul>
              {group.entries.map((entry) => {
                const Icon = entry.icon;
                return (
                  <li key={entry.href}>
                    <Link
                      href={entry.href}
                      prefetch={false}
                      className="flex min-h-[52px] items-center gap-3 border-t border-line px-4 py-3 transition-colors hover:bg-primary-tint sm:px-5"
                    >
                      <Icon
                        weight="duotone"
                        size={20}
                        className="shrink-0 text-primary"
                        aria-hidden
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block text-base font-semibold text-strong">
                          {entry.title}
                        </span>
                        <span className="mt-px block truncate text-tiny text-muted">
                          {entry.hint}
                        </span>
                      </span>
                      <CaretRight
                        weight="bold"
                        size={13}
                        className="shrink-0 text-muted"
                        aria-hidden
                      />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </Panel>
        ))}
      </div>

      {/* GitHub bandı burada YOK — sayfanın hemen altındaki alt bilgi zaten
          aynı bandı taşıyor ve iki kez göstermek gereksiz tekrar oluyordu. */}
    </div>
  );
}
