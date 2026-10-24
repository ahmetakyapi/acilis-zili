import polish from "@/components/motion/UtilityExperience.module.css";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { ArrowRight, ArrowUpRight, GithubLogo, TelegramLogo } from "@phosphor-icons/react/dist/ssr";
import { BellMark } from "@/components/brand/BellMark";
import { getI18n } from "@/lib/i18n";
import { emailConfigured } from "@/lib/email";
import { CONTACT_EMAIL, TELEGRAM_URL } from "@/lib/site";

/**
 * Sayfa altı — künye ve bölüm dizini.
 *
 * Masthead'de yedi sekme ve "Daha Fazla" var; burası ekranların hepsini
 * tek bakışta sıralayan ikinci dizin, KVKK ve RSS de yalnızca burada. Mobilde
 * Menü sekmesinin altında aynı bağlantılar var, yani hiçbir ekran yalnızca
 * tek yoldan erişilebilir değil.
 */

const GITHUB_URL = "https://github.com/ahmetakyapi";

export async function SiteFooter() {
  const { t } = await getI18n();
  const digest = emailConfigured();

  const columns: { title: string; links: { href: string; label: string }[] }[] =
    [
      {
        title: t.footer.sectionMarket,
        links: [
          { href: "/piyasalar", label: t.nav.markets },
          { href: "/sirketler", label: t.nav.companies },
          { href: "/tarama", label: t.screener.title },
          { href: "/makro", label: t.nav.macro },
          { href: "/bilancolar", label: t.nav.earnings },
          { href: "/teknik", label: t.technical.title },
          { href: "/takvim", label: t.nav.calendar },
          { href: "/karsilastir", label: t.compare.title },
          { href: "/tema", label: t.themes.eyebrow },
          { href: "/yatirimcilar", label: t.investors.eyebrow },
        ],
      },
      {
        title: t.footer.sectionRead,
        links: [
          { href: "/rehber", label: t.nav.guide },
          { href: "/mercek", label: t.nav.stories },
          { href: "/topluluk", label: t.community.feed.title },
          { href: "/haberler", label: t.nav.news },
          { href: "/bulten", label: t.footer.briefArchive },
          { href: "/sozluk", label: t.glossary.title },
          { href: "/vergi", label: t.nav.taxTool },
          { href: "/feed.xml", label: t.footer.feed },
        ],
      },
      {
        title: t.footer.sectionAccount,
        links: [
          { href: "/favoriler", label: t.nav.watchlist },
          { href: "/yazilarim", label: t.community.mine.title },
          { href: "/raporum", label: t.bellReport.title },
          { href: "/portfoy", label: t.lira.portfolio.title },
          { href: "/ayarlar", label: t.nav.settings },
          { href: "/kvkk", label: t.footer.privacy },
        ],
      },
    ];

  return (
    <footer className={`${polish.footer} flex flex-col gap-8`}>
      <div className="grid gap-10 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] lg:gap-12">
        {/* ---- Künye + pazar özeti ----
             ESKİDEN künye tek başına sol sütunu tutuyordu ve altında 200
             piksellik boşluk vardı; sayfanın dibinde ayrıca "Açılış Zili"
             yazan dev, soluk bir ad duruyordu (17 Ekim, sahibinin itirazı:
             "çok kötü duruyor"). Dev ad kalktı; marka bloğu tonlu bir yüzey
             oldu ve boşluğu bir işle dolduruyor: pazar özetine abone olma
             yolu. Posta servisi kapalıysa (`emailConfigured`) çağrı hiç
             basılmaz — açılamayan bir postayı önermek tıklamayı yutmak. */}
        <div className={`${polish.footerBrand} flex flex-col gap-4`}>
          {/* Marka bağlantısı 34 piksel — zil işaretinin kendi boyu.
              Genişletme görünen künyeye dokunmuyor. */}
          <Link href="/" className="tap-44 flex w-fit items-center gap-2.5">
            <BellMark size={34} />
            <span className="display-ink display-ink-tight text-title font-extrabold tracking-[-0.03em]">
              {t.brand.name}
            </span>
          </Link>
          <p className="max-w-[44ch] text-read leading-[22px] text-body">
            {t.footer.blurb}
          </p>
          {digest ? (
            <div className={`${polish.footerDigest} flex flex-col gap-1.5`}>
              <p className="text-read font-bold text-strong">{t.footer.digestTitle}</p>
              <p className="text-small leading-[18px] text-muted">{t.footer.digestHint}</p>
              <Link
                href="/ayarlar#e-posta"
                className="tap-44 mt-1 inline-flex w-fit items-center gap-1.5 text-base font-semibold text-primary"
              >
                {t.footer.digestCta}
                <ArrowRight weight="bold" size={13} aria-hidden />
              </Link>
            </div>
          ) : null}
          {/* Telegram kanalı (24 Ekim): adres tanımlıysa, marka bloğunun
              son satırı — pazar özetinin yanında ikinci "takip et" yolu.
              Dış bağlantı: yeni sekme ve köşe oku. */}
          {TELEGRAM_URL ? (
            <a
              href={TELEGRAM_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="tap-44 inline-flex w-fit items-center gap-1.5 text-base font-semibold text-primary"
            >
              <TelegramLogo weight="fill" size={15} aria-hidden />
              {t.telegram.channelLink}
              <ArrowUpRight weight="bold" size={12} aria-hidden />
            </a>
          ) : null}
        </div>

        <div className="grid gap-8 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)] sm:gap-6">
          {columns.map((column, index) => {
            /* HER YER İMİNİN ADI VAR. Üç sütun da adsız `<nav>` idi ve ekran
               okuyucunun yer imi listesinde yalnızca "navigation, navigation,
               navigation" görünüyordu — hangisinin piyasa, hangisinin hesap
               olduğu ancak içine girip okuyunca anlaşılıyordu (WCAG 1.3.1).
               Ad, zaten ekranda duran sütun başlığından geliyor: ayrı bir
               sözlük anahtarı eklemeye gerek yok ve ikisi hiçbir zaman
               birbirinden ayrı düşemez. */
            const headingId = `footer-col-${index}`;
            return (
              <nav
                key={column.title}
                aria-labelledby={headingId}
                className="flex flex-col gap-3"
              >
                <p id={headingId} className="plate text-nano">
                  {column.title}
                </p>
                {/* Piyasa on bağlantı, ötekiler sekiz ve altı: tek sütunda
                    kalınca alt bilginin boyunu o tek sütun belirliyordu ve
                    yanındaki iki sütunun altı boş kalıyordu. Geniş ekranda
                    Piyasa kendi içinde iki sütun; en uzun sütun 10 satırdan
                    8'e iniyor. Telefonda bütün listeler zaten iki sütun
                    (UtilityExperience.module.css). */}
                <ul
                  className={
                    index === 0
                      ? "flex flex-col gap-2 sm:grid sm:grid-flow-col sm:grid-rows-5 sm:gap-x-6"
                      : "flex flex-col gap-2"
                  }
                >
                  {column.links.map((link) => (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        /* Besleme bir sayfa değil (XML döner): ön yükleme onu RSC
                           yükü diye boşuna çekiyordu. Tıklama yine tam gezinme. */
                        prefetch={link.href.endsWith(".xml") ? false : undefined}
                        /* Telefonda 44px: dizin bağlantıları 28px yüksekliğindeydi
                           ve alt bilgi ekranın en dibinde, başparmağın en zor
                           nişan aldığı yerde duruyor. Masaüstünde eski ölçü
                           korunuyor — orada fare var, yüksek satırlar sütunu
                           gereksiz uzatıyordu. */
                        className="footer-link -my-1 flex min-h-11 items-center py-1 text-base text-body transition-colors hover:text-primary sm:min-h-0 sm:inline-block"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            );
          })}
        </div>
      </div>

      {/* ---- Yasal satır + geliştirici imzası ----
           Geliştirici bandı önce accent gradientli bir kutuydu ve alt
           bilginin en dikkat çeken öğesi olmuştu; oysa buranın işi sessiz
           olmak. Artık aynı satırda küçük bir imza: ikon + ad. */}
      {/* 11.5px'lik satırda bağlantılar 17px yüksekliğinde bir dokunma hedefi
          bırakıyordu; dolgu ikisini de 32px'e çıkarır, negatif margin satırın
          kendi yüksekliğini korur. `.tap-44` telefonda kalan 12 pikseli de
          kapatıyor: burası sayfanın en dibi, başparmağın en zor nişan aldığı
          yer ve ölçüldüğünde 33 piksel çıkıyordu — sitenin kendi standardı
          44. Görünür satır aynı kalıyor. */}
      <div className={`${polish.footerBase} flex flex-wrap items-center gap-x-4 gap-y-2 text-tiny text-muted`}>
        <span>{t.footer.copyright}</span>
        <Link
          href="/kvkk"
          className="tap-44 -my-2 inline-flex min-h-8 items-center py-2 transition-colors hover:text-primary"
        >
          {t.footer.privacy}
        </Link>
        {/* Hakkında yasal satırda, KVKK'nın yanında: ikisi de "bu siteye ne
            kadar güvenebilirim" sorusunu cevaplıyor (kvkk/page.tsx başı). */}
        <Link
          href="/hakkinda"
          className="tap-44 -my-2 inline-flex min-h-8 items-center py-2 transition-colors hover:text-primary"
        >
          {t.about.footerLink}
        </Link>
        <a
          href={`mailto:${CONTACT_EMAIL}`}
          className="tap-44 -my-2 inline-flex min-h-8 items-center py-2 transition-colors hover:text-primary"
        >
          {t.footer.contact}
        </a>
        <span>{t.footer.disclaimer}</span>
        <a
          href={GITHUB_URL}
          target="_blank"
          rel="noreferrer noopener"
          className="tap-44 -my-2 inline-flex min-h-8 items-center gap-1.5 py-2 transition-colors hover:text-primary sm:ml-auto"
        >
          <GithubLogo weight="fill" size={14} aria-hidden />
          {t.footer.builtBy}
        </a>
      </div>
    </footer>
  );
}
