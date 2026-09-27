/* ==========================================================================
   Sözlük — dışa açık yüz

   Rehberle aynı düzen (`content/guide/index.ts`): meta + tr + en, sayfalar
   yalnızca bu dosyadan ve dil parametresiyle okur.

   Terimlerin iki okuyucusu var: `/sozluk` sayfaları ve yazı gövdelerindeki
   otomatik bağlantı (`lib/autolink.ts`, `components/article/ArticleBody.tsx`).
   İkincisi yalnızca `match` biçimlerini ve slug'ı istiyor; onun için ayrı
   ve hafif bir dışa aktarım var (`glossaryMatchList`).
   ========================================================================== */

import {
  GLOSSARY_CATEGORIES,
  GLOSSARY_META,
  type GlossaryCategoryKey,
  type GlossarySlug,
} from "./meta";
import { GLOSSARY_TR } from "./tr";
import { GLOSSARY_EN } from "./en";

export { GLOSSARY_CATEGORIES };
export type { GlossaryCategoryKey, GlossarySlug };

export type GlossaryTerm = {
  slug: GlossarySlug;
  category: GlossaryCategoryKey;
  related: readonly GlossarySlug[];
  /** Rehber yazıları — dar konulu olan önce; var olmayan `GuideHint`te düşer. */
  guides: string[];
  term: string;
  definition: string;
  example: string | null;
  match: readonly string[];
};

const SLUG_SET: ReadonlySet<string> = new Set(GLOSSARY_META.map((entry) => entry.slug));

export function isGlossarySlug(value: string): value is GlossarySlug {
  return SLUG_SET.has(value);
}

function assemble(meta: (typeof GLOSSARY_META)[number], locale: string): GlossaryTerm {
  const text = locale === "en" ? GLOSSARY_EN[meta.slug] : GLOSSARY_TR[meta.slug];
  const related = "related" in meta ? meta.related : [];
  return {
    slug: meta.slug,
    category: meta.category,
    /* İlişki dizisi düz dize taşıyor (dizi kendi slug tipine
       başvuramıyor); bilinmeyen slug burada düşüyor, test de yakalıyor. */
    related: related.filter(isGlossarySlug),
    guides: [
      ...("guideMore" in meta ? [meta.guideMore] : []),
      ...("guide" in meta ? [meta.guide] : []),
    ],
    term: text.term,
    definition: text.definition,
    example: text.example ?? null,
    match: text.match,
  };
}

/**
 * Bütün terimler, istenen dilde ve ALFABETİK sırada.
 *
 * Sıralama dile göre (`localeCompare`): Türkçede "Ç" C'den, "Ş" S'den sonra
 * gelir; varsayılan kod noktası sırası onları Z'nin arkasına atıyordu.
 */
export function glossaryTerms(locale: string): GlossaryTerm[] {
  const collator = new Intl.Collator(locale === "en" ? "en" : "tr", {
    sensitivity: "base",
  });
  return GLOSSARY_META.map((meta) => assemble(meta, locale)).sort((a, b) =>
    collator.compare(a.term, b.term),
  );
}

export function glossaryTerm(slug: string, locale: string): GlossaryTerm | null {
  const meta = GLOSSARY_META.find((entry) => entry.slug === slug);
  return meta ? assemble(meta, locale) : null;
}

/** Sitemap gibi dilden bağımsız tüketiciler için yalnızca kimlikler. */
export const GLOSSARY_SLUGS: readonly GlossarySlug[] = GLOSSARY_META.map(
  (entry) => entry.slug,
);

export function glossaryCategoryLabel(key: GlossaryCategoryKey, locale: string): string {
  const category = GLOSSARY_CATEGORIES.find((entry) => entry.key === key);
  if (!category) return key;
  return locale === "en" ? category.labelEn : category.labelTr;
}

/** Otomatik bağlantının sözlüğü: slug ve o dildeki yüzey biçimleri. */
export function glossaryMatchList(
  locale: string,
): { slug: GlossarySlug; forms: readonly string[] }[] {
  const texts = locale === "en" ? GLOSSARY_EN : GLOSSARY_TR;
  return GLOSSARY_META.map((meta) => ({
    slug: meta.slug,
    forms: texts[meta.slug].match,
  }));
}
