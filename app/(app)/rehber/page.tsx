import Link from "next/link";
import { ArrowLeft, ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { LevelBadge } from "@/components/article/LevelBadge";
import { GlyphTile } from "@/components/article/GlyphTile";
import { readingMinutes } from "@/components/article/ArticleBody";
import { EmptyState, PageHeader, Panel } from "@/components/ui/primitives";
import {
  GUIDE_TOPICS,
  guideArticles,
  guideTopicDesc,
  guideTopicLabel,
  type GuideArticle,
  type GuideTopicKey,
} from "@/content/guide";
import { getI18n, type Dictionary, type Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

import type { Metadata } from "next";

/* Paylaşım künyesi. Sayfa kendi başlığını vermediğinde Next kökteki
   varsayılanı miras alıyor ve her bölüm linki aynı metinle
   paylaşılıyordu. Metin, bölümün OG kartındaki cümleyle aynı. */
export const metadata: Metadata = {
  title: "Rehber",
  description:
    "Borsayı anlatan yazılar — kavramdan stratejiye, kolaydan zora.",
};

/**
 * Rehber — müfredatın vitrini.
 *
 * Sayfanın iki hâli var ve ikisi farklı soruya cevap veriyor:
 *
 * FİLTRESİZ hâl "nereden başlamalıyım" sorusunu cevaplıyor: girişte dört
 * bölmeli müfredat şeridi (sıra numarası, konu adı, yazı sayısı ve okuma
 * süresi), altında konu konu bölümlenmiş liste. Bölmeler sayfa içi çapalara
 * gider — filtre değil, içindekiler tablosu. Konu AÇIKLAMASI şeritte yok,
 * yalnızca bölüm başlığında: ikisi birden yazınca aynı cümle art arda iki
 * kez okunuyordu.
 *
 * FİLTRELİ hâl (?konu=...) "yalnızca bu konuyu göster" diyor: konunun kendi
 * başlığı ve açıklamasıyla açılır, tek ızgara listelenir. Eski çip sırası
 * kaldırıldı — karolar, bölüm başlıkları ve çipler aynı işi üç kez
 * yapıyordu; kalan iki yol (karo → çapa, "Yalnızca Bunlar" → filtre) yetiyor.
 */

export default async function GuidePage(props: PageProps<"/rehber">) {
  const search = await props.searchParams;
  const { locale, t } = await getI18n();

  const requested =
    typeof search.konu === "string" ? (search.konu as GuideTopicKey) : null;
  const activeTopic =
    GUIDE_TOPICS.find((topic) => topic.key === requested)?.key ?? null;

  const all = guideArticles(locale);
  const groupOf = (key: GuideTopicKey) =>
    all.filter((article) => article.topic === key);
  const minutesOf = (articles: GuideArticle[]) =>
    articles.reduce((sum, article) => sum + readingMinutes(article.bodyMd), 0);

  return (
    <div className="flex flex-col gap-7">
      <PageHeader
        eyebrow={t.guide.eyebrow}
        title={t.guide.title}
        subtitle={t.guide.subtitle}
      />

      {activeTopic ? (
        <TopicView
          topic={activeTopic}
          articles={groupOf(activeTopic)}
          locale={locale}
          t={t}
        />
      ) : (
        <>
          <CurriculumStrip
            all={all}
            groupOf={groupOf}
            minutesOf={minutesOf}
            locale={locale}
            t={t}
          />

          {GUIDE_TOPICS.map((topic, index) => {
            const group = groupOf(topic.key);
            if (group.length === 0) return null;
            return (
              /* scroll-mt: çapaya atlayınca başlık yapışkan üst çubuğun
                 altında kalmasın. */
              <section
                key={topic.key}
                id={`konu-${topic.key}`}
                className="flex scroll-mt-24 flex-col gap-4"
              >
                <div className="flex flex-col gap-1.5 border-b border-line pb-3">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span className="numeral text-[12px] font-bold text-primary">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <h2 className="display-ink display-ink-tight w-fit text-[19px] font-bold tracking-[-0.03em]">
                      {guideTopicLabel(topic.key, locale)}
                    </h2>
                    <span className="numeral text-[12px] text-muted">
                      {group.length} {t.guide.articlesCount} · ~
                      {minutesOf(group)} {t.guide.readMinutes}
                    </span>
                    <Link
                      href={`/rehber?konu=${topic.key}`}
                      scroll={false}
                      /* -my-2 py-2: 12px'lik metin tek başına 18px'lik bir
                         dokunma hedefi bırakıyordu; dolgu 32px'e çıkarır,
                         negatif margin satırı olduğu yerde tutar. */
                      className="-my-2 ml-auto inline-flex min-h-8 shrink-0 items-center py-2 text-[12px] font-semibold text-primary transition-colors hover:text-primary-hover"
                    >
                      {t.guide.onlyThis}
                    </Link>
                  </div>
                  <p className="max-w-[64ch] text-[12.5px] leading-[19px] text-muted">
                    {guideTopicDesc(topic.key, locale)}
                  </p>
                </div>
                <ArticleGrid articles={group} locale={locale} t={t} />
              </section>
            );
          })}
        </>
      )}
    </div>
  );
}

/**
 * Müfredat şeridi — dört konu, sıra numarası ve kapsamıyla.
 *
 * Karolar filtrelemez, sayfa içinde ilgili bölüme götürür: yeni gelen
 * okuyucunun sorusu "bu konudaki yazıları süz" değil "nereden başlayayım".
 * Toplam sayaç şeridin başlığında durur — rehberin büyüklüğü tek satırda.
 */
function CurriculumStrip({
  all,
  groupOf,
  minutesOf,
  locale,
  t,
}: {
  all: GuideArticle[];
  groupOf: (key: GuideTopicKey) => GuideArticle[];
  minutesOf: (articles: GuideArticle[]) => number;
  locale: Locale;
  t: Dictionary;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="display-ink display-ink-tight w-fit text-[15px] font-bold">
          {t.guide.curriculum}
        </h2>
        <span className="numeral text-[11.5px] text-muted">
          {all.length} {t.guide.articlesCount} · ~{minutesOf(all)}{" "}
          {t.guide.readMinutes}
        </span>
      </div>
      <p className="-mt-1.5 text-[12.5px] leading-[19px] text-muted">
        {t.guide.curriculumHint}
      </p>

      {/* Konu açıklamaları BURADA DEĞİL, bölüm başlıklarında duruyor: bu
          şerit dört karodan ibaretti ve her karo, hemen altındaki bölüm
          başlığının başlığını, açıklamasını ve sayacını birebir tekrar
          ediyordu — sayfanın en düz yeri oydu. Şerit artık numaralı bir
          güzergâh: hangi blok, kaç yazı, ne kadar okuma. */}
      <Panel className="grid grid-cols-2 divide-line-soft overflow-hidden sm:grid-cols-4 sm:divide-x">
        {GUIDE_TOPICS.map((topic, index) => {
          const group = groupOf(topic.key);
          return (
            <a
              key={topic.key}
              href={`#konu-${topic.key}`}
              className={cn(
                "group flex min-w-0 flex-col gap-1 px-4 py-3.5 transition-colors hover:bg-primary-tint",
                /* Telefonda şerit 2×2 kırılıyor ve iki sıra arasında hiçbir
                   ayraç kalmıyordu; dörtlü sıraya geçince divide-x devralır. */
                index >= 2 && "border-t border-line-soft sm:border-t-0",
              )}
            >
              <span className="numeral text-[11px] font-bold text-primary">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="display-ink display-ink-tight w-fit text-[15px] font-bold tracking-[-0.02em]">
                {guideTopicLabel(topic.key, locale)}
              </span>
              <span className="numeral mt-auto flex items-center gap-1.5 pt-1.5 text-[11px] text-muted">
                {group.length} {t.guide.articlesCount} · ~{minutesOf(group)}{" "}
                {t.guide.readMinutes}
                <ArrowRight
                  weight="bold"
                  size={11}
                  className="ml-auto shrink-0 text-primary opacity-0 transition-opacity group-hover:opacity-100"
                  aria-hidden
                />
              </span>
            </a>
          );
        })}
      </Panel>
    </section>
  );
}

/** Filtreli hâl: konunun kendi başlığı, açıklaması ve tek ızgara. */
function TopicView({
  topic,
  articles,
  locale,
  t,
}: {
  topic: GuideTopicKey;
  articles: GuideArticle[];
  locale: Locale;
  t: Dictionary;
}) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5 border-b border-line pb-3">
        <Link
          href="/rehber"
          scroll={false}
          className="-my-2 inline-flex w-fit min-h-8 items-center gap-1.5 py-2 text-[12px] font-semibold text-muted transition-colors hover:text-primary"
        >
          <ArrowLeft weight="bold" size={12} />
          {t.guide.allTopics}
        </Link>
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 className="display-ink display-ink-tight w-fit text-[19px] font-bold tracking-[-0.03em]">
            {guideTopicLabel(topic, locale)}
          </h2>
          <span className="numeral text-[12px] text-muted">
            {articles.length} {t.guide.articlesCount}
          </span>
        </div>
        <p className="max-w-[64ch] text-[12.5px] leading-[19px] text-muted">
          {guideTopicDesc(topic, locale)}
        </p>
      </div>

      {articles.length === 0 ? (
        <Panel>
          <EmptyState title={t.guide.empty} />
        </Panel>
      ) : (
        <ArticleGrid articles={articles} locale={locale} t={t} />
      )}
    </section>
  );
}

