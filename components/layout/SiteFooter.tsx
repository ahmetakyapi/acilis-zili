import Link from "next/link";
import { GithubLogo } from "@phosphor-icons/react/dist/ssr";
import { BellMark } from "@/components/brand/BellMark";
import { getI18n } from "@/lib/i18n";

/**
 * Sayfa altı — künye ve bölüm dizini.
 *
 * Masthead dar ekranda sekiz sekmenin hepsini taşıyamıyor; burası o eksiği
 * kapatan ikinci dizin. Mobilde de Menü sekmesinin altında aynı bağlantılar
 * var, yani hiçbir ekran yalnızca tek yoldan erişilebilir değil.
 */

const GITHUB_URL = "https://github.com/ahmetakyapi";

export async function SiteFooter() {
  const { t } = await getI18n();

  const columns: { title: string; links: { href: string; label: string }[] }[] =
    [
      {
        title: t.footer.sectionMarket,
        links: [
          { href: "/piyasalar", label: t.nav.markets },
          { href: "/sirketler", label: t.nav.companies },
          { href: "/makro", label: t.nav.macro },
          { href: "/bilancolar", label: t.nav.earnings },
          { href: "/takvim", label: t.nav.calendar },
          { href: "/karsilastir", label: t.compare.title },
        ],
      },
      {
        title: t.footer.sectionRead,
        links: [
          { href: "/rehber", label: t.nav.guide },
          { href: "/mercek", label: t.nav.stories },
          { href: "/haberler", label: t.nav.news },
          { href: "/bulten", label: t.footer.briefArchive },
          { href: "/feed.xml", label: t.footer.feed },
        ],
      },
      {
        title: t.footer.sectionAccount,
        links: [
          { href: "/favoriler", label: t.nav.watchlist },
          { href: "/ayarlar", label: t.nav.settings },
          { href: "/kvkk", label: t.footer.privacy },
        ],
      },
    ];

  return (
    <footer className="flex flex-col gap-7 border-t border-line pt-8">
      <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))]">
        {/* ---- Künye ---- */}
        <div className="flex flex-col gap-3">
          <Link href="/" className="flex w-fit items-center gap-2.5">
            <BellMark size={34} />
            <span className="display-ink display-ink-tight text-read font-bold tracking-[-0.03em]">
              {t.brand.name}
            </span>
          </Link>
          <p className="max-w-[38ch] text-small leading-[20px] text-muted">
            {t.footer.blurb}
          </p>
        </div>

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
            className="flex flex-col gap-2.5"
          >
            <p id={headingId} className="plate text-nano tracking-[0.09em]">
              {column.title}
            </p>
            <ul className="flex flex-col gap-2">
              {column.links.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    /* Telefonda 44px: dizin bağlantıları 28px yüksekliğindeydi
                       ve alt bilgi ekranın en dibinde, başparmağın en zor
                       nişan aldığı yerde duruyor. Masaüstünde eski ölçü
                       korunuyor — orada fare var, yüksek satırlar sütunu
                       gereksiz uzatıyordu. */
                    className="-my-1 flex min-h-11 items-center py-1 text-base text-body transition-colors hover:text-primary sm:min-h-0 sm:inline-block"
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

      {/* ---- Yasal satır + geliştirici imzası ----
           Geliştirici bandı önce accent gradientli bir kutuydu ve alt
           bilginin en dikkat çeken öğesi olmuştu; oysa buranın işi sessiz
           olmak. Artık aynı satırda küçük bir imza: ikon + ad. */}
      {/* 11.5px'lik satırda bağlantılar 17px yüksekliğinde bir dokunma hedefi
          bırakıyordu; dolgu ikisini de 32px'e çıkarır, negatif margin satırın
          kendi yüksekliğini korur. */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-tiny text-muted">
        <span>{t.footer.copyright}</span>
        <Link
          href="/kvkk"
          className="-my-2 inline-flex min-h-8 items-center py-2 transition-colors hover:text-primary"
        >
          {t.footer.privacy}
        </Link>
        <span>{t.footer.disclaimer}</span>
        <a
          href={GITHUB_URL}
          target="_blank"
          rel="noreferrer noopener"
          className="-my-2 inline-flex min-h-8 items-center gap-1.5 py-2 transition-colors hover:text-primary sm:ml-auto"
        >
          <GithubLogo weight="fill" size={14} aria-hidden />
          {t.footer.builtBy}
        </a>
      </div>
    </footer>
  );
}
