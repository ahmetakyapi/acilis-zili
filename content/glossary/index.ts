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

/**
 * Kaç terim bu terime bağlanıyor — öteki terimlerin `related` dizilerinde
 * kaç kez geçtiği. Dizindeki "öne çıkan" seçimi buna dayanıyor: sözlüğün
 * kendi ağında en çok başvurulan kavram, o kategoride önce bilinmesi
 * gereken kavramdır. Bir editör tercihi değil, ölçülebilir bir sıra.
 */
export function glossaryIncoming(): ReadonlyMap<GlossarySlug, number> {
  const counts = new Map<GlossarySlug, number>();
  for (const meta of GLOSSARY_META) {
    for (const slug of "related" in meta ? meta.related : []) {
      if (isGlossarySlug(slug)) counts.set(slug, (counts.get(slug) ?? 0) + 1);
    }
  }
  return counts;
}

/**
 * Kategorideki komşular ve terimin kategorideki yeri — dizindeki sırayla
 * (dile göre alfabetik), yani okuyucunun listede gördüğü sırayla. Uçlarda
 * `null`: sıra dönmüyor, son terimden ilk terime atlamak "sonraki" değil.
 * `index` birden başlıyor; terim sayfasının konum şeridi onu yazıyor.
 */
export function glossaryNeighbors(
  slug: string,
  locale: string,
): { previous: GlossaryTerm | null; next: GlossaryTerm | null; index: number; total: number } {
  const term = glossaryTerm(slug, locale);
  if (!term) return { previous: null, next: null, index: 0, total: 0 };
  const siblings = glossaryTerms(locale).filter((entry) => entry.category === term.category);
  const index = siblings.findIndex((entry) => entry.slug === term.slug);
  return {
    previous: index > 0 ? siblings[index - 1] : null,
    next: index >= 0 && index < siblings.length - 1 ? siblings[index + 1] : null,
    index: index + 1,
    total: siblings.length,
  };
}
