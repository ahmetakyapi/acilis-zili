import { MotionExperience } from "@/components/motion/PremiumMotion";
import polish from "@/components/motion/UtilityExperience.module.css";
import { GuideHint } from "@/components/article/GuideHint";
import { BreadcrumbJsonLd } from "@/components/seo/JsonLd";
import { PageHeader } from "@/components/ui/primitives";
import {
  GlossaryBrowser,
  type GlossaryBrowserItem,
} from "@/components/glossary/GlossaryBrowser";
import {
  GLOSSARY_CATEGORIES,
  GLOSSARY_SLUGS,
  glossaryCategoryLabel,
  glossaryTerms,
} from "@/content/glossary";
import { getI18n } from "@/lib/i18n";
import { pageMetadata } from "@/lib/page-meta";
import { foldForSearch } from "@/lib/search-fold";

export const generateMetadata = pageMetadata({
  path: "/sozluk",
  tr: {
    title: "Borsa Sözlüğü",
    description:
      "F/K'dan getiri eğrisine, RSI'dan W-8BEN'e: ABD borsalarını takip ederken karşına çıkan terimlerin kısa ve düz Türkçe tanımları.",
  },
  en: {
    title: "Market Glossary",
    description:
      "From P/E to the yield curve, RSI to W-8BEN: short, plain definitions of the terms you meet while following US markets.",
  },
});

/**
 * Sözlük dizini.
 *
 * KATEGORİYE GÖRE, harfe göre değil. Harf dizini bir kâğıt sözlüğün
 * alışkanlığı; burada okuyucunun sorusu çoğu zaman "bilançoda geçen şu
 * kelime" ya da "Fed'in şu terimi" — yani bağlam. Kategori içinde sıra
 * alfabetik (dilin kendi harf sırasıyla, `glossaryTerms`), aranan terim
 * arama kutusundan tek tuşla bulunuyor.
 *
 * Kısa açıklama tanımın İLK CÜMLESİ: dizinde her terimin altında iki satır,
 * sayfaya girmeden "doğru terim bu mu" sorusunu cevaplıyor.
 */

/** Tanımın ilk cümlesi — nokta, soru ya da ünlemle biten ilk parça. */
function firstSentence(text: string): string {
  const match = /^(.+?[.!?])(?:\s|$)/.exec(text);
  return match ? match[1] : text;
}

export default async function GlossaryIndexPage() {
  const { locale, t } = await getI18n();
  const terms = glossaryTerms(locale);

  const items: GlossaryBrowserItem[] = terms.map((term) => ({
    slug: term.slug,
    term: term.term,
    category: term.category,
    short: firstSentence(term.definition),
    haystack: [term.term, term.slug, ...term.match]
      .map((part) => foldForSearch(part, locale))
      .join(" "),
  }));

  return (
    <MotionExperience className={polish.page}>
      <BreadcrumbJsonLd locale={locale} items={[{ name: t.glossary.title, path: "/sozluk" }]} />
      <PageHeader
        eyebrow={t.glossary.eyebrow}
        title={t.glossary.title}
        subtitle={t.glossary.subtitle.replace("{count}", String(GLOSSARY_SLUGS.length))}
      />
      <GlossaryBrowser
        items={items}
        groups={GLOSSARY_CATEGORIES.map((category) => ({
          key: category.key,
          label: glossaryCategoryLabel(category.key, locale),
        }))}
        locale={locale}
        labels={{
          filterLabel: t.glossary.filterLabel,
          filterPlaceholder: t.glossary.filterPlaceholder,
          categoryLabel: t.glossary.categoryLabel,
          allCategories: t.glossary.allCategories,
          noResults: t.glossary.noResults,
          count: t.glossary.count,
        }}
      />
      <GuideHint
        label={t.guide.contextLabel}
        locale={locale}
        slugs={["hisse-senedi", "bilanco"]}
      />
    </MotionExperience>
  );
}