/**
 * Yazı kartları. Sağ üstteki numara yazının konu içindeki sırası —
 * müfredat hissini kart düzeyine taşır. Konu etiketi kartlarda yok:
 * kartlar her iki görünümde de kendi konu başlığının altında duruyor,
 * tekrarı gürültü yapıyordu.
 */
function ArticleGrid({
  articles,
  locale,
  t,
}: {
  articles: GuideArticle[];
  locale: string;
  t: Dictionary;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {articles.map((article, index) => (
        <Link
          key={article.slug}
          href={`/rehber/${article.slug}`}
          prefetch={false}
          className="min-w-0"
        >
          <Panel className="panel-hover flex h-full flex-col gap-4 p-5">
            {/* Sağ üstte sıra numarası ve zorluk. Rozet KARTTA, çünkü
                okuyucu nereden başlayacağına listeye bakarken karar veriyor;
                yalnızca yazı sayfasında dursaydı seçimi yaptıktan sonra
                öğrenmiş olurdu. */}
            <div className="flex items-start justify-between gap-3">
              <GlyphTile glyph={article.glyph} />
              <span className="flex flex-col items-end gap-1.5">
                <span className="numeral text-[11px] font-bold text-muted">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <LevelBadge level={article.level} locale={locale} />
              </span>
            </div>

            <div className="flex flex-1 flex-col gap-1.5">
              <h3 className="display-ink display-ink-tight w-fit text-[18px] font-bold tracking-[-0.025em]">
                {article.title}
              </h3>
              <p className="text-[13.5px] leading-[21px] text-body">
                {article.dek}
              </p>
            </div>

            <p className="flex items-center gap-1.5 border-t border-line pt-3 text-[12px] font-semibold text-primary">
              {t.guide.cardCta}
              <ArrowRight weight="bold" size={13} />
              <span className="numeral ml-auto font-normal text-muted">
                {readingMinutes(article.bodyMd)} {t.guide.readMinutes}
              </span>
            </p>
          </Panel>
        </Link>
      ))}
    </div>
  );
}
