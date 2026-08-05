/* ==========================================================================
   Rehber — kavram yazıları

   Neden veritabanında değil de depoda: bu metinler durağan ve editoryal.
   Bir tanımın yanlış olması bir fiyatın eski olmasından daha pahalı, o yüzden
   kod incelemesinden geçmeleri ve sürüm geçmişinde durmaları isteniyor.
   Mercek yazıları (`stories` tablosu) tam tersi: her akşam üretiliyor ve
   deploy beklemeden yazılabilmeli.

   Modülün üç katmanı var:
     meta.ts  — dilden bağımsız yapı (slug, konu, glif, ilişkiler, sıra)
     tr.ts    — Türkçe metinler   (Record<GuideSlug, GuideText>)
     en.ts    — İngilizce metinler (aynı tip — eksik çeviri derlemeyi kırar)
   Dışarıya yalnızca bu dosya açılır; sayfalar dil parametresiyle okur.

   Gövde sözdizimi `components/article/ArticleBody.tsx` içinde anlatılıyor:
   ## başlık, - madde, | tablo |, > alıntı, ::: kutu ... :::
   ========================================================================== */

import {
  GUIDE_META,
  GUIDE_TOPICS,
  type GuideSlug,
  type GuideTopicKey,
} from "./meta";
import { GUIDE_TR } from "./tr";
import { GUIDE_EN } from "./en";

export { GUIDE_TOPICS };
export type { GuideSlug, GuideTopicKey };

export type GuideArticle = {
  slug: GuideSlug;
  topic: GuideTopicKey;
  glyph: string;
  related: readonly string[];
  title: string;
  dek: string;
  bodyMd: string;
};

function assemble(meta: (typeof GUIDE_META)[number], locale: string): GuideArticle {
  const text = locale === "en" ? GUIDE_EN[meta.slug] : GUIDE_TR[meta.slug];
  const glyphEn = "glyphEn" in meta ? meta.glyphEn : undefined;
  return {
    slug: meta.slug,
    topic: meta.topic,
    glyph: locale === "en" && glyphEn ? glyphEn : meta.glyph,
    related: "related" in meta ? meta.related : [],
    ...text,
  };
}

/** Bütün yazılar, müfredat sırasında ve istenen dilde. */
export function guideArticles(locale: string): GuideArticle[] {
  return GUIDE_META.map((meta) => assemble(meta, locale));
}

export function guideArticle(slug: string, locale: string): GuideArticle | null {
  const meta = GUIDE_META.find((entry) => entry.slug === slug);
  return meta ? assemble(meta, locale) : null;
}

/** Sitemap gibi dilden bağımsız tüketiciler için yalnızca kimlikler. */
export const GUIDE_SLUGS: readonly GuideSlug[] = GUIDE_META.map(
  (entry) => entry.slug,
);

export function guideTopicLabel(key: GuideTopicKey, locale: string): string {
  const topic = GUIDE_TOPICS.find((entry) => entry.key === key);
  if (!topic) return key;
  return locale === "en" ? topic.labelEn : topic.labelTr;
}

export function guideTopicDesc(key: GuideTopicKey, locale: string): string {
  const topic = GUIDE_TOPICS.find((entry) => entry.key === key);
  if (!topic) return "";
  return locale === "en" ? topic.descEn : topic.descTr;
}
