import Link from "next/link";
import { ArrowUpRight, GithubLogo } from "@phosphor-icons/react/dist/ssr";
import { BellMark } from "@/components/brand/BellMark";
import { getI18n } from "@/lib/i18n";

/**
 * Sayfa altı — künye, bölüm dizini ve geliştirici bandı.
 *
 * Masthead dar ekranda sekiz sekmenin hepsini taşıyamıyor; burası o eksiği
 * kapatan ikinci dizin. Mobilde de Menü sekmesinin altında aynı bağlantılar
 * var, yani hiçbir ekran yalnızca tek yoldan erişilebilir değil.
 *
 * GitHub bandı bilinçli olarak tek accent yüzey: sayfada başka hiçbir şey
 * dikkat istemiyorsa göz oraya gider ve projenin kaynağı bir tık uzakta olur.
 */

const GITHUB_URL = "https://github.com/ahmetakyapi";
const REPO_URL = "https://github.com/ahmetakyapi/acilis-zili";

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
        ],
      },
      {
        title: t.footer.sectionRead,
        links: [
          { href: "/rehber", label: t.nav.guide },
          { href: "/mercek", label: t.nav.stories },
          { href: "/haberler", label: t.nav.news },
          { href: "/bulten", label: t.footer.briefArchive },
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
            <BellMark size={30} />
            <span className="display-ink display-ink-tight text-[16px] font-bold tracking-[-0.03em]">
              {t.brand.name}
            </span>
          </Link>
          <p className="max-w-[38ch] text-[12.5px] leading-[20px] text-muted">
            {t.footer.blurb}
          </p>
        </div>

        {columns.map((column) => (
          <nav key={column.title} className="flex flex-col gap-2.5">
            <p className="plate text-[10px] tracking-[0.09em]">{column.title}</p>
            <ul className="flex flex-col gap-2">
              {column.links.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-[13px] text-body transition-colors hover:text-primary"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>

      {/* ---- Geliştirici bandı ---- */}
      <a
        href={GITHUB_URL}
        target="_blank"
        rel="noreferrer noopener"
        className="group flex items-center gap-3.5 rounded-(--radius-lg) border border-primary-faint bg-[linear-gradient(115deg,var(--primary-wash),var(--primary-tint))] px-4 py-3.5 transition-colors hover:border-primary sm:px-5"
      >
        <GithubLogo
          weight="fill"
          size={26}
          className="shrink-0 text-primary"
          aria-hidden
        />
        <span className="min-w-0 flex-1">
          <span className="block text-[13.5px] font-bold text-strong">
            {t.footer.builtBy}
          </span>
          <span className="mt-0.5 block text-[12px] leading-snug text-body">
            {t.footer.builtByHint}
          </span>
        </span>
        <ArrowUpRight
          weight="bold"
          size={16}
          className="shrink-0 text-primary transition-transform group-hover:-translate-y-px group-hover:translate-x-px"
          aria-hidden
        />
      </a>

      {/* ---- Yasal satır ---- */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11.5px] text-muted">
        <span>{t.footer.copyright}</span>
        <Link href="/kvkk" className="transition-colors hover:text-primary">
          {t.footer.privacy}
        </Link>
        <a
          href={REPO_URL}
          target="_blank"
          rel="noreferrer noopener"
          className="transition-colors hover:text-primary"
        >
          {t.footer.sourceCode}
        </a>
        <span className="w-full sm:ml-auto sm:w-auto">
          {t.footer.disclaimer}
        </span>
      </div>
    </footer>
  );
}
