import { MotionExperience, ScrollProgress } from "@/components/motion/PremiumMotion";
import polish from "@/components/motion/UtilityExperience.module.css";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import {
  Bell,
  ArrowUpRight,
  BookOpen,
  Buildings,
  CalendarBlank,
  ChartBar,
  ChartBarHorizontal,
  ChartPieSlice,
  Funnel,
  FunnelSimple,
  ChatsCircle,
  PencilSimpleLine,
  BellRinging,
  ChartLineUp,
  Envelope,
  FileText,
  Gear,
  Heart,
  Bank,
  Briefcase,
  Receipt,
  SquaresFour,
  Palette,
  PuzzlePiece,
  TextAa,
  Newspaper,
  Percent,
  Scroll,
  ShieldCheck,
  Sparkle,
  SignIn,
  SignOut,
  TrendUp,
  UsersThree,
} from "@phosphor-icons/react/dist/ssr";
import { auth } from "@/auth";
import { ChangelogBadge } from "@/components/changelog/ChangelogBadge";
import { LATEST_CHANGE_DATE } from "@/lib/changelog";
import { AvatarTile } from "@/components/brand/AvatarIcon";
import { getUserAvatar } from "@/lib/avatar-data";
import { SignOutForm } from "@/components/auth/SignOutForm";
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

/** Vurgulu karolar: Claude analizinin iki odağı (Teknik Analiz, Hisse Seçimi). */
const FEATURED = new Set(["/teknik", "/hisse-secimi"]);

type Entry = {
  href: string;
  icon: typeof Bell;
  title: string;
  hint: string;
  /** Yenilikler karosu: okurun görmediği giriş varsa "Yeni" hapı. */
  changelog?: boolean;
};

