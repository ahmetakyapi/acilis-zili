import Link from "next/link";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import { ArticleBody, readingMinutes } from "@/components/article/ArticleBody";
import { EmptyState, Panel } from "@/components/ui/primitives";
import { getStoryBySlug } from "@/lib/data";
import { getI18n } from "@/lib/i18n";
import { formatEtDateLong } from "@/lib/utils";

/**
 * Mercek yazısı — okuma sayfası.
 *
 * Künye kasten gövdenin ALTINDA: kaynak listesi ve sorumluluk notu okuyanı
 * metne girmeden karşılamamalı, ama yazının bir parçası olarak da mutlaka
 * bulunmalı. Bu metinler isimsiz kaynaklara dayanan haberlerden derleniyor;
 * neye dayandığını saklamak seçenek değil.
 */

export async function generateMetadata(props: PageProps<"/mercek/[slug]">) {
  const { slug } = await props.params;
  const { locale } = await getI18n();
  const story = await getStoryBySlug(slug, locale);
  if (!story) return {};
  return { title: story.title, description: story.dek };
}

export default async function StoryPage(props: PageProps<"/mercek/[slug]">) {
  const { slug } = await props.params;
  const { locale, t } = await getI18n();
  const story = await getStoryBySlug(slug, locale);

  if (!story) {
    return (
      <Panel>
        <EmptyState
          title={t.stories.notFound}
          hint={t.stories.notFoundHint}
          action={
            <Link
              href="/mercek"
              className="text-[12.5px] font-semibold text-primary"
            >
              {t.stories.backToList}
            </Link>
          }
        />
      </Panel>
    );
  }

  const minutes = story.readMinutes ?? readingMinutes(story.bodyMd);
  const sources = story.sources ?? [];

  return (
    <article className="mx-auto flex w-full max-w-[720px] flex-col gap-7">
      <Link
        href="/mercek"
        className="inline-flex w-fit items-center gap-1.5 text-[12.5px] font-semibold text-muted transition-colors hover:text-primary"
      >
        <ArrowLeft weight="bold" size={13} />
        {t.stories.backToList}
      </Link>

      <header className="flex flex-col gap-4">
        <p className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11.5px]">
          <span className="plate text-[10px] tracking-[0.09em] text-primary">
            {t.stories.eyebrow}
          </span>
          <span className="numeral text-muted">
            {formatEtDateLong(story.eventDate, locale)}
          </span>
          <span aria-hidden className="text-muted">
            ·
          </span>
          <span className="numeral text-muted">
            {minutes} {t.stories.readMinutes}
          </span>
        </p>

        <h1 className="display-ink w-fit text-[30px] font-bold leading-[1.12] tracking-[-0.035em] sm:text-[40px]">
          {story.title}
        </h1>
        <p className="text-[17px] leading-[27px] text-soft">{story.dek}</p>

        {story.symbols && story.symbols.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            {story.symbols.map((symbol) => (
              <Link
                key={symbol}
                href={`/hisse/${symbol}`}
                className="numeral rounded-lg border border-line bg-surface px-2 py-1 text-[11.5px] font-bold text-body transition-colors hover:border-line-strong hover:bg-primary-tint hover:text-primary"
              >
                {symbol}
              </Link>
            ))}
          </div>
        )}
      </header>

      <hr className="border-t border-line" aria-hidden />

      <ArticleBody markdown={story.bodyMd} />

      {/* ---- Künye ---- */}
      <footer className="mt-2 flex flex-col gap-3 border-t border-line pt-5">
        {sources.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="plate text-[10px] tracking-[0.09em]">
              {t.stories.sources}
            </p>
            <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-[12.5px]">
              {sources.map((source) => (
                <li key={source.label}>
                  {source.url ? (
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="text-primary transition-colors hover:text-primary-hover"
                    >
                      {source.label}
                    </a>
                  ) : (
                    <span className="text-body">{source.label}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
        <p className="text-[11.5px] leading-relaxed text-muted">
          {t.stories.disclaimer}
        </p>
      </footer>
    </article>
  );
}
