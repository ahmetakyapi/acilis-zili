import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { ArticleBody, readingMinutes } from "@/components/article/ArticleBody";
import { LevelBadge } from "@/components/article/LevelBadge";
import { GlyphTile } from "@/components/article/GlyphTile";
import { Panel } from "@/components/ui/primitives";
import {
  GUIDE_SLUGS,
  guideArticle,
  guideArticles,
  guideTopicLabel,
  type GuideArticle,
} from "@/content/guide";
import { getI18n, type Dictionary } from "@/lib/i18n";
import { pageAlternates } from "@/lib/site";
import { ArticleJsonLd, BreadcrumbJsonLd } from "@/components/seo/JsonLd";

/**
 * Rehber yazısı.
 *
 * Metin sütunu kasten dar (68ch): uzun satır okumayı yorar ve bu sayfanın
 * tek işi okutmak. Yan kolon yok — dikkat dağıtacak bir ölçüm kartı burada
 * bilinçli olarak bulunmuyor.
 *
 * Sayfa sonunda müfredat gezinmesi var: rehber sıralı bir okuma listesi ve
 * bir yazıyı bitiren okuyucunun en olası sorusu "sırada ne var". İlişkili
 * yazılar (konusal komşuluk) ile önceki/sıradaki (müfredat komşuluğu) ayrı
 * şeyler söylüyor, ikisi de duruyor.
 */

export async function generateStaticParams() {
  return GUIDE_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata(props: PageProps<"/rehber/[slug]">) {
  const { slug } = await props.params;
  const { locale } = await getI18n();
  const article = guideArticle(slug, locale);
  if (!article) return {};
  return {
    title: article.title,
    description: article.dek,
    /* CANONICAL VE HREFLANG. Dinamik sayfalar künyelerini elden yazıyor ve
       `alternates` bloğunu hiç vermiyorlardı: sitenin en kalabalık
       adresleri (yüzlerce hisse, her yazı, her analiz) canonical'sız ve
       "öteki dildeki karşılığı şu" bilgisi olmadan yayımlanıyordu. Kök
       layout canonical yazmıyor (orada gerekçesi var), yani miras da yok.
       `pageAlternates` RSS keşif etiketini de birlikte taşıyor. */
    alternates: pageAlternates(`/rehber/${slug}`, locale),
    /* Yazı, "website" değil: gerekçe mercek sayfasında. */
    openGraph: { type: "article", authors: ["Açılış Zili"] },
  };
}

export default async function GuideArticlePage(
  props: PageProps<"/rehber/[slug]">,
) {
  const { slug } = await props.params;
  const { locale, t } = await getI18n();
  const article = guideArticle(slug, locale);
  if (!article) notFound();

  const related = article.related
    .map((key) => guideArticle(key, locale))
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

  /* Müfredat komşuları — sıra meta.ts'teki dizilişten gelir. */
  const all = guideArticles(locale);
  const position = all.findIndex((entry) => entry.slug === article.slug);
  const prev = position > 0 ? all[position - 1] : null;
  const next = position < all.length - 1 ? all[position + 1] : null;

  return (
    <article className="mx-auto flex w-full max-w-[720px] flex-col gap-7">
      <ArticleJsonLd
        headline={article.title}
        description={article.dek}
        path={`/rehber/${article.slug}`}
        locale={locale}
      />
      <BreadcrumbJsonLd
        locale={locale}
        items={[
          { name: t.nav.guide, path: "/rehber" },
          { name: article.title, path: `/rehber/${article.slug}` },
        ]}
      />
      <Link
        href="/rehber"
        className="-my-2 inline-flex w-fit min-h-8 items-center gap-1.5 py-2 text-small font-semibold text-muted transition-colors hover:text-primary"
      >
        <ArrowLeft weight="bold" size={13} />
        {t.guide.backToList}
      </Link>

      <header className="flex flex-col gap-4">
        <div className="flex items-center gap-3.5">
          <GlyphTile glyph={article.glyph} size={56} />
          <div className="min-w-0">
            <p className="plate text-nano tracking-[0.09em] text-primary">
              {guideTopicLabel(article.topic, locale)}
            </p>
            {/* Zorluk ile okuma süresi aynı satırda: ikisi de "bu yazıya
                girmeye hazır mıyım" sorusunun parçası — biri hazırlığı,
                öteki zamanı ölçüyor. */}
            <p className="mt-1.5 flex flex-wrap items-center gap-2">
              <LevelBadge level={article.level} locale={locale} />
              <span className="numeral text-small text-muted">
                {readingMinutes(article.bodyMd)} {t.guide.readMinutes}
              </span>
            </p>
          </div>
        </div>

        <h1 className="display-ink w-fit text-subdisplay font-bold leading-[1.12] tracking-[-0.035em] sm:text-display">
          {article.title}
        </h1>
        <p className="text-lead leading-[27px] text-soft">{article.dek}</p>
      </header>

      <hr className="border-t border-line" aria-hidden />

      <ArticleBody markdown={article.bodyMd} locale={locale} />

      {related.length > 0 && (
        <section className="mt-2 flex flex-col gap-3">
          <h2 className="display-ink display-ink-tight w-fit text-read font-bold">
            {t.guide.related}
          </h2>
          {/* Bağlantılardaki min-w-0: içerideki `truncate` nowrap demek, o da
              ızgara hücresinin min-content genişliğini metnin tamamına
              çıkarıyor ve sayfayı yana taşırıyordu. */}
          <div className="grid gap-3 sm:grid-cols-2">
            {related.map((entry) => (
              <Link
                key={entry.slug}
                href={`/rehber/${entry.slug}`}
                prefetch
                className="min-w-0"
              >
                <Panel className="panel-hover flex h-full items-center gap-3 p-4">
                  <GlyphTile glyph={entry.glyph} size={40} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-base font-bold text-strong">
                      {entry.title}
                    </span>
                    <span className="mt-0.5 block truncate text-small text-muted">
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

      {(prev || next) && (
        <nav className="grid gap-3 border-t border-line pt-6 sm:grid-cols-2">
          {prev ? (
            <CurriculumStep
              article={prev}
              label={t.guide.prevArticle}
              direction="prev"
            />
          ) : (
            <span aria-hidden className="hidden sm:block" />
          )}
          {next && (
            <CurriculumStep
              article={next}
              label={t.guide.nextArticle}
              direction="next"
            />
          )}
        </nav>
      )}
    </article>
  );
}

function CurriculumStep({
  article,
  label,
  direction,
}: {
  article: GuideArticle;
  label: Dictionary["guide"]["prevArticle"];
  direction: "prev" | "next";
}) {
  const next = direction === "next";
  return (
    <Link href={`/rehber/${article.slug}`} prefetch className="min-w-0">
      <Panel
        className={`panel-hover flex h-full items-center gap-3 p-4 ${next ? "text-right" : ""}`}
      >
        {!next && (
          <ArrowLeft weight="bold" size={14} className="shrink-0 text-primary" />
        )}
        <span className={`min-w-0 flex-1 ${next ? "order-first" : ""}`}>
          <span className="plate text-micro tracking-[0.09em]">{label}</span>
          <span className="mt-1 block truncate text-base font-bold text-strong">
            {article.title}
          </span>
        </span>
        {next && (
          <ArrowRight
            weight="bold"
            size={14}
            className="shrink-0 text-primary"
          />
        )}
      </Panel>
    </Link>
  );
}