export default async function MenuPage() {
  const { t, locale } = await getI18n();
  const session = await auth();
  const username = session?.user?.name ?? null;
  const avatar = session?.user?.id ? await getUserAvatar(session.user.id) : null;

  /* GRUPLAR MASAÜSTÜNÜN "DAHA FAZLA" PANELİYLE AYNI (25 Ekim düzeltmesi).
     Telefon dizini kendi gruplarını taşıyordu: Portföy ve Vergi analiz
     araçlarının içinde, Rehber/Sözlük/Hisseyi Bil okumanın içinde, Günün
     Grafiği ile Günün Posteri okuma listesinin dibinde. Masaüstünde aynı
     ekranlar başka başlıklar altındaydı ve iki cihazı kullanan okur aynı
     ekranı iki farklı yerde arıyordu. Sıra ve başlıklar artık
     `MORE_GROUPS` sırası ve aynı sözlük anahtarları (`t.nav.moreGroup*`):
     Analiz Araçları, Portföy ve Maliyet, Piyasa, Öğren, Oku, Her Gün;
     sonda Hesap. Şeritteki ekranlar (Piyasalar, Şirketler, Bilançolar,
     Teknik, Mercek, Temalar) masaüstünde panelde değil şeritte; telefonda
     şerit yok, o yüzden anlamca ait oldukları gruba giriyorlar.

     Analiz EN ÜSTTE (11 Ekim, sahibinin isteği: Hisse Seçimi "mantıklı,
     güzel bir yere"): Piyasalar ve Bilançolar zaten alt çubukta, menüyü
     açan okuyucu çoğunlukla çubukta olmayanı arıyor. */
  const groups: { title: string; entries: Entry[] }[] = [
    {
      title: t.nav.moreGroupAnalyze,
      entries: [
        { href: "/teknik", icon: ChartLineUp, title: t.technical.title, hint: t.menu.hintTechnical },
        /* Hisse Seçimi telefonda bir dönem yalnız hisse panelinden açılıyordu:
           masaüstü "Daha Fazla"da (nav-items.ts) ama bu elle yazılmış
           listede yoktu ve `hintScreening` hiçbir yerde basılmıyordu. */
        { href: "/hisse-secimi", icon: Funnel, title: t.screening.title, hint: t.menu.hintScreening },
        { href: "/tarama", icon: FunnelSimple, title: t.screener.title, hint: t.menu.hintScreener },
        { href: "/karsilastir", icon: ChartBar, title: t.compare.title, hint: t.menu.hintCompare },
      ],
    },
    {
      /* Kişisel hesap ekranları ve getiriden düşen maliyetler (vergi,
         komisyon) — masaüstünde de bu üçü. */
      title: t.nav.moreGroupMine,
      entries: [
        { href: "/portfoy", icon: Briefcase, title: t.lira.portfolio.title, hint: t.menu.hintPortfolio },
        { href: "/vergi", icon: Receipt, title: t.nav.taxTool, hint: t.menu.hintTax },
        { href: "/araci-kurumlar", icon: Bank, title: t.brokers.title, hint: t.brokers.menuHint },
      ],
    },
    {
      title: t.menu.groupMarket,
      entries: [
        { href: "/piyasalar", icon: TrendUp, title: t.nav.markets, hint: t.menu.hintMarkets },
        { href: "/sirketler", icon: Buildings, title: t.nav.companies, hint: t.menu.hintCompanies },
        { href: "/bilancolar", icon: FileText, title: t.nav.earnings, hint: t.menu.hintEarnings },
        { href: "/makro", icon: Percent, title: t.nav.macro, hint: t.menu.hintMacro },
        { href: "/takvim", icon: CalendarBlank, title: t.nav.calendar, hint: t.menu.hintCalendar },
        { href: "/tema", icon: SquaresFour, title: t.themes.eyebrow, hint: t.menu.hintThemes },
        { href: "/yatirimcilar", icon: UsersThree, title: t.investors.eyebrow, hint: t.menu.hintInvestors },
      ],
    },
    {
      /* Durağan müfredat ve günlük bulmaca: Hisseyi Bil oyun ama öğrettiği
         şey şirketlerin kimliği (nav-items.ts, "learn"). */
      title: t.nav.moreGroupLearn,
      entries: [
        { href: "/rehber", icon: BookOpen, title: t.nav.guide, hint: t.menu.hintGuide },
        { href: "/sozluk", icon: TextAa, title: t.glossary.title, hint: t.menu.hintGlossary },
        { href: "/bulmaca", icon: PuzzlePiece, title: t.stockPuzzle.title, hint: t.stockPuzzle.menuHint },
      ],
    },
    {
      title: t.nav.moreGroupRead,
      entries: [
        /* Mercek başta: sitenin kendi yazdığı ve başka hiçbir yerde
           bulunmayan içerik bu. */
        { href: "/mercek", icon: Scroll, title: t.nav.stories, hint: t.menu.hintStories },
        { href: "/topluluk", icon: ChatsCircle, title: t.community.feed.title, hint: t.menu.hintCommunity },
        { href: "/haberler", icon: Newspaper, title: t.nav.news, hint: t.menu.hintNews },
        { href: "/bulten", icon: Envelope, title: t.footer.briefArchive, hint: t.menu.hintBrief },
      ],
    },
    {
      /* Her seansın sonunda yenilenen iki parça (24 Ekim) ve günde bir
         yenilenen Olasılıklar (25 Ekim) — masaüstünde
         panelin dibindeki "Her Gün" bandı. */
      title: t.nav.moreGroupDaily,
      entries: [
        { href: "/gunun-grafigi", icon: ChartBarHorizontal, title: t.dailyChart.title, hint: t.dailyChart.menuHint },
        { href: "/gun", icon: Palette, title: t.daySignature.poster.title, hint: t.daySignature.archive.menuHint },
        { href: "/olasiliklar", icon: ChartPieSlice, title: t.probabilities.title, hint: t.probabilities.menuHint },
      ],
    },
    {
      title: t.menu.groupAccount,
      entries: [
        { href: "/favoriler", icon: Heart, title: t.nav.watchlist, hint: t.menu.hintWatchlist },
        { href: "/yazilarim", icon: PencilSimpleLine, title: t.community.mine.title, hint: t.menu.hintMyPosts },
        { href: "/raporum", icon: BellRinging, title: t.bellReport.title, hint: t.menu.hintReport },
        { href: "/ayarlar", icon: Gear, title: t.nav.settings, hint: t.menu.hintSettings },
        { href: "/kvkk", icon: ShieldCheck, title: t.footer.privacy, hint: t.menu.hintPrivacy },
      ],
    },
    {
      /* YENİLİKLER EN ALTTA, KENDİ BÖLÜMÜNDE (25 Ekim). Masaüstünde panelin
         dibindeki tam genişlik satırın karşılığı: bir ekran grubu değil,
         sitenin kendisi hakkında (gerekçe nav-items.ts → "/yenilikler").
         Telefonda tek karo tam genişlik (`.menuTiles` tek kalan son karo
         kuralı). Alt çubuktaki Menü sekmesinin noktası buraya çağırıyor. */
      title: t.changelog.menuGroup,
      entries: [
        { href: "/yenilikler", icon: Sparkle, title: t.changelog.title, hint: t.changelog.menuHint, changelog: true },
      ],
    },
  ];

  return (
    <MotionExperience className={`${polish.page} ${polish.menu}`}>
      <ScrollProgress />
      <PageHeader
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
          <SignOutForm>
            <button
              type="submit"
              className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md border border-line bg-surface px-3 text-small font-semibold text-body transition-colors hover:border-line-strong hover:text-strong"
            >
              <SignOut weight="duotone" size={15} />
              {t.nav.signOut}
            </button>
          </SignOutForm>
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
            <ul className={polish.menuTiles} data-motion-stagger>
              {group.entries.map((entry) => {
                const Icon = entry.icon;
                return (
                  <li key={entry.href}>
                    <Link
                      href={withLocale(entry.href, locale)}
                      prefetch={false}
                      data-featured={FEATURED.has(entry.href) || undefined}
                      className={polish.menuTile}
                    >
                      <span className={polish.menuIcon} aria-hidden>
                        <Icon weight="duotone" size={20} />
                      </span>
                      <span className={polish.menuTileText}>
                        <b>
                          {entry.title}
                          {entry.changelog && (
                            <ChangelogBadge
                              latest={LATEST_CHANGE_DATE}
                              label={t.changelog.badge}
                              variant="pill"
                              className="ml-2 align-[2px]"
                            />
                          )}
                        </b>
                        <small>{entry.hint}</small>
                      </span>
                      <ArrowUpRight className={polish.menuArrow} size={15} weight="bold" aria-hidden />
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
