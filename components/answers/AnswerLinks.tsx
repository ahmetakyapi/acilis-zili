import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { EVENT_PAGES } from "@/lib/event-pages";
import type { Dictionary } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import styles from "./Answers.module.css";

/**
 * Soru sayfalarını birbirine ve `/takvim`e bağlayan şerit (14 Kasım 2026).
 *
 * Altı sayfa da arama sonucundan tek başına açılıyor; okurun bir sonraki
 * sorusu ("tatil ne zaman" → "o gün kaçta kapanıyor" → "FOMC ne zaman")
 * komşu sayfada. Liste tek yerde: yeni olay sayfası `EVENT_PAGES`e girince
 * şeritte de görünür. `current` bulunulan sayfanın yolu; kendine bağlantı
 * basılmaz.
 */
export function AnswerLinks({
  t,
  current,
  className,
}: {
  t: Dictionary;
  /** Dil öneksiz yol — "/takvim/fomc". */
  current?: string;
  className?: string;
}) {
  const links = [
    { href: "/abd-borsasi-saatleri", label: t.quickAnswers.hours },
    { href: "/abd-borsasi-tatil-gunleri", label: t.quickAnswers.holidays },
    ...EVENT_PAGES.map((page) => ({
      href: `/takvim/${page.slug}`,
      label: t.eventPages.pages[page.slug].link,
    })),
  ].filter((link) => link.href !== current);

  return (
    <nav aria-label={t.quickAnswers.navLabel} className={cn(styles.links, className)}>
      <h2 className="plate">{t.quickAnswers.title}</h2>
      <ul className={styles.linkRow}>
        {links.map((link) => (
          <li key={link.href}>
            <Link href={link.href} className={styles.link}>
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
