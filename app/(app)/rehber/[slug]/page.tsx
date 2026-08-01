import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { ArticleBody, readingMinutes } from "@/components/article/ArticleBody";
import { GlyphTile } from "@/components/article/GlyphTile";
import { Panel } from "@/components/ui/primitives";
import {
  GUIDE_ARTICLES,
  guideArticle,
  guideTopicLabel,
} from "@/content/guide";
import { getI18n } from "@/lib/i18n";

/**
 * Rehber yazısı.
 *
 * Metin sütunu kasten dar (68ch): uzun satır okumayı yorar ve bu sayfanın
 * tek işi okutmak. Yan kolon yok — dikkat dağıtacak bir ölçüm kartı burada
 * bilinçli olarak bulunmuyor.
 */

export async function generateStaticParams() {
  return GUIDE_ARTICLES.map((article) => ({ slug: article.slug }));
}

export async function generateMetadata(props: PageProps<"/rehber/[slug]">) {
  const { slug } = await props.params;
  const article = guideArticle(slug);
  if (!article) return {};
  return { title: article.title, description: article.dek };
}

export default async function GuideArticlePage(
  props: PageProps<"/rehber/[slug]">,
) {
  const { slug } = await props.params;
  const article = guideArticle(slug);
  if (!article) notFound();

  const { locale, t } = await getI18n();
  const related = (article.related ?? [])
    .map((key) => guideArticle(key))
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

  return (
    <article className="mx-auto flex w-full max-w-[720px] flex-col gap-7">
      <Link
        href="/rehber"
        className="inline-flex w-fit items-center gap-1.5 text-[12.5px] font-semibold text-muted transition-colors hover:text-primary"
      >
        <ArrowLeft weight="bold" size={13} />
        {t.guide.backToList}
      </Link>

      <header className="flex flex-col gap-4">
        <div className="flex items-center gap-3.5">
          <GlyphTile glyph={article.glyph} size={56} />
          <div className="min-w-0">
            <p className="plate text-[10px] tracking-[0.09em] text-primary">
              {guideTopicLabel(article.topic, locale)}
            </p>
            <p className="numeral mt-1 text-[12px] text-muted">
              {readingMinutes(article.bodyMd)} {t.guide.readMinutes}
            </p>
          </div>
        </div>

        <h1 className="display-ink w-fit text-[30px] font-bold leading-[1.12] tracking-[-0.035em] sm:text-[40px]">
          {article.title}
        </h1>
        <p className="text-[17px] leading-[27px] text-soft">{article.dek}</p>
      </header>

      <hr className="border-t border-line" aria-hidden />

      <ArticleBody markdown={article.bodyMd} />

      {related.length > 0 && (
        <section className="mt-2 flex flex-col gap-3">
          <h2 className="display-ink display-ink-tight w-fit text-[15px] font-bold">
            {t.guide.related}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {related.map((entry) => (
              <Link key={entry.slug} href={`/rehber/${entry.slug}`} prefetch>
                <Panel className="panel-hover flex h-full items-center gap-3 p-4">
                  <GlyphTile glyph={entry.glyph} size={40} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14px] font-bold text-strong">
                      {entry.title}
                    </span>
                    <span className="mt-0.5 block truncate text-[12px] text-muted">
                      {entry.dek}
                    </span>
                  </span>
                  <ArrowRight
                    weight="bold"
                    size={14}
                    className="shrink-0 text-primary"
                  />
                </Panel>
              </Link>
            ))}
          </div>
        </section>
      )}
    </article>
  );
}
