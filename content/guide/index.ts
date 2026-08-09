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
  GUIDE_LEVELS,
  GUIDE_META,
  GUIDE_TOPICS,
  guideLevel,
  guideLevelLabel,
  type GuideLevel,
  type GuideSlug,
  type GuideTopicKey,
} from "./meta";
import { GUIDE_TR } from "./tr";
import { GUIDE_EN } from "./en";

export { GUIDE_LEVELS, GUIDE_TOPICS, guideLevelLabel };
export type { GuideLevel, GuideSlug, GuideTopicKey };

export type GuideArticle = {
  slug: GuideSlug;
  topic: GuideTopicKey;
  /** Konudan türeyen zorluk; istisnalar meta.ts'te işaretli. */
  level: GuideLevel;
  glyph: string;
  related: readonly string[];
  title: string;
  dek: string;
  bodyMd: string;
};

/* ==========================================================================
   Müfredat sırası

   Kural iki basamaklı: önce konu bloğu, sonra blok içinde ZORLUK — temel,
   orta, ileri. Sıralama KARARLI olduğu için aynı seviyedeki yazılar
   `meta.ts`'teki elle kurulmuş sırayı koruyor; yani "bilanço günü nasıl
   okunur" hâlâ "bilanço"nun hemen ardından geliyor.

   Sıra BURADA türetiliyor, `meta.ts` yeniden dizilerek değil: dosyadaki
   diziliş yazıların birbirine olan anlatı yakınlığını taşıyor ve o bilgi
   kaybolursa yeni yazının nereye gireceği belirsizleşir. Kaynak sırası
   yazarın, ekrandaki sıra okuyucunun.

   BEDELİ VAR ve bilerek ödeniyor: seviye atlayan birkaç komşuluk bozuluyor —
   "temettü" kendi bloğunun başına, "getiri eğrisi" faiz-tahvilden birkaç sıra
   öteye düşüyor. Karşılığında liste, hiç bilmeyen birinin okuyabileceği tek
   bir merdiven oluyor. Kopan bağları `related` zaten taşıyor.

   Tek sıra hem listeyi hem yazı sayfasındaki önceki/sıradaki gezinmesini
   besliyor; ikisi ayrılırsa okuyucu listede gördüğü sıradan başka bir yere
   götürülür.
   ========================================================================== */

const LEVEL_ORDER: Record<GuideLevel, number> = { temel: 0, orta: 1, ileri: 2 };

const CURRICULUM = [...GUIDE_META].sort((a, b) => {
  const topicDelta =
    GUIDE_TOPICS.findIndex((topic) => topic.key === a.topic) -
    GUIDE_TOPICS.findIndex((topic) => topic.key === b.topic);
  if (topicDelta !== 0) return topicDelta;
  return LEVEL_ORDER[guideLevel(a)] - LEVEL_ORDER[guideLevel(b)];
});

function assemble(meta: (typeof GUIDE_META)[number], locale: string): GuideArticle {
  const text = locale === "en" ? GUIDE_EN[meta.slug] : GUIDE_TR[meta.slug];
  const glyphEn = "glyphEn" in meta ? meta.glyphEn : undefined;
  return {
    slug: meta.slug,
    topic: meta.topic,
    level: guideLevel(meta),
    glyph: locale === "en" && glyphEn ? glyphEn : meta.glyph,
    related: "related" in meta ? meta.related : [],
    ...text,
  };
}

/** Bütün yazılar, müfredat sırasında ve istenen dilde. */
export function guideArticles(locale: string): GuideArticle[] {
  return CURRICULUM.map((meta) => assemble(meta, locale));
}

export function guideArticle(slug: string, locale: string): GuideArticle | null {
  const meta = GUIDE_META.find((entry) => entry.slug === slug);
  return meta ? assemble(meta, locale) : null;
}

/** Sitemap gibi dilden bağımsız tüketiciler için yalnızca kimlikler. */
export const GUIDE_SLUGS: readonly GuideSlug[] = CURRICULUM.map(
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
