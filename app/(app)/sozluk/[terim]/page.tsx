import { notFound } from "next/navigation";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import { MotionExperience } from "@/components/motion/PremiumMotion";
import polish from "@/components/motion/UtilityExperience.module.css";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { ArticleBody } from "@/components/article/ArticleBody";
import { GuideHint } from "@/components/article/GuideHint";
import { BreadcrumbJsonLd, DefinedTermJsonLd } from "@/components/seo/JsonLd";
import { PageHeader, Panel, PanelHeader } from "@/components/ui/primitives";
import {
  GLOSSARY_SLUGS,
  glossaryCategoryLabel,
  glossaryTerm,
} from "@/content/glossary";
import { getI18n } from "@/lib/i18n";
import { metaDescription, missingMetadata } from "@/lib/page-meta";
import { pageAlternates } from "@/lib/site";
import { articleAutoLinker } from "@/lib/autolink-data";

/**
 * Sözlük terimi.
 *
 * Sayfa kısa ve bilerek öyle: başlık, tanım, varsa örnek, ilişkili terimler
 * ve kavramı uzun anlatan rehber yazısı. Yazılardaki otomatik bağlantı bu
 * sayfaya iniyor; okuyucu tanımı okuyup yazısına dönmeli, burada ikinci bir
 * makaleye takılmamalı.
 *
 * Tanım `ArticleBody` ile çiziliyor: örnek `::: ornek` kutusu oluyor ve
 * tanımın içindeki BAŞKA terimler de bağlanıyor (terimin kendisi hariç —
 * `excludeTerm`). Sözlük böylece kendi içinde gezilebilir bir ağ.
 *
 * İKİ DİL DE HER ZAMAN VAR: içerik `Record<GlossarySlug, …>` tipinde ve
 * eksik çeviri derlemeyi kırıyor, o yüzden `hreflang` koşulsuz (rehberle
 * aynı gerekçe).
 */

export async function generateStaticParams() {
  return GLOSSARY_SLUGS.map((terim) => ({ terim }));
}

export async function generateMetadata(props: PageProps<"/sozluk/[terim]">) {
  const { terim } = await props.params;
  const { locale, t } = await getI18n();
  const term = glossaryTerm(terim, locale);
  if (!term) return missingMetadata(locale);
  return {
    title: t.glossary.metaTitle.replace("{term}", term.term),
    description: metaDescription(term.definition),
    alternates: pageAlternates(`/sozluk/${term.slug}`, locale),
  };
}

export default async function GlossaryTermPage(props: PageProps<"/sozluk/[terim]">) {
  const { terim } = await props.params;
  const { locale, t } = await getI18n();
  const term = glossaryTerm(terim, locale);
  if (!term) notFound();

  const related = term.related
    .map((slug) => glossaryTerm(slug, locale))
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

  /* Örnek bir `ornek` kutusu: etiketi yazılmadığı için dile göre
     varsayılan ("Örnek" / "Example") basılıyor. */
  const markdown = term.example
    ? `${term.definition}\n\n::: ornek\n${term.example}\n:::`
    : term.definition;
  const autoLink = await articleAutoLinker(locale, { excludeTerm: term.slug });
  const categoryLabel = glossaryCategoryLabel(term.category, locale);

  return (
    <MotionExperience className={polish.page}>
      <DefinedTermJsonLd
        name={term.term}
        description={term.definition}
        path={`/sozluk/${term.slug}`}
        setName={t.glossary.title}
        setPath="/sozluk"
        locale={locale}
      />
      <BreadcrumbJsonLd
        locale={locale}
        items={[
          { name: t.glossary.title, path: "/sozluk" },
          { name: term.term, path: `/sozluk/${term.slug}` },
        ]}
      />
      <Link
        href="/sozluk"
        className="tap-44 -my-2 inline-flex w-fit min-h-8 items-center gap-1.5 py-2 text-small font-semibold text-muted transition-colors hover:text-primary"
      >
        <ArrowLeft weight="bold" size={13} />
        {t.glossary.backToList}
      </Link>
      <PageHeader eyebrow={categoryLabel} title={term.term} />

      <Panel>
        <PanelHeader title={t.glossary.definition} />
        <div className="border-t border-line px-4 pb-5 pt-4 sm:px-5">
          <ArticleBody markdown={markdown} locale={locale} autoLink={autoLink} />
        </div>
        {related.length > 0 && (
          /* İlişkili terimler panelin İÇİNDE, hairline ile ayrılmış: yeni
             bir kutu açmak tanımın yanında ikinci bir içerik gibi duruyordu. */
          <nav
            aria-label={t.glossary.related}
            className="flex flex-col gap-2.5 border-t border-line px-4 py-4 sm:px-5"
          >
            <p className="plate text-nano">{t.glossary.related}</p>
            <ul className="flex flex-wrap gap-2">
              {related.map((entry) => (
                <li key={entry.slug}>
                  <Link
                    href={`/sozluk/${entry.slug}`}
                    prefetch={false}
                    className="inline-flex min-h-11 items-center rounded-full bg-surface-elevated px-3 py-1.5 text-small font-semibold text-body transition-colors hover:text-primary sm:min-h-8"
                  >
                    {entry.term}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </Panel>

      {term.guides.length > 0 && (
        <GuideHint label={t.glossary.guide} locale={locale} slugs={term.guides} />
      )}
    </MotionExperience>
  );
}
