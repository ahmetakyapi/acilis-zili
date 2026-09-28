import { ArrowRight, Lightbulb } from "@phosphor-icons/react/dist/ssr";
import { ArticleBody } from "@/components/article/ArticleBody";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { glossaryCategoryLabel, glossaryTerm, type GlossaryTerm } from "@/content/glossary";
import { GLOSSARY_MARKS } from "@/content/glossary/marks";
import type { AutoLinker } from "@/lib/autolink";
import type { Dictionary, Locale } from "@/lib/i18n";
import { GLOSSARY_CATEGORY_ICONS } from "./category-icons";
import { TermMark } from "./TermMark";
import styles from "./Glossary.module.css";

/**
 * Terim penceresinin gövdesi — SUNUCUDA çiziliyor (`glossaryPeekAction`).
 *
 * Neden sunucu: tanım ve örnek `ArticleBody` ile çiziliyor (otomatik
 * bağlantı, `**Etiket:**` kalıbı, `:::` blokları) ve o bileşen 1.500 satırı
 * aşkın, grafik bileşenleri taşıyan bir çizici. Onu istemciye indirmek
 * yerine pencerenin içeriği hazır bir React ağacı olarak geliyor; istemci
 * yalnızca pencereyi açıp kapatıyor.
 *
 * Detay sayfasının SADELEŞTİRİLMİŞ hâli: künye, ad, kavram işareti, tanım,
 * örnek ve ilgili terimler. İlişki ağı çizimi, önceki/sonraki gezinmesi ve
 * rehber ipucu sayfada kalıyor; pencerenin dibindeki bağlantı oraya gidiyor.
 * İlgili terim çipleri `data-peek` taşıyor: pencere onları yakalayıp aynı
 * pencerede açıyor, okuyucu terimden terime ekrandan çıkmadan geziyor.
 */
export function TermPeek({
  term,
  locale,
  t,
  autoLink,
}: {
  term: GlossaryTerm;
  locale: Locale;
  t: Dictionary;
  autoLink: AutoLinker;
}) {
  const { lede, rest } = splitLede(term.definition);
  const CategoryIcon = GLOSSARY_CATEGORY_ICONS[term.category];
  const related = term.related
    .map((slug) => glossaryTerm(slug, locale))
    .filter((entry): entry is GlossaryTerm => entry !== null);

  return (
    <article className={styles.peek}>
      <header className={styles.peekHead}>
        <div className={styles.peekTitle}>
          <p className={styles.peekEyebrow}>
            <CategoryIcon aria-hidden size={14} weight="bold" />
            {glossaryCategoryLabel(term.category, locale)}
          </p>
          <h2 className="display-ink">{term.term}</h2>
        </div>
        <span className={styles.peekMark} aria-hidden>
          <TermMark motif={GLOSSARY_MARKS[term.slug]} size="plate" draw />
        </span>
      </header>

      <p className={styles.peekLede}>{lede}</p>
      {rest && <ArticleBody markdown={rest} locale={locale} autoLink={autoLink} className={styles.peekRest} />}

      {term.example && (
        <div className={styles.exampleBox}>
          <Lightbulb aria-hidden size={20} weight="duotone" />
          <div>
            <p className={styles.peekLabel}>{t.glossary.example}</p>
            <ArticleBody markdown={term.example} locale={locale} autoLink={autoLink} />
          </div>
        </div>
      )}

      {related.length > 0 && (
        <nav aria-label={t.glossary.related} className={styles.peekRelated}>
          <p className={styles.peekLabel}>{t.glossary.related}</p>
          <ul>
            {related.map((entry) => (
              <li key={entry.slug}>
                <Link href={`/sozluk/${entry.slug}`} prefetch={false} data-peek={entry.slug} className={styles.peekChip}>
                  {entry.term}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}

      {/* `data-peek-exit`: pencere bu bağlantıyı yakalamıyor, tam sayfaya gidiyor. */}
      <Link href={`/sozluk/${term.slug}`} prefetch={false} className={styles.peekFull} data-peek-exit>
        {t.glossary.openFull}
        <ArrowRight aria-hidden size={14} weight="bold" />
      </Link>
    </article>
  );
}

/** Tanımı ilk cümle ve geri kalanı olarak böler — detay sayfasıyla aynı kural. */
export function splitLede(text: string): { lede: string; rest: string } {
  const match = /^(.+?[.!?])(?:\s+|$)/.exec(text);
  if (!match) return { lede: text, rest: "" };
  return { lede: match[1], rest: text.slice(match[0].length).trim() };
}
